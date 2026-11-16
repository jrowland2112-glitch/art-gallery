import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../connector/src/finerworks-worker.mjs';

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
