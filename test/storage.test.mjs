import test from 'node:test';
import assert from 'node:assert/strict';
import { storageConfig } from '../scripts/lib/storage.mjs';

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
