import { test } from "node:test";
import assert from "node:assert/strict";
import { createPlayerRenderOrder, renderFrameWithLayers } from "../../src/render/renderPipeline.js";

function createFakeCtx() {
  const calls = [];
  return {
    calls,
    setTransform(...args) {
      calls.push(["setTransform", ...args]);
    },
    clearRect(...args) {
      calls.push(["clearRect", ...args]);
    },
    save() {
      calls.push(["save"]);
    },
    restore() {
      calls.push(["restore"]);
    },
    fillRect(...args) {
      calls.push(["fillRect", ...args]);
    },
    set globalAlpha(value) {
      calls.push(["globalAlpha", value]);
    },
    set fillStyle(value) {
      calls.push(["fillStyle", value]);
    },
  };
}

function validRenderOptions(overrides = {}) {
  return {
    ctx: createFakeCtx(),
    canvas: { width: 320, height: 240 },
    viewport: { w: 160, h: 120 },
    dpr: 2,
    fx: { shakeX: 0, shakeY: 0, flash: 0 },
    phase: "menu",
    paused: false,
    timeLeft: 60,
    players: [],
    layers: {},
    now: 0,
    ...overrides,
  };
}

test("createPlayerRenderOrder sorts hooks by pivot x and preserves player data", () => {
  const hooks = [{ id: "right" }, { id: "left" }, { id: "middle" }];
  const miners = [{ name: "miner-0" }, { name: "miner-1" }, { name: "miner-2" }];
  const pivots = new Map([
    ["right", { x: 30 }],
    ["left", { x: 10 }],
    ["middle", { x: 20 }],
  ]);

  const players = createPlayerRenderOrder({
    hooks,
    getMinerByIndex: (index) => miners[index],
    getPivot: (hook) => pivots.get(hook.id),
  });

  assert.deepEqual(players, [
    { hook: hooks[1], miner: miners[1], index: 1, pivotX: 10 },
    { hook: hooks[2], miner: miners[2], index: 2, pivotX: 20 },
    { hook: hooks[0], miner: miners[0], index: 0, pivotX: 30 },
  ]);
  assert.deepEqual(hooks.map((hook) => hook.id), ["right", "left", "middle"]);
});

test("renderFrameWithLayers calls layer callbacks in current draw order with sorted player args", () => {
  const hooks = [{ id: "right" }, { id: "left" }];
  const miners = [{ name: "miner-0" }, { name: "miner-1" }];
  const players = createPlayerRenderOrder({
    hooks,
    getMinerByIndex: (index) => miners[index],
    getPivot: (hook) => ({ x: hook.id === "left" ? 5 : 50 }),
  });
  const order = [];
  const layers = Object.fromEntries(
    [
      "background",
      "plank",
      "minerBack",
      "winch",
      "minerFront",
      "items",
      "hookTrail",
      "hook",
      "carryLabel",
      "fx",
    ].map((name) => [
      name,
      (...args) => {
        order.push([name, ...args]);
      },
    ]),
  );

  renderFrameWithLayers({
    ctx: createFakeCtx(),
    canvas: { width: 800, height: 600 },
    viewport: { w: 400, h: 300 },
    dpr: 2,
    fx: { shakeX: 0, shakeY: 0, flash: 0 },
    phase: "playing",
    paused: false,
    timeLeft: 30,
    players,
    layers,
    now: 0,
  });

  assert.deepEqual(order, [
    ["background"],
    ["plank"],
    ["minerBack", hooks[1], miners[1], 1],
    ["minerBack", hooks[0], miners[0], 0],
    ["winch", hooks[1], miners[1], 1],
    ["winch", hooks[0], miners[0], 0],
    ["minerFront", hooks[1], miners[1], 1],
    ["minerFront", hooks[0], miners[0], 0],
    ["items"],
    ["hookTrail", hooks[1], miners[1], 1],
    ["hookTrail", hooks[0], miners[0], 0],
    ["hook", hooks[1], miners[1], 1],
    ["hook", hooks[0], miners[0], 0],
    ["carryLabel", hooks[1], miners[1], 1],
    ["carryLabel", hooks[0], miners[0], 0],
    ["fx"],
  ]);
});

test("renderFrameWithLayers resets, clears, applies shake transform, and draws overlays", () => {
  const ctx = createFakeCtx();

  renderFrameWithLayers({
    ctx,
    canvas: { width: 800, height: 600 },
    viewport: { w: 400, h: 300 },
    dpr: 2,
    fx: { shakeX: 3, shakeY: -4, flash: 0.4 },
    phase: "playing",
    paused: false,
    timeLeft: 10,
    players: [],
    layers: {},
    now: 0,
  });

  assert.deepEqual(ctx.calls.slice(0, 3), [
    ["setTransform", 1, 0, 0, 1, 0, 0],
    ["clearRect", 0, 0, 800, 600],
    ["setTransform", 2, 0, 0, 2, 6, -8],
  ]);
  assert.deepEqual(ctx.calls.slice(3), [
    ["save"],
    ["globalAlpha", 0.4],
    ["fillStyle", "#fff1c4"],
    ["fillRect", 0, 0, 400, 300],
    ["restore"],
    ["save"],
    ["globalAlpha", 0.12],
    ["fillStyle", "#ff2a2a"],
    ["fillRect", 0, 0, 400, 300],
    ["restore"],
  ]);
});

test("renderFrameWithLayers allows all layer callbacks to be omitted", () => {
  assert.doesNotThrow(() => {
    renderFrameWithLayers(validRenderOptions());
  });
});

test("renderFrameWithLayers rejects invalid overlay state inputs instead of coercing them", () => {
  assert.throws(
    () => renderFrameWithLayers(validRenderOptions({ phase: null })),
    /phase must be a string/,
  );
  assert.throws(
    () => renderFrameWithLayers(validRenderOptions({ paused: 0 })),
    /paused must be a boolean/,
  );
  assert.throws(
    () => renderFrameWithLayers(validRenderOptions({ timeLeft: "9" })),
    /timeLeft must be a finite number/,
  );
});
