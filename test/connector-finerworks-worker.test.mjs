import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../connector/src/finerworks-worker.mjs';
import { hmac } from '../connector/src/crypto.mjs';

const context = { waitUntil() {} };

test('health reports a disabled Test-only connector by default', async () => {
  const response = await worker.fetch(new Request('https://example.com/health'), {}, context);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    provider: 'FinerWorks',
    environment: 'test',
    connectorEnabled: false,
    testSubmissionEnabled: false,
    testStatusPollEnabled: false,
    liveSubmitGateEnabled: false,
    liveFullRolloutEnabled: false,
    livePaymentMethodConfigured: false,
    liveSubmissionEnabledForUnlistedOrder: false,
    liveStatusPollEnabled: false,
    shopifyFulfillmentSyncEnabled: false,
  });
});

test('disabled connector accepts no Shopify job', async () => {
  const response = await worker.fetch(new Request('https://example.com/webhooks/shopify/orders-paid', { method: 'POST', body: '{}' }), {}, context);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { accepted: false, reason: 'connector disabled' });
});

test('health recognizes Live while every production gate remains off', async () => {
  const response = await worker.fetch(new Request('https://example.com/health'), { FINERWORKS_ENVIRONMENT: 'live' }, context);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.environment, 'live');
  assert.equal(body.connectorEnabled, false);
  assert.equal(body.liveSubmitGateEnabled, false);
  assert.equal(body.liveSubmissionEnabledForUnlistedOrder, false);
});

test('Live capture validates later while billable submission remains unauthorized', async () => {
  const rawBody = JSON.stringify({
    id: 12345, name: '#1003', email: 'joseph@example.com',
    shipping_address: {
      first_name: 'Joseph', last_name: 'Rowland', address1: '1 Main St', city: 'Albany',
      province_code: 'NY', zip: '12207', country_code: 'US',
    },
    line_items: [{ id: 7, variant_id: 8, title: 'Grist Mill', quantity: 1, fulfillable_quantity: 1 }],
  });
  const secret = 'shopify-secret';
  const signature = btoa(String.fromCharCode(...await hmac(secret, rawBody)));
  const runs = [];
  const state = {
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async run() { runs.push({ sql, params }); return { meta: { changes: 1 } }; },
            async first() { return null; },
          };
        },
      };
    },
  };
  const pending = [];
  const liveContext = { waitUntil(promise) { pending.push(promise); } };
  const response = await worker.fetch(new Request('https://example.com/webhooks/shopify/orders-paid', {
    method: 'POST', body: rawBody,
    headers: {
      'x-shopify-hmac-sha256': signature,
      'x-shopify-topic': 'orders/paid',
      'x-shopify-shop-domain': 'rowland-photography-0v8ydig1.myshopify.com',
      'x-shopify-webhook-id': 'webhook-1',
    },
  }), {
    CONNECTOR_ENABLED: 'true', FINERWORKS_ENVIRONMENT: 'live', SHOPIFY_CLIENT_SECRET: secret,
    SHOPIFY_STORE: 'rowland-photography-0v8ydig1.myshopify.com', STATE: state,
    FINERWORKS_LIVE_SUBMIT_ENABLED: 'false', FINERWORKS_LIVE_PAYMENT_METHOD: '',
  }, liveContext);
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), {
    accepted: true,
    environment: 'live',
    submissionAuthorized: false,
    submissionReason: 'FINERWORKS_LIVE_SUBMIT_ENABLED is off',
  });
  assert.equal(runs.some(({ sql }) => sql.includes('INSERT OR IGNORE INTO webhook_events')), true);
  assert.equal(runs.some(({ sql }) => sql.includes('INSERT OR IGNORE INTO fulfillment_jobs')), true);
  await Promise.all(pending);
});
