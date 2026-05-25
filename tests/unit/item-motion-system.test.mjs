import { test } from "node:test";
import assert from "node:assert/strict";
import {
  updateFallingKegMotion,
  updateMouseItemMotion,
} from "../../src/systems/itemMotionSystem.js";

const EPSILON = 1e-9;

function assertClose(actual, expected) {
  assert.ok(Math.abs(actual - expected) < EPSILON, `expected ${actual} to be close to ${expected}`);
}

test("updateMouseItemMotion moves horizontally, clamps y, and advances phase with speed contribution", () => {
  const item = { id: 1, type: "mouse", x: 100, y: 20, r: 10, mouse: { vx: 90, phase: 1 } };

  const result = updateMouseItemMotion(item, { dt: 0.5, viewport: { w: 300, h: 220 } });

  assert.equal(result, item);
  assert.equal(item.x, 145);
  assert.equal(item.y, 180);
  assertClose(item.mouse.phase, 1 + 0.5 * (3.5 + 1));
});

test("updateMouseItemMotion bounces off the left and right bounds", () => {
  const left = { id: 1, type: "mouse", x: 45, y: 190, r: 10, mouse: { vx: -40, phase: 0 } };
  const right = { id: 2, type: "mouse", x: 255, y: 190, r: 10, mouse: { vx: 40, phase: 0 } };

  updateMouseItemMotion(left, { dt: 1, viewport: { w: 300, h: 240 } });
  updateMouseItemMotion(right, { dt: 1, viewport: { w: 300, h: 240 } });

  assert.equal(left.x, 44);
  assert.equal(left.mouse.vx, 40);
  assert.equal(right.x, 256);
  assert.equal(right.mouse.vx, -40);
});

test("updateMouseItemMotion uses fallback speed when boundary velocity is zero or non-finite", () => {
  const zeroVx = { id: 1, type: "mouse", x: 44, y: 190, r: 10, mouse: { vx: 0, phase: 0 } };
  const nonFiniteVx = { id: 2, type: "mouse", x: 256, y: 190, r: 10, mouse: { vx: Number.POSITIVE_INFINITY, phase: 0 } };

  updateMouseItemMotion(zeroVx, { dt: 1, viewport: { w: 300, h: 240 }, fallbackSpeed: 70 });
  updateMouseItemMotion(nonFiniteVx, { dt: 1, viewport: { w: 300, h: 240 }, fallbackSpeed: 70 });

  assert.equal(zeroVx.mouse.vx, 70);
  assert.equal(nonFiniteVx.mouse.vx, -70);
});

test("updateMouseItemMotion starts non-finite phase at zero and caps speed contribution", () => {
  const item = { id: 1, type: "mouse", x: 120, y: 190, r: 10, mouse: { vx: 900, phase: Number.NaN } };

  updateMouseItemMotion(item, { dt: 0.25, viewport: { w: 1000, h: 240 } });

  assertClose(item.mouse.phase, 0.25 * (3.5 + 2.2));
});

test("updateMouseItemMotion skips grabbed, non-mouse, and mouse-less items", () => {
  const grabbed = { id: 1, type: "mouse", grabbed: true, x: 10, y: 10, r: 5, mouse: { vx: 10, phase: 0 } };
  const nonMouse = { id: 2, type: "gold", x: 10, y: 10, r: 5 };
  const noMouseState = { id: 3, type: "mouse", x: 10, y: 10, r: 5 };

  const before = structuredClone([grabbed, nonMouse, noMouseState]);

  assert.equal(updateMouseItemMotion(grabbed, { dt: 1, viewport: { w: 300, h: 240 } }), false);
  assert.equal(updateMouseItemMotion(nonMouse, { dt: 1, viewport: { w: 300, h: 240 } }), false);
  assert.equal(updateMouseItemMotion(noMouseState, { dt: 1, viewport: { w: 300, h: 240 } }), false);
  assert.deepEqual([grabbed, nonMouse, noMouseState], before);
});

test("updateFallingKegMotion locks x, integrates vertical velocity and y, and rotates art", () => {
  const item = { id: 1, type: "keg", x: 25, y: 20, r: 12, keg: { stage: "fall", vy: 10, x0: 80 }, art: { rot: 1 } };

  const result = updateFallingKegMotion(item, { dt: 0.1, gravity: 1000 });

  assert.equal(result, item);
  assert.equal(item.x, 80);
  assertClose(item.keg.vy, 110);
  assertClose(item.y, 31);
  assertClose(item.art.rot, 1 + 0.1 * (0.6 + 110 / 1300) * 0.9);
});

test("updateFallingKegMotion falls back to current x and default vy values", () => {
  const item = { id: 1, type: "keg", x: 25, y: 20, r: 12, keg: { stage: "fall" }, art: {} };

  updateFallingKegMotion(item, { dt: 0.2, gravity: 1000 });

  assert.equal(item.x, 25);
  assertClose(item.keg.vy, 200);
  assertClose(item.y, 60);
  assertClose(item.art.rot, 0.2 * (0.6 + 200 / 1300) * 0.9);
});

test("updateFallingKegMotion skips non-keg and non-falling keg items", () => {
  const nonKeg = { id: 1, type: "gold", x: 10, y: 10, r: 5 };
  const pullingKeg = { id: 2, type: "keg", x: 10, y: 10, r: 5, keg: { stage: "pull", vy: 0 } };
  const before = structuredClone([nonKeg, pullingKeg]);

  assert.equal(updateFallingKegMotion(nonKeg, { dt: 1 }), false);
  assert.equal(updateFallingKegMotion(pullingKeg, { dt: 1 }), false);
  assert.deepEqual([nonKeg, pullingKeg], before);
});

test("updateFallingKegMotion validates required inputs", () => {
  const item = { id: 1, type: "keg", x: 10, y: 10, r: 5, keg: { stage: "fall" } };

  assert.throws(() => updateFallingKegMotion(null, { dt: 1 }), /item must be an object/);
  assert.throws(() => updateFallingKegMotion(item, { dt: Number.NaN }), /dt must be a finite number/);
  assert.throws(() => updateFallingKegMotion(item, { dt: 1, gravity: Number.NaN }), /gravity must be a finite number/);
});
