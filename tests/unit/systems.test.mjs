import { test } from "node:test";
import assert from "node:assert/strict";
import { createRng } from "../../src/core/rng.js";
import { createMarketDay, formatMarketDelta } from "../../src/systems/marketSystem.js";
import {
  computeDdaTuning,
  ddaBaseDifficulty,
  ddaOverSignal,
  ddaStage,
  postLevel4Pressure,
  updateDdaRating,
} from "../../src/systems/ddaSystem.js";

test("market delta formatter matches game display rules", () => {
  assert.equal(formatMarketDelta(1), "±0%");
  assert.equal(formatMarketDelta(1.13), "↑13%");
  assert.equal(formatMarketDelta(0.87), "↓13%");
});

test("market day is deterministic for fixed rng seed", () => {
  const a = createMarketDay(createRng(13546 ^ 0x51d7348d));
  const b = createMarketDay(createRng(13546 ^ 0x51d7348d));

  assert.deepEqual(a, b);
  assert.equal(typeof a.name, "string");
  assert.equal(typeof a.summary, "string");
  assert.equal(Object.keys(a.multipliers).length, 5);
});

test("DDA stage and pressure follow existing level thresholds", () => {
  assert.equal(ddaStage(1), 0);
  assert.equal(ddaStage(3), 0);
  assert.equal(ddaStage(4), 1);
  assert.equal(ddaBaseDifficulty(1), 0);
  assert.ok(postLevel4Pressure(4) === 0);
  assert.ok(postLevel4Pressure(5) > 0);
});

test("DDA over signal clamps under and over performance", () => {
  assert.equal(ddaOverSignal(0), 0);
  assert.equal(ddaOverSignal(0.35), 1);
  assert.equal(ddaOverSignal(1), 1);
  assert.equal(ddaOverSignal(-1), -1);
});

test("DDA tuning increases target pressure for high rating", () => {
  const easy = computeDdaTuning(6, -0.5);
  const hard = computeDdaTuning(6, 0.8);

  assert.ok(hard.targetMul > easy.targetMul);
  assert.ok(hard.timeMul < easy.timeMul);
  assert.ok(hard.mixMul("rock") >= easy.mixMul("rock"));
  assert.ok(hard.mixMul("diamond") <= easy.mixMul("diamond"));
});

test("DDA rating update records over ratio and signal", () => {
  const result = updateDdaRating({
    currentRating: 0,
    score: 1300,
    target: 1000,
    levelTimeTotal: 60,
    firstClearTimeLeft: 30,
  });

  assert.ok(result.rating > 0);
  assert.equal(Math.round(result.lastOverRatio * 100) / 100, 0.3);
  assert.ok(result.lastSignal > 0);
});
