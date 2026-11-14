import test from 'node:test';
import assert from 'node:assert/strict';
import { createFinerworksClient, FINERWORKS_ORIGIN } from '../connector/src/finerworks.mjs';

test('requires both FinerWorks credentials', () => {
  assert.throws(() => createFinerworksClient({ appKey: 'test-app' }), /WEB_API_KEY/);
  assert.throws(() => createFinerworksClient({ webApiKey: 'test-web' }), /APP_KEY/);
});

test('pins requests and sends credentials only as headers', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify({ status: { success: true }, collections: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const client = createFinerworksClient({ webApiKey: 'web-secret', appKey: 'app-secret', fetchImpl });
  await client.frameCollections({ id: 7 });
  assert.equal(calls[0].url, `${FINERWORKS_ORIGIN}/v3/list_collections`);
  assert.equal(calls[0].options.headers.web_api_key, 'web-secret');
  assert.equal(calls[0].options.headers.app_key, 'app-secret');
  assert.equal(calls[0].options.body, '{"id":7}');
});

test('rejects API-level failures returned with HTTP 200', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({
    status: { success: false, message: 'Credentials invalid' },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
  const client = createFinerworksClient({ webApiKey: 'web', appKey: 'app', fetchImpl });
  await assert.rejects(client.testCredentials(), /Credentials invalid/);
});

test('builds and prices product codes without order endpoints', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(options.body) });
    return new Response(JSON.stringify({ status: { success: true } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const client = createFinerworksClient({ webApiKey: 'web', appKey: 'app', fetchImpl });
  await client.buildProductCode({ PrintProductTypeID: 5, MediaID: 6 });
  await client.prices(['5M6M9S12X18']);
  assert.equal(calls[0].url, `${FINERWORKS_ORIGIN}/v3/build_product_code`);
  assert.deepEqual(calls[0].body, { build: { PrintProductTypeID: 5, MediaID: 6 } });
  assert.equal(calls[1].url, `${FINERWORKS_ORIGIN}/v3/get_prices`);
  assert.deepEqual(calls[1].body.products, [{ product_qty: 1, product_sku: '5M6M9S12X18' }]);
});
