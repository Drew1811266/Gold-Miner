import { test } from "node:test";
import assert from "node:assert/strict";
import { updateFxState } from "../../src/systems/fxSystem.js";

const EPSILON = 1e-9;

function createFx(overrides = {}) {
  return {
    flash: 0,
    shake: 0,
    shakeX: 0,
    shakeY: 0,
    pops: [],
    rings: [],
    particles: [],
    ...overrides,
  };
}

function assertClose(actual, expected) {
  assert.ok(Math.abs(actual - expected) < EPSILON, `expected ${actual} to be close to ${expected}`);
}

test("updateFxState mutates and returns the same fx object with injected shake randomness", () => {
  const randomValues = [0.75, 0.25];
  const fx = createFx({ flash: 1, shake: 1, shakeX: 99, shakeY: -99 });
  let randomCalls = 0;

  const result = updateFxState(fx, 0.25, () => {
    randomCalls += 1;
    return randomValues.shift();
  });

  assert.equal(result, fx);
  assertClose(fx.flash, 0.3);
  assertClose(fx.shake, 0.45);
  assertClose(fx.shakeX, 2.25);
  assertClose(fx.shakeY, -1.8);
  assert.equal(randomCalls, 2);
});

test("updateFxState clamps ended flash and shake offsets to zero", () => {
  const fx = createFx({ flash: 0.2, shake: 0.1, shakeX: 7, shakeY: -7 });
  let randomCalls = 0;

  updateFxState(fx, 0.25, () => {
    randomCalls += 1;
    return 0.9;
  });

  assert.equal(fx.flash, 0);
  assert.equal(fx.shake, 0);
  assert.equal(fx.shakeX, 0);
  assert.equal(fx.shakeY, 0);
  assert.equal(randomCalls, 2);

  const settledFx = createFx({ shake: 0, shakeX: 3, shakeY: 4 });
  updateFxState(settledFx, 0.1, () => {
    throw new Error("random should not run when shake is already inactive");
  });

  assert.equal(settledFx.shakeX, 0);
  assert.equal(settledFx.shakeY, 0);
});

test("updateFxState advances and removes score pops and rings in place", () => {
  const keepPop = { age: 0.2, life: 1, x: 10, y: 20, vx: 4, vy: 6 };
  const expiredPop = { age: 0.8, life: 1, x: 0, y: 0, vx: 10, vy: 20 };
  const keepRing = { age: 0.2, life: 1 };
  const expiredRing = { age: 0.7, life: 1 };
  const fx = createFx({
    pops: [keepPop, expiredPop],
    rings: [keepRing, expiredRing],
  });

  updateFxState(fx, 0.5, () => 0.5);

  assert.deepEqual(fx.pops, [keepPop]);
  assertClose(keepPop.age, 0.7);
  assertClose(keepPop.x, 12);
  assertClose(keepPop.y, 23);
  assertClose(keepPop.vy, 96);

  assert.deepEqual(fx.rings, [keepRing]);
  assertClose(keepRing.age, 0.7);
});

test("updateFxState advances particles, defaults gravity, and removes expired or tiny particles", () => {
  const customGravity = { age: 0.1, life: 2, x: 10, y: 20, vx: 4, vy: 6, gravity: 100, size: 2 };
  const defaultGravity = { age: 0, life: 2, x: 0, y: 0, vx: 10, vy: 20, size: 1 };
  const expiredByAge = { age: 0.8, life: 1, x: 0, y: 0, vx: 0, vy: 0, size: 1 };
  const expiredBySize = { age: 0, life: 2, x: 0, y: 0, vx: 0, vy: 0, size: 0.201 };
  const fx = createFx({
    particles: [customGravity, defaultGravity, expiredByAge, expiredBySize],
  });

  updateFxState(fx, 0.5, () => 0.5);

  assert.deepEqual(fx.particles, [customGravity, defaultGravity]);
  assertClose(customGravity.age, 0.6);
  assertClose(customGravity.x, 12);
  assertClose(customGravity.y, 23);
  assertClose(customGravity.vy, 56);
  assertClose(customGravity.vx, 3.94);
  assertClose(customGravity.size, 1.984);

  assertClose(defaultGravity.age, 0.5);
  assertClose(defaultGravity.x, 5);
  assertClose(defaultGravity.y, 10);
  assertClose(defaultGravity.vy, 210);
  assertClose(defaultGravity.vx, 9.85);
  assertClose(defaultGravity.size, 0.992);
});

test("updateFxState validates basic fx, dt, and random inputs", () => {
  assert.throws(() => updateFxState(null, 0), /fx must be an object/);
  assert.throws(() => updateFxState(createFx({ flash: "0" }), 0), /fx\.flash must be a finite number/);
  assert.throws(() => updateFxState(createFx({ pops: null }), 0), /fx\.pops must be an array/);
  assert.throws(() => updateFxState(createFx(), Number.NaN), /dt must be a finite number/);
  assert.throws(() => updateFxState(createFx(), 0.1, null), /random must be a function/);
});
