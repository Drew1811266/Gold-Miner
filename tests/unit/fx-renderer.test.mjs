import { test } from "node:test";
import assert from "node:assert/strict";
import { drawFxLayer } from "../../src/render/fxRenderer.js";

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
    stroke() {
      calls.push(["stroke"]);
    },
    fill() {
      calls.push(["fill"]);
    },
    strokeText(...args) {
      calls.push(["strokeText", ...args]);
    },
    fillText(...args) {
      calls.push(["fillText", ...args]);
    },
    drawImage(...args) {
      calls.push(["drawImage", ...args]);
    },
    set globalCompositeOperation(value) {
      calls.push(["globalCompositeOperation", value]);
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
    set lineWidth(value) {
      calls.push(["lineWidth", value]);
    },
    set textAlign(value) {
      calls.push(["textAlign", value]);
    },
    set textBaseline(value) {
      calls.push(["textBaseline", value]);
    },
    set font(value) {
      calls.push(["font", value]);
    },
  };

  return Object.assign(ctx, overrides);
}

function createFx() {
  return {
    rings: [
      { x: 30, y: 40, age: 1, life: 4, r0: 10, r1: 30, width: 4, color: "#ffee55" },
      { x: 12, y: 18, age: 5, life: 5, r0: 8, r1: 16, width: 2, color: "#00ffee" },
    ],
    particles: [
      { x: 50, y: 60, age: 1, life: 4, size: 0.4, color: "#ff8844" },
      { x: 70, y: 80, age: 2, life: 2, size: 3, color: "#44ccff" },
    ],
    pops: [
      { text: "+500", x: 90, y: 100, age: 1, life: 4, color: "#ffd34d" },
      { text: "+0", x: 10, y: 20, age: 4, life: 4, color: "#ffffff" },
    ],
  };
}

function loadedAsset(label) {
  return { status: "loaded", image: { label, naturalWidth: 64, naturalHeight: 64 } };
}

test("drawFxLayer renders shockwave rings with additive compositing and faded arcs", () => {
  const ctx = createFakeCtx();

  const summary = drawFxLayer({ ctx, fx: createFx() });

  assert.deepEqual(summary, { rings: 1, particles: 1, pops: 1 });
  assert.equal(ctx.calls[0][0], "save");
  assert.ok(ctx.calls.some((call) => call[0] === "globalCompositeOperation" && call[1] === "lighter"));
  assert.ok(ctx.calls.some((call) => call[0] === "globalAlpha" && call[1] === 0.41250000000000003));
  assert.ok(ctx.calls.some((call) => call[0] === "strokeStyle" && call[1] === "#ffee55"));
  assert.ok(ctx.calls.some((call) => call[0] === "lineWidth" && call[1] === 3.2));
  assert.deepEqual(
    ctx.calls.find((call) => call[0] === "arc" && call[1] === 30),
    ["arc", 30, 40, 15, 0, Math.PI * 2],
  );
  assert.equal(ctx.calls.filter((call) => call[0] === "stroke").length >= 1, true);
});

test("drawFxLayer renders particles with per-particle alpha fade and minimum radius", () => {
  const ctx = createFakeCtx();

  drawFxLayer({ ctx, fx: createFx() });

  assert.ok(ctx.calls.some((call) => call[0] === "globalAlpha" && call[1] === 0.675));
  assert.ok(ctx.calls.some((call) => call[0] === "fillStyle" && call[1] === "#ff8844"));
  assert.deepEqual(
    ctx.calls.find((call) => call[0] === "arc" && call[1] === 50),
    ["arc", 50, 60, 0.6, 0, Math.PI * 2],
  );
  assert.equal(ctx.calls.filter((call) => call[0] === "fill").length >= 1, true);
  assert.equal(
    ctx.calls.filter((call) => call[0] === "save").length,
    ctx.calls.filter((call) => call[0] === "restore").length,
  );
});

test("drawFxLayer draws crayon spark sprites for particles when loaded", () => {
  const ctx = createFakeCtx();

  drawFxLayer({
    ctx,
    fx: {
      rings: [],
      particles: [{ x: 10, y: 20, age: 0, life: 1, size: 5, color: "#ffd34d" }],
      pops: [],
    },
    artAssets: { get: () => loadedAsset("spark") },
  });

  assert.ok(ctx.calls.some((call) => call[0] === "drawImage" && call[1].label === "spark"));
});

test("drawFxLayer renders score pops with centered stroked and filled text", () => {
  const ctx = createFakeCtx();

  drawFxLayer({ ctx, fx: createFx() });

  assert.ok(ctx.calls.some((call) => call[0] === "textAlign" && call[1] === "center"));
  assert.ok(ctx.calls.some((call) => call[0] === "textBaseline" && call[1] === "middle"));
  assert.ok(ctx.calls.some((call) => call[0] === "font" && call[1] === "700 18px ui-sans-serif, system-ui"));
  assert.ok(ctx.calls.some((call) => call[0] === "globalAlpha" && call[1] === 0.75));
  assert.ok(ctx.calls.some((call) => call[0] === "lineWidth" && call[1] === 4));
  assert.ok(ctx.calls.some((call) => call[0] === "strokeStyle" && call[1] === "rgba(0,0,0,0.38)"));
  assert.deepEqual(ctx.calls.find((call) => call[0] === "strokeText"), ["strokeText", "+500", 90, 100]);
  assert.deepEqual(ctx.calls.find((call) => call[0] === "fillText"), ["fillText", "+500", 90, 100]);
});

test("drawFxLayer does not mutate fx arrays or entries", () => {
  const ctx = createFakeCtx();
  const fx = createFx();
  const snapshot = structuredClone(fx);

  drawFxLayer({ ctx, fx });

  assert.deepEqual(fx, snapshot);
});

test("drawFxLayer rejects invalid structural inputs", () => {
  const ctx = createFakeCtx();
  const fx = createFx();

  assert.throws(() => drawFxLayer(), /ctx/);
  assert.throws(() => drawFxLayer({ ctx: {}, fx }), /ctx\.save/);
  assert.throws(() => drawFxLayer({ ctx, fx: null }), /fx/);
  assert.throws(() => drawFxLayer({ ctx, fx: { ...fx, rings: null } }), /fx\.rings/);
  assert.throws(() => drawFxLayer({ ctx, fx: { ...fx, particles: null } }), /fx\.particles/);
  assert.throws(() => drawFxLayer({ ctx, fx: { ...fx, pops: null } }), /fx\.pops/);
  assert.throws(
    () => drawFxLayer({ ctx, fx: { ...fx, rings: [{ ...fx.rings[0], x: Number.NaN }] } }),
    /rings\[0\]\.x/,
  );
  assert.throws(
    () => drawFxLayer({ ctx, fx: { ...fx, particles: [{ ...fx.particles[0], color: "" }] } }),
    /particles\[0\]\.color/,
  );
  assert.throws(
    () => drawFxLayer({ ctx, fx: { ...fx, pops: [{ ...fx.pops[0], life: 0 }] } }),
    /pops\[0\]\.life/,
  );
});
