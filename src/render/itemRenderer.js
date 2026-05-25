import { clamp } from "../core/geometry.js";
import { makeBlob } from "../systems/itemFactory.js";

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

function assertFunction(value, name) {
  if (typeof value !== "function") {
    throw new TypeError(`${name} must be a function`);
  }
}

function validateCtx(ctx) {
  assertObject(ctx, "drawItemShape ctx");
  for (const methodName of [
    "save",
    "restore",
    "beginPath",
    "closePath",
    "moveTo",
    "lineTo",
    "quadraticCurveTo",
    "arc",
    "arcTo",
    "ellipse",
    "fill",
    "stroke",
    "translate",
    "rotate",
    "scale",
    "fillText",
    "createLinearGradient",
    "createRadialGradient",
  ]) {
    assertMethod(ctx, methodName, "ctx");
  }
}

function validateItem(item) {
  assertObject(item, "drawItemShape item");
  assertFiniteNumber(item.x, "drawItemShape item.x");
  assertFiniteNumber(item.y, "drawItemShape item.y");
  assertFiniteNumber(item.r, "drawItemShape item.r");
  if (typeof item.type !== "string" || item.type.length === 0) {
    throw new TypeError("drawItemShape item.type must be a non-empty string");
  }
}

function validateOptions({ ctx, item, now, createRng }) {
  validateCtx(ctx);
  validateItem(item);
  assertFiniteNumber(now, "drawItemShape now");
  assertFunction(createRng, "drawItemShape createRng");
}

function withSaved(ctx, draw) {
  ctx.save();
  try {
    return draw();
  } finally {
    ctx.restore();
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

function blobPath(ctx, blob, radius) {
  const pts = blob.map((point) => ({
    x: Math.cos(point.a) * radius * point.r,
    y: Math.sin(point.a) * radius * point.r,
  }));
  const n = pts.length;
  const mid0 = {
    x: (pts[n - 1].x + pts[0].x) / 2,
    y: (pts[n - 1].y + pts[0].y) / 2,
  };
  ctx.beginPath();
  ctx.moveTo(mid0.x, mid0.y);
  for (let index = 0; index < n; index += 1) {
    const point = pts[index];
    const next = pts[(index + 1) % n];
    const mid = {
      x: (point.x + next.x) / 2,
      y: (point.y + next.y) / 2,
    };
    ctx.quadraticCurveTo(point.x, point.y, mid.x, mid.y);
  }
  ctx.closePath();
}

export function drawItemShape({ ctx, item, metadata, now, createRng } = {}) {
  validateOptions({ ctx, item, now, createRng });
  void metadata;

  const art = item.art ?? { rot: 0 };

  if (!item.grabbed) {
    withSaved(ctx, () => {
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.ellipse(
        item.x + item.r * 0.08,
        item.y + item.r * 0.62,
        item.r * 0.85,
        Math.max(2, item.r * 0.32),
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    });
  }

  return withSaved(ctx, () => {
    ctx.translate(item.x, item.y);

    let wobble = 0;
    if (item.type === "diamond") wobble = 0.14 * Math.sin(now / 620 + (art.twinkle ?? 0));
    if (item.type === "gold") wobble = 0.06 * Math.sin(now / 880 + (art.glint ?? 0) * 6);
    if (item.type === "bag") wobble = 0.1 * Math.sin(now / 760 + (art.stripe ?? 0) * 6);
    if (item.type === "rock") wobble = 0.04 * Math.sin(now / 920 + (art.rot ?? 0));
    if (item.type === "bar") wobble = 0.055 * Math.sin(now / 920 + (art.shine ?? 0));
    if (item.type === "emerald" || item.type === "ruby") wobble = 0.12 * Math.sin(now / 680 + (art.twinkle ?? 0));
    if (item.type === "crystal") wobble = 0.1 * Math.sin(now / 700 + (art.twinkle ?? 0));
    if (item.type === "pouch") wobble = 0.1 * Math.sin(now / 760 + (art.jiggle ?? 0));
    if (item.type === "keg") wobble = 0.06 * Math.sin(now / 840 + (art.fuse ?? 0));
    if (item.type === "fossil") wobble = 0.05 * Math.sin(now / 980 + (art.rot ?? 0));

    const baseRot = item.type === "mouse" ? 0 : (art.rot ?? 0);
    ctx.rotate(baseRot + wobble);

    if (item.type === "mouse") {
      const mouse = item.mouse ?? {};
      const vx = Number.isFinite(mouse.vx) ? mouse.vx : 0;
      const facing = vx >= 0 ? 1 : -1;
      const phase = Number.isFinite(mouse.phase) ? mouse.phase : 0;
      const bob = Math.sin(phase) * item.r * 0.06;

      ctx.translate(0, bob);
      ctx.scale(facing, 1);

      withSaved(ctx, () => {
        ctx.strokeStyle = "rgba(255, 141, 161, 0.6)";
        ctx.lineWidth = Math.max(1.2, item.r * 0.12);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-item.r * 0.88, item.r * 0.06);
        ctx.quadraticCurveTo(
          -item.r * 1.28,
          -item.r * 0.35 + Math.sin(phase * 0.75) * item.r * 0.14,
          -item.r * 1.58,
          item.r * 0.2,
        );
        ctx.stroke();
      });

      const bodyW = item.r * 1.55;
      const bodyH = item.r * 0.95;
      const bodyX = -item.r * 0.05;
      const bodyY = item.r * 0.1;
      const fur = ctx.createRadialGradient(
        bodyX - item.r * 0.25,
        bodyY - item.r * 0.3,
        item.r * 0.2,
        bodyX,
        bodyY,
        item.r * 1.25,
      );
      fur.addColorStop(0, "#f5f7fc");
      fur.addColorStop(0.55, "#c8cdd8");
      fur.addColorStop(1, "#7b808d");
      ctx.fillStyle = fur;
      ctx.beginPath();
      ctx.ellipse(bodyX, bodyY, bodyW / 2, bodyH / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = Math.max(1, item.r * 0.07);
      ctx.stroke();

      const cargo = mouse.cargo ?? null;
      if (cargo) {
        const cargoX = bodyX - item.r * 0.2;
        const cargoY = bodyY - item.r * 0.52;
        if (cargo === "diamond") {
          const size = item.r * 0.36;
          const diamondGradient = ctx.createLinearGradient(cargoX - size, cargoY - size, cargoX + size, cargoY + size);
          diamondGradient.addColorStop(0, "#e9fbff");
          diamondGradient.addColorStop(0.4, "#8fe9ff");
          diamondGradient.addColorStop(1, "#2f8aa1");
          ctx.fillStyle = diamondGradient;
          ctx.beginPath();
          ctx.moveTo(cargoX, cargoY - size);
          ctx.lineTo(cargoX + size * 0.85, cargoY);
          ctx.lineTo(cargoX, cargoY + size);
          ctx.lineTo(cargoX - size * 0.85, cargoY);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = "rgba(0,0,0,0.22)";
          ctx.lineWidth = Math.max(1, item.r * 0.055);
          ctx.stroke();

          withSaved(ctx, () => {
            ctx.globalAlpha = 0.22;
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.ellipse(
              cargoX - size * 0.18,
              cargoY - size * 0.18,
              size * 0.22,
              size * 0.16,
              -0.6,
              0,
              Math.PI * 2,
            );
            ctx.fill();
          });
        } else if (cargo === "bar") {
          const width = item.r * 0.7;
          const height = item.r * 0.38;
          const barGradient = ctx.createLinearGradient(
            cargoX - width * 0.6,
            cargoY - height * 0.6,
            cargoX + width * 0.6,
            cargoY + height * 0.6,
          );
          barGradient.addColorStop(0, "#fff6d6");
          barGradient.addColorStop(0.35, "#ffd86f");
          barGradient.addColorStop(0.7, "#f6b027");
          barGradient.addColorStop(1, "#7f4f0a");
          ctx.fillStyle = barGradient;
          roundRectPath(ctx, cargoX - width / 2, cargoY - height / 2, width, height, 8);
          ctx.fill();
          ctx.strokeStyle = "rgba(0,0,0,0.22)";
          ctx.lineWidth = Math.max(1, item.r * 0.05);
          ctx.stroke();
        }
      }

      const headR = item.r * 0.48;
      const headX = item.r * 0.68;
      const headY = -item.r * 0.08;
      const headFur = ctx.createRadialGradient(
        headX - headR * 0.4,
        headY - headR * 0.35,
        headR * 0.2,
        headX,
        headY,
        headR * 1.25,
      );
      headFur.addColorStop(0, "#f6f8fd");
      headFur.addColorStop(0.55, "#c8cdd8");
      headFur.addColorStop(1, "#7b808d");
      ctx.fillStyle = headFur;
      ctx.beginPath();
      ctx.ellipse(headX, headY, headR, headR * 0.82, 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = Math.max(1, item.r * 0.065);
      ctx.stroke();

      const earR = headR * 0.42;
      const earY = headY - headR * 0.62;
      ctx.fillStyle = "#c0c5d0";
      ctx.beginPath();
      ctx.arc(headX - headR * 0.3, earY, earR, 0, Math.PI * 2);
      ctx.arc(headX + headR * 0.2, earY + headR * 0.05, earR * 0.92, 0, Math.PI * 2);
      ctx.fill();

      withSaved(ctx, () => {
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = "#ff9fb1";
        ctx.beginPath();
        ctx.arc(headX - headR * 0.3, earY, earR * 0.55, 0, Math.PI * 2);
        ctx.arc(headX + headR * 0.2, earY + headR * 0.05, earR * 0.5, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.fillStyle = "rgba(20,20,20,0.9)";
      ctx.beginPath();
      ctx.arc(headX + headR * 0.24, headY - headR * 0.05, Math.max(1.3, item.r * 0.07), 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ff8da1";
      ctx.beginPath();
      ctx.arc(headX + headR * 0.66, headY + headR * 0.2, Math.max(1.4, item.r * 0.08), 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(20,20,20,0.38)";
      ctx.lineWidth = Math.max(1, item.r * 0.035);
      ctx.lineCap = "round";
      for (const sign of [-1, 0, 1]) {
        const whiskerY = headY + headR * 0.2 + sign * headR * 0.12;
        ctx.beginPath();
        ctx.moveTo(headX + headR * 0.5, whiskerY);
        ctx.lineTo(headX + headR * 1.05, whiskerY - sign * headR * 0.08);
        ctx.stroke();
      }

      const footY = bodyY + bodyH * 0.52;
      const stepA = Math.sin(phase);
      const stepB = Math.sin(phase + Math.PI);
      ctx.strokeStyle = "rgba(20,20,20,0.28)";
      ctx.lineWidth = Math.max(1.2, item.r * 0.07);
      ctx.lineCap = "round";
      for (const foot of [
        { x: bodyX - bodyW * 0.25, t: stepA },
        { x: bodyX - bodyW * 0.05, t: stepB },
        { x: bodyX + bodyW * 0.15, t: stepA },
        { x: bodyX + bodyW * 0.32, t: stepB },
      ]) {
        const lift = clamp((foot.t + 1) / 2, 0, 1) * item.r * 0.08;
        ctx.beginPath();
        ctx.moveTo(foot.x, footY - lift);
        ctx.lineTo(foot.x + item.r * 0.12, footY - lift + item.r * 0.1);
        ctx.stroke();
      }

      return true;
    }

    if (item.type === "gold") {
      const goldGradient = ctx.createRadialGradient(-item.r * 0.35, -item.r * 0.55, item.r * 0.2, 0, 0, item.r * 1.35);
      goldGradient.addColorStop(0, "#fff6d6");
      goldGradient.addColorStop(0.35, "#ffd86f");
      goldGradient.addColorStop(0.7, "#f6b027");
      goldGradient.addColorStop(1, "#7f4f0a");
      ctx.fillStyle = goldGradient;
      blobPath(ctx, art.blob ?? makeBlob(createRng(item.id), 9, 0.8, 1.05), item.r);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.22)";
      ctx.lineWidth = Math.max(1, item.r * 0.08);
      ctx.stroke();

      const glint = 0.18 + 0.12 * Math.sin(now / 280 + (art.glint ?? 0) * 6);
      ctx.fillStyle = `rgba(255,255,255,${glint})`;
      ctx.beginPath();
      ctx.arc(-item.r * 0.28, -item.r * 0.28, Math.max(1.5, item.r * 0.22), 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(1, item.r * 0.06);
      for (const sparkle of art.sparkles ?? []) {
        const pulse = 0.55 + 0.45 * Math.sin(now / 320 + sparkle.p);
        const sparkleX = Math.cos(sparkle.a) * item.r * sparkle.d;
        const sparkleY = Math.sin(sparkle.a) * item.r * sparkle.d;
        const size = item.r * sparkle.s;
        ctx.globalAlpha = 0.35 * pulse;
        ctx.beginPath();
        ctx.moveTo(sparkleX - size, sparkleY);
        ctx.lineTo(sparkleX + size, sparkleY);
        ctx.moveTo(sparkleX, sparkleY - size);
        ctx.lineTo(sparkleX, sparkleY + size);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      return true;
    }

    if (item.type === "bar") {
      const width = item.r * 1.8;
      const height = item.r * 1.1;
      const barGradient = ctx.createLinearGradient(-width * 0.6, -height * 0.6, width * 0.6, height * 0.6);
      barGradient.addColorStop(0, "#fff3c6");
      barGradient.addColorStop(0.35, "#ffd86f");
      barGradient.addColorStop(0.7, "#f6b027");
      barGradient.addColorStop(1, "#7f4f0a");
      ctx.fillStyle = barGradient;
      roundRectPath(ctx, -width / 2, -height / 2, width, height, 10);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.22)";
      ctx.lineWidth = Math.max(1, item.r * 0.07);
      ctx.stroke();

      withSaved(ctx, () => {
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = "#ffffff";
        roundRectPath(ctx, -width * 0.42, -height * 0.32, width * 0.84, height * 0.38, 8);
        ctx.fill();
      });

      withSaved(ctx, () => {
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.font = `700 ${Math.max(10, Math.floor(item.r * 0.55))}px ui-sans-serif, system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Au", 0, item.r * 0.06);
      });

      const shine = 0.12 + 0.14 * Math.sin(now / 300 + (art.shine ?? 0) * 6);
      withSaved(ctx, () => {
        ctx.globalAlpha = shine;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(-width * 0.18, -height * 0.1, width * 0.22, height * 0.18, -0.6, 0, Math.PI * 2);
        ctx.fill();
      });

      return true;
    }

    if (item.type === "rock") {
      const tint = art.tint ?? 0;
      const light = clamp(56 + tint * 26, 40, 68);
      const dark = clamp(28 + tint * 20, 18, 38);
      const rockGradient = ctx.createRadialGradient(-item.r * 0.25, -item.r * 0.35, item.r * 0.2, 0, 0, item.r * 1.25);
      rockGradient.addColorStop(0, `hsl(220, 10%, ${light}%)`);
      rockGradient.addColorStop(1, `hsl(220, 10%, ${dark}%)`);
      ctx.fillStyle = rockGradient;
      blobPath(ctx, art.blob ?? makeBlob(createRng(item.id), 8, 0.82, 1.12), item.r);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.28)";
      ctx.lineWidth = Math.max(1, item.r * 0.07);
      ctx.stroke();

      ctx.fillStyle = "rgba(0,0,0,0.22)";
      for (const speck of art.specks ?? []) {
        ctx.globalAlpha = speck.a;
        ctx.beginPath();
        ctx.arc(speck.x * item.r, speck.y * item.r, Math.max(0.8, speck.r * item.r), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      return true;
    }

    if (item.type === "diamond") {
      const twinkle = 0.65 + 0.35 * Math.sin(now / 360 + (art.twinkle ?? 0));
      const diamondGradient = ctx.createLinearGradient(-item.r, -item.r, item.r, item.r);
      diamondGradient.addColorStop(0, "rgba(215, 252, 255, 0.95)");
      diamondGradient.addColorStop(0.55, "rgba(120, 231, 255, 0.95)");
      diamondGradient.addColorStop(1, "rgba(45, 130, 155, 0.95)");
      ctx.fillStyle = diamondGradient;
      ctx.beginPath();
      ctx.moveTo(0, -item.r * 1.25);
      ctx.lineTo(item.r * 0.95, -item.r * 0.15);
      ctx.lineTo(item.r * 0.7, item.r * 0.95);
      ctx.lineTo(0, item.r * 1.22);
      ctx.lineTo(-item.r * 0.7, item.r * 0.95);
      ctx.lineTo(-item.r * 0.95, -item.r * 0.15);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${0.22 * twinkle})`;
      ctx.lineWidth = Math.max(1, item.r * 0.06);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.14 * twinkle})`;
      ctx.lineWidth = Math.max(1, item.r * 0.03);
      ctx.beginPath();
      ctx.moveTo(0, -item.r * 1.25);
      ctx.lineTo(0, item.r * 1.22);
      ctx.moveTo(-item.r * 0.7, item.r * 0.95);
      ctx.lineTo(item.r * 0.7, item.r * 0.95);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.38 * twinkle})`;
      ctx.lineWidth = Math.max(1, item.r * 0.05);
      ctx.beginPath();
      ctx.moveTo(item.r * 0.35, -item.r * 0.55);
      ctx.lineTo(item.r * 0.35, -item.r * 0.12);
      ctx.moveTo(item.r * 0.13, -item.r * 0.33);
      ctx.lineTo(item.r * 0.57, -item.r * 0.33);
      ctx.stroke();
      return true;
    }

    if (item.type === "emerald" || item.type === "ruby") {
      const isRuby = item.type === "ruby";
      const twinkle = 0.65 + 0.35 * Math.sin(now / 340 + (art.twinkle ?? 0));
      const emeraldGradient = ctx.createLinearGradient(-item.r, -item.r, item.r, item.r);
      emeraldGradient.addColorStop(0, isRuby ? "rgba(255, 200, 215, 0.95)" : "rgba(210, 255, 235, 0.95)");
      emeraldGradient.addColorStop(0.55, isRuby ? "rgba(255, 80, 115, 0.95)" : "rgba(52, 226, 138, 0.95)");
      emeraldGradient.addColorStop(1, isRuby ? "rgba(120, 20, 40, 0.95)" : "rgba(18, 95, 55, 0.95)");
      ctx.fillStyle = emeraldGradient;
      ctx.beginPath();
      ctx.moveTo(0, -item.r * 1.25);
      ctx.lineTo(item.r * 0.95, -item.r * 0.45);
      ctx.lineTo(item.r * 1.1, item.r * 0.25);
      ctx.lineTo(item.r * 0.6, item.r * 1.05);
      ctx.lineTo(0, item.r * 1.22);
      ctx.lineTo(-item.r * 0.6, item.r * 1.05);
      ctx.lineTo(-item.r * 1.1, item.r * 0.25);
      ctx.lineTo(-item.r * 0.95, -item.r * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${0.22 * twinkle})`;
      ctx.lineWidth = Math.max(1, item.r * 0.06);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.14 * twinkle})`;
      ctx.lineWidth = Math.max(1, item.r * 0.03);
      ctx.beginPath();
      ctx.moveTo(0, -item.r * 1.25);
      ctx.lineTo(0, item.r * 1.22);
      ctx.moveTo(-item.r * 0.6, item.r * 1.05);
      ctx.lineTo(item.r * 0.6, item.r * 1.05);
      ctx.moveTo(-item.r * 1.1, item.r * 0.25);
      ctx.lineTo(item.r * 1.1, item.r * 0.25);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.32 * twinkle})`;
      ctx.lineWidth = Math.max(1, item.r * 0.05);
      ctx.beginPath();
      ctx.moveTo(item.r * 0.25, -item.r * 0.62);
      ctx.lineTo(item.r * 0.25, -item.r * 0.18);
      ctx.moveTo(item.r * 0.03, -item.r * 0.4);
      ctx.lineTo(item.r * 0.47, -item.r * 0.4);
      ctx.stroke();
      return true;
    }

    if (item.type === "crystal") {
      const twinkle = 0.65 + 0.35 * Math.sin(now / 320 + (art.twinkle ?? 0));

      withSaved(ctx, () => {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.12 * twinkle;
        const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, item.r * 1.6);
        glow.addColorStop(0, "rgba(166, 246, 255, 0.95)");
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, item.r * 1.6, 0, Math.PI * 2);
        ctx.fill();
      });

      for (const spike of art.dirs ?? []) {
        const angle = spike.a ?? 0;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const len = item.r * (spike.h ?? 1);
        const halfW = item.r * (spike.w ?? 0.25);
        const baseX = cos * item.r * 0.12;
        const baseY = sin * item.r * 0.12;
        const tipX = baseX + cos * len;
        const tipY = baseY + sin * len;
        const perpX = -sin * halfW;
        const perpY = cos * halfW;
        const crystalGradient = ctx.createLinearGradient(baseX, baseY, tipX, tipY);
        crystalGradient.addColorStop(0, "rgba(220, 252, 255, 0.95)");
        crystalGradient.addColorStop(0.55, "rgba(120, 231, 255, 0.95)");
        crystalGradient.addColorStop(1, "rgba(45, 130, 155, 0.95)");
        ctx.fillStyle = crystalGradient;
        ctx.beginPath();
        ctx.moveTo(baseX + perpX, baseY + perpY);
        ctx.lineTo(tipX, tipY);
        ctx.lineTo(baseX - perpX, baseY - perpY);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = `rgba(255,255,255,${0.18 * twinkle})`;
        ctx.lineWidth = Math.max(1, item.r * 0.04);
        ctx.stroke();
      }

      const core = ctx.createRadialGradient(-item.r * 0.2, -item.r * 0.35, item.r * 0.2, 0, 0, item.r * 1.1);
      core.addColorStop(0, "rgba(235, 255, 255, 0.95)");
      core.addColorStop(0.55, "rgba(140, 238, 255, 0.95)");
      core.addColorStop(1, "rgba(45, 120, 150, 0.95)");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.ellipse(0, item.r * 0.1, item.r * 0.78, item.r * 0.64, 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${0.16 * twinkle})`;
      ctx.lineWidth = Math.max(1, item.r * 0.04);
      ctx.stroke();
      return true;
    }

    if (item.type === "pouch") {
      const jiggle = 0.5 + 0.5 * Math.sin(now / 520 + (art.jiggle ?? 0));
      const pouchGradient = ctx.createRadialGradient(-item.r * 0.25, -item.r * 0.45, item.r * 0.2, 0, 0, item.r * 1.35);
      pouchGradient.addColorStop(0, "#f1d2a5");
      pouchGradient.addColorStop(0.5, "#c28a50");
      pouchGradient.addColorStop(1, "#4a2413");
      ctx.fillStyle = pouchGradient;
      ctx.beginPath();
      ctx.moveTo(-item.r * 0.62, -item.r * 0.15);
      ctx.quadraticCurveTo(-item.r * 0.95, item.r * 0.35, -item.r * 0.36, item.r * 0.82);
      ctx.quadraticCurveTo(0, item.r * 1.08, item.r * 0.36, item.r * 0.82);
      ctx.quadraticCurveTo(item.r * 0.95, item.r * 0.35, item.r * 0.62, -item.r * 0.15);
      ctx.quadraticCurveTo(0, -item.r * 0.78, -item.r * 0.62, -item.r * 0.15);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.28)";
      ctx.lineWidth = Math.max(1, item.r * 0.07);
      ctx.stroke();

      withSaved(ctx, () => {
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = "#6b3f24";
        ctx.beginPath();
        ctx.ellipse(0, -item.r * 0.22, item.r * 0.68, item.r * 0.26, 0, 0, Math.PI * 2);
        ctx.fill();
        const coinCount = art.coins ?? 3;
        for (let index = 0; index < coinCount; index += 1) {
          const angle = (index / Math.max(1, coinCount)) * Math.PI * 2 + (art.seam ?? 0) * 4;
          const coinX = Math.cos(angle) * item.r * 0.34;
          const coinY = -item.r * 0.3 + Math.sin(angle) * item.r * 0.1;
          const radius = item.r * (0.16 + 0.03 * jiggle);
          const coinGradient = ctx.createRadialGradient(coinX - radius * 0.3, coinY - radius * 0.35, radius * 0.2, coinX, coinY, radius);
          coinGradient.addColorStop(0, "#fff3c6");
          coinGradient.addColorStop(0.6, "#ffd34d");
          coinGradient.addColorStop(1, "#9a6a12");
          ctx.fillStyle = coinGradient;
          ctx.beginPath();
          ctx.arc(coinX, coinY, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "rgba(0,0,0,0.22)";
          ctx.lineWidth = Math.max(1, item.r * 0.03);
          ctx.stroke();
        }
      });

      withSaved(ctx, () => {
        ctx.globalAlpha = 0.16 + 0.12 * jiggle;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(-item.r * 0.22, -item.r * 0.08, item.r * 0.22, item.r * 0.16, -0.6, 0, Math.PI * 2);
        ctx.fill();
      });

      return true;
    }

    if (item.type === "keg") {
      const stage = item.keg?.stage ?? "idle";
      const fusePulse = 0.55 + 0.45 * Math.sin(now / 90 + (art.fuse ?? 0));
      const width = item.r * 1.2;
      const height = item.r * 1.55;
      const kegGradient = ctx.createLinearGradient(-width * 0.6, -height * 0.6, width * 0.6, height * 0.6);
      kegGradient.addColorStop(0, "#ffb38a");
      kegGradient.addColorStop(0.35, "#ff6b5a");
      kegGradient.addColorStop(1, "#6d1414");
      ctx.fillStyle = kegGradient;
      roundRectPath(ctx, -width / 2, -height / 2, width, height, 12);
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      roundRectPath(ctx, -width * 0.55, -height * 0.28, width * 1.1, height * 0.18, 10);
      ctx.fill();
      roundRectPath(ctx, -width * 0.55, height * 0.1, width * 1.1, height * 0.18, 10);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      roundRectPath(ctx, -width * 0.52, -height * 0.26, width * 1.04, height * 0.08, 8);
      ctx.fill();

      withSaved(ctx, () => {
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = "rgba(255, 230, 190, 0.92)";
        ctx.beginPath();
        ctx.moveTo(0, -item.r * 0.15);
        ctx.lineTo(item.r * 0.28, item.r * 0.38);
        ctx.lineTo(-item.r * 0.28, item.r * 0.38);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(120, 20, 20, 0.9)";
        ctx.font = `900 ${Math.max(11, Math.floor(item.r * 0.8))}px ui-sans-serif, system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("!", 0, item.r * 0.18);
      });

      ctx.strokeStyle = "rgba(0,0,0,0.28)";
      ctx.lineWidth = Math.max(1, item.r * 0.07);
      ctx.stroke();

      withSaved(ctx, () => {
        ctx.translate(width * 0.18, -height * 0.46);
        ctx.rotate(-0.7);
        ctx.strokeStyle = "rgba(20,20,20,0.65)";
        ctx.lineWidth = 3.2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(6, -6, 16, -4);
        ctx.stroke();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = (stage === "pull" ? 0.18 : 0.12) + 0.18 * fusePulse;
        const spark = ctx.createRadialGradient(16, -4, 1, 16, -4, 18);
        spark.addColorStop(0, "rgba(255, 241, 196, 0.95)");
        spark.addColorStop(0.45, "rgba(255, 211, 77, 0.75)");
        spark.addColorStop(0.75, "rgba(255, 77, 77, 0.65)");
        spark.addColorStop(1, "rgba(255, 77, 77, 0)");
        ctx.fillStyle = spark;
        ctx.beginPath();
        ctx.arc(16, -4, 18, 0, Math.PI * 2);
        ctx.fill();
      });

      return true;
    }

    if (item.type === "fossil") {
      const tint = art.tint ?? 0;
      const light = clamp(78 + tint * 18, 68, 90);
      const dark = clamp(48 + tint * 14, 36, 62);
      const fossilGradient = ctx.createRadialGradient(-item.r * 0.35, -item.r * 0.55, item.r * 0.2, 0, 0, item.r * 1.45);
      fossilGradient.addColorStop(0, `hsl(38, 40%, ${light}%)`);
      fossilGradient.addColorStop(1, `hsl(32, 30%, ${dark}%)`);
      ctx.fillStyle = fossilGradient;

      const len = item.r * 1.35;
      const boneW = item.r * 0.52;
      const leftX = -len * 0.45;
      const rightX = len * 0.45;
      const endR = boneW * 0.42;

      const drawBoneFill = () => {
        roundRectPath(ctx, leftX, -boneW * 0.35, len * 0.9, boneW * 0.7, boneW * 0.35);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(leftX, -boneW * 0.22, endR, 0, Math.PI * 2);
        ctx.arc(leftX, boneW * 0.22, endR, 0, Math.PI * 2);
        ctx.arc(rightX, -boneW * 0.22, endR, 0, Math.PI * 2);
        ctx.arc(rightX, boneW * 0.22, endR, 0, Math.PI * 2);
        ctx.fill();
      };

      drawBoneFill();
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = Math.max(1, item.r * 0.07);
      ctx.stroke();

      withSaved(ctx, () => {
        ctx.strokeStyle = "rgba(0,0,0,0.22)";
        ctx.lineWidth = Math.max(1, item.r * 0.04);
        ctx.lineCap = "round";
        for (const crack of art.cracks ?? []) {
          const angle = crack.a ?? 0;
          const distance = (crack.d ?? 0.3) * item.r;
          const len = (crack.l ?? 0.5) * item.r;
          const x0 = Math.cos(angle) * distance;
          const y0 = Math.sin(angle) * distance;
          const x1 = x0 + Math.cos(angle + 0.7) * len * 0.55;
          const y1 = y0 + Math.sin(angle + 0.7) * len * 0.55;
          const x2 = x0 + Math.cos(angle - 0.6) * len;
          const y2 = y0 + Math.sin(angle - 0.6) * len;
          ctx.globalAlpha = 0.18;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x0, y0);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      });

      withSaved(ctx, () => {
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(-item.r * 0.18, -item.r * 0.08, item.r * 0.28, item.r * 0.18, -0.7, 0, Math.PI * 2);
        ctx.fill();
      });

      return true;
    }

    const bagGradient = ctx.createRadialGradient(-item.r * 0.25, -item.r * 0.4, item.r * 0.2, 0, 0, item.r * 1.35);
    bagGradient.addColorStop(0, "#dcc7ff");
    bagGradient.addColorStop(0.5, "#b07bff");
    bagGradient.addColorStop(1, "#4b1e7a");
    ctx.fillStyle = bagGradient;
    ctx.beginPath();
    ctx.moveTo(-item.r * 0.55, -item.r * 0.25);
    ctx.quadraticCurveTo(-item.r * 0.85, item.r * 0.25, -item.r * 0.35, item.r * 0.75);
    ctx.quadraticCurveTo(0, item.r * 1.05, item.r * 0.35, item.r * 0.75);
    ctx.quadraticCurveTo(item.r * 0.85, item.r * 0.25, item.r * 0.55, -item.r * 0.25);
    ctx.quadraticCurveTo(0, -item.r * 0.8, -item.r * 0.55, -item.r * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.28)";
    ctx.lineWidth = Math.max(1, item.r * 0.07);
    ctx.stroke();
    ctx.fillStyle = "#6a3a9e";
    ctx.beginPath();
    ctx.ellipse(0, -item.r * 0.28, item.r * 0.55, item.r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.beginPath();
    ctx.ellipse(-item.r * 0.15, -item.r * 0.33, item.r * 0.32, item.r * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = `${Math.max(10, Math.floor(item.r * 1.15))}px ui-sans-serif, system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", 0, item.r * 0.2);
    return true;
  });
}
