import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function text(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

function parseShopifyJson(source) {
  return JSON.parse(source.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ''));
}

test('required Shopify app embeds remain enabled in versioned settings', async () => {
  const settings = parseShopifyJson(await text('config/settings_data.json'));
  const enabledTypes = Object.values(settings.current.blocks || {})
    .filter((block) => block.disabled !== true)
    .map((block) => block.type);
  assert.ok(enabledTypes.some((type) => type.startsWith('shopify://apps/judge-me-reviews/')));
  assert.ok(enabledTypes.some((type) => type.startsWith('shopify://apps/forms/')));
});

test('theme tooling excludes notification templates from Shopify operations', async () => {
  const shopifyIgnore = await text('.shopifyignore');
  const themeCheck = await text('.theme-check.yml');
  assert.match(shopifyIgnore, /^email-templates$/m);
  assert.match(themeCheck, /email-templates\/\*\*/);
});

test('retired provider and invalid CSS variables cannot return unnoticed', async () => {
  const [theme, css, packageJson] = await Promise.all([
    text('assets/theme.js'),
    text('assets/base.css'),
    text('package.json'),
  ]);
  assert.doesNotMatch(theme, /finerworks/i);
  assert.doesNotMatch(css, /rgba\(var\(--color-/);
  assert.doesNotMatch(css, /--font-heading-family/);
  assert.doesNotMatch(packageJson, /finerworks/i);
});

test('gallery location navigation stays compact on mobile', async () => {
  const [collection, css, theme] = await Promise.all([
    text('sections/collection.liquid'),
    text('assets/base.css'),
    text('assets/theme.js'),
  ]);
  assert.match(collection, /data-gallery-location-select/);
  assert.match(css, /@media \(max-width: 749px\)[\s\S]*?\.gallery-locations__list \{ display: none; \}/);
  assert.match(css, /\.gallery-locations__mobile \{ display: block; \}/);
  assert.match(theme, /window\.location\.assign\(select\.value\)/);
});

test('legacy Title-option products retain the live frame preview', async () => {
  const product = await text('sections/product.liquid');
  assert.match(product, /data-frame-preview/);
  assert.doesNotMatch(product, /assign use_frame_preview = false/);
});
