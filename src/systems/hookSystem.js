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

function assertArray(value, name) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${name} must be an array`);
  }
}

function assertTrailPoint(point, index) {
  assertObject(point, `trail[${index}]`);
  assertFiniteNumber(point.x, `trail[${index}].x`);
  assertFiniteNumber(point.y, `trail[${index}].y`);
  assertFiniteNumber(point.age, `trail[${index}].age`);
}

function assertPoint(point, name) {
  assertObject(point, name);
  assertFiniteNumber(point.x, `${name}.x`);
  assertFiniteNumber(point.y, `${name}.y`);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function smoothTo(current, target, speed, dt) {
  const t = 1 - Math.exp(-Math.max(0, speed) * Math.max(0, dt));
  return current + (target - current) * clamp(t, 0, 1);
}

export function getHookDir(angle) {
  assertFiniteNumber(angle, "angle");
  return { x: Math.sin(angle), y: Math.cos(angle) };
}

export function getHookEndPoint({ pivot, angle, length }) {
  assertPoint(pivot, "pivot");
  assertFiniteNumber(angle, "angle");
  assertFiniteNumber(length, "length");

  const dir = getHookDir(angle);
  return { x: pivot.x + dir.x * length, y: pivot.y + dir.y * length };
}

export function clampHookLength(length, { minLength, maxLength }) {
  assertFiniteNumber(length, "length");
  assertFiniteNumber(minLength, "minLength");
  assertFiniteNumber(maxLength, "maxLength");
  return clamp(length, minLength, maxLength);
}

export function updateHookTrailState({
  trail,
  state,
  end,
  dt,
  life = 0.55,
  minDistance = 7,
  maxPoints = 28,
}) {
  assertArray(trail, "trail");
  assertFiniteNumber(dt, "dt");
  assertFiniteNumber(life, "life");
  assertFiniteNumber(minDistance, "minDistance");
  assertFiniteNumber(maxPoints, "maxPoints");
  if (maxPoints < 0) throw new RangeError("maxPoints must be non-negative");

  for (let i = 0; i < trail.length; i += 1) {
    assertTrailPoint(trail[i], i);
  }

  const active = state === "extend" || state === "retract";
  if (active) assertPoint(end, "end");

  for (let i = trail.length - 1; i >= 0; i -= 1) {
    trail[i].age += dt;
    if (trail[i].age >= life) trail.splice(i, 1);
  }

  if (!active) return trail;

  const last = trail[trail.length - 1] ?? null;
  if (!last || dist2(last.x, last.y, end.x, end.y) >= minDistance * minDistance) {
    trail.push({ x: end.x, y: end.y, age: 0 });
    if (trail.length > maxPoints) trail.shift();
  } else {
    last.x = end.x;
    last.y = end.y;
  }

  return trail;
}

export function updateHookSwingState(hook, dt) {
  assertObject(hook, "hook");
  assertFiniteNumber(dt, "dt");
  assertFiniteNumber(hook.angle, "hook.angle");
  assertFiniteNumber(hook.angleDir, "hook.angleDir");
  assertFiniteNumber(hook.angleSpeed, "hook.angleSpeed");
  assertFiniteNumber(hook.minAngle, "hook.minAngle");
  assertFiniteNumber(hook.maxAngle, "hook.maxAngle");

  if (hook.state !== "swing") return hook;

  hook.angle += hook.angleDir * hook.angleSpeed * dt;
  if (hook.angle >= hook.maxAngle) {
    hook.angle = hook.maxAngle;
    hook.angleDir = -1;
  } else if (hook.angle <= hook.minAngle) {
    hook.angle = hook.minAngle;
    hook.angleDir = 1;
  }

  return hook;
}

export function updateHookReelState(hook, { prevLength, dt, smoothSpeed = 10.5 }) {
  assertObject(hook, "hook");
  assertFiniteNumber(hook.length, "hook.length");
  assertFiniteNumber(hook.reelAngle, "hook.reelAngle");
  assertFiniteNumber(prevLength, "prevLength");
  assertFiniteNumber(dt, "dt");
  assertFiniteNumber(smoothSpeed, "smoothSpeed");
  if (hook.spoolSpeed !== undefined) assertFiniteNumber(hook.spoolSpeed, "hook.spoolSpeed");

  const deltaLen = hook.length - prevLength;
  if (Math.abs(deltaLen) > 0.0001) {
    hook.reelAngle += deltaLen / 10;
    hook.lastLength = hook.length;
  }
  const speed = deltaLen / Math.max(0.001, dt);
  hook.spoolSpeed = smoothTo(hook.spoolSpeed ?? 0, speed, smoothSpeed, dt);

  return hook;
}
