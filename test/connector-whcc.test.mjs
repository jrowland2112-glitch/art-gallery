import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSandboxOnly, WHCC_SANDBOX_ORIGIN } from '../connector/src/constants.mjs';
import { createWhccSandboxClient } from '../connector/src/whcc.mjs';

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
