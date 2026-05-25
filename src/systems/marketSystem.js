import { clamp } from "../core/geometry.js";
import { MARKET_COMMODITIES, MARKET_DAY_NAMES } from "../config/balance.js";

export function formatMarketDelta(multiplier) {
  const pct = Math.round((multiplier - 1) * 100);
  if (pct > 0) return `↑${pct}%`;
  if (pct < 0) return `↓${Math.abs(pct)}%`;
  return "±0%";
}

export function createMarketDay(rng) {
  const multipliers = {};
  const entries = [];
  for (const cfg of MARKET_COMMODITIES) {
    const value = rng.range(cfg.min, cfg.max);
    multipliers[cfg.key] = value;
    entries.push({ key: cfg.key, label: cfg.label, value });
  }

  const hotIndex = Math.floor(rng.next() * entries.length);
  let coldIndex = Math.floor(rng.next() * entries.length);
  if (coldIndex === hotIndex) coldIndex = (coldIndex + 1) % entries.length;

  entries[hotIndex].value = clamp(entries[hotIndex].value * rng.range(1.08, 1.2), 0.72, 1.5);
  entries[coldIndex].value = clamp(entries[coldIndex].value * rng.range(0.76, 0.9), 0.58, 1.45);

  multipliers[entries[hotIndex].key] = entries[hotIndex].value;
  multipliers[entries[coldIndex].key] = entries[coldIndex].value;

  const summary = entries.map((entry) => `${entry.label}${formatMarketDelta(entry.value)}`).join("  ");
  return {
    name: MARKET_DAY_NAMES[Math.floor(rng.next() * MARKET_DAY_NAMES.length)],
    multipliers,
    summary,
  };
}
