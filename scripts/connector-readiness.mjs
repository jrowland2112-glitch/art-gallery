#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { readPriceSheet } from './lib/catalog.mjs';
import { createShopifyClient } from './lib/shopify.mjs';

function mappingKey(mapping) {
  return `${String(mapping.finish || '').trim().toLowerCase()}|${String(mapping.size || '').replace(/\s*[x×]\s*/i, 'x').trim().toLowerCase()}`;
}

function parsedMapping(variant) {
  try {
    const mapping = JSON.parse(variant.whccMapping?.value || 'null');
    if (!mapping?.productRef || !mapping?.selections || !mapping.finish || !mapping.size) return null;
    return mapping;
  } catch {
    return null;
  }
}

export async function auditConnectorReadiness({ client, catalogVariants, output = console } = {}) {
  const shopify = client || await createShopifyClient({});
  const expected = catalogVariants || await readPriceSheet(path.resolve('bulk-upload', 'prices.standard.csv'));
  const expectedKeys = new Set(expected.map(mappingKey));
  const data = await shopify.graphql(`
    query ActiveProductsForConnectorAudit {
      products(first: 250, query: "status:active", sortKey: TITLE) {
        nodes {
          id title handle status
          source: metafield(namespace: "rowland", key: "source_object_key") { value }
          variants(first: 250) {
            nodes {
              id title
              whccMapping: metafield(namespace: "rowland", key: "whcc_mapping") { value }
            }
          }
        }
      }
    }
  `);
  const products = data.products?.nodes || [];
  const failures = [];
  let variants = 0;

  for (const product of products) {
    const issues = [];
    if (!product.source?.value) issues.push('missing private R2 source key');
    const productVariants = product.variants?.nodes || [];
    variants += productVariants.length;
    if (productVariants.length !== expectedKeys.size) issues.push(`has ${productVariants.length} variants; expected ${expectedKeys.size}`);
    const found = new Set();
    for (const variant of productVariants) {
      const mapping = parsedMapping(variant);
      if (!mapping) {
        issues.push(`${variant.title}: missing or invalid WHCC mapping`);
        continue;
      }
      const key = mappingKey(mapping);
      if (!expectedKeys.has(key)) issues.push(`${variant.title}: unexpected ${mapping.finish} ${mapping.size} mapping`);
      if (found.has(key)) issues.push(`${variant.title}: duplicate ${mapping.finish} ${mapping.size} mapping`);
      found.add(key);
    }
    for (const key of expectedKeys) if (!found.has(key)) issues.push(`missing mapping ${key.replace('|', ' / ')}`);
    if (issues.length) failures.push({ handle: product.handle, title: product.title, issues });
  }

  output.log(`Active products checked: ${products.length}`);
  output.log(`Variants checked: ${variants}`);
  if (failures.length) {
    for (const failure of failures) {
      output.error(`${failure.title} (${failure.handle})`);
      for (const issue of failure.issues) output.error(`  - ${issue}`);
    }
    throw new Error(`${failures.length} active product(s) are not ready for the custom WHCC connector.`);
  }
  output.log('All active products have a private source key and the complete approved nine-variant WHCC mapping.');
  return { products: products.length, variants, failures };
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  auditConnectorReadiness().catch((error) => {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  });
}
