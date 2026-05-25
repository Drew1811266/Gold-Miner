# Hook Trail Renderer Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the concrete hook trail Canvas drawing out of `game.js` into a focused, tested render module.

**Architecture:** This is a narrow Batch 6 concrete renderer follow-up. `src/render/hookTrailRenderer.js` owns the trail glow drawing algorithm. `game.js` keeps hook state, attached item lookup, color selection, and the `drawHookTrail(hook)` runtime wrapper with bridge fallback.

**Tech Stack:** Browser JavaScript, ES modules, Canvas 2D, Node built-in test runner, runtime bridge namespace.

---

## Status

Completed.

## Scope

Move only the concrete hook trail drawing:

- Trail segment iteration.
- Glow and white-highlight strokes.
- Trail life/alpha/width calculations.

Do not move:

- `drawHook()` rope/claw geometry.
- `drawCarryLabel()` label panel geometry.
- Hook physics, trail point creation/aging, attached item lookup, or item color rules.
- Player layer orchestration already owned by `src/render/hookLayerRenderer.js`.

## Files

- Create: `src/render/hookTrailRenderer.js`
- Create: `tests/unit/hook-trail-renderer.test.mjs`
- Modify: `src/runtime/moduleBridge.js`
- Modify: `tests/unit/runtime-bridge.test.mjs`
- Modify: `game.js`
- Modify: `tests/unit/source-invariants.test.mjs`
- Modify: `docs/architecture-optimization-plan.md`
- Modify: `docs/superpowers/plans/2026-05-24-architecture-next-batches.md`
- Modify: `progress.md`

## API

`src/render/hookTrailRenderer.js` exports:

```js
export function drawHookTrailLayer({ ctx, trail, color, life } = {}) {}
```

Rules:

- `ctx` is the Canvas 2D-like drawing context.
- `trail` is an array of `{ x, y, age }` points.
- `color` defaults to `"rgba(255,255,255,0.85)"`.
- `life` defaults to `0.55` and must be positive.
- Return the number of trail segments drawn.
- Do not mutate `trail`.
- No `window`, `document`, global `game`, audio, hook state mutation, or item lookup in the module.

## Task 1: Add Hook Trail Renderer Module

**Files:**
- Create: `src/render/hookTrailRenderer.js`
- Create: `tests/unit/hook-trail-renderer.test.mjs`

- [ ] **Step 1: Write failing unit tests**

Create `tests/unit/hook-trail-renderer.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { drawHookTrailLayer } from "../../src/render/hookTrailRenderer.js";

function createFakeCtx() {
  const calls = [];

  return {
    calls,
    save() {
      calls.push(["save"]);
    },
    restore() {
      calls.push(["restore"]);
    },
    beginPath() {
      calls.push(["beginPath"]);
    },
    moveTo(...args) {
      calls.push(["moveTo", ...args]);
    },
    lineTo(...args) {
      calls.push(["lineTo", ...args]);
    },
    stroke() {
      calls.push(["stroke"]);
    },
    set globalCompositeOperation(value) {
      calls.push(["globalCompositeOperation", value]);
    },
    set lineCap(value) {
      calls.push(["lineCap", value]);
    },
    set lineJoin(value) {
      calls.push(["lineJoin", value]);
    },
    set globalAlpha(value) {
      calls.push(["globalAlpha", value]);
    },
    set strokeStyle(value) {
      calls.push(["strokeStyle", value]);
    },
    set lineWidth(value) {
      calls.push(["lineWidth", value]);
    },
  };
}

test("drawHookTrailLayer draws glow and highlight strokes for each segment", () => {
  const ctx = createFakeCtx();
  const trail = [
    { x: 10, y: 20, age: 0 },
    { x: 14, y: 24, age: 0.1 },
    { x: 20, y: 30, age: 0.2 },
  ];

  const segments = drawHookTrailLayer({
    ctx,
    trail,
    color: "#ffcc00",
    life: 0.5,
  });

  assert.equal(segments, 2);
  assert.equal(ctx.calls[0][0], "save");
  assert.ok(ctx.calls.some((call) => call[0] === "globalCompositeOperation" && call[1] === "lighter"));
  assert.ok(ctx.calls.some((call) => call[0] === "lineCap" && call[1] === "round"));
  assert.ok(ctx.calls.some((call) => call[0] === "lineJoin" && call[1] === "round"));
  assert.equal(ctx.calls.filter((call) => call[0] === "stroke").length, 4);
  assert.equal(ctx.calls.filter((call) => call[0] === "strokeStyle" && call[1] === "#ffcc00").length, 2);
  assert.equal(
    ctx.calls.filter((call) => call[0] === "strokeStyle" && call[1] === "rgba(255,255,255,0.9)").length,
    2,
  );
  assert.deepEqual(ctx.calls.filter((call) => call[0] === "moveTo").slice(0, 2), [
    ["moveTo", 10, 20],
    ["moveTo", 10, 20],
  ]);
  assert.equal(ctx.calls.at(-1)[0], "restore");
});

test("drawHookTrailLayer returns zero for trails shorter than two points", () => {
  const ctx = createFakeCtx();

  assert.equal(drawHookTrailLayer({ ctx, trail: [] }), 0);
  assert.equal(drawHookTrailLayer({ ctx, trail: [{ x: 1, y: 2, age: 0 }] }), 0);
  assert.deepEqual(ctx.calls, []);
});

test("drawHookTrailLayer clamps expired points and does not mutate input trail", () => {
  const ctx = createFakeCtx();
  const trail = [
    { x: 0, y: 0, age: 2 },
    { x: 10, y: 10, age: 0 },
  ];
  const original = trail.map((point) => ({ ...point }));

  const segments = drawHookTrailLayer({ ctx, trail, life: 0.55 });

  assert.equal(segments, 1);
  assert.deepEqual(trail, original);
  assert.ok(ctx.calls.some((call) => call[0] === "globalAlpha" && call[1] === 0));
  assert.ok(ctx.calls.some((call) => call[0] === "lineWidth" && call[1] === 1.2));
});

test("drawHookTrailLayer rejects invalid structural inputs", () => {
  assert.throws(() => drawHookTrailLayer({ ctx: null, trail: [] }), /ctx/);
  assert.throws(() => drawHookTrailLayer({ ctx: createFakeCtx(), trail: null }), /trail must be an array/);
  assert.throws(
    () => drawHookTrailLayer({ ctx: createFakeCtx(), trail: [], color: "" }),
    /color must be a non-empty string/,
  );
  assert.throws(() => drawHookTrailLayer({ ctx: createFakeCtx(), trail: [], life: 0 }), /life/);
  assert.throws(
    () =>
      drawHookTrailLayer({
        ctx: createFakeCtx(),
        trail: [
          { x: 0, y: 0, age: 0 },
          { x: Number.NaN, y: 10, age: 0 },
        ],
      }),
    /trail\[1\]\.x/,
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/unit/hook-trail-renderer.test.mjs
```

Expected: fail with module-not-found for `src/render/hookTrailRenderer.js`.

- [ ] **Step 3: Implement the module**

Create `src/render/hookTrailRenderer.js`:

```js
import { clamp, lerp } from "../core/geometry.js";

const DEFAULT_TRAIL_COLOR = "rgba(255,255,255,0.85)";
const DEFAULT_TRAIL_LIFE = 0.55;

function assertObject(value, name) {
  if (value === null || typeof value !== "object") {
    throw new TypeError(`${name} must be an object`);
  }
}

function assertMethod(value, methodName, ownerName) {
  if (typeof value?.[methodName] !== "function") {
    throw new TypeError(`${ownerName}.${methodName} must be a function`);
  }
}

function assertFiniteNumber(value, name) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
}

function assertPositiveNumber(value, name) {
  assertFiniteNumber(value, name);
  if (value <= 0) {
    throw new RangeError(`${name} must be greater than zero`);
  }
}

function assertColor(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}

function validateCtx(ctx) {
  assertObject(ctx, "drawHookTrailLayer ctx");
  for (const methodName of ["save", "restore", "beginPath", "moveTo", "lineTo", "stroke"]) {
    assertMethod(ctx, methodName, "ctx");
  }
}

function validateTrailPoint(point, index) {
  assertObject(point, `drawHookTrailLayer trail[${index}]`);
  assertFiniteNumber(point.x, `drawHookTrailLayer trail[${index}].x`);
  assertFiniteNumber(point.y, `drawHookTrailLayer trail[${index}].y`);
  assertFiniteNumber(point.age, `drawHookTrailLayer trail[${index}].age`);
}

export function drawHookTrailLayer({ ctx, trail, color = DEFAULT_TRAIL_COLOR, life = DEFAULT_TRAIL_LIFE } = {}) {
  validateCtx(ctx);
  if (!Array.isArray(trail)) {
    throw new TypeError("drawHookTrailLayer trail must be an array");
  }
  assertColor(color, "drawHookTrailLayer color");
  assertPositiveNumber(life, "drawHookTrailLayer life");

  if (trail.length < 2) return 0;

  for (let i = 0; i < trail.length; i += 1) {
    validateTrailPoint(trail[i], i);
  }

  ctx.save();
  try {
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
  } finally {
    ctx.restore();
  }

  return trail.length - 1;
}
```

- [ ] **Step 4: Run module tests**

Run:

```bash
node --test tests/unit/hook-trail-renderer.test.mjs
```

Expected: 4 pass, 0 fail.

## Task 2: Expose Hook Trail Renderer Through Runtime Bridge

**Files:**
- Modify: `src/runtime/moduleBridge.js`
- Modify: `tests/unit/runtime-bridge.test.mjs`

- [ ] **Step 1: Update bridge test**

In `tests/unit/runtime-bridge.test.mjs`, add this key near other render exports:

```js
"drawHookTrailLayer",
```

Add this assertion near other renderer type assertions:

```js
assert.equal(typeof modules.drawHookTrailLayer, "function");
```

- [ ] **Step 2: Run bridge test to verify it fails**

Run:

```bash
node --test tests/unit/runtime-bridge.test.mjs
```

Expected: fail because bridge does not expose `drawHookTrailLayer` yet.

- [ ] **Step 3: Update bridge implementation**

In `src/runtime/moduleBridge.js`, import:

```js
import { drawHookTrailLayer } from "../render/hookTrailRenderer.js";
```

Expose it in `GoldMinerModules` near the hook layer helpers:

```js
drawHookTrailLayer,
```

- [ ] **Step 4: Run bridge and hook trail tests**

Run:

```bash
node --test tests/unit/hook-trail-renderer.test.mjs tests/unit/runtime-bridge.test.mjs
```

Expected: all pass.

## Task 3: Route `game.js` Hook Trail Through Bridge-First Renderer

**Files:**
- Modify: `game.js`
- Modify: `tests/unit/source-invariants.test.mjs`

- [ ] **Step 1: Update source invariant expectations**

Add a new test after the hook player layer test:

```js
test("game hook trail drawing prefers bridge renderer while keeping hook state local", () => {
  const source = read("game.js");
  const hookTrailOptionsBody = extractFunctionBody(source, "hookTrailLayerOptions");
  const localHookTrailBody = extractFunctionBody(source, "drawHookTrailWithLocalLayer");
  const drawHookTrailBody = extractFunctionBody(source, "drawHookTrail");

  assert.match(source, /let hookTrailLayerBridgeDisabled = false;/);
  assert.match(source, /function hookTrailLayerOptions\(hook = game\.hook\)/);
  assert.match(source, /function drawHookTrailWithLocalLayer\(options = hookTrailLayerOptions\(\)\)/);

  assert.match(hookTrailOptionsBody, /const item = attachedItem\(hook\)/);
  assert.match(hookTrailOptionsBody, /trail: hook\.trail/);
  assert.match(hookTrailOptionsBody, /color: item \? itemFxColor\(item\) : "rgba\(255,255,255,0\.85\)"/);
  assert.match(hookTrailOptionsBody, /life: 0\.55/);
  assert.match(localHookTrailBody, /globalCompositeOperation = "lighter"/);
  assert.match(localHookTrailBody, /lineWidth = lerp\(1\.2, 6\.0, t\)/);
  assert.match(drawHookTrailBody, /GoldMinerModules\.drawHookTrailLayer\(options\)/);
  assert.match(drawHookTrailBody, /hookTrailLayerBridgeDisabled = true/);
  assert.match(drawHookTrailBody, /window\.__goldMinerHookTrailRendererError =/);
  assert.match(drawHookTrailBody, /drawHookTrailWithLocalLayer\(options\)/);
  assert.doesNotMatch(drawHookTrailBody, /for \(let i = 0; i < trail\.length - 1; i \+= 1\)/);
});
```

- [ ] **Step 2: Run source invariant test to verify it fails**

Run:

```bash
node --test tests/unit/source-invariants.test.mjs
```

Expected: fail because `game.js` does not yet have hook trail renderer wrapper.

- [ ] **Step 3: Add runtime wrapper**

In `game.js`, add a bridge disabled flag near the other render flags:

```js
let hookTrailLayerBridgeDisabled = false;
```

Replace the existing body of `drawHookTrail(hook = game.hook)` with a wrapper and move the previous concrete body into `drawHookTrailWithLocalLayer(options = hookTrailLayerOptions())`:

```js
function hookTrailLayerOptions(hook = game.hook) {
  const item = attachedItem(hook);
  return {
    ctx,
    trail: hook.trail,
    color: item ? itemFxColor(item) : "rgba(255,255,255,0.85)",
    life: 0.55,
  };
}

function drawHookTrailWithLocalLayer(options = hookTrailLayerOptions()) {
  const { trail, color, life } = options;
  if (trail.length < 2) return 0;

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
  return trail.length - 1;
}

function drawHookTrail(hook = game.hook) {
  const options = hookTrailLayerOptions(hook);

  if (!hookTrailLayerBridgeDisabled && GoldMinerModules.drawHookTrailLayer) {
    try {
      return GoldMinerModules.drawHookTrailLayer(options);
    } catch (error) {
      hookTrailLayerBridgeDisabled = true;
      if (!Object.prototype.hasOwnProperty.call(window, "__goldMinerHookTrailRendererError")) {
        window.__goldMinerHookTrailRendererError = error instanceof Error ? error.message : String(error);
      }
      console.warn("Gold Miner hook trail renderer failed; using local hook trail fallback.", error);
    }
  }

  return drawHookTrailWithLocalLayer(options);
}
```

- [ ] **Step 4: Run targeted tests**

Run:

```bash
node --test tests/unit/hook-trail-renderer.test.mjs tests/unit/runtime-bridge.test.mjs tests/unit/source-invariants.test.mjs
```

Expected: all pass.

## Task 4: Documentation And Verification

**Files:**
- Modify: `docs/architecture-optimization-plan.md`
- Modify: `docs/superpowers/plans/2026-05-24-architecture-next-batches.md`
- Modify: `progress.md`

- [ ] **Step 1: Update progress**

Append to `progress.md`:

```markdown
- 架构 Batch 6 follow-up：新增 `src/render/hookTrailRenderer.js`，`drawHookTrail()` 现在优先通过 bridge renderer 绘制钩索轨迹，异常时一次性熔断并回退本地绘制。hook trail 点生成、attached item 颜色选择以及 `drawHook()` / `drawCarryLabel()` 仍在 `game.js`。
```

- [ ] **Step 2: Update architecture docs**

In `docs/architecture-optimization-plan.md` and `docs/superpowers/plans/2026-05-24-architecture-next-batches.md`, mark this Batch 6 follow-up as completed and list `src/render/hookTrailRenderer.js` under completed render modules. Update remaining concrete renderer risk to remove hook trail from the remaining list.

- [ ] **Step 3: Run final verification**

Run:

```bash
node --test tests/unit/hook-trail-renderer.test.mjs tests/unit/runtime-bridge.test.mjs tests/unit/source-invariants.test.mjs
npm run verify
./macos/build.command
```

Expected:

- Targeted test command exits 0.
- `npm run verify` exits 0.
- macOS build exits 0 and generates `dist/macos/黄金矿工.app`.

- [ ] **Step 4: Browser smoke**

Use `http://127.0.0.1:5173/?seed=12345`:

- Start single-player mode.
- Fire the hook.
- Confirm `GoldMinerModules.drawHookTrailLayer` exists.
- Confirm no `window.__goldMinerHookTrailRendererError`.
- Confirm no console error/warn.
- Visually inspect a gameplay screenshot while the hook has been fired or recently moved.

## Completion Boundary

This batch is complete when `drawHookTrail()` delegates the preferred drawing path to `src/render/hookTrailRenderer.js`, local fallback remains available, hook trail visuals still render in browser smoke, and `drawHook()` / `drawCarryLabel()` remain local.

## Completion Notes

- `src/render/hookTrailRenderer.js` provides `drawHookTrailLayer()`.
- `GoldMinerModules` exposes `drawHookTrailLayer()` through `src/runtime/moduleBridge.js`.
- `game.js` keeps hook state, attached item lookup, and item color selection local in `hookTrailLayerOptions()`.
- `drawHookTrail()` is now a bridge-first wrapper with one-shot fallback latch and `window.__goldMinerHookTrailRendererError` diagnostics.
- The local fallback now honors `options.ctx` and mirrors the bridge renderer's `save(); try { ... } finally { restore(); }` canvas-state safety.
- Final verification passed with `npm run verify` at 98/98 tests and `./macos/build.command`.
- Browser smoke confirmed `window.__goldMinerModulesReady === true`, `GoldMinerModules.drawHookTrailLayer` exists, no hook trail renderer error was recorded, console warnings/errors were empty, and gameplay canvas output was visually inspected.
