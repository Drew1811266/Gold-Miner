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

function assertArray(value, name) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${name} must be an array`);
  }
}

function assertColorString(colors, key, ownerName) {
  if (typeof colors[key] !== "string" || colors[key].length === 0) {
    throw new TypeError(`${ownerName}.${key} must be a non-empty string`);
  }
}

function validateViewport(viewport, ownerName) {
  assertObject(viewport, `${ownerName} viewport`);
  assertPositiveNumber(viewport.w, `${ownerName} viewport.w`);
  assertPositiveNumber(viewport.h, `${ownerName} viewport.h`);
}

function validateBackgroundCtx(ctx) {
  assertObject(ctx, "drawBackgroundLayer ctx");
  for (const methodName of [
    "save",
    "restore",
    "fillRect",
    "createLinearGradient",
    "createRadialGradient",
    "beginPath",
    "arc",
    "fill",
  ]) {
    assertMethod(ctx, methodName, "ctx");
  }
}

function validatePlankCtx(ctx) {
  assertObject(ctx, "drawPlankLayer ctx");
  for (const methodName of ["save", "restore", "fillRect", "createLinearGradient"]) {
    assertMethod(ctx, methodName, "ctx");
  }
}

function validateBackgroundColors(colors) {
  assertObject(colors, "drawBackgroundLayer colors");
  for (const key of ["skyTop", "skyBottom", "groundTop", "groundBottom"]) {
    assertColorString(colors, key, "drawBackgroundLayer colors");
  }
}

function validatePlankColors(colors) {
  assertObject(colors, "drawPlankLayer colors");
  assertColorString(colors, "wood", "drawPlankLayer colors");
}

function validateScene(scene) {
  assertObject(scene, "drawBackgroundLayer scene");
  assertArray(scene.stars, "drawBackgroundLayer scene.stars");
  assertArray(scene.dust, "drawBackgroundLayer scene.dust");
}

function getImageDimension(image, naturalKey, fallbackKey) {
  const naturalValue = image?.[naturalKey];
  if (Number.isFinite(naturalValue) && naturalValue > 0) return naturalValue;

  const fallbackValue = image?.[fallbackKey];
  if (Number.isFinite(fallbackValue) && fallbackValue > 0) return fallbackValue;

  return 0;
}

function drawImageCover(ctx, image, x, y, w, h) {
  const iw = getImageDimension(image, "naturalWidth", "width");
  const ih = getImageDimension(image, "naturalHeight", "height");
  if (!iw || !ih) return false;

  assertMethod(ctx, "drawImage", "ctx");

  const ir = iw / ih;
  const r = w / h;
  let sw;
  let sh;
  let sx;
  let sy;

  if (ir > r) {
    sh = ih;
    sw = ih * r;
    sx = (iw - sw) / 2;
    sy = 0;
  } else {
    sw = iw;
    sh = iw / r;
    sx = 0;
    sy = (ih - sh) / 2;
  }

  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
  return true;
}

function drawFallbackBackground(ctx, viewport, colors) {
  const { w, h } = viewport;
  const groundY = h * 0.72;
  const sky = ctx.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, "#1a2450");
  sky.addColorStop(0.55, colors.skyTop);
  sky.addColorStop(1, colors.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const ground = ctx.createLinearGradient(0, groundY, 0, h);
  ground.addColorStop(0, "#2a241b");
  ground.addColorStop(0.12, colors.groundTop);
  ground.addColorStop(1, colors.groundBottom);
  ctx.fillStyle = ground;
  ctx.fillRect(0, groundY, w, h - groundY);
}

function drawStars(ctx, stars, now) {
  ctx.save();
  try {
    ctx.globalCompositeOperation = "lighter";
    for (const star of stars) {
      const { x, y, r, a, tw } = star;
      assertFiniteNumber(x, "drawBackgroundLayer scene.stars[].x");
      assertFiniteNumber(y, "drawBackgroundLayer scene.stars[].y");
      assertFiniteNumber(r, "drawBackgroundLayer scene.stars[].r");
      assertFiniteNumber(a, "drawBackgroundLayer scene.stars[].a");
      assertFiniteNumber(tw, "drawBackgroundLayer scene.stars[].tw");

      const pulse = 0.55 + 0.45 * Math.sin(now / 680 + tw);
      const alpha = a * pulse * 0.55;
      if (alpha <= 0.001) continue;
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } finally {
    ctx.restore();
  }
}

function drawDust(ctx, dust, now) {
  ctx.save();
  try {
    ctx.globalCompositeOperation = "lighter";
    for (const particle of dust) {
      const { x, y, r, a, tw } = particle;
      assertFiniteNumber(x, "drawBackgroundLayer scene.dust[].x");
      assertFiniteNumber(y, "drawBackgroundLayer scene.dust[].y");
      assertFiniteNumber(r, "drawBackgroundLayer scene.dust[].r");
      assertFiniteNumber(a, "drawBackgroundLayer scene.dust[].a");
      assertFiniteNumber(tw, "drawBackgroundLayer scene.dust[].tw");

      const pulse = 0.7 + 0.3 * Math.sin(now / 900 + tw);
      const alpha = a * pulse * 0.22;
      if (alpha <= 0.001) continue;
      ctx.fillStyle = `rgba(255, 224, 138, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } finally {
    ctx.restore();
  }
}

function drawLightSweep(ctx, viewport, now) {
  const { w, h } = viewport;
  ctx.save();
  try {
    ctx.globalAlpha = 0.06;
    const sweepX = w * 0.5 + Math.sin(now / 4200) * w * 0.12;
    const sweepY = h * 0.3 + Math.cos(now / 5200) * h * 0.06;
    const sweep = ctx.createRadialGradient(sweepX, sweepY, 80, sweepX, sweepY, Math.max(w, h) * 0.65);
    sweep.addColorStop(0, "rgba(255,255,255,0.35)");
    sweep.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sweep;
    ctx.fillRect(0, 0, w, h);
  } finally {
    ctx.restore();
  }
}

function drawVignette(ctx, viewport) {
  const { w, h } = viewport;
  ctx.save();
  try {
    ctx.globalAlpha = 0.22;
    const vignette = ctx.createRadialGradient(
      w * 0.5,
      h * 0.45,
      Math.min(w, h) * 0.2,
      w * 0.5,
      h * 0.45,
      Math.max(w, h) * 0.75,
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
  } finally {
    ctx.restore();
  }
}

export function drawBackgroundLayer(options = {}) {
  assertObject(options, "drawBackgroundLayer options");

  const { ctx, viewport, background, image, scene, colors, now } = options;
  validateBackgroundCtx(ctx);
  validateViewport(viewport, "drawBackgroundLayer");
  assertObject(background, "drawBackgroundLayer background");
  validateScene(scene);
  validateBackgroundColors(colors);
  assertFiniteNumber(now, "drawBackgroundLayer now");

  if (!drawImageCover(ctx, image, 0, 0, viewport.w, viewport.h)) {
    drawFallbackBackground(ctx, viewport, colors);
  }

  if (background.stars) {
    drawStars(ctx, scene.stars, now);
  }

  drawDust(ctx, scene.dust, now);
  drawLightSweep(ctx, viewport, now);
  drawVignette(ctx, viewport);
}

export function drawPlankLayer(options = {}) {
  assertObject(options, "drawPlankLayer options");

  const { ctx, viewport, plankY, plankHeight, colors } = options;
  validatePlankCtx(ctx);
  validateViewport(viewport, "drawPlankLayer");
  assertFiniteNumber(plankY, "drawPlankLayer plankY");
  assertPositiveNumber(plankHeight, "drawPlankLayer plankHeight");
  validatePlankColors(colors);

  ctx.save();
  try {
    const beam = ctx.createLinearGradient(0, plankY, 0, plankY + plankHeight);
    beam.addColorStop(0, "#9a663a");
    beam.addColorStop(0.45, colors.wood);
    beam.addColorStop(1, "#5a351f");
    ctx.fillStyle = beam;
    ctx.fillRect(0, plankY, viewport.w, plankHeight);

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, plankY + plankHeight - 2, viewport.w, 2);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(0, plankY, viewport.w, 2);

    ctx.fillStyle = "rgba(0,0,0,0.22)";
    for (let x = 18; x < viewport.w; x += 72) {
      ctx.fillRect(x, plankY, 4, plankHeight);
    }
  } finally {
    ctx.restore();
  }
}
