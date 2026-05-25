import { test } from "node:test";
import assert from "node:assert/strict";
import { createRng } from "../../src/core/rng.js";
import {
  ITEM_COUNT_SCALE,
  ITEM_PLACEMENT,
  ITEM_VALUE_SCALE,
  LEVEL_VALUE_RANDOM_MAX,
  LEVEL_VALUE_RANDOM_MIN,
  LEVEL_VALUE_RANDOM_START_LEVEL,
  MARKET_SEED_SALT,
  MAX_LEVEL_TIME,
  MIN_LEVEL_TIME,
  MOUSE_CARGO_CHANCE,
  MOUSE_MAX_PER_LEVEL,
  MOUSE_MIN_LEVEL,
  MOUSE_SPEED_MAX,
  MOUSE_SPEED_MIN,
  TWO_PLAYER_TARGET_MULTIPLIER,
} from "../../src/config/items.js";
import { getLevelConfig, LEVELS } from "../../src/config/levels.js";
import { GoldMinerModules } from "../../src/runtime/moduleBridge.js";
import { createItemArt, createItemSpec, makeItem } from "../../src/systems/itemFactory.js";
import { generateLevelData } from "../../src/systems/levelGenerator.js";
import { bagValueRange, createLevelItemValue, scaleItemValue } from "../../src/systems/valueSystem.js";

const AUTHORED_LEVELS = [
  {
    target: 650,
    time: 60,
    seed: 1201,
    mix: {
      goldSmall: 6,
      goldMedium: 4,
      goldLarge: 2,
      rock: 4,
      diamond: 1,
      bag: 2,
      bar: 1,
      crystal: 1,
      pouch: 1,
      fossil: 1,
      emerald: 0,
      ruby: 0,
      keg: 0,
    },
  },
  {
    target: 1200,
    time: 58,
    seed: 2315,
    mix: {
      goldSmall: 7,
      goldMedium: 5,
      goldLarge: 2,
      rock: 5,
      diamond: 1,
      bag: 2,
      bar: 1,
      crystal: 1,
      pouch: 1,
      fossil: 1,
      emerald: 0,
      ruby: 0,
      keg: 1,
    },
  },
  {
    target: 1750,
    time: 56,
    seed: 3427,
    mix: {
      goldSmall: 8,
      goldMedium: 5,
      goldLarge: 3,
      rock: 5,
      diamond: 2,
      bag: 2,
      bar: 2,
      crystal: 1,
      pouch: 1,
      fossil: 1,
      emerald: 1,
      ruby: 0,
      keg: 1,
    },
  },
  {
    target: 2350,
    time: 54,
    seed: 4579,
    mix: {
      goldSmall: 8,
      goldMedium: 6,
      goldLarge: 3,
      rock: 6,
      diamond: 2,
      bag: 3,
      bar: 2,
      crystal: 2,
      pouch: 1,
      fossil: 1,
      emerald: 1,
      ruby: 1,
      keg: 1,
    },
  },
  {
    target: 3000,
    time: 52,
    seed: 5683,
    mix: {
      goldSmall: 9,
      goldMedium: 6,
      goldLarge: 4,
      rock: 6,
      diamond: 2,
      bag: 3,
      bar: 2,
      crystal: 2,
      pouch: 1,
      fossil: 2,
      emerald: 1,
      ruby: 1,
      keg: 1,
    },
  },
  {
    target: 3700,
    time: 50,
    seed: 6761,
    mix: {
      goldSmall: 10,
      goldMedium: 7,
      goldLarge: 4,
      rock: 7,
      diamond: 3,
      bag: 3,
      bar: 2,
      crystal: 2,
      pouch: 2,
      fossil: 2,
      emerald: 1,
      ruby: 1,
      keg: 1,
    },
  },
];

const MARKET_MULTIPLIERS = {
  bar: 1.127,
  diamond: 1.344,
  emerald: 0.981,
  ruby: 1.109,
  crystal: 0.929,
};

const BASELINE_LEVEL_INPUT = {
  level: 1,
  runSeed: 12345,
  viewport: { w: 1100, h: 572 },
  mode: "single",
  ddaRating: 0,
  extraBags: 0,
};

const BASELINE_LEVEL_SUMMARY = {
  seed: 13546,
  target: 650,
  timeLeft: 60,
  market: {
    name: "淘金观望日",
    summary: "金条↑13%  钻石↑34%  祖母绿↓2%  红宝石↑11%  水晶簇↓7%",
    multipliers: {
      bar: 1.127,
      diamond: 1.344,
      emerald: 0.981,
      ruby: 1.109,
      crystal: 0.929,
    },
  },
  dda: {
    stage: 0,
    rating: 0,
    post4Pressure: 0,
    difficulty: 0,
    targetMul: 1,
    timeMul: 1,
  },
  itemCount: 14,
  firstItems: [
    { id: 1, type: "rock", x: 341.1, y: 288.6, r: 25.2, value: 20 },
    { id: 2, type: "rock", x: 742.3, y: 304.5, r: 19.3, value: 21 },
    { id: 3, type: "gold", x: 852.0, y: 366.7, r: 16.2, value: 25 },
    { id: 4, type: "gold", x: 485.7, y: 322.6, r: 15.4, value: 41 },
    { id: 5, type: "fossil", x: 901.8, y: 288.8, r: 21.9, value: 196 },
    { id: 6, type: "gold", x: 305.2, y: 464.3, r: 38.7, value: 156 },
    { id: 7, type: "crystal", x: 65.7, y: 198.1, r: 21.3, value: 71 },
    { id: 8, type: "gold", x: 932.9, y: 206.6, r: 25.4, value: 99 },
  ],
};

function roundTo(value, places) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function summarizeLevelData(levelData) {
  return {
    seed: levelData.seed,
    target: levelData.target,
    timeLeft: levelData.timeLeft,
    market: {
      name: levelData.market.name,
      summary: levelData.market.summary,
      multipliers: {
        bar: roundTo(levelData.market.multipliers.bar, 3),
        diamond: roundTo(levelData.market.multipliers.diamond, 3),
        emerald: roundTo(levelData.market.multipliers.emerald, 3),
        ruby: roundTo(levelData.market.multipliers.ruby, 3),
        crystal: roundTo(levelData.market.multipliers.crystal, 3),
      },
    },
    dda: {
      stage: levelData.dda.stage,
      rating: levelData.dda.rating,
      post4Pressure: levelData.dda.post4Pressure,
      difficulty: levelData.dda.difficulty,
      targetMul: levelData.dda.targetMul,
      timeMul: levelData.dda.timeMul,
    },
    itemCount: levelData.items.length,
    firstItems: levelData.items.slice(0, 8).map((item) => ({
      id: item.id,
      type: item.type,
      x: roundTo(item.x, 1),
      y: roundTo(item.y, 1),
      r: roundTo(item.r, 1),
      value: item.value,
    })),
  };
}

function summarizeItems(items) {
  return items.map((item) => ({
    id: item.id,
    type: item.type,
    x: roundTo(item.x, 3),
    y: roundTo(item.y, 3),
    r: roundTo(item.r, 3),
    value: item.value,
    weight: item.weight,
    bagValue: item.bagValue,
    mouse: item.mouse,
    art: item.art,
  }));
}

function createSpecTwice({ seed, type, size, level = 1, levelValueMultiplier = 1, dda = { mouseSpeedMul: 1 } }) {
  const context = {
    level,
    marketMultipliers: MARKET_MULTIPLIERS,
    levelValueMultiplier,
    dda,
  };

  return [
    createItemSpec({ ...context, rng: createRng(seed), type, size }),
    createItemSpec({ ...context, rng: createRng(seed), type, size }),
  ];
}

test("level config preserves authored presets and generated fallback", () => {
  assert.equal(LEVELS.length, 6);
  assert.deepEqual(LEVELS, AUTHORED_LEVELS);

  for (let index = 0; index < AUTHORED_LEVELS.length; index += 1) {
    assert.deepEqual(getLevelConfig(index + 1), AUTHORED_LEVELS[index]);
  }

  const first = getLevelConfig(1);
  first.mix.goldSmall = 999;
  assert.equal(getLevelConfig(1).mix.goldSmall, 6);

  const generated = getLevelConfig(7);
  assert.deepEqual(generated, {
    target: 3350,
    time: 50,
    seed: 15979,
    mix: {
      goldSmall: 13,
      goldMedium: 7,
      goldLarge: 4,
      rock: 7,
      diamond: 2,
      bag: 4,
      bar: 3,
      crystal: 2,
      pouch: 2,
      fossil: 2,
      emerald: 1,
      ruby: 1,
      keg: 1,
    },
  });

  assert.deepEqual(getLevelConfig(0), {
    target: 200,
    time: 62,
    seed: 9000,
    mix: {
      goldSmall: 6,
      goldMedium: 4,
      goldLarge: 2,
      rock: 4,
      diamond: 1,
      bag: 2,
      bar: 1,
      crystal: 1,
      pouch: 0,
      fossil: 0,
      emerald: 0,
      ruby: 0,
      keg: 0,
    },
  });
});

test("item balance constants match current runtime values", () => {
  assert.equal(ITEM_COUNT_SCALE, 0.55);
  assert.equal(ITEM_VALUE_SCALE, 0.4);
  assert.equal(LEVEL_VALUE_RANDOM_START_LEVEL, 4);
  assert.equal(LEVEL_VALUE_RANDOM_MIN, 0.5);
  assert.equal(LEVEL_VALUE_RANDOM_MAX, 0.8);
  assert.equal(MIN_LEVEL_TIME, 45);
  assert.equal(MAX_LEVEL_TIME, 90);
  assert.equal(TWO_PLAYER_TARGET_MULTIPLIER, 1.3);
  assert.equal(MARKET_SEED_SALT, 0x51d7348d);
  assert.equal(MOUSE_MIN_LEVEL, 5);
  assert.equal(MOUSE_MAX_PER_LEVEL, 4);
  assert.equal(MOUSE_CARGO_CHANCE, 0.3);
  assert.equal(MOUSE_SPEED_MIN, 70);
  assert.equal(MOUSE_SPEED_MAX, 150);
  assert.deepEqual(ITEM_PLACEMENT, {
    minY: 170,
    margin: 34,
    minGap: 10,
    attempts: 42,
  });
  assert.ok(Object.isFrozen(ITEM_PLACEMENT));
  assert.ok(Object.isFrozen(GoldMinerModules.LEVELS));
  assert.ok(Object.isFrozen(GoldMinerModules.LEVELS[0]));
  assert.ok(Object.isFrozen(GoldMinerModules.LEVELS[0].mix));
  assert.ok(Object.isFrozen(GoldMinerModules.ITEM_PLACEMENT));
  assert.equal(GoldMinerModules.LEVELS, LEVELS);
  assert.equal(GoldMinerModules.ITEM_PLACEMENT, ITEM_PLACEMENT);

  for (const key of [
    "getLevelConfig",
    "generateLevelData",
    "LEVELS",
    "ITEM_COUNT_SCALE",
    "ITEM_VALUE_SCALE",
    "LEVEL_VALUE_RANDOM_START_LEVEL",
    "LEVEL_VALUE_RANDOM_MIN",
    "LEVEL_VALUE_RANDOM_MAX",
    "MIN_LEVEL_TIME",
    "MAX_LEVEL_TIME",
    "TWO_PLAYER_TARGET_MULTIPLIER",
    "MARKET_SEED_SALT",
    "MOUSE_MIN_LEVEL",
    "MOUSE_MAX_PER_LEVEL",
    "MOUSE_CARGO_CHANCE",
    "MOUSE_SPEED_MIN",
    "MOUSE_SPEED_MAX",
    "ITEM_PLACEMENT",
  ]) {
    assert.ok(key in GoldMinerModules, `GoldMinerModules should expose ${key}`);
  }
});

test("level generator matches fixed seed baseline summary", () => {
  const levelData = generateLevelData(BASELINE_LEVEL_INPUT);

  assert.deepEqual(summarizeLevelData(levelData), BASELINE_LEVEL_SUMMARY);
  assert.deepEqual(levelData.config, getLevelConfig(1));
  assert.equal(levelData.levelTimeTotal, levelData.timeLeft);
  assert.equal(levelData.levelValueMultiplier, 1);
  assert.equal(levelData.items.every((item) => item.grabbed === false), true);
  assert.equal(levelData.items.every((item) => item.art && typeof item.art === "object"), true);
  assert.equal(GoldMinerModules.generateLevelData, generateLevelData);
});

test("level generator applies double mode target and extra bag spawns deterministically", () => {
  const input = { ...BASELINE_LEVEL_INPUT, mode: "double", extraBags: 2 };
  const levelData = generateLevelData(input);
  const repeated = generateLevelData(input);

  assert.deepEqual(summarizeLevelData(levelData), summarizeLevelData(repeated));
  assert.deepEqual(summarizeItems(levelData.items), summarizeItems(repeated.items));
  assert.equal(levelData.seed, BASELINE_LEVEL_SUMMARY.seed);
  assert.equal(levelData.target, Math.ceil(BASELINE_LEVEL_SUMMARY.target * TWO_PLAYER_TARGET_MULTIPLIER));
  assert.equal(levelData.timeLeft, BASELINE_LEVEL_SUMMARY.timeLeft);
  assert.equal(levelData.levelTimeTotal, levelData.timeLeft);
  assert.equal(levelData.items.length, BASELINE_LEVEL_SUMMARY.itemCount + 2);
  assert.equal(levelData.items.filter((item) => item.type === "bag").length, 3);
  assert.equal(levelData.items.every((item) => item.type !== "bag" || item.bagValue === item.value), true);
});

test("level generator rejects unsupported public input values", () => {
  assert.throws(
    () => generateLevelData(null),
    /options must be an object/,
  );
  for (const level of [undefined, 0, 1.5, Number.NaN]) {
    assert.throws(
      () => generateLevelData({ ...BASELINE_LEVEL_INPUT, level }),
      /level must be a positive integer/,
    );
  }
  for (const runSeed of [undefined, 1.5, Number.NaN]) {
    assert.throws(
      () => generateLevelData({ ...BASELINE_LEVEL_INPUT, runSeed }),
      /runSeed must be an integer/,
    );
  }
  assert.throws(
    () => generateLevelData({ ...BASELINE_LEVEL_INPUT, ddaRating: Number.NaN }),
    /ddaRating must be a finite number/,
  );
  assert.throws(
    () => generateLevelData({ ...BASELINE_LEVEL_INPUT, mode: "coop" }),
    /mode must be "single" or "double"/,
  );

  for (const extraBags of [-1, 1.5, Number.NaN]) {
    assert.throws(
      () => generateLevelData({ ...BASELINE_LEVEL_INPUT, extraBags }),
      /extraBags must be a non-negative integer/,
    );
  }
});

test("level generator rejects missing, non-finite, and undersized viewports", () => {
  const minWidth = (ITEM_PLACEMENT.margin + 40) * 2;
  const minHeight = ITEM_PLACEMENT.minY + ITEM_PLACEMENT.margin + 40 * 2;

  for (const viewport of [
    undefined,
    null,
    { w: Number.NaN, h: BASELINE_LEVEL_INPUT.viewport.h },
    { w: BASELINE_LEVEL_INPUT.viewport.w, h: Number.NaN },
    { w: minWidth - 1, h: minHeight },
    { w: minWidth, h: minHeight - 1 },
  ]) {
    assert.throws(
      () => generateLevelData({ ...BASELINE_LEVEL_INPUT, viewport }),
      /viewport/,
    );
  }
});

test("level generator keeps high-level value multiplier and mouse output deterministic", () => {
  const levelData = generateLevelData({
    level: 5,
    runSeed: 12345,
    viewport: BASELINE_LEVEL_INPUT.viewport,
    mode: "single",
    ddaRating: 0,
    extraBags: 0,
  });
  const mice = levelData.items.filter((item) => item.type === "mouse");
  const firstMouse = mice[0];

  assert.equal(levelData.seed, 18028);
  assert.equal(levelData.target, 3240);
  assert.equal(levelData.timeLeft, 49);
  assert.equal(roundTo(levelData.levelValueMultiplier, 3), 0.674);
  assert.equal(levelData.items.length, 26);
  assert.equal(mice.length, 2);
  assert.deepEqual({
    id: firstMouse.id,
    value: firstMouse.value,
    r: roundTo(firstMouse.r, 1),
    x: roundTo(firstMouse.x, 1),
    y: roundTo(firstMouse.y, 1),
    vx: roundTo(firstMouse.mouse.vx, 3),
    cargo: firstMouse.mouse.cargo,
    phase: roundTo(firstMouse.mouse.phase, 3),
  }, {
    id: 5,
    value: 72,
    r: 14.4,
    x: 132.2,
    y: 212.6,
    vx: 116.388,
    cargo: null,
    phase: 2.418,
  });
});

test("value helpers preserve runtime balance math", () => {
  assert.equal(scaleItemValue(100), 40);
  assert.equal(scaleItemValue(100, 0.5), 20);
  assert.deepEqual(bagValueRange(1), { min: 140, max: 860 });
  assert.deepEqual(bagValueRange(6), { min: 240, max: 1160 });

  const seededRng = createRng(97531);
  const expectedRng = createRng(97531);
  const levelValue = createLevelItemValue({
    rng: seededRng,
    levelValueMultiplier: 0.75,
    marketMultipliers: { bar: 1.25 },
  });
  const expectedRolledBarValue = Math.round(expectedRng.range(200, 400));
  assert.equal(levelValue(200, 400, "bar"), scaleItemValue(expectedRolledBarValue, 0.75 * 1.25));

  const missingMarketRng = createRng(24680);
  const expectedMissingMarketRng = createRng(24680);
  const missingMarketLevelValue = createLevelItemValue({
    rng: missingMarketRng,
    levelValueMultiplier: 0.5,
    marketMultipliers: { diamond: 2 },
  });
  const expectedRolledMissingMarketValue = Math.round(expectedMissingMarketRng.range(100, 140));
  assert.equal(
    missingMarketLevelValue(100, 140, "bar"),
    scaleItemValue(expectedRolledMissingMarketValue, 0.5),
  );

  for (const key of ["scaleItemValue", "bagValueRange", "createLevelItemValue"]) {
    assert.ok(key in GoldMinerModules, `GoldMinerModules should expose ${key}`);
  }
});

test("item factory creates runtime-shaped items and deterministic specs", () => {
  const item = makeItem({ id: 7, type: "gold", x: 10, y: 20, r: 12, value: 50, weight: 1 });
  assert.deepEqual(item, {
    id: 7,
    type: "gold",
    x: 10,
    y: 20,
    r: 12,
    value: 50,
    weight: 1,
    grabbed: false,
    bagValue: null,
    keg: null,
    mouse: null,
    art: null,
  });

  const rngA = createRng(13546);
  const rngB = createRng(13546);
  const context = {
    level: 1,
    rng: rngA,
    marketMultipliers: MARKET_MULTIPLIERS,
    levelValueMultiplier: 1,
    dda: { mouseSpeedMul: 1 },
  };
  const specA = createItemSpec({ ...context, type: "bar" });
  const specB = createItemSpec({
    ...context,
    rng: rngB,
    type: "bar",
  });

  assert.deepEqual(specA, specB);
  assert.equal(specA.type, "bar");
  assert.equal(specA.weight, 1.6);
  assert.equal(specA.value, 137);
  assert.equal(typeof specA.r, "number");
  assert.equal(typeof specA.value, "number");

  for (const key of ["intRange", "createItemArt", "createItemSpec", "makeItem"]) {
    assert.ok(key in GoldMinerModules, `GoldMinerModules should expose ${key}`);
  }
});

test("item factory rejects unknown item spec types", () => {
  assert.throws(
    () =>
      createItemSpec({
        level: 1,
        rng: createRng(123),
        marketMultipliers: MARKET_MULTIPLIERS,
        levelValueMultiplier: 1,
        dda: { mouseSpeedMul: 1 },
        type: "mystery",
      }),
    /Unknown item type: mystery/,
  );
});

test("item factory creates deterministic bag specs", () => {
  const [bagA, bagB] = createSpecTwice({
    seed: 24680,
    type: "bag",
    level: 6,
    levelValueMultiplier: 0.8,
  });

  assert.deepEqual(bagA, bagB);
  assert.equal(bagA.type, "bag");
  assert.equal(bagA.weight, 1.8);
  assert.ok(bagA.r >= 12 && bagA.r <= 18);
  assert.ok(bagA.value >= scaleItemValue(240, 0.8));
  assert.ok(bagA.value <= scaleItemValue(1160, 0.8));
});

test("item factory creates deterministic mouse specs with runtime-shaped mouse state", () => {
  const [mouseA, mouseB] = createSpecTwice({
    seed: 98765,
    type: "mouse",
    level: 6,
    dda: { mouseSpeedMul: 1.25 },
  });

  assert.deepEqual(mouseA, mouseB);
  assert.equal(mouseA.type, "mouse");
  assert.equal(mouseA.value, 84);
  assert.equal(mouseA.weight, 1.35);
  assert.equal(mouseA.mouse.vx, -160.33964813686907);
  assert.equal(mouseA.mouse.phase, 3.9058313820118427);
  assert.equal(mouseA.mouse.cargo, null);
  assert.ok(mouseA.r >= 14 && mouseA.r <= 18);
  assert.ok([1.35, 1.8, 2.25].includes(mouseA.weight));
  assert.ok(mouseA.value >= scaleItemValue(140));
  assert.ok(mouseA.value <= scaleItemValue(620, MARKET_MULTIPLIERS.diamond));
  assert.equal(typeof mouseA.mouse, "object");
  assert.ok(mouseA.mouse);
  assert.ok(["diamond", "bar", null].includes(mouseA.mouse.cargo));
  assert.equal(typeof mouseA.mouse.vx, "number");
  assert.ok(Math.abs(mouseA.mouse.vx) >= MOUSE_SPEED_MIN * 1.25);
  assert.ok(Math.abs(mouseA.mouse.vx) <= MOUSE_SPEED_MAX * 1.25);
  assert.equal(typeof mouseA.mouse.phase, "number");
  assert.ok(mouseA.mouse.phase >= 0 && mouseA.mouse.phase <= Math.PI * 2);
});

test("item factory creates deterministic gold specs for each size", () => {
  const cases = [
    { size: "small", seed: 1001, radius: [12, 18], weight: 1.0, value: [60, 120] },
    { size: "medium", seed: 1002, radius: [20, 26], weight: 2.0, value: [160, 260] },
    { size: "large", seed: 1003, radius: [30, 40], weight: 4.2, value: [320, 520] },
  ];

  for (const { size, seed, radius, weight, value } of cases) {
    const [goldA, goldB] = createSpecTwice({ seed, type: "gold", size });

    assert.deepEqual(goldA, goldB);
    assert.equal(goldA.type, "gold");
    assert.equal(goldA.weight, weight);
    assert.ok(goldA.r >= radius[0] && goldA.r <= radius[1], `${size} radius should match runtime range`);
    assert.ok(goldA.value >= scaleItemValue(value[0]), `${size} value should meet runtime minimum`);
    assert.ok(goldA.value <= scaleItemValue(value[1]), `${size} value should meet runtime maximum`);
  }
});

test("item art generation is deterministic for complex and gem item types", () => {
  const goldArt = createItemArt(
    makeItem({ id: 1, type: "gold", x: 0, y: 0, r: 12, value: 1, weight: 1 }),
    createRng(2222),
  );
  assert.equal(goldArt.rot, 3.618662145929061);
  assert.equal(goldArt.blob.length, 12);
  assert.deepEqual(goldArt.blob[0], { a: 3.8535494898840383, r: 0.8993324282672257 });
  assert.equal(goldArt.sparkles.length, 3);
  assert.deepEqual(goldArt.sparkles[0], {
    a: 5.769447366492261,
    d: 0.1861769136926159,
    s: 0.1537541333772242,
    p: 4.608848440031296,
  });
  assert.equal(goldArt.glint, 0.7626379285939038);

  const diamondArt = createItemArt(
    makeItem({ id: 2, type: "diamond", x: 0, y: 0, r: 10, value: 1, weight: 1 }),
    createRng(4444),
  );
  assert.deepEqual(diamondArt, {
    rot: 0.12124049883913887,
    twinkle: 2.308144044721278,
  });
});
