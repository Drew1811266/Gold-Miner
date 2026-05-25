function assertRecord(value, name) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

function assertFunction(value, name) {
  if (typeof value !== "function") {
    throw new TypeError(`${name} must be a function`);
  }
}

function round(value, factor) {
  return Math.round(value * factor) / factor;
}

function carriedItemSnapshot(item) {
  if (!item) return null;
  return {
    id: item.id,
    type: item.type,
    r: round(item.r, 10),
    value: item.type === "bag" ? item.bagValue ?? item.value : item.value,
  };
}

function createHookDebugSnapshot({ hook, player, pivot, end, carried }) {
  return {
    player,
    pivot: { x: round(pivot.x, 10), y: round(pivot.y, 10) },
    hookEnd: { x: round(end.x, 10), y: round(end.y, 10) },
    hook: {
      state: hook.state,
      angle: round(hook.angle, 1000),
      length: round(hook.length, 10),
      maxLength: round(hook.maxLength, 10),
      attached: carriedItemSnapshot(carried),
    },
  };
}

function createItemDebugSnapshot(item) {
  const entry = {
    id: item.id,
    type: item.type,
    x: round(item.x, 10),
    y: round(item.y, 10),
    r: round(item.r, 10),
    value: item.value,
  };
  if (item.type === "mouse") {
    entry.cargo = item.mouse?.cargo ?? null;
    entry.vx = round(Number.isFinite(item.mouse?.vx) ? item.mouse.vx : 0, 10);
  }
  return entry;
}

export function createDebugSnapshot({
  game,
  hooks,
  getPivot,
  getHookEnd,
  attachedItem,
  itemLimit = 24,
} = {}) {
  assertRecord(game, "debug game");
  if (!Array.isArray(hooks)) throw new TypeError("debug hooks must be an array");
  assertFunction(getPivot, "debug getPivot");
  assertFunction(getHookEnd, "debug getHookEnd");
  assertFunction(attachedItem, "debug attachedItem");
  if (!Number.isInteger(itemLimit) || itemLimit < 0) {
    throw new TypeError("debug itemLimit must be a non-negative integer");
  }

  const hook0 = hooks[0] ?? game.hook;
  assertRecord(hook0, "debug primary hook");
  const pivot0 = getPivot(hook0);
  const end0 = getHookEnd(hook0);
  const carried0 = attachedItem(hook0);
  const items = (game.items ?? [])
    .filter((item) => !item.grabbed)
    .slice(0, itemLimit)
    .map(createItemDebugSnapshot);
  const hookSnapshots = hooks.map((hook, index) =>
    createHookDebugSnapshot({
      hook,
      player: index + 1,
      pivot: getPivot(hook),
      end: getHookEnd(hook),
      carried: attachedItem(hook),
    }),
  );
  const marketMultipliers = game.market?.multipliers ?? {};

  return {
    coordinateSystem: "origin top-left; +x right; +y down; units: px",
    phase: game.phase,
    paused: game.paused,
    mode: game.mode,
    dda: {
      stage: game.dda.stage,
      rating: round(game.dda.rating, 1000),
      post4Pressure: round(game.dda.post4Pressure, 1000),
      difficulty: round(game.dda.difficulty, 1000),
      targetMul: round(game.dda.targetMul, 1000),
      timeMul: round(game.dda.timeMul, 1000),
      lastOverRatio: round(game.dda.lastOverRatio, 1000),
      firstClearTimeLeft:
        game.dda.firstClearTimeLeft == null ? null : round(game.dda.firstClearTimeLeft, 100),
    },
    market: {
      name: game.market?.name ?? "交易日",
      summary: game.market?.summary ?? "金条±0%  钻石±0%  祖母绿±0%  红宝石±0%  水晶簇±0%",
      multipliers: {
        bar: round(marketMultipliers.bar ?? 1, 1000),
        diamond: round(marketMultipliers.diamond ?? 1, 1000),
        emerald: round(marketMultipliers.emerald ?? 1, 1000),
        ruby: round(marketMultipliers.ruby ?? 1, 1000),
        crystal: round(marketMultipliers.crystal ?? 1, 1000),
      },
    },
    level: game.level,
    score: game.score,
    target: game.target,
    inventory: {
      bombs: Math.max(0, Math.floor(Number.isFinite(game.inventory?.bombs) ? game.inventory.bombs : 0)),
      speed: Math.max(0, Math.floor(Number.isFinite(game.inventory?.speed) ? game.inventory.speed : 0)),
      lucky: Math.max(0, Math.floor(Number.isFinite(game.inventory?.lucky) ? game.inventory.lucky : 0)),
    },
    timeLeft: round(game.timeLeft, 100),
    seed: game.currentSeed || game.runSeed,
    hook: {
      state: hook0.state,
      angle: round(hook0.angle, 1000),
      length: round(hook0.length, 10),
      maxLength: round(hook0.maxLength, 10),
      attached: carriedItemSnapshot(carried0),
    },
    pivot: { x: round(pivot0.x, 10), y: round(pivot0.y, 10) },
    hookEnd: { x: round(end0.x, 10), y: round(end0.y, 10) },
    hooks: hookSnapshots,
    items,
  };
}

export function renderDebugSnapshotToText(input) {
  return JSON.stringify(createDebugSnapshot(input));
}

export function createDebugAdvancePlan(ms, { frameRate = 60 } = {}) {
  if (!Number.isFinite(frameRate) || frameRate <= 0) {
    throw new TypeError("debug frameRate must be a positive finite number");
  }
  const totalMs = Math.max(0, Number(ms) || 0);
  const stepMs = 1000 / frameRate;
  return {
    totalMs,
    stepMs,
    steps: Math.max(1, Math.round(totalMs / stepMs)),
    dt: 1 / frameRate,
  };
}

export function createDebugShopSetup({ game, score = 500 } = {}) {
  assertRecord(game, "debug shop game");
  if (!Number.isFinite(score) || score < 0) {
    throw new TypeError("debug shop score must be a non-negative finite number");
  }

  return {
    phase: "shop",
    paused: true,
    score,
  };
}
