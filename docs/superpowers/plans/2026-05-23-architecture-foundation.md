# Architecture Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first safe architecture foundation for the Gold Miner refactor: repository hygiene, baseline checks, deterministic pure modules, and test scaffolding without changing gameplay behavior.

**Architecture:** This first batch intentionally avoids rewiring `index.html` or replacing `game.js`. It creates tested pure modules under `src/` that mirror existing logic, adds source/baseline tests, and records fixed-seed behavior so later tasks can migrate callers safely.

**Tech Stack:** HTML5 Canvas, browser JavaScript, WebAudio, Node.js built-in test runner, macOS shell scripts, Swift WebKit wrapper.

---

## Scope

This plan implements the first delivery slice from `docs/architecture-optimization-plan.md`.

Included:

- Add repository hygiene files.
- Add Node test scripts with no external dependencies.
- Add source invariant tests for the current browser app.
- Add baseline artifact structure for fixed-seed game states.
- Capture fixed-seed initial state and one post-advance state.
- Extract pure `rng` and `geometry` modules.
- Extract pure market and DDA modules.
- Add tests for the new pure modules.
- Update architecture docs with the first-batch execution boundary.

Excluded from this batch:

- Do not convert `index.html` to ES Modules yet.
- Do not replace `game.js` callers yet.
- Do not extract `generateLevel()`, `buildScene()`, or `createItemArt()` yet.
- Do not introduce the event layer yet.
- Do not split rendering functions yet.
- Do not introduce Playwright as a package dependency yet.
- Do not alter gameplay rules, values, item counts, timing, or controls.
- Do not edit macOS app logic except later if tests prove it is necessary.

## Preflight

The repository currently has no initial commit and all project files are untracked. Because `git worktree add` needs a commit to create a useful worktree, implementation should happen on a feature branch in the current checkout unless the human explicitly creates an initial commit first.

Because there is no Git baseline, reviewers cannot prove that protected untracked files were not touched earlier in the session. For this batch, protected-file checks must be evidence-based: verify current runtime entry invariants, syntax checks, and baseline tests. Do not reject a task only because Git cannot prove historical non-modification in an unborn repository.

- [ ] **Step 1: Verify branch state**

Run:

```bash
git status --short
git branch --show-current
git log --oneline -1
```

Expected:

- `git status --short` shows many untracked project files.
- `git branch --show-current` is `main` before switching.
- `git log --oneline -1` may fail with `fatal: your current branch 'main' does not have any commits yet`.

- [ ] **Step 2: Switch to a feature branch if still on main**

Run:

```bash
git switch -c codex/architecture-foundation
```

Expected:

- Branch is now `codex/architecture-foundation`.
- This does not create a commit and does not remove untracked files.

If the branch already exists, run:

```bash
git switch codex/architecture-foundation
```

Expected:

- Branch is now `codex/architecture-foundation`.

## Task 1: Repository Hygiene And Test Scripts

**Files:**

- Create: `.gitignore`
- Create: `package.json`
- Create: `tests/unit/source-invariants.test.mjs`
- Verify: `game.js`
- Verify: `audio.js`
- Verify: `index.html`

### Purpose

Create a minimal test surface that can run before deeper refactors. This task must not modify game behavior.

- [ ] **Step 1: Create `.gitignore`**

Create `.gitignore` with exactly:

```gitignore
.DS_Store
dist/
tmp/
node_modules/
coverage/
*.log
```

Do not ignore `assets/`, `docs/`, `macos/`, `output/`, `game.js`, `audio.js`, `index.html`, or `styles.css` in this task.

- [ ] **Step 2: Create `package.json`**

Create `package.json` with exactly:

```json
{
  "name": "gold-miner",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "check:syntax": "node --check game.js && node --check audio.js",
    "test": "node --test tests/unit/*.test.mjs",
    "verify": "npm run check:syntax && npm test"
  }
}
```

No dependencies are required for this task.

- [ ] **Step 3: Create `tests/unit/source-invariants.test.mjs`**

Create the file with exactly:

```js
import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("index loads audio before game script", () => {
  const html = read("index.html");
  const audioIndex = html.indexOf('src="./audio.js"');
  const gameIndex = html.indexOf('src="./game.js"');

  assert.notEqual(audioIndex, -1, "index.html should load audio.js");
  assert.notEqual(gameIndex, -1, "index.html should load game.js");
  assert.ok(audioIndex < gameIndex, "audio.js must load before game.js");
});

test("game exposes browser automation debug hooks", () => {
  const source = read("game.js");

  assert.match(source, /window\.render_game_to_text\s*=/);
  assert.match(source, /window\.advanceTime\s*=/);
});

test("game still starts from the current non-module script entry", () => {
  const html = read("index.html");

  assert.match(html, /<script src="\.\/audio\.js"><\/script>/);
  assert.match(html, /<script src="\.\/game\.js"><\/script>/);
  assert.doesNotMatch(html, /type="module"\s+src="\.\/src\/main\.js"/);
});
```

- [ ] **Step 4: Run syntax check**

Run:

```bash
npm run check:syntax
```

Expected:

- `node --check game.js` passes.
- `node --check audio.js` passes.

- [ ] **Step 5: Run unit tests**

Run:

```bash
npm test
```

Expected:

- 3 tests pass.
- No browser is required.

## Task 2: Fixed-Seed Baseline Artifacts

**Files:**

- Create: `tests/baselines/README.md`
- Create: `tests/baselines/seed-12345-initial-single.json`
- Create: `tests/baselines/seed-12345-after-advance-1000ms.json`
- Create: `tests/unit/baseline-fixtures.test.mjs`
- Read: `game.js`
- Read: `index.html`

### Purpose

Record a stable first baseline for future refactors. The baseline should represent the game after loading with seed `12345` and entering single-player mode.

### Required baseline capture procedure

Use a real browser or browser automation against:

```text
file:///Users/drew/Project/Gold%20Miner/index.html?seed=12345
```

Actions:

1. Wait for the page to load.
2. Enter single-player mode by clicking `单人模式` if the mode overlay is visible. If not visible, click `开始`, then click `单人模式`.
3. Evaluate `window.render_game_to_text()`.
4. Parse the returned JSON.
5. Save a stable summary JSON to `tests/baselines/seed-12345-initial-single.json`, not the full debug payload.

The stable summary must keep deterministic gameplay fields only:

- `phase`, `paused`, `mode`, `level`, `seed`, `score`, `target`
- `market.name`, `market.summary`, and rounded `market.multipliers`
- DDA fields: `stage`, `rating`, `post4Pressure`, `difficulty`, `targetMul`, `timeMul`, `lastOverRatio`, `firstClearTimeLeft`
- `hookCount` and `hooks` entries with only `player`, `state`, and `attached`

The summary must omit clock- and viewport-dependent fields such as `timeLeft`, hook geometry, pivot coordinates, hook endpoints, hook length limits, item placement summaries, and item `x`/`y` coordinates. Because item placement can depend on canvas size, `items` and `itemCount` are intentionally excluded from this first stable baseline.

- [ ] **Step 1: Create `tests/baselines/README.md`**

Create the file with baseline capture instructions that state:

```markdown
# Baseline Fixtures

These fixtures record fixed-seed stable game summaries used to guard architecture refactors.

The source payload is `window.render_game_to_text()`, but the committed fixtures intentionally omit clock- and viewport-dependent fields such as `timeLeft`, hook geometry, pivot coordinates, hook endpoints, hook length limits, item coordinates, and item placement summaries.

## seed-12345-initial-single.json

Captured from:

`file:///Users/drew/Project/Gold%20Miner/index.html?seed=12345`

Procedure:

1. Load the page.
2. Start single-player mode.
3. Evaluate `window.render_game_to_text()`.
4. Extract stable summary fields.
5. Save summary JSON with two-space indentation.

Expected high-level state:

- `phase`: `playing`
- `paused`: `false`
- `mode`: `single`
- `level`: `1`
- `seed`: `13546`
```

- [ ] **Step 2: Capture `tests/baselines/seed-12345-initial-single.json`**

Use browser automation as described above.

Expected:

- File exists.
- JSON is pretty-printed with two spaces.
- `phase` is `playing`.
- `mode` is `single`.
- `level` is `1`.
- `seed` is `13546`.
- `hookCount` is `1`, and `hooks` contains only `player`, `state`, and `attached`.
- `items` and `itemCount` are omitted.
- Clock- and viewport-dependent fields are omitted.

- [ ] **Step 3: Capture `tests/baselines/seed-12345-after-advance-1000ms.json`**

Starting from the same single-player state used in Step 2, evaluate:

```js
await window.advanceTime(1000);
window.render_game_to_text();
```

Save the parsed, pretty-printed JSON to:

```text
tests/baselines/seed-12345-after-advance-1000ms.json
```

Expected:

- File exists.
- JSON is pretty-printed with two spaces.
- `advancedByMs` is `1000`.
- `phase` is `playing`.
- `mode` is `single`.
- `level` is `1`.
- `seed` is `13546`.
- Stable fields match the initial baseline unless deterministic gameplay state changed.
- Actual `timeLeft` is not recorded.

- [ ] **Step 4: Create `tests/unit/baseline-fixtures.test.mjs`**

Create the file with exactly:

```js
import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

function readJson(path) {
  return JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"));
}

function assertOmittedClockAndViewportFields(value) {
  const forbiddenKeys = new Set([
    "coordinateSystem",
    "timeLeft",
    "pivot",
    "hookEnd",
    "angle",
    "length",
    "maxLength",
    "x",
    "y",
    "items",
    "itemCount",
  ]);

  function visit(node) {
    if (!node || typeof node !== "object") return;
    for (const [key, child] of Object.entries(node)) {
      assert.equal(forbiddenKeys.has(key), false, `stable baseline should omit ${key}`);
      visit(child);
    }
  }

  visit(value);
}

test("seed 12345 single-player baseline has expected high-level state", () => {
  const baseline = readJson("tests/baselines/seed-12345-initial-single.json");

  assert.equal(baseline.summaryType, "stable-baseline");
  assert.equal(baseline.phase, "playing");
  assert.equal(baseline.paused, false);
  assert.equal(baseline.mode, "single");
  assert.equal(baseline.level, 1);
  assert.equal(baseline.seed, 13546);
  assert.equal(baseline.score, 0);
  assert.equal(baseline.target, 650);
  assert.equal(baseline.hookCount, 1);
  assert.equal(Array.isArray(baseline.hooks), true);
  assert.deepEqual(baseline.hooks, [{ player: 1, state: "swing", attached: null }]);
  assertOmittedClockAndViewportFields(baseline);
});

test("seed 12345 post-advance baseline keeps same game and records advance amount", () => {
  const initial = readJson("tests/baselines/seed-12345-initial-single.json");
  const advanced = readJson("tests/baselines/seed-12345-after-advance-1000ms.json");
  const { advancedByMs, ...advancedStableSummary } = advanced;

  assert.equal(advanced.summaryType, "stable-baseline");
  assert.equal(advancedByMs, 1000);
  assert.equal(advanced.phase, "playing");
  assert.equal(advanced.paused, false);
  assert.equal(advanced.mode, "single");
  assert.equal(advanced.level, 1);
  assert.equal(advanced.seed, 13546);
  assert.deepEqual(advancedStableSummary, initial);
  assertOmittedClockAndViewportFields(advanced);
});

test("seed 12345 baseline records market and DDA fields", () => {
  const baseline = readJson("tests/baselines/seed-12345-initial-single.json");

  assert.equal(typeof baseline.market.name, "string");
  assert.equal(typeof baseline.market.summary, "string");
  assert.equal(typeof baseline.market.multipliers.bar, "number");
  assert.equal(typeof baseline.dda.stage, "number");
  assert.equal(typeof baseline.dda.targetMul, "number");
  assert.equal(typeof baseline.dda.timeMul, "number");
});
```

- [ ] **Step 5: Run verification**

Run:

```bash
npm run verify
```

Expected:

- Syntax check passes.
- Source invariant tests pass.
- Baseline fixture tests pass.

## Task 3: Extract Pure Core Modules

**Files:**

- Create: `src/core/geometry.js`
- Create: `src/core/rng.js`
- Create: `tests/unit/core.test.mjs`
- Read: `game.js`

### Purpose

Extract pure, dependency-free helpers. Do not wire them into `game.js` yet.

- [ ] **Step 1: Create `src/core/geometry.js`**

Create the file with exactly:

```js
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function segmentCircleIntersect(ax, ay, bx, by, cx, cy, radius) {
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
```

- [ ] **Step 2: Create `src/core/rng.js`**

Create the file with exactly:

```js
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
```

- [ ] **Step 3: Create `tests/unit/core.test.mjs`**

Create the file with exactly:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { clamp, dist2, lerp, segmentCircleIntersect } from "../../src/core/geometry.js";
import { createRng } from "../../src/core/rng.js";

test("geometry helpers match existing game math", () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
  assert.equal(clamp(2, 0, 3), 2);
  assert.equal(lerp(10, 20, 0.25), 12.5);
  assert.equal(dist2(0, 0, 3, 4), 25);
});

test("segment-circle intersection handles hit, miss, and zero-length segment", () => {
  assert.equal(segmentCircleIntersect(0, 0, 10, 0, 5, 2, 2), true);
  assert.equal(segmentCircleIntersect(0, 0, 10, 0, 5, 3, 2), false);
  assert.equal(segmentCircleIntersect(1, 1, 1, 1, 2, 1, 1), true);
  assert.equal(segmentCircleIntersect(1, 1, 1, 1, 3.1, 1, 1), false);
});

test("rng is deterministic for same seed", () => {
  const a = createRng(12345);
  const b = createRng(12345);
  const seqA = [a.next(), a.next(), a.next(), a.next(), a.next()];
  const seqB = [b.next(), b.next(), b.next(), b.next(), b.next()];

  assert.deepEqual(seqA, seqB);
});

test("rng range and pick are bounded", () => {
  const rng = createRng(7);
  for (let i = 0; i < 20; i += 1) {
    const value = rng.range(10, 20);
    assert.ok(value >= 10);
    assert.ok(value <= 20);
  }

  const pick = rng.pick(["a", "b", "c"]);
  assert.ok(["a", "b", "c"].includes(pick));
});
```

- [ ] **Step 4: Run verification**

Run:

```bash
npm run verify
```

Expected:

- All tests pass.

## Task 4: Extract Market And DDA Pure Systems

**Files:**

- Create: `src/config/balance.js`
- Create: `src/systems/marketSystem.js`
- Create: `src/systems/ddaSystem.js`
- Create: `tests/unit/systems.test.mjs`
- Read: `game.js`

### Purpose

Extract two self-contained systems that are pure and easy to verify. Do not wire them into `game.js` yet.
This task extracts a pure DDA API with explicit input arguments; it must not move or rewrite the existing `game.js` DDA call sites in this batch.

- [ ] **Step 1: Create `src/config/balance.js`**

Create the file with exactly:

```js
export const DDA_STAGE_SIZE = 3;
export const DDA_BASE_PER_STAGE = 0.12;
export const DDA_BASE_MAX = 0.84;
export const DDA_OVER_FOR_MAX_SIGNAL = 0.35;
export const DDA_INERTIA = 0.72;
export const POST_LEVEL4_START_LEVEL = 5;
export const POST_LEVEL4_RAMP_LEVELS = 8;

export const MARKET_COMMODITIES = [
  { key: "bar", label: "金条", min: 0.72, max: 1.34 },
  { key: "diamond", label: "钻石", min: 0.7, max: 1.42 },
  { key: "emerald", label: "祖母绿", min: 0.7, max: 1.38 },
  { key: "ruby", label: "红宝石", min: 0.7, max: 1.38 },
  { key: "crystal", label: "水晶簇", min: 0.74, max: 1.32 },
];

export const MARKET_DAY_NAMES = ["矿脉狂热日", "交易震荡日", "宝石追涨日", "金属抢购日", "淘金观望日"];
```

- [ ] **Step 2: Create `src/systems/marketSystem.js`**

Create the file with exactly:

```js
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
```

- [ ] **Step 3: Create `src/systems/ddaSystem.js`**

Create the file with exactly:

```js
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
```

- [ ] **Step 4: Create `tests/unit/systems.test.mjs`**

Create the file with exactly:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRng } from "../../src/core/rng.js";
import { createMarketDay, formatMarketDelta } from "../../src/systems/marketSystem.js";
import {
  computeDdaTuning,
  ddaBaseDifficulty,
  ddaOverSignal,
  ddaStage,
  postLevel4Pressure,
  updateDdaRating,
} from "../../src/systems/ddaSystem.js";

test("market delta formatter matches game display rules", () => {
  assert.equal(formatMarketDelta(1), "±0%");
  assert.equal(formatMarketDelta(1.13), "↑13%");
  assert.equal(formatMarketDelta(0.87), "↓13%");
});

test("market day is deterministic for fixed rng seed", () => {
  const a = createMarketDay(createRng(13546 ^ 0x51d7348d));
  const b = createMarketDay(createRng(13546 ^ 0x51d7348d));

  assert.deepEqual(a, b);
  assert.equal(typeof a.name, "string");
  assert.equal(typeof a.summary, "string");
  assert.equal(Object.keys(a.multipliers).length, 5);
});

test("DDA stage and pressure follow existing level thresholds", () => {
  assert.equal(ddaStage(1), 0);
  assert.equal(ddaStage(3), 0);
  assert.equal(ddaStage(4), 1);
  assert.equal(ddaBaseDifficulty(1), 0);
  assert.ok(postLevel4Pressure(4) === 0);
  assert.ok(postLevel4Pressure(5) > 0);
});

test("DDA over signal clamps under and over performance", () => {
  assert.equal(ddaOverSignal(0), 0);
  assert.equal(ddaOverSignal(0.35), 1);
  assert.equal(ddaOverSignal(1), 1);
  assert.equal(ddaOverSignal(-1), -1);
});

test("DDA tuning increases target pressure for high rating", () => {
  const easy = computeDdaTuning(6, -0.5);
  const hard = computeDdaTuning(6, 0.8);

  assert.ok(hard.targetMul > easy.targetMul);
  assert.ok(hard.timeMul < easy.timeMul);
  assert.ok(hard.mixMul("rock") >= easy.mixMul("rock"));
  assert.ok(hard.mixMul("diamond") <= easy.mixMul("diamond"));
});

test("DDA rating update records over ratio and signal", () => {
  const result = updateDdaRating({
    currentRating: 0,
    score: 1300,
    target: 1000,
    levelTimeTotal: 60,
    firstClearTimeLeft: 30,
  });

  assert.ok(result.rating > 0);
  assert.equal(Math.round(result.lastOverRatio * 100) / 100, 0.3);
  assert.ok(result.lastSignal > 0);
});
```

- [ ] **Step 5: Run verification**

Run:

```bash
npm run verify
```

Expected:

- All tests pass.
- No gameplay files have been rewired.

## Task 5: Documentation Update For First Batch Boundary

**Files:**

- Modify: `docs/architecture-optimization-plan.md`
- Create or modify: `docs/superpowers/plans/2026-05-23-architecture-foundation.md`

### Purpose

Make it clear that this first implementation batch is the safety foundation and does not complete the full architecture migration.

- [ ] **Step 1: Add an implementation status section to `docs/architecture-optimization-plan.md`**

Append this section near the end, before `## 12. 完成定义`:

```markdown
## 12. 实施批次记录

### Batch 1：Architecture Foundation

计划文件：`docs/superpowers/plans/2026-05-23-architecture-foundation.md`

范围：

- 建立 `.gitignore` 和 Node 测试脚本。
- 建立固定 seed baseline fixture。
- 抽离纯 `rng`、`geometry`、`marketSystem`、`ddaSystem` 模块。
- 增加单元测试保护这些纯模块。

明确不包含：

- 不切换 `index.html` 到 ES Modules。
- 不重写 `game.js` 调用路径。
- 不拆 Canvas 渲染层。
- 不改变玩法规则。
```

If adding this section changes the old `## 12. 完成定义` heading, renumber that heading to `## 13. 完成定义`.

- [ ] **Step 2: Run verification**

Run:

```bash
npm run verify
```

Expected:

- All tests still pass.

## Task 6: Final Review And Evidence

**Files:**

- Review all files changed by Tasks 1-5.

### Purpose

Confirm this batch is a safe foundation and did not alter runtime behavior.

- [ ] **Step 1: Inspect changed files**

Run:

```bash
git status --short
```

Expected changed or new files for this batch:

- `.gitignore`
- `package.json`
- `docs/architecture-optimization-plan.md`
- `docs/superpowers/plans/2026-05-23-architecture-foundation.md`
- `src/core/geometry.js`
- `src/core/rng.js`
- `src/config/balance.js`
- `src/systems/marketSystem.js`
- `src/systems/ddaSystem.js`
- `tests/baselines/README.md`
- `tests/baselines/seed-12345-initial-single.json`
- `tests/unit/source-invariants.test.mjs`
- `tests/unit/baseline-fixtures.test.mjs`
- `tests/unit/core.test.mjs`
- `tests/unit/systems.test.mjs`

Existing untracked project files may still appear because the repository has no initial commit.

- [ ] **Step 2: Run final verification**

Run:

```bash
npm run verify
```

Expected:

- Syntax check passes.
- All unit tests pass.

- [ ] **Step 3: Confirm no runtime entry changed**

Run:

```bash
rg -n "type=\"module\"|src=\"./src/main.js\"|src=\"./game.js\"|src=\"./audio.js\"" index.html
```

Expected:

- `index.html` still references `./audio.js`.
- `index.html` still references `./game.js`.
- `index.html` does not reference `./src/main.js`.

- [ ] **Step 4: Run macOS packaging smoke check**

Run:

```bash
./macos/build.command
```

Expected:

- Command exits 0.
- `dist/macos/黄金矿工.app/Contents/Resources/index.html` exists.
- `dist/macos/黄金矿工.app/Contents/Resources/game.js` exists.
- `dist/macos/黄金矿工.app/Contents/Resources/audio.js` exists.

This check only verifies the bundle can be built with the unchanged runtime entry. It does not require launching the GUI app.

- [ ] **Step 5: Final code review**

Review for:

- No gameplay value changes in `game.js`.
- New modules are pure.
- Tests do not rely on network access.
- Baseline fixture is valid JSON.
- `.gitignore` does not hide source files.
- Because this repository has no initial commit, protected-file history is not provable from Git. Treat current invariant checks and verification results as the evidence for unchanged runtime behavior.

Expected:

- Approved or list specific issues to fix before completing the batch.
