import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProductRecord, parseCombinedVariantTitle, slugify, titleFromFilename, variantsFromShopifyProduct } from '../scripts/lib/catalog.mjs';
import { parseArgs } from '../scripts/bulk-products.mjs';
import { productSetInput } from '../scripts/lib/shopify.mjs';

test('derives titles and handles from filenames', () => {
  assert.equal(titleFromFilename('Mountain_Light.jpg'), 'Mountain Light');
  assert.equal(slugify('Mountain Light'), 'mountain-light');
});

test('parses existing combined WHCC-style variant titles', () => {
  assert.deepEqual(parseCombinedVariantTitle('Framed 12x18 Black'), { finish: 'Framed', size: '12x18' });
  assert.deepEqual(parseCombinedVariantTitle('Metal 24×36'), { finish: 'Metal', size: '24x36' });
  assert.deepEqual(parseCombinedVariantTitle('Gallery Wrap 16x24'), { finish: 'Gallery Wrap', size: '16x24' });
});

test('copies prices from a source product with a Title option', () => {
  const variants = variantsFromShopifyProduct({ variants: { nodes: [
    { title: 'Framed 12x18 Black', price: '225.00', selectedOptions: [{ name: 'Title', value: 'Framed 12x18 Black' }] },
    { title: 'Metal 12x18', price: '200.00', selectedOptions: [{ name: 'Title', value: 'Metal 12x18' }] },
  ] } });
  assert.deepEqual(variants.map(({ finish, size, price }) => ({ finish, size, price })), [
    { finish: 'Framed', size: '12x18', price: '225.00' },
    { finish: 'Metal', size: '12x18', price: '200.00' },
  ]);
});

test('builds a Draft product record without changing the source file', () => {
  const variants = [{ finish: 'Metal', size: '12x18', price: '200.00' }];
  const record = buildProductRecord('E:/SHots/Mountain Light.jpg', variants, new Map(), 'Mountain Light');
  assert.equal(record.title, 'Mountain Light');
  assert.equal(record.handle, 'mountain-light');
  assert.equal(record.filename, 'E:/SHots/Mountain Light.jpg');
});

test('requires exactly one price source', () => {
  assert.throws(() => parseArgs(['--image', 'photo.jpg']), /exactly one/);
  assert.throws(() => parseArgs(['--image', 'photo.jpg', '--prices', 'p.csv', '--copy-from', 'source']), /exactly one/);
  assert.equal(parseArgs(['--image', 'photo.jpg', '--prices', 'p.csv']).prices, 'p.csv');
});

test('Shopify input is always Draft with Finish and Size options', () => {
  const record = {
    filename: 'Mountain Light.jpg',
    title: 'Mountain Light',
    handle: 'mountain-light',
    altText: 'Mountain Light',
    tags: ['Photography', 'Print'],
    descriptionHtml: '',
    variants: [
      { finish: 'Framed', size: '12x18', price: '225.00', whccProductRef: null, whccSelections: null },
      { finish: 'Metal', size: '12x18', price: '200.00', whccProductRef: null, whccSelections: null },
    ],
  };
  const image = {
    checksum: 'abc123',
    source: { width: 5504, height: 8256, format: 'jpeg' },
    resourceUrl: 'https://shopify.example/staged.jpg',
  };
  const input = productSetInput(record, image, null, true);
  assert.equal(input.status, 'DRAFT');
  assert.deepEqual(input.productOptions.map((option) => option.name), ['Finish', 'Size']);
  assert.deepEqual(input.variants.map((variant) => variant.price), ['225.00', '200.00']);
  assert.equal(input.files[0].alt, 'Mountain Light');
});
