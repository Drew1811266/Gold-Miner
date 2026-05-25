# Render Layer Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move first-stage Canvas frame orchestration out of `game.js` into a tested render pipeline module without intentionally changing visuals or switching the classic entrypoint.

**Architecture:** Keep concrete drawing functions in `game.js` for this first render batch, but move the frame pipeline boundary to `src/render/renderPipeline.js`. `game.js` will create a small render context and layer handler object, then call `GoldMinerModules.renderFrameWithLayers(...)` through the existing runtime bridge. A local fallback preserves direct-file and bridge-failure behavior.

**Tech Stack:** Browser JavaScript, ES modules, Canvas 2D, Node built-in test runner, Runtime Module Bridge, Playwright/Browser smoke checks.

---

## Context

Batch 5 completed a first-stage event boundary. The next architectural risk is that `game.js` still owns rendering orchestration and all concrete Canvas drawing. Moving every `draw*` function at once is too risky because visual output is large and animation-sensitive.

This batch intentionally splits only the frame orchestration:

- clear/reset canvas
- apply DPR and shake transform
- sort players for stable draw order
- call render layers in the existing order
- draw flash overlay
- draw countdown warning overlay

Concrete drawing functions such as `drawBackground()`, `drawItem()`, `drawHook()`, `drawMinerBack()`, `drawMinerFront()`, and `drawFx()` remain in `game.js` and are passed as layer callbacks.

## File Structure

- Create `src/render/renderPipeline.js`
  - Owns player render ordering and frame layer orchestration.
  - Must not import DOM, `window.GameAudio`, gameplay systems, or concrete drawing functions.
- Create `tests/unit/render-pipeline.test.mjs`
  - Unit tests layer order, player sorting, transform calls, flash overlay, countdown overlay, and optional layer safety.
- Modify `src/runtime/moduleBridge.js`
  - Expose `createPlayerRenderOrder` and `renderFrameWithLayers`.
- Modify `tests/unit/runtime-bridge.test.mjs`
  - Assert bridge exports the render pipeline helpers.
- Modify `game.js`
  - Add local render fallback helpers.
  - Reduce `render()` to context assembly plus bridge call.
  - Preserve existing concrete drawing functions.
- Modify `tests/unit/source-invariants.test.mjs`
  - Assert render orchestration is routed through the render pipeline and that classic entry remains unchanged.
- Modify docs:
  - `docs/architecture-optimization-plan.md`
  - `docs/superpowers/plans/2026-05-24-architecture-next-batches.md`
  - `progress.md`

---

## Task 1: Render Pipeline Module

**Files:**

- Create: `src/render/renderPipeline.js`
- Create: `tests/unit/render-pipeline.test.mjs`

### Steps

- [ ] Add unit tests for player ordering and layer execution.
- [ ] Implement `createPlayerRenderOrder({ hooks, getMinerByIndex, getPivot })`.
- [ ] Implement `renderFrameWithLayers(options)`.
- [ ] Ensure `renderFrameWithLayers` calls layers in this exact order:
  - `background`
  - `plank`
  - `minerBack` for sorted players
  - `winch` for sorted players
  - `minerFront` for sorted players
  - `items`
  - `hookTrail` for sorted players
  - `hook` for sorted players
  - `carryLabel` for sorted players
  - `fx`
  - flash overlay
  - countdown overlay
- [ ] Run:

```bash
node --test tests/unit/render-pipeline.test.mjs
```

Expected: pass.

## Task 2: Runtime Bridge Exposure

**Files:**

- Modify: `src/runtime/moduleBridge.js`
- Modify: `tests/unit/runtime-bridge.test.mjs`

### Steps

- [ ] Import render helpers from `../render/renderPipeline.js`.
- [ ] Add `createPlayerRenderOrder` and `renderFrameWithLayers` to `GoldMinerModules`.
- [ ] Extend bridge export assertions.
- [ ] Run:

```bash
node --test tests/unit/runtime-bridge.test.mjs tests/unit/render-pipeline.test.mjs
```

Expected: pass.

## Task 3: Runtime Render Wiring

**Files:**

- Modify: `game.js`
- Modify: `tests/unit/source-invariants.test.mjs`

### Steps

- [ ] Add `createRenderPlayers()` in `game.js` that uses `GoldMinerModules.createPlayerRenderOrder` when available and falls back locally.
- [ ] Add `renderFrameWithLocalLayers(options)` as the bridge-failure fallback.
- [ ] Add `renderLayerHandlers()` or equivalent to pass existing concrete draw functions as callbacks.
- [ ] Change `render()` to call `GoldMinerModules.renderFrameWithLayers(...)` when available, catch bridge errors once, and then use `renderFrameWithLocalLayers(...)`.
- [ ] Keep concrete `draw*` functions unchanged unless needed for callback binding.
- [ ] Add source invariant assertions that `render()` references `GoldMinerModules.renderFrameWithLayers`, `renderFrameWithLocalLayers`, and layer handlers rather than owning all orchestration inline.
- [ ] Run:

```bash
node --test tests/unit/source-invariants.test.mjs tests/unit/render-pipeline.test.mjs
```

Expected: pass.

## Task 4: Docs, Browser Smoke, And Final Verification

**Files:**

- Modify: `docs/architecture-optimization-plan.md`
- Modify: `docs/superpowers/plans/2026-05-24-architecture-next-batches.md`
- Modify: `progress.md`

### Steps

- [ ] Update docs to mark Batch 6 as first-stage complete only after implementation verification.
- [ ] Run:

```bash
npm run verify
./macos/build.command
```

Expected: both pass.

- [ ] Run browser smoke from `http://127.0.0.1:5173/?seed=12345`:
  - boot page
  - choose single-player mode
  - fire hook with Space
  - inspect `window.render_game_to_text()`
  - capture and inspect a nonblank canvas screenshot
  - confirm no console errors

Expected: game boots, canvas renders, hook state changes after input, no console errors.

## Completion Notes

This batch is complete when:

- `renderFrameWithLayers` is the preferred runtime render orchestration path.
- Concrete drawing functions still produce the existing visual output.
- Browser smoke confirms nonblank gameplay render.
- Documentation clearly states this is a first-stage render split, not a complete renderer extraction.
