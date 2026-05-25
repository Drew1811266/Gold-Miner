import { clamp } from "../core/geometry.js";
import { createRng } from "../core/rng.js";

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

export function createSceneData(options) {
  assertObject(options, "createSceneData options");

  const { seed, viewport } = options;
  assertFiniteNumber(seed, "createSceneData seed");
  assertObject(viewport, "createSceneData viewport");
  assertFiniteNumber(viewport.w, "createSceneData viewport.w");
  assertFiniteNumber(viewport.h, "createSceneData viewport.h");

  const rng = createRng((seed ^ 0x9e3779b9) >>> 0);
  const w = viewport.w;
  const h = viewport.h;
  const groundY = h * 0.72;

  const stars = [];
  const starCount = clamp(Math.floor((w * groundY) / 19000), 36, 76);
  for (let i = 0; i < starCount; i += 1) {
    stars.push({
      x: rng.range(0, w),
      y: rng.range(0, groundY * 0.58),
      r: rng.range(0.6, 1.8),
      a: rng.range(0.08, 0.28),
      tw: rng.range(0, Math.PI * 2),
    });
  }

  const dust = [];
  const dustCount = clamp(Math.floor((w * (h - groundY)) / 9000), 55, 130);
  for (let i = 0; i < dustCount; i += 1) {
    dust.push({
      x: rng.range(0, w),
      y: rng.range(groundY + 10, h),
      r: rng.range(0.8, 2.2),
      a: rng.range(0.03, 0.12),
      tw: rng.range(0, Math.PI * 2),
    });
  }

  const dirt = [];
  const dirtCount = clamp(Math.floor((w * (h - groundY)) / 5200), 90, 190);
  for (let i = 0; i < dirtCount; i += 1) {
    dirt.push({
      x: rng.range(0, w),
      y: rng.range(groundY + 12, h),
      r: rng.range(0.6, 3.4),
      a: rng.range(0.05, 0.18),
      hue: rng.range(-0.08, 0.08),
    });
  }

  return { stars, dust, dirt };
}
