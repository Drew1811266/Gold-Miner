"use strict";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d", { alpha: false });

const ui = {
  level: document.getElementById("level"),
  score: document.getElementById("score"),
  target: document.getElementById("target"),
  time: document.getElementById("time"),
  bombs: document.getElementById("bombs"),
  speedTokens: document.getElementById("speedTokens"),
  luckyTokens: document.getElementById("luckyTokens"),
  startBtn: document.getElementById("startBtn"),
  pauseBtn: document.getElementById("pauseBtn"),
  restartBtn: document.getElementById("restartBtn"),
  bombBtn: document.getElementById("bombBtn"),
  soundBtn: document.getElementById("soundBtn"),
  musicBtn: document.getElementById("musicBtn"),
  overlay: document.getElementById("overlay"),
  overlayTitle: document.getElementById("overlayTitle"),
  overlayText: document.getElementById("overlayText"),
  overlayPrimaryBtn: document.getElementById("overlayPrimaryBtn"),
  overlaySecondaryBtn: document.getElementById("overlaySecondaryBtn"),
  shopPanel: document.getElementById("shopPanel"),
  shopList: document.getElementById("shopList"),
  shopSeed: document.getElementById("shopSeed"),
};

const uiRefs = {
  bombChip: document.getElementById("bombs")?.closest(".chip") ?? null,
  speedChip: document.getElementById("speedTokens")?.closest(".chip") ?? null,
  luckyChip: document.getElementById("luckyTokens")?.closest(".chip") ?? null,
  timeStat: document.getElementById("time")?.closest(".stat") ?? null,
  scoreStat: document.getElementById("score")?.closest(".stat") ?? null,
};

function audioInit() {
  window.GameAudio?.init?.();
}

function audioPlay(name, options) {
  window.GameAudio?.play?.(name, options);
}

function syncAudioButtons() {
  if (ui.soundBtn) {
    const on = window.GameAudio?.isSfxEnabled?.() ?? true;
    ui.soundBtn.textContent = `音效: ${on ? "开" : "关"}`;
  }
  if (ui.musicBtn) {
    const on = window.GameAudio?.isMusicEnabled?.() ?? true;
    const trackName = window.GameAudio?.getTrackName?.() ?? "";
    ui.musicBtn.textContent = `音乐: ${on ? "开" : "关"}${trackName ? ` · ${trackName}` : ""}`;
  }
}

const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function roundRectPath(x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function segmentCircleIntersect(ax, ay, bx, by, cx, cy, radius) {
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

function createRng(seed) {
  let state = seed >>> 0;
  return {
    next() {
      state += 0x6d2b79f5;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    range(min, max) {
      return lerp(min, max, this.next());
    },
    pick(list) {
      return list[Math.floor(this.next() * list.length)];
    },
  };
}

const BG = {
  w: 1280,
  h: 720,
  groundY: 518,
};

function buildRidgePath(rng, yBase, amplitude, steps, bottomY) {
  const pts = [];
  let last = yBase + (rng.next() - 0.5) * amplitude;
  for (let i = 0; i <= steps; i += 1) {
    const x = (i / steps) * BG.w;
    const n = (rng.next() - 0.5) * amplitude;
    last = lerp(last, yBase + n, 0.55);
    pts.push({ x, y: last });
  }

  let d = `M 0 ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i += 1) {
    d += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
  }
  d += ` L ${BG.w} ${bottomY} L 0 ${bottomY} Z`;
  return d;
}

function buildBackgroundSvg(theme) {
  const rng = createRng(theme.seed);
  const skyId = `sky_${theme.id}`;
  const soilId = `soil_${theme.id}`;
  const hazeId = `haze_${theme.id}`;

  const sunX = rng.range(140, 1140);
  const sunY = rng.range(80, 250);
  const sunR = rng.range(46, 96);

  const parts = [];
  parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BG.w} ${BG.h}" width="${BG.w}" height="${BG.h}" preserveAspectRatio="xMidYMid slice">`
  );
  parts.push(`<defs>`);
  parts.push(
    `<linearGradient id="${skyId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${theme.skyTop}"/><stop offset="1" stop-color="${theme.skyBottom}"/></linearGradient>`
  );
  parts.push(
    `<linearGradient id="${soilId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${theme.soilTop}"/><stop offset="1" stop-color="${theme.soilBottom}"/></linearGradient>`
  );
  parts.push(
    `<radialGradient id="${hazeId}" cx="50%" cy="20%" r="75%"><stop offset="0" stop-color="${theme.haze}" stop-opacity="0.35"/><stop offset="1" stop-color="${theme.haze}" stop-opacity="0"/></radialGradient>`
  );
  parts.push(`</defs>`);

  // Sky base
  parts.push(`<rect width="${BG.w}" height="${BG.h}" fill="url(#${skyId})"/>`);
  parts.push(`<rect width="${BG.w}" height="${BG.groundY}" fill="url(#${hazeId})" opacity="1"/>`);

  // Sun / moon
  parts.push(
    `<circle cx="${sunX.toFixed(1)}" cy="${sunY.toFixed(1)}" r="${sunR.toFixed(
      1
    )}" fill="${theme.sun}" opacity="0.95"/>`
  );
  parts.push(
    `<circle cx="${(sunX + sunR * 0.35).toFixed(1)}" cy="${(sunY + sunR * 0.22).toFixed(
      1
    )}" r="${(sunR * 0.72).toFixed(1)}" fill="${theme.skyTop}" opacity="${theme.stars ? 0.08 : 0.06}"/>`
  );

  // Stars or clouds
  if (theme.stars) {
    const starCount = 90;
    parts.push(`<g fill="#ffffff">`);
    for (let i = 0; i < starCount; i += 1) {
      const x = rng.range(0, BG.w);
      const y = rng.range(0, BG.groundY * 0.62);
      const r = rng.range(0.6, 1.9);
      const a = rng.range(0.08, 0.28);
      parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" opacity="${a.toFixed(3)}"/>`);
    }
    parts.push(`</g>`);
  } else {
    const cloudCount = 8;
    parts.push(`<g opacity="0.16" fill="#ffffff">`);
    for (let i = 0; i < cloudCount; i += 1) {
      const x = rng.range(80, BG.w - 80);
      const y = rng.range(70, BG.groundY * 0.52);
      const w = rng.range(140, 280);
      const h = rng.range(38, 70);
      parts.push(
        `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(w * 0.52).toFixed(
          1
        )}" ry="${(h * 0.52).toFixed(1)}"/>`
      );
      parts.push(
        `<ellipse cx="${(x - w * 0.22).toFixed(1)}" cy="${(y + h * 0.08).toFixed(
          1
        )}" rx="${(w * 0.34).toFixed(1)}" ry="${(h * 0.34).toFixed(1)}"/>`
      );
      parts.push(
        `<ellipse cx="${(x + w * 0.24).toFixed(1)}" cy="${(y + h * 0.1).toFixed(
          1
        )}" rx="${(w * 0.28).toFixed(1)}" ry="${(h * 0.28).toFixed(1)}"/>`
      );
    }
    parts.push(`</g>`);
  }

  // Ridges / silhouettes
  const ridge1 = buildRidgePath(rng, theme.ridge1Y, theme.ridge1Amp, 14, BG.groundY);
  const ridge2 = buildRidgePath(rng, theme.ridge2Y, theme.ridge2Amp, 16, BG.groundY);
  parts.push(`<path d="${ridge1}" fill="${theme.ridgeFar}" opacity="0.95"/>`);
  parts.push(`<path d="${ridge2}" fill="${theme.ridgeNear}" opacity="0.98"/>`);

  // Motif (simple silhouettes)
  if (theme.motif === "cactus") {
    parts.push(`<g fill="rgba(0,0,0,0.18)">`);
    const baseY = BG.groundY - 6;
    for (let i = 0; i < 6; i += 1) {
      const x = rng.range(60, BG.w - 60);
      const h = rng.range(36, 92);
      parts.push(`<rect x="${(x - 6).toFixed(1)}" y="${(baseY - h).toFixed(1)}" width="12" height="${h.toFixed(1)}" rx="6"/>`);
      if (rng.next() > 0.45) {
        const armH = rng.range(18, 42);
        const armW = rng.range(16, 28);
        const dir = rng.next() > 0.5 ? 1 : -1;
        const armY = baseY - h * 0.62;
        const armX = dir > 0 ? x + 4 : x - 4 - armW;
        const farEndX = dir > 0 ? armX + armW : armX;
        parts.push(`<rect x="${armX.toFixed(1)}" y="${armY.toFixed(1)}" width="${armW.toFixed(1)}" height="10" rx="6"/>`);
        parts.push(`<rect x="${(farEndX - 6).toFixed(1)}" y="${(armY - armH).toFixed(1)}" width="12" height="${armH.toFixed(1)}" rx="6"/>`);
      }
    }
    parts.push(`</g>`);
  }

  if (theme.motif === "pines") {
    parts.push(`<g fill="rgba(0,0,0,0.20)">`);
    const baseY = BG.groundY + 1;
    for (let i = 0; i < 8; i += 1) {
      const x = rng.range(40, BG.w - 40);
      const s = rng.range(0.8, 1.3);
      parts.push(
        `<path d="M ${x.toFixed(1)} ${(baseY - 92 * s).toFixed(1)} L ${(x - 34 * s).toFixed(
          1
        )} ${baseY.toFixed(1)} L ${(x + 34 * s).toFixed(1)} ${baseY.toFixed(1)} Z" />`
      );
    }
    parts.push(`</g>`);
  }

  if (theme.motif === "gears") {
    parts.push(`<g opacity="0.14" fill="#ffffff">`);
    for (let i = 0; i < 5; i += 1) {
      const x = rng.range(120, BG.w - 120);
      const y = rng.range(120, BG.groundY * 0.55);
      const r = rng.range(26, 54);
      parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}"/>`);
      parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r * 0.55).toFixed(1)}" fill="${theme.skyTop}" opacity="0.55"/>`);
    }
    parts.push(`</g>`);
  }

  // Ground edge
  parts.push(`<rect x="0" y="${BG.groundY}" width="${BG.w}" height="6" fill="rgba(0,0,0,0.28)"/>`);
  parts.push(`<rect x="0" y="${BG.groundY - 1}" width="${BG.w}" height="2" fill="rgba(255,255,255,0.07)"/>`);

  // Soil base
  parts.push(`<rect x="0" y="${BG.groundY}" width="${BG.w}" height="${BG.h - BG.groundY}" fill="url(#${soilId})"/>`);

  // Underground rocks / texture
  parts.push(`<g opacity="0.26">`);
  for (let i = 0; i < 70; i += 1) {
    const x = rng.range(0, BG.w);
    const y = rng.range(BG.groundY + 18, BG.h);
    const r = rng.range(1.5, 6.5);
    const a = rng.range(0.04, 0.18);
    parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="rgba(0,0,0,${a.toFixed(3)})"/>`);
  }
  parts.push(`</g>`);

  // Crystals
  const crystalCount = 10;
  parts.push(`<g opacity="0.9">`);
  for (let i = 0; i < crystalCount; i += 1) {
    const x = rng.range(60, BG.w - 60);
    const y = rng.range(BG.groundY + 70, BG.h - 40);
    const s = rng.range(18, 44);
    const c = theme.crystals[Math.floor(rng.next() * theme.crystals.length)];
    parts.push(
      `<path d="M ${x.toFixed(1)} ${(y - s).toFixed(1)} L ${(x + s * 0.55).toFixed(
        1
      )} ${y.toFixed(1)} L ${x.toFixed(1)} ${(y + s * 1.05).toFixed(1)} L ${(x - s * 0.55).toFixed(1)} ${y.toFixed(1)} Z" fill="${c}" opacity="0.65"/>`
    );
    parts.push(
      `<path d="M ${x.toFixed(1)} ${(y - s * 0.88).toFixed(1)} L ${(x + s * 0.4).toFixed(
        1
      )} ${y.toFixed(1)} L ${x.toFixed(1)} ${(y + s * 0.8).toFixed(1)} L ${(x - s * 0.4).toFixed(1)} ${y.toFixed(1)} Z" fill="#ffffff" opacity="0.18"/>`
    );
  }
  parts.push(`</g>`);

  // Vignette
  parts.push(
    `<radialGradient id="vig_${theme.id}" cx="50%" cy="45%" r="80%"><stop offset="0" stop-color="rgba(0,0,0,0)"/><stop offset="1" stop-color="rgba(0,0,0,0.32)"/></radialGradient>`
  );
  parts.push(`<rect width="${BG.w}" height="${BG.h}" fill="url(#vig_${theme.id})"/>`);

  parts.push(`</svg>`);
  return parts.join("");
}

function createBackgroundLibrary() {
  const themes = [
    {
      id: "bg01",
      name: "星夜矿山",
      seed: 101,
      stars: true,
      motif: null,
      skyTop: "#0b1230",
      skyBottom: "#050811",
      haze: "#9db6ff",
      sun: "#ffe6a4",
      ridgeFar: "#1b2a5a",
      ridgeNear: "#0f1838",
      ridge1Y: 340,
      ridge2Y: 410,
      ridge1Amp: 70,
      ridge2Amp: 92,
      soilTop: "#2a241b",
      soilBottom: "#0e0b08",
      crystals: ["#8fe9ff", "#b07bff", "#ffd34d"],
    },
    {
      id: "bg02",
      name: "晨曦峡谷",
      seed: 202,
      stars: false,
      motif: "cactus",
      skyTop: "#ffb36a",
      skyBottom: "#4b2569",
      haze: "#fff1c4",
      sun: "#fff1c4",
      ridgeFar: "#7b2b4e",
      ridgeNear: "#3b1836",
      ridge1Y: 350,
      ridge2Y: 425,
      ridge1Amp: 74,
      ridge2Amp: 96,
      soilTop: "#3a2818",
      soilBottom: "#120a06",
      crystals: ["#ffd34d", "#ff8a5c", "#b07bff"],
    },
    {
      id: "bg03",
      name: "黄昏沙丘",
      seed: 303,
      stars: false,
      motif: "cactus",
      skyTop: "#f6c54b",
      skyBottom: "#2f2a63",
      haze: "#ffe08a",
      sun: "#ffe08a",
      ridgeFar: "#a2621a",
      ridgeNear: "#5a3416",
      ridge1Y: 360,
      ridge2Y: 440,
      ridge1Amp: 58,
      ridge2Amp: 76,
      soilTop: "#3d2c17",
      soilBottom: "#130b06",
      crystals: ["#ffd34d", "#8fe9ff"],
    },
    {
      id: "bg04",
      name: "雪原晴空",
      seed: 404,
      stars: false,
      motif: "pines",
      skyTop: "#9fe8ff",
      skyBottom: "#3056a8",
      haze: "#ffffff",
      sun: "#ffffff",
      ridgeFar: "#5378c8",
      ridgeNear: "#2a3f7b",
      ridge1Y: 330,
      ridge2Y: 420,
      ridge1Amp: 84,
      ridge2Amp: 110,
      soilTop: "#2b2a2c",
      soilBottom: "#0a0a0c",
      crystals: ["#8fe9ff", "#ffffff"],
    },
    {
      id: "bg05",
      name: "雨林薄雾",
      seed: 505,
      stars: false,
      motif: "pines",
      skyTop: "#6ce0c2",
      skyBottom: "#0b2b3a",
      haze: "#c8fff0",
      sun: "#c8fff0",
      ridgeFar: "#0f5a52",
      ridgeNear: "#0a2f36",
      ridge1Y: 360,
      ridge2Y: 430,
      ridge1Amp: 78,
      ridge2Amp: 96,
      soilTop: "#243124",
      soilBottom: "#0a120b",
      crystals: ["#8fe9ff", "#ffd34d"],
    },
    {
      id: "bg06",
      name: "火山熔洞",
      seed: 606,
      stars: false,
      motif: null,
      skyTop: "#4a0e12",
      skyBottom: "#12050a",
      haze: "#ff4d4d",
      sun: "#ff8a5c",
      ridgeFar: "#8a1f2a",
      ridgeNear: "#2b0a11",
      ridge1Y: 355,
      ridge2Y: 435,
      ridge1Amp: 70,
      ridge2Amp: 98,
      soilTop: "#241214",
      soilBottom: "#080306",
      crystals: ["#ff4d4d", "#ffd34d"],
    },
    {
      id: "bg07",
      name: "海底蓝洞",
      seed: 707,
      stars: false,
      motif: null,
      skyTop: "#0aa3c7",
      skyBottom: "#04214a",
      haze: "#8fe9ff",
      sun: "#8fe9ff",
      ridgeFar: "#0b5f8a",
      ridgeNear: "#042a4d",
      ridge1Y: 345,
      ridge2Y: 430,
      ridge1Amp: 70,
      ridge2Amp: 100,
      soilTop: "#1b2a36",
      soilBottom: "#070c12",
      crystals: ["#8fe9ff", "#b07bff"],
    },
    {
      id: "bg08",
      name: "水晶矿脉",
      seed: 808,
      stars: true,
      motif: null,
      skyTop: "#1c0f3a",
      skyBottom: "#060512",
      haze: "#b07bff",
      sun: "#b07bff",
      ridgeFar: "#3b2369",
      ridgeNear: "#140b2d",
      ridge1Y: 340,
      ridge2Y: 420,
      ridge1Amp: 76,
      ridge2Amp: 106,
      soilTop: "#241b33",
      soilBottom: "#08050c",
      crystals: ["#b07bff", "#8fe9ff", "#ffd34d"],
    },
    {
      id: "bg09",
      name: "废弃矿井",
      seed: 909,
      stars: false,
      motif: "gears",
      skyTop: "#2c3442",
      skyBottom: "#0b0f18",
      haze: "#ffffff",
      sun: "#ffe08a",
      ridgeFar: "#3f4c5f",
      ridgeNear: "#141a24",
      ridge1Y: 350,
      ridge2Y: 430,
      ridge1Amp: 62,
      ridge2Amp: 92,
      soilTop: "#2a2620",
      soilBottom: "#0a0706",
      crystals: ["#ffd34d", "#a7b0ba"],
    },
    {
      id: "bg10",
      name: "紫雾禁地",
      seed: 1010,
      stars: true,
      motif: null,
      skyTop: "#2b0a3e",
      skyBottom: "#070513",
      haze: "#ff7ad8",
      sun: "#ff7ad8",
      ridgeFar: "#5a1a7a",
      ridgeNear: "#16061f",
      ridge1Y: 352,
      ridge2Y: 430,
      ridge1Amp: 74,
      ridge2Amp: 106,
      soilTop: "#261025",
      soilBottom: "#07030a",
      crystals: ["#ff7ad8", "#b07bff", "#8fe9ff"],
    },
    {
      id: "bg11",
      name: "遗迹神庙",
      seed: 1111,
      stars: false,
      motif: null,
      skyTop: "#ffd34d",
      skyBottom: "#1e6b8f",
      haze: "#ffffff",
      sun: "#fff1c4",
      ridgeFar: "#1f6f6f",
      ridgeNear: "#0d3342",
      ridge1Y: 345,
      ridge2Y: 425,
      ridge1Amp: 68,
      ridge2Amp: 92,
      soilTop: "#2b2a24",
      soilBottom: "#090806",
      crystals: ["#8fe9ff", "#ffd34d"],
    },
    {
      id: "bg12",
      name: "极光之夜",
      seed: 1212,
      stars: true,
      motif: null,
      skyTop: "#082642",
      skyBottom: "#02050b",
      haze: "#8fe9ff",
      sun: "#8fe9ff",
      ridgeFar: "#114a6b",
      ridgeNear: "#061321",
      ridge1Y: 338,
      ridge2Y: 420,
      ridge1Amp: 70,
      ridge2Amp: 98,
      soilTop: "#1e2a33",
      soilBottom: "#06080c",
      crystals: ["#8fe9ff", "#6ce0c2", "#b07bff"],
    },
    {
      id: "bg13",
      name: "秋林金风",
      seed: 1313,
      stars: false,
      motif: "pines",
      skyTop: "#ffb36a",
      skyBottom: "#2a3558",
      haze: "#ffe08a",
      sun: "#ffe08a",
      ridgeFar: "#8a3f1a",
      ridgeNear: "#2a1b1a",
      ridge1Y: 360,
      ridge2Y: 435,
      ridge1Amp: 72,
      ridge2Amp: 96,
      soilTop: "#2e2316",
      soilBottom: "#0b0806",
      crystals: ["#ffd34d", "#b07bff"],
    },
    {
      id: "bg14",
      name: "冰晶洞窟",
      seed: 1414,
      stars: true,
      motif: null,
      skyTop: "#15305a",
      skyBottom: "#050913",
      haze: "#8fe9ff",
      sun: "#ffffff",
      ridgeFar: "#2d5b9a",
      ridgeNear: "#0b1731",
      ridge1Y: 330,
      ridge2Y: 418,
      ridge1Amp: 84,
      ridge2Amp: 116,
      soilTop: "#1b2230",
      soilBottom: "#06070a",
      crystals: ["#8fe9ff", "#ffffff", "#b07bff"],
    },
    {
      id: "bg15",
      name: "机械矿场",
      seed: 1515,
      stars: false,
      motif: "gears",
      skyTop: "#364b6a",
      skyBottom: "#0b1019",
      haze: "#8fe9ff",
      sun: "#ffd34d",
      ridgeFar: "#4a5f7a",
      ridgeNear: "#152033",
      ridge1Y: 350,
      ridge2Y: 430,
      ridge1Amp: 66,
      ridge2Amp: 90,
      soilTop: "#2a2622",
      soilBottom: "#090706",
      crystals: ["#ffd34d", "#a7b0ba", "#8fe9ff"],
    },
  ];

  return themes.map((t) => ({ ...t, svg: buildBackgroundSvg(t) }));
}

const BACKGROUNDS = createBackgroundLibrary();

const bgAssets = {
  ready: false,
  images: [],
};

function svgToDataUri(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function pickBackgroundIndex(levelSeed, previousIndex) {
  const rng = createRng((levelSeed ^ 0x51ed270b) >>> 0);
  let idx = Math.floor(rng.next() * BACKGROUNDS.length);
  if (BACKGROUNDS.length > 1 && typeof previousIndex === "number" && idx === previousIndex) {
    idx = (idx + 1 + Math.floor(rng.next() * (BACKGROUNDS.length - 1))) % BACKGROUNDS.length;
  }
  return idx;
}

function drawImageCover(img, x, y, w, h) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;

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

  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function initBackgrounds() {
  bgAssets.ready = false;
  bgAssets.images = new Array(BACKGROUNDS.length);

  let loaded = 0;
  for (let i = 0; i < BACKGROUNDS.length; i += 1) {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      loaded += 1;
      if (loaded >= BACKGROUNDS.length) bgAssets.ready = true;
    };
    img.onerror = () => {
      loaded += 1;
      if (loaded >= BACKGROUNDS.length) bgAssets.ready = true;
    };
    img.src = svgToDataUri(BACKGROUNDS[i].svg);
    bgAssets.images[i] = img;
  }
}

const COLORS = {
  skyTop: "#0f1731",
  skyBottom: "#070a13",
  groundTop: "#1d1a13",
  groundBottom: "#0e0b08",
  wood: "#7a4b2a",
  rope: "rgba(255, 255, 255, 0.75)",
  hook: "#d7d7d7",
  gold: "#f6c54b",
  goldShadow: "#b07b12",
  rock: "#6f7682",
  rockShadow: "#3f4450",
  diamond: "#8fe9ff",
  diamondShadow: "#2f8aa1",
};

const BASE = {
  hookTipRadius: 7,
  pivotY: 106,
  minRope: 60,
  plankOffsetY: 2,
  plankHeight: 22,
};

const HOOK = {
  ringToTip: 44,
  jawBase: 16,
};

const SPEED_BOOST = 0.35;
const BOMB_RETRACT_MULT = 2.2;
const BOMB_BOOST_TIME = 0.55;

const KEG_IMMEDIATE_BOOM_CHANCE = 0.4;
const KEG_RELEASE_FRAC = 0.5; // halfway up
const KEG_GRAVITY = 1750;
const KEG_BLAST_RADIUS = 140;
const KEG_FALL_OUT_PAD = 50;

const ITEM_COUNT_SCALE = 0.7;
const ITEM_VALUE_SCALE = 0.4;

function scaleItemValue(value) {
  return Math.max(0, Math.round(value * ITEM_VALUE_SCALE));
}

const SHOP_ITEMS = [
  {
    id: "bomb",
    name: "炸药",
    cost: 150,
    desc: "炸掉当前抓到的物品（不计分）",
    icon: "icon-bomb",
  },
  {
    id: "speed",
    name: "加速",
    cost: 220,
    desc: "下关拉回速度 +35%",
    icon: "icon-speed",
  },
  {
    id: "lucky",
    name: "幸运袋",
    cost: 260,
    desc: "下关额外生成 1 个幸运袋",
    icon: "icon-lucky",
  },
];

const LEVELS = [
  {
    target: 650,
    time: 60,
    seed: 1201,
    mix: {
      goldSmall: 6,
      goldMedium: 4,
      goldLarge: 2,
      rock: 4,
      diamond: 1,
      bag: 2,
      bar: 1,
      crystal: 1,
      pouch: 1,
      fossil: 1,
      emerald: 0,
      ruby: 0,
      keg: 0,
    },
  },
  {
    target: 1200,
    time: 58,
    seed: 2315,
    mix: {
      goldSmall: 7,
      goldMedium: 5,
      goldLarge: 2,
      rock: 5,
      diamond: 1,
      bag: 2,
      bar: 1,
      crystal: 1,
      pouch: 1,
      fossil: 1,
      emerald: 0,
      ruby: 0,
      keg: 1,
    },
  },
  {
    target: 1750,
    time: 56,
    seed: 3427,
    mix: {
      goldSmall: 8,
      goldMedium: 5,
      goldLarge: 3,
      rock: 5,
      diamond: 2,
      bag: 2,
      bar: 2,
      crystal: 1,
      pouch: 1,
      fossil: 1,
      emerald: 1,
      ruby: 0,
      keg: 1,
    },
  },
  {
    target: 2350,
    time: 54,
    seed: 4579,
    mix: {
      goldSmall: 8,
      goldMedium: 6,
      goldLarge: 3,
      rock: 6,
      diamond: 2,
      bag: 3,
      bar: 2,
      crystal: 2,
      pouch: 1,
      fossil: 1,
      emerald: 1,
      ruby: 1,
      keg: 1,
    },
  },
  {
    target: 3000,
    time: 52,
    seed: 5683,
    mix: {
      goldSmall: 9,
      goldMedium: 6,
      goldLarge: 4,
      rock: 6,
      diamond: 2,
      bag: 3,
      bar: 2,
      crystal: 2,
      pouch: 1,
      fossil: 2,
      emerald: 1,
      ruby: 1,
      keg: 1,
    },
  },
  {
    target: 3700,
    time: 50,
    seed: 6761,
    mix: {
      goldSmall: 10,
      goldMedium: 7,
      goldLarge: 4,
      rock: 7,
      diamond: 3,
      bag: 3,
      bar: 2,
      crystal: 2,
      pouch: 2,
      fossil: 2,
      emerald: 1,
      ruby: 1,
      keg: 1,
    },
  },
];

const game = {
  phase: "menu", // menu | playing | shop | gameOver
  paused: false,
  mode: "single", // single | double
  lastHookIndex: 0,
  level: 1,
  score: 0,
  target: 0,
  timeLeft: 60,
  runSeed: 0,
  currentSeed: 0,
  bgIndex: 0,
  items: [],
  scene: {
    stars: [],
    dust: [],
    dirt: [],
  },
  inventory: {
    bombs: 0,
    speed: 0,
    lucky: 0,
  },
  effects: {
    speedMultiplier: 1,
    bombBoost: 0,
  },
  audio: {
    lastCountdownSec: null,
  },
  fx: {
    pops: [],
    particles: [],
    rings: [],
    shake: 0,
    flash: 0,
    shakeX: 0,
    shakeY: 0,
  },
  hook: {
    state: "swing", // swing | extend | retract
    angle: 0,
    angleDir: 1,
    minAngle: -1.15,
    maxAngle: 1.15,
    angleSpeed: 1.55,
    length: BASE.minRope,
    minLength: BASE.minRope,
    maxLength: 480,
    extendSpeed: 780,
    retractBaseSpeed: 640,
    attachedId: null,
    reelAngle: 0,
    spoolSpeed: 0,
    clawClose: 0,
    lastLength: BASE.minRope,
    trail: [],
    dustCooldown: 0,
    pivotX: 0,
  },
  hook2: {
    state: "swing", // swing | extend | retract
    angle: 0,
    angleDir: -1,
    minAngle: -1.15,
    maxAngle: 1.15,
    angleSpeed: 1.55,
    length: BASE.minRope,
    minLength: BASE.minRope,
    maxLength: 480,
    extendSpeed: 780,
    retractBaseSpeed: 640,
    attachedId: null,
    reelAngle: 0,
    spoolSpeed: 0,
    clawClose: 0,
    lastLength: BASE.minRope,
    trail: [],
    dustCooldown: 0,
    pivotX: 0,
  },
  viewport: { w: 960, h: 540 },
  miner: {
    grip: 1,
    crank: 0,
    releasePop: 0,
  },
  miner2: {
    grip: 1,
    crank: 0,
    releasePop: 0,
  },
};

function isTwoPlayerMode() {
  return game.mode === "double";
}

function getHooks() {
  return isTwoPlayerMode() ? [game.hook, game.hook2] : [game.hook];
}

function getMiners() {
  return isTwoPlayerMode() ? [game.miner, game.miner2] : [game.miner];
}

function getHookByIndex(index) {
  return index === 1 ? game.hook2 : game.hook;
}

function getMinerByIndex(index) {
  return index === 1 ? game.miner2 : game.miner;
}

function layoutPlayers() {
  const w = game.viewport.w;
  const center = w / 2;
  const margin = clamp(w * 0.1, 70, 140);
  const spread = clamp(w * 0.18, 90, 210);

  if (!isTwoPlayerMode()) {
    game.hook.pivotX = center;
    return;
  }

  game.hook.pivotX = clamp(center - spread, margin, w - margin);
  game.hook2.pivotX = clamp(center + spread, margin, w - margin);
}

function getPivot(hook = game.hook) {
  const x = Number.isFinite(hook?.pivotX) ? hook.pivotX : game.viewport.w / 2;
  return { x, y: BASE.pivotY };
}

function getPlankY() {
  return BASE.pivotY + (BASE.plankOffsetY ?? 0);
}

function getReelCenter(hook = game.hook) {
  const pivot = getPivot(hook);
  const y = getPlankY() - 16;
  return { x: pivot.x, y };
}

function getGroundY() {
  return game.viewport.h * 0.72;
}

function getHookDir(angle) {
  return { x: Math.sin(angle), y: Math.cos(angle) };
}

function getHookEnd(hook = game.hook, length = hook.length) {
  const pivot = getPivot(hook);
  const dir = getHookDir(hook.angle);
  return { x: pivot.x + dir.x * length, y: pivot.y + dir.y * length };
}

function resetHook(hook = game.hook) {
  hook.state = "swing";
  hook.length = hook.minLength;
  hook.attachedId = null;
  hook.clawClose = 0;
  hook.lastLength = hook.length;
  hook.trail.length = 0;
}

function getSeedFromUrl() {
  const param = new URLSearchParams(window.location.search).get("seed");
  if (!param) return null;
  const seed = Number.parseInt(param, 10);
  return Number.isFinite(seed) ? seed : null;
}

function initRunSeed() {
  const seed = getSeedFromUrl();
  if (seed !== null) {
    game.runSeed = seed;
  } else {
    game.runSeed = Math.floor(Math.random() * 900000) + 100000;
  }
}

function getLevelConfig(level) {
  const preset = LEVELS[level - 1];
  if (preset) return preset;

  const baseTarget = 650;
  const delta = 450;
  const time = clamp(62 - (level - 1) * 2, 42, 62);
  const mix = {
    goldSmall: 6 + level,
    goldMedium: 4 + Math.floor(level / 2),
    goldLarge: 2 + Math.floor(level / 3),
    rock: 4 + Math.floor(level / 2),
    diamond: 1 + Math.floor(level / 4),
    bag: 2 + Math.floor(level / 3),
    bar: 1 + Math.floor(level / 3),
    crystal: 1 + Math.floor(level / 4),
    pouch: level >= 2 ? 1 + Math.floor(level / 6) : 0,
    fossil: level >= 2 ? 1 + Math.floor(level / 5) : 0,
    emerald: level >= 3 ? 1 : 0,
    ruby: level >= 4 ? 1 : 0,
    keg: level >= 2 ? 1 : 0,
  };

  return { target: baseTarget + (level - 1) * delta, time, seed: 9000 + level * 997, mix };
}

function bagValueRange(level) {
  const min = 120 + level * 20;
  const max = 800 + level * 60;
  return { min, max };
}

function intRange(rng, min, maxInclusive) {
  return Math.floor(rng.range(min, maxInclusive + 1));
}

function makeBlob(rng, pointsCount, minRadius, maxRadius) {
  const points = [];
  const step = (Math.PI * 2) / pointsCount;
  const offset = rng.range(0, Math.PI * 2);
  for (let i = 0; i < pointsCount; i += 1) {
    points.push({ a: offset + i * step, r: rng.range(minRadius, maxRadius) });
  }
  return points;
}

function createItemArt(item, rng) {
  const rot = rng.range(0, Math.PI * 2);
  if (item.type === "gold") {
    const sparkles = [];
    const sparkleCount = intRange(rng, 1, 3);
    for (let i = 0; i < sparkleCount; i += 1) {
      sparkles.push({
        a: rng.range(0, Math.PI * 2),
        d: rng.range(0.12, 0.58),
        s: rng.range(0.1, 0.22),
        p: rng.range(0, Math.PI * 2),
      });
    }
    return {
      rot,
      blob: makeBlob(rng, intRange(rng, 8, 12), 0.72, 1.06),
      glint: rng.range(0.15, 0.85),
      sparkles,
    };
  }

  if (item.type === "rock") {
    const specks = [];
    const speckCount = intRange(rng, 4, 10);
    for (let i = 0; i < speckCount; i += 1) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(0.1, 0.65);
      specks.push({
        x: Math.cos(a) * d,
        y: Math.sin(a) * d,
        r: rng.range(0.06, 0.18),
        a: rng.range(0.06, 0.22),
      });
    }
    return {
      rot,
      blob: makeBlob(rng, intRange(rng, 7, 10), 0.78, 1.14),
      specks,
      tint: rng.range(-0.08, 0.08),
    };
  }

  if (item.type === "diamond") {
    return {
      rot,
      twinkle: rng.range(0, Math.PI * 2),
    };
  }

  if (item.type === "bag") {
    return {
      rot,
      stripe: rng.range(0.2, 0.85),
      stitch: rng.range(0.15, 0.85),
    };
  }

  if (item.type === "bar") {
    return {
      rot,
      shine: rng.range(0, Math.PI * 2),
      stamp: rng.range(0.1, 0.9),
    };
  }

  if (item.type === "emerald" || item.type === "ruby") {
    return {
      rot,
      twinkle: rng.range(0, Math.PI * 2),
      facet: rng.range(0.2, 0.9),
    };
  }

  if (item.type === "crystal") {
    const spikes = intRange(rng, 4, 7);
    const dirs = [];
    for (let i = 0; i < spikes; i += 1) {
      dirs.push({
        a: rng.range(-0.9, 0.9),
        h: rng.range(0.65, 1.25),
        w: rng.range(0.18, 0.32),
      });
    }
    return {
      rot,
      twinkle: rng.range(0, Math.PI * 2),
      dirs,
    };
  }

  if (item.type === "pouch") {
    return {
      rot,
      jiggle: rng.range(0, Math.PI * 2),
      seam: rng.range(0.15, 0.85),
      coins: intRange(rng, 2, 4),
    };
  }

  if (item.type === "keg") {
    return {
      rot,
      fuse: rng.range(0, Math.PI * 2),
      stripe: rng.range(0.2, 0.85),
    };
  }

  if (item.type === "fossil") {
    const cracks = [];
    const n = intRange(rng, 2, 4);
    for (let i = 0; i < n; i += 1) {
      cracks.push({
        a: rng.range(0, Math.PI * 2),
        d: rng.range(0.15, 0.55),
        l: rng.range(0.35, 0.7),
        w: rng.range(0.04, 0.08),
      });
    }
    return {
      rot,
      cracks,
      tint: rng.range(-0.06, 0.08),
    };
  }

  return { rot };
}

function makeItem({ id, type, x, y, r, value, weight }) {
  return {
    id,
    type, // gold | rock | diamond | bag | bar | emerald | ruby | crystal | pouch | keg | fossil
    x,
    y,
    r,
    value,
    weight,
    grabbed: false,
    bagValue: type === "bag" ? value : null,
    keg: null,
    art: null,
  };
}

function itemStyle(item) {
  switch (item.type) {
    case "diamond":
      return { fill: COLORS.diamond, shadow: COLORS.diamondShadow };
    case "rock":
      return { fill: COLORS.rock, shadow: COLORS.rockShadow };
    case "bag":
      return { fill: "#b07bff", shadow: "#50278a" };
    case "gold":
    default:
      return { fill: COLORS.gold, shadow: COLORS.goldShadow };
  }
}

function buildScene(seed) {
  const rng = createRng((seed ^ 0x9e3779b9) >>> 0);
  const w = game.viewport.w;
  const h = game.viewport.h;
  const groundY = h * 0.72;

  const stars = [];
  const starCount = clamp(Math.floor((w * groundY) / 19000), 36, 76);
  for (let i = 0; i < starCount; i += 1) {
    stars.push({
      x: rng.range(0, w),
      y: rng.range(0, groundY * 0.58),
      r: rng.range(0.6, 1.8),
      a: rng.range(0.08, 0.28),
      tw: rng.range(0, Math.PI * 2),
    });
  }

  const dust = [];
  const dustCount = clamp(Math.floor((w * (h - groundY)) / 9000), 55, 130);
  for (let i = 0; i < dustCount; i += 1) {
    dust.push({
      x: rng.range(0, w),
      y: rng.range(groundY + 10, h),
      r: rng.range(0.8, 2.2),
      a: rng.range(0.03, 0.12),
      tw: rng.range(0, Math.PI * 2),
    });
  }

  const dirt = [];
  const dirtCount = clamp(Math.floor((w * (h - groundY)) / 5200), 90, 190);
  for (let i = 0; i < dirtCount; i += 1) {
    dirt.push({
      x: rng.range(0, w),
      y: rng.range(groundY + 12, h),
      r: rng.range(0.6, 3.4),
      a: rng.range(0.05, 0.18),
      hue: rng.range(-0.08, 0.08),
    });
  }

  game.scene.stars = stars;
  game.scene.dust = dust;
  game.scene.dirt = dirt;
}

function generateLevel(level, options = {}) {
  const config = getLevelConfig(level);
  game.target = Math.ceil(config.target * (isTwoPlayerMode() ? 1.3 : 1));
  game.timeLeft = config.time;

  const seed = (config.seed ?? 0) + game.runSeed;
  game.currentSeed = seed;
  window.GameAudio?.setTrackFromSeed?.(seed);
  syncAudioButtons();
  game.bgIndex = pickBackgroundIndex(seed, game.bgIndex);
  const rng = createRng(seed);

  const w = game.viewport.w;
  const h = game.viewport.h;

  const minY = 170;
  const margin = 34;

  const items = [];
  let nextId = 1;

  function tryPlace(item) {
    for (const other of items) {
      const minDist = item.r + other.r + 10;
      if (dist2(item.x, item.y, other.x, other.y) <= minDist * minDist) return false;
    }
    return true;
  }

  function buildSpec(type, size) {
    if (type === "bar") {
      return {
        type,
        r: rng.range(16, 22),
        value: scaleItemValue(Math.round(rng.range(220, 420))),
        weight: 1.6,
      };
    }

    if (type === "emerald") {
      return {
        type,
        r: rng.range(10, 14),
        value: scaleItemValue(Math.round(rng.range(480, 800))),
        weight: 1.05,
      };
    }

    if (type === "ruby") {
      return {
        type,
        r: rng.range(10, 14),
        value: scaleItemValue(Math.round(rng.range(520, 900))),
        weight: 1.1,
      };
    }

    if (type === "crystal") {
      return {
        type,
        r: rng.range(16, 24),
        value: scaleItemValue(Math.round(rng.range(180, 360))),
        weight: 1.35,
      };
    }

    if (type === "pouch") {
      return {
        type,
        r: rng.range(13, 18),
        value: scaleItemValue(Math.round(rng.range(150, 1000))),
        weight: 2.0,
      };
    }

    if (type === "keg") {
      return {
        type,
        r: rng.range(18, 24),
        value: 0,
        weight: 4.8,
      };
    }

    if (type === "fossil") {
      return {
        type,
        r: rng.range(20, 28),
        value: scaleItemValue(Math.round(rng.range(300, 650))),
        weight: 3.4,
      };
    }

    if (type === "gold") {
      if (size === "small") {
        return {
          type,
          r: rng.range(12, 18),
          value: scaleItemValue(Math.round(rng.range(60, 120))),
          weight: 1.0,
        };
      }
      if (size === "medium") {
        return {
          type,
          r: rng.range(20, 26),
          value: scaleItemValue(Math.round(rng.range(160, 260))),
          weight: 2.0,
        };
      }
      return {
        type,
        r: rng.range(30, 40),
        value: scaleItemValue(Math.round(rng.range(320, 520))),
        weight: 4.2,
      };
    }
    if (type === "rock") {
      return {
        type,
        r: rng.range(18, 32),
        value: scaleItemValue(Math.round(rng.range(10, 60))),
        weight: 5.8,
      };
    }
    if (type === "diamond") {
      return {
        type,
        r: rng.range(10, 14),
        value: scaleItemValue(Math.round(rng.range(420, 620))),
        weight: 1.25,
      };
    }
    const bagRange = bagValueRange(level);
    return {
      type: "bag",
      r: rng.range(12, 18),
      value: scaleItemValue(Math.round(rng.range(bagRange.min, bagRange.max))),
      weight: 1.8,
    };
  }

  const extraBags = options.extraBags ?? 0;
  const scaledCount = (count) => Math.max(0, Math.round((count ?? 0) * ITEM_COUNT_SCALE));
  const spawnQueue = [];
  for (let i = 0; i < scaledCount(config.mix.goldSmall); i += 1) spawnQueue.push(buildSpec("gold", "small"));
  for (let i = 0; i < scaledCount(config.mix.goldMedium); i += 1) spawnQueue.push(buildSpec("gold", "medium"));
  for (let i = 0; i < scaledCount(config.mix.goldLarge); i += 1) spawnQueue.push(buildSpec("gold", "large"));
  for (let i = 0; i < scaledCount(config.mix.rock); i += 1) spawnQueue.push(buildSpec("rock"));
  for (let i = 0; i < scaledCount(config.mix.diamond); i += 1) spawnQueue.push(buildSpec("diamond"));
  for (let i = 0; i < scaledCount(config.mix.bag) + extraBags; i += 1) spawnQueue.push(buildSpec("bag"));
  for (let i = 0; i < scaledCount(config.mix.bar); i += 1) spawnQueue.push(buildSpec("bar"));
  for (let i = 0; i < scaledCount(config.mix.emerald); i += 1) spawnQueue.push(buildSpec("emerald"));
  for (let i = 0; i < scaledCount(config.mix.ruby); i += 1) spawnQueue.push(buildSpec("ruby"));
  for (let i = 0; i < scaledCount(config.mix.crystal); i += 1) spawnQueue.push(buildSpec("crystal"));
  for (let i = 0; i < scaledCount(config.mix.pouch); i += 1) spawnQueue.push(buildSpec("pouch"));
  for (let i = 0; i < scaledCount(config.mix.keg); i += 1) spawnQueue.push(buildSpec("keg"));
  for (let i = 0; i < scaledCount(config.mix.fossil); i += 1) spawnQueue.push(buildSpec("fossil"));

  for (let i = spawnQueue.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1));
    [spawnQueue[i], spawnQueue[j]] = [spawnQueue[j], spawnQueue[i]];
  }

  for (const spec of spawnQueue) {
    let placed = false;
    for (let attempt = 0; attempt < 42; attempt += 1) {
      const x = rng.range(margin + spec.r, w - margin - spec.r);
      const y = rng.range(minY + spec.r, h - margin - spec.r);
      const item = makeItem({ id: nextId++, ...spec, x, y });
      item.art = createItemArt(item, rng);
      if (tryPlace(item)) {
        items.push(item);
        placed = true;
        break;
      }
    }
    if (!placed) {
      nextId -= 1;
    }
  }

  game.items = items;
  buildScene(seed);
  recalcHookMaxLength();
  for (const hook of getHooks()) resetHook(hook);
}

const bumpTimers = new WeakMap();
function bump(el) {
  if (!el) return;
  const prev = bumpTimers.get(el);
  if (prev) clearTimeout(prev);
  el.classList.remove("bump");
  // Force reflow so the animation can restart.
  void el.offsetWidth;
  el.classList.add("bump");
  bumpTimers.set(
    el,
    setTimeout(() => {
      el.classList.remove("bump");
      bumpTimers.delete(el);
    }, 260)
  );
}

const hudPrev = {
  bombs: 0,
  speed: 0,
  lucky: 0,
  score: 0,
};

function updateHud() {
  const score = Math.floor(game.score);
  const bombs = game.inventory.bombs;
  const speed = game.inventory.speed;
  const lucky = game.inventory.lucky;

  ui.level.textContent = String(game.level);
  ui.score.textContent = String(score);
  ui.target.textContent = String(Math.floor(game.target));
  ui.time.textContent = String(Math.ceil(game.timeLeft));
  ui.bombs.textContent = String(bombs);
  ui.speedTokens.textContent = String(speed);
  ui.luckyTokens.textContent = String(lucky);

  if (bombs !== hudPrev.bombs) bump(uiRefs.bombChip);
  if (speed !== hudPrev.speed) bump(uiRefs.speedChip);
  if (lucky !== hudPrev.lucky) bump(uiRefs.luckyChip);
  if (score !== hudPrev.score && score > hudPrev.score) bump(uiRefs.scoreStat);

  hudPrev.bombs = bombs;
  hudPrev.speed = speed;
  hudPrev.lucky = lucky;
  hudPrev.score = score;

  uiRefs.timeStat?.classList.toggle(
    "danger",
    game.phase === "playing" && !game.paused && game.timeLeft <= 10
  );

  const inGame = game.phase !== "menu";
  ui.pauseBtn.disabled = !inGame || game.phase !== "playing";
  ui.restartBtn.disabled = !inGame;
  ui.startBtn.disabled = game.phase !== "menu";

  const canBomb =
    game.phase === "playing" &&
    !game.paused &&
    game.inventory.bombs > 0 &&
    getHooks().some((hook) => hook.state === "retract" && attachedItem(hook));
  ui.bombBtn.disabled = !canBomb;

  ui.pauseBtn.textContent = game.paused ? "继续" : "暂停";
}

let overlayPrimaryAction = null;
let overlaySecondaryAction = null;

function showOverlay({ title, text, primary, secondary, showShop = false }) {
  ui.overlayTitle.textContent = title;
  ui.overlayText.textContent = text;

  if (primary) {
    ui.overlayPrimaryBtn.textContent = primary.label;
    ui.overlayPrimaryBtn.style.display = "";
    overlayPrimaryAction = primary.onClick;
  } else {
    ui.overlayPrimaryBtn.style.display = "none";
    overlayPrimaryAction = null;
  }

  if (secondary) {
    ui.overlaySecondaryBtn.textContent = secondary.label;
    ui.overlaySecondaryBtn.style.display = "";
    overlaySecondaryAction = secondary.onClick;
  } else {
    ui.overlaySecondaryBtn.style.display = "none";
    overlaySecondaryAction = null;
  }

  if (showShop) {
    ui.shopPanel.classList.remove("hidden");
  } else {
    ui.shopPanel.classList.add("hidden");
  }

  ui.overlay.classList.remove("hidden");
}

function hideOverlay() {
  ui.overlay.classList.add("hidden");
  ui.shopPanel.classList.add("hidden");
  overlayPrimaryAction = null;
  overlaySecondaryAction = null;
}

function setGameMode(mode) {
  game.mode = mode === "double" ? "double" : "single";
  game.lastHookIndex = 0;
  layoutPlayers();
  recalcHookMaxLength();
  render();
}

function showModeSelectOverlay() {
  showOverlay({
    title: "选择模式",
    text: `单人：保持原玩法。\n双人：两位矿工同时出钩（目标分数 +30%）。\n\n单人放钩：空格 / 点击\n双人放钩：玩家1 空格/点击；玩家2 回车(Enter)\n\n本局种子：${game.runSeed}（可用 ?seed=12345 固定）`,
    primary: {
      label: "单人模式",
      onClick: () => {
        setGameMode("single");
        startGame();
      },
    },
    secondary: {
      label: "双人模式",
      onClick: () => {
        setGameMode("double");
        startGame();
      },
    },
  });
}

function resetInventory() {
  game.inventory.bombs = 0;
  game.inventory.speed = 0;
  game.inventory.lucky = 0;
}

function consumeSpeedBoost() {
  if (game.inventory.speed <= 0) return 0;
  game.inventory.speed -= 1;
  return SPEED_BOOST;
}

function consumeLuckyBag() {
  if (game.inventory.lucky <= 0) return 0;
  game.inventory.lucky -= 1;
  return 1;
}

function prepareLevelStart() {
  game.effects.speedMultiplier = 1 + consumeSpeedBoost();
  game.effects.bombBoost = 0;
  game.audio.lastCountdownSec = null;
  const extraBags = consumeLuckyBag();
  generateLevel(game.level, { extraBags });
}

function startGame() {
  game.score = 0;
  game.level = 1;
  game.phase = "playing";
  game.paused = false;
  resetInventory();
  prepareLevelStart();
  audioInit();
  hideOverlay();
  updateHud();
  audioPlay("level_start");
}

function restartGame() {
  startGame();
}

function togglePause() {
  if (game.phase !== "playing") return;
  game.paused = !game.paused;
  audioInit();
  audioPlay(game.paused ? "pause" : "resume");

  if (game.paused) {
    showOverlay({
      title: "已暂停",
      text: "按 P 或点击「继续」返回游戏。",
      primary: {
        label: "继续",
        onClick: () => {
          game.paused = false;
          hideOverlay();
          updateHud();
        },
      },
      secondary: { label: "重开", onClick: restartGame },
    });
  } else {
    hideOverlay();
  }

  updateHud();
}

function shopSummaryText() {
  return `本关得分 ${Math.floor(game.score)} / 目标 ${Math.floor(
    game.target
  )}。购买道具可提升下一关。`;
}

function createSymbolIcon(symbolId) {
  const wrap = document.createElement("div");
  wrap.className = `shopIcon ${symbolId.replace("icon-", "")}`;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#${symbolId}`);
  use.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", `#${symbolId}`);
  svg.appendChild(use);
  wrap.appendChild(svg);
  return wrap;
}

function renderShop() {
  ui.shopList.innerHTML = "";
  const bgName = BACKGROUNDS[game.bgIndex]?.name ?? "未知背景";
  const trackName = window.GameAudio?.getTrackName?.() ?? "—";
  ui.shopSeed.textContent = `本局种子：${game.runSeed} / 关卡种子：${game.currentSeed} / 背景：${bgName} / 音乐：${trackName}`;
  ui.overlayText.textContent = shopSummaryText();

  for (const item of SHOP_ITEMS) {
    const owned =
      item.id === "bomb"
        ? game.inventory.bombs
        : item.id === "speed"
          ? game.inventory.speed
          : game.inventory.lucky;

    const card = document.createElement("div");
    card.className = "shopItem";

    const icon = createSymbolIcon(item.icon);

    const meta = document.createElement("div");
    const title = document.createElement("div");
    title.className = "shopTitle";
    title.textContent = `${item.name} · ${item.cost}分`;

    const desc = document.createElement("div");
    desc.className = "shopDesc";
    desc.textContent = item.desc;

    const ownedLine = document.createElement("div");
    ownedLine.className = "shopOwned";
    ownedLine.textContent = `已拥有 ${owned}`;

    meta.appendChild(title);
    meta.appendChild(desc);
    meta.appendChild(ownedLine);

    const buyBtn = document.createElement("button");
    buyBtn.className = "btn";
    buyBtn.textContent = "购买";
    buyBtn.disabled = game.score < item.cost;
    buyBtn.addEventListener("click", () => {
      if (game.score < item.cost) return;
      audioInit();
      audioPlay("buy");
      game.score -= item.cost;
      if (item.id === "bomb") game.inventory.bombs += 1;
      if (item.id === "speed") game.inventory.speed += 1;
      if (item.id === "lucky") game.inventory.lucky += 1;
      renderShop();
      updateHud();
    });

    card.appendChild(icon);
    card.appendChild(meta);
    card.appendChild(buyBtn);
    ui.shopList.appendChild(card);
  }
}

function openShop() {
  audioInit();
  game.phase = "shop";
  game.paused = true;
  audioPlay("shop_open");
  renderShop();
  showOverlay({
    title: "商店",
    text: shopSummaryText(),
    primary: {
      label: "开始下一关",
      onClick: () => {
        game.level += 1;
        game.phase = "playing";
        game.paused = false;
        prepareLevelStart();
        audioInit();
        hideOverlay();
        updateHud();
        audioPlay("level_start");
      },
    },
    secondary: { label: "重开", onClick: restartGame },
    showShop: true,
  });
  updateHud();
}

function endLevel() {
  for (const hook of getHooks()) {
    const item = attachedItem(hook);
    if (item) item.grabbed = false;
    resetHook(hook);
  }
  if (game.score >= game.target) {
    openShop();
  } else {
    game.phase = "gameOver";
    audioInit();
    audioPlay("game_over");
    showOverlay({
      title: "失败",
      text: `还差 ${Math.max(0, Math.floor(game.target - game.score))} 分。再来一次？`,
      primary: { label: "再来一次", onClick: restartGame },
      secondary: null,
    });
  }
  updateHud();
}

function dropHookFor(index) {
  if (game.phase !== "playing" || game.paused) return;
  if (!isTwoPlayerMode() && index !== 0) return;

  const hook = getHookByIndex(index);
  const miner = getMinerByIndex(index);
  if (hook.state !== "swing") return;

  audioInit();
  audioPlay("hook_shoot");
  hook.state = "extend";
  miner.releasePop = 1;
  miner.grip = Math.min(miner.grip, 0.15);
  hook.length = hook.minLength;
  hook.trail.length = 0;
  game.lastHookIndex = index;
}

function dropHook() {
  dropHookFor(0);
}

function useBomb() {
  if (game.phase !== "playing" || game.paused) return;
  if (game.inventory.bombs <= 0) return;
  const canBombHook = (hook) => hook.state === "retract" && attachedItem(hook);
  const preferred = getHookByIndex(game.lastHookIndex);
  const hook = canBombHook(preferred) ? preferred : getHooks().find((h) => canBombHook(h)) ?? null;
  if (!hook) return;

  const item = attachedItem(hook);
  if (!item) return;

  audioInit();
  audioPlay("bomb");

  const boom = getHookEnd(hook);
  game.inventory.bombs -= 1;
  game.items = game.items.filter((it) => it.id !== item.id);
  hook.attachedId = null;
  hook.clawClose = 0;
  game.effects.bombBoost = BOMB_BOOST_TIME;

  game.fx.shake = Math.max(game.fx.shake, 0.28);
  game.fx.flash = Math.max(game.fx.flash, 0.16);
  spawnRing({
    x: boom.x,
    y: boom.y,
    r0: 8,
    r1: 90,
    life: 0.55,
    color: "rgba(255, 224, 138, 0.9)",
    width: 5,
  });
  spawnBurst({
    x: boom.x,
    y: boom.y,
    count: 34,
    colors: ["#ffd34d", "#ff8a5c", "#ff4d4d", "#ffe08a"],
    speedMin: 140,
    speedMax: 420,
    sizeMin: 1.4,
    sizeMax: 4.8,
    lifeMin: 0.28,
    lifeMax: 0.85,
    gravity: 650,
  });
  spawnBurst({
    x: boom.x,
    y: boom.y,
    count: 18,
    colors: ["rgba(30,30,30,0.85)", "rgba(80,80,80,0.7)"],
    speedMin: 60,
    speedMax: 180,
    sizeMin: 2.2,
    sizeMax: 6.2,
    lifeMin: 0.55,
    lifeMax: 1.15,
    gravity: 260,
  });
  updateHud();
}

function explodeAt({ x, y, radius = 120, strength = 1 }) {
  audioInit();
  audioPlay("bomb");

  const pow = clamp(strength, 0.5, 2);
  game.fx.shake = Math.max(game.fx.shake, 0.26 + 0.18 * pow);
  game.fx.flash = Math.max(game.fx.flash, 0.14 + 0.12 * pow);

  spawnRing({
    x,
    y,
    r0: 10,
    r1: radius * (0.92 + 0.18 * pow),
    life: 0.62,
    color: "rgba(255, 224, 138, 0.95)",
    width: 6,
  });
  spawnBurst({
    x,
    y,
    count: Math.round(44 * pow),
    colors: ["#ffd34d", "#ff8a5c", "#ff4d4d", "#ffe08a", "#ffffff"],
    speedMin: 160,
    speedMax: 520,
    sizeMin: 1.2,
    sizeMax: 5.2,
    lifeMin: 0.24,
    lifeMax: 0.9,
    gravity: 720,
  });
  spawnBurst({
    x,
    y,
    count: Math.round(22 * pow),
    colors: ["rgba(30,30,30,0.85)", "rgba(80,80,80,0.72)", "rgba(140,140,140,0.55)"],
    speedMin: 80,
    speedMax: 240,
    sizeMin: 2.2,
    sizeMax: 8.0,
    lifeMin: 0.7,
    lifeMax: 1.45,
    gravity: 280,
  });
}

function explodeKegAt(x, y) {
  explodeAt({ x, y, radius: KEG_BLAST_RADIUS, strength: 1.15 });

  const r = KEG_BLAST_RADIUS;
  const removedIds = new Set();
  game.items = game.items.filter((it) => {
    const rr = r + it.r * 0.15;
    if (dist2(x, y, it.x, it.y) <= rr * rr) {
      removedIds.add(it.id);
      return false;
    }
    return true;
  });

  for (const hook of getHooks()) {
    if (hook.attachedId && removedIds.has(hook.attachedId)) {
      hook.attachedId = null;
      hook.clawClose = 0;
    }
  }
}

function dropKeg(hook, item) {
  item.grabbed = false;
  item.keg = { stage: "fall", vy: 0, x0: item.x };
  hook.attachedId = null;
  hook.clawClose = 0;

  audioInit();
  audioPlay("ui_error");

  spawnRing({
    x: item.x,
    y: item.y,
    r0: 6,
    r1: 34,
    life: 0.28,
    color: "rgba(255, 77, 77, 0.9)",
    width: 3,
  });
}

function updateFallingKegs(dt) {
  const h = game.viewport.h;
  for (let i = 0; i < game.items.length; i += 1) {
    const item = game.items[i];
    if (item.type !== "keg") continue;
    if (item.keg?.stage !== "fall") continue;

    const lockX = typeof item.keg.x0 === "number" ? item.keg.x0 : item.x;
    item.x = lockX;

    const vy = (item.keg.vy ?? 0) + KEG_GRAVITY * dt;
    item.keg.vy = vy;
    item.y += vy * dt;

    if (item.art) item.art.rot = (item.art.rot ?? 0) + dt * (0.6 + vy / 1300) * 0.9;

    // Collision with any item => explode
    for (let j = 0; j < game.items.length; j += 1) {
      if (j === i) continue;
      const other = game.items[j];
      const rr = item.r + other.r;
      if (dist2(item.x, item.y, other.x, other.y) <= rr * rr) {
        explodeKegAt(item.x, item.y);
        return;
      }
    }

    // Fall out of screen => disappear
    if (item.y - item.r > h + KEG_FALL_OUT_PAD) {
      game.items.splice(i, 1);
      i -= 1;
    }
  }
}

function attachedItem(hook = game.hook) {
  if (!hook.attachedId) return null;
  return game.items.find((it) => it.id === hook.attachedId) ?? null;
}

function attachToHook(hook, item) {
  item.grabbed = true;
  hook.attachedId = item.id;
  hook.state = "retract";
  hook.clawClose = 1;
  game.lastHookIndex = hook === game.hook2 ? 1 : 0;

  audioInit();
  if (item.type === "rock" || item.type === "fossil") audioPlay("hook_hit_rock");
  else if (item.type === "diamond" || item.type === "emerald" || item.type === "ruby" || item.type === "crystal")
    audioPlay("hook_hit_diamond");
  else if (item.type === "bag" || item.type === "pouch") audioPlay("hook_hit_bag");
  else if (item.type === "keg") {
    audioPlay("hook_hit_rock");
    audioPlay("ui_error");
  } else audioPlay("hook_hit_gold");

  if (item.type === "keg") {
    item.keg = { stage: "pull", releaseLength: lerp(hook.minLength, hook.length, KEG_RELEASE_FRAC) };

    if (Math.random() < KEG_IMMEDIATE_BOOM_CHANCE) {
      const p = getHookEnd(hook);
      explodeKegAt(p.x, p.y);
      hook.attachedId = null;
      hook.clawClose = 0;
      item.grabbed = false;
      return;
    }
  }

  const p = getHookEnd(hook);
  const color = itemFxColor(item);
  spawnRing({ x: p.x, y: p.y, r0: 6, r1: 28, life: 0.28, color, width: 2.5 });
  spawnBurst({
    x: p.x,
    y: p.y,
    count: item.type === "rock" ? 10 : 14,
    colors:
      item.type === "rock"
        ? ["rgba(210, 175, 120, 0.25)", "rgba(120, 85, 45, 0.22)", "#a7b0ba"]
        : [color, "#ffffff", "#ffe08a"],
    speedMin: 60,
    speedMax: item.type === "rock" ? 180 : 240,
    sizeMin: 1.0,
    sizeMax: 3.6,
    lifeMin: 0.2,
    lifeMax: 0.55,
    gravity: item.type === "rock" ? 680 : 520,
  });
  if (item.type === "rock") game.fx.shake = Math.max(game.fx.shake, 0.08);
}

function itemFxColor(item) {
  switch (item.type) {
    case "diamond":
      return "#8fe9ff";
    case "emerald":
      return "#34e28a";
    case "ruby":
      return "#ff4d6d";
    case "crystal":
      return "#a6f6ff";
    case "rock":
      return "#a7b0ba";
    case "fossil":
      return "#e7d3a5";
    case "bag":
      return "#b07bff";
    case "pouch":
      return "#ffd34d";
    case "keg":
      return "#ff6b5a";
    case "bar":
      return "#ffd34d";
    case "gold":
    default:
      return "#ffd34d";
  }
}

function spawnBurst({ x, y, count, colors, speedMin, speedMax, sizeMin, sizeMax, lifeMin, lifeMax, gravity }) {
  const grav = gravity ?? 380;
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = lerp(speedMin, speedMax, Math.random());
    game.fx.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - s * 0.15,
      size: lerp(sizeMin, sizeMax, Math.random()),
      age: 0,
      life: lerp(lifeMin, lifeMax, Math.random()),
      color: colors[Math.floor(Math.random() * colors.length)],
      gravity: grav,
    });
  }
}

function spawnRing({ x, y, r0, r1, life, color, width }) {
  game.fx.rings.push({
    x,
    y,
    r0,
    r1,
    width,
    age: 0,
    life,
    color,
  });
}

function spawnDirtPuff(x, y, intensity) {
  const t = clamp(intensity, 0.6, 3);
  spawnBurst({
    x,
    y,
    count: clamp(Math.round(4 + 5 * t), 5, 22),
    colors: ["rgba(255, 224, 138, 0.18)", "rgba(210, 175, 120, 0.28)", "rgba(120, 85, 45, 0.24)"],
    speedMin: 30,
    speedMax: 140,
    sizeMin: 1.2,
    sizeMax: 4.4,
    lifeMin: 0.25,
    lifeMax: 0.75,
    gravity: 420,
  });
}

function addScorePop(amount, color, hook = game.hook) {
  const pivot = getPivot(hook);
  game.fx.pops.push({
    x: pivot.x,
    y: pivot.y + 26,
    vx: lerp(-18, 18, Math.random()),
    vy: lerp(-62, -92, Math.random()),
    age: 0,
    life: 0.9,
    text: `+${amount}`,
    color,
  });
}

function deliverAttachedItem(hook, item) {
  const earned = item.type === "bag" ? item.bagValue ?? item.value : item.value;
  game.score += earned;
  game.items = game.items.filter((it) => it.id !== item.id);

  audioInit();
  audioPlay("score", { amount: earned });

  const color = itemFxColor(item);
  addScorePop(earned, color, hook);
  const pivot = getPivot(hook);
  spawnRing({
    x: pivot.x,
    y: pivot.y + 18,
    r0: 10,
    r1: 54,
    life: 0.55,
    color,
    width: 3,
  });
  spawnBurst({
    x: pivot.x,
    y: pivot.y + 18,
    count: clamp(Math.round(10 + item.r / 3), 10, 18),
    colors: [color, "#ffffff", "#ffe08a"],
    speedMin: 80,
    speedMax: 220,
    sizeMin: 1.2,
    sizeMax: 3.6,
    lifeMin: 0.35,
    lifeMax: 0.7,
    gravity: 520,
  });
}

function updateFx(dt) {
  if (game.fx.flash > 0) game.fx.flash = Math.max(0, game.fx.flash - dt * 2.8);

  if (game.fx.shake > 0) {
    game.fx.shake = Math.max(0, game.fx.shake - dt * 2.2);
    const power = game.fx.shake;
    game.fx.shakeX = (Math.random() * 2 - 1) * power * 10;
    game.fx.shakeY = (Math.random() * 2 - 1) * power * 8;
  } else {
    game.fx.shakeX = 0;
    game.fx.shakeY = 0;
  }

  for (let i = game.fx.pops.length - 1; i >= 0; i -= 1) {
    const p = game.fx.pops[i];
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 180 * dt;
    if (p.age >= p.life) game.fx.pops.splice(i, 1);
  }

  for (let i = game.fx.rings.length - 1; i >= 0; i -= 1) {
    const r = game.fx.rings[i];
    r.age += dt;
    if (r.age >= r.life) game.fx.rings.splice(i, 1);
  }

  for (let i = game.fx.particles.length - 1; i >= 0; i -= 1) {
    const p = game.fx.particles[i];
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += (p.gravity ?? 380) * dt;
    p.vx *= 0.985;
    p.size *= 0.992;
    if (p.age >= p.life || p.size <= 0.2) game.fx.particles.splice(i, 1);
  }
}

function updateHookTrail(dt) {
  for (const hook of getHooks()) {
    const trail = hook.trail;

    for (let i = trail.length - 1; i >= 0; i -= 1) {
      trail[i].age += dt;
      if (trail[i].age >= 0.55) trail.splice(i, 1);
    }

    const state = hook.state;
    if (state !== "extend" && state !== "retract") continue;

    const end = getHookEnd(hook);
    const last = trail[trail.length - 1] ?? null;
    if (!last || dist2(last.x, last.y, end.x, end.y) >= 7 * 7) {
      trail.push({ x: end.x, y: end.y, age: 0 });
      if (trail.length > 28) trail.shift();
    } else {
      last.x = end.x;
      last.y = end.y;
    }
  }
}

function smoothTo(current, target, speed, dt) {
  const t = 1 - Math.exp(-Math.max(0, speed) * Math.max(0, dt));
  return lerp(current, target, clamp(t, 0, 1));
}

function updateMinerFor(miner, hook, dt) {
  const active = game.phase === "playing" && !game.paused;
  const hookState = hook.state;

  const targetGrip = active && hookState === "extend" ? 0 : 1;
  miner.grip = smoothTo(miner.grip, targetGrip, 9.5, dt);

  const reelSpeed = Math.abs(hook.spoolSpeed ?? 0);
  let crankTarget = 0;
  if (active && hookState === "retract") {
    const carried = attachedItem(hook);
    const weight = carried ? carried.weight : 0;
    const effort = clamp(weight / 6.4, 0, 1);
    crankTarget = clamp(0.18 + effort * 0.32 + (reelSpeed / 920) * 0.55, 0, 1);
  }
  miner.crank = smoothTo(miner.crank, crankTarget, 6.5, dt);

  miner.releasePop = Math.max(0, miner.releasePop - dt * 2.8);

  const closeTarget = active && hookState === "retract" && attachedItem(hook) ? 1 : 0;
  hook.clawClose = smoothTo(hook.clawClose ?? 0, closeTarget, 14.5, dt);

  // When the game isn't actively updating rope physics, decay reel motion.
  if (!active) {
    hook.spoolSpeed = smoothTo(hook.spoolSpeed ?? 0, 0, 5.5, dt);
  }
}

function updateMiner(dt) {
  const hooks = getHooks();
  for (let i = 0; i < hooks.length; i += 1) {
    updateMinerFor(getMinerByIndex(i), hooks[i], dt);
  }
}

function update(dt) {
  if (game.phase !== "playing") return;

  game.timeLeft -= dt;
  if (game.timeLeft <= 0) {
    game.timeLeft = 0;
    endLevel();
    return;
  }

  const secLeft = Math.ceil(game.timeLeft);
  if (secLeft > 0 && secLeft <= 10 && game.audio.lastCountdownSec !== secLeft) {
    game.audio.lastCountdownSec = secLeft;
    audioInit();
    audioPlay("countdown");
  }

  const w = game.viewport.w;
  const h = game.viewport.h;
  const groundY = getGroundY();
  const tipR = BASE.hookTipRadius;
  let decayBombBoost = false;

  for (const hook of getHooks()) {
    const prevLength = hook.length;

    if (hook.state === "swing") {
      hook.angle += hook.angleDir * hook.angleSpeed * dt;
      if (hook.angle >= hook.maxAngle) {
        hook.angle = hook.maxAngle;
        hook.angleDir = -1;
      } else if (hook.angle <= hook.minAngle) {
        hook.angle = hook.minAngle;
        hook.angleDir = 1;
      }
    } else if (hook.state === "extend") {
      const before = getHookEnd(hook);
      hook.length += hook.extendSpeed * dt;
      const after = getHookEnd(hook);

      for (const item of game.items) {
        if (item.grabbed) continue;
        if (item.type === "keg" && item.keg?.stage === "fall") continue;
        if (segmentCircleIntersect(before.x, before.y, after.x, after.y, item.x, item.y, item.r + tipR)) {
          attachToHook(hook, item);
          break;
        }
      }

      if (hook.state === "extend") {
        const end = getHookEnd(hook);
        const out = end.x <= 0 || end.x >= w || end.y >= h;
        if (hook.length >= hook.maxLength || out) {
          hook.state = "retract";
        }
      }
    } else if (hook.state === "retract") {
      decayBombBoost = true;
      let item = attachedItem(hook);
      const weight = item ? item.weight : 0;
      const bombMultiplier = game.effects.bombBoost > 0 ? BOMB_RETRACT_MULT : 1;
      const speed = (hook.retractBaseSpeed * game.effects.speedMultiplier * bombMultiplier) / (1 + weight);
      hook.length -= speed * dt;

      if (item) {
        if (hook.length < hook.minLength) hook.length = hook.minLength;
        const end = getHookEnd(hook);
        item.x = end.x;
        item.y = end.y + item.r * 0.25;

        if (item.type === "keg" && item.keg?.stage === "pull" && hook.length <= item.keg.releaseLength) {
          dropKeg(hook, item);
          item = null;
        }
      }

      if (hook.length <= hook.minLength) {
        hook.length = hook.minLength;
        if (item) deliverAttachedItem(hook, item);
        resetHook(hook);
      }
    }

    const deltaLen = hook.length - prevLength;
    if (Math.abs(deltaLen) > 0.0001) {
      hook.reelAngle += deltaLen / 10;
      hook.lastLength = hook.length;
    }
    const speed = deltaLen / Math.max(0.001, dt);
    hook.spoolSpeed = smoothTo(hook.spoolSpeed ?? 0, speed, 10.5, dt);

    const end = getHookEnd(hook);
    if ((hook.state === "extend" || hook.state === "retract") && end.y > groundY + 10) {
      hook.dustCooldown -= dt;
      if (hook.dustCooldown <= 0) {
        const item = attachedItem(hook);
        const weight = item ? item.weight : 0;
        spawnDirtPuff(end.x, end.y, 0.75 + weight * 0.25);
        hook.dustCooldown = 0.08;
      }
    } else {
      hook.dustCooldown = Math.max(0, hook.dustCooldown - dt);
    }
  }

  if (decayBombBoost && game.effects.bombBoost > 0) {
    game.effects.bombBoost = Math.max(0, game.effects.bombBoost - dt);
  }

  updateFallingKegs(dt);
  updateHud();
}

function drawBackground() {
  const w = game.viewport.w;
  const h = game.viewport.h;
  const now = performance.now();

  const bg = BACKGROUNDS[game.bgIndex] ?? BACKGROUNDS[0];
  const img = bgAssets.ready ? bgAssets.images[game.bgIndex] : null;

  if (img && (img.naturalWidth || img.width)) {
    drawImageCover(img, 0, 0, w, h);
  } else {
    const groundY = h * 0.72;
    const grd = ctx.createLinearGradient(0, 0, 0, groundY);
    grd.addColorStop(0, "#1a2450");
    grd.addColorStop(0.55, COLORS.skyTop);
    grd.addColorStop(1, COLORS.skyBottom);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    const g2 = ctx.createLinearGradient(0, groundY, 0, h);
    g2.addColorStop(0, "#2a241b");
    g2.addColorStop(0.12, COLORS.groundTop);
    g2.addColorStop(1, COLORS.groundBottom);
    ctx.fillStyle = g2;
    ctx.fillRect(0, groundY, w, h - groundY);
  }

  // Subtle animated overlays (adds life without fighting the illustration)
  if (bg?.stars) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const s of game.scene.stars) {
      const tw = 0.55 + 0.45 * Math.sin(now / 680 + s.tw);
      const a = s.a * tw * 0.55;
      if (a <= 0.001) continue;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Underground dust shimmer
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const d of game.scene.dust) {
    const tw = 0.7 + 0.3 * Math.sin(now / 900 + d.tw);
    const a = d.a * tw * 0.22;
    if (a <= 0.001) continue;
    ctx.fillStyle = `rgba(255, 224, 138, ${a})`;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Light sweep
  ctx.save();
  ctx.globalAlpha = 0.06;
  const sweepX = w * 0.5 + Math.sin(now / 4200) * w * 0.12;
  const sweepY = h * 0.3 + Math.cos(now / 5200) * h * 0.06;
  const sweep = ctx.createRadialGradient(sweepX, sweepY, 80, sweepX, sweepY, Math.max(w, h) * 0.65);
  sweep.addColorStop(0, "rgba(255,255,255,0.35)");
  sweep.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sweep;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // Vignette
  ctx.save();
  ctx.globalAlpha = 0.22;
  const vig = ctx.createRadialGradient(w * 0.5, h * 0.45, Math.min(w, h) * 0.2, w * 0.5, h * 0.45, Math.max(w, h) * 0.75);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function recalcHookMaxLength() {
  const w = game.viewport.w;
  const h = game.viewport.h;
  for (const hook of getHooks()) {
    const pivot = getPivot(hook);

    const dx = Math.max(pivot.x, w - pivot.x);
    const dy = Math.max(0, h - pivot.y);
    const diagonal = Math.hypot(dx, dy);

    const maxAngle = Math.max(Math.abs(hook.minAngle), Math.abs(hook.maxAngle));
    const sinA = Math.max(0.18, Math.abs(Math.sin(maxAngle)));
    const sideReachAtMaxAngle = dx / sinA;

    const pad = 28;
    hook.maxLength = Math.max(320, diagonal + pad, sideReachAtMaxAngle + pad);
  }
}

function drawReel(pivot, centerY, hook = game.hook) {
  const rOuter = 16;
  const rInner = 7.5;
  const spin = hook.reelAngle;
  const spool = Math.abs(hook.spoolSpeed ?? 0);
  const blur = clamp((spool - 160) / 780, 0, 1);

  ctx.save();
  ctx.translate(pivot.x, centerY);

  // Motion blur when the rope is moving fast (extend/retract)
  if (blur > 0.001) {
    ctx.save();
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
    ctx.restore();
  }

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(3, 4, rOuter * 1.05, rOuter * 0.75, 0, 0, Math.PI * 2);
  ctx.fill();

  // Metal ring
  const ring = ctx.createRadialGradient(-6, -7, 2, 0, 0, rOuter);
  ring.addColorStop(0, "#ffffff");
  ring.addColorStop(0.35, "#d8d8d8");
  ring.addColorStop(0.65, "#9a9a9a");
  ring.addColorStop(1, "#f1f1f1");
  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(0, 0, rOuter, 0, Math.PI * 2);
  ctx.fill();

  // Rim highlight
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(-1.5, -1.5, rOuter - 1.5, 0, Math.PI * 2);
  ctx.stroke();

  // Inner hub
  const hub = ctx.createRadialGradient(-2, -2, 1, 0, 0, rInner);
  hub.addColorStop(0, "#7a7a7a");
  hub.addColorStop(1, "#1f1f1f");
  ctx.fillStyle = hub;
  ctx.beginPath();
  ctx.arc(0, 0, rInner, 0, Math.PI * 2);
  ctx.fill();

  // Spokes + handle rotate with rope
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

  // Handle
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

  ctx.restore();
}

function drawPlank() {
  const w = game.viewport.w;
  const y = getPlankY();
  const h = BASE.plankHeight ?? 22;

  ctx.save();
  const beam = ctx.createLinearGradient(0, y, 0, y + h);
  beam.addColorStop(0, "#9a663a");
  beam.addColorStop(0.45, COLORS.wood);
  beam.addColorStop(1, "#5a351f");
  ctx.fillStyle = beam;
  ctx.fillRect(0, y, w, h);

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, y + h - 2, w, 2);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(0, y, w, 2);

  // Plank seams
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  for (let x = 18; x < w; x += 72) {
    ctx.fillRect(x, y, 4, h);
  }

  ctx.restore();
}

function drawWinch(hook = game.hook) {
  const pivot = getPivot(hook);
  const reel = getReelCenter(hook);
  const plankY = getPlankY();

  ctx.save();

  // Base shadow on the plank
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.beginPath();
  ctx.ellipse(reel.x + 8, plankY + 6, 44, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Mount plate
  const plateW = 72;
  const plateH = 26;
  const plateX = reel.x - plateW / 2;
  const plateY = plankY - plateH + 3;
  const metal = ctx.createLinearGradient(plateX, plateY, plateX + plateW, plateY + plateH);
  metal.addColorStop(0, "#f3f3f3");
  metal.addColorStop(0.5, "#a9a9a9");
  metal.addColorStop(1, "#e8e8e8");
  ctx.fillStyle = "rgba(0,0,0,0.30)";
  roundRectPath(plateX + 2, plateY + 3, plateW, plateH, 8);
  ctx.fill();
  ctx.fillStyle = metal;
  roundRectPath(plateX, plateY, plateW, plateH, 8);
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

  drawReel(pivot, reel.y, hook);
  ctx.restore();
}

function drawItems() {
  const grabbedIds = new Set();
  for (const hook of getHooks()) {
    if (hook.attachedId) grabbedIds.add(hook.attachedId);
  }
  const items = game.items
    .filter((it) => !grabbedIds.has(it.id))
    .slice()
    .sort((a, b) => a.y - b.y);
  for (const item of items) drawItem(item);
  for (const hook of getHooks()) {
    const grabbedId = hook.attachedId;
    const grabbed = grabbedId ? game.items.find((it) => it.id === grabbedId) : null;
    if (grabbed) drawItem(grabbed);
  }
}

function blobPath(blob, radius) {
  const pts = blob.map((p) => ({ x: Math.cos(p.a) * radius * p.r, y: Math.sin(p.a) * radius * p.r }));
  const n = pts.length;
  const mid0 = { x: (pts[n - 1].x + pts[0].x) / 2, y: (pts[n - 1].y + pts[0].y) / 2 };
  ctx.beginPath();
  ctx.moveTo(mid0.x, mid0.y);
  for (let i = 0; i < n; i += 1) {
    const p = pts[i];
    const next = pts[(i + 1) % n];
    const mid = { x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 };
    ctx.quadraticCurveTo(p.x, p.y, mid.x, mid.y);
  }
  ctx.closePath();
}

function drawItem(item) {
  const art = item.art ?? { rot: 0 };
  const now = performance.now();

  // Soft shadow (only when not attached to hook)
  if (!item.grabbed) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(
      item.x + item.r * 0.08,
      item.y + item.r * 0.62,
      item.r * 0.85,
      Math.max(2, item.r * 0.32),
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
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
  ctx.rotate((art.rot ?? 0) + wobble);

  if (item.type === "gold") {
    const g = ctx.createRadialGradient(-item.r * 0.35, -item.r * 0.55, item.r * 0.2, 0, 0, item.r * 1.35);
    g.addColorStop(0, "#fff6d6");
    g.addColorStop(0.35, "#ffd86f");
    g.addColorStop(0.7, "#f6b027");
    g.addColorStop(1, "#7f4f0a");
    ctx.fillStyle = g;
    blobPath(art.blob ?? makeBlob(createRng(item.id), 9, 0.8, 1.05), item.r);
    ctx.fill();

    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = Math.max(1, item.r * 0.08);
    ctx.stroke();

    // Glint
    const gl = 0.18 + 0.12 * Math.sin(now / 280 + (art.glint ?? 0) * 6);
    ctx.fillStyle = `rgba(255,255,255,${gl})`;
    ctx.beginPath();
    ctx.arc(-item.r * 0.28, -item.r * 0.28, Math.max(1.5, item.r * 0.22), 0, Math.PI * 2);
    ctx.fill();

    // Sparkles
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(1, item.r * 0.06);
    for (const sp of art.sparkles ?? []) {
      const pulse = 0.55 + 0.45 * Math.sin(now / 320 + sp.p);
      const sx = Math.cos(sp.a) * item.r * sp.d;
      const sy = Math.sin(sp.a) * item.r * sp.d;
      const s = item.r * sp.s;
      ctx.globalAlpha = 0.35 * pulse;
      ctx.beginPath();
      ctx.moveTo(sx - s, sy);
      ctx.lineTo(sx + s, sy);
      ctx.moveTo(sx, sy - s);
      ctx.lineTo(sx, sy + s);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    return;
  }

  if (item.type === "bar") {
    const w = item.r * 1.8;
    const h = item.r * 1.1;

    const g = ctx.createLinearGradient(-w * 0.6, -h * 0.6, w * 0.6, h * 0.6);
    g.addColorStop(0, "#fff3c6");
    g.addColorStop(0.35, "#ffd86f");
    g.addColorStop(0.7, "#f6b027");
    g.addColorStop(1, "#7f4f0a");
    ctx.fillStyle = g;
    roundRectPath(-w / 2, -h / 2, w, h, 10);
    ctx.fill();

    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = Math.max(1, item.r * 0.07);
    ctx.stroke();

    // Top bevel
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = "#ffffff";
    roundRectPath(-w * 0.42, -h * 0.32, w * 0.84, h * 0.38, 8);
    ctx.fill();
    ctx.restore();

    // Stamp
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.font = `700 ${Math.max(10, Math.floor(item.r * 0.55))}px ui-sans-serif, system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Au", 0, item.r * 0.06);
    ctx.restore();

    // Shine
    const sh = 0.12 + 0.14 * Math.sin(now / 300 + (art.shine ?? 0) * 6);
    ctx.save();
    ctx.globalAlpha = sh;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(-w * 0.18, -h * 0.1, w * 0.22, h * 0.18, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
    return;
  }

  if (item.type === "rock") {
    const tint = art.tint ?? 0;
    const light = clamp(56 + tint * 26, 40, 68);
    const dark = clamp(28 + tint * 20, 18, 38);
    const g = ctx.createRadialGradient(-item.r * 0.25, -item.r * 0.35, item.r * 0.2, 0, 0, item.r * 1.25);
    g.addColorStop(0, `hsl(220, 10%, ${light}%)`);
    g.addColorStop(1, `hsl(220, 10%, ${dark}%)`);
    ctx.fillStyle = g;
    blobPath(art.blob ?? makeBlob(createRng(item.id), 8, 0.82, 1.12), item.r);
    ctx.fill();

    ctx.strokeStyle = "rgba(0,0,0,0.28)";
    ctx.lineWidth = Math.max(1, item.r * 0.07);
    ctx.stroke();

    // Speckles
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    for (const sp of art.specks ?? []) {
      ctx.globalAlpha = sp.a;
      ctx.beginPath();
      ctx.arc(sp.x * item.r, sp.y * item.r, Math.max(0.8, sp.r * item.r), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    return;
  }

  if (item.type === "diamond") {
    const tw = 0.65 + 0.35 * Math.sin(now / 360 + (art.twinkle ?? 0));
    const g = ctx.createLinearGradient(-item.r, -item.r, item.r, item.r);
    g.addColorStop(0, "rgba(215, 252, 255, 0.95)");
    g.addColorStop(0.55, "rgba(120, 231, 255, 0.95)");
    g.addColorStop(1, "rgba(45, 130, 155, 0.95)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -item.r * 1.25);
    ctx.lineTo(item.r * 0.95, -item.r * 0.15);
    ctx.lineTo(item.r * 0.7, item.r * 0.95);
    ctx.lineTo(0, item.r * 1.22);
    ctx.lineTo(-item.r * 0.7, item.r * 0.95);
    ctx.lineTo(-item.r * 0.95, -item.r * 0.15);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = `rgba(255,255,255,${0.22 * tw})`;
    ctx.lineWidth = Math.max(1, item.r * 0.06);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255,255,255,${0.14 * tw})`;
    ctx.lineWidth = Math.max(1, item.r * 0.03);
    ctx.beginPath();
    ctx.moveTo(0, -item.r * 1.25);
    ctx.lineTo(0, item.r * 1.22);
    ctx.moveTo(-item.r * 0.7, item.r * 0.95);
    ctx.lineTo(item.r * 0.7, item.r * 0.95);
    ctx.stroke();

    // Twinkle flare
    ctx.strokeStyle = `rgba(255,255,255,${0.38 * tw})`;
    ctx.lineWidth = Math.max(1, item.r * 0.05);
    ctx.beginPath();
    ctx.moveTo(item.r * 0.35, -item.r * 0.55);
    ctx.lineTo(item.r * 0.35, -item.r * 0.12);
    ctx.moveTo(item.r * 0.13, -item.r * 0.33);
    ctx.lineTo(item.r * 0.57, -item.r * 0.33);
    ctx.stroke();

    ctx.restore();
    return;
  }

  if (item.type === "emerald" || item.type === "ruby") {
    const isRuby = item.type === "ruby";
    const tw = 0.65 + 0.35 * Math.sin(now / 340 + (art.twinkle ?? 0));

    const baseA = isRuby ? "rgba(255, 200, 215, 0.95)" : "rgba(210, 255, 235, 0.95)";
    const baseB = isRuby ? "rgba(255, 80, 115, 0.95)" : "rgba(52, 226, 138, 0.95)";
    const baseC = isRuby ? "rgba(120, 20, 40, 0.95)" : "rgba(18, 95, 55, 0.95)";

    const g = ctx.createLinearGradient(-item.r, -item.r, item.r, item.r);
    g.addColorStop(0, baseA);
    g.addColorStop(0.55, baseB);
    g.addColorStop(1, baseC);
    ctx.fillStyle = g;

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

    ctx.strokeStyle = `rgba(255,255,255,${0.22 * tw})`;
    ctx.lineWidth = Math.max(1, item.r * 0.06);
    ctx.stroke();

    // Facets
    ctx.strokeStyle = `rgba(255,255,255,${0.14 * tw})`;
    ctx.lineWidth = Math.max(1, item.r * 0.03);
    ctx.beginPath();
    ctx.moveTo(0, -item.r * 1.25);
    ctx.lineTo(0, item.r * 1.22);
    ctx.moveTo(-item.r * 0.6, item.r * 1.05);
    ctx.lineTo(item.r * 0.6, item.r * 1.05);
    ctx.moveTo(-item.r * 1.1, item.r * 0.25);
    ctx.lineTo(item.r * 1.1, item.r * 0.25);
    ctx.stroke();

    // Twinkle flare
    ctx.strokeStyle = `rgba(255,255,255,${0.32 * tw})`;
    ctx.lineWidth = Math.max(1, item.r * 0.05);
    ctx.beginPath();
    ctx.moveTo(item.r * 0.25, -item.r * 0.62);
    ctx.lineTo(item.r * 0.25, -item.r * 0.18);
    ctx.moveTo(item.r * 0.03, -item.r * 0.4);
    ctx.lineTo(item.r * 0.47, -item.r * 0.4);
    ctx.stroke();

    ctx.restore();
    return;
  }

  if (item.type === "crystal") {
    const tw = 0.65 + 0.35 * Math.sin(now / 320 + (art.twinkle ?? 0));

    // Base glow
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.12 * tw;
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, item.r * 1.6);
    glow.addColorStop(0, "rgba(166, 246, 255, 0.95)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, item.r * 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Spikes
    const dirs = art.dirs ?? [];
    for (const sp of dirs) {
      const a = sp.a ?? 0;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const len = item.r * (sp.h ?? 1);
      const halfW = item.r * (sp.w ?? 0.25);
      const bx = ca * item.r * 0.12;
      const by = sa * item.r * 0.12;
      const tx = bx + ca * len;
      const ty = by + sa * len;
      const px = -sa * halfW;
      const py = ca * halfW;

      const g = ctx.createLinearGradient(bx, by, tx, ty);
      g.addColorStop(0, "rgba(220, 252, 255, 0.95)");
      g.addColorStop(0.55, "rgba(120, 231, 255, 0.95)");
      g.addColorStop(1, "rgba(45, 130, 155, 0.95)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(bx + px, by + py);
      ctx.lineTo(tx, ty);
      ctx.lineTo(bx - px, by - py);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = `rgba(255,255,255,${0.18 * tw})`;
      ctx.lineWidth = Math.max(1, item.r * 0.04);
      ctx.stroke();
    }

    // Center core
    const core = ctx.createRadialGradient(-item.r * 0.2, -item.r * 0.35, item.r * 0.2, 0, 0, item.r * 1.1);
    core.addColorStop(0, "rgba(235, 255, 255, 0.95)");
    core.addColorStop(0.55, "rgba(140, 238, 255, 0.95)");
    core.addColorStop(1, "rgba(45, 120, 150, 0.95)");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.ellipse(0, item.r * 0.1, item.r * 0.78, item.r * 0.64, 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${0.16 * tw})`;
    ctx.lineWidth = Math.max(1, item.r * 0.04);
    ctx.stroke();

    ctx.restore();
    return;
  }

  if (item.type === "pouch") {
    const jig = 0.5 + 0.5 * Math.sin(now / 520 + (art.jiggle ?? 0));
    const bag = ctx.createRadialGradient(-item.r * 0.25, -item.r * 0.45, item.r * 0.2, 0, 0, item.r * 1.35);
    bag.addColorStop(0, "#f1d2a5");
    bag.addColorStop(0.5, "#c28a50");
    bag.addColorStop(1, "#4a2413");
    ctx.fillStyle = bag;

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

    // Top opening + coins
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = "#6b3f24";
    ctx.beginPath();
    ctx.ellipse(0, -item.r * 0.22, item.r * 0.68, item.r * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();

    const coinCount = art.coins ?? 3;
    for (let i = 0; i < coinCount; i += 1) {
      const a = (i / Math.max(1, coinCount)) * Math.PI * 2 + (art.seam ?? 0) * 4;
      const cx = Math.cos(a) * item.r * 0.34;
      const cy = -item.r * 0.3 + Math.sin(a) * item.r * 0.1;
      const r = item.r * (0.16 + 0.03 * jig);
      const cg = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.2, cx, cy, r);
      cg.addColorStop(0, "#fff3c6");
      cg.addColorStop(0.6, "#ffd34d");
      cg.addColorStop(1, "#9a6a12");
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.22)";
      ctx.lineWidth = Math.max(1, item.r * 0.03);
      ctx.stroke();
    }
    ctx.restore();

    // Shine
    ctx.save();
    ctx.globalAlpha = 0.16 + 0.12 * jig;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(-item.r * 0.22, -item.r * 0.08, item.r * 0.22, item.r * 0.16, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
    return;
  }

  if (item.type === "keg") {
    const stage = item.keg?.stage ?? "idle";
    const fusePulse = 0.55 + 0.45 * Math.sin(now / 90 + (art.fuse ?? 0));
    const w = item.r * 1.2;
    const h = item.r * 1.55;

    // Body
    const body = ctx.createLinearGradient(-w * 0.6, -h * 0.6, w * 0.6, h * 0.6);
    body.addColorStop(0, "#ffb38a");
    body.addColorStop(0.35, "#ff6b5a");
    body.addColorStop(1, "#6d1414");
    ctx.fillStyle = body;
    roundRectPath(-w / 2, -h / 2, w, h, 12);
    ctx.fill();

    // Metal bands
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    roundRectPath(-w * 0.55, -h * 0.28, w * 1.1, h * 0.18, 10);
    ctx.fill();
    roundRectPath(-w * 0.55, h * 0.1, w * 1.1, h * 0.18, 10);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    roundRectPath(-w * 0.52, -h * 0.26, w * 1.04, h * 0.08, 8);
    ctx.fill();

    // Warning mark
    ctx.save();
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
    ctx.restore();

    ctx.strokeStyle = "rgba(0,0,0,0.28)";
    ctx.lineWidth = Math.max(1, item.r * 0.07);
    ctx.stroke();

    // Fuse (top)
    ctx.save();
    ctx.translate(w * 0.18, -h * 0.46);
    ctx.rotate(-0.7);
    ctx.strokeStyle = "rgba(20,20,20,0.65)";
    ctx.lineWidth = 3.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(6, -6, 16, -4);
    ctx.stroke();

    // Spark
    ctx.globalCompositeOperation = "lighter";
    const a = (stage === "pull" ? 0.18 : 0.12) + 0.18 * fusePulse;
    ctx.globalAlpha = a;
    const spark = ctx.createRadialGradient(16, -4, 1, 16, -4, 18);
    spark.addColorStop(0, "rgba(255, 241, 196, 0.95)");
    spark.addColorStop(0.45, "rgba(255, 211, 77, 0.75)");
    spark.addColorStop(0.75, "rgba(255, 77, 77, 0.65)");
    spark.addColorStop(1, "rgba(255, 77, 77, 0)");
    ctx.fillStyle = spark;
    ctx.beginPath();
    ctx.arc(16, -4, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
    return;
  }

  if (item.type === "fossil") {
    const tint = art.tint ?? 0;
    const light = clamp(78 + tint * 18, 68, 90);
    const dark = clamp(48 + tint * 14, 36, 62);
    const g = ctx.createRadialGradient(-item.r * 0.35, -item.r * 0.55, item.r * 0.2, 0, 0, item.r * 1.45);
    g.addColorStop(0, `hsl(38, 40%, ${light}%)`);
    g.addColorStop(1, `hsl(32, 30%, ${dark}%)`);
    ctx.fillStyle = g;

    // Cartoon bone fossil
    const len = item.r * 1.35;
    const bw = item.r * 0.52;
    const lx = -len * 0.45;
    const rx = len * 0.45;
    const er = bw * 0.42;

    const drawBoneFill = () => {
      roundRectPath(lx, -bw * 0.35, len * 0.9, bw * 0.7, bw * 0.35);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(lx, -bw * 0.22, er, 0, Math.PI * 2);
      ctx.arc(lx, bw * 0.22, er, 0, Math.PI * 2);
      ctx.arc(rx, -bw * 0.22, er, 0, Math.PI * 2);
      ctx.arc(rx, bw * 0.22, er, 0, Math.PI * 2);
      ctx.fill();
    };

    drawBoneFill();
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = Math.max(1, item.r * 0.07);
    ctx.stroke();

    // Cracks
    ctx.save();
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = Math.max(1, item.r * 0.04);
    ctx.lineCap = "round";
    for (const c of art.cracks ?? []) {
      const a = c.a ?? 0;
      const d = (c.d ?? 0.3) * item.r;
      const l = (c.l ?? 0.5) * item.r;
      const x0 = Math.cos(a) * d;
      const y0 = Math.sin(a) * d;
      const x1 = x0 + Math.cos(a + 0.7) * l * 0.55;
      const y1 = y0 + Math.sin(a + 0.7) * l * 0.55;
      const x2 = x0 + Math.cos(a - 0.6) * l;
      const y2 = y0 + Math.sin(a - 0.6) * l;
      ctx.globalAlpha = 0.18;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x0, y0);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();

    // Highlight
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(-item.r * 0.18, -item.r * 0.08, item.r * 0.28, item.r * 0.18, -0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
    return;
  }

  // bag
  const g = ctx.createRadialGradient(-item.r * 0.25, -item.r * 0.4, item.r * 0.2, 0, 0, item.r * 1.35);
  g.addColorStop(0, "#dcc7ff");
  g.addColorStop(0.5, "#b07bff");
  g.addColorStop(1, "#4b1e7a");
  ctx.fillStyle = g;
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

  // Tie / strap
  ctx.fillStyle = "#6a3a9e";
  ctx.beginPath();
  ctx.ellipse(0, -item.r * 0.28, item.r * 0.55, item.r * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.beginPath();
  ctx.ellipse(-item.r * 0.15, -item.r * 0.33, item.r * 0.32, item.r * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mark
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `${Math.max(10, Math.floor(item.r * 1.15))}px ui-sans-serif, system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("?", 0, item.r * 0.2);

  ctx.restore();
}

function drawHookTrail(hook = game.hook) {
  const trail = hook.trail;
  if (trail.length < 2) return;

  const item = attachedItem(hook);
  const color = item ? itemFxColor(item) : "rgba(255,255,255,0.85)";
  const life = 0.55;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (let i = 0; i < trail.length - 1; i += 1) {
    const p0 = trail[i];
    const p1 = trail[i + 1];
    const t = clamp(1 - p0.age / life, 0, 1);
    const a = 0.08 + 0.22 * t;
    ctx.globalAlpha = a * t;
    ctx.strokeStyle = color;
    ctx.lineWidth = lerp(1.2, 6.0, t);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();

    ctx.globalAlpha = a * 0.55 * t;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = lerp(0.7, 2.4, t);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawCarryLabel(hook = game.hook) {
  if (game.phase !== "playing") return;
  if (hook.state !== "retract") return;
  const item = attachedItem(hook);
  if (!item) return;

  const end = getHookEnd(hook);
  const color = itemFxColor(item);
  const text = item.type === "bag" ? "?" : item.type === "keg" ? "!!" : `${item.value}`;

  ctx.save();
  ctx.font = "700 12px ui-sans-serif, system-ui";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  const paddingX = 10;
  const paddingY = 6;
  const dot = 10;
  const textW = ctx.measureText(text).width;
  const w = dot + 8 + textW + paddingX * 2;
  const h = 22 + paddingY * 0;

  let x = end.x + 16;
  let y = end.y - 42;
  x = clamp(x, 8, game.viewport.w - w - 8);
  y = clamp(y, 8, game.viewport.h - h - 8);

  // Glow tint
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = color;
  roundRectPath(x, y, w, h, 12);
  ctx.fill();

  // Panel
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = "rgba(0,0,0,0.48)";
  roundRectPath(x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Dot
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

  // Text
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText(text, x + paddingX + dot + 8, y + h / 2);
  ctx.restore();
}

function drawHook(hook = game.hook) {
  const pivot = getPivot(hook);
  const tip = getHookEnd(hook);
  const dir = getHookDir(hook.angle);
  const ring = { x: tip.x - dir.x * HOOK.ringToTip, y: tip.y - dir.y * HOOK.ringToTip };

  ctx.save();
  const now = performance.now();
  const perp = { x: dir.y, y: -dir.x };
  const ropeLen = Math.max(0, hook.length - HOOK.ringToTip);
  const t = clamp(hook.length / Math.max(1, hook.maxLength), 0, 1);
  const sway = (hook.state === "swing" ? 18 : 8) * (0.25 + 0.75 * t);
  const wobble = Math.sin(now / 260 + hook.angle * 1.7);
  const cx = pivot.x + dir.x * (ropeLen * 0.48 + HOOK.ringToTip * 0.08) + perp.x * sway * wobble;
  const cy = pivot.y + dir.y * (ropeLen * 0.48 + HOOK.ringToTip * 0.08) + perp.y * sway * wobble;

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
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1.2;
    ctx.setLineDash([6, 12]);
    ctx.lineDashOffset = -hook.reelAngle * 12;
    ctx.beginPath();
    ctx.moveTo(pivot.x, pivot.y);
    ctx.quadraticCurveTo(cx, cy, ring.x, ring.y);
    ctx.stroke();
    ctx.restore();
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

  const close = clamp(hook.clawClose ?? 0, 0, 1);
  const carriedForGrip = attachedItem(hook);
  const sizeR = carriedForGrip ? carriedForGrip.r : 0;
  const sizeT = clamp((sizeR - 11) / 30, 0, 1); // ~diamond -> large gold
  const closeLimit = lerp(1, 0.58, sizeT); // bigger item => leave more gap
  const gripClose = close * closeLimit;

  // ---- Claw (fully redesigned; inward-curling tri-prong) ----
  const baseY = HOOK.jawBase;
  const tipY = HOOK.ringToTip;
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
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = highlight;
    ctx.lineWidth = Math.max(1.2, metalW * 0.32);
    makePath();
    ctx.stroke();
    ctx.restore();
  };

  // Ring
  ctx.save();
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
  ctx.restore();

  // Stem + swivel
  strokeMetal(
    () => {
      ctx.beginPath();
      ctx.moveTo(0, 7);
      ctx.lineTo(0, baseY - 4);
    },
    6.4,
    4.6
  );

  ctx.save();
  ctx.translate(0, baseY - 7.5);
  ctx.fillStyle = metal;
  roundRectPath(-9, -5.5, 18, 11, 5.5);
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = "rgba(0,0,0,0.20)";
  ctx.beginPath();
  ctx.arc(0, 0.2, 2.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Prongs (center prong is the lowest point at x=0)
  ctx.save();
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
    ctx.fillStyle = "rgba(20,20,20,0.30)";
    ctx.beginPath();
    ctx.ellipse(hookX + sign * 1.15, sideHookY - 0.9, 3.0, 2.1, sign * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.beginPath();
    ctx.ellipse(hookX + sign * 0.45, sideHookY - 1.6, 1.2, 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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
    ctx.restore();
  };

  drawSideProng(-1);
  drawSideProng(1);
  drawCenterProng();
  ctx.restore();

  // Hub (covers prong roots)
  ctx.save();
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
  ctx.restore();

  // Tip glow while carrying (and bomb fuse hint)
  const carried = attachedItem(hook);
  if (carried && hook.state === "retract") {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.18;
    const g = ctx.createRadialGradient(0, tipY + 1, 2, 0, tipY + 1, 34);
    g.addColorStop(0, itemFxColor(carried));
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, tipY + 1, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const canBomb =
    game.phase === "playing" &&
    !game.paused &&
    game.inventory.bombs > 0 &&
    hook.state === "retract" &&
    carried;
  if (canBomb) {
    const flicker = 0.55 + 0.45 * Math.sin(now / 90);
    ctx.save();
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
    ctx.restore();
  }

  ctx.restore();
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

function getMinerPose(hook = game.hook, miner = game.miner) {
  const pivot = getPivot(hook);
  const reel = getReelCenter(hook);
  const now = performance.now();
  const bob = 1.15 * Math.sin(now / 620) + 0.55 * Math.sin(now / 980 + 1.7);
  const aim = clamp(hook.angle / Math.max(0.001, hook.maxAngle), -1, 1);

  const crank = miner.crank;
  const phase = hook.reelAngle;
  const carried = attachedItem(hook);
  const weight = carried ? carried.weight : 0;
  const strainBase = clamp(weight / 6.4, 0, 1);

  const leanX = crank * Math.sin(phase) * (2.2 + 1.6 * strainBase);
  const leanY = crank * (0.65 + 0.35 * Math.cos(phase * 2.2)) * (0.8 + 0.4 * strainBase);

  const x = pivot.x + leanX;
  const y = pivot.y - 58 + bob + leanY; // head center
  return { pivot, reel, now, bob, aim, crank, phase, strainBase, x, y };
}

function drawMinerBack(hook = game.hook, miner = game.miner) {
  const pose = getMinerPose(hook, miner);
  const { x, y, aim, crank, phase, strainBase } = pose;

  const skin = "#f6d7bf";
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
  ctx.translate(x, y);
  ctx.rotate(bodyTilt);
  ctx.translate(-x, -y);

  // Back shadow (gives depth behind the winch)
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.beginPath();
  ctx.ellipse(x + 10, torsoY + torsoH + 22, 34, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Backpack
  ctx.save();
  ctx.translate(x + 26, torsoY + 26);
  ctx.rotate(-0.08);
  const pack = ctx.createLinearGradient(-12, -18, 14, 18);
  pack.addColorStop(0, "#3a2c22");
  pack.addColorStop(0.55, "#2a1f18");
  pack.addColorStop(1, "#16110d");
  ctx.fillStyle = pack;
  roundRectPath(-15, -20, 26, 38, 10);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  roundRectPath(-12, -17, 20, 14, 8);
  ctx.fill();
  ctx.restore();

  // Torso base
  const torsoGrad = ctx.createLinearGradient(torsoX, torsoY, torsoX + torsoW, torsoY + torsoH);
  torsoGrad.addColorStop(0, jacket);
  torsoGrad.addColorStop(1, jacketDeep);
  ctx.fillStyle = torsoGrad;
  roundRectPath(torsoX, torsoY, torsoW, torsoH, 14);
  ctx.fill();

  // Collar / shirt
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  roundRectPath(torsoX + 8, torsoY + 6, torsoW - 16, 16, 10);
  ctx.fill();

  // Overalls bib
  const bibGrad = ctx.createLinearGradient(torsoX, torsoY + 16, torsoX, torsoY + torsoH);
  bibGrad.addColorStop(0, overall);
  bibGrad.addColorStop(1, overallDeep);
  ctx.fillStyle = bibGrad;
  roundRectPath(torsoX + 10, torsoY + 16, torsoW - 20, 30, 12);
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
  roundRectPath(x - 7, torsoY + 37, 14, 8, 3);
  ctx.fill();

  // Pouch
  ctx.save();
  ctx.translate(x - 22, torsoY + 44);
  ctx.rotate(0.08);
  ctx.fillStyle = "#2b2018";
  roundRectPath(-10, -6, 18, 14, 5);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  roundRectPath(-8, -4, 14, 6, 4);
  ctx.fill();
  ctx.restore();

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
  ctx.restore();
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
  roundRectPath(x - 22, y - 23, 44, 10, 7);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  roundRectPath(x - 19, y - 22, 38, 5, 6);
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
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx - 2.2, eyeY - 1.2, 4.8, Math.PI * 1.15, Math.PI * 1.55);
    ctx.stroke();
    ctx.restore();
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
    ctx.globalAlpha = 0.25 * s;
    ctx.fillStyle = "rgba(175, 245, 255, 0.8)";
    ctx.beginPath();
    ctx.ellipse(x + 16, y - 1, 2.2, 3.6, 0.2, 0, Math.PI * 2);
    ctx.ellipse(x + 14, y + 6, 1.6, 2.8, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Small tool badge
  ctx.save();
  ctx.translate(torsoX + 14, torsoY + 28);
  ctx.rotate(0.12);
  ctx.fillStyle = "rgba(255, 224, 138, 0.85)";
  roundRectPath(-4, -4, 10, 10, 3);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // Subtle body wobble highlight
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  roundRectPath(torsoX + 6 + bodyWobble, torsoY + 10, 12, torsoH - 20, 10);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

function drawMinerFront(hook = game.hook, miner = game.miner) {
  const pose = getMinerPose(hook, miner);
  const { x, y, reel, crank, phase, strainBase } = pose;
  const grip = miner.grip;
  const releasePop = miner.releasePop;

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
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  drawArm(shoulderL, elbowL, leftHand);
  drawArm(shoulderR, elbowR, rightHand);

  // Strain lines when pulling heavy stuff
  if (strainBase > 0.65 && crank > 0.25) {
    const a = 0.2 + 0.25 * crank * (strainBase - 0.65) / 0.35;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 24, y + 10);
    ctx.lineTo(x - 36, y + 2);
    ctx.moveTo(x + 24, y + 10);
    ctx.lineTo(x + 38, y + 1);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function drawFx() {
  // Shockwave rings
  if (game.fx.rings.length > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const ring of game.fx.rings) {
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
    }
    ctx.restore();
  }

  // Particles
  for (const p of game.fx.particles) {
    const t = clamp(p.age / Math.max(0.0001, p.life), 0, 1);
    const a = (1 - t) * 0.9;
    if (a <= 0) continue;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.6, p.size), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Score pops
  if (game.fx.pops.length > 0) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 18px ui-sans-serif, system-ui";
    for (const pop of game.fx.pops) {
      const t = clamp(pop.age / pop.life, 0, 1);
      const a = 1 - t;
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(0,0,0,0.38)";
      ctx.strokeText(pop.text, pop.x, pop.y);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, pop.y);
    }
    ctx.restore();
  }
}

function render() {
  const w = game.viewport.w;
  const h = game.viewport.h;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const tx = game.fx.shakeX * DPR;
  const ty = game.fx.shakeY * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, tx, ty);

  const players = getHooks()
    .map((hook, index) => ({ hook, miner: getMinerByIndex(index) }))
    .sort((a, b) => getPivot(a.hook).x - getPivot(b.hook).x);

  drawBackground();
  drawPlank();
  for (const p of players) drawMinerBack(p.hook, p.miner);
  for (const p of players) drawWinch(p.hook);
  for (const p of players) drawMinerFront(p.hook, p.miner);
  drawItems();
  for (const p of players) drawHookTrail(p.hook);
  for (const p of players) drawHook(p.hook);
  for (const p of players) drawCarryLabel(p.hook);
  drawFx();

  if (game.fx.flash > 0) {
    ctx.save();
    ctx.globalAlpha = game.fx.flash;
    ctx.fillStyle = "#fff1c4";
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  if (game.phase === "playing" && !game.paused && game.timeLeft <= 10) {
    ctx.save();
    ctx.globalAlpha = 0.12 + 0.08 * Math.sin(performance.now() / 110);
    ctx.fillStyle = "#ff2a2a";
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

function resize() {
  const wrap = canvas.parentElement;
  const rect = wrap.getBoundingClientRect();
  const displayW = Math.max(320, rect.width);
  const displayH = Math.max(240, rect.height);

  const prevW = game.viewport.w;
  const prevH = game.viewport.h;

  canvas.style.width = `${displayW}px`;
  canvas.style.height = `${displayH}px`;

  canvas.width = Math.floor(displayW * DPR);
  canvas.height = Math.floor(displayH * DPR);

  game.viewport.w = displayW;
  game.viewport.h = displayH;

  layoutPlayers();
  recalcHookMaxLength();
  const sceneSeed = game.phase === "menu" ? game.runSeed : game.currentSeed || game.runSeed;
  if (sceneSeed) buildScene(sceneSeed);

  if (game.phase !== "menu" && prevW > 0 && prevH > 0) {
    const sx = displayW / prevW;
    const sy = displayH / prevH;
    const s = Math.min(sx, sy);
    const margin = 34;

    for (const item of game.items) {
      item.x *= sx;
      item.y *= sy;
      item.r *= s;
      item.x = clamp(item.x, margin + item.r, displayW - margin - item.r);
      item.y = clamp(item.y, 170 + item.r, displayH - margin - item.r);
    }

    for (const hook of getHooks()) {
      hook.length *= s;
      hook.length = clamp(hook.length, hook.minLength, hook.maxLength);
    }
  }

  render();
}

function initUi() {
  ui.startBtn.addEventListener("click", () => {
    if (game.phase === "menu") showModeSelectOverlay();
  });

  ui.pauseBtn.addEventListener("click", togglePause);
  ui.restartBtn.addEventListener("click", restartGame);
  ui.bombBtn.addEventListener("click", useBomb);

  ui.soundBtn?.addEventListener("click", () => {
    audioInit();
    const wasOn = window.GameAudio?.isSfxEnabled?.() ?? true;
    if (wasOn) audioPlay("ui_click");
    window.GameAudio?.toggleSfx?.();
    syncAudioButtons();
    const nowOn = window.GameAudio?.isSfxEnabled?.() ?? true;
    if (nowOn) audioPlay("ui_click");
  });

  ui.musicBtn?.addEventListener("click", () => {
    audioInit();
    audioPlay("ui_click");
    window.GameAudio?.toggleMusic?.();
    syncAudioButtons();
  });

  ui.overlayPrimaryBtn.addEventListener("click", () => overlayPrimaryAction?.());
  ui.overlaySecondaryBtn.addEventListener("click", () => overlaySecondaryAction?.());

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      if (game.phase === "menu") {
        setGameMode("single");
        startGame();
        return;
      }
      if (game.phase === "playing" && !game.paused) dropHook();
    }
    if (e.code === "Enter") {
      if (game.phase === "menu") {
        e.preventDefault();
        setGameMode("double");
        startGame();
        return;
      }
      if (game.phase === "playing" && !game.paused && isTwoPlayerMode()) {
        e.preventDefault();
        dropHookFor(1);
      }
    }
    if (e.key === "p" || e.key === "P") togglePause();
    if (e.key === "r" || e.key === "R") {
      if (game.phase !== "menu") restartGame();
    }
    if (e.key === "x" || e.key === "X") useBomb();
    if (e.key === "m" || e.key === "M") {
      audioInit();
      audioPlay("ui_click");
      window.GameAudio?.toggleMusic?.();
      syncAudioButtons();
    }
    if (e.key === "n" || e.key === "N") {
      audioInit();
      audioPlay("ui_click");
      window.GameAudio?.nextTrack?.();
      syncAudioButtons();
    }
    if (e.key === "s" || e.key === "S") {
      audioInit();
      const wasOn = window.GameAudio?.isSfxEnabled?.() ?? true;
      if (wasOn) audioPlay("ui_click");
      window.GameAudio?.toggleSfx?.();
      syncAudioButtons();
      const nowOn = window.GameAudio?.isSfxEnabled?.() ?? true;
      if (nowOn) audioPlay("ui_click");
    }
  });

  canvas.addEventListener("pointerdown", () => {
    if (game.phase === "menu") {
      showModeSelectOverlay();
      return;
    }
    dropHook();
  });

  syncAudioButtons();
}

function stepFrame(dt) {
  if (game.phase === "playing" && !game.paused) update(dt);
  updateMiner(dt);
  updateFx(dt);
  updateHookTrail(dt);
}

function renderGameToText() {
  const hook0 = game.hook;
  const pivot0 = getPivot(hook0);
  const end0 = getHookEnd(hook0);
  const carried0 = attachedItem(hook0);
  const items = game.items
    .filter((it) => !it.grabbed)
    .slice(0, 24)
    .map((it) => ({
      id: it.id,
      type: it.type,
      x: Math.round(it.x * 10) / 10,
      y: Math.round(it.y * 10) / 10,
      r: Math.round(it.r * 10) / 10,
      value: it.value,
    }));

  const hooks = getHooks().map((hook, index) => {
    const pivot = getPivot(hook);
    const end = getHookEnd(hook);
    const carried = attachedItem(hook);
    return {
      player: index + 1,
      pivot: { x: Math.round(pivot.x * 10) / 10, y: Math.round(pivot.y * 10) / 10 },
      hookEnd: { x: Math.round(end.x * 10) / 10, y: Math.round(end.y * 10) / 10 },
      hook: {
        state: hook.state,
        angle: Math.round(hook.angle * 1000) / 1000,
        length: Math.round(hook.length * 10) / 10,
        maxLength: Math.round(hook.maxLength * 10) / 10,
        attached: carried
          ? {
              id: carried.id,
              type: carried.type,
              r: Math.round(carried.r * 10) / 10,
              value: carried.type === "bag" ? carried.bagValue ?? carried.value : carried.value,
            }
          : null,
      },
    };
  });

  const payload = {
    coordinateSystem: "origin top-left; +x right; +y down; units: px",
    phase: game.phase,
    paused: game.paused,
    mode: game.mode,
    level: game.level,
    score: game.score,
    target: game.target,
    timeLeft: Math.round(game.timeLeft * 100) / 100,
    seed: game.currentSeed || game.runSeed,
    hook: {
      state: hook0.state,
      angle: Math.round(hook0.angle * 1000) / 1000,
      length: Math.round(hook0.length * 10) / 10,
      maxLength: Math.round(hook0.maxLength * 10) / 10,
      attached: carried0
        ? {
            id: carried0.id,
            type: carried0.type,
            r: Math.round(carried0.r * 10) / 10,
            value: carried0.type === "bag" ? carried0.bagValue ?? carried0.value : carried0.value,
          }
        : null,
    },
    pivot: { x: Math.round(pivot0.x * 10) / 10, y: Math.round(pivot0.y * 10) / 10 },
    hookEnd: { x: Math.round(end0.x * 10) / 10, y: Math.round(end0.y * 10) / 10 },
    hooks,
    items,
  };
  return JSON.stringify(payload);
}

window.render_game_to_text = renderGameToText;

window.advanceTime = (ms) => {
  const totalMs = Math.max(0, Number(ms) || 0);
  const stepMs = 1000 / 60;
  const steps = Math.max(1, Math.round(totalMs / stepMs));
  for (let i = 0; i < steps; i += 1) stepFrame(1 / 60);
  render();
  return Promise.resolve();
};

let lastTs = 0;
function loop(ts) {
  const dt = clamp((ts - lastTs) / 1000, 0, 0.034);
  lastTs = ts;

  stepFrame(dt);
  render();

  requestAnimationFrame(loop);
}

function boot() {
  initUi();
  initRunSeed();
  initBackgrounds();
  game.bgIndex = pickBackgroundIndex(game.runSeed, null);
  resize();
  window.addEventListener("resize", resize, { passive: true });

  showModeSelectOverlay();

  updateHud();
  const isVirtualTime = typeof window.__vt_pending !== "undefined";
  if (!isVirtualTime) requestAnimationFrame(loop);
  else render();
}

boot();
