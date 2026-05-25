export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function segmentCircleIntersect(ax, ay, bx, by, cx, cy, radius) {
  const abx = bx - ax;
  const aby = by - ay;
  const acx = cx - ax;
  const acy = cy - ay;

  const abLen2 = abx * abx + aby * aby;
  if (abLen2 <= 1e-6) return dist2(ax, ay, cx, cy) <= radius * radius;

  const t = clamp((acx * abx + acy * aby) / abLen2, 0, 1);
  const hx = ax + abx * t;
  const hy = ay + aby * t;
  return dist2(hx, hy, cx, cy) <= radius * radius;
}
