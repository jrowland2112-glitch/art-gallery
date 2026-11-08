import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { sha256File, slugify } from './catalog.mjs';

export async function prepareDisplayImage(record, cacheDir) {
  const checksum = await sha256File(record.filename);
  const image = sharp(record.filename, { failOn: 'warning' });
  const source = await image.metadata();
  if (!source.width || !source.height) throw new Error(`Cannot read image dimensions: ${record.filename}`);
  if (source.width < 1800 || source.height < 1800) {
    throw new Error(`${path.basename(record.filename)} is too small (${source.width}x${source.height}); both dimensions must be at least 1800 px.`);
  }

  await mkdir(cacheDir, { recursive: true });
  const output = path.join(cacheDir, `${slugify(record.title)}-${checksum.slice(0, 12)}.jpg`);
  const result = await sharp(record.filename)
    .rotate()
    .toColourspace('srgb')
    .resize({ width: 3000, height: 3000, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 88, progressive: true, mozjpeg: true })
    .toFile(output);

  return {
    checksum,
    output,
    source: { width: source.width, height: source.height, format: source.format, space: source.space },
    display: { width: result.width, height: result.height, size: result.size },
  };
}
