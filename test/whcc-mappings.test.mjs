import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readPriceSheet } from '../scripts/lib/catalog.mjs';

test('standard WHCC price sheet contains the approved nine variants', async () => {
  const variants = await readPriceSheet(path.resolve('bulk-upload', 'prices.standard.csv'));
  assert.equal(variants.length, 9);
  assert.deepEqual([...new Set(variants.map((variant) => variant.finish))].sort(), ['Framed', 'Gallery Wrap', 'Metal']);
  assert.deepEqual([...new Set(variants.map((variant) => variant.size))].sort(), ['12x18', '16x24', '24x36']);
  for (const variant of variants) {
    assert.ok(variant.whccProductRef);
    assert.equal(variant.whccSelections.size, variant.size);
  }
});

test('approved finish details remain consistent across sizes', async () => {
  const variants = await readPriceSheet(path.resolve('bulk-upload', 'prices.standard.csv'));
  for (const variant of variants) {
    if (variant.finish === 'Framed') {
      assert.equal(variant.whccSelections.moulding, 'slim_black');
      assert.equal(variant.whccSelections.mat, '2_in');
      assert.equal(variant.whccSelections.mat_color, 'double_white');
    } else if (variant.finish === 'Metal') {
      assert.equal(variant.whccSelections.surface, 'white_high_gloss');
      assert.equal(variant.whccSelections.display_options, '3_4in_float_mount');
    } else {
      assert.equal(variant.whccSelections.canvas_type, 'premium_fine_art');
      assert.equal(variant.whccSelections.depth, '1_1_2in');
      assert.equal(variant.whccSelections.protection, 'semi_gloss');
      assert.equal(variant.whccSelections.gallery_wrap_edge, 'no_edge');
    }
  }
});
