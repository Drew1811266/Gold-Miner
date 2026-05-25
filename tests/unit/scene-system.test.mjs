import { test } from "node:test";
import assert from "node:assert/strict";
import { createSceneData } from "../../src/render/sceneSystem.js";

test("createSceneData is deterministic for a fixed seed and viewport", () => {
  const input = {
    seed: 12345,
    viewport: { w: 960, h: 540 },
    background: { id: "dusk" },
  };

  const first = createSceneData(input);
  const second = createSceneData(input);

  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.notEqual(first.stars, second.stars);
  assert.notEqual(first.dust, second.dust);
  assert.notEqual(first.dirt, second.dirt);
});

test("createSceneData preserves the expected scene shape and ranges", () => {
  const viewport = { w: 1280, h: 720 };
  const scene = createSceneData({ seed: 77, viewport, background: null });
  const groundY = viewport.h * 0.72;

  assert.deepEqual(Object.keys(scene).sort(), ["dirt", "dust", "stars"]);
  assert.equal(scene.stars.length, 36);
  assert.equal(scene.dust.length, 55);
  assert.equal(scene.dirt.length, 90);

  for (const star of scene.stars) {
    assert.ok(star.x >= 0 && star.x <= viewport.w);
    assert.ok(star.y >= 0 && star.y <= groundY * 0.58);
    assert.ok(star.r >= 0.6 && star.r <= 1.8);
    assert.ok(star.a >= 0.08 && star.a <= 0.28);
    assert.ok(star.tw >= 0 && star.tw <= Math.PI * 2);
  }

  for (const dust of scene.dust) {
    assert.ok(dust.x >= 0 && dust.x <= viewport.w);
    assert.ok(dust.y >= groundY + 10 && dust.y <= viewport.h);
    assert.ok(dust.r >= 0.8 && dust.r <= 2.2);
    assert.ok(dust.a >= 0.03 && dust.a <= 0.12);
    assert.ok(dust.tw >= 0 && dust.tw <= Math.PI * 2);
  }

  for (const dirt of scene.dirt) {
    assert.ok(dirt.x >= 0 && dirt.x <= viewport.w);
    assert.ok(dirt.y >= groundY + 12 && dirt.y <= viewport.h);
    assert.ok(dirt.r >= 0.6 && dirt.r <= 3.4);
    assert.ok(dirt.a >= 0.05 && dirt.a <= 0.18);
    assert.ok(dirt.hue >= -0.08 && dirt.hue <= 0.08);
  }
});

test("createSceneData validates required inputs", () => {
  assert.throws(() => createSceneData(), /options must be an object/);
  assert.throws(() => createSceneData({ seed: "7", viewport: { w: 640, h: 360 } }), /seed must be a finite number/);
  assert.throws(() => createSceneData({ seed: 7, viewport: null }), /viewport must be an object/);
  assert.throws(() => createSceneData({ seed: 7, viewport: { w: "640", h: 360 } }), /viewport.w must be a finite number/);
  assert.throws(() => createSceneData({ seed: 7, viewport: { w: 640, h: NaN } }), /viewport.h must be a finite number/);
});
