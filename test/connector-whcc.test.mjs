import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertSandboxOnly, assertWhccOrigin, submissionAuthorization, WHCC_LIVE_ORIGIN, WHCC_SANDBOX_ORIGIN,
  whccRuntime,
} from '../connector/src/constants.mjs';
import { createWhccClient, createWhccSandboxClient } from '../connector/src/whcc.mjs';

test('sandbox guard permanently rejects the WHCC Live origin', () => {
  assert.equal(assertSandboxOnly(`${WHCC_SANDBOX_ORIGIN}/api/v1/discovery`).origin, WHCC_SANDBOX_ORIGIN);
  assert.throws(() => assertSandboxOnly('https://apis.whcc.com/api/v1/discovery'), /Safety stop/);
});

test('WHCC client sends the pinned API version only to Test', async () => {
  let captured;
  const client = createWhccSandboxClient({
    apiKey: 'test-key-not-a-real-secret',
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return new Response(JSON.stringify({ operations: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  await client.discovery();
  assert.match(captured.url, /^https:\/\/apis-stage\.whcc\.com\//);
  assert.equal(captured.init.headers['whcc-api-version'], '2026-10');
  assert.equal(captured.init.headers.authorization, 'Bearer test-key-not-a-real-secret');
});

test('Live client is pinned to the exact WHCC Live origin', async () => {
  let captured;
  const client = createWhccClient({
    apiKey: 'live-key-not-a-real-secret',
    environment: 'live',
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return new Response(JSON.stringify({ operations: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  await client.discovery();
  assert.match(captured.url, /^https:\/\/apis\.whcc\.com\/api\//);
  assert.equal(assertWhccOrigin(captured.url, 'live').origin, WHCC_LIVE_ORIGIN);
  assert.throws(() => assertWhccOrigin(captured.url, 'test'), /Safety stop/);
});

test('Live submission requires its kill switch and either an exact order allowlist or full rollout', () => {
  const base = { WHCC_ENVIRONMENT: 'live', WHCC_LIVE_API_KEY: 'not-a-real-secret' };
  assert.equal(submissionAuthorization(base, '1001').allowed, false);
  assert.equal(submissionAuthorization({ ...base, WHCC_LIVE_SUBMIT_ENABLED: 'true' }, '1001').allowed, false);
  assert.equal(submissionAuthorization({
    ...base, WHCC_LIVE_SUBMIT_ENABLED: 'true', WHCC_LIVE_ORDER_IDS: '1001, 1002',
  }, '1001').allowed, true);
  assert.equal(submissionAuthorization({
    ...base, WHCC_LIVE_SUBMIT_ENABLED: 'true', WHCC_LIVE_ORDER_IDS: '1001, 1002',
  }, '9999').allowed, false);
  assert.equal(submissionAuthorization({
    ...base, WHCC_LIVE_SUBMIT_ENABLED: 'true', WHCC_LIVE_FULL_ROLLOUT_ENABLED: 'true',
  }, '9999').allowed, true);
});

test('Test and Live credentials stay separate', () => {
  const env = { WHCC_TEST_API_KEY: 'test-key', WHCC_LIVE_API_KEY: 'live-key' };
  assert.equal(whccRuntime({ ...env, WHCC_ENVIRONMENT: 'test' }).apiKey, 'test-key');
  assert.equal(whccRuntime({ ...env, WHCC_ENVIRONMENT: 'live' }).apiKey, 'live-key');
  assert.throws(() => whccRuntime({ WHCC_ENVIRONMENT: 'production' }), /test or live/);
});
