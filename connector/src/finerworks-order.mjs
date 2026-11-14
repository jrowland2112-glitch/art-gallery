const APPROVED_MAPPINGS = new Map([
  ['5M7M8S12X18F96S15X21J1S12X18K1S13DD5X19DD5G1', ['Framed', '12x18']],
  ['5M7M8S16X24F96S19X27J1S16X24K1S17DD5X25DD5G1', ['Framed', '16x24']],
  ['5M7M8S24X36F96S27X39J1S24X36K1S25DD5X37DD5G1', ['Framed', '24x36']],
  ['14M130M68S12X18', ['Metal', '12x18']],
  ['14M130M68S16X24', ['Metal', '16x24']],
  ['14M130M68S24X36', ['Metal', '24x36']],
  ['1M46M29S12X18Q11', ['Gallery Wrap', '12x18']],
  ['1M46M29S16X24Q11', ['Gallery Wrap', '16x24']],
  ['1M46M29S24X36Q11', ['Gallery Wrap', '24x36']],
]);
const PRODUCT_CODES = new Set(APPROVED_MAPPINGS.keys());

export function parseFinerworksMapping(value) {
  if (!value) return null;
  let mapping;
  try {
    mapping = typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    throw new Error('A product variant has invalid rowland.finerworks_mapping JSON.');
  }
  const approved = APPROVED_MAPPINGS.get(mapping?.productCode);
  if (!approved || mapping.finish !== approved[0] || mapping.size !== approved[1]) {
    throw new Error('A print variant is missing an approved FinerWorks product code, finish, or size.');
  }
  return mapping;
}

export function parseSourceDimensions(value) {
  let dimensions;
  try {
    dimensions = typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    throw new Error('The product has invalid rowland.source_dimensions JSON.');
  }
  const width = Number(dimensions?.width);
  const height = Number(dimensions?.height);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error('The product is missing valid source image dimensions.');
  }
  const ratio = Math.max(width, height) / Math.min(width, height);
  if (Math.abs(ratio - 1.5) > 0.01) throw new Error('The source image must have a 3:2 aspect ratio for these FinerWorks variants.');
  return { width, height };
}

export function finerworksRecipient(order) {
  const address = order.shipping_address;
  if (!address) throw new Error('The paid Shopify order has no shipping address.');
  const recipient = {
    first_name: address.first_name || '',
    last_name: address.last_name || '',
    company_name: address.company || null,
    address_1: address.address1,
    address_2: address.address2 || null,
    address_3: null,
    city: address.city,
    state_code: address.province_code || null,
    province: address.province || null,
    zip_postal_code: address.zip,
    country_code: String(address.country_code || address.country_code_v2 || '').toLowerCase(),
    phone: address.phone || order.phone || null,
    email: order.email || null,
  };
  for (const field of ['first_name', 'last_name', 'address_1', 'city', 'zip_postal_code', 'country_code']) {
    if (!recipient[field]) throw new Error(`The shipping address is missing ${field}.`);
  }
  if (recipient.country_code === 'us' && !recipient.state_code) throw new Error('A US shipping address requires a state code.');
  return recipient;
}

export function finerworksOrder({ orderId, orderName, recipient, items, webhookUrl }) {
  const po = `shopify-${String(orderId)}`.slice(0, 50);
  return {
    order_po: po,
    recipient: { ...recipient, address_order_po: po },
    order_items: items.map((item) => ({
      product_order_po: `${po}-${item.lineItemId}`.slice(0, 50),
      product_qty: item.quantity,
      product_sku: item.productCode,
      product_image: {
        pixel_width: item.width,
        pixel_height: item.height,
        product_url_file: item.assetUrl,
        product_url_thumbnail: null,
      },
      product_title: String(item.title || orderName || 'Rowland Photography').slice(0, 50),
      custom_data_1: null,
      custom_data_2: `shopify-line-${item.lineItemId}`.slice(0, 255),
      custom_data_3: null,
    })),
    shipping_code: 'EC',
    site_id: 2,
    test_mode: true,
    webhook_order_status_url: webhookUrl,
    source: 'Rowland Shopify Test',
    custom_data_1: String(orderName || '').slice(0, 255),
  };
}

export { PRODUCT_CODES as FINERWORKS_APPROVED_PRODUCT_CODES };
