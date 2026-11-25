import test from 'node:test';
import assert from 'node:assert/strict';

import { GALLERY_WRAP_40X60, PRODUCT_VARIANT_EXTENSIONS, variantsForProduct } from '../scripts/lib/product-variant-extensions.mjs';

test('40x60 gallery wrap extension is limited to explicitly approved products', () => {
  assert.deepEqual(Object.keys(PRODUCT_VARIANT_EXTENSIONS).sort(), ['aspen-icm', 'the-geometry-of-light']);
  assert.equal(PRODUCT_VARIANT_EXTENSIONS['aspen-icm'][0], GALLERY_WRAP_40X60);
  assert.equal(PRODUCT_VARIANT_EXTENSIONS['the-geometry-of-light'][0], GALLERY_WRAP_40X60);
  assert.equal(variantsForProduct([], 'unapproved-product').length, 0);
});

test('40x60 extension preserves the approved WHCC configuration and price', () => {
  assert.equal(GALLERY_WRAP_40X60.price, '1500.00');
  assert.deepEqual(GALLERY_WRAP_40X60.whccSelections, {
    size: '40x60',
    canvas_type: 'premium_fine_art',
    depth: '2_1_2in',
    protection: 'semi_gloss',
    gallery_wrap_edge: 'black_edge',
    all_hanging_hardware: 'sawtooth_hangers_bumpers_paper_backing',
  });
});
