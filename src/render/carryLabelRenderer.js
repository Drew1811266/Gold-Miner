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

function assertNonEmptyString(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function validateCtx(ctx) {
  assertObject(ctx, "drawCarryLabelLayer ctx");
  for (const methodName of [
    "save",
    "restore",
    "beginPath",
    "arc",
    "fill",
    "stroke",
    "fillText",
    "measureText",
  ]) {
    assertMethod(ctx, methodName, "ctx");
  }
}

function validateCarryLabelOptions({ ctx, end, viewport, color, text }) {
  validateCtx(ctx);
  assertObject(end, "drawCarryLabelLayer end");
  assertFiniteNumber(end.x, "drawCarryLabelLayer end.x");
  assertFiniteNumber(end.y, "drawCarryLabelLayer end.y");
  assertObject(viewport, "drawCarryLabelLayer viewport");
  assertPositiveNumber(viewport.w, "drawCarryLabelLayer viewport.w");
  assertPositiveNumber(viewport.h, "drawCarryLabelLayer viewport.h");
  assertNonEmptyString(color, "drawCarryLabelLayer color");
  assertNonEmptyString(text, "drawCarryLabelLayer text");
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.arc(x + rr, y + rr, rr, Math.PI, Math.PI * 1.5);
  ctx.arc(x + w - rr, y + rr, rr, Math.PI * 1.5, Math.PI * 2);
  ctx.arc(x + w - rr, y + h - rr, rr, 0, Math.PI * 0.5);
  ctx.arc(x + rr, y + h - rr, rr, Math.PI * 0.5, Math.PI);
  ctx.arc(x + rr, y + rr, rr, Math.PI, Math.PI);
}

export function drawCarryLabelLayer({ ctx, end, viewport, color, text } = {}) {
  validateCarryLabelOptions({ ctx, end, viewport, color, text });

  ctx.save();
  try {
    ctx.font = "700 12px ui-sans-serif, system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const paddingX = 10;
    const dot = 10;
    const textW = ctx.measureText(text).width;
    const w = dot + 8 + textW + paddingX * 2;
    const h = 22;

    let x = end.x + 16;
    let y = end.y - 42;
    x = clamp(x, 8, viewport.w - w - 8);
    y = clamp(y, 8, viewport.h - h - 8);

    ctx.globalAlpha = 0.16;
    ctx.fillStyle = color;
    roundRectPath(ctx, x, y, w, h, 12);
    ctx.fill();

    ctx.globalAlpha = 0.94;
    ctx.fillStyle = "rgba(244, 226, 185, 0.94)";
    roundRectPath(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(70, 45, 25, 0.72)";
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.globalAlpha = 0.92;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + paddingX + dot / 2, y + h / 2, dot / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x + paddingX + dot / 2 - 1.2, y + h / 2 - 1.2, 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "rgba(45, 31, 20, 0.94)";
    ctx.fillText(text, x + paddingX + dot + 8, y + h / 2);
  } finally {
    ctx.restore();
  }

  return true;
}
