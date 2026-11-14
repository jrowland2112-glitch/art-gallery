import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../bulk-upload/finerworks/mappings.json' with { type: 'json' };
import { planFinerworksMappings } from '../scripts/apply-finerworks-product-mappings.mjs';

test('plans all nine independent FinerWorks mappings without touching WHCC fields', () => {
  let id = 0;
  const nodes = Object.entries(catalog.finishes).flatMap(([finish, config]) => Object.keys(config.variants).map((size) => ({
    id: `variant-${++id}`,
    title: `${finish} / ${size}`,
    selectedOptions: [{ name: 'Finish', value: finish }, { name: 'Size', value: size }],
  })));
  const fields = planFinerworksMappings({ id: 'product-1', title: 'Photo', variants: { nodes } }, catalog);
  assert.equal(fields.length, 9);
  assert.ok(fields.every((field) => field.key === 'finerworks_mapping'));
  assert.ok(fields.every((field) => JSON.parse(field.value).productCode));
  const framed = JSON.parse(fields.find((field) => field.label === 'Framed / 12x18').value);
  assert.equal(framed.productCode, '5M7M8S12X18F96S17X23J1S12X18K1S14DD5X20DD5G1');
});

test('refuses products without the exact approved nine variants', () => {
  assert.throws(() => planFinerworksMappings({ id: 'product-1', title: 'Photo', variants: { nodes: [] } }, catalog), /expected exactly 9/);
});
