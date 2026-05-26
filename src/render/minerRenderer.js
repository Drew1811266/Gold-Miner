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

function validatePoint(point, name) {
  assertObject(point, name);
  assertFiniteNumber(point.x, `${name}.x`);
  assertFiniteNumber(point.y, `${name}.y`);
}

function validateCtx(ctx, ownerName) {
  assertObject(ctx, `${ownerName} ctx`);
  for (const methodName of [
    "save",
    "restore",
    "translate",
    "rotate",
    "beginPath",
    "ellipse",
    "fill",
    "stroke",
    "arc",
    "moveTo",
    "lineTo",
    "quadraticCurveTo",
    "fillRect",
    "arcTo",
    "closePath",
    "createLinearGradient",
    "createRadialGradient",
  ]) {
    assertMethod(ctx, methodName, "ctx");
  }
}

function validateHook(hook) {
  assertObject(hook, "createMinerPose hook");
  assertFiniteNumber(hook.angle, "createMinerPose hook.angle");
  assertFiniteNumber(hook.maxAngle, "createMinerPose hook.maxAngle");
  assertFiniteNumber(hook.reelAngle, "createMinerPose hook.reelAngle");
}

function validateMiner(miner) {
  assertObject(miner, "createMinerPose miner");
  assertFiniteNumber(miner.crank, "createMinerPose miner.crank");
  assertFiniteNumber(miner.grip, "createMinerPose miner.grip");
  assertFiniteNumber(miner.releasePop, "createMinerPose miner.releasePop");
}

function validateAttachedItem(attachedItem) {
  if (attachedItem === null || attachedItem === undefined) return;
  assertObject(attachedItem, "createMinerPose attachedItem");
  assertFiniteNumber(attachedItem.weight, "createMinerPose attachedItem.weight");
}

function validatePose(pose, ownerName) {
  assertObject(pose, `${ownerName} pose`);
  validatePoint(pose.pivot, `${ownerName} pose.pivot`);
  validatePoint(pose.reel, `${ownerName} pose.reel`);
  for (const key of ["now", "bob", "aim", "crank", "phase", "strainBase", "x", "y", "grip", "releasePop"]) {
    assertFiniteNumber(pose[key], `${ownerName} pose.${key}`);
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

function lerpVec(a, b, t) {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

function solveElbow(sx, sy, tx, ty, l1, l2, side) {
  const dx = tx - sx;
  const dy = ty - sy;
  const d0 = Math.hypot(dx, dy);
  const d = clamp(d0, Math.abs(l1 - l2) + 0.001, l1 + l2 - 0.001);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const ux = dx / Math.max(0.001, d0);
  const uy = dy / Math.max(0.001, d0);
  const px = sx + ux * a;
  const py = sy + uy * a;
  const nx = -uy * side;
  const ny = ux * side;
  return { x: px + nx * h, y: py + ny * h };
}

export function createMinerPose({ hook, miner, pivot, reel, now, attachedItem = null } = {}) {
  validateHook(hook);
  validateMiner(miner);
  validatePoint(pivot, "createMinerPose pivot");
  validatePoint(reel, "createMinerPose reel");
  assertFiniteNumber(now, "createMinerPose now");
  validateAttachedItem(attachedItem);

  const bob = 1.15 * Math.sin(now / 620) + 0.55 * Math.sin(now / 980 + 1.7);
  const aim = clamp(hook.angle / Math.max(0.001, hook.maxAngle), -1, 1);

  const crank = miner.crank;
  const phase = hook.reelAngle;
  const weight = attachedItem ? attachedItem.weight : 0;
  const strainBase = clamp(weight / 6.4, 0, 1);

  const leanX = crank * Math.sin(phase) * (2.2 + 1.6 * strainBase);
  const leanY = crank * (0.65 + 0.35 * Math.cos(phase * 2.2)) * (0.8 + 0.4 * strainBase);

  const x = pivot.x + leanX;
  const y = pivot.y - 58 + bob + leanY; // head center
  return {
    pivot,
    reel,
    now,
    bob,
    aim,
    crank,
    phase,
    strainBase,
    x,
    y,
    grip: miner.grip,
    releasePop: miner.releasePop,
  };
}

export function drawMinerBackLayer(options = {}) {
  const { ctx, pose } = options;
  validateCtx(ctx, "drawMinerBackLayer");
  validatePose(pose, "drawMinerBackLayer");

  const { x, y, aim, crank, phase, strainBase } = pose;

  const skinShadow = "#e0b695";
  const jacket = "#2a3f9e";
  const jacketDeep = "#1a2b7a";
  const overall = "#3c7bd8";
  const overallDeep = "#2556b2";
  const helmet = "#ffe7a3";
  const helmetDeep = "#d6a43a";

  const headR = 19.5;
  const torsoW = 54;
  const torsoH = 50;
  const torsoX = x - torsoW / 2;
  const torsoY = y + 18;

  const bodyWobble = crank * 0.7 * Math.sin(phase);
  const bodyTilt = crank * 0.05 * Math.sin(phase + 0.4);

  ctx.save();
  try {
    ctx.translate(x, y);
    ctx.rotate(bodyTilt);
    ctx.translate(-x, -y);

    // Back shadow (gives depth behind the winch)
    ctx.save();
    try {
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.beginPath();
      ctx.ellipse(x + 10, torsoY + torsoH + 22, 34, 11, 0, 0, Math.PI * 2);
      ctx.fill();
    } finally {
      ctx.restore();
    }

    const bodyAsset = options.artAssets?.get?.("sprite.minerBody");
    drawCrayonImageAsset(ctx, bodyAsset, x - 36, y - 18, 72, 104);
    const headAsset = options.artAssets?.get?.("sprite.minerHead");
    drawCrayonImageAsset(ctx, headAsset, x - 27, y - 31, 54, 54);

    // Backpack
    ctx.save();
    try {
      ctx.translate(x + 26, torsoY + 26);
      ctx.rotate(-0.08);
      const pack = ctx.createLinearGradient(-12, -18, 14, 18);
      pack.addColorStop(0, "#3a2c22");
      pack.addColorStop(0.55, "#2a1f18");
      pack.addColorStop(1, "#16110d");
      ctx.fillStyle = pack;
      roundRectPath(ctx, -15, -20, 26, 38, 10);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      roundRectPath(ctx, -12, -17, 20, 14, 8);
      ctx.fill();
    } finally {
      ctx.restore();
    }

    // Torso base
    const torsoGrad = ctx.createLinearGradient(torsoX, torsoY, torsoX + torsoW, torsoY + torsoH);
    torsoGrad.addColorStop(0, jacket);
    torsoGrad.addColorStop(1, jacketDeep);
    ctx.fillStyle = torsoGrad;
    roundRectPath(ctx, torsoX, torsoY, torsoW, torsoH, 14);
    ctx.fill();

    // Collar / shirt
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    roundRectPath(ctx, torsoX + 8, torsoY + 6, torsoW - 16, 16, 10);
    ctx.fill();

    // Overalls bib
    const bibGrad = ctx.createLinearGradient(torsoX, torsoY + 16, torsoX, torsoY + torsoH);
    bibGrad.addColorStop(0, overall);
    bibGrad.addColorStop(1, overallDeep);
    ctx.fillStyle = bibGrad;
    roundRectPath(ctx, torsoX + 10, torsoY + 16, torsoW - 20, 30, 12);
    ctx.fill();

    // Straps
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - 18, torsoY + 6);
    ctx.lineTo(x - 10, torsoY + 22);
    ctx.moveTo(x + 18, torsoY + 6);
    ctx.lineTo(x + 10, torsoY + 22);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 18, torsoY + 6);
    ctx.lineTo(x - 10, torsoY + 22);
    ctx.moveTo(x + 18, torsoY + 6);
    ctx.lineTo(x + 10, torsoY + 22);
    ctx.stroke();

    // Belt + buckle
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(torsoX + 4, torsoY + 38, torsoW - 8, 6);
    ctx.fillStyle = "#ffd34d";
    roundRectPath(ctx, x - 7, torsoY + 37, 14, 8, 3);
    ctx.fill();

    // Pouch
    ctx.save();
    try {
      ctx.translate(x - 22, torsoY + 44);
      ctx.rotate(0.08);
      ctx.fillStyle = "#2b2018";
      roundRectPath(ctx, -10, -6, 18, 14, 5);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      roundRectPath(ctx, -8, -4, 14, 6, 4);
      ctx.fill();
    } finally {
      ctx.restore();
    }

    // Head
    const face = ctx.createRadialGradient(x - 6 + aim * 2, y - 6, 3, x, y + 2, 24);
    face.addColorStop(0, "#ffe0c6");
    face.addColorStop(1, skinShadow);
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.arc(x, y, headR, 0, Math.PI * 2);
    ctx.fill();

    // Nose
    ctx.fillStyle = "rgba(0,0,0,0.10)";
    ctx.beginPath();
    ctx.ellipse(x + 3 + aim * 1.4, y + 2, 2.8, 2.2, 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Cute cheeks + smile (no beard)
    ctx.save();
    try {
      const drawCheek = (cx) => {
        const g = ctx.createRadialGradient(cx, y + 6, 2, cx, y + 6, 11);
        g.addColorStop(0, "rgba(255,120,150,0.32)");
        g.addColorStop(1, "rgba(255,120,150,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, y + 7, 11, 0, Math.PI * 2);
        ctx.fill();
      };
      drawCheek(x - 10);
      drawCheek(x + 10);
    } finally {
      ctx.restore();
    }
    ctx.strokeStyle = "rgba(90,55,40,0.55)";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(x + aim * 1.1, y + 12.5, 7.2, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();

    // Helmet
    const helm = ctx.createLinearGradient(x - 18, y - 26, x + 18, y);
    helm.addColorStop(0, helmet);
    helm.addColorStop(1, helmetDeep);
    ctx.fillStyle = helm;
    ctx.beginPath();
    ctx.ellipse(x, y - 12, 20, 16, 0, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    roundRectPath(ctx, x - 22, y - 23, 44, 10, 7);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    roundRectPath(ctx, x - 19, y - 22, 38, 5, 6);
    ctx.fill();

    // Glasses strap + cute eyes
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.arc(x, y - 4, 20, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();

    const eyeY = y - 3.2;
    const drawEye = (cx) => {
      const ex = cx + aim * 1.05;
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.beginPath();
      ctx.ellipse(cx, eyeY, 4.2, 5.0, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.beginPath();
      ctx.arc(ex, eyeY + 0.6, 2.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.beginPath();
      ctx.arc(ex - 0.8, eyeY - 0.7, 0.7, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawLens = (cx) => {
      ctx.strokeStyle = "rgba(0,0,0,0.38)";
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(cx, eyeY, 8.2, 0, Math.PI * 2);
      ctx.stroke();

      const g = ctx.createRadialGradient(cx - 3 + aim * 0.7, eyeY - 2, 1, cx, eyeY, 10);
      g.addColorStop(0, "rgba(255,255,255,0.28)");
      g.addColorStop(1, "rgba(80, 120, 160, 0.18)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, eyeY, 7.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      try {
        ctx.globalAlpha = 0.18;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx - 2.2, eyeY - 1.2, 4.8, Math.PI * 1.15, Math.PI * 1.55);
        ctx.stroke();
      } finally {
        ctx.restore();
      }
    };

    drawEye(x - 9.5);
    drawEye(x + 9.5);
    drawLens(x - 9.5);
    drawLens(x + 9.5);

    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 1.8, eyeY);
    ctx.lineTo(x + 1.8, eyeY);
    ctx.stroke();

    // Headlamp
    ctx.fillStyle = "#ffd34d";
    ctx.beginPath();
    ctx.arc(x, y - 19, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.arc(x + 1.2, y - 18, 1.6, 0, Math.PI * 2);
    ctx.fill();
    const lampGlow = ctx.createRadialGradient(x, y - 19, 2, x, y - 19, 36);
    lampGlow.addColorStop(0, "rgba(255,211,77,0.18)");
    lampGlow.addColorStop(1, "rgba(255,211,77,0)");
    ctx.fillStyle = lampGlow;
    ctx.beginPath();
    ctx.arc(x, y - 19, 36, 0, Math.PI * 2);
    ctx.fill();

    // Strain sweat
    if (strainBase > 0.6 && crank > 0.3) {
      const s = (strainBase - 0.6) / 0.4;
      ctx.save();
      try {
        ctx.globalAlpha = 0.25 * s;
        ctx.fillStyle = "rgba(175, 245, 255, 0.8)";
        ctx.beginPath();
        ctx.ellipse(x + 16, y - 1, 2.2, 3.6, 0.2, 0, Math.PI * 2);
        ctx.ellipse(x + 14, y + 6, 1.6, 2.8, -0.1, 0, Math.PI * 2);
        ctx.fill();
      } finally {
        ctx.restore();
      }
    }

    // Small tool badge
    ctx.save();
    try {
      ctx.translate(torsoX + 14, torsoY + 28);
      ctx.rotate(0.12);
      ctx.fillStyle = "rgba(255, 224, 138, 0.85)";
      roundRectPath(ctx, -4, -4, 10, 10, 3);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 1;
      ctx.stroke();
    } finally {
      ctx.restore();
    }

    // Subtle body wobble highlight
    ctx.save();
    try {
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      roundRectPath(ctx, torsoX + 6 + bodyWobble, torsoY + 10, 12, torsoH - 20, 10);
      ctx.fill();
    } finally {
      ctx.restore();
    }
  } finally {
    ctx.restore();
  }

  return { drewMinerBack: true };
}

export function drawMinerFrontLayer({ ctx, pose } = {}) {
  validateCtx(ctx, "drawMinerFrontLayer");
  validatePose(pose, "drawMinerFrontLayer");

  const { x, y, reel, crank, phase, strainBase, grip, releasePop } = pose;

  const sleeve = "#2a3f9e";
  const sleeveHi = "rgba(255,255,255,0.12)";
  const glove = "#d3a26b";
  const gloveHi = "rgba(255,255,255,0.20)";

  const shoulderY = y + 25;
  const shoulderL = { x: x - 18, y: shoulderY + 2 };
  const shoulderR = { x: x + 18, y: shoulderY };

  const knobR = 14;
  const knob = { x: reel.x + Math.cos(phase) * knobR, y: reel.y + Math.sin(phase) * knobR };
  const rightGrip = knob;
  const leftGrip = {
    x: reel.x - 7 + crank * Math.sin(phase + 0.7) * 2.2,
    y: reel.y + 10 + crank * Math.cos(phase + 0.55) * 4.6,
  };

  const kick = releasePop * (1 - grip);
  const rightRest = { x: x + 34 + kick * 10, y: y + 50 - kick * 12 };
  const leftRest = { x: x - 34 - kick * 6, y: y + 52 - kick * 10 };

  const rightHand = lerpVec(rightRest, rightGrip, grip);
  const leftHand = lerpVec(leftRest, leftGrip, grip);

  const upper = 22;
  const lower = 22;
  const elbowL = solveElbow(shoulderL.x, shoulderL.y, leftHand.x, leftHand.y, upper, lower, 1);
  const elbowR = solveElbow(shoulderR.x, shoulderR.y, rightHand.x, rightHand.y, upper, lower, -1);

  const drawArm = (s, e, h) => {
    ctx.strokeStyle = sleeve;
    ctx.lineWidth = 9.2;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.quadraticCurveTo(e.x, e.y, h.x, h.y);
    ctx.stroke();

    ctx.strokeStyle = sleeveHi;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - 1);
    ctx.quadraticCurveTo(e.x, e.y - 1, h.x, h.y - 1);
    ctx.stroke();

    ctx.fillStyle = glove;
    ctx.beginPath();
    ctx.ellipse(h.x, h.y, 5.8, 4.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = gloveHi;
    ctx.beginPath();
    ctx.ellipse(h.x - 1.8, h.y - 1.7, 2.5, 1.9, -0.2, 0, Math.PI * 2);
    ctx.fill();
  };

  ctx.save();
  try {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    drawArm(shoulderL, elbowL, leftHand);
    drawArm(shoulderR, elbowR, rightHand);

    // Strain lines when pulling heavy stuff
    if (strainBase > 0.65 && crank > 0.25) {
      const a = 0.2 + 0.25 * crank * (strainBase - 0.65) / 0.35;
      ctx.save();
      try {
        ctx.globalAlpha = a;
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 24, y + 10);
        ctx.lineTo(x - 36, y + 2);
        ctx.moveTo(x + 24, y + 10);
        ctx.lineTo(x + 38, y + 1);
        ctx.stroke();
      } finally {
        ctx.restore();
      }
    }
  } finally {
    ctx.restore();
  }

  return { drewMinerFront: true };
}
