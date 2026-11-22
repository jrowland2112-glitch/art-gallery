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
    /assign metal_mockup_asset = 'metal-lifestyle-landscape-clean-grip\.jpg'/,
    'landscape previews must use the unobstructed clean-grip mockup',
  );
  assert.match(productSection, /if metal_mockup_orientation == 'portrait'[\s\S]*metal-lifestyle__hands--left/);
  assert.doesNotMatch(css, /\[data-metal-orientation="landscape"\]\s+\.metal-lifestyle__hands--left/);
  assert.match(
    css,
    /\[data-metal-orientation="portrait"\]\s+\.metal-lifestyle__hands--right\s*\{[^}]*clip-path:\s*polygon\(/s,
  );
});
