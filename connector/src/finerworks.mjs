const FINERWORKS_ORIGIN = 'https://v2.api.finerworks.com';

function apiMessage(payload, status) {
  return payload?.status?.message
    || payload?.message
    || `FinerWorks request failed (${status})`;
}

export function createFinerworksClient({ webApiKey, appKey, fetchImpl = fetch } = {}) {
  if (!webApiKey) throw new Error('FINERWORKS_WEB_API_KEY is not configured.');
  if (!appKey) throw new Error('FINERWORKS_APP_KEY is not configured.');

  async function request(path, { method = 'POST', body } = {}) {
    const url = new URL(path, FINERWORKS_ORIGIN);
    if (url.origin !== FINERWORKS_ORIGIN || !url.pathname.startsWith('/v3/')) {
      throw new Error('Safety stop: FinerWorks requests may only use the pinned v2 API origin.');
    }
    const response = await fetchImpl(url, {
      method,
      headers: {
        'content-type': 'application/json',
        web_api_key: webApiKey,
        app_key: appKey,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.status?.success === false) {
      throw new Error(`${path}: ${apiMessage(payload, response.status)}`);
    }
    return payload;
  }

  function testOrders(orders) {
    if (!Array.isArray(orders) || orders.length === 0) throw new Error('At least one FinerWorks order is required.');
    return orders.map((order) => ({ ...order, test_mode: true }));
  }

  return Object.freeze({
    testCredentials: () => request('/v3/test_my_credentials', { method: 'GET' }),
    frameCollections: ({ id, productCode } = {}) => request('/v3/list_collections', {
      body: {
        ...(id === undefined ? {} : { id }),
        ...(productCode ? { product_code: productCode } : {}),
      },
    }),
    mats: () => request('/v3/list_mats', { body: {} }),
    glazing: () => request('/v3/list_glazing', { body: {} }),
    productTypes: () => request('/v3/list_product_types', { body: {} }),
    mediaTypes: (ids = []) => request('/v3/list_media_types', { body: { ids, site_id: 2 } }),
    styleTypes: (ids = []) => request('/v3/list_style_types', { body: { ids } }),
    printables: () => request('/v3/list_printables', { body: {} }),
    buildProductCode: (build) => request('/v3/build_product_code', { body: { build } }),
    prices: (productCodes) => request('/v3/get_prices', {
      body: { products: productCodes.map((product_sku) => ({ product_qty: 1, product_sku })) },
    }),
    shippingOptions: (orders) => request('/v3/list_shipping_options_multiple', {
      body: { orders: testOrders(orders) },
    }),
    validateTestOrders: (orders) => request('/v3/submit_orders_v2', {
      body: { orders: testOrders(orders), validate_only: true, payment_token: 'xxxx' },
    }),
    submitTestOrders: (orders) => request('/v3/submit_orders_v2', {
      body: { orders: testOrders(orders), validate_only: false, payment_token: 'xxxx' },
    }),
    orderStatus: ({ orderIds = [], orderPos = [] } = {}) => request('/v3/fetch_order_status', {
      body: { order_ids: orderIds, order_pos: orderPos },
    }),
    updateTestOrder: (orderId, updateCommand) => {
      if (!['hold', 'cancel'].includes(updateCommand)) throw new Error('FinerWorks test orders may only be held or cancelled.');
      return request('/v3/update_order', {
        method: 'PUT',
        body: { order_id: Number(orderId), update_command: updateCommand },
      });
    },
  });
}

export { FINERWORKS_ORIGIN };
