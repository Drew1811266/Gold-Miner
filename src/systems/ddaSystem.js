import { clamp, lerp } from "../core/geometry.js";
import {
  DDA_BASE_MAX,
  DDA_BASE_PER_STAGE,
  DDA_INERTIA,
  DDA_OVER_FOR_MAX_SIGNAL,
  DDA_STAGE_SIZE,
  POST_LEVEL4_RAMP_LEVELS,
  POST_LEVEL4_START_LEVEL,
} from "../config/balance.js";

export function ddaStage(level) {
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  return Math.floor((lv - 1) / DDA_STAGE_SIZE);
}

export function ddaBaseDifficulty(level) {
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  const stage = ddaStage(lv);
  const within = (lv - 1) - stage * DDA_STAGE_SIZE;
  const withinFrac = DDA_STAGE_SIZE <= 1 ? 0 : within / (DDA_STAGE_SIZE - 1);
  const base = stage * DDA_BASE_PER_STAGE + withinFrac * (DDA_BASE_PER_STAGE * 0.5);
  return clamp(base, 0, DDA_BASE_MAX);
}

export function ddaOverSignal(overRatio) {
  const r = Number.isFinite(overRatio) ? overRatio : 0;
  return clamp(r / DDA_OVER_FOR_MAX_SIGNAL, -1, 1);
}

export function postLevel4Pressure(level) {
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  if (lv < POST_LEVEL4_START_LEVEL) return 0;
  const stepsPast = lv - POST_LEVEL4_START_LEVEL;
  const ramp = clamp(stepsPast / POST_LEVEL4_RAMP_LEVELS, 0, 1);
  return clamp(0.22 + ramp * 0.78, 0, 1);
}

export function computeDdaTuning(level, rating = 0) {
  const base = ddaBaseDifficulty(level);
  const clampedRating = clamp(rating, -1, 1);
  const hard = clamp(clampedRating, 0, 1);
  const ease = clamp(-clampedRating, 0, 1);
  const post4 = postLevel4Pressure(level);

  const difficulty = clamp(base + clampedRating * 0.22 + post4 * 0.12, 0, 1);
  const targetMul = clamp(1 + base * 0.18 + hard * 0.28 - ease * 0.08 + post4 * 0.24, 0.9, 1.75);
  const timeMul = clamp(1 - base * 0.08 - hard * 0.14 + ease * 0.08 - post4 * 0.18, 0.68, 1.18);

  const mixDiff = clamp(base * 0.85 + hard * 0.95 - ease * 0.25 + post4 * 0.55, 0, 1);
  const mixMul = (key) => {
    switch (key) {
      case "rock":
        return lerp(1, 1.35, mixDiff);
      case "keg":
        return lerp(1, 1.5, mixDiff);
      case "fossil":
        return lerp(1, 1.22, mixDiff);
      case "diamond":
        return lerp(1, 0.82, mixDiff);
      case "emerald":
      case "ruby":
        return lerp(1, 0.84, mixDiff);
      case "crystal":
        return lerp(1, 0.87, mixDiff);
      case "bar":
        return lerp(1, 0.86, mixDiff);
      case "bag":
      case "pouch":
        return lerp(1, 0.88, mixDiff);
      case "goldLarge":
        return lerp(1, 0.92, mixDiff);
      case "goldMedium":
        return lerp(1, 1.06, mixDiff);
      case "goldSmall":
        return lerp(1, 1.14, mixDiff);
      default:
        return 1;
    }
  };

  const mouseSpeedMul = lerp(1, 1.35, difficulty) * lerp(1, 1.18, post4);
  const mouseMax = clamp(1 + Math.round(difficulty * 3), 1, 4);

  return {
    stage: ddaStage(level),
    base,
    rating: clampedRating,
    post4Pressure: post4,
    difficulty,
    targetMul,
    timeMul,
    mixMul,
    mouseSpeedMul,
    mouseMax,
  };
}

export function updateDdaRating({
  currentRating,
  score,
  target,
  levelTimeTotal,
  firstClearTimeLeft,
}) {
  const safeTarget = Math.max(1, Math.floor(target) || 1);
  const overRatio = (score - safeTarget) / safeTarget;
  const overSignal = ddaOverSignal(overRatio);
  let signal = overSignal;

  const tTotal = Math.max(1, Math.round(levelTimeTotal) || 1);
  if (Number.isFinite(firstClearTimeLeft)) {
    const clearFrac = clamp(firstClearTimeLeft / tTotal, 0, 1);
    const clearSignal = clamp((clearFrac - 0.35) / 0.45, -1, 1);
    signal = clamp(overSignal * 0.7 + clearSignal * 0.3, -1, 1);
  }

  return {
    rating: clamp((currentRating ?? 0) * DDA_INERTIA + signal * (1 - DDA_INERTIA), -1, 1),
    lastOverRatio: overRatio,
    lastSignal: signal,
  };
}
