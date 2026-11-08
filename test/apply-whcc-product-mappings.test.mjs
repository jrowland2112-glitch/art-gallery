import assert from 'node:assert/strict';
import test from 'node:test';

import { planWhccMappings } from '../scripts/apply-whcc-product-mappings.mjs';

const catalogVariants = [
  { finish: 'Framed', size: '12x18', whccProductRef: 'framed-print', whccSelections: { size: '12x18' } },
  { finish: 'Metal', size: '12x18', whccProductRef: 'metal-print', whccSelections: { size: '12x18' } },
];

function product(variants) {
  return {
    id: 'gid://shopify/Product/1',
    handle: 'test-photo',
    title: 'Test Photo',
    sourceObjectKey: null,
    variants: { nodes: variants },
  };
}

test('plans mappings for separate Finish and Size options', () => {
  const plan = planWhccMappings({
    product: product([
      { id: 'variant-1', title: 'Framed / 12x18', selectedOptions: [{ name: 'Finish', value: 'Framed' }, { name: 'Size', value: '12x18' }] },
      { id: 'variant-2', title: 'Metal / 12x18', selectedOptions: [{ name: 'Finish', value: 'Metal' }, { name: 'Size', value: '12x18' }] },
    ]),
    catalogVariants,
    sourceObjectKey: `originals/${'a'.repeat(64)}/photo.jpg`,
  });
  assert.equal(plan.variantMetafields.length, 2);
  assert.deepEqual(JSON.parse(plan.variantMetafields[0].value), {
    productRef: 'framed-print', selections: { size: '12x18' }, finish: 'Framed', size: '12x18',
  });
});

test('supports the legacy combined Title option', () => {
  const plan = planWhccMappings({
    product: product([
      { id: 'variant-1', title: 'Framed 12x18 Black', selectedOptions: [{ name: 'Title', value: 'Framed 12x18 Black' }] },
      { id: 'variant-2', title: 'Metal 12x18', selectedOptions: [{ name: 'Title', value: 'Metal 12x18' }] },
    ]),
    catalogVariants,
    sourceObjectKey: `originals/${'b'.repeat(64)}/photo.jpg`,
  });
  assert.deepEqual(plan.variantMetafields.map(({ label }) => label), ['Framed / 12x18', 'Metal / 12x18']);
});

test('refuses incomplete product variant sets', () => {
  assert.throws(() => planWhccMappings({
    product: product([{ id: 'variant-1', title: 'Framed 12x18', selectedOptions: [] }]),
    catalogVariants,
    sourceObjectKey: `originals/${'c'.repeat(64)}/photo.jpg`,
  }), /expected exactly 2/);
});
