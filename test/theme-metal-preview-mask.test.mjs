import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../assets/base.css', import.meta.url), 'utf8');
const themeJs = await readFile(new URL('../assets/theme.js', import.meta.url), 'utf8');
const productSection = await readFile(new URL('../sections/product.liquid', import.meta.url), 'utf8');
const landscapeMockup = await readFile(new URL('../assets/metal-lifestyle-landscape.jpg', import.meta.url));
const landscapeLeftHand = await readFile(new URL('../assets/metal-lifestyle-landscape-left-hand-overlay.png', import.meta.url));

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

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
  assert.match(css, /\.metal-lifestyle__hands\s*\{[^}]*z-index:\s*2/s);
  assert.match(
    themeJs,
    /else points = \[\[0\.1437, 0\.1848\], \[0\.8440, 0\.1050\], \[0\.8430, 0\.7960\], \[0\.1437, 0\.7384\]\];/,
    'the approved landscape perspective corners changed; visually re-approve before updating them',
  );
  assert.match(
    css,
    /\[data-metal-orientation="portrait"\]\s+\.metal-lifestyle__hands--right\s*\{[^}]*clip-path:\s*polygon\(/s,
  );
});

test('approved landscape metal composite assets remain byte-for-byte unchanged', () => {
  assert.equal(
    sha256(landscapeMockup),
    '6aa57fcf3f011ea10d944a811056fcae83c0e00ab38e5baac4db679fdad249b8',
    'the approved original metal mockup changed; re-approve its hand alignment before updating this hash',
  );
  assert.equal(
    sha256(landscapeLeftHand),
    '994fb8ed45346224bb094636acef57f07cc1437dc02f1be664293ed98693cd96',
    'the approved extracted left-hand overlay changed; re-approve it before updating this hash',
  );
});
