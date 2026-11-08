import { enabled, WHCC_SANDBOX_ORIGIN } from './constants.mjs';
import { recordWebhook, run } from './database.mjs';
import { verifyAssetSignature, verifyShopifyHmac, verifyWhccSignature } from './crypto.mjs';
import { createJob, processJob, processPendingJobs } from './jobs.mjs';

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

function expectedShop(value) {
  return String(value || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
}

async function shopifyWebhook(request, env, ctx) {
  if (!enabled(env.CONNECTOR_ENABLED)) return json({ accepted: false, reason: 'connector disabled' });
  const rawBody = await request.text();
  if (!await verifyShopifyHmac(rawBody, request.headers.get('x-shopify-hmac-sha256'), env.SHOPIFY_CLIENT_SECRET)) {
    return json({ error: 'invalid signature' }, 401);
  }
  const topic = request.headers.get('x-shopify-topic');
  const shop = expectedShop(request.headers.get('x-shopify-shop-domain'));
  const webhookId = request.headers.get('x-shopify-webhook-id');
  if (topic !== 'orders/paid') return json({ error: 'unexpected topic' }, 400);
  if (shop !== expectedShop(env.SHOPIFY_STORE)) return json({ error: 'unexpected shop' }, 401);
  if (!webhookId) return json({ error: 'missing webhook id' }, 400);

  let order;
  try {
    order = JSON.parse(rawBody);
  } catch {
    return json({ error: 'invalid json' }, 400);
  }
  if (!order?.id) return json({ error: 'missing order id' }, 400);
  const isNew = await recordWebhook(env.STATE, { id: webhookId, topic, shop, orderId: order.id });
  if (!isNew) return json({ accepted: true, duplicate: true });

  try {
    await createJob(env, webhookId, order);
  } catch (error) {
    await run(env.STATE, "UPDATE webhook_events SET status = 'failed', error = ? WHERE id = ?", String(error.message).slice(0, 2000), webhookId);
    return json({ error: 'order could not be queued' }, 422);
  }
  ctx.waitUntil(processJob(env, order.id).catch((error) => console.error('WHCC sandbox job failed:', error?.message || error)));
  return json({ accepted: true, sandbox: true }, 202);
}

async function whccWebhook(request, env) {
  const rawBody = await request.text();
  if (!await verifyWhccSignature(rawBody, request.headers.get('whcc-signature'), env.WHCC_EVENT_SIGNING_SECRET)) {
    return json({ error: 'invalid signature' }, 401);
  }
  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: 'invalid json' }, 400);
  }
  if (!event.EventType || !event.ConfirmationId || !event.SequenceNumber || !event.OrderNumber) {
    return json({ error: 'missing WHCC event identity' }, 400);
  }
  const eventKey = [event.EventType, event.ConfirmationId, event.SequenceNumber, event.OrderNumber].map((value) => value || '').join('|');
  await run(
    env.STATE,
    `INSERT OR IGNORE INTO whcc_events
      (event_key, event_type, confirmation_id, sequence_number, order_number, payload_json, received_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    eventKey, event.EventType || 'unknown', event.ConfirmationId || null, event.SequenceNumber || null,
    event.OrderNumber || null, rawBody,
  );
  return json({ accepted: true });
}

async function fulfillmentAsset(request, env) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  const expires = url.searchParams.get('expires');
  const signature = url.searchParams.get('signature');
  if (!await verifyAssetSignature(key, expires, signature, env.IMAGE_URL_SIGNING_SECRET)) {
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
      return json({
        ok: true,
        connectorEnabled: enabled(env.CONNECTOR_ENABLED),
        sandboxSubmitEnabled: enabled(env.WHCC_SANDBOX_SUBMIT_ENABLED),
        whccOrigin: WHCC_SANDBOX_ORIGIN,
      });
    }
    if (request.method === 'GET' && url.pathname === '/fulfillment-assets') return fulfillmentAsset(request, env);
    if (request.method === 'POST' && url.pathname === '/webhooks/shopify/orders-paid') return shopifyWebhook(request, env, ctx);
    if (request.method === 'POST' && url.pathname === '/webhooks/whcc') return whccWebhook(request, env);
    return new Response('Not found', { status: 404 });
  },

  async scheduled(_controller, env, ctx) {
    if (enabled(env.CONNECTOR_ENABLED)) ctx.waitUntil(processPendingJobs(env));
  },
};
