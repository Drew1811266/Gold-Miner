# Runtime Module Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the running game toward the pure modules extracted in Batch 1 without switching the full runtime to `src/main.js`.

**Architecture:** Keep `audio.js` and `game.js` as the active entry scripts. Add a dynamic module bridge that exposes tested `src/` modules to the legacy runtime through one namespace, then convert selected `game.js` functions into wrappers that call the bridge when available and fall back to legacy logic when direct file loading blocks modules.

**Tech Stack:** Browser JavaScript, ES modules loaded through dynamic `import()`, Node built-in test runner, Canvas 2D, Swift WebView macOS wrapper.

---

## Batch Boundary

This is Batch 2 after the completed Architecture Foundation batch.

This batch should:

- Add `src/runtime/moduleBridge.js`.
- Let `game.js` use Batch 1 modules at runtime when module loading is available.
- Preserve direct file launch behavior through legacy fallbacks.
- Preserve the current `index.html` classic script entry.
- Update macOS packaging so `src/` is present in the app bundle.
- Add tests that protect bridge shape, entry script order, build packaging, and runtime wrapper intent.

This batch must not:

- Replace `game.js` with `src/main.js`.
- Convert `game.js` to `type="module"`.
- Move rendering, input, level generation, or state ownership yet.
- Change gameplay rules, balance values, item placement policy, or UI copy.
- Remove legacy fallback implementations that are still needed for direct file launch.

---

## Key Design Decision

Do not add this to `index.html` in this batch:

```html
<script type="module" src="./src/runtime/moduleBridge.js"></script>
```

Reason: module scripts are deferred by default. A following classic `game.js` script may execute before the module bridge has finished, which makes bridge readiness timing fragile.

Instead, `game.js` should load the bridge explicitly:

```js
await loadGoldMinerModules();
```

inside `boot()`, before UI initialization and level start. If dynamic import fails, the game continues with legacy local functions.

This keeps direct file launch safer while allowing browser/server and macOS WebView runs to consume the shared modules.

---

## Task 1: Add Runtime Bridge Module

**Files:**

- Create: `src/runtime/moduleBridge.js`
- Create: `tests/unit/runtime-bridge.test.mjs`
- Verify: `src/core/rng.js`
- Verify: `src/core/geometry.js`
- Verify: `src/config/balance.js`
- Verify: `src/systems/marketSystem.js`
- Verify: `src/systems/ddaSystem.js`

### Steps

- [ ] **Step 1: Add failing unit test for the bridge namespace**

Create `tests/unit/runtime-bridge.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";

test("runtime bridge exports and installs the expected namespace", async () => {
  delete globalThis.GoldMinerModules;

  const bridge = await import("../../src/runtime/moduleBridge.js");
  const modules = bridge.installGoldMinerModules(globalThis);

  assert.equal(modules, bridge.GoldMinerModules);
  assert.equal(globalThis.GoldMinerModules, bridge.GoldMinerModules);

  for (const key of [
    "clamp",
    "lerp",
    "dist2",
    "segmentCircleIntersect",
    "createRng",
    "formatMarketDelta",
    "createMarketDay",
    "ddaStage",
    "ddaBaseDifficulty",
    "ddaOverSignal",
    "postLevel4Pressure",
    "computeDdaTuning",
    "updateDdaRating",
    "MARKET_COMMODITIES",
    "MARKET_DAY_NAMES",
  ]) {
    assert.ok(key in modules, `GoldMinerModules should expose ${key}`);
  }

  assert.equal(modules.clamp(5, 1, 3), 3);
  assert.equal(modules.formatMarketDelta(1), "±0%");
  assert.equal(modules.ddaStage(4), 1);
});

test("runtime bridge exposes deterministic shared RNG", async () => {
  const { GoldMinerModules } = await import("../../src/runtime/moduleBridge.js");

  const a = GoldMinerModules.createRng(12345);
  const b = GoldMinerModules.createRng(12345);

  assert.equal(a.next(), b.next());
  assert.equal(a.range(10, 20), b.range(10, 20));
});
```

- [ ] **Step 2: Run the targeted test and verify it fails**

Run:

```bash
node --test tests/unit/runtime-bridge.test.mjs
```

Expected:

- FAIL because `src/runtime/moduleBridge.js` does not exist yet.

- [ ] **Step 3: Create `src/runtime/moduleBridge.js`**

Create:

```js
import {
  DDA_BASE_MAX,
  DDA_BASE_PER_STAGE,
  DDA_INERTIA,
  DDA_OVER_FOR_MAX_SIGNAL,
  DDA_STAGE_SIZE,
  MARKET_COMMODITIES,
  MARKET_DAY_NAMES,
  POST_LEVEL4_RAMP_LEVELS,
  POST_LEVEL4_START_LEVEL,
} from "../config/balance.js";
import { clamp, dist2, lerp, segmentCircleIntersect } from "../core/geometry.js";
import { createRng } from "../core/rng.js";
import {
  computeDdaTuning,
  ddaBaseDifficulty,
  ddaOverSignal,
  ddaStage,
  postLevel4Pressure,
  updateDdaRating,
} from "../systems/ddaSystem.js";
import { createMarketDay, formatMarketDelta } from "../systems/marketSystem.js";

export const GoldMinerModules = Object.freeze({
  clamp,
  lerp,
  dist2,
  segmentCircleIntersect,
  createRng,
  formatMarketDelta,
  createMarketDay,
  ddaStage,
  ddaBaseDifficulty,
  ddaOverSignal,
  postLevel4Pressure,
  computeDdaTuning,
  updateDdaRating,
  DDA_STAGE_SIZE,
  DDA_BASE_PER_STAGE,
  DDA_BASE_MAX,
  DDA_OVER_FOR_MAX_SIGNAL,
  DDA_INERTIA,
  POST_LEVEL4_START_LEVEL,
  POST_LEVEL4_RAMP_LEVELS,
  MARKET_COMMODITIES,
  MARKET_DAY_NAMES,
});

export function installGoldMinerModules(target = globalThis) {
  target.GoldMinerModules = GoldMinerModules;
  return GoldMinerModules;
}

installGoldMinerModules(globalThis);
```

- [ ] **Step 4: Run the bridge test and full verification**

Run:

```bash
node --test tests/unit/runtime-bridge.test.mjs
npm run verify
```

Expected:

- `runtime-bridge.test.mjs` passes.
- `npm run verify` passes.

---

## Task 2: Wire `game.js` To The Runtime Bridge

**Files:**

- Modify: `game.js`
- Modify: `tests/unit/source-invariants.test.mjs`
- Test: `tests/unit/source-invariants.test.mjs`

### Steps

- [ ] **Step 1: Add source invariant tests for bridge loading and wrappers**

Append these tests to `tests/unit/source-invariants.test.mjs`:

```js
test("game dynamically loads the runtime module bridge before boot", () => {
  const source = read("game.js");

  assert.match(source, /let GoldMinerModules = window\.GoldMinerModules \?\? \{\};/);
  assert.match(source, /async function loadGoldMinerModules\(\)/);
  assert.match(source, /import\("\.\/src\/runtime\/moduleBridge\.js"\)/);
  assert.match(source, /await loadGoldMinerModules\(\);/);
});

test("game wrappers prefer runtime bridge modules when available", () => {
  const source = read("game.js");

  for (const key of [
    "clamp",
    "lerp",
    "dist2",
    "segmentCircleIntersect",
    "createRng",
    "formatMarketDelta",
    "createMarketDay",
    "computeDdaTuning",
    "updateDdaRating",
  ]) {
    assert.match(source, new RegExp(`GoldMinerModules\\.${key}`), `game.js should reference ${key} from bridge`);
  }
});
```

- [ ] **Step 2: Run targeted test and verify it fails**

Run:

```bash
node --test tests/unit/source-invariants.test.mjs
```

Expected:

- FAIL because `game.js` does not have the bridge loader or wrapper references yet.

- [ ] **Step 3: Add bridge loader near the top of `game.js`**

After:

```js
const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
```

add:

```js
let GoldMinerModules = window.GoldMinerModules ?? {};

async function loadGoldMinerModules() {
  if (window.GoldMinerModules) {
    GoldMinerModules = window.GoldMinerModules;
    window.__goldMinerModulesReady = true;
    return GoldMinerModules;
  }

  try {
    const bridge = await import("./src/runtime/moduleBridge.js");
    GoldMinerModules =
      bridge.installGoldMinerModules?.(window) ?? bridge.GoldMinerModules ?? window.GoldMinerModules ?? {};
    window.__goldMinerModulesReady = true;
  } catch (error) {
    GoldMinerModules = {};
    window.__goldMinerModulesReady = false;
    window.__goldMinerModulesError = error instanceof Error ? error.message : String(error);
    console.warn("Gold Miner module bridge unavailable; using legacy runtime helpers.", error);
  }

  return GoldMinerModules;
}
```

- [ ] **Step 4: Convert low-level helpers to bridge-first wrappers**

Replace the local implementations of `clamp`, `lerp`, `dist2`, `segmentCircleIntersect`, and `createRng` with bridge-first wrappers:

```js
function clamp(value, min, max) {
  return GoldMinerModules.clamp
    ? GoldMinerModules.clamp(value, min, max)
    : Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return GoldMinerModules.lerp ? GoldMinerModules.lerp(a, b, t) : a + (b - a) * t;
}

function dist2(ax, ay, bx, by) {
  if (GoldMinerModules.dist2) return GoldMinerModules.dist2(ax, ay, bx, by);
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function segmentCircleIntersect(ax, ay, bx, by, cx, cy, radius) {
  if (GoldMinerModules.segmentCircleIntersect) {
    return GoldMinerModules.segmentCircleIntersect(ax, ay, bx, by, cx, cy, radius);
  }

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
  if (GoldMinerModules.createRng) return GoldMinerModules.createRng(seed);

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

- [ ] **Step 5: Convert market and DDA helpers to bridge-first wrappers**

Update these functions while preserving legacy fallback bodies:

```js
function formatMarketDelta(multiplier) {
  if (GoldMinerModules.formatMarketDelta) return GoldMinerModules.formatMarketDelta(multiplier);
  const pct = Math.round((multiplier - 1) * 100);
  if (pct > 0) return `↑${pct}%`;
  if (pct < 0) return `↓${Math.abs(pct)}%`;
  return "±0%";
}

function createMarketDay(rng) {
  if (GoldMinerModules.createMarketDay) return GoldMinerModules.createMarketDay(rng);

  const multipliers = {};
  const entries = [];
  for (const cfg of MARKET_COMMODITIES) {
    let value = rng.range(cfg.min, cfg.max);
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

Update DDA wrappers:

```js
function ddaStage(level) {
  if (GoldMinerModules.ddaStage) return GoldMinerModules.ddaStage(level);
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  return Math.floor((lv - 1) / DDA_STAGE_SIZE);
}

function ddaBaseDifficulty(level) {
  if (GoldMinerModules.ddaBaseDifficulty) return GoldMinerModules.ddaBaseDifficulty(level);
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  const stage = ddaStage(lv);
  const within = (lv - 1) - stage * DDA_STAGE_SIZE;
  const withinFrac = DDA_STAGE_SIZE <= 1 ? 0 : within / (DDA_STAGE_SIZE - 1);
  const base = stage * DDA_BASE_PER_STAGE + withinFrac * (DDA_BASE_PER_STAGE * 0.5);
  return clamp(base, 0, DDA_BASE_MAX);
}

function ddaOverSignal(overRatio) {
  if (GoldMinerModules.ddaOverSignal) return GoldMinerModules.ddaOverSignal(overRatio);
  const r = Number.isFinite(overRatio) ? overRatio : 0;
  return clamp(r / DDA_OVER_FOR_MAX_SIGNAL, -1, 1);
}

function postLevel4Pressure(level) {
  if (GoldMinerModules.postLevel4Pressure) return GoldMinerModules.postLevel4Pressure(level);
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  if (lv < POST_LEVEL4_START_LEVEL) return 0;
  const stepsPast = lv - POST_LEVEL4_START_LEVEL;
  const ramp = clamp(stepsPast / POST_LEVEL4_RAMP_LEVELS, 0, 1);
  return clamp(0.22 + ramp * 0.78, 0, 1);
}

function computeDdaTuning(level) {
  if (GoldMinerModules.computeDdaTuning) {
    return GoldMinerModules.computeDdaTuning(level, game.dda?.rating ?? 0);
  }

  const base = ddaBaseDifficulty(level);
  const rating = clamp(game.dda?.rating ?? 0, -1, 1);
  const hard = clamp(rating, 0, 1);
  const ease = clamp(-rating, 0, 1);
  const post4Pressure = postLevel4Pressure(level);

  const difficulty = clamp(base + rating * 0.22 + post4Pressure * 0.12, 0, 1);
  const targetMul = clamp(1 + base * 0.18 + hard * 0.28 - ease * 0.08 + post4Pressure * 0.24, 0.9, 1.75);
  const timeMul = clamp(1 - base * 0.08 - hard * 0.14 + ease * 0.08 - post4Pressure * 0.18, 0.68, 1.18);

  const mixDiff = clamp(base * 0.85 + hard * 0.95 - ease * 0.25 + post4Pressure * 0.55, 0, 1);
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

  const mouseSpeedMul = lerp(1, 1.35, difficulty) * lerp(1, 1.18, post4Pressure);
  const mouseMax = clamp(1 + Math.round(difficulty * (MOUSE_MAX_PER_LEVEL - 1)), 1, MOUSE_MAX_PER_LEVEL);

  return {
    stage: ddaStage(level),
    base,
    rating,
    post4Pressure,
    difficulty,
    targetMul,
    timeMul,
    mixMul,
    mouseSpeedMul,
    mouseMax,
  };
}
```

- [ ] **Step 6: Route DDA rating update through the shared module**

At the top of `updateDdaAfterLevel()`, before legacy calculation, add:

```js
  if (GoldMinerModules.updateDdaRating) {
    const next = GoldMinerModules.updateDdaRating({
      currentRating: game.dda.rating,
      score: game.score,
      target: game.target,
      levelTimeTotal: game.dda.levelTimeTotal,
      firstClearTimeLeft: game.dda.firstClearTimeLeft,
    });
    game.dda.rating = next.rating;
    game.dda.lastOverRatio = next.lastOverRatio;
    game.dda.lastSignal = next.lastSignal;
    return;
  }
```

- [ ] **Step 7: Make `boot()` wait for the bridge**

Change:

```js
function boot() {
```

to:

```js
async function boot() {
  await loadGoldMinerModules();
```

Keep the final call as:

```js
boot();
```

Do not block direct file launch if dynamic import fails; `loadGoldMinerModules()` handles fallback.

- [ ] **Step 8: Run verification**

Run:

```bash
node --check game.js
node --test tests/unit/source-invariants.test.mjs
npm run verify
```

Expected:

- All commands pass.

---

## Task 3: Preserve Entry Contract And Package `src/`

**Files:**

- Modify: `macos/build.command`
- Modify: `tests/unit/source-invariants.test.mjs`
- Verify: `index.html`

### Steps

- [ ] **Step 1: Add tests for unchanged entry and `src/` packaging**

Update `tests/unit/source-invariants.test.mjs` so the entry test asserts:

```js
  assert.equal(
    scripts.some(({ src, type }) => src === "./src/runtime/moduleBridge.js" && isModuleScript({ type })),
    false,
    "index.html should not use a deferred module bridge script before game.js",
  );
```

Append:

```js
test("macOS build copies src modules into the app bundle", () => {
  const source = read("macos/build.command");

  assert.match(source, /cp -R "\$ROOT_DIR\/src" "\$APP_DIR\/Contents\/Resources\/src"/);
});
```

- [ ] **Step 2: Run targeted test and verify it fails**

Run:

```bash
node --test tests/unit/source-invariants.test.mjs
```

Expected:

- FAIL because `macos/build.command` does not copy `src/` yet.

- [ ] **Step 3: Update `macos/build.command`**

After:

```zsh
cp "$ROOT_DIR/audio.js" "$APP_DIR/Contents/Resources/audio.js"
```

add:

```zsh
cp -R "$ROOT_DIR/src" "$APP_DIR/Contents/Resources/src"
```

- [ ] **Step 4: Run verification and macOS build**

Run:

```bash
npm run verify
./macos/build.command
test -f "dist/macos/黄金矿工.app/Contents/Resources/src/runtime/moduleBridge.js"
```

Expected:

- `npm run verify` passes.
- macOS app builds.
- The module bridge file exists inside the app bundle resources.

---

## Task 4: Runtime Smoke Verification

**Files:**

- No production source changes expected.
- Optional test-only helper files may be created only if needed.

### Steps

- [ ] **Step 1: Start a local static server for module-capable runtime verification**

Run:

```bash
python3 -m http.server 8765
```

Expected:

- Server listens on `http://127.0.0.1:8765`.

- [ ] **Step 2: Open the game with a fixed seed**

Use browser automation to open:

```text
http://127.0.0.1:8765/index.html?seed=12345
```

- [ ] **Step 3: Verify bridge readiness and baseline hooks**

Evaluate in the page:

```js
({
  ready: window.__goldMinerModulesReady,
  hasNamespace: !!window.GoldMinerModules,
  hasCreateRng: typeof window.GoldMinerModules?.createRng === "function",
  hasRenderText: typeof window.render_game_to_text === "function",
  hasAdvanceTime: typeof window.advanceTime === "function",
})
```

Expected:

```js
{
  ready: true,
  hasNamespace: true,
  hasCreateRng: true,
  hasRenderText: true,
  hasAdvanceTime: true,
}
```

- [ ] **Step 4: Start a single-player game and advance time**

Use browser automation to click the start button, select single player, then evaluate:

```js
await window.advanceTime(1000);
JSON.parse(window.render_game_to_text());
```

Expected:

- No exception.
- Returned payload has `phase`, `level`, `score`, `target`, `market`, `dda`, and `hooks`.

- [ ] **Step 5: Stop the local static server**

Stop the `python3 -m http.server 8765` process before final response unless intentionally leaving a dev server running for the user.

---

## Task 5: Documentation And Final Review

**Files:**

- Modify: `docs/architecture-optimization-plan.md`
- Modify: `docs/superpowers/plans/2026-05-24-architecture-next-batches.md`
- Verify all files changed by Tasks 1-4.

### Steps

- [ ] **Step 1: Update architecture batch record**

Append this section after the Batch 1 record in `docs/architecture-optimization-plan.md`:

```markdown
### Batch 2：Runtime Module Bridge

状态：已完成。

目标：

- 让运行中的 `game.js` 开始消费 Batch 1 抽离出的纯模块。
- 保留当前 `audio.js` + `game.js` 经典脚本入口。
- 避免 deferred module script 与经典脚本之间的加载时序风险。
- 保留直接打开 HTML 时的 legacy fallback。

完成内容：

- 新增 `src/runtime/moduleBridge.js`，统一导出 `window.GoldMinerModules`。
- `game.js` 在 `boot()` 前动态导入 module bridge。
- `clamp`、`lerp`、`dist2`、`segmentCircleIntersect`、`createRng`、行情、DDA 等低风险逻辑优先走 bridge。
- `macos/build.command` 复制 `src/` 到 App Resources。
- 新增 bridge 单元测试、入口不变性测试和构建资源测试。

边界：

- 未切换到 `src/main.js`。
- 未拆分渲染、输入、状态或关卡生成。
- 未删除所有 legacy fallback，因为直接文件打开仍需要安全回退。

后续风险：

- 顶层初始化期间执行的少量逻辑仍可能在 bridge 加载前走 fallback。Batch 3 之后应继续缩小顶层副作用。
- Batch 3 必须继续把关卡生成迁移到 `src/systems/levelGenerator.js`，减少 `game.js` 对 legacy helper 的依赖。
```

- [ ] **Step 2: Update next-batches plan**

In `docs/superpowers/plans/2026-05-24-architecture-next-batches.md`, update Batch 2 to say:

- Completed.
- The chosen approach was dynamic import from `game.js`, not a module script in `index.html`.
- Batch 3 is now the next recommended batch.

- [ ] **Step 3: Run final local verification**

Run:

```bash
npm run verify
./macos/build.command
test -f "dist/macos/黄金矿工.app/Contents/Resources/src/runtime/moduleBridge.js"
rg -n "type=\"module\"|src=\"./src/main.js\"|src=\"./game.js\"|src=\"./audio.js\"|moduleBridge" index.html game.js macos/build.command
```

Expected:

- Tests pass.
- macOS app builds.
- `src/runtime/moduleBridge.js` exists in bundle.
- `index.html` still references `./audio.js` and `./game.js`.
- `index.html` does not reference `./src/main.js`.
- `game.js` references dynamic `./src/runtime/moduleBridge.js`.

- [ ] **Step 4: Final subagent review**

Dispatch a final code-reviewer subagent with this scope:

- Verify Batch 2 does not change gameplay rules.
- Verify bridge load timing is safe.
- Verify direct file fallback remains.
- Verify macOS packaging includes `src/`.
- Verify tests cover the architectural contract.

Expected:

- No P0 or P1 issue.
- P2 issues may be documented if they are intentional Batch 3 follow-ups.
