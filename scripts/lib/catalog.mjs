import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'csv-parse/sync';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.tif', '.tiff']);

export function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

export function titleFromFilename(filename) {
  const stem = path.basename(filename, path.extname(filename));
  return stem
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export async function sha256File(filename) {
  const contents = await readFile(filename);
  return createHash('sha256').update(contents).digest('hex');
}

export async function findImages({ folder, images = [] }) {
  const results = [...images];
  if (folder) {
    const entries = await readdir(folder, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        results.push(path.join(folder, entry.name));
      }
    }
  }

  const unique = [...new Set(results.map((filename) => path.resolve(filename)))].sort();
  if (unique.length === 0) {
    throw new Error('No supported images found. Use --image <file> or --folder <folder>.');
  }
  return unique;
}

export async function readCsv(filename) {
  const text = await readFile(filename, 'utf8');
  return parse(text, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

function enabled(value) {
  return !['false', 'no', '0', 'off'].includes(String(value ?? 'true').trim().toLowerCase());
}

export async function readPriceSheet(filename) {
  const rows = await readCsv(filename);
  const base = path.dirname(path.resolve(filename));
  const variants = [];

  for (const [index, row] of rows.entries()) {
    if (!enabled(row.enabled)) continue;
    const finish = row.finish?.trim();
    const size = row.size?.trim().replace(/\s*[×x]\s*/i, 'x');
    const price = Number(row.retail_price);
    if (!finish || !size || !Number.isFinite(price) || price <= 0) {
      throw new Error(`Invalid finish, size, or retail_price on price-sheet row ${index + 2}.`);
    }

    let selections = null;
    if (row.whcc_selections_file) {
      const selectionPath = path.resolve(base, row.whcc_selections_file);
      selections = JSON.parse(await readFile(selectionPath, 'utf8'));
    } else if (row.whcc_selections) {
      selections = JSON.parse(row.whcc_selections);
    }
    if (selections !== null && (Array.isArray(selections) || typeof selections !== 'object')) {
      throw new Error(`WHCC selections must be a JSON object on price-sheet row ${index + 2}.`);
    }

    variants.push({
      finish,
      size,
      price: price.toFixed(2),
      whccProductRef: row.whcc_product_ref?.trim() || null,
      whccSelections: selections,
    });
  }

  validateVariants(variants);
  return variants;
}

export function parseCombinedVariantTitle(value) {
  const title = String(value).trim();
  const sizeMatch = title.match(/\b(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\b/i);
  if (!sizeMatch) throw new Error(`Cannot find a size in source variant “${title}”.`);
  const size = `${sizeMatch[1]}x${sizeMatch[2]}`;
  const lower = title.toLowerCase();
  let finish;
  if (lower.includes('gallery wrap') || lower.includes('canvas')) finish = 'Gallery Wrap';
  else if (lower.includes('metal')) finish = 'Metal';
  else if (lower.includes('frame')) finish = 'Framed';
  else throw new Error(`Cannot find a supported finish in source variant “${title}”.`);
  return { finish, size };
}

export function variantsFromShopifyProduct(product) {
  if (!product?.variants?.nodes?.length) throw new Error('The source Shopify product has no variants.');
  const variants = product.variants.nodes.map((variant) => {
    const selected = Object.fromEntries(
      (variant.selectedOptions || []).map((option) => [option.name.toLowerCase(), option.value]),
    );
    let finish = selected.finish;
    let size = selected.size;
    if (!finish || !size) {
      const parsed = parseCombinedVariantTitle(selected.title || variant.title);
      finish = parsed.finish;
      size = parsed.size;
    }
    return { finish, size, price: Number(variant.price).toFixed(2), whccProductRef: null, whccSelections: null };
  });
  validateVariants(variants);
  return variants;
}

export function validateVariants(variants) {
  if (!variants.length) throw new Error('The price source has no enabled variants.');
  const seen = new Set();
  for (const variant of variants) {
    const key = `${variant.finish}\u0000${variant.size}`.toLowerCase();
    if (seen.has(key)) throw new Error(`Duplicate finish/size combination: ${variant.finish} / ${variant.size}.`);
    seen.add(key);
  }
}

export async function readPhotoOverrides(filename) {
  if (!filename) return new Map();
  const rows = await readCsv(filename);
  const overrides = new Map();
  for (const row of rows) {
    if (!row.filename) throw new Error('Every photos.csv row needs a filename.');
    overrides.set(path.basename(row.filename).toLowerCase(), row);
  }
  return overrides;
}

export function buildProductRecord(filename, variants, overrides, explicitTitle) {
  const override = overrides.get(path.basename(filename).toLowerCase()) || {};
  const title = explicitTitle || override.title?.trim() || titleFromFilename(filename);
  const handle = slugify(title);
  if (!handle) throw new Error(`Could not make a Shopify handle from ${path.basename(filename)}.`);
  return {
    filename,
    title,
    handle,
    altText: override.alt_text?.trim() || title,
    tags: (override.tags || 'Photography,Print').split(',').map((tag) => tag.trim()).filter(Boolean),
    descriptionHtml: override.description?.trim() || '',
    variants,
  };
}
