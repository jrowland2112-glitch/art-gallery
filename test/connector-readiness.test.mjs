import test from 'node:test';
import assert from 'node:assert/strict';
import { auditConnectorReadiness } from '../scripts/connector-readiness.mjs';

const catalog = [
  { finish: 'Framed', size: '12x18', whccProductRef: 'ref', whccSelections: { size: '12x18' } },
  { finish: 'Metal', size: '12x18', whccProductRef: 'ref', whccSelections: { size: '12x18' } },
];

function client(products) {
  return { graphql: async () => ({ products: { nodes: products } }) };
}

function variant(title, finish, size) {
  return {
    title,
    whccMapping: { value: JSON.stringify({ productRef: 'ref', selections: { size }, finish, size }) },
  };
}

test('readiness audit accepts a complete active product mapping', async () => {
  const result = await auditConnectorReadiness({
    client: client([{
      title: 'Ready', handle: 'ready', source: { value: 'print-ready/hash/ready.jpg' },
      variants: { nodes: [variant('Framed / 12x18', 'Framed', '12x18'), variant('Metal / 12x18', 'Metal', '12x18')] },
    }]),
    catalogVariants: catalog,
    output: { log() {}, error() {} },
  });
  assert.deepEqual({ products: result.products, variants: result.variants }, { products: 1, variants: 2 });
});

test('readiness audit fails closed for missing source and mapping', async () => {
  await assert.rejects(() => auditConnectorReadiness({
    client: client([{
      title: 'Incomplete', handle: 'incomplete', source: null,
      variants: { nodes: [{ title: 'Framed / 12x18', whccMapping: null }] },
    }]),
    catalogVariants: catalog,
    output: { log() {}, error() {} },
  }), /not ready/);
});

test('readiness audit accepts an exact product-specific size extension', async () => {
  const extension = {
    finish: 'Gallery Wrap', size: '40x60', whccProductRef: 'ref', whccSelections: { size: '40x60', depth: '2_1_2in' },
  };
  const result = await auditConnectorReadiness({
    client: client([{
      title: 'Pilot', handle: 'pilot', source: { value: 'print-ready/hash/pilot.jpg' },
      variants: { nodes: [
        variant('Framed / 12x18', 'Framed', '12x18'),
        variant('Metal / 12x18', 'Metal', '12x18'),
        {
          title: 'Gallery Wrap / 40x60',
          whccMapping: { value: JSON.stringify({ productRef: 'ref', selections: extension.whccSelections, finish: extension.finish, size: extension.size }) },
        },
      ] },
    }]),
    catalogVariants: catalog,
    productVariantExtensions: { pilot: [extension] },
    output: { log() {}, error() {} },
  });
  assert.equal(result.variants, 3);
});

test('readiness audit rejects a product-specific extension on any other product', async () => {
  await assert.rejects(() => auditConnectorReadiness({
    client: client([{
      title: 'Not Pilot', handle: 'not-pilot', source: { value: 'print-ready/hash/not-pilot.jpg' },
      variants: { nodes: [
        variant('Framed / 12x18', 'Framed', '12x18'),
        variant('Metal / 12x18', 'Metal', '12x18'),
        variant('Gallery Wrap / 40x60', 'Gallery Wrap', '40x60'),
      ] },
    }]),
    catalogVariants: catalog,
    productVariantExtensions: { pilot: [{ finish: 'Gallery Wrap', size: '40x60', whccProductRef: 'ref', whccSelections: { size: '40x60' } }] },
    output: { log() {}, error() {} },
  }), /not ready/);
});
