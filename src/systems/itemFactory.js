import {
  MOUSE_CARGO_CHANCE,
  MOUSE_SPEED_MAX,
  MOUSE_SPEED_MIN,
} from "../config/items.js";
import { bagValueRange, createLevelItemValue } from "./valueSystem.js";

export function intRange(rng, min, maxInclusive) {
  return Math.floor(rng.range(min, maxInclusive + 1));
}

export function makeBlob(rng, pointsCount, minRadius, maxRadius) {
  const points = [];
  const step = (Math.PI * 2) / pointsCount;
  const offset = rng.range(0, Math.PI * 2);
  for (let i = 0; i < pointsCount; i += 1) {
    points.push({ a: offset + i * step, r: rng.range(minRadius, maxRadius) });
  }
  return points;
}

export function createItemArt(item, rng) {
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

export function makeItem({ id, type, x, y, r, value, weight, mouse = null }) {
  return {
    id,
    type,
    x,
    y,
    r,
    value,
    weight,
    grabbed: false,
    bagValue: type === "bag" ? value : null,
    keg: null,
    mouse,
    art: null,
  };
}

export function createItemSpec({
  type,
  size,
  level,
  rng,
  marketMultipliers,
  levelValueMultiplier,
  dda,
}) {
  const levelItemValue = createLevelItemValue({ rng, levelValueMultiplier, marketMultipliers });
  const mouseSpeedMul = Number.isFinite(dda?.mouseSpeedMul) ? dda.mouseSpeedMul : 1;

  if (type === "bar") {
    return {
      type,
      r: rng.range(16, 22),
      value: levelItemValue(220, 420, "bar"),
      weight: 1.6,
    };
  }

  if (type === "mouse") {
    const r = rng.range(14, 18);
    const hasCargo = rng.next() < MOUSE_CARGO_CHANCE;
    const cargo = hasCargo ? (rng.next() < 0.5 ? "diamond" : "bar") : null;

    const baseValue = levelItemValue(140, 280);
    const cargoValue =
      cargo === "diamond"
        ? levelItemValue(420, 620, "diamond")
        : cargo === "bar"
          ? levelItemValue(220, 420, "bar")
          : 0;

    const value = cargo ? cargoValue : baseValue;
    const vx = rng.range(MOUSE_SPEED_MIN, MOUSE_SPEED_MAX) * (rng.next() < 0.5 ? -1 : 1) * mouseSpeedMul;
    const weight = 1.35 + (cargo === "diamond" ? 0.45 : cargo === "bar" ? 0.9 : 0);

    return {
      type,
      r,
      value,
      weight,
      mouse: {
        vx,
        cargo,
        phase: rng.range(0, Math.PI * 2),
      },
    };
  }

  if (type === "emerald") {
    return {
      type,
      r: rng.range(10, 14),
      value: levelItemValue(480, 800, "emerald"),
      weight: 1.05,
    };
  }

  if (type === "ruby") {
    return {
      type,
      r: rng.range(10, 14),
      value: levelItemValue(520, 900, "ruby"),
      weight: 1.1,
    };
  }

  if (type === "crystal") {
    return {
      type,
      r: rng.range(16, 24),
      value: levelItemValue(180, 360, "crystal"),
      weight: 1.35,
    };
  }

  if (type === "pouch") {
    return {
      type,
      r: rng.range(13, 18),
      value: levelItemValue(150, 1000),
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
      value: levelItemValue(300, 650),
      weight: 3.4,
    };
  }

  if (type === "gold") {
    if (size === "small") {
      return {
        type,
        r: rng.range(12, 18),
        value: levelItemValue(60, 120),
        weight: 1.0,
      };
    }
    if (size === "medium") {
      return {
        type,
        r: rng.range(20, 26),
        value: levelItemValue(160, 260),
        weight: 2.0,
      };
    }
    return {
      type,
      r: rng.range(30, 40),
      value: levelItemValue(320, 520),
      weight: 4.2,
    };
  }

  if (type === "rock") {
    return {
      type,
      r: rng.range(18, 32),
      value: levelItemValue(10, 60),
      weight: 5.8,
    };
  }

  if (type === "diamond") {
    return {
      type,
      r: rng.range(10, 14),
      value: levelItemValue(420, 620, "diamond"),
      weight: 1.25,
    };
  }

  if (type === "bag") {
    const bagRange = bagValueRange(level);
    return {
      type: "bag",
      r: rng.range(12, 18),
      value: levelItemValue(bagRange.min, bagRange.max),
      weight: 1.8,
    };
  }

  throw new Error(`Unknown item type: ${type}`);
}
