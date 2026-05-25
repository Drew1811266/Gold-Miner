import { test } from "node:test";
import assert from "node:assert/strict";
import { clamp, dist2, lerp, segmentCircleIntersect } from "../../src/core/geometry.js";
import { createRng } from "../../src/core/rng.js";

test("geometry helpers match existing game math", () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
  assert.equal(clamp(2, 0, 3), 2);
  assert.equal(lerp(10, 20, 0.25), 12.5);
  assert.equal(dist2(0, 0, 3, 4), 25);
});

test("segment-circle intersection handles hit, miss, and zero-length segment", () => {
  assert.equal(segmentCircleIntersect(0, 0, 10, 0, 5, 2, 2), true);
  assert.equal(segmentCircleIntersect(0, 0, 10, 0, 5, 3, 2), false);
  assert.equal(segmentCircleIntersect(1, 1, 1, 1, 2, 1, 1), true);
  assert.equal(segmentCircleIntersect(1, 1, 1, 1, 3.1, 1, 1), false);
});

test("rng is deterministic for same seed", () => {
  const a = createRng(12345);
  const b = createRng(12345);
  const seqA = [a.next(), a.next(), a.next(), a.next(), a.next()];
  const seqB = [b.next(), b.next(), b.next(), b.next(), b.next()];

  assert.deepEqual(seqA, seqB);
});

test("rng range and pick are bounded", () => {
  const rng = createRng(7);
  for (let i = 0; i < 20; i += 1) {
    const value = rng.range(10, 20);
    assert.ok(value >= 10);
    assert.ok(value <= 20);
  }

  const pick = rng.pick(["a", "b", "c"]);
  assert.ok(["a", "b", "c"].includes(pick));
});
