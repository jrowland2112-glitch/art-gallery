export function parseWhccMapping(value) {
  if (!value) return null;
  let mapping;
  try {
    mapping = typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    throw new Error('A product variant has invalid rowland.whcc_mapping JSON.');
  }
  if (!mapping?.productRef || !mapping?.selections || typeof mapping.selections !== 'object' || Array.isArray(mapping.selections)) {
    throw new Error('A print variant is missing its WHCC product reference or selections.');
  }
  return mapping;
}

export function whccShipping(order) {
  const address = order.shipping_address;
  if (!address) throw new Error('The paid Shopify order has no shipping address.');
  const name = [address.first_name, address.last_name].filter(Boolean).join(' ').trim() || address.name;
  const country = address.country_code || address.country_code_v2;
  const shipping = {
    name,
    addr1: address.address1,
    city: address.city,
    country,
  };
  if (address.address2) shipping.addr2 = address.address2;
  if (address.province_code) shipping.state = address.province_code;
  if (address.zip) shipping.zip = address.zip;
  if (order.email) shipping.email = order.email;
  if (address.phone || order.phone) shipping.phone = address.phone || order.phone;
  for (const field of ['name', 'addr1', 'city', 'country']) {
    if (!shipping[field]) throw new Error(`The shipping address is missing ${field}.`);
  }
  if (country === 'US' && (!shipping.state || !shipping.zip)) {
    throw new Error('A US shipping address requires a state and ZIP code.');
  }
  return shipping;
}

export function orderLines(order) {
  return (order.line_items || [])
    .filter((line) => line.variant_id && Number(line.fulfillable_quantity ?? line.quantity) > 0)
    .map((line) => ({
      lineItemId: String(line.id),
      variantId: String(line.variant_id),
      title: line.title,
      variantTitle: line.variant_title,
      quantity: Number(line.fulfillable_quantity ?? line.quantity),
    }));
}

export function submissionBody({ orderName, configuredItems, shipping }) {
  return {
    reference: String(orderName || '').replace(/^#/, '').slice(0, 32),
    items: configuredItems.map((item) => ({
      configuredProductId: item.configuredProductId,
      quantity: item.quantity,
    })),
    shipping: {
      type: 'dropship',
      priority: 'dropship_lowest_cost',
      address: shipping,
    },
  };
}
