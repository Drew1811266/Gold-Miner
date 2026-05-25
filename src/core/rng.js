import { lerp } from "./geometry.js";

export function createRng(seed) {
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
