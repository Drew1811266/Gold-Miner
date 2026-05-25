import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

function readJson(path) {
  return JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"));
}

function assertOmittedClockAndViewportFields(value) {
  const forbiddenKeys = new Set([
    "coordinateSystem",
    "timeLeft",
    "pivot",
    "hookEnd",
    "angle",
    "length",
    "maxLength",
    "x",
    "y",
    "items",
    "itemCount",
  ]);

  function visit(node) {
    if (!node || typeof node !== "object") return;
    for (const [key, child] of Object.entries(node)) {
      assert.equal(forbiddenKeys.has(key), false, `stable baseline should omit ${key}`);
      visit(child);
    }
  }

  visit(value);
}

test("seed 12345 single-player baseline has expected high-level state", () => {
  const baseline = readJson("tests/baselines/seed-12345-initial-single.json");

  assert.equal(baseline.summaryType, "stable-baseline");
  assert.equal(baseline.phase, "playing");
  assert.equal(baseline.paused, false);
  assert.equal(baseline.mode, "single");
  assert.equal(baseline.level, 1);
  assert.equal(baseline.seed, 13546);
  assert.equal(baseline.score, 0);
  assert.equal(baseline.target, 650);
  assert.equal(baseline.hookCount, 1);
  assert.equal(Array.isArray(baseline.hooks), true);
  assert.deepEqual(baseline.hooks, [{ player: 1, state: "swing", attached: null }]);
  assertOmittedClockAndViewportFields(baseline);
});

test("seed 12345 post-advance baseline keeps same game and records advance amount", () => {
  const initial = readJson("tests/baselines/seed-12345-initial-single.json");
  const advanced = readJson("tests/baselines/seed-12345-after-advance-1000ms.json");
  const { advancedByMs, ...advancedStableSummary } = advanced;

  assert.equal(advanced.summaryType, "stable-baseline");
  assert.equal(advancedByMs, 1000);
  assert.equal(advanced.phase, "playing");
  assert.equal(advanced.paused, false);
  assert.equal(advanced.mode, "single");
  assert.equal(advanced.level, 1);
  assert.equal(advanced.seed, 13546);
  assert.deepEqual(advancedStableSummary, initial);
  assertOmittedClockAndViewportFields(advanced);
});

test("seed 12345 baseline records market and DDA fields", () => {
  const baseline = readJson("tests/baselines/seed-12345-initial-single.json");

  assert.deepEqual(baseline.market, {
    name: "淘金观望日",
    summary: "金条↑13%  钻石↑34%  祖母绿↓2%  红宝石↑11%  水晶簇↓7%",
    multipliers: {
      bar: 1.127,
      diamond: 1.344,
      emerald: 0.981,
      ruby: 1.109,
      crystal: 0.929,
    },
  });
  assert.deepEqual(baseline.dda, {
    stage: 0,
    rating: 0,
    post4Pressure: 0,
    difficulty: 0,
    targetMul: 1,
    timeMul: 1,
    lastOverRatio: 0,
    firstClearTimeLeft: null,
  });
});
