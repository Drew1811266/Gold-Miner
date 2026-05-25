import { test } from "node:test";
import assert from "node:assert/strict";
import { createDeliveryResult } from "../../src/systems/scoringSystem.js";

function deliveryFor(item, overrides = {}) {
  return createDeliveryResult({
    score: 100,
    item: { value: 25, r: 9, ...item },
    playerIndex: 0,
    ...overrides,
  });
}

test("createDeliveryResult returns score, audio, score pop, ring, and burst data", () => {
  const result = createDeliveryResult({
    score: 100,
    item: { type: "gold", value: 50, r: 9 },
    playerIndex: 1,
  });

  assert.deepEqual(result, {
    earned: 50,
    nextScore: 150,
    color: "#ffd34d",
    playerIndex: 1,
    scorePopPayload: { amount: 50, color: "#ffd34d", player: 1 },
    scoreAudioPayload: { amount: 50 },
    ringPayload: {
      r0: 10,
      r1: 54,
      life: 0.55,
      color: "#ffd34d",
      width: 3,
      yOffset: 18,
    },
    burstPayload: {
      yOffset: 18,
      count: 13,
      colors: ["#ffd34d", "#ffffff", "#ffe08a"],
      speedMin: 80,
      speedMax: 220,
      sizeMin: 1.2,
      sizeMax: 3.6,
      lifeMin: 0.35,
      lifeMax: 0.7,
      gravity: 520,
    },
  });
});

test("createDeliveryResult uses bagValue for bags and falls back to value", () => {
  assert.equal(deliveryFor({ type: "bag", value: 120, bagValue: 450 }).earned, 450);
  assert.equal(deliveryFor({ type: "bag", value: 120 }).earned, 120);
});

test("createDeliveryResult uses value for non-bag items", () => {
  assert.equal(deliveryFor({ type: "diamond", value: 700, bagValue: 10 }).earned, 700);
  assert.equal(deliveryFor({ type: "diamond", value: 700 }, { score: 30 }).nextScore, 730);
});

test("createDeliveryResult preserves the provided player index", () => {
  const result = deliveryFor({ type: "ruby" }, { playerIndex: 2 });

  assert.equal(result.playerIndex, 2);
  assert.equal(result.scorePopPayload.player, 2);
});

test("createDeliveryResult mirrors legacy item FX colors", () => {
  const cases = [
    [{ type: "mouse", mouse: { cargo: "diamond" } }, "#8fe9ff"],
    [{ type: "mouse", mouse: { cargo: "bar" } }, "#ffd34d"],
    [{ type: "mouse", mouse: { cargo: "ruby" } }, "#c8cdd8"],
    [{ type: "diamond" }, "#8fe9ff"],
    [{ type: "emerald" }, "#34e28a"],
    [{ type: "ruby" }, "#ff4d6d"],
    [{ type: "crystal" }, "#a6f6ff"],
    [{ type: "rock" }, "#a7b0ba"],
    [{ type: "fossil" }, "#e7d3a5"],
    [{ type: "bag" }, "#b07bff"],
    [{ type: "pouch" }, "#ffd34d"],
    [{ type: "keg" }, "#ff6b5a"],
    [{ type: "bar" }, "#ffd34d"],
    [{ type: "gold" }, "#ffd34d"],
    [{ type: "unknown" }, "#ffd34d"],
  ];

  for (const [item, color] of cases) {
    const result = deliveryFor(item);
    assert.equal(result.color, color, `${item.type} should use ${color}`);
    assert.equal(result.scorePopPayload.color, color);
    assert.deepEqual(result.burstPayload.colors, [color, "#ffffff", "#ffe08a"]);
  }
});

test("createDeliveryResult clamps burst count to legacy bounds", () => {
  assert.equal(deliveryFor({ type: "gold", r: 0 }).burstPayload.count, 10);
  assert.equal(deliveryFor({ type: "gold", r: 999 }).burstPayload.count, 18);
});

test("createDeliveryResult does not mutate the delivered item", () => {
  const item = Object.freeze({
    type: "mouse",
    value: 80,
    r: 12,
    mouse: Object.freeze({ cargo: "bar" }),
  });
  const before = structuredClone(item);

  createDeliveryResult({ score: 0, item, playerIndex: 0 });

  assert.deepEqual(item, before);
});

test("createDeliveryResult validates required inputs", () => {
  assert.throws(() => createDeliveryResult(null), /options must be an object/);
  assert.throws(
    () => createDeliveryResult({ score: Number.NaN, item: { type: "gold", value: 1, r: 1 }, playerIndex: 0 }),
    /score must be a finite number/,
  );
  assert.throws(() => createDeliveryResult({ score: 0, item: null, playerIndex: 0 }), /item must be an object/);
  assert.throws(
    () => createDeliveryResult({ score: 0, item: { value: 1, r: 1 }, playerIndex: 0 }),
    /item\.type must be a string/,
  );
  assert.throws(
    () => createDeliveryResult({ score: 0, item: { type: "gold", value: "1", r: 1 }, playerIndex: 0 }),
    /item\.value must be a finite number/,
  );
  assert.throws(
    () => createDeliveryResult({ score: 0, item: { type: "bag", value: 1, bagValue: "5", r: 1 }, playerIndex: 0 }),
    /item\.bagValue must be a finite number/,
  );
  assert.throws(
    () => createDeliveryResult({ score: 0, item: { type: "gold", value: 1, r: Number.NaN }, playerIndex: 0 }),
    /item\.r must be a finite number/,
  );
  assert.throws(
    () => createDeliveryResult({ score: 0, item: { type: "gold", value: 1, r: 1 }, playerIndex: 0.5 }),
    /playerIndex must be an integer/,
  );
});
