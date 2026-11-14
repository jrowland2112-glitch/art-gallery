import { enabled } from './constants.mjs';
import { finerworksTestAuthorization } from './finerworks-constants.mjs';
import { all, first, run, updateJob } from './database.mjs';
import { signAsset } from './crypto.mjs';
import { createFinerworksClient } from './finerworks.mjs';
import { finerworksOrder, finerworksRecipient, parseFinerworksMapping, parseSourceDimensions } from './finerworks-order.mjs';
import { orderLines } from './order.mjs';
import { createShopifyAdminClient } from './shopify.mjs';

function publicBaseUrl(env) {
  const parsed = new URL(env.PUBLIC_BASE_URL || '');
  if (parsed.protocol !== 'https:') throw new Error('PUBLIC_BASE_URL must be an https URL.');
  return parsed.origin;
}

async function signedAssetUrl(key, env) {
  const expires = Math.floor(Date.now() / 1000) + Number(env.ASSET_URL_TTL_SECONDS || 1209600);
  const signature = await signAsset(key, expires, env.IMAGE_URL_SIGNING_SECRET);
  const url = new URL('/fulfillment-assets', publicBaseUrl(env));
  url.searchParams.set('key', key);
  url.searchParams.set('expires', String(expires));
  url.searchParams.set('signature', signature);
  return url.href;
}

function clients(env) {
  return {
    shopify: createShopifyAdminClient({
      store: env.SHOPIFY_STORE,
      clientId: env.SHOPIFY_CLIENT_ID,
      clientSecret: env.SHOPIFY_CLIENT_SECRET,
    }),
    finerworks: createFinerworksClient({ webApiKey: env.FINERWORKS_WEB_API_KEY, appKey: env.FINERWORKS_APP_KEY }),
  };
}

function responseOrderId(payload) {
  const order = payload?.orders?.[0] || payload?.order_results?.[0] || payload?.results?.[0];
  const value = order?.order_id ?? order?.id ?? payload?.order_id;
  return value === undefined || value === null ? null : String(value);
}

function productTotal(payload, quantities) {
  const prices = payload?.prices || [];
  if (prices.length !== quantities.length) throw new Error('FinerWorks did not return pricing for every mapped product.');
  let total = 0;
  for (const price of prices) {
    const code = String(price.product_code || price.product_sku || '').toLowerCase();
    const quantity = quantities.get(code);
    const amount = Number(price.total_price);
    if (!quantity || !Number.isFinite(amount) || amount <= 0 || price.info) {
      throw new Error(`FinerWorks returned invalid pricing for ${code || 'a mapped product'}.`);
    }
    total += amount * quantity;
  }
  return total;
}

export async function createFinerworksJob(env, webhookId, order) {
  const lines = orderLines(order);
  if (!lines.length) throw new Error('The paid order has no fulfillable product variants.');
  const maximumLines = Number(env.FINERWORKS_MAX_LINE_ITEMS || 20);
  const maximumQuantity = Number(env.FINERWORKS_MAX_ITEM_QUANTITY || 10);
  if (lines.length > maximumLines) throw new Error(`The order exceeds the ${maximumLines}-line FinerWorks safety limit.`);
  if (lines.some((line) => line.quantity > maximumQuantity)) {
    throw new Error(`The order exceeds the ${maximumQuantity}-unit per-line FinerWorks safety limit.`);
  }
  await run(
    env.STATE,
    `INSERT OR IGNORE INTO fulfillment_jobs
      (order_id, webhook_id, order_name, status, recipient_json, line_items_json, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', ?, ?, datetime('now'), datetime('now'))`,
    String(order.id), webhookId, order.name || String(order.id),
    JSON.stringify(finerworksRecipient(order)), JSON.stringify(lines),
  );
}

async function prepareJob(env, job) {
  const { shopify, finerworks } = clients(env);
  const lines = JSON.parse(job.line_items_json);
  const items = [];
  await updateJob(env.STATE, job.order_id, 'preparing', { error: null });

  for (const line of lines) {
    const variant = await shopify.variantFulfillmentData(line.variantId);
    if (!variant) throw new Error(`Shopify variant ${line.variantId} no longer exists.`);
    const rawMapping = variant.finerworksMapping?.value;
    const sourceKey = variant.product?.source?.value;
    if (!rawMapping && !sourceKey) continue;
    if (!rawMapping) throw new Error(`${variant.product?.title || line.title} has no FinerWorks mapping.`);
    if (!sourceKey) throw new Error(`${variant.product?.title || line.title} has no private source object key.`);
    const mapping = parseFinerworksMapping(rawMapping);
    const dimensions = parseSourceDimensions(variant.product?.sourceDimensions?.value);
    const original = await env.ORIGINALS.head(sourceKey);
    if (!original) throw new Error(`Private original not found for ${variant.product?.title || line.title}.`);
    const contentType = original.httpMetadata?.contentType?.toLowerCase();
    if (!['image/jpeg', 'image/png'].includes(contentType)) {
      throw new Error(`${variant.product?.title || line.title} must be a JPEG or PNG for FinerWorks.`);
    }
    if (Number(original.size) > 40 * 1024 * 1024) {
      throw new Error(`${variant.product?.title || line.title} exceeds the connector's 40 MB image safety limit.`);
    }
    items.push({
      lineItemId: line.lineItemId,
      quantity: line.quantity,
      title: variant.product?.title || line.title,
      productCode: mapping.productCode,
      width: dimensions.width,
      height: dimensions.height,
      assetUrl: await signedAssetUrl(sourceKey, env),
    });
  }
  if (!items.length) throw new Error('No line item in this order is mapped for FinerWorks fulfillment.');

  if (!env.FINERWORKS_STATUS_WEBHOOK_TOKEN) throw new Error('FINERWORKS_STATUS_WEBHOOK_TOKEN is not configured.');
  const webhook = new URL('/webhooks/finerworks/status', publicBaseUrl(env));
  webhook.searchParams.set('token', env.FINERWORKS_STATUS_WEBHOOK_TOKEN);
  const orderPayload = finerworksOrder({
    orderId: job.order_id,
    orderName: job.order_name,
    recipient: JSON.parse(job.recipient_json),
    items,
    webhookUrl: webhook.href,
  });
  const quantities = new Map();
  for (const item of items) {
    const code = item.productCode.toLowerCase();
    quantities.set(code, (quantities.get(code) || 0) + item.quantity);
  }
  const [prices, shipping, validation] = await Promise.all([
    finerworks.prices([...new Set(items.map((item) => item.productCode))]),
    finerworks.shippingOptions([orderPayload]),
    finerworks.validateTestOrders([orderPayload]),
  ]);
  const total = productTotal(prices, quantities);
  const maximum = Number(env.FINERWORKS_TEST_MAX_PRODUCT_TOTAL || 500);
  if (total > maximum) throw new Error(`FinerWorks Test product total $${total.toFixed(2)} exceeds the $${maximum.toFixed(2)} safety limit.`);
  await updateJob(env.STATE, job.order_id, 'validated', {
    request_json: JSON.stringify(orderPayload),
    validation_json: JSON.stringify({ prices, shipping, validation, productTotal: total }),
  });
}

async function submitValidatedJob(env, job) {
  if (!finerworksTestAuthorization(env).allowed) return;
  const claimed = await run(
    env.STATE,
    "UPDATE fulfillment_jobs SET status = 'submitting', updated_at = datetime('now') WHERE order_id = ? AND status = 'validated'",
    String(job.order_id),
  );
  if (Number(claimed.meta?.changes || 0) !== 1) return;
  const finerworks = createFinerworksClient({ webApiKey: env.FINERWORKS_WEB_API_KEY, appKey: env.FINERWORKS_APP_KEY });
  try {
    const submitted = await finerworks.submitTestOrders([JSON.parse(job.request_json)]);
    const id = responseOrderId(submitted);
    if (!id) throw new Error('FinerWorks accepted the test request without returning an order ID.');
    await updateJob(env.STATE, job.order_id, 'test_submitted', { finerworks_order_id: id, error: null });
  } catch (error) {
    await updateJob(env.STATE, job.order_id, 'submission_unknown', {
      error: `Do not retry automatically; reconcile the stable order PO first. ${String(error?.message || error).slice(0, 1800)}`,
    });
    throw error;
  }
}

export async function processFinerworksJob(env, orderId) {
  let job = await first(env.STATE, 'SELECT * FROM fulfillment_jobs WHERE order_id = ?', String(orderId));
  if (!job) throw new Error(`FinerWorks fulfillment job ${orderId} was not found.`);
  try {
    if (job.status === 'pending') {
      await prepareJob(env, job);
      job = await first(env.STATE, 'SELECT * FROM fulfillment_jobs WHERE order_id = ?', String(orderId));
    }
    if (job.status === 'validated') await submitValidatedJob(env, job);
  } catch (error) {
    const current = await first(env.STATE, 'SELECT status FROM fulfillment_jobs WHERE order_id = ?', String(orderId));
    if (current?.status !== 'submission_unknown') {
      await updateJob(env.STATE, orderId, 'failed', { error: String(error?.message || error).slice(0, 2000) });
    }
    throw error;
  }
}

export async function processPendingFinerworksJobs(env, limit = 10) {
  const jobs = await all(env.STATE,
    "SELECT order_id, status FROM fulfillment_jobs WHERE status IN ('pending', 'validated') ORDER BY created_at LIMIT ?", limit);
  for (const job of jobs) {
    if (job.status === 'validated' && !finerworksTestAuthorization(env).allowed) continue;
    try { await processFinerworksJob(env, job.order_id); } catch (error) {
      console.error(`FinerWorks Test job ${job.order_id} failed:`, error?.message || error);
    }
  }
}

export async function reconcileFinerworksTestJobs(env, limit = 10) {
  if (!enabled(env.FINERWORKS_TEST_STATUS_POLL_ENABLED)) return;
  const jobs = await all(env.STATE,
    "SELECT * FROM fulfillment_jobs WHERE status = 'test_submitted' ORDER BY updated_at LIMIT ?", limit);
  if (!jobs.length) return;
  const client = createFinerworksClient({ webApiKey: env.FINERWORKS_WEB_API_KEY, appKey: env.FINERWORKS_APP_KEY });
  for (const job of jobs) {
    try {
      const status = await client.orderStatus({ orderIds: [Number(job.finerworks_order_id)] });
      await updateJob(env.STATE, job.order_id, 'test_submitted', { status_json: JSON.stringify(status), error: null });
    } catch (error) {
      await updateJob(env.STATE, job.order_id, 'reconciliation_failed', { error: String(error?.message || error).slice(0, 2000) });
    }
  }
}

export async function cancelFinerworksJob(env, orderId) {
  const job = await first(env.STATE, 'SELECT * FROM fulfillment_jobs WHERE order_id = ?', String(orderId));
  if (!job) return { found: false, stopped: false };
  if (job.status === 'test_submitted' && job.finerworks_order_id) {
    const client = createFinerworksClient({ webApiKey: env.FINERWORKS_WEB_API_KEY, appKey: env.FINERWORKS_APP_KEY });
    await client.updateTestOrder(job.finerworks_order_id, 'cancel');
    await updateJob(env.STATE, orderId, 'test_cancelled', { error: null });
    return { found: true, stopped: true, providerCancellationSent: true };
  }
  if (['submitting', 'submission_unknown'].includes(job.status)) {
    await updateJob(env.STATE, orderId, 'cancellation_requested', { error: 'Reconcile the stable FinerWorks order PO before retrying or cancelling.' });
    return { found: true, stopped: false, manualReconciliationRequired: true };
  }
  await updateJob(env.STATE, orderId, 'cancelled', { error: 'Shopify order cancelled before FinerWorks Test submission.' });
  return { found: true, stopped: true };
}
