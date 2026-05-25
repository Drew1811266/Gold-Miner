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

function validateFxState(fx) {
  assertObject(fx, "fx");
  assertFiniteNumber(fx.flash, "fx.flash");
  assertFiniteNumber(fx.shake, "fx.shake");
  assertArray(fx.pops, "fx.pops");
  assertArray(fx.rings, "fx.rings");
  assertArray(fx.particles, "fx.particles");
}

export function updateFxState(fx, dt, random = Math.random) {
  validateFxState(fx);
  assertFiniteNumber(dt, "dt");
  if (typeof random !== "function") {
    throw new TypeError("random must be a function");
  }

  if (fx.flash > 0) fx.flash = Math.max(0, fx.flash - dt * 2.8);

  if (fx.shake > 0) {
    fx.shake = Math.max(0, fx.shake - dt * 2.2);
    const power = fx.shake;
    fx.shakeX = (random() * 2 - 1) * power * 10;
    fx.shakeY = (random() * 2 - 1) * power * 8;
  } else {
    fx.shakeX = 0;
    fx.shakeY = 0;
  }

  for (let i = fx.pops.length - 1; i >= 0; i -= 1) {
    const pop = fx.pops[i];
    pop.age += dt;
    pop.x += pop.vx * dt;
    pop.y += pop.vy * dt;
    pop.vy += 180 * dt;
    if (pop.age >= pop.life) fx.pops.splice(i, 1);
  }

  for (let i = fx.rings.length - 1; i >= 0; i -= 1) {
    const ring = fx.rings[i];
    ring.age += dt;
    if (ring.age >= ring.life) fx.rings.splice(i, 1);
  }

  for (let i = fx.particles.length - 1; i >= 0; i -= 1) {
    const particle = fx.particles[i];
    particle.age += dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += (particle.gravity ?? 380) * dt;
    particle.vx *= 0.985;
    particle.size *= 0.992;
    if (particle.age >= particle.life || particle.size <= 0.2) fx.particles.splice(i, 1);
  }

  return fx;
}
