import test from 'node:test';
import assert from 'node:assert/strict';

import { verifySummary } from '../scripts/whcc-validate-mappings.mjs';

function framedMapping(size, mat) {
  return {
    finish: 'Framed',
    size,
    whccSelections: { mat },
  };
}

function framedSummary(size, matDescription) {
  return [
    { id: 'size', description: size },
    { id: 'moulding', description: 'Gallery Slim Black' },
    { id: 'mat', description: matDescription },
    { id: 'mat_color', description: 'Double White' },
    { id: 'acrylic', description: 'Standard Acrylic' },
  ];
}

test('WHCC summary accepts the approved 1.5-inch mat for 12x18', () => {
  assert.doesNotThrow(() => verifySummary(
    framedMapping('12x18', '1_5_in'),
    framedSummary('12x18', '1.5 inch'),
  ));
});

test('WHCC summary rejects a 2-inch mat for 12x18', () => {
  assert.throws(() => verifySummary(
    framedMapping('12x18', '1_5_in'),
    framedSummary('12x18', '2 inch'),
  ), /requested mat selection/);
});

test('WHCC summary accepts the approved 2-inch mat for larger sizes', () => {
  for (const size of ['16x24', '24x36']) {
    assert.doesNotThrow(() => verifySummary(
      framedMapping(size, '2_in'),
      framedSummary(size, '2 inch'),
    ));
  }
});
