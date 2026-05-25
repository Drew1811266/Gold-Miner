import { clamp } from "../core/geometry.js";

const freezeConfig = (config) =>
  Object.freeze({
    ...config,
    mix: Object.freeze({ ...config.mix }),
  });

const cloneConfig = (config) => ({
  ...config,
  mix: { ...config.mix },
});

export const LEVELS = Object.freeze(
  [
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
  ].map(freezeConfig),
);

export function getLevelConfig(level) {
  const preset = LEVELS[level - 1];
  if (preset) return cloneConfig(preset);

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

  return {
    target: baseTarget + (level - 1) * delta,
    time,
    seed: 9000 + level * 997,
    mix,
  };
}
