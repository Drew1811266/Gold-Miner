import { test } from "node:test";
import assert from "node:assert/strict";
import { drawItemShape } from "../../src/render/itemRenderer.js";

function createGradient(calls, type, args) {
  const gradient = { type, args };
  return Object.assign(gradient, {
    addColorStop(offset, color) {
      calls.push(["addColorStop", type, offset, color]);
    },
  });
}

function createFakeCtx() {
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
    closePath() {
      calls.push(["closePath"]);
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
    scale(...args) {
      calls.push(["scale", ...args]);
    },
    fillText(...args) {
      calls.push(["fillText", ...args]);
    },
    drawImage(...args) {
      calls.push(["drawImage", ...args]);
    },
    createLinearGradient(...args) {
      calls.push(["createLinearGradient", ...args]);
      return createGradient(calls, "linear", args);
    },
    createRadialGradient(...args) {
      calls.push(["createRadialGradient", ...args]);
      return createGradient(calls, "radial", args);
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
    set lineCap(value) {
      calls.push(["lineCap", value]);
    },
    set lineJoin(value) {
      calls.push(["lineJoin", value]);
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
    set globalAlpha(value) {
      calls.push(["globalAlpha", value]);
    },
    set globalCompositeOperation(value) {
      calls.push(["globalCompositeOperation", value]);
    },
  };

  return ctx;
}

function draw(item, options = {}) {
  const ctx = createFakeCtx();
  const rngCalls = [];
  const createRng = (seed) => {
    rngCalls.push(seed);
    return {
      next: () => 0.5,
      range: (min, max) => (min + max) / 2,
    };
  };

  const result = drawItemShape({
    ctx,
    item,
    now: options.now ?? 1800,
    createRng: options.createRng ?? createRng,
    metadata: options.metadata ?? { attached: false, hookIndex: null },
    artAssets: options.artAssets ?? null,
  });

  return { ctx, rngCalls, result };
}

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

test("drawItemShape draws loaded crayon item sprites in the existing radius box", () => {
  const item = {
    id: 101,
    type: "gold",
    x: 90,
    y: 110,
    r: 22,
    grabbed: false,
    art: { rot: 0 },
  };

  const { ctx, result } = draw(item, {
    artAssets: registryWith({ "sprite.gold": loadedAsset("gold") }),
  });

  assert.equal(result, true);
  const drawCall = ctx.calls.find((call) => call[0] === "drawImage");
  assert.equal(drawCall[1].label, "gold");
  assert.equal(drawCall[2], -26.4);
  assert.equal(drawCall[3], -26.4);
  assert.equal(drawCall[4], 52.8);
  assert.equal(drawCall[5], 52.8);
});

test("drawItemShape draws a mouse with bar cargo and keeps facing based on velocity", () => {
  const item = {
    id: 7,
    type: "mouse",
    x: 120,
    y: 80,
    r: 18,
    grabbed: false,
    art: { rot: 0 },
    mouse: {
      vx: -40,
      phase: Math.PI / 3,
      cargo: "bar",
    },
  };

  const { ctx, result } = draw(item);

  assert.equal(result, true);
  assert.ok(ctx.calls.some((call) => call[0] === "scale" && call[1] === -1 && call[2] === 1));
  assert.ok(ctx.calls.some((call) => call[0] === "quadraticCurveTo" && call[1] < 0));
  assert.ok(ctx.calls.some((call) => call[0] === "createLinearGradient"));
  assert.ok(ctx.calls.some((call) => call[0] === "arcTo"));
});

test("drawItemShape draws gold with fallback blob art using the injected rng", () => {
  const item = {
    id: 42,
    type: "gold",
    x: 90,
    y: 110,
    r: 22,
    grabbed: true,
    art: {
      rot: 0.1,
      glint: 0.2,
      sparkles: [{ a: 0.5, d: 0.3, s: 0.2, p: 0.1 }],
    },
  };

  const { ctx, rngCalls, result } = draw(item, { now: 2500 });

  assert.equal(result, true);
  assert.deepEqual(rngCalls, [42]);
  assert.ok(ctx.calls.some((call) => call[0] === "createRadialGradient"));
  assert.ok(ctx.calls.filter((call) => call[0] === "quadraticCurveTo").length >= 8);
  assert.ok(ctx.calls.some((call) => call[0] === "lineCap" && call[1] === "round"));
});

test("drawItemShape uses supplied gold blob art without consulting fallback rng", () => {
  const item = {
    id: 43,
    type: "gold",
    x: 90,
    y: 110,
    r: 22,
    grabbed: true,
    art: {
      rot: 0.1,
      glint: 0.2,
      blob: [
        { a: 0, r: 1 },
        { a: Math.PI / 2, r: 0.9 },
        { a: Math.PI, r: 1.05 },
        { a: Math.PI * 1.5, r: 0.95 },
      ],
      sparkles: [],
    },
  };
  const createRng = () => {
    throw new Error("fallback rng should not be used");
  };

  const { ctx, result } = draw(item, { createRng });

  assert.equal(result, true);
  assert.equal(ctx.calls.filter((call) => call[0] === "quadraticCurveTo").length, 4);
});

test("drawItemShape draws a gold bar with bevel stamp and shine", () => {
  const item = {
    id: 8,
    type: "bar",
    x: 50,
    y: 60,
    r: 20,
    grabbed: true,
    art: { rot: 0.2, shine: 0.4 },
  };

  const { ctx, result } = draw(item, { now: 900 });

  assert.equal(result, true);
  assert.ok(ctx.calls.some((call) => call[0] === "fillText" && call[1] === "Au"));
  assert.ok(ctx.calls.some((call) => call[0] === "createLinearGradient"));
  assert.ok(ctx.calls.filter((call) => call[0] === "arcTo").length >= 4);
});

test("drawItemShape draws a diamond with facet lines and flare", () => {
  const item = {
    id: 11,
    type: "diamond",
    x: 64,
    y: 96,
    r: 16,
    grabbed: true,
    art: { rot: 0.15, twinkle: 0.6 },
  };

  const { ctx, result } = draw(item, { now: 1600 });

  assert.equal(result, true);
  assert.ok(ctx.calls.some((call) => call[0] === "moveTo" && call[1] === 0 && call[2] === -20));
  assert.ok(ctx.calls.some((call) => call[0] === "lineTo" && call[1] === 0 && call[2] === 19.52));
  assert.ok(ctx.calls.some((call) => call[0] === "createLinearGradient"));
});

test("drawItemShape draws a keg with fuse spark and warning mark", () => {
  const item = {
    id: 13,
    type: "keg",
    x: 140,
    y: 140,
    r: 18,
    grabbed: true,
    art: { rot: 0.1, fuse: 0.25 },
    keg: { stage: "pull" },
  };

  const { ctx, result } = draw(item, { now: 720 });

  assert.equal(result, true);
  assert.ok(ctx.calls.some((call) => call[0] === "fillText" && call[1] === "!"));
  assert.ok(ctx.calls.some((call) => call[0] === "globalCompositeOperation" && call[1] === "lighter"));
  assert.ok(
    ctx.calls.some(
      (call) => call[0] === "createRadialGradient" && call[1] === 16 && call[2] === -4 && call[6] === 18,
    ),
  );
});

test("drawItemShape falls back to mystery bag art for unknown item types", () => {
  const item = {
    id: 21,
    type: "mystery",
    x: 30,
    y: 45,
    r: 14,
    grabbed: true,
    art: { rot: 0.05 },
  };

  const { ctx, result } = draw(item);

  assert.equal(result, true);
  assert.ok(ctx.calls.some((call) => call[0] === "fillText" && call[1] === "?"));
  assert.ok(ctx.calls.some((call) => call[0] === "ellipse" && call[1] === 0 && call[2] === -item.r * 0.28));
  assert.ok(ctx.calls.some((call) => call[0] === "fillStyle" && call[1] === "#6a3a9e"));
});
