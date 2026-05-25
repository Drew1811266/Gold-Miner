import { clamp } from "../core/geometry.js";

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

function assertInteger(value, name) {
  if (!Number.isInteger(value)) {
    throw new TypeError(`${name} must be an integer`);
  }
}

function itemFxColor(item) {
  switch (item.type) {
    case "mouse": {
      const cargo = item.mouse?.cargo ?? null;
      if (cargo === "diamond") return "#8fe9ff";
      if (cargo === "bar") return "#ffd34d";
      return "#c8cdd8";
    }
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

function itemEarnedValue(item) {
  const earned = item.type === "bag" ? item.bagValue ?? item.value : item.value;
  assertFiniteNumber(earned, item.type === "bag" && item.bagValue != null ? "item.bagValue" : "item.value");
  return earned;
}

export function createDeliveryResult(options) {
  assertObject(options, "options");
  const { score, item, playerIndex } = options;

  assertFiniteNumber(score, "score");
  assertObject(item, "item");
  if (typeof item.type !== "string") {
    throw new TypeError("item.type must be a string");
  }
  assertFiniteNumber(item.r, "item.r");
  assertInteger(playerIndex, "playerIndex");

  const earned = itemEarnedValue(item);
  const color = itemFxColor(item);
  const nextScore = score + earned;

  return {
    earned,
    nextScore,
    color,
    playerIndex,
    scorePopPayload: { amount: earned, color, player: playerIndex },
    scoreAudioPayload: { amount: earned },
    ringPayload: {
      r0: 10,
      r1: 54,
      life: 0.55,
      color,
      width: 3,
      yOffset: 18,
    },
    burstPayload: {
      yOffset: 18,
      count: clamp(Math.round(10 + item.r / 3), 10, 18),
      colors: [color, "#ffffff", "#ffe08a"],
      speedMin: 80,
      speedMax: 220,
      sizeMin: 1.2,
      sizeMax: 3.6,
      lifeMin: 0.35,
      lifeMax: 0.7,
      gravity: 520,
    },
  };
}
