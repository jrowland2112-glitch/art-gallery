import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../assets/base.css', import.meta.url), 'utf8');

test('metal wall previews reserve the hand contact areas at both orientations', () => {
  assert.match(
    css,
    /\[data-metal-layout="wall"\]\[data-metal-orientation="landscape"\]\s+\.metal-lifestyle__panel\s*\{[^}]*clip-path:\s*polygon\(/s,
  );
  assert.match(
    css,
    /\[data-metal-layout="wall"\]\[data-metal-orientation="portrait"\]\s+\.metal-lifestyle__panel\s*\{[^}]*clip-path:\s*polygon\(/s,
  );
});
