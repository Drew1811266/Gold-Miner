import { clamp, lerp } from "../core/geometry.js";

const DEFAULT_TRAIL_COLOR = "rgba(255,255,255,0.85)";
const DEFAULT_TRAIL_LIFE = 0.55;

function assertObject(value, name) {
  if (value === null || typeof value !== "object") {
    throw new TypeError(`${name} must be an object`);
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

function assertPositiveNumber(value, name) {
  assertFiniteNumber(value, name);
  if (value <= 0) {
    throw new RangeError(`${name} must be greater than zero`);
  }
}

function assertColor(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}

function validateCtx(ctx) {
  assertObject(ctx, "drawHookTrailLayer ctx");
  for (const methodName of ["save", "restore", "beginPath", "moveTo", "lineTo", "stroke"]) {
    assertMethod(ctx, methodName, "ctx");
  }
}

function validateTrailPoint(point, index) {
  assertObject(point, `drawHookTrailLayer trail[${index}]`);
  assertFiniteNumber(point.x, `drawHookTrailLayer trail[${index}].x`);
  assertFiniteNumber(point.y, `drawHookTrailLayer trail[${index}].y`);
  assertFiniteNumber(point.age, `drawHookTrailLayer trail[${index}].age`);
}

export function drawHookTrailLayer({ ctx, trail, color = DEFAULT_TRAIL_COLOR, life = DEFAULT_TRAIL_LIFE } = {}) {
  validateCtx(ctx);
  if (!Array.isArray(trail)) {
    throw new TypeError("drawHookTrailLayer trail must be an array");
  }
  assertColor(color, "drawHookTrailLayer color");
  assertPositiveNumber(life, "drawHookTrailLayer life");

  if (trail.length < 2) return 0;

  for (let i = 0; i < trail.length; i += 1) {
    validateTrailPoint(trail[i], i);
  }

  ctx.save();
  try {
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (let i = 0; i < trail.length - 1; i += 1) {
      const p0 = trail[i];
      const p1 = trail[i + 1];
      const t = clamp(1 - p0.age / life, 0, 1);
      const a = 0.08 + 0.22 * t;

      ctx.globalAlpha = a * t;
      ctx.strokeStyle = color;
      ctx.lineWidth = lerp(1.2, 6.0, t);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();

      ctx.globalAlpha = a * 0.55 * t;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = lerp(0.7, 2.4, t);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
  } finally {
    ctx.restore();
  }

  return trail.length - 1;
}
