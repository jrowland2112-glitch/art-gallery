import test from 'node:test';
import assert from 'node:assert/strict';
import { assertFinerworksTestEnvironment, finerworksTestAuthorization } from '../connector/src/finerworks-constants.mjs';
import { FINERWORKS_APPROVED_PRODUCT_CODES, finerworksOrder, parseFinerworksMapping, parseSourceDimensions } from '../connector/src/finerworks-order.mjs';

const FRAMED_12X18 = '5M7M8S12X18F96S15X21J1S12X18K1S13DD5X19DD5G1';

test('accepts only the explicitly validated FinerWorks product codes', () => {
  assert.equal(FINERWORKS_APPROVED_PRODUCT_CODES.size, 9);
  assert.deepEqual(parseFinerworksMapping(JSON.stringify({
    productCode: FRAMED_12X18, finish: 'Framed', size: '12x18',
  })), { productCode: FRAMED_12X18, finish: 'Framed', size: '12x18' });
  assert.throws(() => parseFinerworksMapping(JSON.stringify({
    productCode: '14M130M68S12X18', finish: 'Framed', size: '12x18',
  })), /approved FinerWorks/);
});

test('requires valid 3:2 source dimensions', () => {
  assert.deepEqual(parseSourceDimensions('{"width":6000,"height":4000}'), { width: 6000, height: 4000 });
  assert.deepEqual(parseSourceDimensions({ width: 4000, height: 6000 }), { width: 4000, height: 6000 });
  assert.throws(() => parseSourceDimensions('{"width":5000,"height":4000}'), /3:2/);
  assert.throws(() => parseSourceDimensions('{}'), /valid source/);
});

test('builds an image-backed order that is always marked as test', () => {
  const order = finerworksOrder({
    orderId: '42', orderName: '#1042', webhookUrl: 'https://example.com/webhooks/finerworks/status?token=secret',
    recipient: { first_name: 'Joseph', last_name: 'Rowland', address_1: '1 Main St', city: 'Albany', state_code: 'NY', zip_postal_code: '12207', country_code: 'us' },
    items: [{ lineItemId: '7', quantity: 1, productCode: FRAMED_12X18, width: 6000, height: 4000, assetUrl: 'https://example.com/asset', title: 'Grist Mill' }],
  });
  assert.equal(order.test_mode, true);
  assert.equal(order.shipping_code, 'EC');
  assert.equal(order.order_po, 'shopify-42');
  assert.equal(order.order_items[0].product_sku, FRAMED_12X18);
  assert.deepEqual(order.order_items[0].product_image, {
    pixel_width: 6000, pixel_height: 4000, product_url_file: 'https://example.com/asset', product_url_thumbnail: null,
  });
});

test('rejects any attempt to configure the isolated Worker as Live', () => {
  assert.equal(assertFinerworksTestEnvironment({ FINERWORKS_ENVIRONMENT: 'test' }), 'test');
  assert.throws(() => assertFinerworksTestEnvironment({ FINERWORKS_ENVIRONMENT: 'live' }), /Test only/);
  assert.equal(finerworksTestAuthorization({ FINERWORKS_TEST_SUBMIT_ENABLED: 'false' }).allowed, false);
  assert.equal(finerworksTestAuthorization({ FINERWORKS_TEST_SUBMIT_ENABLED: 'true' }).allowed, true);
});
