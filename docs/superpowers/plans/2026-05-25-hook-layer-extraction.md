# Hook Layer Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract hook-related player layer orchestration from `game.js` into a tested render module without moving the large concrete claw geometry yet.

**Architecture:** This is a narrow Batch 6 follow-up. `src/render/hookLayerRenderer.js` owns hook layer call ordering and metadata. `game.js` keeps `drawHookTrail()`, `drawHook()`, and `drawCarryLabel()` as concrete Canvas drawing functions, but routes the three hook-related player layers through bridge-first wrappers with local fallback.

**Tech Stack:** Browser JavaScript, ES modules, Canvas 2D callbacks, Node built-in test runner, runtime bridge namespace.

---

## Status

Completed.

## Scope

Move only hook-layer orchestration:

- `hookTrail`
- `hook`
- `carryLabel`

Do not move:

- `drawHook()` tri-prong claw geometry.
- `drawHookTrail()` particle trail geometry.
- `drawCarryLabel()` panel geometry.
- Hook physics, collision, attached item logic, miner pose, winch rendering, or render frame ordering.

## Files

- Create: `src/render/hookLayerRenderer.js`
- Create: `tests/unit/hook-layer-renderer.test.mjs`
- Modify: `src/runtime/moduleBridge.js`
- Modify: `tests/unit/runtime-bridge.test.mjs`
- Modify: `game.js`
- Modify: `tests/unit/source-invariants.test.mjs`
- Modify: `docs/architecture-optimization-plan.md`
- Modify: `docs/superpowers/plans/2026-05-24-architecture-next-batches.md`
- Modify: `progress.md`

## API

`src/render/hookLayerRenderer.js` exports:

```js
export function drawHookPlayerLayer({ hook, miner, index, layerName, drawHookTrail, drawHook, drawCarryLabel } = {}) {}
export function createHookLayerHandlers({ drawHookTrail, drawHook, drawCarryLabel } = {}) {}
```

Rules:

- Reject invalid `layerName` values.
- Require the exact callback for the requested layer.
- Pass metadata `{ hook, miner, index, layerName }` to callbacks.
- Return the callback return value from `drawHookPlayerLayer()`.
- `createHookLayerHandlers()` returns `{ hookTrail, hook, carryLabel }`.
- Each generated handler delegates to `drawHookPlayerLayer()`.
- No `window`, `document`, global `game`, audio, or direct Canvas usage in the module.

## Task 1: Add Hook Layer Renderer Module

**Files:**
- Create: `src/render/hookLayerRenderer.js`
- Test: `tests/unit/hook-layer-renderer.test.mjs`

- [ ] **Step 1: Write failing unit tests**

Create `tests/unit/hook-layer-renderer.test.mjs` with:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHookLayerHandlers, drawHookPlayerLayer } from "../../src/render/hookLayerRenderer.js";

test("drawHookPlayerLayer delegates hookTrail with hook miner index metadata", () => {
  const calls = [];
  const hook = { id: "h1" };
  const miner = { id: "m1" };

  const result = drawHookPlayerLayer({
    hook,
    miner,
    index: 2,
    layerName: "hookTrail",
    drawHookTrail: (receivedHook, metadata) => {
      calls.push([receivedHook, metadata.hook, metadata.miner, metadata.index, metadata.layerName]);
      return "trail-result";
    },
    drawHook: () => assert.fail("wrong layer"),
    drawCarryLabel: () => assert.fail("wrong layer"),
  });

  assert.equal(result, "trail-result");
  assert.deepEqual(calls, [[hook, hook, miner, 2, "hookTrail"]]);
});

test("drawHookPlayerLayer delegates hook and carryLabel through their own callbacks", () => {
  const hook = { id: "h1" };
  const miner = { id: "m1" };
  const calls = [];

  const hookResult = drawHookPlayerLayer({
    hook,
    miner,
    index: 0,
    layerName: "hook",
    drawHookTrail: () => assert.fail("wrong layer"),
    drawHook: (receivedHook, metadata) => {
      calls.push(["hook", receivedHook, metadata.layerName]);
      return "hook-result";
    },
    drawCarryLabel: () => assert.fail("wrong layer"),
  });

  const labelResult = drawHookPlayerLayer({
    hook,
    miner,
    index: 0,
    layerName: "carryLabel",
    drawHookTrail: () => assert.fail("wrong layer"),
    drawHook: () => assert.fail("wrong layer"),
    drawCarryLabel: (receivedHook, metadata) => {
      calls.push(["carryLabel", receivedHook, metadata.layerName]);
      return "label-result";
    },
  });

  assert.equal(hookResult, "hook-result");
  assert.equal(labelResult, "label-result");
  assert.deepEqual(calls, [
    ["hook", hook, "hook"],
    ["carryLabel", hook, "carryLabel"],
  ]);
});

test("createHookLayerHandlers returns render-pipeline compatible player layer callbacks", () => {
  const hook = { id: "h1" };
  const miner = { id: "m1" };
  const calls = [];

  const handlers = createHookLayerHandlers({
    drawHookTrail: (receivedHook, metadata) => calls.push(["trail", receivedHook, metadata.miner, metadata.index]),
    drawHook: (receivedHook, metadata) => calls.push(["hook", receivedHook, metadata.miner, metadata.index]),
    drawCarryLabel: (receivedHook, metadata) => calls.push(["label", receivedHook, metadata.miner, metadata.index]),
  });

  handlers.hookTrail(hook, miner, 1);
  handlers.hook(hook, miner, 1);
  handlers.carryLabel(hook, miner, 1);

  assert.deepEqual(calls, [
    ["trail", hook, miner, 1],
    ["hook", hook, miner, 1],
    ["label", hook, miner, 1],
  ]);
});

test("hook layer renderer rejects invalid inputs", () => {
  assert.throws(() => drawHookPlayerLayer({ layerName: "bad" }), /unsupported hook layer/);
  assert.throws(
    () => drawHookPlayerLayer({ layerName: "hook", hook: {}, miner: {}, index: 0, drawHook: null }),
    /drawHook must be a function/,
  );
  assert.throws(
    () => createHookLayerHandlers({ drawHookTrail() {}, drawHook() {} }),
    /drawCarryLabel must be a function/,
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/unit/hook-layer-renderer.test.mjs
```

Expected: fail with module-not-found for `src/render/hookLayerRenderer.js`.

- [ ] **Step 3: Implement the module**

Create `src/render/hookLayerRenderer.js`:

```js
const HOOK_LAYER_CALLBACKS = Object.freeze({
  hookTrail: "drawHookTrail",
  hook: "drawHook",
  carryLabel: "drawCarryLabel",
});

function assertFunction(value, name) {
  if (typeof value !== "function") {
    throw new TypeError(`${name} must be a function`);
  }
}

function assertSupportedLayerName(layerName) {
  if (!Object.prototype.hasOwnProperty.call(HOOK_LAYER_CALLBACKS, layerName)) {
    throw new TypeError(`unsupported hook layer: ${String(layerName)}`);
  }
}

export function drawHookPlayerLayer(options = {}) {
  const { hook, miner, index, layerName } = options;
  assertSupportedLayerName(layerName);

  const callbackName = HOOK_LAYER_CALLBACKS[layerName];
  const callback = options[callbackName];
  assertFunction(callback, callbackName);

  return callback(hook, { hook, miner, index, layerName });
}

export function createHookLayerHandlers({ drawHookTrail, drawHook, drawCarryLabel } = {}) {
  assertFunction(drawHookTrail, "drawHookTrail");
  assertFunction(drawHook, "drawHook");
  assertFunction(drawCarryLabel, "drawCarryLabel");

  return {
    hookTrail: (hook, miner, index) =>
      drawHookPlayerLayer({ hook, miner, index, layerName: "hookTrail", drawHookTrail }),
    hook: (hook, miner, index) => drawHookPlayerLayer({ hook, miner, index, layerName: "hook", drawHook }),
    carryLabel: (hook, miner, index) =>
      drawHookPlayerLayer({ hook, miner, index, layerName: "carryLabel", drawCarryLabel }),
  };
}
```

- [ ] **Step 4: Run module tests**

Run:

```bash
node --test tests/unit/hook-layer-renderer.test.mjs
```

Expected: 4 pass, 0 fail.

## Task 2: Expose Hook Renderer Through Runtime Bridge

**Files:**
- Modify: `src/runtime/moduleBridge.js`
- Modify: `tests/unit/runtime-bridge.test.mjs`

- [ ] **Step 1: Update bridge test**

In `tests/unit/runtime-bridge.test.mjs`, add these keys to the expected export list near other render exports:

```js
"drawHookPlayerLayer",
"createHookLayerHandlers",
```

Add assertions after the item layer assertions:

```js
assert.equal(typeof modules.drawHookPlayerLayer, "function");
assert.equal(typeof modules.createHookLayerHandlers, "function");
```

- [ ] **Step 2: Run bridge test to verify it fails**

Run:

```bash
node --test tests/unit/runtime-bridge.test.mjs
```

Expected: fail because bridge does not expose hook renderer helpers yet.

- [ ] **Step 3: Update bridge implementation**

In `src/runtime/moduleBridge.js`, import:

```js
import { createHookLayerHandlers, drawHookPlayerLayer } from "../render/hookLayerRenderer.js";
```

Expose in `GoldMinerModules` near other render exports:

```js
drawHookPlayerLayer,
createHookLayerHandlers,
```

- [ ] **Step 4: Run bridge and hook renderer tests**

Run:

```bash
node --test tests/unit/hook-layer-renderer.test.mjs tests/unit/runtime-bridge.test.mjs
```

Expected: all pass.

## Task 3: Route Game Hook Layers Through Bridge-First Wrapper

**Files:**
- Modify: `game.js`
- Modify: `tests/unit/source-invariants.test.mjs`

- [ ] **Step 1: Add source invariant expectations**

Add a new test after the item layer test:

```js
test("game hook player layers prefer bridge hook layer renderer while keeping concrete hook drawing local", () => {
  const source = read("game.js");
  const hookLayerOptionsBody = extractFunctionBody(source, "hookLayerOptions");
  const localHookLayerBody = extractFunctionBody(source, "createLocalHookLayerHandlers");
  const bridgeHookLayerBody = extractFunctionBody(source, "createBridgeHookLayerHandlers");
  const renderLayerHandlersBody = extractFunctionBody(source, "renderLayerHandlers");
  const drawHookTrailBody = extractFunctionBody(source, "drawHookTrail");
  const drawHookBody = extractFunctionBody(source, "drawHook");
  const drawCarryLabelBody = extractFunctionBody(source, "drawCarryLabel");

  assert.match(source, /let hookLayerBridgeDisabled = false;/);
  assert.match(source, /function hookLayerOptions\(\)/);
  assert.match(source, /function createLocalHookLayerHandlers\(options = hookLayerOptions\(\)\)/);
  assert.match(source, /function createBridgeHookLayerHandlers\(options = hookLayerOptions\(\)\)/);

  assert.match(hookLayerOptionsBody, /drawHookTrail: \(hook, metadata\) => drawHookTrail\(hook, metadata\)/);
  assert.match(hookLayerOptionsBody, /drawHook: \(hook, metadata\) => drawHook\(hook, metadata\)/);
  assert.match(hookLayerOptionsBody, /drawCarryLabel: \(hook, metadata\) => drawCarryLabel\(hook, metadata\)/);
  assert.match(localHookLayerBody, /hookTrail: \(hook, miner, index\) => options\.drawHookTrail\(hook, \{ hook, miner, index, layerName: "hookTrail" \}\)/);
  assert.match(localHookLayerBody, /hook: \(hook, miner, index\) => options\.drawHook\(hook, \{ hook, miner, index, layerName: "hook" \}\)/);
  assert.match(localHookLayerBody, /carryLabel: \(hook, miner, index\) => options\.drawCarryLabel\(hook, \{ hook, miner, index, layerName: "carryLabel" \}\)/);
  assert.match(bridgeHookLayerBody, /GoldMinerModules\.createHookLayerHandlers\(options\)/);
  assert.match(bridgeHookLayerBody, /hookLayerBridgeDisabled = true/);
  assert.match(bridgeHookLayerBody, /window\.__goldMinerHookRendererError =/);
  assert.match(bridgeHookLayerBody, /createLocalHookLayerHandlers\(options\)/);
  assert.match(renderLayerHandlersBody, /const hookLayers = createBridgeHookLayerHandlers\(\)/);
  assert.match(renderLayerHandlersBody, /hookTrail: hookLayers\.hookTrail/);
  assert.match(renderLayerHandlersBody, /hook: hookLayers\.hook/);
  assert.match(renderLayerHandlersBody, /carryLabel: hookLayers\.carryLabel/);
  assert.match(drawHookTrailBody, /hook\.trail/);
  assert.match(drawHookBody, /HOOK\.ringToTip/);
  assert.match(drawCarryLabelBody, /item\.type === "bag"/);
});
```

- [ ] **Step 2: Run source invariant test to verify it fails**

Run:

```bash
node --test tests/unit/source-invariants.test.mjs
```

Expected: fail because `game.js` does not have the hook bridge wrapper.

- [ ] **Step 3: Add game wrapper implementation**

In `game.js`, add one bridge-disabled flag near the other render flags:

```js
let hookLayerBridgeDisabled = false;
```

Add helpers after `drawHook()` or before `renderLayerHandlers()`:

```js
function hookLayerOptions() {
  return {
    drawHookTrail: (hook, metadata) => drawHookTrail(hook, metadata),
    drawHook: (hook, metadata) => drawHook(hook, metadata),
    drawCarryLabel: (hook, metadata) => drawCarryLabel(hook, metadata),
  };
}

function createLocalHookLayerHandlers(options = hookLayerOptions()) {
  return {
    hookTrail: (hook, miner, index) => options.drawHookTrail(hook, { hook, miner, index, layerName: "hookTrail" }),
    hook: (hook, miner, index) => options.drawHook(hook, { hook, miner, index, layerName: "hook" }),
    carryLabel: (hook, miner, index) =>
      options.drawCarryLabel(hook, { hook, miner, index, layerName: "carryLabel" }),
  };
}

function createBridgeHookLayerHandlers(options = hookLayerOptions()) {
  if (!hookLayerBridgeDisabled && GoldMinerModules.createHookLayerHandlers) {
    try {
      return GoldMinerModules.createHookLayerHandlers(options);
    } catch (error) {
      hookLayerBridgeDisabled = true;
      if (!Object.prototype.hasOwnProperty.call(window, "__goldMinerHookRendererError")) {
        window.__goldMinerHookRendererError = error instanceof Error ? error.message : String(error);
      }
      console.warn("Gold Miner hook renderer failed; using local hook layer fallback.", error);
    }
  }

  return createLocalHookLayerHandlers(options);
}
```

Update `renderLayerHandlers()`:

```js
function renderLayerHandlers() {
  const hookLayers = createBridgeHookLayerHandlers();
  return {
    background: () => drawBackground(),
    plank: () => drawPlank(),
    minerBack: (hook, miner) => drawMinerBack(hook, miner),
    winch: (hook) => drawWinch(hook),
    minerFront: (hook, miner) => drawMinerFront(hook, miner),
    items: () => drawItems(),
    hookTrail: hookLayers.hookTrail,
    hook: hookLayers.hook,
    carryLabel: hookLayers.carryLabel,
    fx: () => drawFx(),
  };
}
```

- [ ] **Step 4: Run targeted tests**

Run:

```bash
node --test tests/unit/hook-layer-renderer.test.mjs tests/unit/runtime-bridge.test.mjs tests/unit/source-invariants.test.mjs
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
- 架构 Batch 6 follow-up：新增 `src/render/hookLayerRenderer.js`，`renderLayerHandlers()` 现在通过 bridge-first hook layer handlers 统一分发 `hookTrail` / `hook` / `carryLabel`，异常时一次性熔断并回退本地 callbacks。具体 `drawHookTrail()` / `drawHook()` / `drawCarryLabel()` 几何仍在 `game.js`。
```

- [ ] **Step 2: Update architecture docs**

In `docs/architecture-optimization-plan.md` and `docs/superpowers/plans/2026-05-24-architecture-next-batches.md`, mark this Batch 6 follow-up as completed and list `src/render/hookLayerRenderer.js` under completed render modules.

- [ ] **Step 3: Run final verification**

Run:

```bash
node --test tests/unit/hook-layer-renderer.test.mjs tests/unit/runtime-bridge.test.mjs tests/unit/source-invariants.test.mjs
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
- Confirm `GoldMinerModules.createHookLayerHandlers` exists in normal page context if the browser tooling can read it.
- Confirm no `window.__goldMinerHookRendererError`.
- Confirm no console error/warn.
- Visually inspect a gameplay screenshot where rope/claw/trail still render.

## Completion Boundary

This batch is complete when hook player layer dispatch is module-owned and bridge-exposed, `game.js` preserves concrete hook drawing locally, tests cover bridge/local callback parity, and browser smoke shows hook visuals still render.

## Completion Notes

- `src/render/hookLayerRenderer.js` provides `drawHookPlayerLayer()` and `createHookLayerHandlers()`.
- `GoldMinerModules` exposes both hook layer helpers through `src/runtime/moduleBridge.js`.
- `game.js` keeps concrete `drawHookTrail()`, `drawHook()`, and `drawCarryLabel()` geometry local, while `renderLayerHandlers()` uses bridge-first hook layer handlers with local fallback.
- Final verification passed with `npm run verify` at 93/93 tests and `./macos/build.command`.
- Browser smoke confirmed `window.__goldMinerModulesReady === true`, `GoldMinerModules.createHookLayerHandlers` exists, no hook renderer error was recorded, console warnings/errors were empty, and the hook/claw canvas render was visually inspected.
