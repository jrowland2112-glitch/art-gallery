import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { parseCombinedVariantTitle, readPriceSheet } from './lib/catalog.mjs';
import { createShopifyClient } from './lib/shopify.mjs';

const METAFIELD_NAMESPACE = 'rowland';

function normalizedKey(finish, size) {
  return `${String(finish).trim()}\u0000${String(size).trim().replace(/\s*[x×]\s*/i, 'x')}`.toLowerCase();
}

function variantIdentity(variant) {
  const selected = Object.fromEntries(
    (variant.selectedOptions || []).map(({ name, value }) => [String(name).toLowerCase(), value]),
  );
  if (selected.finish && selected.size) {
    return { finish: selected.finish, size: selected.size.replace(/\s*[x×]\s*/i, 'x') };
  }
  return parseCombinedVariantTitle(selected.title || variant.title);
}

export function planWhccMappings({ product, catalogVariants, sourceObjectKey }) {
  if (!product?.id || !product?.variants?.nodes) throw new Error('Shopify returned an incomplete product record.');
  if (!/^originals\/[a-f0-9]{64}\/.+/i.test(sourceObjectKey)) {
    throw new Error(`Invalid private-original object key for ${product.handle}.`);
  }

  const catalog = new Map(catalogVariants.map((variant) => [normalizedKey(variant.finish, variant.size), variant]));
  const productVariants = product.variants.nodes;
  if (productVariants.length !== catalog.size) {
    throw new Error(`${product.title} has ${productVariants.length} variants; expected exactly ${catalog.size}.`);
  }

  const seen = new Set();
  const variantMetafields = productVariants.map((variant) => {
    const identity = variantIdentity(variant);
    const key = normalizedKey(identity.finish, identity.size);
    const configured = catalog.get(key);
    if (!configured) throw new Error(`${product.title} has an unmapped variant: ${variant.title}.`);
    if (seen.has(key)) throw new Error(`${product.title} has a duplicate variant: ${configured.finish} / ${configured.size}.`);
    if (!configured.whccProductRef || !configured.whccSelections) {
      throw new Error(`The price sheet is missing a validated WHCC mapping for ${configured.finish} / ${configured.size}.`);
    }
    seen.add(key);
    return {
      ownerId: variant.id,
      namespace: METAFIELD_NAMESPACE,
      key: 'whcc_mapping',
      type: 'json',
      value: JSON.stringify({
        productRef: configured.whccProductRef,
        selections: configured.whccSelections,
        finish: configured.finish,
        size: configured.size,
      }),
      label: `${configured.finish} / ${configured.size}`,
      previousValue: variant.whccMapping?.value ?? null,
    };
  });

  const missing = [...catalog.keys()].filter((key) => !seen.has(key));
  if (missing.length) throw new Error(`${product.title} is missing ${missing.length} configured variants.`);

  return {
    productMetafield: {
      ownerId: product.id,
      namespace: METAFIELD_NAMESPACE,
      key: 'source_object_key',
      type: 'single_line_text_field',
      value: sourceObjectKey,
      previousValue: product.sourceObjectKey?.value ?? null,
    },
    variantMetafields,
  };
}

function parseArguments(argv) {
  const products = [];
  let apply = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--apply') {
      apply = true;
      continue;
    }
    if (argument === '--product') {
      const specification = argv[index + 1];
      index += 1;
      const separator = specification?.indexOf('=') ?? -1;
      if (separator < 1) throw new Error('--product must be followed by handle=private-r2-object-key.');
      products.push({ handle: specification.slice(0, separator), sourceObjectKey: specification.slice(separator + 1) });
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  if (!products.length) throw new Error('Provide at least one --product handle=private-r2-object-key.');
  if (new Set(products.map(({ handle }) => handle)).size !== products.length) throw new Error('Each product handle may be supplied only once.');
  return { apply, products };
}

async function getProduct(client, handle) {
  const data = await client.graphql(`
    query ProductForWhccMapping($identifier: ProductIdentifierInput!) {
      product: productByIdentifier(identifier: $identifier) {
        id handle title status
        sourceObjectKey: metafield(namespace: "rowland", key: "source_object_key") { value }
        variants(first: 250) {
          nodes {
            id title selectedOptions { name value }
            whccMapping: metafield(namespace: "rowland", key: "whcc_mapping") { value }
          }
        }
      }
    }
  `, { identifier: { handle } });
  if (!data.product) throw new Error(`Shopify product not found: ${handle}.`);
  return data.product;
}

async function setMetafields(client, metafields) {
  const inputs = metafields.map(({ previousValue, label, ...input }) => input);
  const data = await client.graphql(`
    mutation SetWhccProductMappings($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { ownerType namespace key value }
        userErrors { field message code }
      }
    }
  `, { metafields: inputs });
  const errors = data.metafieldsSet.userErrors || [];
  if (errors.length) throw new Error(errors.map(({ field, message }) => `${(field || []).join('.')}: ${message}`).join('; '));
}

function backupRecord(product, plan) {
  return {
    product: { id: product.id, handle: product.handle, title: product.title, status: product.status },
    sourceObjectKey: plan.productMetafield.previousValue,
    variants: plan.variantMetafields.map((metafield) => ({
      id: metafield.ownerId,
      label: metafield.label,
      whccMapping: metafield.previousValue,
    })),
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const catalogVariants = await readPriceSheet(path.resolve('bulk-upload/prices.standard.csv'));
  const client = await createShopifyClient({});
  const planned = [];

  for (const specification of options.products) {
    const product = await getProduct(client, specification.handle);
    const plan = planWhccMappings({ product, catalogVariants, sourceObjectKey: specification.sourceObjectKey });
    planned.push({ product, plan });
    console.log(`${options.apply ? 'Ready to apply' : 'DRY RUN'}: ${product.title} (${product.status})`);
    console.log(`  Private original: ${specification.sourceObjectKey}`);
    console.log(`  Variant mappings: ${plan.variantMetafields.length}`);
  }

  if (!options.apply) {
    console.log('\nDry run complete. No Shopify data was changed. Add --apply to write only these metafields.');
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.resolve('.bulk-upload', `whcc-product-mapping-backup-${timestamp}.json`);
  await mkdir(path.dirname(backupPath), { recursive: true });
  await writeFile(backupPath, `${JSON.stringify({ createdAt: new Date().toISOString(), products: planned.map(({ product, plan }) => backupRecord(product, plan)) }, null, 2)}\n`);
  console.log(`Rollback snapshot saved locally: ${backupPath}`);

  for (const { product, plan } of planned) {
    await setMetafields(client, [plan.productMetafield, ...plan.variantMetafields]);
    const verified = await getProduct(client, product.handle);
    const verification = planWhccMappings({ product: verified, catalogVariants, sourceObjectKey: plan.productMetafield.value });
    if (verified.sourceObjectKey?.value !== plan.productMetafield.value) throw new Error(`Verification failed for ${product.title} original.`);
    for (const expected of verification.variantMetafields) {
      if (expected.previousValue !== expected.value) throw new Error(`Verification failed for ${product.title}: ${expected.label}.`);
    }
    console.log(`Applied and verified: ${product.title} (${plan.variantMetafields.length} variants).`);
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((error) => {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  });
}
