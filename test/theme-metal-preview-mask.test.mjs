import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../assets/base.css', import.meta.url), 'utf8');
const productSection = await readFile(new URL('../sections/product.liquid', import.meta.url), 'utf8');

test('metal wall previews layer both hands above an uncut artwork panel', () => {
  assert.doesNotMatch(
    css,
    /\[data-metal-layout="wall"\][^{]+\.metal-lifestyle__panel\s*\{[^}]*clip-path/s,
  );
  assert.match(productSection, /metal-lifestyle__hands metal-lifestyle__hands--left/);
  assert.match(productSection, /metal-lifestyle__hands metal-lifestyle__hands--right/);
  assert.match(
    css,
    /\[data-metal-orientation="landscape"\]\s+\.metal-lifestyle__hands--left\s*\{[^}]*clip-path:\s*polygon\(/s,
  );
  assert.match(
    css,
    /\.metal-lifestyle__hands--left\s*\{[^}]*11\.5% 64\.5%[^}]*16\.6% 71%[^}]*11\.5% 73%/s,
    'the landscape foreground must isolate only the left thumb contact area',
  );
  assert.match(
    css,
    /\[data-metal-orientation="portrait"\]\s+\.metal-lifestyle__hands--right\s*\{[^}]*clip-path:\s*polygon\(/s,
  );
});
