# Gold Miner Architecture Refactor Next Batches Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:writing-plans` to expand each batch into a task-by-task implementation plan before execution. Use `superpowers:subagent-driven-development` for execution.

**Goal:** Plan the remaining architecture refactor batches after Batch 1 so the game can move from a single large `game.js` toward tested runtime modules without changing gameplay rules unexpectedly.

**Architecture:** Continue the strangler-style migration started in Batch 1. Each batch must move one responsibility boundary at a time, keep the current browser and macOS entrypoints working, and use fixed-seed evidence before and after runtime rewiring.

**Tech Stack:** Browser JavaScript, ES modules, Node built-in test runner, Canvas 2D, WebAudio, Swift WebView wrapper for macOS packaging.

---

## Current Baseline

Batch 1, Batch 2, and Batch 3 are complete and intentionally conservative.
Batch 4 first stage is complete and intentionally stops at the command boundary adapter.
Batch 5 first stage is complete and intentionally stops at a runtime event queue plus side-effect adapters.
Batch 6 first stage is complete and intentionally stops at render frame orchestration, leaving concrete draw functions in `game.js`.
Batch 7 Task 19 has introduced the module entry while keeping `audio.js` classic and keeping `game.js` as the imported browser host.

Completed:

- Added `package.json` verification scripts.
- Added stable fixed-seed baseline fixtures.
- Added source invariant tests for the runtime entry, now covering classic `audio.js` plus module `src/main.js`.
- Extracted pure modules under `src/`:
  - `src/core/rng.js`
  - `src/core/geometry.js`
  - `src/config/balance.js`
  - `src/systems/marketSystem.js`
  - `src/systems/ddaSystem.js`
- Added `src/runtime/moduleBridge.js` to expose shared pure modules through `window.GoldMinerModules`.
- Updated `game.js` to use dynamic import for the bridge before boot, rather than adding an `index.html` module script.
- Wired low-risk runtime logic through the bridge first: geometry, RNG, market, DDA, and `updateDdaRating`.
- Extracted level/item generation modules:
  - `src/config/items.js`
  - `src/config/levels.js`
  - `src/systems/valueSystem.js`
  - `src/systems/itemFactory.js`
  - `src/systems/levelGenerator.js`
- Wired `game.js` level setup through `GoldMinerModules.generateLevelData()` while retaining legacy fallback generation.
- Added command boundary modules:
  - `src/state/commands.js`
  - `src/state/selectors.js`
  - `src/state/commandDispatcher.js`
  - `src/systems/inventorySystem.js`
- Exposed command/selectors/inventory/dispatcher helpers through `src/runtime/moduleBridge.js`.
- Routed primary UI, keyboard, pointer, overlay, and shop inputs through `dispatchCommand(rawCommand)` in `game.js`.
- Added event boundary modules:
  - `src/events/eventTypes.js`
  - `src/events/eventQueue.js`
  - `src/audio/audioEvents.js`
  - `src/ui/uiEvents.js`
  - `src/fx/fxEvents.js`
  - `src/runtime/eventApplication.js`
- Exposed event primitives, adapters, and bridge-fallback event application helpers through `src/runtime/moduleBridge.js`.
- Added a runtime event queue in `game.js` and migrated selected audio, UI, overlay, shop, FX, bomb, hook, countdown, and score-pop side effects through event helpers.
- Added first-stage render pipeline modules:
  - `src/render/renderPipeline.js`
- Exposed render ordering and frame orchestration helpers through `src/runtime/moduleBridge.js`.
- Routed `game.js` `render()` through `GoldMinerModules.renderFrameWithLayers(...)` with a local fallback that preserves classic direct-file behavior.
- Updated `macos/build.command` to copy `src/` into App Resources.
- Introduced `src/main.js` as the module entry after `audio.js`, while leaving `game.js` as the imported browser host.
- Kept legacy fallback paths for direct file launch and bridge-load failures.

Remaining architectural risk:

- Runtime state transitions, concrete drawing functions, scene generation, and most adapter implementations still live in `game.js`.
- Command handlers still call existing `game.js` runtime functions, but selected side effects now route through the runtime event queue.
- Extracted modules are still exposed through the Runtime Module Bridge, now installed by the first-class `src/main.js` module entry.
- `game.js` and `src/` still contain temporary duplicated legacy fallback logic.
- Concrete rendering, state mutation, scene generation, and test hooks are still coupled.

---

## Batch 2: Runtime Module Bridge

Status: Completed.

### Objective

Started consuming the Batch 1 pure modules from the running game while preserving the existing `audio.js` + `game.js` script entry.

This batch reduced duplication without converting the whole app to `type="module"` yet.

### Why This Comes Next

The largest previous risk was drift between the extracted modules and the old in-file implementations. Before deeper extraction, the running game needed to prove it could use shared logic.

### Completed Scope

Created a small bridge that allows `game.js` to consume tested pure logic while the page still boots through the current script tags.

Implemented files:

- Created `src/runtime/moduleBridge.js`
- Modified `game.js`
- Modified `macos/build.command`
- Modified tests covering source invariants and runtime bridge behavior

### Actual Design

Decision at Batch 2 time: `game.js` used dynamic import for the bridge. It did not add an `index.html` module script, and it did not introduce `src/main.js`.

The superseded option was an `index.html` module script before `game.js`:

```html
<script type="module" src="./src/runtime/moduleBridge.js"></script>
```

The completed Batch 2 implementation intentionally chose a lower-risk runtime shape:

- `game.js` uses dynamic import for `src/runtime/moduleBridge.js` before boot.
- `moduleBridge.js` imports tested modules and exposes a single stable namespace:
  - `window.GoldMinerModules`
- `game.js` reads from `window.GoldMinerModules` if present, with temporary fallback to existing local functions during the transition.
- `index.html` stayed on the classic `audio.js` + `game.js` script entry and did not add a module script.

Current note after Batch 7 Task 19:

- `index.html` now loads classic `audio.js` followed by module `src/main.js`.
- `src/main.js` imports `src/runtime/moduleBridge.js` first, then imports `../game.js`.
- `game.js` still keeps its dynamic bridge fallback for direct-host compatibility and debugging.

Avoid in this batch:

- Did not replace `game.js` with `src/main.js` in Batch 2; Batch 7 later added `src/main.js` as a bootstrap wrapper rather than deleting the host.
- Did not move the animation loop.
- Did not move rendering.
- Did not rewrite game state shape.

### Runtime Logic Wired First

Wired only low-risk pure functions:

- `createRng`
- `clamp`
- `lerp`
- `dist2`
- `segmentCircleIntersect`
- `formatMarketDelta`
- `createMarketDay`
- DDA constants and pure DDA functions
- `updateDdaRating`

### Completion Notes

- The game now boots through `index.html` with classic `audio.js` plus the module entry.
- macOS bundle now includes `src/` resources for the bridge and its imported modules.
- Stable fallback paths remain available for direct file launch.
- A reviewer can point to runtime call sites using `window.GoldMinerModules`.

### Remaining Risks

- `game.js` still owns level generation, item creation, and most runtime mutation.
- Temporary duplicated logic still exists outside the bridge-covered functions.
- Further extraction must preserve fixed-seed evidence and direct-launch compatibility.

---

## Batch 3: Level And Item Generation Extraction

Status: Completed.

### Objective

Move level configuration, item spec creation, market-adjusted values, and placement generation out of `game.js` into pure or mostly pure modules.

### Why This Comes After Batch 2

Level generation depends on RNG, DDA, market multipliers, geometry helpers, and balance constants. Those must be shared by runtime first.

### Completed Scope

Implemented files:

- Created `src/config/items.js`
- Created `src/config/levels.js`
- Created `src/systems/valueSystem.js`
- Created `src/systems/itemFactory.js`
- Created `src/systems/levelGenerator.js`
- Modified `src/runtime/moduleBridge.js`
- Modified `game.js`
- Added `tests/unit/level-generator.test.mjs`
- Updated `tests/unit/source-invariants.test.mjs`

### Boundary

`levelGenerator` returns data. It does not directly mutate DOM, Canvas, audio, or overlay UI.

Implemented pure API:

```js
export function getLevelConfig(level) {}
export function createItemSpec({ type, size, level, rng, marketMultipliers, levelValueMultiplier, dda }) {}
export function generateLevelData({ level, runSeed, viewport, mode, ddaRating, extraBags }) {}
```

Runtime adapter in `game.js`:

```js
const levelData = GoldMinerModules.generateLevelData({
  level: game.level,
  runSeed: game.runSeed,
  viewport: game.viewport,
  mode: game.mode,
  ddaRating: game.dda.rating,
  extraBags: options.extraBags ?? 0,
});

applyGeneratedLevel(game, levelData);
```

### Completion Notes

- `generateLevelData()` is unit-tested without browser globals.
- Fixed seed generation produces deterministic high-level data for a fixed viewport.
- Runtime level starts work through the bridge in browser smoke testing.
- `game.js` no longer owns the preferred item mix construction or market-adjusted value calculation path.
- Existing gameplay balance was preserved against the fixed seed baseline.
- Legacy inline generation remains after the bridge path and is used if the bridge generator throws.

### Remaining Risks

- Rendering, scene generation, input, HUD, audio, FX, and mutable state orchestration remain in `game.js`.
- The module bridge remains transitional; later batches should decide when to remove duplicated fallback logic.
- Browser-level failure-path coverage can be expanded beyond source invariants.

---

## Batch 4: State And Command Boundary

Status: Completed first stage.

### Objective

Introduce an explicit game state module and command reducer-style boundary so input, buttons, keyboard, and pointer events no longer mutate scattered state directly.

### Why This Comes After Level Generation

Once level setup is data-driven, state transitions become easier to isolate. This prevents input/UI extraction from pulling level generation back into `game.js`.

### Completed First-Stage Scope

Implemented files:

- Created `src/state/commands.js`
- Created `src/state/selectors.js`
- Created `src/state/commandDispatcher.js`
- Created `src/systems/inventorySystem.js`
- Modified `src/runtime/moduleBridge.js`
- Modified `game.js`
- Added command, selector, inventory, dispatcher, runtime bridge, and source invariant tests

Deferred from the larger target:

- `src/state/createInitialState.js`
- Full reducer-style `src/state/applyCommand.js`
- `src/systems/hookSystem.js`
- Full state ownership migration

### Command Examples

```js
export const CommandType = Object.freeze({
  START_GAME: "START_GAME",
  TOGGLE_PAUSE: "TOGGLE_PAUSE",
  FIRE_HOOK: "FIRE_HOOK",
  USE_BOMB: "USE_BOMB",
  SELECT_MODE: "SELECT_MODE",
  BUY_SHOP_ITEM: "BUY_SHOP_ITEM",
});
```

Commands should be plain data:

```js
{ type: "FIRE_HOOK", payload: { player: 0 } }
{ type: "USE_BOMB", payload: {} }
{ type: "BUY_SHOP_ITEM", payload: { itemId: "bomb" } }
```

### Completed Acceptance Criteria

- Keyboard/button/pointer handlers create commands instead of directly calling many gameplay functions.
- `dispatchGameCommand({ rawCommand, state, handlers, ... })` is unit-tested for common commands and guard behavior.
- `game.js` remains the runtime host but has fewer direct mutation entrypoints.
- Existing `window.advanceTime(ms)` still works.
- Pause, restart, start, bomb, mode selection, and hook firing behavior remain intact.

### Remaining Risks

- The first stage deliberately avoided a full immutable reducer.
- UI overlay actions still close over runtime handlers through `dispatchCommand()`.
- Handler internals still perform audio, HUD, overlay, and FX side effects directly.

---

## Batch 5: Event Bus For Side Effects

Status: Completed first stage.

### Objective

Separate gameplay decisions from side effects such as audio, HUD bumps, overlays, particles, shake, flash, and market ticker changes.

### Why This Comes After Commands

Commands describe intent; events describe what happened. Once commands are centralized, it becomes natural to emit side-effect events from systems and consume them in adapters.

### Completed First-Stage Scope

Implemented files:

- Created `src/events/eventTypes.js`
- Created `src/events/eventQueue.js`
- Created `src/audio/audioEvents.js`
- Created `src/ui/uiEvents.js`
- Created `src/fx/fxEvents.js`
- Created `src/runtime/eventApplication.js`
- Modified `src/runtime/moduleBridge.js`
- Modified `game.js`
- Added `tests/unit/events.test.mjs`
- Updated `tests/unit/runtime-bridge.test.mjs`
- Updated `tests/unit/source-invariants.test.mjs`

### Event Examples

```js
{ type: "AUDIO_PLAY", name: "hook_shoot" }
{ type: "AUDIO_PLAY", name: "score", options: { amount: 320 } }
{ type: "FX_BURST", x: 420, y: 360, color: "#ffd34d" }
{ type: "HUD_BUMP", target: "score" }
{ type: "OVERLAY_SHOW", variant: "level-complete" }
```

### Completed Acceptance Criteria

- Selected gameplay/runtime paths enqueue events instead of directly calling `audioPlay`, `updateHud`, `showOverlay`, `renderShop`, `spawnRing`, `spawnBurst`, score-pop, shake, or flash functions.
- Audio calls are routed through `audioEvents.js` and runtime audio handlers.
- UI and FX side effects are still performed by the runtime host.
- Unit tests cover event primitives, queues, adapters, bridge exports, adapter fallback behavior, and source invariants for migrated gameplay side effects.
- Existing audio toggle and music controls still work.

### Remaining Risks

- This is a first-stage side-effect boundary. Event handlers still live in `game.js`.
- Gameplay state mutation has not moved into pure systems yet.
- Rendering and scene generation still read and mutate runtime globals directly.
- Later batches should avoid over-expanding the event system beyond cross-system side effects.

---

## Batch 6: Render Layer Split

Status: Completed first stage.

### Objective

Move Canvas rendering functions out of `game.js` into focused renderer modules without changing visual output intentionally.

### Why This Comes After Events

Rendering currently reads many global state fields and also competes with FX state. Events and state selectors should be in place before splitting draw code.

### Completed First-Stage Scope

Implemented files:

- Created `src/render/renderPipeline.js`
- Added `tests/unit/render-pipeline.test.mjs`
- Modified `src/runtime/moduleBridge.js`
- Modified `game.js`
- Updated `tests/unit/runtime-bridge.test.mjs`
- Updated `tests/unit/source-invariants.test.mjs`

Deferred from the larger target:

- `src/render/backgroundRenderer.js`
- `src/render/itemRenderer.js`
- `src/render/hookRenderer.js`
- `src/render/minerRenderer.js`
- `src/render/fxRenderer.js`
- Render snapshot construction outside `game.js`

### Renderer Boundary

Renderers may read a render snapshot and draw to a provided context:

```js
export function renderFrame(ctx, snapshot, assets) {}
```

Renderers must not:

- Change score, level, inventory, market, or DDA.
- Fire audio.
- Attach DOM listeners.
- Advance gameplay time.

### Completed Acceptance Criteria

- `render()` in `game.js` now assembles render options and calls `GoldMinerModules.renderFrameWithLayers(...)`.
- `src/render/renderPipeline.js` owns player render ordering, layer call order, frame clear/transform, flash overlay, and countdown overlay.
- `src/render/backgroundRenderer.js` now owns the preferred background and plank drawing path behind `drawBackground()` / `drawPlank()` wrappers.
- `src/render/itemLayerRenderer.js` now owns item layer ordering behind the `drawItems()` wrapper; concrete `drawItem()` geometry remains local.
- `src/render/hookLayerRenderer.js` now owns hook player layer dispatch for `hookTrail`, `hook`, and `carryLabel`; concrete hook claw and carry label drawing geometry remains local.
- `src/render/hookTrailRenderer.js` now owns hook trail segment glow/highlight drawing behind the `drawHookTrail()` wrapper.
- Local render fallback remains available when the bridge helper is missing or throws.
- Source invariants prevent `render()` from re-owning the full inline layer loop.
- Canvas rendering still works on desktop and mobile viewport sizes.
- Browser smoke screenshot shows nonblank gameplay.
- macOS build still succeeds.
- Render modules have no dependency on `window.GameAudio` or DOM event listeners.

### Remaining Risks

- Concrete `drawItem()` geometry plus hook claw, carry label, miner, winch, and FX draw functions still live in `game.js`.
- Visual regressions are still easy to miss; each follow-up render extraction needs screenshot-based verification.
- Background asset loading still lives near rendering and boot logic; keep it as an adapter while the remaining concrete renderer modules are split.

---

## Batch 7: UI, Input, Audio, And Test Harness Cleanup

### Objective

Finish separation of runtime adapters: DOM UI, input binding, audio adapter, browser test hooks, and build/package verification.

### Why This Is Late

These adapters sit at the edge of the application. They should be thin only after state, commands, events, and rendering are already separated.

### Proposed Scope

Candidate files:

- Create UI adapter modules such as `src/ui/domUiAdapter.js` and `src/ui/inputAdapter.js`
- Create audio adapter modules such as `src/audio/audioAdapter.js`
- Create browser test hook modules such as `src/testing/debugApi.js`
- Create `src/main.js`
- Modify `index.html`
- Modify `game.js`
- Modify `macos/build.command`
- Add browser-level smoke tests if not already added

### End-State Entry

At the end of this batch, the runtime can move from:

```html
<script src="./audio.js"></script>
<script src="./game.js"></script>
```

to:

```html
<script src="./audio.js"></script>
<script type="module" src="./src/main.js"></script>
```

This is now implemented as a bootstrap wrapper: `src/main.js` installs the bridge and imports `game.js`; `game.js` remains the browser host until the remaining host glue can be moved safely.

### Acceptance Criteria

- `src/main.js` owns app bootstrapping.
- `game.js` is imported by `src/main.js` and retains only compatibility fallback responsibilities that have not yet been migrated.
- DOM input mapping is centralized in `src/ui/inputAdapter.js`; listener registration remains in the browser host.
- Browser test hooks are centralized and documented.
- macOS build copies all required `src/`, `assets/`, CSS, HTML, and JS files.
- `npm run verify` and macOS build both pass.

### Main Risks

- This is the highest integration-risk batch because the entrypoint changes.
- Browser and macOS packaging must be verified together.
- Any lingering global dependency in extracted modules will surface here.

---

## Batch 8: Type Safety And Regression Hardening

### Objective

Add type checking, dependency boundary checks, and broader regression coverage after the runtime has been modularized.

### Proposed Scope

Candidate files:

- Add `jsconfig.json` or `tsconfig.json` with `checkJs` only if the value outweighs the churn; current hardening expands `node --check` first
- Add JSDoc typedefs under `src/types/` when a boundary starts needing shared structural contracts
- Add dependency boundary tests under `tests/unit/dependency-boundaries.test.mjs`
- Add or document browser smoke tests for:
  - boot
  - single-player start
  - two-player start
  - fire hook
  - pause/resume
  - shop flow
  - deterministic seed load
- Keep launcher scripts aligned with the module entry by using a local static server instead of direct `file://` loading
- Update docs

### Acceptance Criteria

- `npm run verify` syntax-checks the browser host, classic audio facade, `src/**/*.js`, and `tests/unit/**/*.mjs`.
- Tests enforce architectural boundaries:
  - `core/` cannot import `ui/`, `render/`, or `audio/`
  - `systems/` cannot import DOM or Canvas adapters
  - `render/` cannot mutate gameplay state
  - `audio/` consumes events only
- A new contributor can run documented commands for syntax/unit verification, browser smoke, and macOS packaging; browser smoke remains a separate manual/MCP step until an automated script is added.
- `run.command`, `start.sh`, and `start.bat` launch through a local static server so the ES module entry works in normal browsers.

### Main Risks

- Full TypeScript migration may not be worth the churn immediately. Start with `// @ts-check` and JSDoc.
- Browser smoke tests must be stable and not overfit to animation timing.

---

## Recommended Execution Order

1. Batch 3: Level And Item Generation Extraction (completed)
2. Batch 4: State And Command Boundary (completed first stage)
3. Batch 5: Event Bus For Side Effects (completed first stage)
4. Batch 6: Render Layer Split (completed first stage plus concrete renderer follow-ups)
5. Batch 7: UI, Input, Audio, And Test Harness Cleanup (completed for UI/input/audio/debug/state entry scope)
6. Batch 8: Type Safety And Regression Hardening (completed as lightweight checks, dependency boundaries, and documented browser smoke)

Batch 2 through Batch 8 are complete for the scope described in this plan. The runtime now boots through `src/main.js`, while `game.js` remains the browser host for remaining glue and fallback paths.

The entrypoint migration happened after the prior decoupling batches, not as the first move.

---

## Batch Size Guidance

Keep every batch independently shippable:

- One branch per batch.
- One implementation plan per batch.
- One final reviewer per batch.
- No batch should require changing gameplay rules.
- If a batch needs gameplay behavior changes, split that change into its own explicit feature branch.

Suggested commit rhythm inside each batch:

1. Add failing or protective tests.
2. Add the new module.
3. Wire runtime through the module.
4. Remove or mark duplicate legacy logic.
5. Update docs and verification evidence.

---

## Verification Contract For Every Batch

Minimum checks:

```bash
npm run verify
./macos/build.command
```

Runtime checks:

- Browser boot still works from `index.html`.
- `window.render_game_to_text()` still returns valid JSON.
- `window.advanceTime(1000)` still advances without throwing.
- Stable baseline fixtures still pass, or the batch explicitly documents why a fixture changed.

For batches that touch rendering or entrypoints:

- Capture at least one browser screenshot.
- Confirm the canvas is nonblank.
- Confirm desktop and mobile viewport layouts do not overlap core controls.

---

## Stop Conditions

Pause the batch and re-plan if any of these happen:

- A task requires changing core gameplay rules to complete an architecture migration.
- Stable baseline changes without an intentional, documented reason.
- macOS package cannot find runtime assets.
- Module imports require circular dependencies.
- `game.js` needs a broad rewrite larger than the batch boundary.
- A subagent reviewer finds a P0 or P1 issue.

---

## Historical Open Decisions Before Batch 3

These decisions were resolved during execution and are kept here as historical context.

1. Should level generation tests assert exact item placement?

   Recommended: only assert exact placement when viewport is pinned. For general fixed-seed baselines, keep stable summaries that do not depend on viewport size.

2. Should item art generation move with level data, or stay in `game.js` for one more batch?

   Recommended: keep rendering-adjacent art details in `game.js` unless they are already pure data. Batch 3 should focus on level config, item spec creation, market-adjusted values, and placement generation.

3. Should `game.js` duplicate functions be deleted immediately after Batch 3 wiring, or kept as wrappers for one batch?

   Recommended: convert duplicates to wrappers first, then delete them after browser and macOS verification.

4. Should TypeScript be introduced before the entrypoint migration?

   Recommended: no. Use JSDoc and boundary tests first. Re-evaluate TypeScript after Batch 7.
