import { test } from "node:test";
import assert from "node:assert/strict";
import { drawHookLayer } from "../../src/render/hookRenderer.js";

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
    moveTo(...args) {
      calls.push(["moveTo", ...args]);
    },
    lineTo(...args) {
      calls.push(["lineTo", ...args]);
    },
    quadraticCurveTo(...args) {
      calls.push(["quadraticCurveTo", ...args]);
    },
    bezierCurveTo(...args) {
      calls.push(["bezierCurveTo", ...args]);
    },
    arc(...args) {
      calls.push(["arc", ...args]);
    },
    arcTo(...args) {
      calls.push(["arcTo", ...args]);
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
    translate(...args) {
      calls.push(["translate", ...args]);
    },
    rotate(...args) {
      calls.push(["rotate", ...args]);
    },
    closePath() {
      calls.push(["closePath"]);
    },
    drawImage(...args) {
      calls.push(["drawImage", ...args]);
    },
    setLineDash(value) {
      calls.push(["setLineDash", value]);
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
    set globalAlpha(value) {
      calls.push(["globalAlpha", value]);
    },
    set lineCap(value) {
      calls.push(["lineCap", value]);
    },
    set lineJoin(value) {
      calls.push(["lineJoin", value]);
    },
    set lineWidth(value) {
      calls.push(["lineWidth", value]);
    },
    set lineDashOffset(value) {
      calls.push(["lineDashOffset", value]);
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

const baseOptions = () => ({
  ctx: createFakeCtx(),
  hook: {
    length: 120,
    maxLength: 280,
    state: "extend",
    angle: 0.2,
    reelAngle: 0.5,
    clawClose: 0.25,
  },
  pivot: { x: 100, y: 60 },
  tip: { x: 100, y: 184 },
  dir: { x: 0, y: 1 },
  carriedItem: null,
  canBomb: false,
  hookConfig: { ringToTip: 44, jawBase: 16 },
  now: 1200,
  itemGlowColor: null,
});

function loadedAsset(label) {
  return { status: "loaded", image: { label, naturalWidth: 128, naturalHeight: 128 } };
}

function registryWith(entries) {
  return {
    get(key) {
      return entries[key] ?? null;
    },
  };
}

test("drawHookLayer draws rope shadow and highlight from pivot to ring", () => {
  const options = baseOptions();

  const summary = drawHookLayer(options);

  assert.deepEqual(summary, { drewHook: true });
  assert.equal(options.ctx.calls[0][0], "save");
  assert.equal(options.ctx.calls.at(-1)[0], "restore");
  assert.ok(options.ctx.calls.some((call) => call[0] === "strokeStyle" && call[1] === "rgba(0,0,0,0.35)"));
  assert.deepEqual(options.ctx.calls.find((call) => call[0] === "createLinearGradient"), [
    "createLinearGradient",
    100,
    60,
    100,
    140,
  ]);
  assert.ok(
    options.ctx.calls.some(
      (call) => call[0] === "addColorStop" && call[1] === "linear" && call[3] === "rgba(255,255,255,0.95)",
    ),
  );
  assert.equal(
    options.ctx.calls.filter((call) => call[0] === "moveTo" && call[1] === 100 && call[2] === 60).length,
    3,
  );
  assert.equal(
    options.ctx.calls.filter((call) => call[0] === "quadraticCurveTo" && call[3] === 100 && call[4] === 140).length,
    3,
  );
});

test("drawHookLayer draws moving dash hint only when hook is not swinging", () => {
  const options = baseOptions();

  drawHookLayer(options);

  assert.ok(options.ctx.calls.some((call) => call[0] === "setLineDash" && call[1][0] === 6 && call[1][1] === 12));
  assert.ok(options.ctx.calls.some((call) => call[0] === "lineDashOffset" && call[1] === -6));

  const swingOptions = baseOptions();
  swingOptions.hook.state = "swing";
  drawHookLayer(swingOptions);

  assert.equal(swingOptions.ctx.calls.some((call) => call[0] === "setLineDash"), false);
});

test("drawHookLayer draws ring, stem, and tri-prong claw paths", () => {
  const options = baseOptions();

  drawHookLayer(options);

  assert.ok(options.ctx.calls.some((call) => call[0] === "translate" && call[1] === 100 && call[2] === 140));
  assert.ok(options.ctx.calls.some((call) => call[0] === "arc" && call[1] === 0 && call[2] === 0 && call[3] === 6.4));
  assert.ok(options.ctx.calls.some((call) => call[0] === "lineTo" && call[1] === 0 && call[2] === 12));
  assert.ok(options.ctx.calls.some((call) => call[0] === "translate" && call[1] === 0 && call[2] === 16));
  assert.ok(options.ctx.calls.some((call) => call[0] === "moveTo" && call[1] < 0 && call[2] === 0));
  assert.ok(options.ctx.calls.some((call) => call[0] === "moveTo" && call[1] > 0 && call[2] === 0));
  assert.ok(options.ctx.calls.some((call) => call[0] === "moveTo" && call[1] === 0 && call[2] === 0));
  assert.ok(options.ctx.calls.filter((call) => call[0] === "bezierCurveTo").length >= 9);
  assert.ok(options.ctx.calls.filter((call) => call[0] === "ellipse").length >= 4);
});

test("drawHookLayer overlays crayon hook claw asset when loaded", () => {
  const ctx = createFakeCtx();
  const artAssets = registryWith({
    "sprite.hookClaw": loadedAsset("claw"),
  });

  drawHookLayer({
    ctx,
    hook: { length: 100, maxLength: 300, state: "swing", angle: 0.2, reelAngle: 0, clawClose: 0 },
    pivot: { x: 200, y: 106 },
    tip: { x: 220, y: 180 },
    dir: { x: 0.2, y: 0.98 },
    carriedItem: null,
    canBomb: false,
    hookConfig: { ringToTip: 44, jawBase: 16 },
    now: 0,
    itemGlowColor: null,
    artAssets,
  });

  assert.ok(ctx.calls.some((call) => call[0] === "drawImage" && call[1].label === "claw"));
});

test("drawHookLayer draws carried item glow while retracting with cargo", () => {
  const options = baseOptions();
  options.hook.state = "retract";
  options.carriedItem = { r: 24, type: "gold" };
  options.itemGlowColor = "#ffd34d";

  drawHookLayer(options);

  assert.ok(
    options.ctx.calls.some(
      (call) => call[0] === "createRadialGradient" && call[1] === 0 && call[2] === 45 && call[6] === 34,
    ),
  );
  assert.ok(
    options.ctx.calls.some(
      (call) => call[0] === "addColorStop" && call[1] === "radial" && call[3] === "#ffd34d",
    ),
  );
});

test("drawHookLayer draws bomb fuse glow only when canBomb is true", () => {
  const options = baseOptions();
  options.hook.state = "retract";
  options.carriedItem = { r: 18, type: "bag" };
  options.itemGlowColor = "#b07bff";

  drawHookLayer(options);

  assert.equal(
    options.ctx.calls.some(
      (call) => call[0] === "createRadialGradient" && call[1] === 0 && call[2] === 46.5 && call[6] === 20,
    ),
    false,
  );

  const bombOptions = baseOptions();
  bombOptions.hook.state = "retract";
  bombOptions.carriedItem = { r: 18, type: "bag" };
  bombOptions.canBomb = true;
  bombOptions.itemGlowColor = "#b07bff";

  drawHookLayer(bombOptions);

  assert.ok(
    bombOptions.ctx.calls.some(
      (call) => call[0] === "createRadialGradient" && call[1] === 0 && call[2] === 46.5 && call[6] === 20,
    ),
  );
  assert.ok(
    bombOptions.ctx.calls.some(
      (call) => call[0] === "addColorStop" && call[1] === "radial" && call[3] === "rgba(255, 77, 77, 0.65)",
    ),
  );
});

test("drawHookLayer restores canvas state when drawing throws", () => {
  const options = baseOptions();
  options.ctx = createFakeCtx({
    stroke() {
      options.ctx.calls.push(["stroke"]);
      throw new Error("paint failed");
    },
  });

  assert.throws(() => drawHookLayer(options), /paint failed/);
  assert.equal(options.ctx.calls.at(-1)[0], "restore");
});

test("drawHookLayer rejects invalid structural inputs", () => {
  const options = baseOptions();

  assert.throws(() => drawHookLayer(), /ctx/);
  assert.throws(() => drawHookLayer({ ...options, ctx: {} }), /ctx\.save/);
  assert.throws(() => drawHookLayer({ ...options, hook: { ...options.hook, length: Number.NaN } }), /hook\.length/);
  assert.throws(() => drawHookLayer({ ...options, hook: { ...options.hook, maxLength: 0 } }), /maxLength/);
  assert.throws(() => drawHookLayer({ ...options, hook: { ...options.hook, state: "" } }), /hook\.state/);
  assert.throws(() => drawHookLayer({ ...options, hook: { ...options.hook, angle: Number.NaN } }), /hook\.angle/);
  assert.throws(() => drawHookLayer({ ...options, hook: { ...options.hook, reelAngle: "0" } }), /reelAngle/);
  assert.throws(() => drawHookLayer({ ...options, hook: { ...options.hook, clawClose: undefined } }), /clawClose/);
  assert.throws(() => drawHookLayer({ ...options, pivot: { x: Number.NaN, y: 0 } }), /pivot\.x/);
  assert.throws(() => drawHookLayer({ ...options, tip: { x: 0, y: Number.POSITIVE_INFINITY } }), /tip\.y/);
  assert.throws(() => drawHookLayer({ ...options, dir: { x: "0", y: 1 } }), /dir\.x/);
  assert.throws(() => drawHookLayer({ ...options, carriedItem: { r: Number.NaN, type: "gold" } }), /carriedItem\.r/);
  assert.throws(() => drawHookLayer({ ...options, carriedItem: { r: 12, type: "" } }), /carriedItem\.type/);
  assert.throws(() => drawHookLayer({ ...options, canBomb: 1 }), /canBomb/);
  assert.throws(() => drawHookLayer({ ...options, hookConfig: { ringToTip: Number.NaN, jawBase: 16 } }), /ringToTip/);
  assert.throws(() => drawHookLayer({ ...options, now: Number.NaN }), /now/);
  assert.throws(() => drawHookLayer({ ...options, itemGlowColor: "" }), /itemGlowColor/);
  assert.throws(
    () =>
      drawHookLayer({
        ...options,
        hook: { ...options.hook, state: "retract" },
        carriedItem: { r: 18, type: "gold" },
        itemGlowColor: null,
      }),
    /itemGlowColor must be provided/,
  );
});
