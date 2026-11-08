#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  buildProductRecord,
  findImages,
  readPhotoOverrides,
  readPriceSheet,
  variantsFromShopifyProduct,
} from './lib/catalog.mjs';
import { PREFERRED_PRINT_PPI, prepareProductImages } from './lib/images.mjs';
import { createShopifyClient, getProductByHandle, stageProductImage, upsertDraftProduct } from './lib/shopify.mjs';
import { storePrintFile } from './lib/storage.mjs';

function usage() {
  return `
Rowland Photography Draft product creator

Dry run with a price sheet:
  npm run photos:check -- --folder <folder> --prices <prices.csv> [--photos <photos.csv>]

Create/update Drafts:
  npm run photos:upload -- --folder <folder> --prices <prices.csv> [--photos <photos.csv>]

Copy current variants/prices from an existing Shopify product:
  npm run photos:upload -- --image <photo> --title <title> --copy-from <product-handle>

Options:
  --image <file>          Add one image (repeatable)
  --folder <folder>       Add all supported images in the folder
  --title <title>         Override title; valid only with one image
  --prices <csv>          Reusable Finish/Size/price sheet
  --photos <csv>          Optional per-photo title, alt text, tags, description
  --copy-from <handle>    Read Finish/Size/prices from a Shopify product
  --store <domain>        myshopify.com domain (or set SHOPIFY_STORE)
  --allow-local-original  Permit Draft creation before private object storage is configured
  --apply                 Write Draft products (automatically added by photos:upload)
  --help                  Show this help
`;
}

export function parseArgs(argv) {
  const args = { images: [], apply: false, allowLocalOriginal: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--apply') args.apply = true;
    else if (token === '--allow-local-original') args.allowLocalOriginal = true;
    else if (token === '--help' || token === '-h') args.help = true;
    else {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error(`${token} requires a value.`);
      if (token === '--image') args.images.push(value);
      else if (token === '--folder') args.folder = value;
      else if (token === '--title') args.title = value;
      else if (token === '--prices') args.prices = value;
      else if (token === '--photos') args.photos = value;
      else if (token === '--copy-from') args.copyFrom = value;
      else if (token === '--store') args.store = value;
      else throw new Error(`Unknown option: ${token}`);
    }
  }
  if (args.help) return args;
  if (!args.folder && args.images.length === 0) throw new Error('Use --image or --folder.');
  if (Boolean(args.prices) === Boolean(args.copyFrom)) throw new Error('Use exactly one of --prices or --copy-from.');
  if (args.title && (args.folder || args.images.length !== 1)) throw new Error('--title can only be used with one --image.');
  return args;
}

function printPlan(record, image, variants, mode) {
  console.log(`\n${record.title}`);
  console.log(`  Handle: ${record.handle}`);
  console.log(`  Original: ${record.filename}`);
  console.log(`  Source: ${image.source.width}x${image.source.height} ${image.source.format || ''}`);
  console.log(`  WHCC print file: ${image.print.width}x${image.print.height}, ${(image.print.size / 1024 / 1024).toFixed(2)} MB, sRGB JPEG quality ${image.print.quality}`);
  console.log(`  Largest-size resolution: ${Math.floor(image.print.resolution.lowestPpi)} PPI at ${image.print.resolution.lowestSize} (${PREFERRED_PRINT_PPI} PPI preferred)`);
  console.log(`  Storefront copy: ${image.display.width}x${image.display.height}, ${(image.display.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Variants: ${variants.length}`);
  for (const variant of variants) console.log(`    ${variant.finish} / ${variant.size}: $${variant.price}`);
  console.log(`  Action: ${mode}`);
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(usage());
    return;
  }

  const filenames = await findImages({ folder: args.folder, images: args.images });
  const overrides = await readPhotoOverrides(args.photos);
  let client;
  let variants;
  if (args.copyFrom) {
    client = await createShopifyClient({ store: args.store });
    const source = await getProductByHandle(client, args.copyFrom);
    if (!source) throw new Error(`Source Shopify product not found: ${args.copyFrom}`);
    variants = variantsFromShopifyProduct(source);
    console.log(`Using ${variants.length} prices from Shopify product “${source.title}”.`);
  } else {
    variants = await readPriceSheet(args.prices);
  }

  const cacheDir = path.resolve('.bulk-upload', 'cache');
  const prepared = [];
  for (const filename of filenames) {
    const record = buildProductRecord(filename, variants, overrides, args.title);
    const image = await prepareProductImages(record, cacheDir, variants);
    prepared.push({ record, image });
    printPlan(record, image, variants, args.apply ? 'Create or update Draft' : 'DRY RUN — no Shopify or storage writes');
  }

  if (!args.apply) {
    console.log('\nDry run complete. Nothing was uploaded or changed.');
    return;
  }

  client ||= await createShopifyClient({ store: args.store });
  const results = [];
  for (const item of prepared) {
    const existing = await getProductByHandle(client, item.record.handle);
    if (existing?.status && existing.status !== 'DRAFT') {
      throw new Error(`Refusing to modify existing ${existing.status} product “${existing.title}”.`);
    }

    const printFile = await storePrintFile(item.image.print.output, item.image.checksum);
    if (!printFile && !args.allowLocalOriginal) {
      throw new Error('Private print-file storage is not configured. Configure ORIGINALS_S3_* locally or explicitly use --allow-local-original for a Draft that cannot yet be fulfilled automatically.');
    }
    if (!printFile) console.warn(`WARNING: ${item.record.title} print file remains local; this Draft is not ready for automated fulfillment.`);

    const sameImage = existing?.metafield?.value === item.image.checksum && existing.media.nodes.length > 0;
    if (!sameImage) item.image.resourceUrl = await stageProductImage(client, item.image.output);
    const product = await upsertDraftProduct(client, item.record, item.image, printFile, existing);
    results.push(product);
    console.log(`Created/updated Draft: ${product.title} (${product.handle})`);
  }

  console.log(`\nComplete: ${results.length} Draft product(s). No product was activated or published.`);
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  });
}
