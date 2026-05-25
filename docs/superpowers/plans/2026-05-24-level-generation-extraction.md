# Level Generation Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract Gold Miner's level configuration, item specification, value calculation, and deterministic placement generation into tested ES modules, then wire `game.js` to consume the pure generator through the Batch 2 runtime bridge.

**Architecture:** Keep the current classic runtime entry (`audio.js` + `game.js`) and the Batch 2 dynamic bridge. Build pure data modules under `src/config/` and `src/systems/`, expose them through `src/runtime/moduleBridge.js`, and make `game.js` use `GoldMinerModules.generateLevelData()` when available while retaining legacy fallback logic for direct file launch.

**Tech Stack:** Browser JavaScript, ES modules, Node built-in test runner, Canvas 2D runtime host, deterministic RNG, Playwright/browser smoke verification.

---

## Batch Boundary

This is Batch 3 after Runtime Module Bridge.

This batch should:

- Extract static level configuration into `src/config/levels.js`.
- Extract item-related constants into `src/config/items.js`.
- Extract value helpers into `src/systems/valueSystem.js`.
- Extract item data/art/spec creation into `src/systems/itemFactory.js`.
- Extract deterministic level generation into `src/systems/levelGenerator.js`.
- Expose the new modules through `src/runtime/moduleBridge.js`.
- Convert `game.js` `generateLevel()` to prefer `GoldMinerModules.generateLevelData()`.
- Keep rendering, input, UI, audio, scene rendering, and hook systems in `game.js`.

This batch must not:

- Switch `index.html` to `src/main.js`.
- Delete all legacy generation code from `game.js`; fallbacks remain until a later cleanup batch.
- Change gameplay rules, item values, item counts, placement attempts, market salt, DDA formulas, or UI copy.
- Move Canvas drawing code.
- Move DOM input or HUD update logic.

---

## Fixed Runtime Baseline For This Batch

Use this fixed seed and viewport as the exact behavior target for pure generation tests:

```js
const BASELINE_LEVEL_INPUT = {
  level: 1,
  runSeed: 12345,
  viewport: { w: 1100, h: 572 },
  mode: "single",
  ddaRating: 0,
  extraBags: 0,
};
```

Expected stable summary from the current runtime before Batch 3 extraction:

```js
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
```

The runtime `render_game_to_text()` clock may show `59.xx` because the animation loop is running. The pure generator should return the initial level clock before frames advance: `timeLeft: 60`.

---

## Task 1: Extract Level And Item Configuration

**Files:**

- Create: `src/config/levels.js`
- Create: `src/config/items.js`
- Modify: `src/runtime/moduleBridge.js`
- Test: `tests/unit/level-generator.test.mjs`

### Steps

- [ ] **Step 1: Create tests for level config and item constants**

Create `tests/unit/level-generator.test.mjs` with:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ITEM_COUNT_SCALE,
  ITEM_VALUE_SCALE,
  LEVEL_VALUE_RANDOM_MAX,
  LEVEL_VALUE_RANDOM_MIN,
  LEVEL_VALUE_RANDOM_START_LEVEL,
  MOUSE_MAX_PER_LEVEL,
  MOUSE_MIN_LEVEL,
} from "../../src/config/items.js";
import { getLevelConfig, LEVELS } from "../../src/config/levels.js";

test("level config preserves authored presets and generated fallback", () => {
  assert.equal(LEVELS.length, 6);

  const first = getLevelConfig(1);
  assert.deepEqual(first, {
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
  });

  const generated = getLevelConfig(7);
  assert.equal(generated.target, 3350);
  assert.equal(generated.time, 50);
  assert.equal(generated.seed, 15979);
  assert.equal(generated.mix.goldSmall, 13);
  assert.equal(generated.mix.ruby, 1);
  assert.equal(generated.mix.keg, 1);
});

test("item balance constants match current runtime values", () => {
  assert.equal(ITEM_COUNT_SCALE, 0.55);
  assert.equal(ITEM_VALUE_SCALE, 0.4);
  assert.equal(LEVEL_VALUE_RANDOM_START_LEVEL, 4);
  assert.equal(LEVEL_VALUE_RANDOM_MIN, 0.5);
  assert.equal(LEVEL_VALUE_RANDOM_MAX, 0.8);
  assert.equal(MOUSE_MIN_LEVEL, 5);
  assert.equal(MOUSE_MAX_PER_LEVEL, 4);
});
```

- [ ] **Step 2: Run targeted test and verify it fails**

Run:

```bash
node --test tests/unit/level-generator.test.mjs
```

Expected:

- FAIL because `src/config/levels.js` and `src/config/items.js` do not exist yet.

- [ ] **Step 3: Create `src/config/items.js`**

Create constants matching current `game.js` values:

```js
export const ITEM_COUNT_SCALE = 0.55;
export const ITEM_VALUE_SCALE = 0.4;
export const LEVEL_VALUE_RANDOM_START_LEVEL = 4;
export const LEVEL_VALUE_RANDOM_MIN = 0.5;
export const LEVEL_VALUE_RANDOM_MAX = 0.8;

export const MIN_LEVEL_TIME = 45;
export const MAX_LEVEL_TIME = 90;
export const TWO_PLAYER_TARGET_MULTIPLIER = 1.3;
export const MARKET_SEED_SALT = 0x51d7348d;

export const MOUSE_MIN_LEVEL = 5;
export const MOUSE_MAX_PER_LEVEL = 4;
export const MOUSE_CARGO_CHANCE = 0.3;
export const MOUSE_SPEED_MIN = 70;
export const MOUSE_SPEED_MAX = 150;

export const ITEM_PLACEMENT = Object.freeze({
  minY: 170,
  margin: 34,
  minGap: 10,
  attempts: 42,
});
```

- [ ] **Step 4: Create `src/config/levels.js`**

Move the current `LEVELS` array and `getLevelConfig(level)` fallback logic from `game.js` into this module.

Requirements:

- Export `LEVELS`.
- Export `getLevelConfig(level)`.
- Return cloned config objects so tests and callers cannot mutate shared presets.
- Preserve the exact fallback formula:
  - `target = 650 + (level - 1) * 450`
  - `time = clamp(62 - (level - 1) * 2, 42, 62)`
  - `seed = 9000 + level * 997`
  - same `mix` formula as current `game.js`.

Implementation pattern:

```js
import { clamp } from "../core/geometry.js";

const cloneConfig = (config) => ({
  target: config.target,
  time: config.time,
  seed: config.seed,
  mix: { ...config.mix },
});

export const LEVELS = Object.freeze([
  // Copy the six existing preset objects from game.js exactly.
]);

export function getLevelConfig(level) {
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  const preset = LEVELS[lv - 1];
  if (preset) return cloneConfig(preset);

  const baseTarget = 650;
  const delta = 450;
  const time = clamp(62 - (lv - 1) * 2, 42, 62);
  const mix = {
    goldSmall: 6 + lv,
    goldMedium: 4 + Math.floor(lv / 2),
    goldLarge: 2 + Math.floor(lv / 3),
    rock: 4 + Math.floor(lv / 2),
    diamond: 1 + Math.floor(lv / 4),
    bag: 2 + Math.floor(lv / 3),
    bar: 1 + Math.floor(lv / 3),
    crystal: 1 + Math.floor(lv / 4),
    pouch: lv >= 2 ? 1 + Math.floor(lv / 6) : 0,
    fossil: lv >= 2 ? 1 + Math.floor(lv / 5) : 0,
    emerald: lv >= 3 ? 1 : 0,
    ruby: lv >= 4 ? 1 : 0,
    keg: lv >= 2 ? 1 : 0,
  };

  return { target: baseTarget + (lv - 1) * delta, time, seed: 9000 + lv * 997, mix };
}
```

- [ ] **Step 5: Expose config through bridge**

Modify `src/runtime/moduleBridge.js`:

```js
import {
  ITEM_COUNT_SCALE,
  ITEM_VALUE_SCALE,
  LEVEL_VALUE_RANDOM_MAX,
  LEVEL_VALUE_RANDOM_MIN,
  LEVEL_VALUE_RANDOM_START_LEVEL,
  MARKET_SEED_SALT,
  MAX_LEVEL_TIME,
  MIN_LEVEL_TIME,
  MOUSE_MAX_PER_LEVEL,
  MOUSE_MIN_LEVEL,
  TWO_PLAYER_TARGET_MULTIPLIER,
} from "../config/items.js";
import { getLevelConfig } from "../config/levels.js";
```

Add those names to `GoldMinerModules`.

- [ ] **Step 6: Run verification**

Run:

```bash
node --test tests/unit/level-generator.test.mjs
npm run verify
```

Expected:

- New test passes.
- Full verification passes.

---

## Task 2: Extract Value And Item Factory Modules

**Files:**

- Create: `src/systems/valueSystem.js`
- Create: `src/systems/itemFactory.js`
- Modify: `src/runtime/moduleBridge.js`
- Test: `tests/unit/level-generator.test.mjs`

### Steps

- [ ] **Step 1: Extend unit tests for values and item specs**

Append to `tests/unit/level-generator.test.mjs`:

```js
import { createRng } from "../../src/core/rng.js";
import { createItemSpec, makeItem } from "../../src/systems/itemFactory.js";
import { bagValueRange, scaleItemValue } from "../../src/systems/valueSystem.js";

test("value helpers preserve runtime balance math", () => {
  assert.equal(scaleItemValue(100), 40);
  assert.equal(scaleItemValue(100, 0.5), 20);
  assert.deepEqual(bagValueRange(1), { min: 140, max: 860 });
  assert.deepEqual(bagValueRange(6), { min: 240, max: 1160 });
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
    marketMultipliers: { bar: 1.127, diamond: 1.344, emerald: 0.981, ruby: 1.109, crystal: 0.929 },
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
  assert.equal(typeof specA.r, "number");
  assert.equal(typeof specA.value, "number");
});
```

- [ ] **Step 2: Run targeted test and verify it fails**

Run:

```bash
node --test tests/unit/level-generator.test.mjs
```

Expected:

- FAIL because `valueSystem.js` and `itemFactory.js` do not exist yet.

- [ ] **Step 3: Create `src/systems/valueSystem.js`**

Create:

```js
import { ITEM_VALUE_SCALE } from "../config/items.js";

export function scaleItemValue(value, extraMultiplier = 1) {
  return Math.max(0, Math.round(value * ITEM_VALUE_SCALE * extraMultiplier));
}

export function bagValueRange(level) {
  const min = 120 + level * 20;
  const max = 800 + level * 60;
  return { min, max };
}

export function createLevelItemValue({ rng, levelValueMultiplier, marketMultipliers }) {
  return (min, max, marketKey = null) => {
    const marketMultiplier =
      marketKey && Number.isFinite(marketMultipliers?.[marketKey]) ? marketMultipliers[marketKey] : 1;
    return scaleItemValue(Math.round(rng.range(min, max)), levelValueMultiplier * marketMultiplier);
  };
}
```

- [ ] **Step 4: Create `src/systems/itemFactory.js`**

Move these pure helpers from `game.js`:

- `intRange`
- `makeBlob`
- `createItemArt`
- `makeItem`
- `buildSpec` as exported `createItemSpec({ type, size, level, rng, marketMultipliers, levelValueMultiplier, dda })`

Use current `game.js` logic exactly for:

- gold small/medium/large ranges
- rock, diamond, bag, bar, emerald, ruby, crystal, pouch, keg, fossil, mouse values and weights
- mouse cargo chance/speed/phase
- art shape generation

Implementation requirements:

- Import item constants from `src/config/items.js`.
- Import `bagValueRange` and `createLevelItemValue` from `src/systems/valueSystem.js`.
- `createItemSpec` must return the same spec shape current `buildSpec()` returned.
- `makeItem` must return the exact runtime item shape expected by rendering and collisions.
- `createItemArt(item, rng)` must not access DOM, Canvas, `window`, or `game`.

- [ ] **Step 5: Expose value and item helpers through bridge**

Modify `src/runtime/moduleBridge.js` to import and expose:

```js
import { createItemArt, createItemSpec, intRange, makeItem } from "../systems/itemFactory.js";
import { bagValueRange, createLevelItemValue, scaleItemValue } from "../systems/valueSystem.js";
```

Add these names to `GoldMinerModules`.

- [ ] **Step 6: Run verification**

Run:

```bash
node --test tests/unit/level-generator.test.mjs
npm run verify
```

Expected:

- New tests pass.
- Full verification passes.

---

## Task 3: Extract Pure Level Generator

**Files:**

- Create: `src/systems/levelGenerator.js`
- Modify: `src/runtime/moduleBridge.js`
- Test: `tests/unit/level-generator.test.mjs`

### Steps

- [ ] **Step 1: Add tests for deterministic `generateLevelData()`**

Append to `tests/unit/level-generator.test.mjs`:

```js
import { generateLevelData } from "../../src/systems/levelGenerator.js";

const summarizeGeneratedItems = (items) =>
  items.slice(0, 8).map(({ id, type, x, y, r, value }) => ({
    id,
    type,
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
    r: Math.round(r * 10) / 10,
    value,
  }));

test("generateLevelData matches current fixed-seed single-player baseline", () => {
  const result = generateLevelData({
    level: 1,
    runSeed: 12345,
    viewport: { w: 1100, h: 572 },
    mode: "single",
    ddaRating: 0,
    extraBags: 0,
  });

  assert.equal(result.seed, 13546);
  assert.equal(result.target, 650);
  assert.equal(result.timeLeft, 60);
  assert.equal(result.levelTimeTotal, 60);
  assert.equal(result.market.name, "淘金观望日");
  assert.equal(result.market.summary, "金条↑13%  钻石↑34%  祖母绿↓2%  红宝石↑11%  水晶簇↓7%");
  assert.deepEqual(
    Object.fromEntries(Object.entries(result.market.multipliers).map(([key, value]) => [key, Math.round(value * 1000) / 1000])),
    { bar: 1.127, diamond: 1.344, emerald: 0.981, ruby: 1.109, crystal: 0.929 },
  );
  assert.equal(result.dda.stage, 0);
  assert.equal(result.dda.rating, 0);
  assert.equal(result.dda.targetMul, 1);
  assert.equal(result.items.length, 14);
  assert.deepEqual(summarizeGeneratedItems(result.items), [
    { id: 1, type: "rock", x: 341.1, y: 288.6, r: 25.2, value: 20 },
    { id: 2, type: "rock", x: 742.3, y: 304.5, r: 19.3, value: 21 },
    { id: 3, type: "gold", x: 852.0, y: 366.7, r: 16.2, value: 25 },
    { id: 4, type: "gold", x: 485.7, y: 322.6, r: 15.4, value: 41 },
    { id: 5, type: "fossil", x: 901.8, y: 288.8, r: 21.9, value: 196 },
    { id: 6, type: "gold", x: 305.2, y: 464.3, r: 38.7, value: 156 },
    { id: 7, type: "crystal", x: 65.7, y: 198.1, r: 21.3, value: 71 },
    { id: 8, type: "gold", x: 932.9, y: 206.6, r: 25.4, value: 99 },
  ]);
});

test("generateLevelData applies two-player target and extra bags without side effects", () => {
  const single = generateLevelData({
    level: 1,
    runSeed: 12345,
    viewport: { w: 1100, h: 572 },
    mode: "single",
    ddaRating: 0,
    extraBags: 0,
  });
  const double = generateLevelData({
    level: 1,
    runSeed: 12345,
    viewport: { w: 1100, h: 572 },
    mode: "double",
    ddaRating: 0,
    extraBags: 1,
  });

  assert.equal(double.target, Math.ceil(650 * 1.3));
  assert.ok(double.items.length >= single.items.length);
  assert.equal(typeof double.dda.mixMul, "function");
});
```

- [ ] **Step 2: Run targeted test and verify it fails**

Run:

```bash
node --test tests/unit/level-generator.test.mjs
```

Expected:

- FAIL because `src/systems/levelGenerator.js` does not exist yet.

- [ ] **Step 3: Create `src/systems/levelGenerator.js`**

Create a pure module with this API:

```js
export function generateLevelData({
  level,
  runSeed,
  viewport,
  mode = "single",
  ddaRating = 0,
  extraBags = 0,
}) {}
```

Implementation rules:

- Use `getLevelConfig(level)`.
- Use `computeDdaTuning(level, ddaRating)`.
- Use `createRng(seed)` where `seed = (config.seed ?? 0) + runSeed`.
- Use market RNG `createRng((seed ^ MARKET_SEED_SALT) >>> 0)`.
- Use `createMarketDay(marketRng)`.
- Use `levelValueMultiplier = level >= LEVEL_VALUE_RANDOM_START_LEVEL ? rng.range(LEVEL_VALUE_RANDOM_MIN, LEVEL_VALUE_RANDOM_MAX) : 1`.
- Use same `scaledCount` logic:

```js
const scaledCount = (count, key) => Math.max(0, Math.round((count ?? 0) * ITEM_COUNT_SCALE * mixMul(key)));
```

- Push spawn specs in the same order as current `game.js`.
- Include mouse specs only when `level >= MOUSE_MIN_LEVEL`.
- Shuffle with the same Fisher-Yates loop.
- Place each item with the same `ITEM_PLACEMENT.margin`, `minY`, `minGap`, and `attempts`.
- Increment and decrement `nextId` the same way current `game.js` does.
- Attach `item.art = createItemArt(item, rng)` before placement check, matching current RNG consumption.
- Return:

```js
{
  config,
  dda,
  seed,
  target,
  timeLeft,
  levelTimeTotal: timeLeft,
  market,
  levelValueMultiplier,
  items,
}
```

- [ ] **Step 4: Expose generator through bridge**

Modify `src/runtime/moduleBridge.js`:

```js
import { generateLevelData } from "../systems/levelGenerator.js";
```

Add `generateLevelData` to `GoldMinerModules`.

- [ ] **Step 5: Run verification**

Run:

```bash
node --test tests/unit/level-generator.test.mjs
npm run verify
```

Expected:

- New generator tests pass.
- Full verification passes.

---

## Task 4: Wire Runtime `game.js` To `generateLevelData()`

**Files:**

- Modify: `game.js`
- Modify: `tests/unit/source-invariants.test.mjs`

### Steps

- [ ] **Step 1: Add source invariant for generator runtime bridge**

Append to `tests/unit/source-invariants.test.mjs`:

```js
test("game level generation prefers runtime bridge data generator", () => {
  const source = read("game.js");

  assert.match(source, /GoldMinerModules\.generateLevelData/);
  assert.match(source, /applyGeneratedLevelData\(levelData\)/);
  assert.match(source, /function applyGeneratedLevelData\(levelData\)/);
});
```

Also extend the existing wrapper list to include:

```js
"generateLevelData",
"getLevelConfig",
"scaleItemValue",
```

if `game.js` uses those wrappers directly.

- [ ] **Step 2: Run targeted test and verify it fails**

Run:

```bash
node --test tests/unit/source-invariants.test.mjs
```

Expected:

- FAIL because runtime has not been wired yet.

- [ ] **Step 3: Add `applyGeneratedLevelData(levelData)` to `game.js`**

Place it near `generateLevel()`:

```js
function applyGeneratedLevelData(levelData) {
  game.dda.stage = levelData.dda.stage;
  game.dda.base = levelData.dda.base;
  game.dda.post4Pressure = levelData.dda.post4Pressure;
  game.dda.difficulty = levelData.dda.difficulty;
  game.dda.targetMul = levelData.dda.targetMul;
  game.dda.timeMul = levelData.dda.timeMul;

  game.target = levelData.target;
  game.timeLeft = levelData.timeLeft;
  game.dda.levelTimeTotal = levelData.levelTimeTotal;
  game.currentSeed = levelData.seed;
  game.market = levelData.market;
  game.items = levelData.items;
}
```

- [ ] **Step 4: Make `generateLevel()` prefer module data**

At the beginning of `generateLevel(level, options = {})`, add:

```js
  if (GoldMinerModules.generateLevelData) {
    const levelData = GoldMinerModules.generateLevelData({
      level,
      runSeed: game.runSeed,
      viewport: game.viewport,
      mode: game.mode,
      ddaRating: game.dda?.rating ?? 0,
      extraBags: options.extraBags ?? 0,
    });
    applyGeneratedLevelData(levelData);
    window.GameAudio?.setTrackFromSeed?.(levelData.seed);
    syncAudioButtons();
    game.bgIndex = pickBackgroundIndex(levelData.seed, game.bgIndex);
    buildScene(levelData.seed);
    recalcHookMaxLength();
    for (const hook of getHooks()) resetHook(hook);
    return;
  }
```

Leave the legacy body after that as fallback.

- [ ] **Step 5: Make legacy wrappers prefer bridge for config/value helpers where useful**

Update local helpers:

```js
function getLevelConfig(level) {
  if (GoldMinerModules.getLevelConfig) return GoldMinerModules.getLevelConfig(level);
  // existing fallback body
}

function scaleItemValue(value, extraMultiplier = 1) {
  if (GoldMinerModules.scaleItemValue) return GoldMinerModules.scaleItemValue(value, extraMultiplier);
  return Math.max(0, Math.round(value * ITEM_VALUE_SCALE * extraMultiplier));
}
```

- [ ] **Step 6: Run verification**

Run:

```bash
node --check game.js
node --test tests/unit/source-invariants.test.mjs
npm run verify
```

Expected:

- All pass.

---

## Task 5: Runtime Smoke And Documentation

**Files:**

- Modify: `docs/architecture-optimization-plan.md`
- Modify: `docs/superpowers/plans/2026-05-24-architecture-next-batches.md`
- Optional: update `progress.md`

### Steps

- [ ] **Step 1: Run browser smoke**

Start a static server:

```bash
python3 -m http.server 8765
```

Open:

```text
http://127.0.0.1:8765/index.html?seed=12345
```

Evaluate after starting single-player:

```js
const payload = JSON.parse(window.render_game_to_text());
({
  ready: window.__goldMinerModulesReady,
  phase: payload.phase,
  mode: payload.mode,
  seed: payload.seed,
  target: payload.target,
  itemCount: payload.items.length,
  hasGenerateLevelData: typeof window.GoldMinerModules?.generateLevelData === "function",
});
```

Expected:

```js
{
  ready: true,
  phase: "playing",
  mode: "single",
  seed: 13546,
  target: 650,
  itemCount: 14,
  hasGenerateLevelData: true,
}
```

Stop the static server after the smoke test.

- [ ] **Step 2: Update architecture docs**

In `docs/architecture-optimization-plan.md`, add Batch 3 under implementation records:

```markdown
### Batch 3：Level And Item Generation Extraction

状态：已完成。

目标：

- 抽离关卡配置、物品规格、价值计算和确定性摆放生成。
- 让运行时 `game.js` 通过 `GoldMinerModules.generateLevelData()` 消费纯数据生成器。
- 保留 classic entry、渲染、输入、HUD、音频和场景绘制在当前 runtime host。

完成内容：

- 新增 `src/config/levels.js` 与 `src/config/items.js`。
- 新增 `src/systems/valueSystem.js`、`src/systems/itemFactory.js`、`src/systems/levelGenerator.js`。
- `src/runtime/moduleBridge.js` 暴露 `generateLevelData()` 和相关 config/value/item helpers。
- `game.js` 的 `generateLevel()` 优先应用 `generateLevelData()` 返回的数据，legacy body 保留为 fallback。
- 固定 seed + 固定 viewport 的纯单元测试覆盖了首关 target/time/market/DDA/item 摘要。

边界：

- 未拆渲染、输入、HUD、音频和 scene 生成。
- 未切换到 `src/main.js`。
- 未删除 legacy fallback 生成逻辑。

后续风险：

- Batch 4 应继续引入 state/command boundary，减少 `game.js` 对全局 mutable state 的直接写入。
- 后续测试应补充 dynamic import 失败时的 fallback 集成场景。
```

- [ ] **Step 3: Update next-batches plan**

In `docs/superpowers/plans/2026-05-24-architecture-next-batches.md`:

- Mark Batch 3 as `Completed`.
- Make Batch 4 state/command boundary the next recommended batch.
- Keep Batch 5-8 order unchanged.

- [ ] **Step 4: Update `progress.md`**

Append a short note:

```markdown
- 架构 Batch 3：关卡配置、物品规格、价值计算和关卡生成已抽离为纯模块；运行时通过 `GoldMinerModules.generateLevelData()` 接入，classic entry 保持不变。
```

- [ ] **Step 5: Run final verification**

Run:

```bash
npm run verify
./macos/build.command
test -f "dist/macos/黄金矿工.app/Contents/Resources/src/systems/levelGenerator.js"
```

Expected:

- Tests pass.
- macOS app builds.
- `levelGenerator.js` exists in app bundle resources.

---

## Final Review Requirements

After all tasks:

- Dispatch final code-reviewer subagent for the whole Batch 3 implementation.
- Verify no P0/P1 issues.
- Run final local verification:

```bash
npm run verify
./macos/build.command
```

- Report any remaining P2 items as follow-up, not as hidden debt.
