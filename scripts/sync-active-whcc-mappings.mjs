#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { parseCombinedVariantTitle, readPriceSheet } from './lib/catalog.mjs';
import { variantsForProduct } from './lib/product-variant-extensions.mjs';
import { createShopifyClient } from './lib/shopify.mjs';

function key(finish, size) {
  return `${String(finish).trim()}|${String(size).trim().replace(/\s*[x×]\s*/i, 'x')}`.toLowerCase();
}

function identity(variant) {
  const options = Object.fromEntries((variant.selectedOptions || []).map(({ name, value }) => [name.toLowerCase(), value]));
  if (!options.finish || !options.size) {
    const parsed = parseCombinedVariantTitle(options.title || variant.title);
    return key(parsed.finish, parsed.size);
  }
  return key(options.finish, options.size);
}

async function main() {
  const apply = process.argv.includes('--apply');
  const catalog = await readPriceSheet(path.resolve('bulk-upload/prices.standard.csv'));
  const client = await createShopifyClient({});
  const data = await client.graphql(`
    query ActiveProductsForWhccSync {
      products(first: 250, query: "status:active", sortKey: TITLE) {
        nodes {
          id title handle
          variants(first: 250) {
            nodes {
              id title selectedOptions { name value }
              mapping: metafield(namespace: "rowland", key: "whcc_mapping") { value }
            }
          }
        }
      }
    }
  `);
  const changes = [];
  for (const product of data.products?.nodes || []) {
    const approvedMappings = variantsForProduct(catalog, product.handle);
    const approved = new Map(approvedMappings.map((mapping) => [key(mapping.finish, mapping.size), mapping]));
    if (product.variants.nodes.length !== approved.size) throw new Error(`${product.title} does not have the approved ${approved.size} variants.`);
    for (const variant of product.variants.nodes) {
      const mapping = approved.get(identity(variant));
      if (!mapping) throw new Error(`${product.title}: no approved mapping for ${variant.title}.`);
      let current;
      try { current = JSON.parse(variant.mapping?.value || 'null'); } catch { current = null; }
      if (!current?.selections) throw new Error(`${product.title}: ${variant.title} has no current WHCC mapping to update safely.`);
      const value = JSON.stringify({
        productRef: mapping.whccProductRef,
        selections: mapping.whccSelections,
        finish: mapping.finish,
        size: mapping.size,
      });
      if (variant.mapping?.value !== value) changes.push({ product: product.title, variant: variant.title, ownerId: variant.id, previousValue: variant.mapping?.value || null, value });
    }
  }
  console.log(`${apply ? 'Applying' : 'DRY RUN'}: ${changes.length} active variant mapping change(s).`);
  if (!apply || !changes.length) return;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.resolve('.bulk-upload', `whcc-active-mapping-backup-${timestamp}.json`);
  await mkdir(path.dirname(backupPath), { recursive: true });
  await writeFile(backupPath, `${JSON.stringify({ createdAt: new Date().toISOString(), changes }, null, 2)}\n`);
  console.log(`Rollback snapshot saved locally: ${backupPath}`);
  for (let index = 0; index < changes.length; index += 25) {
    const batch = changes.slice(index, index + 25).map(({ ownerId, value }) => ({ ownerId, namespace: 'rowland', key: 'whcc_mapping', type: 'json', value }));
    const result = await client.graphql(`
      mutation SyncWhccMappings($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) { userErrors { field message code } }
      }
    `, { metafields: batch });
    const errors = result.metafieldsSet.userErrors || [];
    if (errors.length) throw new Error(errors.map(({ field, message }) => `${(field || []).join('.')}: ${message}`).join('; '));
  }
  console.log(`Applied ${changes.length} active variant mapping change(s).`);
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
});
