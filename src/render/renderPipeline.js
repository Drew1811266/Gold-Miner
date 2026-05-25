const PLAYER_LAYER_NAMES = Object.freeze([
  "minerBack",
  "winch",
  "minerFront",
  "hookTrail",
  "hook",
  "carryLabel",
]);

function assertObject(value, name) {
  if (value === null || typeof value !== "object") {
    throw new TypeError(`${name} must be an object`);
  }
}

function assertFunction(value, name) {
  if (typeof value !== "function") {
    throw new TypeError(`${name} must be a function`);
  }
}

function assertMethod(value, methodName, ownerName) {
  if (typeof value?.[methodName] !== "function") {
    throw new TypeError(`${ownerName}.${methodName} must be a function`);
  }
}

function assertFiniteNumber(value, name) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
}

function assertString(value, name) {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string`);
  }
}

function assertBoolean(value, name) {
  if (typeof value !== "boolean") {
    throw new TypeError(`${name} must be a boolean`);
  }
}

function callLayer(layers, name) {
  const layer = layers[name];
  if (layer === undefined) return;
  assertFunction(layer, `layers.${name}`);
  layer();
}

function callPlayerLayer(layers, name, players) {
  const layer = layers[name];
  if (layer === undefined) return;
  assertFunction(layer, `layers.${name}`);

  for (const player of players) {
    layer(player.hook, player.miner, player.index);
  }
}

function getDefaultNow() {
  if (typeof globalThis.performance?.now === "function") {
    return globalThis.performance.now();
  }
  return Date.now();
}

export function createPlayerRenderOrder({ hooks, getMinerByIndex, getPivot } = {}) {
  if (!Array.isArray(hooks)) {
    throw new TypeError("createPlayerRenderOrder hooks must be an array");
  }
  assertFunction(getMinerByIndex, "createPlayerRenderOrder getMinerByIndex");
  assertFunction(getPivot, "createPlayerRenderOrder getPivot");

  return hooks
    .map((hook, index) => {
      const pivot = getPivot(hook);
      assertObject(pivot, "createPlayerRenderOrder getPivot result");
      assertFiniteNumber(pivot.x, "createPlayerRenderOrder pivot.x");

      return {
        hook,
        miner: getMinerByIndex(index),
        index,
        pivotX: pivot.x,
      };
    })
    .sort((a, b) => a.pivotX - b.pivotX);
}

export function renderFrameWithLayers(options = {}) {
  assertObject(options, "renderFrameWithLayers options");

  const {
    ctx,
    canvas,
    viewport,
    dpr,
    fx,
    phase,
    paused,
    timeLeft,
    players,
    layers,
    now = getDefaultNow(),
  } = options;

  assertObject(ctx, "renderFrameWithLayers ctx");
  assertMethod(ctx, "setTransform", "ctx");
  assertMethod(ctx, "clearRect", "ctx");
  assertMethod(ctx, "save", "ctx");
  assertMethod(ctx, "restore", "ctx");
  assertMethod(ctx, "fillRect", "ctx");
  assertObject(canvas, "renderFrameWithLayers canvas");
  assertFiniteNumber(canvas.width, "renderFrameWithLayers canvas.width");
  assertFiniteNumber(canvas.height, "renderFrameWithLayers canvas.height");
  assertObject(viewport, "renderFrameWithLayers viewport");
  assertFiniteNumber(viewport.w, "renderFrameWithLayers viewport.w");
  assertFiniteNumber(viewport.h, "renderFrameWithLayers viewport.h");
  assertFiniteNumber(dpr, "renderFrameWithLayers dpr");
  assertObject(fx, "renderFrameWithLayers fx");
  if (!Array.isArray(players)) {
    throw new TypeError("renderFrameWithLayers players must be an array");
  }
  assertObject(layers, "renderFrameWithLayers layers");
  assertString(phase, "renderFrameWithLayers phase");
  assertBoolean(paused, "renderFrameWithLayers paused");
  assertFiniteNumber(timeLeft, "renderFrameWithLayers timeLeft");
  assertFiniteNumber(now, "renderFrameWithLayers now");

  const shakeX = fx.shakeX ?? 0;
  const shakeY = fx.shakeY ?? 0;
  const flash = fx.flash ?? 0;
  assertFiniteNumber(shakeX, "renderFrameWithLayers fx.shakeX");
  assertFiniteNumber(shakeY, "renderFrameWithLayers fx.shakeY");
  assertFiniteNumber(flash, "renderFrameWithLayers fx.flash");

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, shakeX * dpr, shakeY * dpr);

  callLayer(layers, "background");
  callLayer(layers, "plank");
  callPlayerLayer(layers, PLAYER_LAYER_NAMES[0], players);
  callPlayerLayer(layers, PLAYER_LAYER_NAMES[1], players);
  callPlayerLayer(layers, PLAYER_LAYER_NAMES[2], players);
  callLayer(layers, "items");
  callPlayerLayer(layers, PLAYER_LAYER_NAMES[3], players);
  callPlayerLayer(layers, PLAYER_LAYER_NAMES[4], players);
  callPlayerLayer(layers, PLAYER_LAYER_NAMES[5], players);
  callLayer(layers, "fx");

  if (flash > 0) {
    ctx.save();
    ctx.globalAlpha = flash;
    ctx.fillStyle = "#fff1c4";
    ctx.fillRect(0, 0, viewport.w, viewport.h);
    ctx.restore();
  }

  if (phase === "playing" && !paused && timeLeft <= 10) {
    ctx.save();
    ctx.globalAlpha = 0.12 + 0.08 * Math.sin(now / 110);
    ctx.fillStyle = "#ff2a2a";
    ctx.fillRect(0, 0, viewport.w, viewport.h);
    ctx.restore();
  }
}
