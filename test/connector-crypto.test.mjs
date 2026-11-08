import test from 'node:test';
import assert from 'node:assert/strict';
import { hmac, signAsset, verifyAssetSignature, verifyShopifyHmac, verifyWhccSignature } from '../connector/src/crypto.mjs';

function base64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

function hex(bytes) {
  return Buffer.from(bytes).toString('hex').toUpperCase();
}

test('verifies Shopify raw-body HMAC and rejects changed content', async () => {
  const body = '{"id":123,"name":"#1001"}';
  const signature = base64(await hmac('shopify-secret', body));
  assert.equal(await verifyShopifyHmac(body, signature, 'shopify-secret'), true);
  assert.equal(await verifyShopifyHmac(`${body} `, signature, 'shopify-secret'), false);
});

test('verifies WHCC timestamped signatures including rotation values', async () => {
  const body = '{"EventType":"order.accepted"}';
  const timestamp = 1_800_000_000;
  const signature = hex(await hmac('whcc-signing-secret', `${timestamp}.${body}`));
  const header = `t=${timestamp},v1=BAD0,v1=${signature}`;
  assert.equal(await verifyWhccSignature(body, header, 'whcc-signing-secret', timestamp, 600), true);
  assert.equal(await verifyWhccSignature(body, header, 'whcc-signing-secret', timestamp + 601, 600), false);
});

test('private asset signatures expire and are bound to the object key', async () => {
  const signature = await signAsset('originals/abc/photo.jpg', 2000, 'asset-secret');
  assert.equal(await verifyAssetSignature('originals/abc/photo.jpg', 2000, signature, 'asset-secret', 1999), true);
  assert.equal(await verifyAssetSignature('originals/abc/other.jpg', 2000, signature, 'asset-secret', 1999), false);
  assert.equal(await verifyAssetSignature('originals/abc/photo.jpg', 2000, signature, 'asset-secret', 2001), false);
  await assert.rejects(() => signAsset('originals/abc/photo.jpg', 2000, ''), /signing configuration/);
});
