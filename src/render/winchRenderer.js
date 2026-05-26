import { clamp } from "../core/geometry.js";
import { drawCrayonImageAsset } from "./crayonArtAssets.js";

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

function validateCtx(ctx, ownerName) {
  assertObject(ctx, `${ownerName} ctx`);
  for (const methodName of [
    "save",
    "restore",
    "beginPath",
    "arc",
    "ellipse",
    "fill",
    "stroke",
    "moveTo",
    "lineTo",
    "rotate",
    "translate",
    "drawImage",
    "createLinearGradient",
    "createRadialGradient",
    "arcTo",
    "closePath",
  ]) {
    assertMethod(ctx, methodName, "ctx");
  }
}

function validatePoint(point, name) {
  assertObject(point, name);
  assertFiniteNumber(point.x, `${name}.x`);
  assertFiniteNumber(point.y, `${name}.y`);
}

function validateHook(hook, ownerName) {
  assertObject(hook, `${ownerName} hook`);
  assertFiniteNumber(hook.reelAngle, `${ownerName} hook.reelAngle`);
  if (hook.spoolSpeed !== undefined) {
    assertFiniteNumber(hook.spoolSpeed, `${ownerName} hook.spoolSpeed`);
  }
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function validateReelOptions({ ctx, pivot, centerY, hook }) {
  validateCtx(ctx, "drawReelLayer");
  validatePoint(pivot, "drawReelLayer pivot");
  assertFiniteNumber(centerY, "drawReelLayer centerY");
  validateHook(hook, "drawReelLayer");
}

function validateWinchOptions({ ctx, pivot, reel, plankY, hook }) {
  validateCtx(ctx, "drawWinchLayer");
  validatePoint(pivot, "drawWinchLayer pivot");
  validatePoint(reel, "drawWinchLayer reel");
  assertFiniteNumber(plankY, "drawWinchLayer plankY");
  validateHook(hook, "drawWinchLayer");
}

export function drawReelLayer(options = {}) {
  const { ctx, pivot, centerY, hook, artAssets = null } = options;
  validateReelOptions({ ctx, pivot, centerY, hook });

  const rOuter = 16;
  const rInner = 7.5;
  const spin = hook.reelAngle;
  const spool = Math.abs(hook.spoolSpeed ?? 0);
  const blur = clamp((spool - 160) / 780, 0, 1);

  ctx.save();
  try {
    ctx.translate(pivot.x, centerY);
    drawCrayonImageAsset(ctx, artAssets?.get?.("sprite.winchReel"), -20, -20, 40, 40);

    if (blur > 0.001) {
      ctx.save();
      try {
        ctx.globalCompositeOperation = "lighter";
        ctx.lineCap = "round";
        ctx.lineWidth = 2.4;
        ctx.globalAlpha = 0.12 + 0.28 * blur;
        ctx.strokeStyle = "rgba(255,255,255,0.65)";
        for (let i = 0; i < 5; i += 1) {
          const a0 = spin + i * 0.95;
          const a1 = a0 + 0.55 + blur * 0.38;
          ctx.beginPath();
          ctx.arc(0, 0, rOuter + 2.4, a0, a1);
          ctx.stroke();
        }
        ctx.globalAlpha = 0.06 + 0.14 * blur;
        ctx.strokeStyle = "rgba(255, 211, 77, 0.65)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, rOuter + 1.4, spin, spin + 1.65 + blur * 0.65);
        ctx.stroke();
      } finally {
        ctx.restore();
      }
    }

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(3, 4, rOuter * 1.05, rOuter * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();

    const ring = ctx.createRadialGradient(-6, -7, 2, 0, 0, rOuter);
    ring.addColorStop(0, "#ffffff");
    ring.addColorStop(0.35, "#d8d8d8");
    ring.addColorStop(0.65, "#9a9a9a");
    ring.addColorStop(1, "#f1f1f1");
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.arc(0, 0, rOuter, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-1.5, -1.5, rOuter - 1.5, 0, Math.PI * 2);
    ctx.stroke();

    const hub = ctx.createRadialGradient(-2, -2, 1, 0, 0, rInner);
    hub.addColorStop(0, "#7a7a7a");
    hub.addColorStop(1, "#1f1f1f");
    ctx.fillStyle = hub;
    ctx.beginPath();
    ctx.arc(0, 0, rInner, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(spin);
    ctx.strokeStyle = "rgba(0,0,0,0.42)";
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(rOuter - 4, 0);
      ctx.stroke();
      ctx.rotate((Math.PI * 2) / 3);
    }

    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(rOuter - 4, 0);
      ctx.stroke();
      ctx.rotate((Math.PI * 2) / 3);
    }

    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.moveTo(rInner + 1.2, 0);
    ctx.lineTo(rOuter - 5.2, 0);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(rInner + 2.2, -0.6);
    ctx.lineTo(rOuter - 6.2, -0.6);
    ctx.stroke();

    ctx.fillStyle = "#ffd34d";
    ctx.beginPath();
    ctx.arc(rOuter - 2, 0, 3.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.arc(rOuter - 1, 1, 1.3, 0, Math.PI * 2);
    ctx.fill();
  } finally {
    ctx.restore();
  }

  return { drewReel: true };
}

export function drawWinchLayer(options = {}) {
  const { ctx, pivot, reel, plankY, hook, artAssets = null } = options;
  validateWinchOptions({ ctx, pivot, reel, plankY, hook });

  ctx.save();
  try {
    ctx.save();
    try {
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.beginPath();
      ctx.ellipse(reel.x + 8, plankY + 6, 44, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    } finally {
      ctx.restore();
    }

    drawCrayonImageAsset(ctx, artAssets?.get?.("sprite.winchPlate"), reel.x - 42, plankY - 29, 84, 34);

    const plateW = 72;
    const plateH = 26;
    const plateX = reel.x - plateW / 2;
    const plateY = plankY - plateH + 3;
    const metal = ctx.createLinearGradient(plateX, plateY, plateX + plateW, plateY + plateH);
    metal.addColorStop(0, "#f3f3f3");
    metal.addColorStop(0.5, "#a9a9a9");
    metal.addColorStop(1, "#e8e8e8");
    ctx.fillStyle = "rgba(0,0,0,0.30)";
    roundRectPath(ctx, plateX + 2, plateY + 3, plateW, plateH, 8);
    ctx.fill();
    ctx.fillStyle = metal;
    roundRectPath(ctx, plateX, plateY, plateW, plateH, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1.1;
    ctx.stroke();

    const bolt = (x, y2) => {
      const g = ctx.createRadialGradient(x - 1, y2 - 1, 1, x, y2, 6);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(1, "#6c6c6c");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y2, 4.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.beginPath();
      ctx.arc(x + 1.2, y2 + 1.1, 1.4, 0, Math.PI * 2);
      ctx.fill();
    };
    bolt(plateX + 14, plateY + 9);
    bolt(plateX + plateW - 14, plateY + 9);
    bolt(plateX + 14, plateY + plateH - 9);
    bolt(plateX + plateW - 14, plateY + plateH - 9);

    drawReelLayer({ ctx, pivot, centerY: reel.y, hook, artAssets });
  } finally {
    ctx.restore();
  }

  return { drewWinch: true, drewReel: true };
}
