import { enabled } from './constants.mjs';
import { finerworksEnvironment, finerworksSubmissionAuthorization } from './finerworks-constants.mjs';
import { first, recordWebhook, run } from './database.mjs';
import { verifyAssetSignature, verifyShopifyHmac } from './crypto.mjs';
import { cancelFinerworksJob, createFinerworksJob, processFinerworksJob, processPendingFinerworksJobs, reconcileFinerworksTestJobs } from './finerworks-jobs.mjs';

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

function expectedShop(value) {
  return String(value || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
}

async function verifiedShopifyWebhook(request, env) {
  if (!enabled(env.CONNECTOR_ENABLED)) return json({ accepted: false, reason: 'connector disabled' });
  finerworksEnvironment(env);
  const rawBody = await request.text();
  if (!await verifyShopifyHmac(rawBody, request.headers.get('x-shopify-hmac-sha256'), env.SHOPIFY_CLIENT_SECRET)) {
    return json({ error: 'invalid signature' }, 401);
  }
  const topic = request.headers.get('x-shopify-topic');
  const shop = expectedShop(request.headers.get('x-shopify-shop-domain'));
  const webhookId = request.headers.get('x-shopify-webhook-id');
  if (shop !== expectedShop(env.SHOPIFY_STORE)) return json({ error: 'unexpected shop' }, 401);
  if (!webhookId) return json({ error: 'missing webhook id' }, 400);
  let order;
  try { order = JSON.parse(rawBody); } catch { return json({ error: 'invalid json' }, 400); }
  if (!order?.id) return json({ error: 'missing order id' }, 400);
  return { topic, shop, webhookId, order };
}

async function paidWebhook(request, env, ctx) {
  const verified = await verifiedShopifyWebhook(request, env);
  if (verified instanceof Response) return verified;
  const { topic, shop, webhookId, order } = verified;
  if (topic !== 'orders/paid') return json({ error: 'unexpected topic' }, 400);
  const authorization = finerworksSubmissionAuthorization(env, order.id);
  if (!await recordWebhook(env.STATE, { id: webhookId, topic, shop, orderId: order.id })) {
    return json({ accepted: true, duplicate: true });
  }
  try { await createFinerworksJob(env, webhookId, order); } catch (error) {
    await run(env.STATE, "UPDATE webhook_events SET status = 'failed', error = ? WHERE id = ?", String(error.message).slice(0, 2000), webhookId);
    return json({ error: 'order could not be queued' }, 422);
  }
  ctx.waitUntil(processFinerworksJob(env, order.id).catch((error) => console.error('FinerWorks job failed:', error?.message || error)));
  return json({
    accepted: true,
    environment: authorization.environment,
    submissionAuthorized: authorization.allowed,
    submissionReason: authorization.reason,
  }, 202);
}

async function cancelledWebhook(request, env) {
  const verified = await verifiedShopifyWebhook(request, env);
  if (verified instanceof Response) return verified;
  const { topic, shop, webhookId, order } = verified;
  if (topic !== 'orders/cancelled') return json({ error: 'unexpected topic' }, 400);
  if (!await recordWebhook(env.STATE, { id: webhookId, topic, shop, orderId: order.id })) {
    return json({ accepted: true, duplicate: true });
  }
  return json({ accepted: true, ...await cancelFinerworksJob(env, order.id) });
}

async function statusWebhook(request, env) {
  const url = new URL(request.url);
  if (!env.FINERWORKS_STATUS_WEBHOOK_TOKEN || url.searchParams.get('token') !== env.FINERWORKS_STATUS_WEBHOOK_TOKEN) {
    return json({ error: 'invalid token' }, 401);
  }
  const payload = await request.json().catch(() => null);
  const orderPo = String(payload?.order_po || payload?.OrderPO || '');
  const orderId = orderPo.startsWith('shopify-') ? orderPo.slice(8) : '';
  if (orderId) {
    const job = await first(env.STATE, 'SELECT order_id FROM fulfillment_jobs WHERE order_id = ?', orderId);
    if (job) await run(env.STATE, "UPDATE fulfillment_jobs SET status_json = ?, updated_at = datetime('now') WHERE order_id = ?", JSON.stringify(payload), orderId);
  }
  return json({ accepted: true });
}

async function fulfillmentAsset(request, env) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (!await verifyAssetSignature(key, url.searchParams.get('expires'), url.searchParams.get('signature'), env.IMAGE_URL_SIGNING_SECRET)) {
    return new Response('Not found', { status: 404 });
  }
  const object = await env.ORIGINALS.get(key);
  if (!object) return new Response('Not found', { status: 404 });
  const headers = new Headers({ 'cache-control': 'private, no-store', 'content-type': 'application/octet-stream' });
  object.writeHttpMetadata(headers);
  return new Response(object.body, { headers });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      let environment = 'invalid';
      try { environment = finerworksEnvironment(env); } catch {}
      const authorization = environment === 'invalid'
        ? { allowed: false }
        : finerworksSubmissionAuthorization(env, '__healthcheck__');
      return json({
        ok: environment !== 'invalid', provider: 'FinerWorks', environment,
        connectorEnabled: enabled(env.CONNECTOR_ENABLED),
        testSubmissionEnabled: environment === 'test' && authorization.allowed,
        testStatusPollEnabled: enabled(env.FINERWORKS_TEST_STATUS_POLL_ENABLED),
        liveSubmitGateEnabled: enabled(env.FINERWORKS_LIVE_SUBMIT_ENABLED),
        liveFullRolloutEnabled: enabled(env.FINERWORKS_LIVE_FULL_ROLLOUT_ENABLED),
        livePaymentMethodConfigured: String(env.FINERWORKS_LIVE_PAYMENT_METHOD || '').trim().toLowerCase() === 'account_default',
        liveSubmissionEnabledForUnlistedOrder: environment === 'live' && authorization.allowed,
        liveStatusPollEnabled: enabled(env.FINERWORKS_LIVE_STATUS_POLL_ENABLED),
        shopifyFulfillmentSyncEnabled: false,
      });
    }
    if (request.method === 'GET' && url.pathname === '/fulfillment-assets') return fulfillmentAsset(request, env);
    if (request.method === 'POST' && url.pathname === '/webhooks/shopify/orders-paid') return paidWebhook(request, env, ctx);
    if (request.method === 'POST' && url.pathname === '/webhooks/shopify/orders-cancelled') return cancelledWebhook(request, env);
    if (request.method === 'POST' && url.pathname === '/webhooks/finerworks/status') return statusWebhook(request, env);
    return new Response('Not found', { status: 404 });
  },
  async scheduled(_controller, env, ctx) {
    if (enabled(env.CONNECTOR_ENABLED)) ctx.waitUntil((async () => {
      finerworksEnvironment(env);
      await processPendingFinerworksJobs(env);
      await reconcileFinerworksTestJobs(env);
    })());
  },
};
