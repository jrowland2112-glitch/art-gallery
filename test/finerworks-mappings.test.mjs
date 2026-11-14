import test from 'node:test';
import assert from 'node:assert/strict';
import { proposedBuilds } from '../scripts/finerworks-validate-mappings.mjs';

test('defines the approved nine FinerWorks variants', () => {
  const builds = proposedBuilds();
  assert.equal(builds.length, 9);
  assert.deepEqual([...new Set(builds.map((item) => item.finish))], ['Framed', 'Metal', 'Gallery Wrap']);
  assert.deepEqual([...new Set(builds.map((item) => item.size))], ['12x18', '16x24', '24x36']);
});

test('keeps exact FinerWorks finish selections consistent across sizes', () => {
  for (const item of proposedBuilds()) {
    assert.equal(item.build.ColorCorrect, false);
    if (item.finish === 'Framed') {
      assert.equal(item.build.PrintProductTypeID, 5);
      assert.equal(item.build.MediaID, 7);
      assert.equal(item.build.MountingID, 8);
      assert.equal(item.build.FrameID, 96);
      assert.equal(item.build.MatID, 1);
      assert.equal(item.build.MatID2, 1);
      assert.equal(item.build.GlassID, 1);
      assert.equal(item.build.FrameW - item.build.PrintW, 3);
      assert.equal(item.build.FrameH - item.build.PrintH, 3);
    } else if (item.finish === 'Metal') {
      assert.deepEqual([item.build.PrintProductTypeID, item.build.MediaID, item.build.MountingID], [14, 130, 68]);
    } else {
      assert.deepEqual([item.build.PrintProductTypeID, item.build.MediaID, item.build.MountingID], [1, 46, 29]);
      assert.deepEqual(item.build.CanvasAddOns, [1]);
    }
  }
});
