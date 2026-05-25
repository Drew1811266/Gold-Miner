# Event Bus For Side Effects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a small event queue so selected audio, UI, overlay, shop, and FX side effects are routed through event objects instead of being scattered direct calls.

**Architecture:** Keep `game.js` as the runtime host. Add pure event modules under `src/events/`, plus thin audio/UI/FX event adapters. Expose the event helpers through `src/runtime/moduleBridge.js`, then add a runtime event queue in `game.js` that drains events into the existing side-effect functions. This is a first-stage event boundary, not a full engine rewrite.

**Tech Stack:** Browser JavaScript, ES modules, Node built-in test runner, Canvas 2D, WebAudio, Runtime Module Bridge.

---

## Context

Batch 4 is complete at first-stage command boundary:

- UI, keyboard, pointer, overlay, and shop inputs now enter through `dispatchCommand(rawCommand)`.
- `game.js` still owns runtime state, rendering, audio calls, HUD/overlay DOM, FX arrays, and the animation loop.
- `src/runtime/moduleBridge.js` exposes pure modules to the classic `audio.js` + `game.js` entry.

Batch 5 should make side effects observable and testable without changing gameplay rules. Keep the implementation deliberately small:

- Events are plain `{ type, payload }` objects.
- The queue is an in-memory array.
- Runtime handlers still live in `game.js`.
- Do not migrate to `src/main.js`.
- Do not split render modules.
- Do not remove legacy fallback paths.

## File Structure

- Create `src/events/eventTypes.js`
  - Owns `GameEventType`, `gameEvent()`, `isGameEvent()`, and `assertGameEvent()`.
- Create `src/events/eventQueue.js`
  - Owns `createEventQueue()`, `enqueueEvent()`, `drainEvents()`, `peekEvents()`, `clearEvents()`, and `hasPendingEvents()`.
- Create `src/audio/audioEvents.js`
  - Owns audio event factories and a thin adapter for audio handlers.
- Create `src/ui/uiEvents.js`
  - Owns HUD, overlay, and shop event factories and adapter routing.
- Create `src/fx/fxEvents.js`
  - Owns ring, burst, flash, shake, and score-pop event factories and adapter routing.
- Modify `src/runtime/moduleBridge.js`
  - Expose all event helpers through `GoldMinerModules`.
- Modify `game.js`
  - Add a runtime event queue, event enqueue helpers, `processGameEvents()`, and event handlers.
  - Migrate selected side effects to events.
- Add `tests/unit/events.test.mjs`
  - Unit tests for event types, queue behavior, and adapters.
- Modify `tests/unit/runtime-bridge.test.mjs`
  - Verify bridge exposes event helpers.
- Modify `tests/unit/source-invariants.test.mjs`
  - Verify `game.js` has an event queue and selected side effects route through events.
- Modify docs:
  - `docs/architecture-optimization-plan.md`
  - `docs/superpowers/plans/2026-05-24-architecture-next-batches.md`
  - `progress.md`

---

## Task 1: Event Primitives

**Files:**

- Create: `src/events/eventTypes.js`
- Create: `src/events/eventQueue.js`
- Create: `tests/unit/events.test.mjs`

### Steps

- [ ] **Step 1: Add event primitive tests**

Create `tests/unit/events.test.mjs` with tests for these exact APIs:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GameEventType,
  assertGameEvent,
  gameEvent,
  isGameEvent,
  isGameEventType,
} from "../../src/events/eventTypes.js";
import {
  clearEvents,
  createEventQueue,
  drainEvents,
  enqueueEvent,
  hasPendingEvents,
  peekEvents,
} from "../../src/events/eventQueue.js";

test("gameEvent creates immutable event objects with immutable payloads", () => {
  const event = gameEvent(GameEventType.AUDIO_PLAY, { name: "level_start" });

  assert.deepEqual(event, {
    type: "AUDIO_PLAY",
    payload: { name: "level_start" },
  });
  assert.ok(Object.isFrozen(event));
  assert.ok(Object.isFrozen(event.payload));
  assert.equal(isGameEvent(event), true);
  assert.equal(assertGameEvent(event), event);
});

test("event validation rejects unsupported and malformed events", () => {
  assert.equal(isGameEventType(GameEventType.HUD_UPDATE), true);
  assert.equal(isGameEventType("UNKNOWN"), false);
  assert.throws(() => gameEvent("UNKNOWN"), /Unsupported game event type/);
  assert.throws(() => gameEvent(GameEventType.AUDIO_PLAY, null), /payload must be an object/);
  assert.equal(isGameEvent({ type: GameEventType.AUDIO_PLAY, payload: [] }), false);
  assert.throws(() => assertGameEvent({ type: "UNKNOWN", payload: {} }), /Unsupported game event type/);
});

test("event queue enqueues peeks drains and clears without exposing internal array", () => {
  const queue = createEventQueue();
  const first = gameEvent(GameEventType.AUDIO_PLAY, { name: "ui_click" });
  const second = enqueueEvent(queue, GameEventType.HUD_UPDATE);

  assert.equal(hasPendingEvents(queue), true);
  assert.equal(enqueueEvent(queue, first), first);
  assert.deepEqual(peekEvents(queue), [second, first]);
  assert.notEqual(peekEvents(queue), queue.events);

  const drained = drainEvents(queue);
  assert.deepEqual(drained, [second, first]);
  assert.equal(hasPendingEvents(queue), false);

  enqueueEvent(queue, GameEventType.OVERLAY_HIDE);
  clearEvents(queue);
  assert.deepEqual(drainEvents(queue), []);
});
```

- [ ] **Step 2: Run tests and confirm they fail**

Run:

```bash
node --test tests/unit/events.test.mjs
```

Expected:

- FAIL because `src/events/eventTypes.js` and `src/events/eventQueue.js` do not exist yet.

- [ ] **Step 3: Implement `src/events/eventTypes.js`**

Create `src/events/eventTypes.js`:

```js
export const GameEventType = Object.freeze({
  AUDIO_PLAY: "AUDIO_PLAY",
  AUDIO_SYNC_BUTTONS: "AUDIO_SYNC_BUTTONS",
  HUD_UPDATE: "HUD_UPDATE",
  HUD_BUMP: "HUD_BUMP",
  OVERLAY_SHOW: "OVERLAY_SHOW",
  OVERLAY_HIDE: "OVERLAY_HIDE",
  SHOP_RENDER: "SHOP_RENDER",
  FX_RING: "FX_RING",
  FX_BURST: "FX_BURST",
  FX_FLASH: "FX_FLASH",
  FX_SHAKE: "FX_SHAKE",
  SCORE_POP: "SCORE_POP",
});

const GAME_EVENT_TYPES = new Set(Object.values(GameEventType));

export function isGameEventType(type) {
  return GAME_EVENT_TYPES.has(type);
}

export function gameEvent(type, payload = {}) {
  if (!isGameEventType(type)) {
    throw new RangeError(`Unsupported game event type: ${String(type)}`);
  }
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("game event payload must be an object");
  }

  return Object.freeze({
    type,
    payload: Object.freeze({ ...payload }),
  });
}

export function isGameEvent(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    isGameEventType(value.type) &&
    value.payload !== null &&
    typeof value.payload === "object" &&
    !Array.isArray(value.payload)
  );
}

export function assertGameEvent(value) {
  if (!isGameEvent(value)) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError("Expected a valid game event object");
    }
    if (!isGameEventType(value.type)) {
      throw new RangeError(`Unsupported game event type: ${String(value.type)}`);
    }
    throw new TypeError("game event payload must be an object");
  }
  return value;
}
```

- [ ] **Step 4: Implement `src/events/eventQueue.js`**

Create `src/events/eventQueue.js`:

```js
import { assertGameEvent, gameEvent } from "./eventTypes.js";

function assertQueue(queue) {
  if (queue === null || typeof queue !== "object" || !Array.isArray(queue.events)) {
    throw new TypeError("Expected a game event queue object");
  }
}

export function createEventQueue(initialEvents = []) {
  if (!Array.isArray(initialEvents)) {
    throw new TypeError("initialEvents must be an array");
  }
  return {
    events: initialEvents.map((event) => assertGameEvent(event)),
  };
}

export function enqueueEvent(queue, eventOrType, payload = {}) {
  assertQueue(queue);
  const event =
    typeof eventOrType === "string"
      ? gameEvent(eventOrType, payload)
      : assertGameEvent(eventOrType);
  queue.events.push(event);
  return event;
}

export function peekEvents(queue) {
  assertQueue(queue);
  return queue.events.slice();
}

export function drainEvents(queue) {
  assertQueue(queue);
  const drained = queue.events.slice();
  queue.events.length = 0;
  return drained;
}

export function clearEvents(queue) {
  assertQueue(queue);
  queue.events.length = 0;
}

export function hasPendingEvents(queue) {
  assertQueue(queue);
  return queue.events.length > 0;
}
```

- [ ] **Step 5: Run event primitive tests**

Run:

```bash
node --test tests/unit/events.test.mjs
```

Expected:

- PASS.

---

## Task 2: Audio UI And FX Event Adapters

**Files:**

- Create: `src/audio/audioEvents.js`
- Create: `src/ui/uiEvents.js`
- Create: `src/fx/fxEvents.js`
- Modify: `tests/unit/events.test.mjs`

### Steps

- [ ] **Step 1: Add adapter tests**

Append these tests to `tests/unit/events.test.mjs`:

```js
import {
  applyAudioEvents,
  audioPlayEvent,
  audioSyncButtonsEvent,
} from "../../src/audio/audioEvents.js";
import {
  applyUiEvents,
  hudBumpEvent,
  hudUpdateEvent,
  overlayHideEvent,
  overlayShowEvent,
  shopRenderEvent,
} from "../../src/ui/uiEvents.js";
import {
  applyFxEvents,
  fxBurstEvent,
  fxFlashEvent,
  fxRingEvent,
  fxShakeEvent,
  scorePopEvent,
} from "../../src/fx/fxEvents.js";

test("audio event adapter routes only audio events", () => {
  const calls = [];
  const events = [
    audioPlayEvent("score", { amount: 100 }),
    hudUpdateEvent(),
    audioSyncButtonsEvent(),
  ];

  applyAudioEvents(events, {
    init: () => calls.push(["init"]),
    play: (name, options) => calls.push(["play", name, options]),
    syncButtons: () => calls.push(["syncButtons"]),
  });

  assert.deepEqual(calls, [
    ["init"],
    ["play", "score", { amount: 100 }],
    ["syncButtons"],
  ]);
});

test("ui event adapter routes HUD overlay and shop events", () => {
  const calls = [];
  const overlayConfig = { title: "商店", text: "购买道具" };

  applyUiEvents(
    [
      hudUpdateEvent(),
      hudBumpEvent("scoreStat"),
      shopRenderEvent(),
      overlayShowEvent(overlayConfig),
      overlayHideEvent(),
      audioPlayEvent("ignored"),
    ],
    {
      updateHud: () => calls.push(["updateHud"]),
      bumpHud: (target) => calls.push(["bumpHud", target]),
      renderShop: () => calls.push(["renderShop"]),
      showOverlay: (config) => calls.push(["showOverlay", config]),
      hideOverlay: () => calls.push(["hideOverlay"]),
    },
  );

  assert.deepEqual(calls, [
    ["updateHud"],
    ["bumpHud", "scoreStat"],
    ["renderShop"],
    ["showOverlay", overlayConfig],
    ["hideOverlay"],
  ]);
});

test("fx event adapter routes visual effects", () => {
  const calls = [];

  applyFxEvents(
    [
      fxRingEvent({ x: 1, y: 2, r0: 3, r1: 4, life: 0.5, color: "#fff", width: 2 }),
      fxBurstEvent({ x: 1, y: 2, count: 5, colors: ["#fff"], speedMin: 1, speedMax: 2, sizeMin: 1, sizeMax: 2, lifeMin: 0.1, lifeMax: 0.2 }),
      fxFlashEvent(0.4),
      fxShakeEvent(0.3),
      scorePopEvent({ amount: 120, color: "#ffd34d", hookId: "p1" }),
      audioPlayEvent("ignored"),
    ],
    {
      spawnRing: (payload) => calls.push(["ring", payload.x, payload.y]),
      spawnBurst: (payload) => calls.push(["burst", payload.count]),
      flash: (amount) => calls.push(["flash", amount]),
      shake: (amount) => calls.push(["shake", amount]),
      scorePop: (payload) => calls.push(["scorePop", payload.amount, payload.color, payload.hookId]),
    },
  );

  assert.deepEqual(calls, [
    ["ring", 1, 2],
    ["burst", 5],
    ["flash", 0.4],
    ["shake", 0.3],
    ["scorePop", 120, "#ffd34d", "p1"],
  ]);
});
```

- [ ] **Step 2: Run adapter tests and confirm they fail**

Run:

```bash
node --test tests/unit/events.test.mjs
```

Expected:

- FAIL because adapter modules do not exist yet.

- [ ] **Step 3: Implement adapter modules**

Create `src/audio/audioEvents.js`:

```js
import { GameEventType, gameEvent } from "../events/eventTypes.js";

export function audioPlayEvent(name, options = undefined) {
  return gameEvent(GameEventType.AUDIO_PLAY, options === undefined ? { name } : { name, options });
}

export function audioSyncButtonsEvent() {
  return gameEvent(GameEventType.AUDIO_SYNC_BUTTONS);
}

export function applyAudioEvents(events, handlers) {
  for (const event of events) {
    if (event.type === GameEventType.AUDIO_PLAY) {
      handlers.init?.();
      handlers.play?.(event.payload.name, event.payload.options);
    } else if (event.type === GameEventType.AUDIO_SYNC_BUTTONS) {
      handlers.syncButtons?.();
    }
  }
}
```

Create `src/ui/uiEvents.js`:

```js
import { GameEventType, gameEvent } from "../events/eventTypes.js";

export function hudUpdateEvent() {
  return gameEvent(GameEventType.HUD_UPDATE);
}

export function hudBumpEvent(target) {
  return gameEvent(GameEventType.HUD_BUMP, { target });
}

export function overlayShowEvent(config) {
  return gameEvent(GameEventType.OVERLAY_SHOW, { config });
}

export function overlayHideEvent() {
  return gameEvent(GameEventType.OVERLAY_HIDE);
}

export function shopRenderEvent() {
  return gameEvent(GameEventType.SHOP_RENDER);
}

export function applyUiEvents(events, handlers) {
  for (const event of events) {
    switch (event.type) {
      case GameEventType.HUD_UPDATE:
        handlers.updateHud?.();
        break;
      case GameEventType.HUD_BUMP:
        handlers.bumpHud?.(event.payload.target);
        break;
      case GameEventType.OVERLAY_SHOW:
        handlers.showOverlay?.(event.payload.config);
        break;
      case GameEventType.OVERLAY_HIDE:
        handlers.hideOverlay?.();
        break;
      case GameEventType.SHOP_RENDER:
        handlers.renderShop?.();
        break;
      default:
        break;
    }
  }
}
```

Create `src/fx/fxEvents.js`:

```js
import { GameEventType, gameEvent } from "../events/eventTypes.js";

export function fxRingEvent(payload) {
  return gameEvent(GameEventType.FX_RING, payload);
}

export function fxBurstEvent(payload) {
  return gameEvent(GameEventType.FX_BURST, payload);
}

export function fxFlashEvent(amount) {
  return gameEvent(GameEventType.FX_FLASH, { amount });
}

export function fxShakeEvent(amount) {
  return gameEvent(GameEventType.FX_SHAKE, { amount });
}

export function scorePopEvent(payload) {
  return gameEvent(GameEventType.SCORE_POP, payload);
}

export function applyFxEvents(events, handlers) {
  for (const event of events) {
    switch (event.type) {
      case GameEventType.FX_RING:
        handlers.spawnRing?.(event.payload);
        break;
      case GameEventType.FX_BURST:
        handlers.spawnBurst?.(event.payload);
        break;
      case GameEventType.FX_FLASH:
        handlers.flash?.(event.payload.amount);
        break;
      case GameEventType.FX_SHAKE:
        handlers.shake?.(event.payload.amount);
        break;
      case GameEventType.SCORE_POP:
        handlers.scorePop?.(event.payload);
        break;
      default:
        break;
    }
  }
}
```

- [ ] **Step 4: Run adapter tests**

Run:

```bash
node --test tests/unit/events.test.mjs
```

Expected:

- PASS.

---

## Task 3: Runtime Bridge Exports

**Files:**

- Modify: `src/runtime/moduleBridge.js`
- Modify: `tests/unit/runtime-bridge.test.mjs`

### Steps

- [ ] **Step 1: Add bridge test expectations**

In `tests/unit/runtime-bridge.test.mjs`, add expected keys for:

```js
"GameEventType",
"gameEvent",
"isGameEvent",
"isGameEventType",
"assertGameEvent",
"createEventQueue",
"enqueueEvent",
"drainEvents",
"peekEvents",
"clearEvents",
"hasPendingEvents",
"audioPlayEvent",
"audioSyncButtonsEvent",
"applyAudioEvents",
"hudUpdateEvent",
"hudBumpEvent",
"overlayShowEvent",
"overlayHideEvent",
"shopRenderEvent",
"applyUiEvents",
"fxRingEvent",
"fxBurstEvent",
"fxFlashEvent",
"fxShakeEvent",
"scorePopEvent",
"applyFxEvents",
```

Also add smoke assertions:

```js
const queue = modules.createEventQueue();
modules.enqueueEvent(queue, modules.audioPlayEvent("ui_click"));
assert.equal(modules.hasPendingEvents(queue), true);
assert.equal(modules.drainEvents(queue)[0].type, modules.GameEventType.AUDIO_PLAY);
```

- [ ] **Step 2: Run bridge tests and confirm they fail**

Run:

```bash
node --test tests/unit/events.test.mjs tests/unit/runtime-bridge.test.mjs
```

Expected:

- FAIL because bridge exports are not added yet.

- [ ] **Step 3: Export event helpers from `src/runtime/moduleBridge.js`**

Import all new event helpers and include them in `GoldMinerModules`.

- [ ] **Step 4: Run bridge tests**

Run:

```bash
node --test tests/unit/events.test.mjs tests/unit/runtime-bridge.test.mjs
```

Expected:

- PASS.

---

## Task 4: Runtime Event Queue In `game.js`

**Files:**

- Modify: `game.js`
- Modify: `tests/unit/source-invariants.test.mjs`

### Steps

- [ ] **Step 1: Add source invariant tests**

In `tests/unit/source-invariants.test.mjs`, add a test that verifies:

- `FALLBACK_GAME_EVENT_TYPE` exists.
- `game.events` is initialized.
- `eventTypes()`, `emitGameEvent()`, `processGameEvents()`, `applyRuntimeAudioEvents()`, `applyRuntimeUiEvents()`, and `applyRuntimeFxEvents()` exist.
- `processGameEvents()` drains events with `GoldMinerModules.drainEvents` when available.
- runtime event handlers call:
  - `audioInit()` and `audioPlay()`
  - `syncAudioButtons()`
  - `updateHud()`
  - `showOverlay()`
  - `hideOverlay()`
  - `renderShop()`
  - `spawnRing()`
  - `spawnBurst()`
  - `addScorePop()`

- [ ] **Step 2: Run source invariant tests and confirm they fail**

Run:

```bash
node --test tests/unit/source-invariants.test.mjs
```

Expected:

- FAIL because runtime event queue functions do not exist yet.

- [ ] **Step 3: Add event queue helpers to `game.js`**

Add fallback event type constants next to `FALLBACK_COMMAND_TYPE`, add `events` to the `game` object, and implement:

```js
function eventTypes() {}
function createRuntimeEvent(type, payload = {}) {}
function emitGameEvent(eventOrType, payload = {}) {}
function drainGameEvents() {}
function processGameEvents() {}
function applyRuntimeAudioEvents(events) {}
function applyRuntimeUiEvents(events) {}
function applyRuntimeFxEvents(events) {}
```

Use `GoldMinerModules.*` helpers when available. Local fallback must still work if the bridge fails.

- [ ] **Step 4: Run source invariant tests**

Run:

```bash
node --test tests/unit/source-invariants.test.mjs
npm run verify
```

Expected:

- PASS.

---

## Task 5: Migrate Selected Side Effects To Events

**Files:**

- Modify: `game.js`
- Modify: `tests/unit/source-invariants.test.mjs`

### Scope

Migrate these selected side-effect groups:

- Level flow:
  - `startGame()`
  - `startNextLevel()`
  - `openShop()`
  - game-over branch in `endLevel()`
- Command handlers:
  - audio toggle
  - music toggle
  - next track
- Hook flow:
  - `dropHookFor()`
  - countdown warning in `update(dt)`
  - empty retract sound in `update(dt)`
  - `attachToHook()`
  - `dropKeg()`
  - `deliverAttachedItem()`
- Bomb and explosion flow:
  - `useBomb()`
  - `explodeAt()`

Do not rewrite renderer or physics logic.

### Steps

- [ ] **Step 1: Add source invariant expectations**

Update the existing source invariant tests to verify selected functions now call event helpers:

- `startGame()` uses `emitGameEvent(...OVERLAY_HIDE...)`, `emitGameEvent(...HUD_UPDATE...)`, and `emitAudioEvent("level_start")` or equivalent.
- `buyShopCommandItem()` uses `SHOP_RENDER`, `HUD_UPDATE`, and `AUDIO_PLAY` events.
- `togglePause()` uses `AUDIO_PLAY`, `OVERLAY_SHOW`/`OVERLAY_HIDE`, and `HUD_UPDATE` events.
- `useBomb()` uses `FX_SHAKE`, `FX_FLASH`, `FX_RING`, `FX_BURST`, and `HUD_UPDATE` events.
- `processGameEvents()` is called after migrated state transitions.

- [ ] **Step 2: Run source invariant tests and confirm they fail**

Run:

```bash
node --test tests/unit/source-invariants.test.mjs
```

Expected:

- FAIL because direct side effects have not been migrated yet.

- [ ] **Step 3: Migrate side effects**

Add small helper wrappers in `game.js`:

```js
function emitAudioEvent(name, options) {}
function emitAudioSyncEvent() {}
function emitHudUpdateEvent() {}
function emitOverlayShowEvent(config) {}
function emitOverlayHideEvent() {}
function emitShopRenderEvent() {}
function emitFxRingEvent(payload) {}
function emitFxBurstEvent(payload) {}
function emitFxFlashEvent(amount) {}
function emitFxShakeEvent(amount) {}
function emitScorePopEvent(payload) {}
```

Replace selected direct calls with these event helpers and call `processGameEvents()` after each logical transition. Preserve existing state mutation order.

- [ ] **Step 4: Run focused verification**

Run:

```bash
node --test tests/unit/source-invariants.test.mjs tests/unit/events.test.mjs tests/unit/runtime-bridge.test.mjs
npm run verify
```

Expected:

- PASS.

---

## Task 6: Docs Browser Smoke And Final Review

**Files:**

- Modify: `docs/architecture-optimization-plan.md`
- Modify: `docs/superpowers/plans/2026-05-24-architecture-next-batches.md`
- Modify: `progress.md`

### Steps

- [ ] **Step 1: Update docs**

In `docs/architecture-optimization-plan.md`, add a Batch 5 record:

```markdown
### Batch 5：Event Bus For Side Effects

状态：第一阶段已完成。

完成内容：

- 新增 `src/events/eventTypes.js` 和 `src/events/eventQueue.js`。
- 新增 `src/audio/audioEvents.js`、`src/ui/uiEvents.js`、`src/fx/fxEvents.js`。
- `src/runtime/moduleBridge.js` 暴露事件 helper。
- `game.js` 新增 runtime event queue，并将选定音频、HUD、overlay、shop 和 FX 副作用通过事件派发。

后续风险：

- 仍有部分渲染相邻或时序敏感副作用保留在 `game.js`。
- 下一批应继续 Render Layer Split，减少 `game.js` 绘制职责。
```

In `docs/superpowers/plans/2026-05-24-architecture-next-batches.md`:

- Change Batch 5 status to `Completed first stage`.
- Make Batch 6 Render Layer Split the next recommended batch.

In `progress.md`, append:

```markdown
- 架构 Batch 5：已建立 runtime event queue 和 audio/UI/FX event adapters；选定音频、HUD、overlay、shop、FX 副作用已通过事件派发。下一批建议做 Render Layer Split。
```

- [ ] **Step 2: Run final verification**

Run:

```bash
npm run verify
./macos/build.command
test -f "dist/macos/黄金矿工.app/Contents/Resources/src/events/eventTypes.js"
test -f "dist/macos/黄金矿工.app/Contents/Resources/src/audio/audioEvents.js"
test -f "dist/macos/黄金矿工.app/Contents/Resources/src/ui/uiEvents.js"
test -f "dist/macos/黄金矿工.app/Contents/Resources/src/fx/fxEvents.js"
```

Expected:

- PASS.

- [ ] **Step 3: Run browser smoke**

Start:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Open:

```text
http://127.0.0.1:4173/?seed=12345
```

Browser checks:

```js
({
  ready: window.__goldMinerModulesReady,
  hasEvents: !!window.GoldMinerModules?.GameEventType,
  hasQueue: typeof window.GoldMinerModules?.createEventQueue === "function",
  hasAudioEvents: typeof window.GoldMinerModules?.audioPlayEvent === "function",
  hasUiEvents: typeof window.GoldMinerModules?.hudUpdateEvent === "function",
  hasFxEvents: typeof window.GoldMinerModules?.fxBurstEvent === "function",
});
```

Start single-player and verify:

```js
const payload = JSON.parse(window.render_game_to_text());
({
  phase: payload.phase,
  mode: payload.mode,
  seed: payload.seed,
  target: payload.target,
  itemCount: payload.items.length,
  paused: payload.paused,
});
```

Expected:

```js
{
  phase: "playing",
  mode: "single",
  seed: 13546,
  target: 650,
  itemCount: 14,
  paused: false,
}
```

Also verify:

- Press `p`; `paused` becomes true and overlay appears.
- Click overlay primary resume; `paused` becomes false.
- Press Space after a fresh start; hook state becomes `extend`.
- Browser console has no errors or warnings.

- [ ] **Step 4: Final code review**

Dispatch a final code-reviewer subagent for the full Batch 5 implementation. Required result:

- No P0/P1 issues.
- Any P2 issues are either fixed or documented as follow-up.

---

## Final Acceptance Criteria

- Event type and queue behavior are unit-tested.
- Audio/UI/FX event adapters are unit-tested.
- `GoldMinerModules` exposes event helpers.
- `game.js` has a runtime event queue and drains events through centralized handlers.
- Selected audio/HUD/overlay/shop/FX side effects route through events.
- Existing fixed-seed baseline remains stable.
- Browser smoke proves boot, start, pause/resume, and hook firing still work.
- macOS bundle includes the new event, audio, UI, and FX modules.
