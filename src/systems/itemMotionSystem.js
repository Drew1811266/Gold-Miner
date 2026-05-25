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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function assertViewport(viewport) {
  assertObject(viewport, "viewport");
  assertFiniteNumber(viewport.w, "viewport.w");
  assertFiniteNumber(viewport.h, "viewport.h");
}

export function updateMouseItemMotion(
  item,
  { dt, viewport, margin = 34, minY = 170, fallbackSpeed = 70 },
) {
  assertObject(item, "item");
  if (item.type !== "mouse") return false;
  if (item.grabbed) return false;

  const mouse = item.mouse;
  if (!mouse) return false;

  assertObject(mouse, "item.mouse");
  assertFiniteNumber(dt, "dt");
  assertViewport(viewport);
  assertFiniteNumber(margin, "margin");
  assertFiniteNumber(minY, "minY");
  assertFiniteNumber(fallbackSpeed, "fallbackSpeed");
  assertFiniteNumber(item.x, "item.x");
  assertFiniteNumber(item.y, "item.y");
  assertFiniteNumber(item.r, "item.r");

  const vx = Number.isFinite(mouse.vx) ? mouse.vx : 0;
  item.x += vx * dt;

  const minX = margin + item.r;
  const maxX = viewport.w - margin - item.r;
  if (item.x <= minX) {
    item.x = minX;
    mouse.vx = Math.abs(vx || fallbackSpeed);
  } else if (item.x >= maxX) {
    item.x = maxX;
    mouse.vx = -Math.abs(vx || fallbackSpeed);
  }

  item.y = clamp(item.y, minY + item.r, viewport.h - margin - item.r);

  const phase = Number.isFinite(mouse.phase) ? mouse.phase : 0;
  mouse.phase = phase + dt * (3.5 + clamp(Math.abs(vx) / 90, 0, 2.2));

  return item;
}

export function updateFallingKegMotion(item, { dt, gravity = 1750 } = {}) {
  assertObject(item, "item");
  if (item.type !== "keg") return false;
  if (item.keg?.stage !== "fall") return false;

  assertObject(item.keg, "item.keg");
  assertFiniteNumber(dt, "dt");
  assertFiniteNumber(gravity, "gravity");
  assertFiniteNumber(item.x, "item.x");
  assertFiniteNumber(item.y, "item.y");

  const lockX = typeof item.keg.x0 === "number" ? item.keg.x0 : item.x;
  item.x = lockX;

  const vy = (item.keg.vy ?? 0) + gravity * dt;
  item.keg.vy = vy;
  item.y += vy * dt;

  if (item.art) item.art.rot = (item.art.rot ?? 0) + dt * (0.6 + vy / 1300) * 0.9;

  return item;
}
