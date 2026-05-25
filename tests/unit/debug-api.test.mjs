import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createDebugAdvancePlan,
  createDebugShopSetup,
  createDebugSnapshot,
  renderDebugSnapshotToText,
} from "../../src/testing/debugApi.js";

function createGame() {
  return {
    phase: "playing",
    paused: false,
    mode: "double",
    level: 2,
    score: 42.5,
    target: 650,
    inventory: {
      bombs: 2,
      speed: 1,
      lucky: 0,
    },
    timeLeft: 59.876,
    currentSeed: 13546,
    runSeed: 12345,
    hook: {
      state: "retract",
      angle: 0.12345,
      length: 88.88,
      maxLength: 321.23,
      attachedId: "bag-1",
    },
    hooks: [],
    items: [
      { id: "gold-1", type: "gold", x: 10.04, y: 20.05, r: 8.06, value: 100 },
      {
        id: "mouse-1",
        type: "mouse",
        x: 30.04,
        y: 40.05,
        r: 6.06,
        value: 50,
        mouse: { cargo: "bar", vx: Number.NaN },
      },
      { id: "hidden", type: "rock", x: 1, y: 2, r: 3, value: 1, grabbed: true },
    ],
    market: {
      name: "测试交易日",
      summary: "金条↑10%",
      multipliers: {
        bar: 1.1234,
        diamond: 0.9876,
        emerald: 1,
        ruby: 1.1111,
        crystal: 0.9999,
      },
    },
    dda: {
      stage: 1,
      rating: 0.1234,
      post4Pressure: 0.2345,
      difficulty: 0.3456,
      targetMul: 1.4567,
      timeMul: 0.9876,
      lastOverRatio: 0.1111,
      firstClearTimeLeft: 12.345,
    },
  };
}

const hooks = [
  {
    state: "retract",
    angle: 0.12345,
    length: 88.88,
    maxLength: 321.23,
    attachedId: "bag-1",
  },
  {
    state: "swing",
    angle: -0.45678,
    length: 20.01,
    maxLength: 300.02,
    attachedId: null,
  },
];

function snapshotInput(overrides = {}) {
  const carried = { id: "bag-1", type: "bag", r: 7.77, value: 10, bagValue: 180 };
  return {
    game: createGame(),
    hooks,
    getPivot: (hook) => (hook === hooks[0] ? { x: 100.04, y: 50.05 } : { x: 200.04, y: 55.05 }),
    getHookEnd: (hook) => (hook === hooks[0] ? { x: 110.04, y: 140.05 } : { x: 210.04, y: 70.05 }),
    attachedItem: (hook) => (hook.attachedId === "bag-1" ? carried : null),
    ...overrides,
  };
}

test("createDebugSnapshot mirrors render_game_to_text payload shape and rounding", () => {
  const snapshot = createDebugSnapshot(snapshotInput());

  assert.equal(snapshot.coordinateSystem, "origin top-left; +x right; +y down; units: px");
  assert.equal(snapshot.phase, "playing");
  assert.equal(snapshot.mode, "double");
  assert.equal(snapshot.seed, 13546);
  assert.equal(snapshot.timeLeft, 59.88);
  assert.deepEqual(snapshot.inventory, { bombs: 2, speed: 1, lucky: 0 });
  assert.deepEqual(snapshot.hook, {
    state: "retract",
    angle: 0.123,
    length: 88.9,
    maxLength: 321.2,
    attached: { id: "bag-1", type: "bag", r: 7.8, value: 180 },
  });
  assert.deepEqual(snapshot.pivot, { x: 100, y: 50.1 });
  assert.deepEqual(snapshot.hookEnd, { x: 110, y: 140.1 });
  assert.deepEqual(snapshot.hooks.map((hook) => hook.player), [1, 2]);
  assert.deepEqual(snapshot.hooks[1].hook, {
    state: "swing",
    angle: -0.457,
    length: 20,
    maxLength: 300,
    attached: null,
  });
  assert.deepEqual(snapshot.items, [
    { id: "gold-1", type: "gold", x: 10, y: 20.1, r: 8.1, value: 100 },
    {
      id: "mouse-1",
      type: "mouse",
      x: 30,
      y: 40.1,
      r: 6.1,
      value: 50,
      cargo: "bar",
      vx: 0,
    },
  ]);
  assert.deepEqual(snapshot.market.multipliers, {
    bar: 1.123,
    diamond: 0.988,
    emerald: 1,
    ruby: 1.111,
    crystal: 1,
  });
  assert.deepEqual(snapshot.dda, {
    stage: 1,
    rating: 0.123,
    post4Pressure: 0.235,
    difficulty: 0.346,
    targetMul: 1.457,
    timeMul: 0.988,
    lastOverRatio: 0.111,
    firstClearTimeLeft: 12.35,
  });
});

test("renderDebugSnapshotToText serializes the debug snapshot as JSON", () => {
  assert.deepEqual(
    JSON.parse(renderDebugSnapshotToText(snapshotInput())),
    createDebugSnapshot(snapshotInput()),
  );
});

test("createDebugSnapshot supports default market values and item limit", () => {
  const game = createGame();
  game.market = null;
  game.items = Array.from({ length: 3 }, (_, index) => ({
    id: `item-${index}`,
    type: "rock",
    x: index,
    y: index,
    r: 1,
    value: index,
  }));

  const snapshot = createDebugSnapshot(snapshotInput({ game, itemLimit: 2 }));

  assert.equal(snapshot.market.name, "交易日");
  assert.equal(snapshot.market.summary, "金条±0%  钻石±0%  祖母绿±0%  红宝石±0%  水晶簇±0%");
  assert.deepEqual(snapshot.market.multipliers, {
    bar: 1,
    diamond: 1,
    emerald: 1,
    ruby: 1,
    crystal: 1,
  });
  assert.equal(snapshot.items.length, 2);
});

test("createDebugAdvancePlan preserves legacy virtual-time stepping", () => {
  assert.deepEqual(createDebugAdvancePlan(1000), {
    totalMs: 1000,
    stepMs: 1000 / 60,
    steps: 60,
    dt: 1 / 60,
  });
  assert.deepEqual(createDebugAdvancePlan(-100), {
    totalMs: 0,
    stepMs: 1000 / 60,
    steps: 1,
    dt: 1 / 60,
  });
  assert.equal(createDebugAdvancePlan("abc").steps, 1);
  assert.equal(createDebugAdvancePlan(33.34).steps, 2);
});

test("createDebugShopSetup creates a repeatable shop smoke precondition", () => {
  assert.deepEqual(createDebugShopSetup({ game: createGame(), score: 500 }), {
    phase: "shop",
    paused: true,
    score: 500,
  });

  assert.deepEqual(createDebugShopSetup({ game: createGame() }), {
    phase: "shop",
    paused: true,
    score: 500,
  });
});

test("debug API validates structural inputs", () => {
  assert.throws(() => createDebugSnapshot(), /debug game must be an object/);
  assert.throws(
    () => createDebugSnapshot(snapshotInput({ hooks: null })),
    /debug hooks must be an array/,
  );
  assert.throws(
    () => createDebugSnapshot(snapshotInput({ getPivot: null })),
    /debug getPivot must be a function/,
  );
  assert.throws(
    () => createDebugSnapshot(snapshotInput({ getHookEnd: null })),
    /debug getHookEnd must be a function/,
  );
  assert.throws(
    () => createDebugSnapshot(snapshotInput({ attachedItem: null })),
    /debug attachedItem must be a function/,
  );
  assert.throws(
    () => createDebugSnapshot(snapshotInput({ itemLimit: -1 })),
    /debug itemLimit must be a non-negative integer/,
  );
  assert.throws(
    () => createDebugAdvancePlan(100, { frameRate: 0 }),
    /debug frameRate must be a positive finite number/,
  );
  assert.throws(() => createDebugShopSetup({ game: null }), /debug shop game/);
  assert.throws(() => createDebugShopSetup({ game: createGame(), score: -1 }), /debug shop score/);
});
