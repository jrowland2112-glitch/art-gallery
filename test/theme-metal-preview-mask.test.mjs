import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../assets/base.css', import.meta.url), 'utf8');
const productSection = await readFile(new URL('../sections/product.liquid', import.meta.url), 'utf8');

test('metal wall previews preserve hands without cutting the artwork panel', () => {
  assert.doesNotMatch(
    css,
    /\[data-metal-layout="wall"\][^{]+\.metal-lifestyle__panel\s*\{[^}]*clip-path/s,
  );
  assert.match(productSection, /metal-lifestyle__hands metal-lifestyle__hands--left/);
  assert.match(productSection, /metal-lifestyle__hands metal-lifestyle__hands--right/);
  assert.match(
    productSection,
    /assign metal_mockup_asset = 'metal-lifestyle-landscape\.jpg'/,
    'landscape previews must retain the original mockup',
  );
  assert.match(
    productSection,
    /assign metal_left_hand_asset = 'metal-lifestyle-landscape-left-hand-overlay\.png'/,
    'landscape previews must use the extracted original-hand overlay',
  );
  assert.match(productSection, /assign metal_left_hand_asset = metal_mockup_asset/);
  assert.doesNotMatch(css, /\[data-metal-orientation="landscape"\]\s+\.metal-lifestyle__hands--left/);
  assert.match(
    css,
    /\[data-metal-orientation="portrait"\]\s+\.metal-lifestyle__hands--right\s*\{[^}]*clip-path:\s*polygon\(/s,
  );
});
