import { test } from "node:test";
import assert from "node:assert/strict";
import { drawBackgroundLayer, drawPlankLayer } from "../../src/render/backgroundRenderer.js";

const COLORS = Object.freeze({
  skyTop: "#0f1731",
  skyBottom: "#070a13",
  groundTop: "#1d1a13",
  groundBottom: "#0e0b08",
  wood: "#7a4b2a",
});

function createFakeCtx() {
  const calls = [];

  function createGradient(type, args) {
    const gradient = {
      type,
      args,
      stops: [],
      addColorStop(offset, color) {
        gradient.stops.push([offset, color]);
        calls.push(["addColorStop", type, offset, color]);
      },
    };
    calls.push([type, ...args, gradient]);
    return gradient;
  }

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
    arc(...args) {
      calls.push(["arc", ...args]);
    },
    fill() {
      calls.push(["fill"]);
    },
    fillRect(...args) {
      calls.push(["fillRect", ...args]);
    },
    drawImage(...args) {
      calls.push(["drawImage", ...args]);
    },
    createLinearGradient(...args) {
      return createGradient("createLinearGradient", args);
    },
    createRadialGradient(...args) {
      return createGradient("createRadialGradient", args);
    },
    set fillStyle(value) {
      calls.push(["fillStyle", value]);
    },
    set globalAlpha(value) {
      calls.push(["globalAlpha", value]);
    },
    set globalCompositeOperation(value) {
      calls.push(["globalCompositeOperation", value]);
    },
  };
}

function backgroundOptions(overrides = {}) {
  return {
    ctx: createFakeCtx(),
    viewport: { w: 400, h: 300 },
    background: { stars: false },
    image: null,
    scene: { stars: [], dust: [] },
    colors: COLORS,
    now: 0,
    ...overrides,
  };
}

function createLoadedAsset(label) {
  return { status: "loaded", image: { label, naturalWidth: 1200, naturalHeight: 675 } };
}

function createRegistry(entries) {
  return {
    get(key) {
      return entries[key] ?? null;
    },
  };
}

test("drawBackgroundLayer draws valid images with cover crop before overlays", () => {
  const ctx = createFakeCtx();

  drawBackgroundLayer(
    backgroundOptions({
      ctx,
      image: { naturalWidth: 800, naturalHeight: 200 },
    }),
  );

  const firstCall = ctx.calls[0];
  assert.equal(firstCall[0], "drawImage");
  assert.equal(firstCall[1].naturalWidth, 800);
  assert.equal(firstCall[2], 266.6666666666667);
  assert.equal(firstCall[3], 0);
  assert.equal(firstCall[4], 266.66666666666663);
  assert.equal(firstCall[5], 200);
  assert.deepEqual(firstCall.slice(6), [0, 0, 400, 300]);
  assert.equal(ctx.calls.some((call) => call[0] === "createLinearGradient"), false);
  assert.equal(ctx.calls.filter((call) => call[0] === "createRadialGradient").length, 2);
});

test("drawBackgroundLayer draws sky and ground gradients when image is unavailable", () => {
  const ctx = createFakeCtx();

  drawBackgroundLayer(backgroundOptions({ ctx }));

  const gradients = ctx.calls.filter((call) => call[0] === "createLinearGradient");
  assert.equal(gradients.length, 2);
  assert.deepEqual(gradients[0].slice(1, 5), [0, 0, 0, 216]);
  assert.deepEqual(gradients[0][5].stops, [
    [0, "#1a2450"],
    [0.55, COLORS.skyTop],
    [1, COLORS.skyBottom],
  ]);
  assert.deepEqual(gradients[1].slice(1, 5), [0, 216, 0, 300]);
  assert.deepEqual(gradients[1][5].stops, [
    [0, "#2a241b"],
    [0.12, COLORS.groundTop],
    [1, COLORS.groundBottom],
  ]);
  assert.deepEqual(
    ctx.calls.filter((call) => call[0] === "fillRect").slice(0, 2),
    [
      ["fillRect", 0, 0, 400, 300],
      ["fillRect", 0, 216, 400, 84],
    ],
  );
});

test("drawBackgroundLayer prefers crayon background and paper texture when loaded", () => {
  const ctx = createFakeCtx();
  const artAssets = createRegistry({
    "background.mine": createLoadedAsset("mine"),
    "texture.paper": createLoadedAsset("paper"),
  });

  drawBackgroundLayer(backgroundOptions({ ctx, image: null, artAssets }));

  const imageCalls = ctx.calls.filter((call) => call[0] === "drawImage");
  assert.equal(imageCalls.length, 2);
  assert.equal(imageCalls[0][1].label, "mine");
  assert.equal(imageCalls[1][1].label, "paper");
  assert.equal(ctx.calls.some((call) => call[0] === "createLinearGradient"), false);
});

test("drawPlankLayer draws crayon wood beam asset when loaded", () => {
  const ctx = createFakeCtx();
  const artAssets = createRegistry({
    "texture.woodBeam": createLoadedAsset("wood"),
  });

  drawPlankLayer({
    ctx,
    viewport: { w: 400, h: 300 },
    plankY: 108,
    plankHeight: 22,
    colors: COLORS,
    artAssets,
  });

  assert.ok(ctx.calls.some((call) => call[0] === "drawImage" && call[1].label === "wood"));
});

test("drawBackgroundLayer draws stars, dust, light sweep, and vignette overlays", () => {
  const ctx = createFakeCtx();

  drawBackgroundLayer(
    backgroundOptions({
      ctx,
      background: { stars: true },
      scene: {
        stars: [{ x: 12, y: 24, r: 1.5, a: 0.4, tw: 0 }],
        dust: [{ x: 80, y: 260, r: 2, a: 0.2, tw: Math.PI / 2 }],
      },
      now: 0,
    }),
  );

  assert.ok(ctx.calls.some((call) => call[0] === "globalCompositeOperation" && call[1] === "lighter"));
  assert.ok(ctx.calls.some((call) => call[0] === "arc" && call[1] === 12 && call[2] === 24 && call[3] === 1.5));
  assert.ok(ctx.calls.some((call) => call[0] === "arc" && call[1] === 80 && call[2] === 260 && call[3] === 2));
  assert.deepEqual(
    ctx.calls.filter((call) => call[0] === "globalAlpha"),
    [
      ["globalAlpha", 0.06],
      ["globalAlpha", 0.22],
    ],
  );
  assert.equal(ctx.calls.filter((call) => call[0] === "createRadialGradient").length, 2);
  assert.ok(ctx.calls.some((call) => call[0] === "addColorStop" && call[1] === "createRadialGradient" && call[3] === "rgba(255,255,255,0.35)"));
  assert.ok(ctx.calls.some((call) => call[0] === "addColorStop" && call[1] === "createRadialGradient" && call[3] === "rgba(0,0,0,0.55)"));
});

test("drawPlankLayer draws beam, edge highlights, and seams", () => {
  const ctx = createFakeCtx();

  drawPlankLayer({
    ctx,
    viewport: { w: 400, h: 300 },
    plankY: 108,
    plankHeight: 22,
    colors: COLORS,
  });

  const beamGradient = ctx.calls.find((call) => call[0] === "createLinearGradient");
  assert.deepEqual(beamGradient.slice(1, 5), [0, 108, 0, 130]);
  assert.deepEqual(beamGradient[5].stops, [
    [0, "#9a663a"],
    [0.45, COLORS.wood],
    [1, "#5a351f"],
  ]);
  assert.deepEqual(ctx.calls.filter((call) => call[0] === "fillRect"), [
    ["fillRect", 0, 108, 400, 22],
    ["fillRect", 0, 128, 400, 2],
    ["fillRect", 0, 108, 400, 2],
    ["fillRect", 18, 108, 4, 22],
    ["fillRect", 90, 108, 4, 22],
    ["fillRect", 162, 108, 4, 22],
    ["fillRect", 234, 108, 4, 22],
    ["fillRect", 306, 108, 4, 22],
    ["fillRect", 378, 108, 4, 22],
  ]);
});

test("renderer rejects missing structural inputs", () => {
  assert.throws(() => drawBackgroundLayer(backgroundOptions({ ctx: null })), /ctx/);
  assert.throws(() => drawBackgroundLayer(backgroundOptions({ viewport: { w: 400 } })), /viewport/);
  assert.throws(() => drawBackgroundLayer(backgroundOptions({ background: null })), /background/);
  assert.throws(() => drawBackgroundLayer(backgroundOptions({ scene: { stars: [] } })), /scene/);
  assert.throws(() => drawBackgroundLayer(backgroundOptions({ colors: { skyTop: COLORS.skyTop } })), /colors/);
  assert.throws(() => drawBackgroundLayer(backgroundOptions({ now: Number.NaN })), /now/);

  assert.throws(
    () =>
      drawPlankLayer({
        ctx: createFakeCtx(),
        viewport: { w: 400, h: 300 },
        plankY: 108,
        plankHeight: 0,
        colors: COLORS,
      }),
    /plankHeight/,
  );
});
