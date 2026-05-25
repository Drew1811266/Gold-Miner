function assertObject(value, name) {
  if (value === null || typeof value !== "object") {
    throw new TypeError(`${name} must be an object`);
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

export function createRenderSnapshot(options) {
  assertObject(options, "createRenderSnapshot options");

  const {
    game,
    ctx,
    canvas,
    dpr,
    players,
    layers,
    now,
  } = options;

  assertObject(game, "createRenderSnapshot game");
  assertObject(game.viewport, "createRenderSnapshot game.viewport");
  assertFiniteNumber(game.viewport.w, "createRenderSnapshot game.viewport.w");
  assertFiniteNumber(game.viewport.h, "createRenderSnapshot game.viewport.h");
  assertObject(game.fx, "createRenderSnapshot game.fx");
  assertString(game.phase, "createRenderSnapshot game.phase");
  assertBoolean(game.paused, "createRenderSnapshot game.paused");
  assertFiniteNumber(game.timeLeft, "createRenderSnapshot game.timeLeft");
  assertObject(ctx, "createRenderSnapshot ctx");
  assertObject(canvas, "createRenderSnapshot canvas");
  assertFiniteNumber(dpr, "createRenderSnapshot dpr");
  if (!Array.isArray(players)) {
    throw new TypeError("createRenderSnapshot players must be an array");
  }
  assertObject(layers, "createRenderSnapshot layers");
  assertFiniteNumber(now, "createRenderSnapshot now");

  return {
    ctx,
    canvas,
    viewport: game.viewport,
    dpr,
    fx: game.fx,
    phase: game.phase,
    paused: game.paused,
    timeLeft: game.timeLeft,
    players,
    layers,
    now,
  };
}
