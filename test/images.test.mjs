import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';

import {
  PRINT_MAX_BYTES,
  assessPrintResolution,
  preparePrintImage,
  prepareProductImages,
} from '../scripts/lib/images.mjs';

const hash = (buffer) => createHash('sha256').update(buffer).digest('hex');

test('prepares separate sRGB print and storefront JPEGs without changing the source', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'rowland-images-'));
  try {
    for (const [name, width, height] of [['horizontal', 2700, 1800], ['vertical', 1800, 2700]]) {
      const source = path.join(temp, `${name}.png`);
      await sharp({ create: { width, height, channels: 3, background: '#6f8294' } }).png().toFile(source);
      const before = hash(await readFile(source));
      const prepared = await prepareProductImages(
        { filename: source, title: name },
        path.join(temp, 'cache'),
        [{ finish: 'Framed', size: '12x18' }],
      );
      assert.equal(hash(await readFile(source)), before);
      assert.equal(prepared.print.width, width);
      assert.equal(prepared.print.height, height);
      assert.ok(prepared.print.size <= PRINT_MAX_BYTES);
      assert.equal(prepared.print.metadata.space, 'srgb');
      assert.equal(prepared.print.metadata.hasProfile, true);
      assert.ok(prepared.print.output.includes(`${path.sep}print${path.sep}`));
      assert.ok(prepared.display.size < prepared.print.size);
      assert.ok(prepared.display.output === undefined);
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('rejects an image below the project minimum at the largest offered size', () => {
  assert.throws(
    () => assessPrintResolution({ width: 2400, height: 3600 }, [{ size: '24x36' }]),
    /only 100 PPI.*minimum is 150 PPI/,
  );
});

test('reports the lowest resolution across the offered sizes', () => {
  const result = assessPrintResolution(
    { width: 5400, height: 8100 },
    [{ size: '12x18' }, { size: '24x36' }],
  );
  assert.equal(result.lowestSize, '24x36');
  assert.equal(result.lowestPpi, 225);
});

test('reduces dimensions only when JPEG compression alone cannot meet the byte ceiling', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'rowland-print-limit-'));
  try {
    const source = path.join(temp, 'high-entropy.png');
    const width = 1200;
    const height = 800;
    await sharp(randomBytes(width * height * 3), { raw: { width, height, channels: 3 } }).png().toFile(source);
    const maximumBytes = 100 * 1024;
    const prepared = await preparePrintImage(
      { filename: source, title: 'High Entropy' },
      path.join(temp, 'cache'),
      { maximumBytes, qualities: [95, 82] },
    );
    assert.ok(prepared.size <= maximumBytes);
    assert.ok(prepared.width < width);
    assert.ok(prepared.height < height);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
