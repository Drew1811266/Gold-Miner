# Gold Miner Complete Architecture Refactor Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each task requires a spec review and a code-quality review before the next task starts.

**Goal:** Finish the remaining architecture refactor for the Gold Miner canvas game without changing gameplay rules, visuals, controls, or fixed-seed behavior.

**Architecture:** Continue the strangler migration already used in prior batches: extract one concrete responsibility into `src/`, expose it through `src/runtime/moduleBridge.js`, route `game.js` through a bridge-first wrapper with a local fallback, then harden the boundary with unit tests, source invariants, full verification, macOS packaging, and browser smoke evidence. Keep the current classic `audio.js` + `game.js` entry until the render, state, UI, audio, and test harness boundaries are stable.

**Tech Stack:** Browser JavaScript, ES modules, Node built-in test runner, HTML5 Canvas 2D, WebAudio, Playwright browser smoke checks, Swift/macOS WebView packaging.

---

## Execution Rules

- Do not change gameplay rules, balance values, item probabilities, scoring, or controls unless a test exposes a bug caused by the refactor itself.
- Do not remove the classic `index.html` script entry during this plan. `audio.js` must load before `game.js`.
- Preserve bridge-first, fallback-second runtime behavior until Task 14 explicitly removes selected fallback duplication.
- For every renderer wrapper added to `game.js`, use:
  - `let <name>BridgeDisabled = false;`
  - `<name>LayerOptions(...)`
  - `<name>WithLocalLayer(options = <name>LayerOptions(...))`
  - bridge `try/catch`, one-time disable, `window.__goldMiner<Name>RendererError`, and local fallback.
- Every local fallback must consume `options.ctx` and restore canvas state with `try/finally` when it calls `ctx.save()`.
- Every new module must reject invalid structural inputs in unit tests.
- After each task, run its targeted tests, run `npm run verify`, run `./macos/build.command`, and do a browser smoke check when the task affects rendered or interactive runtime behavior.
- After each task, run two reviews:
  - Spec review: confirm the task scope and acceptance criteria were met.
  - Code-quality review: look for behavior drift, global coupling, canvas state leaks, weak tests, and over-broad edits.

## Current Completed Baseline

- Pure modules: RNG, geometry, market, DDA, item/value/level generation.
- Runtime bridge: `src/runtime/moduleBridge.js` exposes stable `window.GoldMinerModules`.
- State command boundary: commands, selectors, inventory helpers, dispatcher.
- Event side-effect boundary: event types/queue plus audio/UI/FX adapters.
- Render orchestration: `src/render/renderPipeline.js`.
- Render concrete extraction already complete for:
  - `src/render/backgroundRenderer.js`
  - `src/render/itemLayerRenderer.js`
  - `src/render/hookLayerRenderer.js`
  - `src/render/hookTrailRenderer.js`

## Completion Definition

The remaining architecture refactor is considered complete when:

- `game.js` no longer owns concrete Canvas renderer bodies for carry labels, winch/reel, miner, hook claw/rope, item shape drawing, or FX drawing.
- Scene generation and render snapshot assembly have tested module boundaries, so viewport-dependent render data can be validated outside the frame loop.
- Runtime mutation logic for FX progression and high-risk hook/item/keg/scoring transitions has a tested system boundary.
- Gameplay-affecting random decisions use a seeded runtime RNG path; `Math.random()` is allowed only for visual-only FX jitter.
- Input/UI/audio adapters are isolated from rule logic enough that they can be tested outside direct DOM event listeners.
- Browser automation/debug hooks are housed behind a tested test-harness boundary.
- The app has a tested `src/main.js` module entry, with any remaining classic entry shim documented and intentionally minimal.
- `npm run verify`, `./macos/build.command`, and browser smoke checks pass.

---

## Task 1: Carry Label Renderer Extraction

**Files:**
- Create: `src/render/carryLabelRenderer.js`
- Create: `tests/unit/carry-label-renderer.test.mjs`
- Modify: `src/runtime/moduleBridge.js`
- Modify: `game.js`
- Modify: `tests/unit/runtime-bridge.test.mjs`
- Modify: `tests/unit/source-invariants.test.mjs`
- Modify: `progress.md`

- [x] **Step 1: Add failing renderer tests**

Add tests for `drawCarryLabelLayer({ ctx, end, viewport, color, text })` that verify:

```js
drawCarryLabelLayer({
  ctx,
  end: { x: 100, y: 120 },
  viewport: { w: 320, h: 240 },
  color: "#ffd34d",
  text: "120",
});
```

Expected behavior:
- calls `ctx.save()` before drawing and `ctx.restore()` in a `finally`-safe path
- sets `font` to `700 12px ui-sans-serif, system-ui`
- measures text width
- clamps label bounds inside `viewport`
- draws tint panel, dark panel, color dot, dot highlight, and text
- returns `true` when drawn
- throws for missing `ctx`, invalid `end`, invalid `viewport`, empty `color`, or empty `text`

- [x] **Step 2: Implement module**

Create a focused module with local validation and a local `roundRectPath(ctx, x, y, w, h, r)` helper. The module owns only label geometry and Canvas calls.

```js
export function drawCarryLabelLayer({ ctx, end, viewport, color, text } = {}) {
  validateCarryLabelOptions({ ctx, end, viewport, color, text });
  ctx.save();
  try {
    ctx.font = "700 12px ui-sans-serif, system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    // same geometry as the legacy label body
  } finally {
    ctx.restore();
  }
  return true;
}
```

- [x] **Step 3: Wire bridge and runtime wrapper**

In `game.js`, keep game-state decisions local:
- no label unless `game.phase === "playing"`
- no label unless `hook.state === "retract"`
- no label unless `attachedItem(hook)` exists
- text remains `?` for bag, `!!` for keg, otherwise item value

Add bridge-first wrapper:

```js
function carryLabelLayerOptions(hook = game.hook) {
  if (game.phase !== "playing") return null;
  if (hook.state !== "retract") return null;
  const item = attachedItem(hook);
  if (!item) return null;
  return {
    ctx,
    end: getHookEnd(hook),
    viewport: game.viewport,
    color: itemFxColor(item),
    text: item.type === "bag" ? "?" : item.type === "keg" ? "!!" : `${item.value}`,
  };
}
```

- [x] **Step 4: Review and verify**

Run:

```bash
node --test tests/unit/carry-label-renderer.test.mjs tests/unit/runtime-bridge.test.mjs tests/unit/source-invariants.test.mjs
npm run verify
./macos/build.command
```

Browser smoke must confirm `window.GoldMinerModules.drawCarryLabelLayer` exists, the canvas is nonblank after entering a level and firing the hook, and no `__goldMinerCarryLabelRendererError` is present.

## Task 2: Winch And Reel Renderer Extraction

**Files:**
- Create: `src/render/winchRenderer.js`
- Create: `tests/unit/winch-renderer.test.mjs`
- Modify: `src/runtime/moduleBridge.js`
- Modify: `game.js`
- Modify: `tests/unit/runtime-bridge.test.mjs`
- Modify: `tests/unit/source-invariants.test.mjs`
- Modify: `progress.md`

- [x] **Step 1: Add tests for `drawReelLayer` and `drawWinchLayer`**

Verify:
- `drawReelLayer({ ctx, pivot, centerY, hook })` draws reel shadow, metal ring, hub, spokes, handle, and motion blur when `hook.spoolSpeed` is high.
- `drawWinchLayer({ ctx, pivot, reel, plankY, hook })` draws plank shadow, mount plate, four bolts, then delegates to `drawReelLayer`.
- Both functions return a small draw summary object:

```js
{ drewWinch: true, drewReel: true }
```

- [x] **Step 2: Implement module**

Move the current `drawReel()` and `drawWinch()` geometry into `src/render/winchRenderer.js`. The module must define its own `roundRectPath`, validation helpers, and small `clamp` usage imported from `src/core/geometry.js`.

- [x] **Step 3: Wire runtime wrapper**

In `game.js`, add:

```js
function winchLayerOptions(hook = game.hook) {
  return {
    ctx,
    pivot: getPivot(hook),
    reel: getReelCenter(hook),
    plankY: getPlankY(),
    hook,
  };
}
```

`drawWinch(hook)` must prefer `GoldMinerModules.drawWinchLayer(options)` and fallback to `drawWinchWithLocalLayer(options)`.

- [x] **Step 4: Review and verify**

Run targeted tests, `npm run verify`, `./macos/build.command`, and browser smoke. Confirm no `__goldMinerWinchRendererError`.

## Task 3: Miner Renderer Extraction

**Files:**
- Create: `src/render/minerRenderer.js`
- Create: `tests/unit/miner-renderer.test.mjs`
- Modify: `src/runtime/moduleBridge.js`
- Modify: `game.js`
- Modify: `tests/unit/runtime-bridge.test.mjs`
- Modify: `tests/unit/source-invariants.test.mjs`
- Modify: `progress.md`

- [x] **Step 1: Add tests for pose and layers**

Expose and test:

```js
export function createMinerPose({ hook, miner, pivot, reel, now, attachedItem }) {}
export function drawMinerBackLayer({ ctx, pose }) {}
export function drawMinerFrontLayer({ ctx, pose }) {}
```

Verify pose is deterministic for fixed `now`, `hook`, `miner`, `pivot`, `reel`, and carried weight.

- [x] **Step 2: Implement module**

Move `lerpVec`, `solveElbow`, `getMinerPose`, `drawMinerBack`, and `drawMinerFront` geometry into `src/render/minerRenderer.js`. The module must take all runtime data through options and must not call `performance.now()`, `getPivot()`, `getReelCenter()`, or `attachedItem()` internally.

- [x] **Step 3: Wire runtime wrapper**

In `game.js`, create `minerLayerOptions(hook, miner)` that supplies `ctx`, `hook`, `miner`, `pivot`, `reel`, `now`, and `attachedItem: attachedItem(hook)`.

`renderLayerHandlers()` should still expose `minerBack` and `minerFront`, but those callbacks should call bridge-first wrappers.

- [x] **Step 4: Review and verify**

Run targeted tests, `npm run verify`, `./macos/build.command`, and browser smoke. Confirm both single-player and double-player miner ordering remains intact.

## Task 4: Hook Rope And Claw Renderer Extraction

**Files:**
- Create: `src/render/hookRenderer.js`
- Create: `tests/unit/hook-renderer.test.mjs`
- Modify: `src/runtime/moduleBridge.js`
- Modify: `game.js`
- Modify: `tests/unit/runtime-bridge.test.mjs`
- Modify: `tests/unit/source-invariants.test.mjs`
- Modify: `progress.md`

- [x] **Step 1: Add tests**

Test `drawHookLayer({ ctx, hook, pivot, tip, dir, carriedItem, canBomb, hookConfig, now, itemGlowColor })`.

Verify:
- rope shadow and highlight are drawn from `pivot` to ring
- moving dash hint is drawn when hook is not swinging
- tri-prong claw paths are drawn
- carried-item glow appears when retracting with cargo
- bomb fuse glow appears only when `canBomb === true`

- [x] **Step 2: Implement module**

Move `drawHook()` geometry to `src/render/hookRenderer.js`. The module must own only Canvas shape drawing and receive all state-derived values from options.

- [x] **Step 3: Wire runtime wrapper**

In `game.js`, `hookLayerOptions(hook)` should pass:
- `pivot: getPivot(hook)`
- `tip: getHookEnd(hook)`
- `dir: getHookDir(hook.angle)`
- `carriedItem: attachedItem(hook)`
- `canBomb: game.phase === "playing" && !game.paused && game.inventory.bombs > 0 && hook.state === "retract" && attachedItem(hook)`
- `hookConfig: HOOK`
- `now: performance.now()`
- `itemGlowColor: carriedItem ? itemFxColor(carriedItem) : null`

- [x] **Step 4: Review and verify**

Run targeted tests, `npm run verify`, `./macos/build.command`, and browser smoke. Confirm no `__goldMinerHookShapeRendererError`.

## Task 5: Item Shape Renderer Extraction

**Files:**
- Create: `src/render/itemRenderer.js`
- Create: `tests/unit/item-renderer.test.mjs`
- Modify: `src/runtime/moduleBridge.js`
- Modify: `game.js`
- Modify: `tests/unit/runtime-bridge.test.mjs`
- Modify: `tests/unit/source-invariants.test.mjs`
- Modify: `progress.md`

- [ ] **Step 1: Add focused tests**

Test `drawItemShape({ ctx, item, now, createRng })` for representative types:
- `mouse` with cargo
- `gold`
- `bar`
- `diamond`
- `keg`
- fallback mystery bag

Tests must assert branch selection and key drawing calls rather than pixel-perfect canvas output.

- [ ] **Step 2: Implement module**

Move `blobPath()` and the body of `drawItem()` into `src/render/itemRenderer.js`. Keep `makeBlob` supplied by item art when present; if fallback art is needed, use the injected `createRng`.

- [ ] **Step 3: Wire runtime wrapper**

`drawItem(item, metadata)` in `game.js` should become a bridge-first wrapper passing `{ ctx, item, metadata, now: performance.now(), createRng }`.

- [ ] **Step 4: Review and verify**

Run targeted tests, `npm run verify`, `./macos/build.command`, and browser smoke. Confirm item rendering still covers visible gold, rocks, gems, bags, kegs, fossils, pouches, and mice.

## Task 6: FX Renderer Extraction

**Files:**
- Create: `src/render/fxRenderer.js`
- Create: `tests/unit/fx-renderer.test.mjs`
- Modify: `src/runtime/moduleBridge.js`
- Modify: `game.js`
- Modify: `tests/unit/runtime-bridge.test.mjs`
- Modify: `tests/unit/source-invariants.test.mjs`
- Modify: `progress.md`

- [ ] **Step 1: Add tests**

Test `drawFxLayer({ ctx, fx })` with rings, particles, and score pops. Verify compositing, alpha fade, arc drawing, and text stroke/fill.

- [ ] **Step 2: Implement module**

Move `drawFx()` into `src/render/fxRenderer.js`. The module must not mutate `fx`.

- [ ] **Step 3: Wire runtime wrapper**

`drawFx()` in `game.js` should become bridge-first with fallback. `renderLayerHandlers().fx` remains the same public layer name.

- [ ] **Step 4: Review and verify**

Run targeted tests, `npm run verify`, `./macos/build.command`, and browser smoke after causing at least one hook action or bomb action when feasible.

## Task 7: Scene And Render Snapshot Boundary

**Files:**
- Create: `src/render/sceneSystem.js`
- Create: `src/render/renderSnapshot.js`
- Create: `tests/unit/scene-system.test.mjs`
- Create: `tests/unit/render-snapshot.test.mjs`
- Modify: `src/runtime/moduleBridge.js`
- Modify: `game.js`
- Modify: `tests/unit/runtime-bridge.test.mjs`
- Modify: `tests/unit/source-invariants.test.mjs`
- Modify: `progress.md`

- [ ] **Step 1: Extract scene generation**

Move `buildScene(seed)` data construction into `createSceneData({ seed, viewport, background })`. The module returns stars, dust, and any background animation data without touching Canvas or DOM.

- [ ] **Step 2: Extract render options assembly**

Move the object assembly currently inside `render()` into `createRenderSnapshot({ game, ctx, canvas, dpr, players, layers, now })`. The module validates required fields and returns the exact options object passed to `renderFrameWithLayers`.

- [ ] **Step 3: Wire runtime**

`game.js` still decides when to call `buildScene()` and `render()`, but scene data creation and render snapshot shape should be bridge-backed.

- [ ] **Step 4: Review and verify**

Run targeted tests, `npm run verify`, `./macos/build.command`, and browser smoke. Confirm fixed seed `12345` still has a nonblank background and stable text state.

## Task 8: FX State Update System Extraction

**Files:**
- Create: `src/systems/fxSystem.js`
- Create: `tests/unit/fx-system.test.mjs`
- Modify: `src/runtime/moduleBridge.js`
- Modify: `game.js`
- Modify: `tests/unit/runtime-bridge.test.mjs`
- Modify: `tests/unit/source-invariants.test.mjs`
- Modify: `progress.md`

- [ ] **Step 1: Add tests**

Test:

```js
export function updateFxState(fx, dt, random = Math.random) {}
```

Expected:
- decreases `flash`
- decreases `shake`
- computes `shakeX` and `shakeY` from injected `random`
- ages/removes `pops`, `rings`, and `particles`
- returns the mutated `fx` object for compatibility

- [ ] **Step 2: Implement system**

Move the FX progression loops from `update(dt)` into `src/systems/fxSystem.js`.

- [ ] **Step 3: Wire runtime**

In `game.js`, replace inline FX progression in `update(dt)` with bridge-first `updateFxState(game.fx, dt, Math.random)` and local fallback.

- [ ] **Step 4: Review and verify**

Run targeted tests, `npm run verify`, `./macos/build.command`, and browser smoke.

## Task 9: Hook State System First Extraction

**Files:**
- Create: `src/systems/hookSystem.js`
- Create: `tests/unit/hook-system.test.mjs`
- Modify: `src/runtime/moduleBridge.js`
- Modify: `game.js`
- Modify: `tests/unit/runtime-bridge.test.mjs`
- Modify: `tests/unit/source-invariants.test.mjs`
- Modify: `progress.md`

- [ ] **Step 1: Extract pure hook helpers**

Move pure helpers first:
- `getHookDir(angle)`
- hook length/swing/reel scalar calculations that do not touch `game`, `ctx`, DOM, audio, or FX directly

- [ ] **Step 2: Add tests**

Test angle-to-direction, length clamp behavior, and trail point aging with fixed inputs.

- [ ] **Step 3: Wire low-risk runtime helpers**

Keep collision, item attach, delivery, dust puffs, and audio/event side effects in `game.js` for this task. Route only pure hook calculations through the bridge.

- [ ] **Step 4: Review and verify**

Run targeted tests, `npm run verify`, `./macos/build.command`, and browser smoke.

## Task 10: Item Motion And Keg System Boundary

**Files:**
- Create: `src/systems/itemMotionSystem.js`
- Create: `src/systems/kegSystem.js`
- Create: `tests/unit/item-motion-system.test.mjs`
- Create: `tests/unit/keg-system.test.mjs`
- Modify: `src/runtime/moduleBridge.js`
- Modify: `game.js`
- Modify: `tests/unit/runtime-bridge.test.mjs`
- Modify: `tests/unit/source-invariants.test.mjs`
- Modify: `progress.md`

- [ ] **Step 1: Extract item motion decisions**

Move mouse horizontal movement and falling keg position integration into modules that return state deltas or mutate passed item objects explicitly.

- [ ] **Step 2: Extract keg explosion hit testing**

Move keg radius checks and affected-item selection into `kegSystem`.

- [ ] **Step 3: Keep side effects event-driven**

`game.js` remains responsible for emitting audio/FX events, but affected item selection and motion math are bridge-backed.

- [ ] **Step 4: Review and verify**

Run targeted tests, `npm run verify`, `./macos/build.command`, and browser smoke with a fixed seed.

## Task 11: Scoring And Delivery System Boundary

**Files:**
- Create: `src/systems/scoringSystem.js`
- Create: `tests/unit/scoring-system.test.mjs`
- Modify: `src/runtime/moduleBridge.js`
- Modify: `game.js`
- Modify: `tests/unit/runtime-bridge.test.mjs`
- Modify: `tests/unit/source-invariants.test.mjs`
- Modify: `progress.md`

- [ ] **Step 1: Extract pure delivery result calculation**

Implement:

```js
export function createDeliveryResult({ score, item, playerIndex }) {}
```

Expected result includes earned amount, next score, pop color, ring/burst payload data, and player index. It must not play audio, mutate DOM, or draw.

- [ ] **Step 2: Wire `deliverAttachedItem`**

`deliverAttachedItem()` should still mutate `game` and emit events, but score math and display payload decisions should come from `scoringSystem`.

- [ ] **Step 3: Review and verify**

Run targeted tests, `npm run verify`, `./macos/build.command`, and browser smoke.

## Task 12: Gameplay RNG Boundary

**Files:**
- Create: `src/core/randomStreams.js`
- Create: `tests/unit/random-streams.test.mjs`
- Modify: `src/runtime/moduleBridge.js`
- Modify: `game.js`
- Modify: `tests/unit/runtime-bridge.test.mjs`
- Modify: `tests/unit/source-invariants.test.mjs`
- Modify: `progress.md`

- [ ] **Step 1: Add seeded gameplay stream helper**

Implement a small helper that creates named seeded streams from `game.runSeed` and level/runtime salts. It should use existing `createRng(seed)` and expose deterministic `next()` calls.

- [ ] **Step 2: Replace gameplay-affecting `Math.random()`**

Replace the immediate keg explosion probability path with the seeded gameplay stream. Do not replace visual-only `Math.random()` uses in burst particles, score-pop jitter, or shake jitter.

- [ ] **Step 3: Review and verify**

Run targeted tests, `npm run verify`, `./macos/build.command`, and browser smoke. Source invariants must assert gameplay random does not use `Math.random()`.

## Task 13: UI Adapter Boundary

**Files:**
- Create: `src/ui/domUiAdapter.js`
- Create: `tests/unit/dom-ui-adapter.test.mjs`
- Modify: `src/runtime/moduleBridge.js`
- Modify: `game.js`
- Modify: `tests/unit/runtime-bridge.test.mjs`
- Modify: `tests/unit/source-invariants.test.mjs`
- Modify: `progress.md`

- [ ] **Step 1: Extract HUD snapshot formatting**

Move DOM-independent label/class decisions out of `updateHud()` into pure functions.

- [ ] **Step 2: Keep DOM writes in adapter**

The adapter receives refs and a snapshot, then writes text/classes. It should not compute gameplay values beyond display formatting.

- [ ] **Step 3: Review and verify**

Run targeted tests, `npm run verify`, `./macos/build.command`, and browser smoke. Confirm HUD, inventory counters, target, level, timer, and buttons still update.

## Task 14: Input Adapter Boundary

**Files:**
- Create: `src/ui/inputAdapter.js`
- Create: `tests/unit/input-adapter.test.mjs`
- Modify: `src/runtime/moduleBridge.js`
- Modify: `game.js`
- Modify: `tests/unit/runtime-bridge.test.mjs`
- Modify: `tests/unit/source-invariants.test.mjs`
- Modify: `progress.md`

- [ ] **Step 1: Extract key/pointer-to-command mapping**

Map keyboard and pointer inputs to command objects without mutating `game`.

- [ ] **Step 2: Wire listeners through adapter**

`initUi()` should register listeners, but command selection must be tested in `inputAdapter`.

- [ ] **Step 3: Review and verify**

Run targeted tests, `npm run verify`, `./macos/build.command`, and browser smoke for menu start, pause, fire hook, bomb, music, track, and SFX controls.

## Task 15: Audio Adapter Boundary

**Files:**
- Create: `src/audio/audioAdapter.js`
- Create: `tests/unit/audio-adapter.test.mjs`
- Modify: `src/runtime/moduleBridge.js`
- Modify: `game.js`
- Modify: `audio.js` only if a thin adapter export is required
- Modify: `tests/unit/runtime-bridge.test.mjs`
- Modify: `tests/unit/source-invariants.test.mjs`
- Modify: `progress.md`

- [ ] **Step 1: Extract event-to-audio facade calls**

Keep WebAudio synthesis in `audio.js`. Move runtime event-to-`window.GameAudio` invocation decisions into `src/audio/audioAdapter.js`.

- [ ] **Step 2: Wire existing event processing through adapter**

`applyRuntimeAudioEvents()` should become thinner and delegate to bridge-backed adapter functions.

- [ ] **Step 3: Review and verify**

Run targeted tests, `npm run verify`, `./macos/build.command`, and browser smoke. Confirm no console warnings from blocked audio autoplay beyond expected user-gesture constraints.

## Task 16: Test Harness And Debug API Boundary

**Files:**
- Create: `src/testing/debugApi.js`
- Create: `tests/unit/debug-api.test.mjs`
- Modify: `src/runtime/moduleBridge.js`
- Modify: `game.js`
- Modify: `tests/unit/baseline-fixtures.test.mjs`
- Modify: `tests/unit/source-invariants.test.mjs`
- Modify: `progress.md`

- [ ] **Step 1: Extract text snapshot creation**

Move the body behind `window.render_game_to_text` into a pure snapshot function that receives `game` and small selectors.

- [ ] **Step 2: Extract deterministic advance helper**

Keep `window.advanceTime(ms)` installed by `game.js`, but put step-count calculation and state snapshot expectations in `src/testing/debugApi.js`.

- [ ] **Step 3: Review and verify**

Run targeted tests, `npm run verify`, `./macos/build.command`, and browser smoke. Compare fixed-seed text snapshots before and after a short advance.

## Task 17: State Kernel Assembly

**Files:**
- Create: `src/state/createInitialState.js`
- Create: `src/state/stateKernel.js`
- Create: `tests/unit/state-kernel.test.mjs`
- Modify: `src/runtime/moduleBridge.js`
- Modify: `game.js`
- Modify: `tests/unit/runtime-bridge.test.mjs`
- Modify: `tests/unit/source-invariants.test.mjs`
- Modify: `progress.md`

- [ ] **Step 1: Add initial-state factory**

Move default state shape creation into `createInitialGameState()`, preserving the current object fields and defaults.

- [ ] **Step 2: Add frame step shell**

Create `stepPlayingState({ state, dt, systems, events })` as a tested orchestration shell. Initially it may delegate to existing system functions, but it must define the future state-kernel boundary without DOM, Canvas, or Audio.

- [ ] **Step 3: Wire runtime conservatively**

`game.js` can keep host glue and existing compatibility calls, but state initialization and top-level playing-state stepping should use the bridge when available.

- [ ] **Step 4: Review and verify**

Run targeted tests, `npm run verify`, `./macos/build.command`, and browser smoke.

## Task 18: Bridge Surface Cleanup

**Files:**
- Modify: `src/runtime/moduleBridge.js`
- Modify: `game.js`
- Modify: `tests/unit/runtime-bridge.test.mjs`
- Modify: `tests/unit/source-invariants.test.mjs`
- Modify: `progress.md`

- [ ] **Step 1: Remove stale exports and duplicate fallback code**

Only remove fallback code for modules that have stable tests and runtime smoke evidence. Preserve fallback for entrypoint boot and any direct-file compatibility path still required.

- [ ] **Step 2: Tighten bridge interface tests**

Runtime bridge tests must list every intended exported symbol and assert no deprecated names remain.

- [ ] **Step 3: Review and verify**

Run `npm run verify`, `./macos/build.command`, and browser smoke.

## Task 19: Module Entrypoint Migration

**Files:**
- Create: `src/main.js`
- Create: `tests/unit/main-entry.test.mjs`
- Modify: `index.html`
- Modify: `macos/build.command` if resource copying changes
- Modify: `docs/architecture-optimization-plan.md`
- Modify: `docs/superpowers/plans/2026-05-24-architecture-next-batches.md`
- Modify: `tests/unit/source-invariants.test.mjs`
- Modify: `progress.md`

- [ ] **Step 1: Add `src/main.js` bootstrap**

Create a module entry that imports the bridge and the browser host bootstrap in the intended order. Keep `audio.js` compatibility intact until `audio.js` itself is modularized.

- [ ] **Step 2: Switch `index.html` to the module entry**

Update `index.html` to load the new module entry only after tests prove the module entry preserves boot order. If a classic shim remains, it must be documented and minimal.

- [ ] **Step 3: Add entry tests**

Tests should assert the intended entry shape, macOS resources, and boot error handling. Rewrite old source invariants that required `game.js` to remain the active classic entry.

- [ ] **Step 4: Review and verify**

Run `npm run verify`, `./macos/build.command`, and browser smoke.

## Task 20: Type And Regression Hardening

**Files:**
- Modify: `package.json`
- Modify: existing `tests/unit/*.test.mjs`
- Create: additional focused tests only where gaps remain
- Modify: `docs/architecture-optimization-plan.md`
- Modify: `progress.md`

- [ ] **Step 1: Add lightweight static checks**

Add the smallest useful static validation available in this repo, such as stricter `node --check` coverage for new entry files and dependency-boundary source tests. Do not introduce TypeScript unless all prior tasks show the value outweighs churn.

- [ ] **Step 2: Add regression smoke coverage**

Add or document repeatable browser smoke scenarios for single-player, double-player, fire hook, pause/resume, shop purchase, and fixed seed text snapshots.

- [ ] **Step 3: Review and verify**

Run `npm run verify`, `./macos/build.command`, and browser smoke.

## Task 21: Final Architecture Documentation And Evidence

**Files:**
- Modify: `docs/architecture-optimization-plan.md`
- Modify: `docs/superpowers/plans/2026-05-24-architecture-next-batches.md`
- Modify: `progress.md`

- [ ] **Step 1: Update architecture docs**

Mark completed batches and record remaining intentionally deferred work, if any.

- [ ] **Step 2: Run final validation**

Run:

```bash
npm run verify
./macos/build.command
```

Then run browser smoke with `?seed=12345`, enter single-player mode, fire the hook, wait for gameplay, assert:
- `window.__goldMinerModulesReady === true`
- no `window.__goldMinerBootError`
- no renderer bridge error globals
- canvas is nonblank
- `window.render_game_to_text()` returns valid JSON with `phase`, `level`, `items`, hooks, score, and viewport
- console has no errors or warnings

- [ ] **Step 3: Final whole-branch review**

Dispatch a final code reviewer over the full diff. Fix any blocker or important issue before reporting completion.

---

## Per-Task Auto Review Prompt

Use this prompt after each task:

```text
Review the just-completed task in /Users/drew/Project/Gold Miner.
Do not modify files.
Check only this task's intended scope:
1. Does the implementation satisfy the task's file/API/runtime requirements?
2. Did it preserve gameplay behavior and existing entrypoints?
3. Are tests meaningful and targeted?
4. Are there canvas state leaks, global coupling, stale fallback paths, or weak bridge guards?
Return PASS or FAIL with concrete file/line findings.
```

## Browser Smoke Procedure

Use the in-app Browser when available. If the in-app pane is unavailable, use Playwright MCP as fallback.

1. Start local server:

```bash
python3 -m http.server 5173 --bind 127.0.0.1
```

2. Open:

```text
http://127.0.0.1:5173/?seed=12345
```

3. Start single-player mode and fire the hook.

4. Evaluate:

```js
() => {
  const canvas = document.querySelector("canvas");
  const modules = window.GoldMinerModules ?? {};
  const text = typeof window.render_game_to_text === "function"
    ? JSON.parse(window.render_game_to_text())
    : null;
  let nonblank = false;
  if (canvas) {
    const ctx = canvas.getContext("2d");
    const data = ctx.getImageData(0, 0, Math.min(canvas.width, 64), Math.min(canvas.height, 64)).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] !== 0) {
        nonblank = true;
        break;
      }
    }
  }
  return {
    modulesReady: window.__goldMinerModulesReady === true,
    hasModules: Object.keys(modules).length,
    bootError: window.__goldMinerBootError ?? null,
    canvas: canvas ? { width: canvas.width, height: canvas.height, nonblank } : null,
    text,
    rendererErrors: Object.fromEntries(
      Object.keys(window)
        .filter((key) => key.startsWith("__goldMiner") && key.endsWith("RendererError"))
        .map((key) => [key, window[key]]),
    ),
  };
}
```

5. Save a canvas screenshot under `output/` for the task when rendering changed.
