import {
  ITEM_COUNT_SCALE,
  ITEM_PLACEMENT,
  LEVEL_VALUE_RANDOM_MAX,
  LEVEL_VALUE_RANDOM_MIN,
  LEVEL_VALUE_RANDOM_START_LEVEL,
  MARKET_SEED_SALT,
  MAX_LEVEL_TIME,
  MIN_LEVEL_TIME,
  MOUSE_MAX_PER_LEVEL,
  MOUSE_MIN_LEVEL,
  TWO_PLAYER_TARGET_MULTIPLIER,
} from "../config/items.js";
import { getLevelConfig } from "../config/levels.js";
import { clamp, dist2 } from "../core/geometry.js";
import { createRng } from "../core/rng.js";
import { computeDdaTuning } from "./ddaSystem.js";
import { createItemArt, createItemSpec, intRange, makeItem } from "./itemFactory.js";
import { createMarketDay } from "./marketSystem.js";

// Keep in sync with the largest radius emitted by createItemSpec(), currently large gold.
const MAX_ITEM_RADIUS = 40;
const MIN_VIEWPORT_WIDTH = (ITEM_PLACEMENT.margin + MAX_ITEM_RADIUS) * 2;
const MIN_VIEWPORT_HEIGHT = ITEM_PLACEMENT.minY + ITEM_PLACEMENT.margin + MAX_ITEM_RADIUS * 2;

// This order is a fixed seed output contract. Changing it changes RNG consumption and level baselines.
const SPAWN_ORDER = Object.freeze([
  Object.freeze({ key: "goldSmall", type: "gold", size: "small" }),
  Object.freeze({ key: "goldMedium", type: "gold", size: "medium" }),
  Object.freeze({ key: "goldLarge", type: "gold", size: "large" }),
  Object.freeze({ key: "rock", type: "rock" }),
  Object.freeze({ key: "diamond", type: "diamond" }),
  Object.freeze({ key: "bag", type: "bag", includeExtraBags: true }),
  Object.freeze({ key: "bar", type: "bar" }),
  Object.freeze({ key: "emerald", type: "emerald" }),
  Object.freeze({ key: "ruby", type: "ruby" }),
  Object.freeze({ key: "crystal", type: "crystal" }),
  Object.freeze({ key: "pouch", type: "pouch" }),
  Object.freeze({ key: "keg", type: "keg" }),
  Object.freeze({ key: "fossil", type: "fossil" }),
]);

function scaledCount(count, key, mixMul) {
  return Math.max(0, Math.round((count ?? 0) * ITEM_COUNT_SCALE * mixMul(key)));
}

function shuffleInPlace(items, rng) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

function canPlace(item, items) {
  for (const other of items) {
    const minDist = item.r + other.r + ITEM_PLACEMENT.minGap;
    if (dist2(item.x, item.y, other.x, other.y) <= minDist * minDist) return false;
  }
  return true;
}

function validateMode(mode) {
  if (mode !== "single" && mode !== "double") {
    throw new RangeError('mode must be "single" or "double"');
  }
  return mode;
}

function validateExtraBags(extraBags) {
  if (!Number.isInteger(extraBags) || extraBags < 0) {
    throw new RangeError("extraBags must be a non-negative integer");
  }
  return extraBags;
}

function validateLevel(level) {
  if (!Number.isInteger(level) || level < 1) {
    throw new RangeError("level must be a positive integer");
  }
  return level;
}

function validateRunSeed(runSeed) {
  if (!Number.isInteger(runSeed)) {
    throw new RangeError("runSeed must be an integer");
  }
  return runSeed;
}

function validateDdaRating(ddaRating) {
  if (!Number.isFinite(ddaRating)) {
    throw new TypeError("ddaRating must be a finite number");
  }
  return ddaRating;
}

function validateViewport(viewport) {
  const viewportType = typeof viewport;
  if (viewport === null || viewportType !== "object") {
    throw new TypeError("viewport must be an object with finite w and h");
  }

  const { w, h } = viewport;
  if (!Number.isFinite(w) || !Number.isFinite(h)) {
    throw new TypeError("viewport w and h must be finite numbers");
  }

  if (w < MIN_VIEWPORT_WIDTH || h < MIN_VIEWPORT_HEIGHT) {
    throw new RangeError(
      `viewport is too small; minimum size is ${MIN_VIEWPORT_WIDTH}x${MIN_VIEWPORT_HEIGHT}`,
    );
  }

  return { w, h };
}

export function generateLevelData(options = {}) {
  if (options === null || typeof options !== "object") {
    throw new TypeError("generateLevelData options must be an object");
  }

  const {
    level,
    runSeed,
    viewport,
    mode = "single",
    ddaRating = 0,
    extraBags = 0,
  } = options;
  const safeLevel = validateLevel(level);
  const safeRunSeed = validateRunSeed(runSeed);
  const safeMode = validateMode(mode);
  const safeDdaRating = validateDdaRating(ddaRating);
  const safeExtraBags = validateExtraBags(extraBags);
  const safeViewport = validateViewport(viewport);

  const config = getLevelConfig(safeLevel);
  const dda = computeDdaTuning(safeLevel, safeDdaRating);
  const playerMul = safeMode === "double" ? TWO_PLAYER_TARGET_MULTIPLIER : 1;
  const target = Math.ceil(config.target * playerMul * dda.targetMul);
  const timeLeft = clamp(Math.round(config.time * dda.timeMul), MIN_LEVEL_TIME, MAX_LEVEL_TIME);
  const seed = (config.seed ?? 0) + safeRunSeed;
  const rng = createRng(seed);
  const market = createMarketDay(createRng((seed ^ MARKET_SEED_SALT) >>> 0));
  const levelValueMultiplier =
    safeLevel >= LEVEL_VALUE_RANDOM_START_LEVEL
      ? rng.range(LEVEL_VALUE_RANDOM_MIN, LEVEL_VALUE_RANDOM_MAX)
      : 1;

  const mixMul = typeof dda.mixMul === "function" ? dda.mixMul : () => 1;
  const mouseMax = Number.isFinite(dda.mouseMax) ? dda.mouseMax : MOUSE_MAX_PER_LEVEL;
  const specContext = {
    level: safeLevel,
    rng,
    marketMultipliers: market.multipliers ?? {},
    levelValueMultiplier,
    dda,
  };
  const buildSpec = (type, size) => createItemSpec({ ...specContext, type, size });

  const spawnQueue = [];
  for (const spawn of SPAWN_ORDER) {
    const count =
      scaledCount(config.mix[spawn.key], spawn.key, mixMul) +
      (spawn.includeExtraBags ? safeExtraBags : 0);
    for (let i = 0; i < count; i += 1) {
      spawnQueue.push(buildSpec(spawn.type, spawn.size));
    }
  }

  if (safeLevel >= MOUSE_MIN_LEVEL) {
    const mouseCount = intRange(rng, 1, mouseMax);
    for (let i = 0; i < mouseCount; i += 1) spawnQueue.push(buildSpec("mouse"));
  }

  shuffleInPlace(spawnQueue, rng);

  const items = [];
  let nextId = 1;
  for (const spec of spawnQueue) {
    let placed = false;
    for (let attempt = 0; attempt < ITEM_PLACEMENT.attempts; attempt += 1) {
      const x = rng.range(ITEM_PLACEMENT.margin + spec.r, safeViewport.w - ITEM_PLACEMENT.margin - spec.r);
      const y = rng.range(ITEM_PLACEMENT.minY + spec.r, safeViewport.h - ITEM_PLACEMENT.margin - spec.r);
      const item = makeItem({ id: nextId++, ...spec, x, y });
      item.art = createItemArt(item, rng);
      if (canPlace(item, items)) {
        items.push(item);
        placed = true;
        break;
      }
    }
    if (!placed) {
      nextId -= 1;
    }
  }

  return {
    config,
    dda,
    seed,
    target,
    timeLeft,
    levelTimeTotal: timeLeft,
    market,
    levelValueMultiplier,
    items,
  };
}
