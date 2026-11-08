import { SHOPIFY_API_VERSION } from './constants.mjs';

function normalizeStore(value) {
  const store = String(value || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(store)) throw new Error('SHOPIFY_STORE is invalid.');
  return store;
}

export function createShopifyAdminClient({ store, clientId, clientSecret, fetchImpl = fetch }) {
  const shop = normalizeStore(store);
  if (!clientId || !clientSecret) throw new Error('Shopify app credentials are not configured in the secret manager.');
  let accessToken;

  async function token() {
    if (accessToken) return accessToken;
    const response = await fetchImpl(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.access_token) throw new Error(`Shopify authentication failed (${response.status}).`);
    accessToken = payload.access_token;
    return accessToken;
  }

  async function graphql(query, variables = {}) {
    const response = await fetchImpl(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-shopify-access-token': await token() },
      body: JSON.stringify({ query, variables }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`Shopify API request failed (${response.status}).`);
    if (payload?.errors?.length) throw new Error(`Shopify GraphQL error: ${payload.errors.map((error) => error.message).join('; ')}`);
    return payload?.data;
  }

  async function variantFulfillmentData(variantId) {
    const data = await graphql(`
      query VariantFulfillmentData($id: ID!) {
        variant: node(id: $id) {
          ... on ProductVariant {
            id title
            mapping: metafield(namespace: "rowland", key: "whcc_mapping") { value }
            product {
              id title
              source: metafield(namespace: "rowland", key: "source_object_key") { value }
            }
          }
        }
      }
    `, { id: `gid://shopify/ProductVariant/${variantId}` });
    return data?.variant;
  }

  return { shop, graphql, variantFulfillmentData };
}
