#!/usr/bin/env node
import { readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

import sharp from 'sharp';

// Avoid libvips retaining source handles on Windows while the optimized file
// replaces the original in the same process.
sharp.cache(false);

const targets = [
  { file: 'assets/about-joseph-photographer.jpg', width: 2400, format: 'jpeg' },
  { file: 'assets/gallery-front-black-and-white.jpg', width: 2000, format: 'jpeg' },
  { file: 'assets/about-joseph-signature.png', width: 800, format: 'png' },
];

export async function optimizeThemeImages({ root = process.cwd(), output = console } = {}) {
  const results = [];
  for (const target of targets) {
    const filename = path.resolve(root, target.file);
    const metadata = await sharp(filename).metadata();
    const before = (await stat(filename)).size;
    if (!metadata.width || metadata.width <= target.width) {
      results.push({ file: target.file, skipped: true, before, after: before });
      continue;
    }

    const temporary = `${filename}.optimized`;
    let pipeline = sharp(filename).rotate().resize({ width: target.width, withoutEnlargement: true });
    pipeline = target.format === 'png'
      ? pipeline.png({ compressionLevel: 9, effort: 10, quality: 100 })
      : pipeline.jpeg({ quality: 90, mozjpeg: true, chromaSubsampling: '4:4:4' });
    await pipeline.toFile(temporary);
    pipeline.destroy();
    await writeFile(filename, await readFile(temporary));
    await unlink(temporary);
    const after = (await stat(filename)).size;
    results.push({ file: target.file, skipped: false, before, after });
    output.log(`${target.file}: ${(before / 1024).toFixed(1)} KB -> ${(after / 1024).toFixed(1)} KB`);
  }
  return results;
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || '')) {
  optimizeThemeImages().catch((error) => {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  });
}
