import { mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { sha256File, slugify } from './catalog.mjs';

export const PRINT_MAX_BYTES = 39 * 1024 * 1024;
export const MINIMUM_PRINT_PPI = 150;
export const PREFERRED_PRINT_PPI = 300;

function orientedDimensions(width, height) {
  return { long: Math.max(width, height), short: Math.min(width, height) };
}

function printPpi(width, height, size) {
  const match = String(size).match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/i);
  if (!match) throw new Error(`Cannot calculate print resolution for size ${size}.`);
  const pixels = orientedDimensions(width, height);
  const inches = orientedDimensions(Number(match[1]), Number(match[2]));
  return Math.min(pixels.long / inches.long, pixels.short / inches.short);
}

export function assessPrintResolution({ width, height }, variants, minimumPpi = MINIMUM_PRINT_PPI) {
  const sizes = [...new Set(variants.map(({ size }) => size))];
  const results = sizes.map((size) => ({ size, ppi: printPpi(width, height, size) }));
  const lowest = results.reduce((current, item) => (item.ppi < current.ppi ? item : current));
  if (lowest.ppi < minimumPpi) {
    throw new Error(
      `Prepared print file is only ${Math.floor(lowest.ppi)} PPI at ${lowest.size}; `
      + `the project minimum is ${minimumPpi} PPI. Use a higher-resolution photograph or remove that size.`,
    );
  }
  return { sizes: results, lowestPpi: lowest.ppi, lowestSize: lowest.size };
}

async function encodePrintCandidate(filename, output, quality, dimensions) {
  let pipeline = sharp(filename, { failOn: 'warning' })
    .rotate()
    .toColourspace('srgb');
  if (dimensions) {
    pipeline = pipeline.resize({ ...dimensions, fit: 'inside', withoutEnlargement: true });
  }
  return pipeline
    .withIccProfile('srgb')
    .jpeg({ quality, progressive: true, chromaSubsampling: '4:4:4', mozjpeg: true })
    .toFile(output);
}

export async function preparePrintImage(record, cacheDir, options = {}) {
  const checksum = options.checksum || await sha256File(record.filename);
  const maximumBytes = options.maximumBytes || PRINT_MAX_BYTES;
  const printDir = path.join(cacheDir, 'print');
  await mkdir(printDir, { recursive: true });
  const output = path.join(printDir, `${slugify(record.title)}-${checksum.slice(0, 12)}-print.jpg`);
  const qualities = options.qualities || [95, 92, 90, 88, 85, 82];
  let lastResult;

  for (const quality of qualities) {
    const candidate = `${output}.${quality}.tmp.jpg`;
    const result = await encodePrintCandidate(record.filename, candidate, quality);
    if (result.size <= maximumBytes) {
      await rm(output, { force: true });
      await rename(candidate, output);
      const metadata = await sharp(output).metadata();
      return { output, width: result.width, height: result.height, size: result.size, quality, metadata };
    }
    await rm(candidate, { force: true });
    lastResult = result;
  }

  let width = lastResult.width;
  let height = lastResult.height;
  const quality = qualities.at(-1);
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const scale = Math.min(0.97, Math.sqrt(maximumBytes / lastResult.size) * 0.96);
    width = Math.max(1, Math.floor(width * scale));
    height = Math.max(1, Math.floor(height * scale));
    const candidate = `${output}.resize-${attempt}.tmp.jpg`;
    const result = await encodePrintCandidate(record.filename, candidate, quality, { width, height });
    if (result.size <= maximumBytes) {
      await rm(output, { force: true });
      await rename(candidate, output);
      const metadata = await sharp(output).metadata();
      return { output, width: result.width, height: result.height, size: result.size, quality, metadata };
    }
    await rm(candidate, { force: true });
    lastResult = result;
  }
  throw new Error(`Could not prepare ${path.basename(record.filename)} below the WHCC file-size limit.`);
}

export async function prepareProductImages(record, cacheDir, variants, options = {}) {
  const checksum = await sha256File(record.filename);
  const image = sharp(record.filename, { failOn: 'warning' });
  const source = await image.metadata();
  if (!source.width || !source.height) throw new Error(`Cannot read image dimensions: ${record.filename}`);
  if (source.width < 1800 || source.height < 1800) {
    throw new Error(`${path.basename(record.filename)} is too small (${source.width}x${source.height}); both dimensions must be at least 1800 px.`);
  }

  await mkdir(cacheDir, { recursive: true });
  const displayDir = path.join(cacheDir, 'display');
  await mkdir(displayDir, { recursive: true });
  const output = path.join(displayDir, `${slugify(record.title)}-${checksum.slice(0, 12)}.jpg`);
  const result = await sharp(record.filename)
    .rotate()
    .toColourspace('srgb')
    .resize({ width: 3000, height: 3000, fit: 'inside', withoutEnlargement: true })
    .withIccProfile('srgb')
    .jpeg({ quality: 88, progressive: true, mozjpeg: true })
    .toFile(output);

  const print = await preparePrintImage(record, cacheDir, { ...options, checksum });
  if (print.metadata.space !== 'srgb' || !print.metadata.hasProfile) {
    throw new Error(`Prepared print file for ${path.basename(record.filename)} is missing its embedded sRGB profile.`);
  }
  print.resolution = assessPrintResolution(print, variants, options.minimumPpi);

  return {
    checksum,
    output,
    source: { width: source.width, height: source.height, format: source.format, space: source.space },
    display: { width: result.width, height: result.height, size: result.size },
    print,
  };
}
