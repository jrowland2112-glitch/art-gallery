import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseCombinedVariantTitle } from './lib/catalog.mjs';
import { createShopifyClient } from './lib/shopify.mjs';

function normalizedKey(finish, size) {
  return `${String(finish).trim()}\u0000${String(size).trim().replace(/\s*[x×]\s*/i, 'x')}`.toLowerCase();
}

function identity(variant) {
  const options = Object.fromEntries((variant.selectedOptions || []).map(({ name, value }) => [String(name).toLowerCase(), value]));
  return options.finish && options.size
    ? { finish: options.finish, size: options.size.replace(/\s*[x×]\s*/i, 'x') }
    : parseCombinedVariantTitle(options.title || variant.title);
}

export function planFinerworksMappings(product, catalog) {
  if (!product?.id || !product?.variants?.nodes) throw new Error('Shopify returned an incomplete product record.');
  const approved = new Map();
  for (const [finish, settings] of Object.entries(catalog.finishes || {})) {
    for (const [size, productCode] of Object.entries(settings.variants || {})) {
      approved.set(normalizedKey(finish, size), { finish, size, productCode });
    }
  }
  if (approved.size !== 9) throw new Error('The FinerWorks catalog must contain exactly nine approved mappings.');
  if (product.variants.nodes.length !== approved.size) {
    throw new Error(`${product.title} has ${product.variants.nodes.length} variants; expected exactly ${approved.size}.`);
  }
  const seen = new Set();
  const metafields = product.variants.nodes.map((variant) => {
    const variantIdentity = identity(variant);
    const key = normalizedKey(variantIdentity.finish, variantIdentity.size);
    const mapping = approved.get(key);
    if (!mapping) throw new Error(`${product.title} has an unmapped FinerWorks variant: ${variant.title}.`);
    if (seen.has(key)) throw new Error(`${product.title} has a duplicate variant: ${mapping.finish} / ${mapping.size}.`);
    seen.add(key);
    return {
      ownerId: variant.id,
      namespace: 'rowland',
      key: 'finerworks_mapping',
      type: 'json',
      value: JSON.stringify(mapping),
      label: `${mapping.finish} / ${mapping.size}`,
      previousValue: variant.finerworksMapping?.value ?? null,
    };
  });
  return metafields;
}

function argumentsFrom(argv) {
  const handles = [];
  let apply = false;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--apply') apply = true;
    else if (argv[index] === '--handle' && argv[index + 1]) handles.push(argv[++index]);
    else throw new Error(`Unknown or incomplete argument: ${argv[index]}`);
  }
  if (!handles.length) throw new Error('Provide at least one --handle product-handle.');
  if (new Set(handles).size !== handles.length) throw new Error('Each handle may be supplied only once.');
  return { apply, handles };
}

async function getProduct(client, handle) {
  const data = await client.graphql(`
    query ProductForFinerworksMapping($identifier: ProductIdentifierInput!) {
      product: productByIdentifier(identifier: $identifier) {
        id handle title status
        variants(first: 250) {
          nodes {
            id title selectedOptions { name value }
            finerworksMapping: metafield(namespace: "rowland", key: "finerworks_mapping") { value }
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
    mutation SetFinerworksProductMappings($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { ownerType namespace key value }
        userErrors { field message code }
      }
    }
  `, { metafields: inputs });
  const errors = data.metafieldsSet.userErrors || [];
  if (errors.length) throw new Error(errors.map(({ field, message }) => `${(field || []).join('.')}: ${message}`).join('; '));
}

async function main() {
  const options = argumentsFrom(process.argv.slice(2));
  const catalog = JSON.parse(await readFile(path.resolve('bulk-upload/finerworks/mappings.json'), 'utf8'));
  if (catalog.status !== 'test-validated-not-active') throw new Error('FinerWorks catalog is not in its approved Test-validation state.');
  const client = await createShopifyClient({});
  const planned = [];
  for (const handle of options.handles) {
    const product = await getProduct(client, handle);
    const metafields = planFinerworksMappings(product, catalog);
    planned.push({ product, metafields });
    console.log(`${options.apply ? 'Ready to apply' : 'DRY RUN'}: ${product.title} (${product.status}) — ${metafields.length} mappings`);
  }
  if (!options.apply) {
    console.log('Dry run complete. No Shopify data was changed. Add --apply to write only the FinerWorks variant metafields.');
    return;
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.resolve('.bulk-upload', `finerworks-product-mapping-backup-${timestamp}.json`);
  await mkdir(path.dirname(backupPath), { recursive: true });
  await writeFile(backupPath, `${JSON.stringify({ createdAt: new Date().toISOString(), products: planned.map(({ product, metafields }) => ({
    product: { id: product.id, handle: product.handle, title: product.title, status: product.status },
    variants: metafields.map((field) => ({ id: field.ownerId, label: field.label, finerworksMapping: field.previousValue })),
  })) }, null, 2)}\n`);
  console.log(`Rollback snapshot saved locally: ${backupPath}`);
  for (const { product, metafields } of planned) {
    await setMetafields(client, metafields);
    const verified = planFinerworksMappings(await getProduct(client, product.handle), catalog);
    for (const field of verified) if (field.previousValue !== field.value) throw new Error(`Verification failed for ${product.title}: ${field.label}.`);
    console.log(`Applied and verified: ${product.title}.`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`ERROR: ${error.message}`); process.exitCode = 1; });
}
