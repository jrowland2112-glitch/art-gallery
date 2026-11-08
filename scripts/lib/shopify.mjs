import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const SHOPIFY_API_VERSION = '2026-10';

function normalizeStore(value) {
  const store = String(value || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(store)) {
    throw new Error('SHOPIFY_STORE must look like example.myshopify.com.');
  }
  return store.toLowerCase();
}

export async function createShopifyClient({ store, env = process.env, fetchImpl = fetch }) {
  const shop = normalizeStore(store || env.SHOPIFY_STORE || 'rowland-photography-0v8ydig1.myshopify.com');
  let accessToken = env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  if (!accessToken) {
    const clientId = env.SHOPIFY_CLIENT_ID;
    const clientSecret = env.SHOPIFY_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error('Shopify credentials are not configured. Set them locally as environment variables; never paste them into chat or commit them.');
    }
    const response = await fetchImpl(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }),
    });
    if (!response.ok) throw new Error(`Shopify authentication failed (${response.status}).`);
    const token = await response.json();
    accessToken = token.access_token;
  }

  async function graphql(query, variables = {}) {
    const response = await fetchImpl(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-shopify-access-token': accessToken },
      body: JSON.stringify({ query, variables }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`Shopify API request failed (${response.status}).`);
    if (payload?.errors?.length) throw new Error(`Shopify GraphQL error: ${payload.errors.map((error) => error.message).join('; ')}`);
    return payload.data;
  }

  return { shop, graphql };
}

export async function getProductByHandle(client, handle) {
  const data = await client.graphql(`
    query ProductForBulkCreator($identifier: ProductIdentifierInput!) {
      product: productByIdentifier(identifier: $identifier) {
        id handle title status descriptionHtml vendor productType tags
        metafield(namespace: "rowland", key: "source_sha256") { value }
        media(first: 10) { nodes { id } }
        variants(first: 250) {
          nodes { id title price sku selectedOptions { name value } }
        }
      }
    }
  `, { identifier: { handle } });
  return data.product;
}

function assertNoUserErrors(result, operation) {
  const errors = result?.userErrors || [];
  if (errors.length) {
    throw new Error(`${operation}: ${errors.map((error) => `${(error.field || []).join('.')}: ${error.message}`).join('; ')}`);
  }
}

export async function stageProductImage(client, filename) {
  const data = await client.graphql(`
    mutation StageProductImage($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets { url resourceUrl parameters { name value } }
        userErrors { field message }
      }
    }
  `, { input: [{ filename: path.basename(filename), mimeType: 'image/jpeg', httpMethod: 'PUT', resource: 'PRODUCT_IMAGE' }] });
  assertNoUserErrors(data.stagedUploadsCreate, 'Could not stage image');
  const target = data.stagedUploadsCreate.stagedTargets?.[0];
  if (!target?.url || !target?.resourceUrl) throw new Error('Shopify did not return an image upload target.');
  const headers = Object.fromEntries(target.parameters.map(({ name, value }) => [name, value]));
  const response = await fetch(target.url, { method: 'PUT', headers, body: await readFile(filename) });
  if (!response.ok) throw new Error(`Shopify image upload failed (${response.status}).`);
  return target.resourceUrl;
}

export function productSetInput(record, image, original, includeFile = true) {
  const finishes = [...new Set(record.variants.map((variant) => variant.finish))];
  const sizes = [...new Set(record.variants.map((variant) => variant.size))];
  const input = {
    title: record.title,
    handle: record.handle,
    status: 'DRAFT',
    vendor: 'Rowland Photography',
    productType: 'Fine Art Print',
    descriptionHtml: record.descriptionHtml,
    tags: record.tags,
    productOptions: [
      { name: 'Finish', position: 1, values: finishes.map((name) => ({ name })) },
      { name: 'Size', position: 2, values: sizes.map((name) => ({ name })) },
    ],
    metafields: [
      { namespace: 'rowland', key: 'source_sha256', type: 'single_line_text_field', value: image.checksum },
      { namespace: 'rowland', key: 'source_filename', type: 'single_line_text_field', value: path.basename(record.filename) },
      { namespace: 'rowland', key: 'source_dimensions', type: 'json', value: JSON.stringify(image.source) },
    ],
    variants: record.variants.map((variant) => ({
      optionValues: [
        { optionName: 'Finish', name: variant.finish },
        { optionName: 'Size', name: variant.size },
      ],
      price: variant.price,
      sku: `RP-${record.handle}-${variant.finish}-${variant.size}`.toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 64),
      inventoryPolicy: 'CONTINUE',
      taxable: true,
      metafields: [{
        namespace: 'rowland',
        key: 'whcc_mapping',
        type: 'json',
        value: JSON.stringify({
          productRef: variant.whccProductRef,
          selections: variant.whccSelections,
          finish: variant.finish,
          size: variant.size,
        }),
      }],
    })),
  };
  if (original) {
    input.metafields.push({ namespace: 'rowland', key: 'source_object_key', type: 'single_line_text_field', value: original.key });
  }
  if (includeFile) {
    input.files = [{ originalSource: image.resourceUrl, alt: record.altText, contentType: 'IMAGE' }];
  }
  return input;
}

export async function upsertDraftProduct(client, record, image, original, existing) {
  if (existing && existing.status !== 'DRAFT') {
    throw new Error(`Refusing to modify ${existing.status} product “${existing.title}” (${existing.handle}).`);
  }
  const sameImage = existing?.metafield?.value === image.checksum && existing.media.nodes.length > 0;
  const input = productSetInput(record, image, original, !sameImage);
  const data = await client.graphql(`
    mutation UpsertDraftProduct($input: ProductSetInput!, $identifier: ProductSetIdentifiers) {
      productSet(input: $input, identifier: $identifier, synchronous: true) {
        product {
          id title handle status onlineStorePreviewUrl
          variants(first: 250) { nodes { id title price sku selectedOptions { name value } } }
        }
        userErrors { code field message }
      }
    }
  `, { input, identifier: { handle: record.handle } });
  assertNoUserErrors(data.productSet, `Could not create ${record.title}`);
  if (data.productSet.product?.status !== 'DRAFT') throw new Error('Safety check failed: Shopify did not return a Draft product.');
  return data.productSet.product;
}
