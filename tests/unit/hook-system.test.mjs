import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clampHookLength,
  getHookDir,
  getHookEndPoint,
  updateHookReelState,
  updateHookSwingState,
  updateHookTrailState,
} from "../../src/systems/hookSystem.js";

const EPSILON = 1e-9;

function assertClose(actual, expected) {
  assert.ok(Math.abs(actual - expected) < EPSILON, `expected ${actual} to be close to ${expected}`);
}

test("getHookDir mirrors the game sine/cosine hook orientation", () => {
  assert.deepEqual(getHookDir(0), { x: 0, y: 1 });

  const right = getHookDir(Math.PI / 2);
  assertClose(right.x, 1);
  assertClose(right.y, 0);

  const left = getHookDir(-Math.PI / 2);
  assertClose(left.x, -1);
  assertClose(left.y, 0);
});

test("getHookEndPoint projects from pivot by angle and length", () => {
  const end = getHookEndPoint({ pivot: { x: 20, y: 30 }, angle: Math.PI / 6, length: 40 });

  assertClose(end.x, 40);
  assertClose(end.y, 30 + Math.cos(Math.PI / 6) * 40);
});

test("clampHookLength keeps current clamp semantics", () => {
  assert.equal(clampHookLength(50, { minLength: 60, maxLength: 200 }), 60);
  assert.equal(clampHookLength(250, { minLength: 60, maxLength: 200 }), 200);
  assert.equal(clampHookLength(120, { minLength: 60, maxLength: 200 }), 120);
});

test("updateHookTrailState ages and removes expired trail points in place", () => {
  const keep = { x: 10, y: 20, age: 0.1 };
  const expired = { x: 0, y: 0, age: 0.5 };
  const trail = [expired, keep];

  const result = updateHookTrailState({ trail, state: "swing", end: null, dt: 0.05 });

  assert.equal(result, trail);
  assert.deepEqual(trail, [keep]);
  assertClose(keep.age, 0.15);
});

test("updateHookTrailState adds a point for active extend or retract movement", () => {
  const trail = [];

  updateHookTrailState({ trail, state: "extend", end: { x: 12, y: 18 }, dt: 0 });
  updateHookTrailState({ trail, state: "retract", end: { x: 30, y: 18 }, dt: 0 });

  assert.deepEqual(trail, [
    { x: 12, y: 18, age: 0 },
    { x: 30, y: 18, age: 0 },
  ]);
});

test("updateHookTrailState appends after aging removes expired points", () => {
  const trail = [{ x: 2, y: 3, age: 0.54 }];

  updateHookTrailState({ trail, state: "extend", end: { x: 12, y: 18 }, dt: 0.02 });

  assert.deepEqual(trail, [{ x: 12, y: 18, age: 0 }]);
});

test("updateHookTrailState updates the last point when active movement is below min distance", () => {
  const trail = [{ x: 10, y: 10, age: 0 }];

  updateHookTrailState({ trail, state: "extend", end: { x: 14, y: 13 }, dt: 0.1 });

  assert.equal(trail.length, 1);
  assert.deepEqual(trail[0], { x: 14, y: 13, age: 0.1 });
});

test("updateHookTrailState appends when movement is exactly at min distance", () => {
  const trail = [{ x: 10, y: 10, age: 0 }];

  updateHookTrailState({ trail, state: "extend", end: { x: 17, y: 10 }, dt: 0 });

  assert.deepEqual(trail, [
    { x: 10, y: 10, age: 0 },
    { x: 17, y: 10, age: 0 },
  ]);
});

test("updateHookTrailState shifts old points when active trail exceeds maxPoints", () => {
  const trail = Array.from({ length: 28 }, (_, index) => ({ x: index * 10, y: 0, age: 0 }));

  updateHookTrailState({ trail, state: "extend", end: { x: 999, y: 0 }, dt: 0 });

  assert.equal(trail.length, 28);
  assert.equal(trail[0].x, 10);
  assert.deepEqual(trail.at(-1), { x: 999, y: 0, age: 0 });
});

test("updateHookTrailState does not add points for inactive hook states", () => {
  const trail = [{ x: 5, y: 6, age: 0.1 }];

  updateHookTrailState({ trail, state: "swing", end: { x: 100, y: 100 }, dt: 0.1 });

  assert.deepEqual(trail, [{ x: 5, y: 6, age: 0.2 }]);
});

test("updateHookSwingState advances swing angle and clamps bounds", () => {
  const maxHook = { state: "swing", angle: 0.2, angleDir: 1, angleSpeed: 4, minAngle: -0.5, maxAngle: 0.5 };
  const minHook = { state: "swing", angle: -0.2, angleDir: -1, angleSpeed: 4, minAngle: -0.5, maxAngle: 0.5 };

  assert.equal(updateHookSwingState(maxHook, 1), maxHook);
  assert.equal(maxHook.angle, 0.5);
  assert.equal(maxHook.angleDir, -1);

  updateHookSwingState(minHook, 1);
  assert.equal(minHook.angle, -0.5);
  assert.equal(minHook.angleDir, 1);
});

test("updateHookSwingState leaves inactive hook states untouched", () => {
  const hook = { state: "extend", angle: 0.2, angleDir: 1, angleSpeed: 4, minAngle: -0.5, maxAngle: 0.5 };

  updateHookSwingState(hook, 1);

  assert.deepEqual(hook, { state: "extend", angle: 0.2, angleDir: 1, angleSpeed: 4, minAngle: -0.5, maxAngle: 0.5 });
});

test("updateHookReelState updates reel angle, last length, and smoothed spool speed", () => {
  const hook = { length: 110, reelAngle: 0, lastLength: 100, spoolSpeed: 0 };

  const result = updateHookReelState(hook, { prevLength: 100, dt: 0.1 });

  assert.equal(result, hook);
  assertClose(hook.reelAngle, 1);
  assert.equal(hook.lastLength, 110);
  assertClose(hook.spoolSpeed, 100 * (1 - Math.exp(-1.05)));
});

test("updateHookReelState handles retracting and near-zero movement without requiring lastLength", () => {
  const retractingHook = { length: 90, reelAngle: 2, spoolSpeed: 0 };
  updateHookReelState(retractingHook, { prevLength: 100, dt: 0.1 });

  assertClose(retractingHook.reelAngle, 1);
  assert.equal(retractingHook.lastLength, 90);
  assertClose(retractingHook.spoolSpeed, -100 * (1 - Math.exp(-1.05)));

  const idleHook = { length: 100.00005, reelAngle: 3, lastLength: 80, spoolSpeed: 20 };
  updateHookReelState(idleHook, { prevLength: 100, dt: 0.1 });

  assert.equal(idleHook.reelAngle, 3);
  assert.equal(idleHook.lastLength, 80);
  assertClose(idleHook.spoolSpeed, 20 + (0.0005 - 20) * (1 - Math.exp(-1.05)));
});

test("hook system helpers validate basic inputs", () => {
  assert.throws(() => getHookDir(Number.NaN), /angle must be a finite number/);
  assert.throws(
    () => getHookEndPoint({ pivot: null, angle: 0, length: 1 }),
    /pivot must be an object/,
  );
  assert.throws(
    () => clampHookLength(10, { minLength: 1, maxLength: Number.NaN }),
    /maxLength must be a finite number/,
  );
  assert.throws(() => updateHookTrailState({ trail: null, state: "swing", dt: 0 }), /trail must be an array/);
  assert.throws(
    () => updateHookTrailState({ trail: [{ x: 0, y: 0, age: "0" }], state: "swing", dt: 0 }),
    /trail\[0\]\.age must be a finite number/,
  );
  assert.throws(
    () => updateHookTrailState({ trail: [], state: "extend", end: null, dt: 0 }),
    /end must be an object/,
  );
  assert.throws(() => updateHookSwingState(null, 0), /hook must be an object/);
  assert.throws(() => updateHookReelState({ length: 1 }, { prevLength: 0, dt: 0 }), /hook\.reelAngle/);
});
