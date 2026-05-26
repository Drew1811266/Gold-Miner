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
  assertObject(ctx, "drawFxLayer ctx");
  for (const methodName of [
    "save",
    "restore",
    "beginPath",
    "arc",
    "stroke",
    "fill",
    "strokeText",
    "fillText",
    "drawImage",
  ]) {
    assertMethod(ctx, methodName, "ctx");
  }
}

function validateRing(ring, index) {
  assertObject(ring, `drawFxLayer fx.rings[${index}]`);
  for (const key of ["x", "y", "age", "life", "r0", "r1", "width"]) {
    assertFiniteNumber(ring[key], `drawFxLayer fx.rings[${index}].${key}`);
  }
  assertColor(ring.color, `drawFxLayer fx.rings[${index}].color`);
}

function validateParticle(particle, index) {
  assertObject(particle, `drawFxLayer fx.particles[${index}]`);
  for (const key of ["x", "y", "age", "life", "size"]) {
    assertFiniteNumber(particle[key], `drawFxLayer fx.particles[${index}].${key}`);
  }
  assertColor(particle.color, `drawFxLayer fx.particles[${index}].color`);
}

function validatePop(pop, index) {
  assertObject(pop, `drawFxLayer fx.pops[${index}]`);
  for (const key of ["x", "y", "age"]) {
    assertFiniteNumber(pop[key], `drawFxLayer fx.pops[${index}].${key}`);
  }
  assertPositiveNumber(pop.life, `drawFxLayer fx.pops[${index}].life`);
  if (typeof pop.text !== "string" || pop.text.length === 0) {
    throw new TypeError(`drawFxLayer fx.pops[${index}].text must be a non-empty string`);
  }
  assertColor(pop.color, `drawFxLayer fx.pops[${index}].color`);
}

function validateFx(fx) {
  assertObject(fx, "drawFxLayer fx");
  if (!Array.isArray(fx.rings)) {
    throw new TypeError("drawFxLayer fx.rings must be an array");
  }
  if (!Array.isArray(fx.particles)) {
    throw new TypeError("drawFxLayer fx.particles must be an array");
  }
  if (!Array.isArray(fx.pops)) {
    throw new TypeError("drawFxLayer fx.pops must be an array");
  }

  for (let index = 0; index < fx.rings.length; index += 1) validateRing(fx.rings[index], index);
  for (let index = 0; index < fx.particles.length; index += 1) validateParticle(fx.particles[index], index);
  for (let index = 0; index < fx.pops.length; index += 1) validatePop(fx.pops[index], index);
}

function withSaved(ctx, draw) {
  ctx.save();
  try {
    return draw();
  } finally {
    ctx.restore();
  }
}

export function drawFxLayer(options = {}) {
  const { ctx, fx } = options;
  validateCtx(ctx);
  validateFx(fx);

  let rings = 0;
  let particles = 0;
  let pops = 0;

  if (fx.rings.length > 0) {
    withSaved(ctx, () => {
      ctx.globalCompositeOperation = "lighter";
      for (const ring of fx.rings) {
        const t = clamp(ring.age / Math.max(0.0001, ring.life), 0, 1);
        const a = (1 - t) * 0.55;
        if (a <= 0) continue;

        const r = lerp(ring.r0, ring.r1, t);
        ctx.globalAlpha = a;
        ctx.strokeStyle = ring.color;
        ctx.lineWidth = lerp(ring.width, 0.8, t);
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, r, 0, Math.PI * 2);
        ctx.stroke();
        rings += 1;
      }
    });
  }

  for (const particle of fx.particles) {
    const t = clamp(particle.age / Math.max(0.0001, particle.life), 0, 1);
    const a = (1 - t) * 0.9;
    if (a <= 0) continue;

    withSaved(ctx, () => {
      ctx.globalAlpha = a;
      const sparkAsset = options.artAssets?.get?.("sprite.spark");
      if (
        drawCrayonImageAsset(
          ctx,
          sparkAsset,
          particle.x - particle.size,
          particle.y - particle.size,
          particle.size * 2,
          particle.size * 2,
        )
      ) {
        particles += 1;
        return;
      }
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, Math.max(0.6, particle.size), 0, Math.PI * 2);
      ctx.fill();
      particles += 1;
    });
  }

  if (fx.pops.length > 0) {
    withSaved(ctx, () => {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "700 18px ui-sans-serif, system-ui";
      for (const pop of fx.pops) {
        const t = clamp(pop.age / pop.life, 0, 1);
        const a = 1 - t;
        if (a <= 0) continue;

        ctx.globalAlpha = a;
        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(0,0,0,0.38)";
        ctx.strokeText(pop.text, pop.x, pop.y);
        ctx.fillStyle = pop.color;
        ctx.fillText(pop.text, pop.x, pop.y);
        pops += 1;
      }
    });
  }

  return { rings, particles, pops };
}
