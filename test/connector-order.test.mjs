import test from 'node:test';
import assert from 'node:assert/strict';
import { orderLines, parseWhccMapping, submissionBody, whccShipping } from '../connector/src/order.mjs';

test('parses only complete WHCC mappings', () => {
  assert.deepEqual(parseWhccMapping('{"productRef":"metal-print","selections":{"size":"12x18"}}'), {
    productRef: 'metal-print',
    selections: { size: '12x18' },
  });
  assert.throws(() => parseWhccMapping('{"productRef":null,"selections":null}'), /missing its WHCC/);
});

test('converts a Shopify shipping address to WHCC fields', () => {
  const shipping = whccShipping({
    email: 'customer@example.com',
    shipping_address: {
      first_name: 'Joseph', last_name: 'Rowland', address1: '1 Main St', address2: 'Apt 2',
      city: 'Setauket', province_code: 'NY', zip: '11733', country_code: 'US', phone: '555-0100',
    },
  });
  assert.deepEqual(shipping, {
    name: 'Joseph Rowland', addr1: '1 Main St', addr2: 'Apt 2', city: 'Setauket', state: 'NY', zip: '11733',
    country: 'US', email: 'customer@example.com', phone: '555-0100',
  });
});

test('uses fulfillable quantity and builds one WHCC submission line per configured item', () => {
  const lines = orderLines({ line_items: [
    { id: 1, variant_id: 2, title: 'Mountain Light', variant_title: 'Metal / 12x18', quantity: 3, fulfillable_quantity: 2 },
    { id: 3, variant_id: null, quantity: 1 },
  ] });
  assert.equal(lines.length, 1);
  assert.equal(lines[0].quantity, 2);
  const body = submissionBody({
    orderName: '#1001',
    configuredItems: [{ configuredProductId: 'CF_123', quantity: 2 }],
    shipping: { name: 'Joseph Rowland', addr1: '1 Main St', city: 'Setauket', state: 'NY', zip: '11733', country: 'US' },
  });
  assert.equal(body.reference, '1001');
  assert.deepEqual(body.items, [{ configuredProductId: 'CF_123', quantity: 2 }]);
  assert.equal(body.shipping.priority, 'dropship_lowest_cost');
});

test('ignores non-fulfillable quantities and preserves distinct line items', () => {
  const lines = orderLines({ line_items: [
    { id: 1, variant_id: 11, quantity: 1, fulfillable_quantity: 0 },
    { id: 2, variant_id: 12, quantity: 2, fulfillable_quantity: 2 },
    { id: 3, variant_id: 13, quantity: 1 },
  ] });
  assert.deepEqual(lines.map((line) => [line.lineItemId, line.quantity]), [['2', 2], ['3', 1]]);
});
