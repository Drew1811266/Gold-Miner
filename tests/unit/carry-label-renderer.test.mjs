import { test } from "node:test";
import assert from "node:assert/strict";
import { drawCarryLabelLayer } from "../../src/render/carryLabelRenderer.js";

function createFakeCtx(overrides = {}) {
  const calls = [];
  const ctx = {
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
    arcTo(...args) {
      calls.push(["arcTo", ...args]);
    },
    closePath() {
      calls.push(["closePath"]);
    },
    arc(...args) {
      calls.push(["arc", ...args]);
    },
    fill() {
      calls.push(["fill"]);
    },
    stroke() {
      calls.push(["stroke"]);
    },
    fillText(...args) {
      calls.push(["fillText", ...args]);
    },
    measureText(text) {
      calls.push(["measureText", text]);
      return { width: text.length * 10 };
    },
    set font(value) {
      calls.push(["font", value]);
    },
    set textAlign(value) {
      calls.push(["textAlign", value]);
    },
    set textBaseline(value) {
      calls.push(["textBaseline", value]);
    },
    set globalAlpha(value) {
      calls.push(["globalAlpha", value]);
    },
    set fillStyle(value) {
      calls.push(["fillStyle", value]);
    },
    set strokeStyle(value) {
      calls.push(["strokeStyle", value]);
    },
    set lineWidth(value) {
      calls.push(["lineWidth", value]);
    },
  };

  return Object.assign(ctx, overrides);
}

test("drawCarryLabelLayer draws the carry label geometry and returns true", () => {
  const ctx = createFakeCtx();

  const drawn = drawCarryLabelLayer({
    ctx,
    end: { x: 100, y: 120 },
    viewport: { w: 320, h: 240 },
    color: "#ffd34d",
    text: "120",
  });

  assert.equal(drawn, true);
  assert.equal(ctx.calls[0][0], "save");
  assert.equal(ctx.calls.at(-1)[0], "restore");
  assert.ok(ctx.calls.some((call) => call[0] === "font" && call[1] === "700 12px ui-sans-serif, system-ui"));
  assert.ok(ctx.calls.some((call) => call[0] === "textAlign" && call[1] === "left"));
  assert.ok(ctx.calls.some((call) => call[0] === "textBaseline" && call[1] === "middle"));
  assert.deepEqual(ctx.calls.find((call) => call[0] === "measureText"), ["measureText", "120"]);
  assert.equal(ctx.calls.filter((call) => call[0] === "fill").length, 4);
  assert.equal(ctx.calls.filter((call) => call[0] === "stroke").length, 1);
  assert.ok(ctx.calls.some((call) => call[0] === "fillStyle" && call[1] === "#ffd34d"));
  assert.ok(ctx.calls.some((call) => call[0] === "fillStyle" && call[1] === "rgba(244, 226, 185, 0.94)"));
  assert.ok(ctx.calls.some((call) => call[0] === "strokeStyle" && String(call[1]).includes("rgba(70, 45, 25")));
  assert.ok(ctx.calls.some((call) => call[0] === "fillStyle" && call[1] === "#ffffff"));
  assert.ok(ctx.calls.some((call) => call[0] === "fillStyle" && call[1] === "rgba(45, 31, 20, 0.94)"));
  assert.ok(ctx.calls.some((call) => call[0] === "arc" && call[1] === 131 && call[2] === 89 && call[3] === 5));
  assert.ok(ctx.calls.some((call) => call[0] === "arc" && call[1] === 129.8 && call[2] === 87.8 && call[3] === 1.8));
  assert.deepEqual(ctx.calls.find((call) => call[0] === "fillText"), ["fillText", "120", 144, 89]);
});

test("drawCarryLabelLayer clamps label bounds inside the viewport", () => {
  const ctx = createFakeCtx();

  drawCarryLabelLayer({
    ctx,
    end: { x: 310, y: -10 },
    viewport: { w: 320, h: 240 },
    color: "#36d399",
    text: "999",
  });

  assert.deepEqual(ctx.calls.find((call) => call[0] === "arc"), [
    "arc",
    255,
    19,
    11,
    Math.PI,
    Math.PI * 1.5,
  ]);
  assert.deepEqual(ctx.calls.find((call) => call[0] === "fillText"), ["fillText", "999", 272, 19]);
});

test("drawCarryLabelLayer restores canvas state when drawing throws", () => {
  const ctx = createFakeCtx({
    fillText() {
      ctx.calls.push(["fillText"]);
      throw new Error("paint failed");
    },
  });

  assert.throws(
    () =>
      drawCarryLabelLayer({
        ctx,
        end: { x: 100, y: 120 },
        viewport: { w: 320, h: 240 },
        color: "#ffd34d",
        text: "120",
      }),
    /paint failed/,
  );
  assert.equal(ctx.calls.at(-1)[0], "restore");
});

test("drawCarryLabelLayer rejects invalid structural inputs", () => {
  const ctx = createFakeCtx();

  assert.throws(() => drawCarryLabelLayer(), /ctx/);
  assert.throws(() => drawCarryLabelLayer({ ctx: {}, end: { x: 0, y: 0 }, viewport: { w: 1, h: 1 }, color: "#fff", text: "1" }), /ctx\.save/);
  assert.throws(() => drawCarryLabelLayer({ ctx, end: { x: Number.NaN, y: 0 }, viewport: { w: 1, h: 1 }, color: "#fff", text: "1" }), /end\.x/);
  assert.throws(() => drawCarryLabelLayer({ ctx, end: { x: 0, y: 0 }, viewport: { w: 0, h: 1 }, color: "#fff", text: "1" }), /viewport\.w/);
  assert.throws(() => drawCarryLabelLayer({ ctx, end: { x: 0, y: 0 }, viewport: { w: 1, h: 1 }, color: "", text: "1" }), /color/);
  assert.throws(() => drawCarryLabelLayer({ ctx, end: { x: 0, y: 0 }, viewport: { w: 1, h: 1 }, color: "#fff", text: "" }), /text/);
});
