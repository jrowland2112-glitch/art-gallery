import { enabled } from './constants.mjs';
import { all, first, run, updateJob } from './database.mjs';
import { signAsset } from './crypto.mjs';
import { orderLines, parseWhccMapping, submissionBody, whccShipping } from './order.mjs';
import { createShopifyAdminClient } from './shopify.mjs';
import { createWhccSandboxClient } from './whcc.mjs';

function publicBaseUrl(env) {
  const parsed = new URL(env.PUBLIC_BASE_URL || '');
  if (parsed.protocol !== 'https:') throw new Error('PUBLIC_BASE_URL must be an https URL.');
  return parsed.origin;
}

async function signedAssetUrl(key, env) {
  const expires = Math.floor(Date.now() / 1000) + Number(env.ASSET_URL_TTL_SECONDS || 1800);
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
    whcc: createWhccSandboxClient({ apiKey: env.WHCC_SANDBOX_API_KEY }),
  };
}

async function failJob(env, orderId, error) {
  await updateJob(env.STATE, orderId, 'failed', { error: String(error?.message || error).slice(0, 2000) });
  throw error;
}

export async function createJob(env, webhookId, order) {
  const lines = orderLines(order);
  if (lines.length === 0) throw new Error('The paid order has no fulfillable product variants.');
  await run(
    env.STATE,
    `INSERT OR IGNORE INTO fulfillment_jobs
      (order_id, webhook_id, order_name, status, shipping_json, line_items_json, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', ?, ?, datetime('now'), datetime('now'))`,
    String(order.id), webhookId, order.name || String(order.id), JSON.stringify(whccShipping(order)), JSON.stringify(lines),
  );
}

async function buildJob(env, job) {
  const { shopify, whcc } = clients(env);
  const lines = JSON.parse(job.line_items_json);
  const configured = [];

  await updateJob(env.STATE, job.order_id, 'building', { error: null });
  for (const line of lines) {
    const variant = await shopify.variantFulfillmentData(line.variantId);
    if (!variant) throw new Error(`Shopify variant ${line.variantId} no longer exists.`);
    const sourceKey = variant.product?.source?.value;
    const rawMapping = variant.mapping?.value;

    if (!sourceKey && !rawMapping) continue;
    if (!sourceKey) throw new Error(`${variant.product?.title || line.title} has no private source object key.`);
    const mapping = parseWhccMapping(rawMapping);
    const original = await env.ORIGINALS.head(sourceKey);
    if (!original) throw new Error(`Private original not found for ${variant.product?.title || line.title}.`);
    const contentType = original.httpMetadata?.contentType?.toLowerCase();
    if (contentType && !['image/jpeg', 'image/png', 'image/heic', 'image/heif'].includes(contentType)) {
      throw new Error(`${variant.product?.title || line.title} is ${contentType}; WHCC Test requires JPEG, PNG, or HEIC.`);
    }
    if (Number(original.size) > 40 * 1024 * 1024) {
      throw new Error(`${variant.product?.title || line.title} exceeds WHCC's supported 40 MB image limit.`);
    }

    const response = await whcc.build([{
      productId: mapping.productRef,
      selections: { ...mapping.selections, quantity: 1 },
      images: [{ url: await signedAssetUrl(sourceKey, env) }],
    }]);
    const item = response?.items?.[0];
    if (!item?.configuredProductId) throw new Error('WHCC did not return a configured product ID.');
    configured.push({
      lineItemId: line.lineItemId,
      configuredProductId: item.configuredProductId,
      quantity: line.quantity,
      status: item.status || 'processing',
    });
    await run(
      env.STATE,
      `INSERT INTO configured_items (order_id, line_item_id, configured_product_id, quantity, status, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      job.order_id, line.lineItemId, item.configuredProductId, line.quantity, item.status || 'processing',
    );
  }

  if (configured.length === 0) throw new Error('No line item in this order is mapped for WHCC fulfillment.');
  await updateJob(env.STATE, job.order_id, 'awaiting_poll');
}

async function pollJob(env, job) {
  const { whcc } = clients(env);
  const items = await all(
    env.STATE,
    'SELECT line_item_id, configured_product_id, quantity FROM configured_items WHERE order_id = ? ORDER BY line_item_id',
    job.order_id,
  );
  if (items.length === 0) throw new Error('The job has no saved WHCC configured products.');
  const response = await whcc.poll(items.map((item) => item.configured_product_id));
  const statuses = new Map((response?.items || []).map((item) => [item.configuredProductId, item]));

  for (const saved of items) {
    const item = statuses.get(saved.configured_product_id);
    if (!item) throw new Error(`WHCC omitted configured product ${saved.configured_product_id}.`);
    await run(
      env.STATE,
      'UPDATE configured_items SET status = ? WHERE order_id = ? AND configured_product_id = ?',
      item.status, job.order_id, saved.configured_product_id,
    );
    if (item.status === 'failed' || item.status === 'not-found') {
      throw new Error(`WHCC configured product ${saved.configured_product_id} is ${item.status}.`);
    }
  }

  if ([...statuses.values()].some((item) => item.status === 'processing')) return;
  if ([...statuses.values()].some((item) => item.status !== 'ready')) throw new Error('WHCC returned an unknown configured-product status.');

  const submission = submissionBody({
    orderName: job.order_name,
    configuredItems: items.map((item) => ({
      configuredProductId: item.configured_product_id,
      quantity: item.quantity,
    })),
    shipping: JSON.parse(job.shipping_json),
  });
  submission.metadata = { shopifyOrderId: String(job.order_id) };
  const calculation = await whcc.calculate(submission);
  if (calculation?.validation?.isValidForSubmit !== true) throw new Error('WHCC calculation is not valid for submission.');
  const total = Number(calculation?.totalPrice?.value);
  const maximum = Number(env.WHCC_MAX_ORDER_TOTAL || 500);
  if (!Number.isFinite(total) || calculation?.totalPrice?.code !== 'USD') throw new Error('WHCC returned an invalid or non-USD total.');
  if (total > maximum) throw new Error(`WHCC sandbox total $${total.toFixed(2)} exceeds the $${maximum.toFixed(2)} safety limit.`);

  if (!enabled(env.WHCC_SANDBOX_SUBMIT_ENABLED)) {
    await updateJob(env.STATE, job.order_id, 'calculated', { calculation_json: JSON.stringify(calculation) });
    return;
  }

  await updateJob(env.STATE, job.order_id, 'submitting', { calculation_json: JSON.stringify(calculation) });
  const submitted = await whcc.submit(submission, `shopify-order-${job.order_id}`);
  if (!submitted?.id) throw new Error('WHCC accepted the submission request without returning an ID.');
  await updateJob(env.STATE, job.order_id, 'submitted', { whcc_submission_id: submitted.id });
}

export async function processJob(env, orderId) {
  const job = await first(env.STATE, 'SELECT * FROM fulfillment_jobs WHERE order_id = ?', String(orderId));
  if (!job) throw new Error(`Fulfillment job ${orderId} was not found.`);
  try {
    if (job.status === 'pending') await buildJob(env, job);
    else if (job.status === 'awaiting_poll') await pollJob(env, job);
  } catch (error) {
    await failJob(env, job.order_id, error);
  }
}

export async function processPendingJobs(env, limit = 10) {
  const jobs = await all(
    env.STATE,
    "SELECT order_id FROM fulfillment_jobs WHERE status IN ('pending', 'awaiting_poll') ORDER BY created_at LIMIT ?",
    limit,
  );
  for (const job of jobs) {
    try {
      await processJob(env, job.order_id);
    } catch (error) {
      console.error(`WHCC sandbox job ${job.order_id} failed:`, error?.message || error);
    }
  }
}
