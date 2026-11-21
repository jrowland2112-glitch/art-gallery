import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

import { optimizeThemeImages } from '../scripts/optimize-theme-images.mjs';

test('theme image optimization is bounded and idempotent', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rowland-theme-images-'));
  await mkdir(path.join(root, 'assets'));
  await sharp({ create: { width: 3000, height: 1600, channels: 3, background: '#687b86' } })
    .jpeg({ quality: 100 }).toFile(path.join(root, 'assets', 'about-joseph-photographer.jpg'));
  await sharp({ create: { width: 3000, height: 2200, channels: 3, background: '#777777' } })
    .jpeg({ quality: 100 }).toFile(path.join(root, 'assets', 'gallery-front-black-and-white.jpg'));
  await sharp({ create: { width: 1600, height: 500, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .png().toFile(path.join(root, 'assets', 'about-joseph-signature.png'));

  const first = await optimizeThemeImages({ root, output: { log() {} } });
  for (const result of first) {
    assert.equal(result.skipped, false);
    assert.ok(result.after < result.before);
    assert.equal((await stat(path.join(root, result.file))).size, result.after);
  }
  assert.equal((await sharp(path.join(root, 'assets', 'about-joseph-photographer.jpg')).metadata()).width, 2400);
  assert.equal((await sharp(path.join(root, 'assets', 'gallery-front-black-and-white.jpg')).metadata()).width, 2000);
  assert.equal((await sharp(path.join(root, 'assets', 'about-joseph-signature.png')).metadata()).width, 800);
  const second = await optimizeThemeImages({ root, output: { log() {} } });
  assert.ok(second.every((result) => result.skipped));
});
