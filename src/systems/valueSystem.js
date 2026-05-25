import { ITEM_VALUE_SCALE } from "../config/items.js";

export function scaleItemValue(value, extraMultiplier = 1) {
  return Math.max(0, Math.round(value * ITEM_VALUE_SCALE * extraMultiplier));
}

export function bagValueRange(level) {
  const min = 120 + level * 20;
  const max = 800 + level * 60;
  return { min, max };
}

export function createLevelItemValue({ rng, levelValueMultiplier, marketMultipliers }) {
  return (min, max, marketKey = null) => {
    const marketMultiplier =
      marketKey && Number.isFinite(marketMultipliers?.[marketKey]) ? marketMultipliers[marketKey] : 1;
    // RNG call order is part of the fixed-seed generation contract.
    return scaleItemValue(Math.round(rng.range(min, max)), levelValueMultiplier * marketMultiplier);
  };
}
