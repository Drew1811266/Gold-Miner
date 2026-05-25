# Item Layer Extraction Plan

> Required execution style: Subagent-Driven Development with spec and quality review. This is a narrow Batch 6 follow-up, not a full `drawItem()` migration.

## Status

Completed.

## Goal

Move item layer ordering out of `game.js` into a pure render module while preserving the existing concrete item drawing implementation.

## Why This Scope

`drawItem()` currently owns detailed geometry for gold, rock, gems, bags, pouches, kegs, fossils, and mice. Moving all of that in one step would create a large visual regression surface. This batch extracts only the stable orchestration around item drawing:

- non-attached items draw first
- non-attached items are ordered by `y`
- attached items draw after scene items
- attached items follow hook order
- no item is drawn twice if hooks point at the same attached id

## Files

- Create `src/render/itemLayerRenderer.js`
- Create `tests/unit/item-layer-renderer.test.mjs`
- Modify `src/runtime/moduleBridge.js`
- Modify `tests/unit/runtime-bridge.test.mjs`
- Modify `game.js`
- Modify `tests/unit/source-invariants.test.mjs`
- Update architecture docs and `progress.md`

## Renderer API

Export:

```js
createItemRenderOrder({
  items,
  hooks,
})

drawItemsLayer({
  items,
  hooks,
  drawItem,
})
```

Rules:

- No DOM access.
- No `window`, `document`, `Audio`, Canvas globals, or global `game`.
- Do not mutate `items` or `hooks`.
- `drawItemsLayer()` calls the provided `drawItem(item, metadata)` callback in computed order.
- Return the computed render order for tests and future instrumentation.

## Runtime Wiring

- `GoldMinerModules` exposes `createItemRenderOrder()` and `drawItemsLayer()`.
- `game.js` keeps `drawItems()` as a runtime wrapper.
- `drawItems()` prefers `GoldMinerModules.drawItemsLayer()` and falls back to local ordering if the bridge is absent or throws.
- Bridge failures are latched once per page lifecycle to avoid repeated render-frame exceptions.
- `drawItem()` remains in `game.js`.

## Tests

- Unit-test item order with mixed `y` values.
- Unit-test attached items draw after scene items.
- Unit-test duplicate attached ids are not drawn twice.
- Unit-test no mutation of `items` / `hooks`.
- Extend runtime bridge tests to assert exports.
- Extend source invariants so `drawItems()` is a bridge-first wrapper and `drawItem()` remains local.

## Verification

Run:

```bash
node --test tests/unit/item-layer-renderer.test.mjs tests/unit/runtime-bridge.test.mjs tests/unit/source-invariants.test.mjs
npm run verify
./macos/build.command
```

Then run browser smoke:

- Open `http://127.0.0.1:5173/?seed=12345`.
- Wait for `window.__goldMinerModulesReady === true`.
- Start single-player mode.
- Fire with Space.
- Confirm `window.GoldMinerModules.drawItemsLayer` exists.
- Confirm no boot/render/item renderer errors.
- Confirm canvas is nonblank and visually inspect gameplay screenshot.

## Completion Boundary

This batch is complete when `drawItems()` delegates item ordering to `src/render/itemLayerRenderer.js`, local fallback remains available, `drawItem()` stays local, and browser smoke shows items still render.

## Completion Notes

- `src/render/itemLayerRenderer.js` provides `createItemRenderOrder()` and `drawItemsLayer()`.
- `GoldMinerModules` exposes both item layer helpers.
- `game.js` keeps `drawItems()` as a bridge-first wrapper with one-shot failure latch and local fallback.
- `drawItem()` geometry remains intentionally local in `game.js`.
