import { test } from "node:test";
import assert from "node:assert/strict";
import { drawHookTrailLayer } from "../../src/render/hookTrailRenderer.js";

function createFakeCtx() {
  const calls = [];

  return {
    calls,
    save() {
      calls.push(["save"]);
    },
    restore() {
      calls.push(["restore"]);
    },
    beginPath() {
      calls.push(["beginPath"]);
    },
    moveTo(...args) {
      calls.push(["moveTo", ...args]);
    },
    lineTo(...args) {
      calls.push(["lineTo", ...args]);
    },
    stroke() {
      calls.push(["stroke"]);
    },
    set globalCompositeOperation(value) {
      calls.push(["globalCompositeOperation", value]);
    },
    set lineCap(value) {
      calls.push(["lineCap", value]);
    },
    set lineJoin(value) {
      calls.push(["lineJoin", value]);
    },
    set globalAlpha(value) {
      calls.push(["globalAlpha", value]);
    },
    set strokeStyle(value) {
      calls.push(["strokeStyle", value]);
    },
    set lineWidth(value) {
      calls.push(["lineWidth", value]);
    },
  };
}

test("drawHookTrailLayer draws glow and highlight strokes for each segment", () => {
  const ctx = createFakeCtx();
  const trail = [
    { x: 10, y: 20, age: 0 },
    { x: 14, y: 24, age: 0.1 },
    { x: 20, y: 30, age: 0.2 },
  ];

  const segments = drawHookTrailLayer({
    ctx,
    trail,
    color: "#ffcc00",
    life: 0.5,
  });

  assert.equal(segments, 2);
  assert.equal(ctx.calls[0][0], "save");
  assert.ok(ctx.calls.some((call) => call[0] === "globalCompositeOperation" && call[1] === "lighter"));
  assert.ok(ctx.calls.some((call) => call[0] === "lineCap" && call[1] === "round"));
  assert.ok(ctx.calls.some((call) => call[0] === "lineJoin" && call[1] === "round"));
  assert.equal(ctx.calls.filter((call) => call[0] === "stroke").length, 4);
  assert.equal(ctx.calls.filter((call) => call[0] === "strokeStyle" && call[1] === "#ffcc00").length, 2);
  assert.equal(
    ctx.calls.filter((call) => call[0] === "strokeStyle" && call[1] === "rgba(255,255,255,0.9)").length,
    2,
  );
  assert.deepEqual(ctx.calls.filter((call) => call[0] === "moveTo").slice(0, 2), [
    ["moveTo", 10, 20],
    ["moveTo", 10, 20],
  ]);
  assert.equal(ctx.calls.at(-1)[0], "restore");
});

test("drawHookTrailLayer returns zero for trails shorter than two points", () => {
  const ctx = createFakeCtx();

  assert.equal(drawHookTrailLayer({ ctx, trail: [] }), 0);
  assert.equal(drawHookTrailLayer({ ctx, trail: [{ x: 1, y: 2, age: 0 }] }), 0);
  assert.deepEqual(ctx.calls, []);
});

test("drawHookTrailLayer clamps expired points and does not mutate input trail", () => {
  const ctx = createFakeCtx();
  const trail = [
    { x: 0, y: 0, age: 2 },
    { x: 10, y: 10, age: 0 },
  ];
  const original = trail.map((point) => ({ ...point }));

  const segments = drawHookTrailLayer({ ctx, trail, life: 0.55 });

  assert.equal(segments, 1);
  assert.deepEqual(trail, original);
  assert.ok(ctx.calls.some((call) => call[0] === "globalAlpha" && call[1] === 0));
  assert.ok(ctx.calls.some((call) => call[0] === "lineWidth" && call[1] === 1.2));
});

test("drawHookTrailLayer rejects invalid structural inputs", () => {
  assert.throws(() => drawHookTrailLayer({ ctx: null, trail: [] }), /ctx/);
  assert.throws(() => drawHookTrailLayer({ ctx: createFakeCtx(), trail: null }), /trail must be an array/);
  assert.throws(
    () => drawHookTrailLayer({ ctx: createFakeCtx(), trail: [], color: "" }),
    /color must be a non-empty string/,
  );
  assert.throws(() => drawHookTrailLayer({ ctx: createFakeCtx(), trail: [], life: 0 }), /life/);
  assert.throws(
    () =>
      drawHookTrailLayer({
        ctx: createFakeCtx(),
        trail: [
          { x: 0, y: 0, age: 0 },
          { x: Number.NaN, y: 10, age: 0 },
        ],
      }),
    /trail\[1\]\.x/,
  );
});
