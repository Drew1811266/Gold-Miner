import { lerp } from "./geometry.js";
import { createRng } from "./rng.js";

const RANDOM_STREAM_BASE_SEED = 0xa5f1523d;
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function assertFiniteInteger(value, label) {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new TypeError(`${label} must be a finite integer`);
  }
  return value >>> 0;
}

function assertStreamName(name) {
  if (typeof name !== "string" || name.trim() === "") {
    throw new TypeError("name must be a non-empty string");
  }
  return name;
}

function hashStringToUint32(value) {
  let hash = FNV_OFFSET;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
}

function mixUint32(value) {
  let mixed = value >>> 0;
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 0x7feb352d) >>> 0;
  mixed ^= mixed >>> 15;
  mixed = Math.imul(mixed, 0x846ca68b) >>> 0;
  mixed ^= mixed >>> 16;
  return mixed >>> 0;
}

function mixSeed(seed, value) {
  return mixUint32((seed ^ mixUint32(value)) >>> 0);
}

function createRandomStreamSeed({ runSeed, levelSeed = 0, name, salt = 0 }) {
  const runSeedPart = assertFiniteInteger(runSeed, "runSeed");
  const levelSeedPart = assertFiniteInteger(levelSeed, "levelSeed");
  const saltPart = assertFiniteInteger(salt, "salt");
  const namePart = hashStringToUint32(assertStreamName(name));

  let seed = RANDOM_STREAM_BASE_SEED;
  seed = mixSeed(seed, runSeedPart);
  seed = mixSeed(seed, levelSeedPart);
  seed = mixSeed(seed, saltPart);
  seed = mixSeed(seed, namePart);
  return seed >>> 0;
}

function assertRangeEndpoint(value, label) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }
}

function assertPickList(list) {
  if (!Array.isArray(list) || list.length === 0) {
    throw new TypeError("pick list must be a non-empty array");
  }
}

export function createRandomStream(options) {
  if (options === null || typeof options !== "object") {
    throw new TypeError("createRandomStream options must be an object");
  }

  const rng = createRng(createRandomStreamSeed(options));
  return {
    next() {
      return rng.next();
    },
    range(min, max) {
      assertRangeEndpoint(min, "min");
      assertRangeEndpoint(max, "max");
      return lerp(min, max, rng.next());
    },
    pick(list) {
      assertPickList(list);
      return list[Math.floor(rng.next() * list.length)];
    },
  };
}
