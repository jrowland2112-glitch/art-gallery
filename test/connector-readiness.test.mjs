import test from 'node:test';
import assert from 'node:assert/strict';
import { auditConnectorReadiness } from '../scripts/connector-readiness.mjs';

const catalog = [
  { finish: 'Framed', size: '12x18' },
  { finish: 'Metal', size: '12x18' },
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
