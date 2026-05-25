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

function assertItemGeometry(item, name) {
  assertObject(item, name);
  assertFiniteNumber(item.x, `${name}.x`);
  assertFiniteNumber(item.y, `${name}.y`);
  assertFiniteNumber(item.r, `${name}.r`);
}

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function findFallingKegCollision({ items, kegItem, kegIndex }) {
  assertArray(items, "items");
  assertItemGeometry(kegItem, "kegItem");
  assertFiniteNumber(kegIndex, "kegIndex");

  for (let index = 0; index < items.length; index += 1) {
    if (index === kegIndex) continue;
    const item = items[index];
    assertItemGeometry(item, `items[${index}]`);

    const rr = kegItem.r + item.r;
    if (dist2(kegItem.x, kegItem.y, item.x, item.y) <= rr * rr) {
      return { item, id: item.id, index };
    }
  }

  return null;
}

export function selectKegBlastAffectedIds({ items, x, y, radius }) {
  assertArray(items, "items");
  assertFiniteNumber(x, "x");
  assertFiniteNumber(y, "y");
  assertFiniteNumber(radius, "radius");

  const affectedIds = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    assertItemGeometry(item, `items[${index}]`);

    const rr = radius + item.r * 0.15;
    if (dist2(x, y, item.x, item.y) <= rr * rr) affectedIds.push(item.id);
  }

  return affectedIds;
}
