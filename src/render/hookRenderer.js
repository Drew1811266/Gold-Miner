import { clamp, lerp } from "../core/geometry.js";
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

function assertColorOrNull(value, name) {
  if (value === null) return;
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${name} must be null or a non-empty string`);
  }
}

function validateCtx(ctx) {
  assertObject(ctx, "drawHookLayer ctx");
  for (const methodName of [
    "save",
    "restore",
    "beginPath",
    "moveTo",
    "lineTo",
    "quadraticCurveTo",
    "bezierCurveTo",
    "arc",
    "arcTo",
    "ellipse",
    "fill",
    "stroke",
    "translate",
    "rotate",
    "createLinearGradient",
    "createRadialGradient",
    "setLineDash",
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

function validateHook(hook) {
  assertObject(hook, "drawHookLayer hook");
  assertFiniteNumber(hook.length, "drawHookLayer hook.length");
  assertFiniteNumber(hook.maxLength, "drawHookLayer hook.maxLength");
  if (hook.maxLength <= 0) {
    throw new RangeError("drawHookLayer hook.maxLength must be greater than zero");
  }
  if (typeof hook.state !== "string" || hook.state.length === 0) {
    throw new TypeError("drawHookLayer hook.state must be a non-empty string");
  }
  assertFiniteNumber(hook.angle, "drawHookLayer hook.angle");
  assertFiniteNumber(hook.reelAngle, "drawHookLayer hook.reelAngle");
  assertFiniteNumber(hook.clawClose, "drawHookLayer hook.clawClose");
}

function validateCarriedItem(carriedItem) {
  if (carriedItem === null) return;
  assertObject(carriedItem, "drawHookLayer carriedItem");
  assertFiniteNumber(carriedItem.r, "drawHookLayer carriedItem.r");
  if (typeof carriedItem.type !== "string" || carriedItem.type.length === 0) {
    throw new TypeError("drawHookLayer carriedItem.type must be a non-empty string");
  }
}

function validateHookConfig(hookConfig) {
  assertObject(hookConfig, "drawHookLayer hookConfig");
  assertFiniteNumber(hookConfig.ringToTip, "drawHookLayer hookConfig.ringToTip");
  assertFiniteNumber(hookConfig.jawBase, "drawHookLayer hookConfig.jawBase");
}

function validateHookLayerOptions({
  ctx,
  hook,
  pivot,
  tip,
  dir,
  carriedItem,
  canBomb,
  hookConfig,
  now,
  itemGlowColor,
}) {
  validateCtx(ctx);
  validateHook(hook);
  validatePoint(pivot, "drawHookLayer pivot");
  validatePoint(tip, "drawHookLayer tip");
  validatePoint(dir, "drawHookLayer dir");
  validateCarriedItem(carriedItem);
  if (typeof canBomb !== "boolean") {
    throw new TypeError("drawHookLayer canBomb must be a boolean");
  }
  validateHookConfig(hookConfig);
  assertFiniteNumber(now, "drawHookLayer now");
  assertColorOrNull(itemGlowColor, "drawHookLayer itemGlowColor");
  if (carriedItem && hook.state === "retract" && itemGlowColor === null) {
    throw new TypeError("drawHookLayer itemGlowColor must be provided when retracting a carried item");
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

export function drawHookLayer({
  ctx,
  hook,
  pivot,
  tip,
  dir,
  carriedItem = null,
  canBomb = false,
  hookConfig,
  now,
  itemGlowColor = null,
  artAssets = null,
} = {}) {
  validateHookLayerOptions({
    ctx,
    hook,
    pivot,
    tip,
    dir,
    carriedItem,
    canBomb,
    hookConfig,
    now,
    itemGlowColor,
  });

  const ring = {
    x: tip.x - dir.x * hookConfig.ringToTip,
    y: tip.y - dir.y * hookConfig.ringToTip,
  };

  ctx.save();
  try {
    const perp = { x: dir.y, y: -dir.x };
    const ropeLen = Math.max(0, hook.length - hookConfig.ringToTip);
    const t = clamp(hook.length / Math.max(1, hook.maxLength), 0, 1);
    const sway = (hook.state === "swing" ? 18 : 8) * (0.25 + 0.75 * t);
    const wobble = Math.sin(now / 260 + hook.angle * 1.7);
    const cx = pivot.x + dir.x * (ropeLen * 0.48 + hookConfig.ringToTip * 0.08) + perp.x * sway * wobble;
    const cy = pivot.y + dir.y * (ropeLen * 0.48 + hookConfig.ringToTip * 0.08) + perp.y * sway * wobble;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(pivot.x, pivot.y);
    ctx.quadraticCurveTo(cx, cy, ring.x, ring.y);
    ctx.stroke();

    const ropeGrad = ctx.createLinearGradient(pivot.x, pivot.y, ring.x, ring.y);
    ropeGrad.addColorStop(0, "rgba(255,255,255,0.95)");
    ropeGrad.addColorStop(1, "rgba(255,255,255,0.55)");
    ctx.strokeStyle = ropeGrad;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(pivot.x, pivot.y);
    ctx.quadraticCurveTo(cx, cy, ring.x, ring.y);
    ctx.stroke();

    // Rope motion hint (moving dashes)
    if (hook.state !== "swing") {
      ctx.save();
      try {
        ctx.globalAlpha = 0.22;
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = 1.2;
        ctx.setLineDash([6, 12]);
        ctx.lineDashOffset = -hook.reelAngle * 12;
        ctx.beginPath();
        ctx.moveTo(pivot.x, pivot.y);
        ctx.quadraticCurveTo(cx, cy, ring.x, ring.y);
        ctx.stroke();
      } finally {
        ctx.restore();
      }
    }

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(pivot.x, pivot.y, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.arc(pivot.x + 1.4, pivot.y + 1.2, 2.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(ring.x, ring.y);
    const theta = Math.atan2(dir.y, dir.x);
    ctx.rotate(theta - Math.PI / 2);
    drawCrayonImageAsset(ctx, artAssets?.get?.("sprite.hookClaw"), -24, -6, 48, 58);

    const close = clamp(hook.clawClose ?? 0, 0, 1);
    const sizeR = carriedItem ? carriedItem.r : 0;
    const sizeT = clamp((sizeR - 11) / 30, 0, 1); // ~diamond -> large gold
    const closeLimit = lerp(1, 0.58, sizeT); // bigger item => leave more gap
    const gripClose = close * closeLimit;

    // ---- Claw (fully redesigned; inward-curling tri-prong) ----
    const baseY = hookConfig.jawBase;
    const tipY = hookConfig.ringToTip;
    const jawLen = Math.max(10, tipY - baseY);

    const open = 1 - close;
    const wob = Math.sin(now / 160 + hook.angle * 1.4);

    const spread = lerp(16.2, 3.9, gripClose) * (1 + 0.03 * open * wob);
    const baseSpread = lerp(7.6, 4.4, gripClose);
    const curlIn = lerp(9.4, 3.1, gripClose);

    const metal = ctx.createLinearGradient(-14, -12, 14, 64);
    metal.addColorStop(0, "#fbfbfb");
    metal.addColorStop(0.22, "#d6d6d6");
    metal.addColorStop(0.55, "#f4f4f4");
    metal.addColorStop(1, "#7a7a7a");

    const outline = "rgba(0,0,0,0.42)";
    const highlight = "rgba(255,255,255,0.18)";

    const strokeMetal = (makePath, shadowW, metalW) => {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.strokeStyle = outline;
      ctx.lineWidth = shadowW;
      makePath();
      ctx.stroke();

      ctx.strokeStyle = metal;
      ctx.lineWidth = metalW;
      makePath();
      ctx.stroke();

      ctx.save();
      try {
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = highlight;
        ctx.lineWidth = Math.max(1.2, metalW * 0.32);
        makePath();
        ctx.stroke();
      } finally {
        ctx.restore();
      }
    };

    // Ring
    ctx.save();
    try {
      ctx.strokeStyle = outline;
      ctx.lineWidth = 6.2;
      ctx.beginPath();
      ctx.arc(0, 0, 6.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = metal;
      ctx.lineWidth = 4.4;
      ctx.beginPath();
      ctx.arc(0, 0, 6.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = highlight;
      ctx.lineWidth = 1.6;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.arc(0, 0, 5.1, Math.PI * 1.08, Math.PI * 1.42);
      ctx.stroke();
    } finally {
      ctx.restore();
    }

    // Stem + swivel
    strokeMetal(
      () => {
        ctx.beginPath();
        ctx.moveTo(0, 7);
        ctx.lineTo(0, baseY - 4);
      },
      6.4,
      4.6,
    );

    ctx.save();
    try {
      ctx.translate(0, baseY - 7.5);
      ctx.fillStyle = metal;
      roundRectPath(ctx, -9, -5.5, 18, 11, 5.5);
      ctx.fill();
      ctx.strokeStyle = outline;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = "rgba(0,0,0,0.20)";
      ctx.beginPath();
      ctx.arc(0, 0.2, 2.1, 0, Math.PI * 2);
      ctx.fill();
    } finally {
      ctx.restore();
    }

    // Prongs (center prong is the lowest point at x=0)
    ctx.save();
    try {
      ctx.translate(0, baseY);

      const sideOuterY = jawLen * 0.78;
      const sideHookY = jawLen * 0.92;
      const centerHookY = jawLen;

      const drawSideProng = (sign) => {
        const baseX = sign * baseSpread;
        const outerX = sign * spread;
        const inside = Math.max(0.15, spread - curlIn);
        const hookX = sign * inside;

        const cp1x = sign * (baseSpread + 5.2);
        const cp1y = jawLen * 0.22;
        const cp2x = sign * (spread + 4.6);
        const cp2y = jawLen * 0.56;
        const curlCx = sign * (spread + 2.2);
        const curlCy = jawLen * 0.9;

        const path = () => {
          ctx.beginPath();
          ctx.moveTo(baseX, 0);
          ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, outerX, sideOuterY);
          ctx.quadraticCurveTo(curlCx, curlCy, hookX, sideHookY);
        };

        strokeMetal(path, 7.0, 5.0);

        // Inner grip pad near the hook tip
        ctx.save();
        try {
          ctx.fillStyle = "rgba(20,20,20,0.30)";
          ctx.beginPath();
          ctx.ellipse(hookX + sign * 1.15, sideHookY - 0.9, 3.0, 2.1, sign * 0.22, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.14)";
          ctx.beginPath();
          ctx.ellipse(hookX + sign * 0.45, sideHookY - 1.6, 1.2, 0.9, 0, 0, Math.PI * 2);
          ctx.fill();
        } finally {
          ctx.restore();
        }
      };

      const drawCenterProng = () => {
        const sway = 0.9 * open * Math.sin(now / 220 + hook.angle * 1.3);
        const path = () => {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.bezierCurveTo(-1.6 + sway, jawLen * 0.22, 1.4 - sway, jawLen * 0.58, 0, jawLen * 0.86);
          ctx.quadraticCurveTo(0, jawLen * 0.96, 0, centerHookY);
        };
        strokeMetal(path, 7.4, 5.4);

        // Small tip barb
        ctx.save();
        try {
          ctx.fillStyle = metal;
          ctx.beginPath();
          ctx.moveTo(0, centerHookY + 0.5);
          ctx.lineTo(-2.3, centerHookY - 3.0);
          ctx.lineTo(2.3, centerHookY - 3.0);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = outline;
          ctx.lineWidth = 1;
          ctx.stroke();
        } finally {
          ctx.restore();
        }
      };

      drawSideProng(-1);
      drawSideProng(1);
      drawCenterProng();
    } finally {
      ctx.restore();
    }

    // Hub (covers prong roots)
    ctx.save();
    try {
      ctx.translate(0, baseY - 1.2);
      ctx.fillStyle = metal;
      ctx.beginPath();
      ctx.arc(0, 0, 7.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = outline;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.beginPath();
      ctx.arc(-2.2, -1.8, 1.5, 0, Math.PI * 2);
      ctx.arc(2.4, 1.6, 1.3, 0, Math.PI * 2);
      ctx.fill();
    } finally {
      ctx.restore();
    }

    // Tip glow while carrying (and bomb fuse hint)
    if (carriedItem && hook.state === "retract") {
      ctx.save();
      try {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.18;
        const g = ctx.createRadialGradient(0, tipY + 1, 2, 0, tipY + 1, 34);
        g.addColorStop(0, itemGlowColor);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, tipY + 1, 34, 0, Math.PI * 2);
        ctx.fill();
      } finally {
        ctx.restore();
      }
    }

    if (canBomb) {
      const flicker = 0.55 + 0.45 * Math.sin(now / 90);
      ctx.save();
      try {
        ctx.globalCompositeOperation = "lighter";
        const flame = ctx.createRadialGradient(0, tipY + 2.5, 1, 0, tipY + 2.5, 20);
        flame.addColorStop(0, "rgba(255, 241, 196, 0.95)");
        flame.addColorStop(0.45, "rgba(255, 211, 77, 0.75)");
        flame.addColorStop(0.75, "rgba(255, 77, 77, 0.65)");
        flame.addColorStop(1, "rgba(255, 77, 77, 0)");
        ctx.globalAlpha = 0.75 * flicker;
        ctx.fillStyle = flame;
        ctx.beginPath();
        ctx.arc(0, tipY + 2.5, 20, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.globalAlpha = 0.42 * flicker;
        ctx.beginPath();
        ctx.moveTo(-4, tipY + 2.5);
        ctx.lineTo(4, tipY + 2.5);
        ctx.moveTo(0, tipY - 1.5);
        ctx.lineTo(0, tipY + 6.5);
        ctx.stroke();
      } finally {
        ctx.restore();
      }
    }
  } finally {
    ctx.restore();
  }

  return { drewHook: true };
}
