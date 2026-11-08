import test from 'node:test';
import assert from 'node:assert/strict';
import { storageConfig, storeOriginal } from '../scripts/lib/storage.mjs';

test('private storage is optional when no storage credentials are set', () => {
  assert.equal(storageConfig({}), null);
});

test('a default region does not look like a partial storage configuration', () => {
  assert.equal(storageConfig({ ORIGINALS_S3_REGION: 'auto' }), null);
});

test('partial private-storage credentials fail closed', () => {
  assert.throws(
    () => storageConfig({ ORIGINALS_S3_BUCKET: 'originals' }),
    /settings are incomplete/,
  );
});

test('Wrangler R2 uses one non-secret bucket setting', () => {
  assert.deepEqual(storageConfig({ ORIGINALS_R2_BUCKET: 'rowland-photo-originals' }), {
    provider: 'wrangler-r2',
    bucket: 'rowland-photo-originals',
  });
});

test('Wrangler R2 and S3 credential modes cannot be mixed', () => {
  assert.throws(
    () => storageConfig({ ORIGINALS_R2_BUCKET: 'originals', ORIGINALS_S3_BUCKET: 'other' }),
    /Choose either/,
  );
});

test('uploads a deterministic private-object key through Wrangler', async () => {
  let input;
  const result = await storeOriginal(
    'E:/SHots/Mountain Light.jpg',
    'abc123',
    { ORIGINALS_R2_BUCKET: 'rowland-photo-originals' },
    { putWithWrangler: async (value) => { input = value; } },
  );
  assert.equal(input.bucket, 'rowland-photo-originals');
  assert.equal(input.key, 'originals/abc123/Mountain Light.jpg');
  assert.equal(input.contentType, 'image/jpeg');
  assert.deepEqual(result, { bucket: 'rowland-photo-originals', key: input.key, existed: null });
});
