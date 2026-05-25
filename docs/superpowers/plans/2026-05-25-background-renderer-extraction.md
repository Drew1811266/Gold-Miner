# Background Renderer Extraction Plan

> Required execution style: Subagent-Driven Development with spec and quality review. This is a narrow Batch 6 follow-up, not a full renderer migration.

## Status

Completed.

## Goal

Move the preferred background and plank drawing path out of `game.js` into a pure Canvas renderer module while preserving the classic script entrypoint and local fallback behavior.

## Scope

Create a small, tested renderer boundary for:

- background image cover draw
- fallback sky / ground gradient
- animated stars
- underground dust shimmer
- light sweep
- vignette
- top plank / beam

Do not move item, hook, miner, winch, carry label, or FX drawing in this batch.

## Files

- Create `src/render/backgroundRenderer.js`
- Create `tests/unit/background-renderer.test.mjs`
- Modify `src/runtime/moduleBridge.js`
- Modify `tests/unit/runtime-bridge.test.mjs`
- Modify `game.js`
- Modify `tests/unit/source-invariants.test.mjs`
- Update architecture docs and `progress.md`

## Renderer API

Export:

```js
drawBackgroundLayer({
  ctx,
  viewport,
  background,
  image,
  scene,
  colors,
  now,
})

drawPlankLayer({
  ctx,
  viewport,
  plankY,
  plankHeight,
  colors,
})
```

Rules:

- No DOM access.
- No `window`, `document`, `Audio`, or gameplay mutation.
- No reading global `game`.
- Validate required structural inputs.
- Use the provided `ctx` only.

## Runtime Wiring

- `GoldMinerModules` exposes `drawBackgroundLayer` and `drawPlankLayer`.
- `game.js` keeps `drawBackground()` and `drawPlank()` as runtime wrappers.
- The wrappers prefer bridge helpers and fall back to local drawing if the bridge is absent or throws.
- Bridge failures must be latched once per page lifecycle to avoid repeated per-frame exceptions and warnings.

## Tests

- Unit-test `drawBackgroundLayer` fallback gradient / scene effects / image cover path with a fake canvas context.
- Unit-test `drawPlankLayer` call shape.
- Extend runtime bridge tests to assert exports.
- Extend source invariants so `drawBackground()` and `drawPlank()` prefer bridge helpers and include one-shot fallback latches.

## Verification

Run:

```bash
node --test tests/unit/background-renderer.test.mjs tests/unit/runtime-bridge.test.mjs tests/unit/source-invariants.test.mjs
npm run verify
./macos/build.command
```

Then run browser smoke:

- Open `http://127.0.0.1:5173/?seed=12345`.
- Wait for `window.__goldMinerModulesReady === true`.
- Start single-player mode.
- Fire with Space.
- Confirm no boot/render errors.
- Confirm canvas is nonblank and visually inspect a gameplay screenshot.

## Completion Boundary

This batch is complete when the preferred background/plank rendering path runs through `src/render/backgroundRenderer.js`, local fallback remains available, and browser smoke shows the scene still renders.

## Completion Notes

- `src/render/backgroundRenderer.js` provides `drawBackgroundLayer()` and `drawPlankLayer()`.
- `GoldMinerModules` exposes both renderer helpers.
- `game.js` keeps wrapper functions with one-shot bridge failure latches and local fallback drawing.
- Item, hook, miner, winch, carry label, and FX drawing remain intentionally out of scope.
