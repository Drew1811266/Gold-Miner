import { test } from "node:test";
import assert from "node:assert/strict";
import { drawReelLayer, drawWinchLayer } from "../../src/render/winchRenderer.js";

function createGradient(calls, type, args) {
  const gradient = { type, args };
  return Object.assign(gradient, {
    addColorStop(offset, color) {
      calls.push(["addColorStop", type, offset, color]);
    },
  });
}

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
    arc(...args) {
      calls.push(["arc", ...args]);
    },
    ellipse(...args) {
      calls.push(["ellipse", ...args]);
    },
    fill() {
      calls.push(["fill"]);
    },
    stroke() {
      calls.push(["stroke"]);
    },
    moveTo(...args) {
      calls.push(["moveTo", ...args]);
    },
    lineTo(...args) {
      calls.push(["lineTo", ...args]);
    },
    rotate(...args) {
      calls.push(["rotate", ...args]);
    },
    translate(...args) {
      calls.push(["translate", ...args]);
    },
    arcTo(...args) {
      calls.push(["arcTo", ...args]);
    },
    closePath() {
      calls.push(["closePath"]);
    },
    createLinearGradient(...args) {
      calls.push(["createLinearGradient", ...args]);
      return createGradient(calls, "linear", args);
    },
    createRadialGradient(...args) {
      calls.push(["createRadialGradient", ...args]);
      return createGradient(calls, "radial", args);
    },
    set globalCompositeOperation(value) {
      calls.push(["globalCompositeOperation", value]);
    },
    set lineCap(value) {
      calls.push(["lineCap", value]);
    },
    set lineWidth(value) {
      calls.push(["lineWidth", value]);
    },
    set globalAlpha(value) {
      calls.push(["globalAlpha", value]);
    },
    set strokeStyle(value) {
      calls.push(["strokeStyle", value]);
    },
    set fillStyle(value) {
      calls.push(["fillStyle", value]);
    },
  };

  return Object.assign(ctx, overrides);
}

const reelOptions = () => ({
  ctx: createFakeCtx(),
  pivot: { x: 120, y: 38 },
  centerY: 50,
  hook: { reelAngle: 0.45, spoolSpeed: 0 },
});

const winchOptions = () => {
  const ctx = createFakeCtx();
  return {
    ctx,
    pivot: { x: 120, y: 38 },
    reel: { x: 120, y: 50 },
    plankY: 72,
    hook: { reelAngle: 0.45, spoolSpeed: 0 },
  };
};

test("drawReelLayer draws reel shadow, ring, hub, spokes, and handle", () => {
  const options = reelOptions();

  const summary = drawReelLayer(options);

  assert.deepEqual(summary, { drewReel: true });
  assert.equal(options.ctx.calls[0][0], "save");
  assert.equal(options.ctx.calls.at(-1)[0], "restore");
  assert.deepEqual(options.ctx.calls.find((call) => call[0] === "translate"), ["translate", 120, 50]);
  assert.ok(options.ctx.calls.some((call) => call[0] === "ellipse" && call[1] === 3 && call[2] === 4));
  assert.ok(options.ctx.calls.some((call) => call[0] === "createRadialGradient" && call[6] === 16));
  assert.ok(options.ctx.calls.some((call) => call[0] === "createRadialGradient" && call[6] === 7.5));
  assert.equal(options.ctx.calls.filter((call) => call[0] === "moveTo" && call[1] === 0 && call[2] === 0).length, 6);
  assert.ok(options.ctx.calls.some((call) => call[0] === "moveTo" && call[1] === 8.7 && call[2] === 0));
  assert.ok(options.ctx.calls.some((call) => call[0] === "arc" && call[1] === 14 && call[2] === 0 && call[3] === 3.8));
  assert.ok(options.ctx.calls.some((call) => call[0] === "fillStyle" && call[1] === "#ffd34d"));
});

test("drawReelLayer draws motion blur when spool speed is high", () => {
  const options = reelOptions();
  options.hook.spoolSpeed = 1000;

  const summary = drawReelLayer(options);

  assert.deepEqual(summary, { drewReel: true });
  assert.ok(options.ctx.calls.some((call) => call[0] === "globalCompositeOperation" && call[1] === "lighter"));
  assert.ok(options.ctx.calls.some((call) => call[0] === "lineCap" && call[1] === "round"));
  assert.ok(options.ctx.calls.some((call) => call[0] === "strokeStyle" && call[1] === "rgba(255,255,255,0.65)"));
  assert.ok(options.ctx.calls.some((call) => call[0] === "strokeStyle" && call[1] === "rgba(255, 211, 77, 0.65)"));
});

test("drawReelLayer defaults missing spool speed to zero", () => {
  const options = reelOptions();
  delete options.hook.spoolSpeed;

  assert.deepEqual(drawReelLayer(options), { drewReel: true });
  assert.equal(
    options.ctx.calls.some((call) => call[0] === "globalCompositeOperation" && call[1] === "lighter"),
    false,
  );
});

test("drawReelLayer restores canvas state when drawing throws", () => {
  const options = reelOptions();
  options.ctx = createFakeCtx({
    fill() {
      options.ctx.calls.push(["fill"]);
      throw new Error("paint failed");
    },
  });

  assert.throws(() => drawReelLayer(options), /paint failed/);
  assert.equal(options.ctx.calls.at(-1)[0], "restore");
});

test("drawWinchLayer draws mount plate, four bolts, and delegates reel drawing", () => {
  const options = winchOptions();

  const summary = drawWinchLayer(options);

  assert.deepEqual(summary, { drewWinch: true, drewReel: true });
  assert.equal(options.ctx.calls[0][0], "save");
  assert.equal(options.ctx.calls.at(-1)[0], "restore");
  assert.ok(options.ctx.calls.some((call) => call[0] === "ellipse" && call[1] === 128 && call[2] === 78 && call[3] === 44));
  assert.deepEqual(options.ctx.calls.find((call) => call[0] === "createLinearGradient"), [
    "createLinearGradient",
    84,
    49,
    156,
    75,
  ]);
  assert.ok(options.ctx.calls.some((call) => call[0] === "fillStyle" && call[1] === "rgba(0,0,0,0.30)"));
  assert.equal(options.ctx.calls.filter((call) => call[0] === "arcTo").length, 8);
  assert.equal(options.ctx.calls.filter((call) => call[0] === "closePath").length, 2);
  assert.equal(options.ctx.calls.filter((call) => call[0] === "arc" && call[3] === 4.4).length, 4);
  assert.equal(options.ctx.calls.filter((call) => call[0] === "arc" && call[3] === 1.4).length, 4);
  assert.deepEqual(options.ctx.calls.find((call) => call[0] === "translate"), ["translate", 120, 50]);
});

test("drawWinchLayer restores canvas state when drawing throws", () => {
  const options = winchOptions();
  options.ctx = createFakeCtx({
    createLinearGradient() {
      options.ctx.calls.push(["createLinearGradient"]);
      throw new Error("gradient failed");
    },
  });

  assert.throws(() => drawWinchLayer(options), /gradient failed/);
  assert.equal(options.ctx.calls.at(-1)[0], "restore");
});

test("winch renderer rejects invalid structural inputs", () => {
  assert.throws(() => drawReelLayer(), /ctx/);
  assert.throws(() => drawReelLayer({ ...reelOptions(), ctx: {} }), /ctx\.save/);
  assert.throws(() => drawReelLayer({ ...reelOptions(), pivot: { x: Number.NaN, y: 0 } }), /pivot\.x/);
  assert.throws(() => drawReelLayer({ ...reelOptions(), centerY: Number.POSITIVE_INFINITY }), /centerY/);
  assert.throws(() => drawReelLayer({ ...reelOptions(), hook: { reelAngle: "0", spoolSpeed: 0 } }), /reelAngle/);
  assert.throws(() => drawReelLayer({ ...reelOptions(), hook: { reelAngle: 0, spoolSpeed: Number.NaN } }), /spoolSpeed/);
  assert.throws(() => drawWinchLayer({ ...winchOptions(), reel: { x: 0, y: Number.NaN } }), /reel\.y/);
  assert.throws(() => drawWinchLayer({ ...winchOptions(), plankY: Number.NaN }), /plankY/);
});
