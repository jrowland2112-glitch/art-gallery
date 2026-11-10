import test from 'node:test';
import assert from 'node:assert/strict';
import { createShopifyAdminClient } from '../connector/src/shopify.mjs';

test('creates a tracked Shopify fulfillment only for mapped WHCC line items', async () => {
  const requests = [];
  const fetchImpl = async (url, init) => {
    if (url.endsWith('/admin/oauth/access_token')) {
      return new Response(JSON.stringify({ access_token: 'not-a-real-token' }), { status: 200 });
    }
    const request = JSON.parse(init.body);
    requests.push(request);
    if (request.query.includes('FulfillmentOrdersForWhcc')) {
      return new Response(JSON.stringify({ data: { order: { fulfillmentOrders: { nodes: [{
        id: 'gid://shopify/FulfillmentOrder/1', status: 'OPEN', lineItems: { nodes: [
          { id: 'gid://shopify/FulfillmentOrderLineItem/10', remainingQuantity: 1, lineItem: { legacyResourceId: '500' } },
          { id: 'gid://shopify/FulfillmentOrderLineItem/11', remainingQuantity: 1, lineItem: { legacyResourceId: '999' } },
        ] },
      }] } } } }), { status: 200 });
    }
    return new Response(JSON.stringify({ data: { fulfillmentCreate: {
      fulfillment: { id: 'gid://shopify/Fulfillment/2', status: 'SUCCESS' }, userErrors: [],
    } } }), { status: 200 });
  };
  const client = createShopifyAdminClient({
    store: 'example.myshopify.com', clientId: 'client', clientSecret: 'secret', fetchImpl,
  });
  const fulfillment = await client.fulfillMappedLineItems('1001', [{ line_item_id: '500', quantity: 1 }], {
    company: 'FedEx', numbers: ['TRACK1'], urls: ['https://example.test/TRACK1'],
  });
  assert.equal(fulfillment.id, 'gid://shopify/Fulfillment/2');
  const input = requests[1].variables.fulfillment;
  assert.equal(input.notifyCustomer, true);
  assert.deepEqual(input.lineItemsByFulfillmentOrder, [{
    fulfillmentOrderId: 'gid://shopify/FulfillmentOrder/1',
    fulfillmentOrderLineItems: [{ id: 'gid://shopify/FulfillmentOrderLineItem/10', quantity: 1 }],
  }]);
  assert.deepEqual(input.trackingInfo.numbers, ['TRACK1']);
});

test('refuses to create a Shopify fulfillment when no WHCC line item remains', async () => {
  const fetchImpl = async (url, init) => {
    if (url.endsWith('/admin/oauth/access_token')) {
      return new Response(JSON.stringify({ access_token: 'not-a-real-token' }), { status: 200 });
    }
    return new Response(JSON.stringify({ data: { order: { fulfillmentOrders: { nodes: [] } } } }), { status: 200 });
  };
  const client = createShopifyAdminClient({
    store: 'example.myshopify.com', clientId: 'client', clientSecret: 'secret', fetchImpl,
  });
  await assert.rejects(
    () => client.fulfillMappedLineItems('1001', [{ line_item_id: '500', quantity: 1 }], { company: 'FedEx', numbers: ['1'] }),
    /No remaining Shopify fulfillment-order lines/,
  );
});
