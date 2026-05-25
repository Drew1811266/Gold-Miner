# State And Command Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce an explicit command boundary so browser inputs, overlay buttons, shop buttons, and keyboard shortcuts dispatch plain command objects instead of directly mutating gameplay state.

**Architecture:** Keep `game.js` as the runtime host for this batch. Add small pure state modules under `src/state/` and `src/systems/`, expose them through `src/runtime/moduleBridge.js`, then add a command dispatcher adapter in `game.js` that delegates to the existing runtime functions. Do not move rendering, the animation loop, audio implementation, scene generation, or full state ownership in this batch.

**Tech Stack:** Browser JavaScript, ES modules, Node built-in test runner, Canvas 2D, WebAudio, Runtime Module Bridge.

---

## Context

Batch 3 is complete. `game.js` still owns runtime state, rendering, input, audio, overlays, and side effects, but level generation now prefers `GoldMinerModules.generateLevelData()`.

Batch 4 must be a narrow strangler step:

- Add command vocabulary as data.
- Add pure selectors for command availability.
- Add pure inventory helpers.
- Route current UI/input handlers through `dispatchCommand(command)`.
- Keep existing gameplay functions as command handlers.
- Preserve direct file launch and bridge fallback behavior.

Do not attempt a full immutable reducer or `src/main.js` migration in this batch.

## File Structure

- Create `src/state/commands.js`
  - Owns `CommandType`, command creation, and validation.
- Create `src/state/selectors.js`
  - Owns pure read-only state selectors for command availability.
- Create `src/systems/inventorySystem.js`
  - Owns pure inventory purchase and consume helpers.
- Modify `src/runtime/moduleBridge.js`
  - Expose command/selectors/inventory helpers through `GoldMinerModules`.
- Modify `game.js`
  - Add fallback command constants, `createRuntimeCommand()`, `dispatchCommand()`, and command handlers.
  - Rewrite UI, overlay, keyboard, pointer, and shop callbacks to dispatch commands.
- Add `tests/unit/commands.test.mjs`
  - Unit tests for commands and selectors.
- Add `tests/unit/inventory-system.test.mjs`
  - Unit tests for pure inventory helpers.
- Modify `tests/unit/runtime-bridge.test.mjs`
  - Verify bridge exposes new helpers.
- Modify `tests/unit/source-invariants.test.mjs`
  - Verify runtime input surfaces dispatch commands.
- Modify docs:
  - `docs/architecture-optimization-plan.md`
  - `docs/superpowers/plans/2026-05-24-architecture-next-batches.md`
  - `progress.md`

---

## Task 1: Command Vocabulary Module

**Files:**

- Create: `src/state/commands.js`
- Create: `tests/unit/commands.test.mjs`
- Modify: `src/runtime/moduleBridge.js`
- Modify: `tests/unit/runtime-bridge.test.mjs`

### Steps

- [ ] **Step 1: Add failing command tests**

Create `tests/unit/commands.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CommandType,
  command,
  isCommand,
  assertCommand,
} from "../../src/state/commands.js";

test("command types are frozen and cover runtime input intents", () => {
  assert.ok(Object.isFrozen(CommandType));
  assert.deepEqual(Object.keys(CommandType), [
    "SHOW_MODE_SELECT",
    "START_GAME",
    "RESTART_GAME",
    "TOGGLE_PAUSE",
    "RESUME_GAME",
    "FIRE_HOOK",
    "USE_BOMB",
    "BUY_SHOP_ITEM",
    "START_NEXT_LEVEL",
    "TOGGLE_MUSIC",
    "NEXT_TRACK",
    "TOGGLE_SFX",
  ]);
});

test("command creates immutable plain command objects", () => {
  const fire = command(CommandType.FIRE_HOOK, { player: 1 });

  assert.deepEqual(fire, {
    type: "FIRE_HOOK",
    payload: { player: 1 },
  });
  assert.ok(Object.isFrozen(fire));
  assert.ok(Object.isFrozen(fire.payload));
  assert.equal(isCommand(fire), true);
  assert.equal(assertCommand(fire), fire);
});

test("command validation rejects unsupported or malformed commands", () => {
  assert.throws(() => command("UNKNOWN"), /Unsupported command type/);
  assert.throws(() => command(CommandType.FIRE_HOOK, null), /payload must be an object/);
  assert.equal(isCommand({ type: "UNKNOWN", payload: {} }), false);
  assert.throws(() => assertCommand({ type: "UNKNOWN", payload: {} }), /Unsupported command type/);
});
```

- [ ] **Step 2: Run command tests and verify they fail**

Run:

```bash
node --test tests/unit/commands.test.mjs
```

Expected:

- FAIL because `src/state/commands.js` does not exist yet.

- [ ] **Step 3: Implement `src/state/commands.js`**

Create `src/state/commands.js`:

```js
export const CommandType = Object.freeze({
  SHOW_MODE_SELECT: "SHOW_MODE_SELECT",
  START_GAME: "START_GAME",
  RESTART_GAME: "RESTART_GAME",
  TOGGLE_PAUSE: "TOGGLE_PAUSE",
  RESUME_GAME: "RESUME_GAME",
  FIRE_HOOK: "FIRE_HOOK",
  USE_BOMB: "USE_BOMB",
  BUY_SHOP_ITEM: "BUY_SHOP_ITEM",
  START_NEXT_LEVEL: "START_NEXT_LEVEL",
  TOGGLE_MUSIC: "TOGGLE_MUSIC",
  NEXT_TRACK: "NEXT_TRACK",
  TOGGLE_SFX: "TOGGLE_SFX",
});

const COMMAND_TYPES = new Set(Object.values(CommandType));

export function isCommandType(type) {
  return COMMAND_TYPES.has(type);
}

export function command(type, payload = {}) {
  if (!isCommandType(type)) {
    throw new RangeError(`Unsupported command type: ${String(type)}`);
  }
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("command payload must be an object");
  }

  return Object.freeze({
    type,
    payload: Object.freeze({ ...payload }),
  });
}

export function isCommand(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    isCommandType(value.type) &&
    value.payload !== null &&
    typeof value.payload === "object" &&
    !Array.isArray(value.payload)
  );
}

export function assertCommand(value) {
  if (!isCommand(value)) {
    throw new TypeError("Expected a valid game command");
  }
  return value;
}
```

- [ ] **Step 4: Export commands from runtime bridge**

Modify `src/runtime/moduleBridge.js`:

```js
import {
  CommandType,
  assertCommand,
  command,
  isCommand,
  isCommandType,
} from "../state/commands.js";
```

Add to `GoldMinerModules`:

```js
  CommandType,
  command,
  isCommand,
  isCommandType,
  assertCommand,
```

- [ ] **Step 5: Extend runtime bridge tests**

In `tests/unit/runtime-bridge.test.mjs`, add these keys to the existing expected bridge keys loop:

```js
"CommandType",
"command",
"isCommand",
"isCommandType",
"assertCommand",
```

Also add:

```js
assert.equal(modules.command(modules.CommandType.USE_BOMB).type, modules.CommandType.USE_BOMB);
assert.equal(modules.isCommand(modules.command(modules.CommandType.FIRE_HOOK, { player: 0 })), true);
```

- [ ] **Step 6: Run tests**

Run:

```bash
node --test tests/unit/commands.test.mjs tests/unit/runtime-bridge.test.mjs
npm run verify
```

Expected:

- PASS.

---

## Task 2: Command Availability Selectors

**Files:**

- Create: `src/state/selectors.js`
- Modify: `tests/unit/commands.test.mjs`
- Modify: `src/runtime/moduleBridge.js`
- Modify: `tests/unit/runtime-bridge.test.mjs`

### Steps

- [ ] **Step 1: Add selector tests**

Append to `tests/unit/commands.test.mjs`:

```js
import {
  canFireHook,
  canOpenModeSelect,
  canRestart,
  canTogglePause,
  canUseBomb,
  isPlaying,
  isTwoPlayerMode,
} from "../../src/state/selectors.js";

const baseState = {
  phase: "playing",
  paused: false,
  mode: "single",
  inventory: { bombs: 1 },
  hook: { state: "swing", attachedId: null },
  hook2: { state: "swing", attachedId: null },
};

test("selectors identify runtime phase and mode", () => {
  assert.equal(isPlaying(baseState), true);
  assert.equal(isPlaying({ ...baseState, phase: "shop" }), false);
  assert.equal(isTwoPlayerMode(baseState), false);
  assert.equal(isTwoPlayerMode({ ...baseState, mode: "double" }), true);
});

test("selectors gate command availability", () => {
  assert.equal(canOpenModeSelect({ ...baseState, phase: "menu" }), true);
  assert.equal(canOpenModeSelect(baseState), false);
  assert.equal(canRestart(baseState), true);
  assert.equal(canRestart({ ...baseState, phase: "menu" }), false);
  assert.equal(canTogglePause(baseState), true);
  assert.equal(canTogglePause({ ...baseState, phase: "shop" }), false);
  assert.equal(canFireHook(baseState, 0), true);
  assert.equal(canFireHook(baseState, 1), false);
  assert.equal(canFireHook({ ...baseState, mode: "double" }, 1), true);
  assert.equal(canFireHook({ ...baseState, hook: { state: "extend" } }, 0), false);
  assert.equal(
    canUseBomb({
      ...baseState,
      hook: { state: "retract", attachedId: 9 },
    }),
    true,
  );
  assert.equal(canUseBomb({ ...baseState, inventory: { bombs: 0 } }), false);
});
```

- [ ] **Step 2: Run selector tests and verify they fail**

Run:

```bash
node --test tests/unit/commands.test.mjs
```

Expected:

- FAIL because `src/state/selectors.js` does not exist yet.

- [ ] **Step 3: Implement `src/state/selectors.js`**

Create `src/state/selectors.js`:

```js
export function isMenu(state) {
  return state?.phase === "menu";
}

export function isPlaying(state) {
  return state?.phase === "playing";
}

export function isTwoPlayerMode(state) {
  return state?.mode === "double";
}

export function canOpenModeSelect(state) {
  return isMenu(state);
}

export function canRestart(state) {
  return !isMenu(state);
}

export function canTogglePause(state) {
  return isPlaying(state);
}

function hookForPlayer(state, player = 0) {
  return player === 1 ? state?.hook2 : state?.hook;
}

export function canFireHook(state, player = 0) {
  if (!isPlaying(state) || state?.paused) return false;
  if (!isTwoPlayerMode(state) && player !== 0) return false;
  return hookForPlayer(state, player)?.state === "swing";
}

export function canUseBomb(state) {
  if (!isPlaying(state) || state?.paused) return false;
  if ((state?.inventory?.bombs ?? 0) <= 0) return false;
  const hooks = isTwoPlayerMode(state) ? [state?.hook, state?.hook2] : [state?.hook];
  return hooks.some((hook) => hook?.state === "retract" && hook.attachedId !== null && hook.attachedId !== undefined);
}
```

- [ ] **Step 4: Export selectors from runtime bridge**

Modify `src/runtime/moduleBridge.js`:

```js
import {
  canFireHook,
  canOpenModeSelect,
  canRestart,
  canTogglePause,
  canUseBomb,
  isMenu,
  isPlaying,
  isTwoPlayerMode,
} from "../state/selectors.js";
```

Add to `GoldMinerModules`:

```js
  isMenu,
  isPlaying,
  isTwoPlayerMode,
  canOpenModeSelect,
  canRestart,
  canTogglePause,
  canFireHook,
  canUseBomb,
```

- [ ] **Step 5: Extend runtime bridge tests**

In `tests/unit/runtime-bridge.test.mjs`, add these expected keys:

```js
"isMenu",
"isPlaying",
"isTwoPlayerMode",
"canOpenModeSelect",
"canRestart",
"canTogglePause",
"canFireHook",
"canUseBomb",
```

Add:

```js
assert.equal(modules.canFireHook({ phase: "playing", paused: false, mode: "single", hook: { state: "swing" } }, 0), true);
assert.equal(modules.canUseBomb({ phase: "playing", paused: false, mode: "single", inventory: { bombs: 1 }, hook: { state: "retract", attachedId: 1 } }), true);
```

- [ ] **Step 6: Run tests**

Run:

```bash
node --test tests/unit/commands.test.mjs tests/unit/runtime-bridge.test.mjs
npm run verify
```

Expected:

- PASS.

---

## Task 3: Inventory System Helpers

**Files:**

- Create: `src/systems/inventorySystem.js`
- Create: `tests/unit/inventory-system.test.mjs`
- Modify: `src/runtime/moduleBridge.js`
- Modify: `tests/unit/runtime-bridge.test.mjs`

### Steps

- [ ] **Step 1: Add failing inventory tests**

Create `tests/unit/inventory-system.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buyShopItem,
  canBuyShopItem,
  consumeInventoryItem,
  createEmptyInventory,
  getInventoryCount,
} from "../../src/systems/inventorySystem.js";

const bombItem = { id: "bomb", cost: 150 };
const speedItem = { id: "speed", cost: 220 };
const luckyItem = { id: "lucky", cost: 260 };

test("inventory helpers create and read runtime inventory shape", () => {
  const inventory = createEmptyInventory();

  assert.deepEqual(inventory, { bombs: 0, speed: 0, lucky: 0 });
  assert.equal(getInventoryCount({ bombs: 2, speed: 1, lucky: 3 }, "bomb"), 2);
  assert.equal(getInventoryCount({ bombs: 2, speed: 1, lucky: 3 }, "speed"), 1);
  assert.equal(getInventoryCount({ bombs: 2, speed: 1, lucky: 3 }, "lucky"), 3);
  assert.equal(getInventoryCount({ bombs: 2, speed: 1, lucky: 3 }, "unknown"), 0);
});

test("buyShopItem returns updated score and inventory without mutating input", () => {
  const inventory = { bombs: 0, speed: 0, lucky: 0 };
  const result = buyShopItem({ score: 500, inventory, item: bombItem });

  assert.deepEqual(result, {
    bought: true,
    score: 350,
    inventory: { bombs: 1, speed: 0, lucky: 0 },
  });
  assert.deepEqual(inventory, { bombs: 0, speed: 0, lucky: 0 });
  assert.equal(canBuyShopItem(149, bombItem), false);
  assert.equal(canBuyShopItem(150, bombItem), true);
});

test("buyShopItem supports speed and lucky items and rejects unsupported ids", () => {
  assert.deepEqual(buyShopItem({ score: 500, inventory: createEmptyInventory(), item: speedItem }).inventory, {
    bombs: 0,
    speed: 1,
    lucky: 0,
  });
  assert.deepEqual(buyShopItem({ score: 500, inventory: createEmptyInventory(), item: luckyItem }).inventory, {
    bombs: 0,
    speed: 0,
    lucky: 1,
  });
  assert.throws(
    () => buyShopItem({ score: 500, inventory: createEmptyInventory(), item: { id: "bad", cost: 1 } }),
    /Unsupported inventory item/,
  );
});

test("consumeInventoryItem decrements one item without mutating input", () => {
  const inventory = { bombs: 2, speed: 1, lucky: 0 };

  assert.deepEqual(consumeInventoryItem(inventory, "bomb"), {
    consumed: true,
    inventory: { bombs: 1, speed: 1, lucky: 0 },
  });
  assert.deepEqual(consumeInventoryItem(inventory, "lucky"), {
    consumed: false,
    inventory,
  });
  assert.deepEqual(inventory, { bombs: 2, speed: 1, lucky: 0 });
});
```

- [ ] **Step 2: Run inventory tests and verify they fail**

Run:

```bash
node --test tests/unit/inventory-system.test.mjs
```

Expected:

- FAIL because `src/systems/inventorySystem.js` does not exist yet.

- [ ] **Step 3: Implement `src/systems/inventorySystem.js`**

Create `src/systems/inventorySystem.js`:

```js
const INVENTORY_KEY_BY_ITEM_ID = Object.freeze({
  bomb: "bombs",
  speed: "speed",
  lucky: "lucky",
});

export function createEmptyInventory() {
  return { bombs: 0, speed: 0, lucky: 0 };
}

export function getInventoryCount(inventory, itemId) {
  const key = INVENTORY_KEY_BY_ITEM_ID[itemId];
  if (!key) return 0;
  return Math.max(0, Math.floor(inventory?.[key] ?? 0));
}

export function canBuyShopItem(score, item) {
  return Number.isFinite(score) && score >= (item?.cost ?? Number.POSITIVE_INFINITY);
}

function inventoryKeyForItem(itemId) {
  const key = INVENTORY_KEY_BY_ITEM_ID[itemId];
  if (!key) throw new RangeError(`Unsupported inventory item: ${String(itemId)}`);
  return key;
}

export function buyShopItem({ score, inventory, item }) {
  const key = inventoryKeyForItem(item?.id);
  if (!canBuyShopItem(score, item)) {
    return { bought: false, score, inventory };
  }

  return {
    bought: true,
    score: score - item.cost,
    inventory: {
      ...inventory,
      [key]: getInventoryCount(inventory, item.id) + 1,
    },
  };
}

export function consumeInventoryItem(inventory, itemId) {
  const key = inventoryKeyForItem(itemId);
  const current = getInventoryCount(inventory, itemId);
  if (current <= 0) {
    return { consumed: false, inventory };
  }

  return {
    consumed: true,
    inventory: {
      ...inventory,
      [key]: current - 1,
    },
  };
}
```

- [ ] **Step 4: Export inventory helpers from runtime bridge**

Modify `src/runtime/moduleBridge.js`:

```js
import {
  buyShopItem,
  canBuyShopItem,
  consumeInventoryItem,
  createEmptyInventory,
  getInventoryCount,
} from "../systems/inventorySystem.js";
```

Add to `GoldMinerModules`:

```js
  createEmptyInventory,
  getInventoryCount,
  canBuyShopItem,
  buyShopItem,
  consumeInventoryItem,
```

- [ ] **Step 5: Extend runtime bridge tests**

In `tests/unit/runtime-bridge.test.mjs`, add expected keys:

```js
"createEmptyInventory",
"getInventoryCount",
"canBuyShopItem",
"buyShopItem",
"consumeInventoryItem",
```

Add:

```js
assert.deepEqual(modules.createEmptyInventory(), { bombs: 0, speed: 0, lucky: 0 });
assert.equal(modules.canBuyShopItem(150, { id: "bomb", cost: 150 }), true);
```

- [ ] **Step 6: Run tests**

Run:

```bash
node --test tests/unit/inventory-system.test.mjs tests/unit/runtime-bridge.test.mjs
npm run verify
```

Expected:

- PASS.

---

## Task 4: Runtime Command Dispatcher In `game.js`

**Files:**

- Modify: `game.js`
- Modify: `tests/unit/source-invariants.test.mjs`

### Steps

- [ ] **Step 1: Add source invariant tests**

Append to `tests/unit/source-invariants.test.mjs`:

```js
test("game input surfaces dispatch command objects", () => {
  const source = read("game.js");
  const initUiBody = extractFunctionBody(source, "initUi");
  const showModeBody = extractFunctionBody(source, "showModeSelectOverlay");
  const renderShopBody = extractFunctionBody(source, "renderShop");
  const openShopBody = extractFunctionBody(source, "openShop");

  assert.match(source, /function dispatchCommand\(rawCommand\)/);
  assert.match(source, /function createRuntimeCommand\(type, payload = \{\}\)/);
  assert.match(source, /function commandTypes\(\)/);
  assert.match(initUiBody, /dispatchCommand\(createRuntimeCommand\(types\.SHOW_MODE_SELECT\)\)/);
  assert.match(initUiBody, /dispatchCommand\(createRuntimeCommand\(types\.TOGGLE_PAUSE\)\)/);
  assert.match(initUiBody, /dispatchCommand\(createRuntimeCommand\(types\.RESTART_GAME\)\)/);
  assert.match(initUiBody, /dispatchCommand\(createRuntimeCommand\(types\.USE_BOMB\)\)/);
  assert.match(initUiBody, /dispatchCommand\(createRuntimeCommand\(types\.FIRE_HOOK, \{ player: 0 \}\)\)/);
  assert.match(initUiBody, /dispatchCommand\(createRuntimeCommand\(types\.FIRE_HOOK, \{ player: 1 \}\)\)/);
  assert.match(showModeBody, /dispatchCommand\(createRuntimeCommand\(types\.START_GAME, \{ mode: "single" \}\)\)/);
  assert.match(showModeBody, /dispatchCommand\(createRuntimeCommand\(types\.START_GAME, \{ mode: "double" \}\)\)/);
  assert.match(renderShopBody, /dispatchCommand\(createRuntimeCommand\(types\.BUY_SHOP_ITEM, \{ itemId: item\.id \}\)\)/);
  assert.match(openShopBody, /dispatchCommand\(createRuntimeCommand\(types\.START_NEXT_LEVEL\)\)/);
});
```

- [ ] **Step 2: Run source invariant test and verify it fails**

Run:

```bash
node --test tests/unit/source-invariants.test.mjs
```

Expected:

- FAIL because `game.js` does not yet have command dispatch.

- [ ] **Step 3: Add runtime command helpers to `game.js`**

Add near the bridge loader:

```js
const FALLBACK_COMMAND_TYPE = Object.freeze({
  SHOW_MODE_SELECT: "SHOW_MODE_SELECT",
  START_GAME: "START_GAME",
  RESTART_GAME: "RESTART_GAME",
  TOGGLE_PAUSE: "TOGGLE_PAUSE",
  RESUME_GAME: "RESUME_GAME",
  FIRE_HOOK: "FIRE_HOOK",
  USE_BOMB: "USE_BOMB",
  BUY_SHOP_ITEM: "BUY_SHOP_ITEM",
  START_NEXT_LEVEL: "START_NEXT_LEVEL",
  TOGGLE_MUSIC: "TOGGLE_MUSIC",
  NEXT_TRACK: "NEXT_TRACK",
  TOGGLE_SFX: "TOGGLE_SFX",
});

function commandTypes() {
  return GoldMinerModules.CommandType ?? FALLBACK_COMMAND_TYPE;
}

function createRuntimeCommand(type, payload = {}) {
  if (GoldMinerModules.command) return GoldMinerModules.command(type, payload);
  return { type, payload: { ...payload } };
}
```

- [ ] **Step 4: Add command handler functions**

Place near `startGame()` / `togglePause()`:

```js
function resumeGame() {
  if (game.phase !== "playing") return;
  game.paused = false;
  hideOverlay();
  updateHud();
}

function startNextLevel() {
  game.level += 1;
  game.phase = "playing";
  game.paused = false;
  prepareLevelStart();
  audioInit();
  hideOverlay();
  updateHud();
  audioPlay("level_start");
}

function buyShopCommandItem(itemId) {
  const item = SHOP_ITEMS.find((candidate) => candidate.id === itemId);
  if (!item) return;

  const result = GoldMinerModules.buyShopItem
    ? GoldMinerModules.buyShopItem({ score: game.score, inventory: game.inventory, item })
    : null;

  if (result) {
    if (!result.bought) return;
    audioInit();
    audioPlay("buy");
    game.score = result.score;
    game.inventory = result.inventory;
    renderShop();
    updateHud();
    return;
  }

  if (game.score < item.cost) return;
  audioInit();
  audioPlay("buy");
  game.score -= item.cost;
  if (item.id === "bomb") game.inventory.bombs += 1;
  if (item.id === "speed") game.inventory.speed += 1;
  if (item.id === "lucky") game.inventory.lucky += 1;
  renderShop();
  updateHud();
}
```

- [ ] **Step 5: Add `dispatchCommand(rawCommand)`**

Place after command handler functions:

```js
function dispatchCommand(rawCommand) {
  const command = GoldMinerModules.assertCommand
    ? GoldMinerModules.assertCommand(rawCommand)
    : rawCommand;
  const types = commandTypes();
  const payload = command.payload ?? {};

  switch (command.type) {
    case types.SHOW_MODE_SELECT:
      if (game.phase === "menu") showModeSelectOverlay();
      break;
    case types.START_GAME:
      setGameMode(payload.mode);
      startGame();
      break;
    case types.RESTART_GAME:
      if (game.phase !== "menu") restartGame();
      break;
    case types.TOGGLE_PAUSE:
      togglePause();
      break;
    case types.RESUME_GAME:
      resumeGame();
      break;
    case types.FIRE_HOOK:
      dropHookFor(payload.player ?? 0);
      break;
    case types.USE_BOMB:
      useBomb();
      break;
    case types.BUY_SHOP_ITEM:
      buyShopCommandItem(payload.itemId);
      break;
    case types.START_NEXT_LEVEL:
      startNextLevel();
      break;
    case types.TOGGLE_MUSIC:
      audioInit();
      audioPlay("ui_click");
      window.GameAudio?.toggleMusic?.();
      syncAudioButtons();
      break;
    case types.NEXT_TRACK:
      audioInit();
      audioPlay("ui_click");
      window.GameAudio?.nextTrack?.();
      syncAudioButtons();
      break;
    case types.TOGGLE_SFX: {
      audioInit();
      const wasOn = window.GameAudio?.isSfxEnabled?.() ?? true;
      if (wasOn) audioPlay("ui_click");
      window.GameAudio?.toggleSfx?.();
      syncAudioButtons();
      const nowOn = window.GameAudio?.isSfxEnabled?.() ?? true;
      if (nowOn) audioPlay("ui_click");
      break;
    }
    default:
      break;
  }
}
```

- [ ] **Step 6: Rewrite overlay callbacks to dispatch commands**

In `showModeSelectOverlay()`, replace direct callbacks:

```js
const types = commandTypes();
```

Primary:

```js
onClick: () => dispatchCommand(createRuntimeCommand(types.START_GAME, { mode: "single" })),
```

Secondary:

```js
onClick: () => dispatchCommand(createRuntimeCommand(types.START_GAME, { mode: "double" })),
```

In `togglePause()`, replace resume callback:

```js
onClick: () => dispatchCommand(createRuntimeCommand(commandTypes().RESUME_GAME)),
```

Replace restart overlay callbacks with:

```js
onClick: () => dispatchCommand(createRuntimeCommand(commandTypes().RESTART_GAME)),
```

In `openShop()`, replace next-level callback with:

```js
onClick: () => dispatchCommand(createRuntimeCommand(commandTypes().START_NEXT_LEVEL)),
```

- [ ] **Step 7: Rewrite shop buttons and input listeners**

In `renderShop()`, replace inline purchase body with:

```js
buyBtn.addEventListener("click", () => {
  dispatchCommand(createRuntimeCommand(commandTypes().BUY_SHOP_ITEM, { itemId: item.id }));
});
```

In `initUi()`, define once:

```js
const types = commandTypes();
```

Update listeners:

```js
ui.startBtn.addEventListener("click", () => {
  dispatchCommand(createRuntimeCommand(types.SHOW_MODE_SELECT));
});

ui.pauseBtn.addEventListener("click", () => dispatchCommand(createRuntimeCommand(types.TOGGLE_PAUSE)));
ui.restartBtn.addEventListener("click", () => dispatchCommand(createRuntimeCommand(types.RESTART_GAME)));
ui.bombBtn.addEventListener("click", () => dispatchCommand(createRuntimeCommand(types.USE_BOMB)));
ui.soundBtn?.addEventListener("click", () => dispatchCommand(createRuntimeCommand(types.TOGGLE_SFX)));
ui.musicBtn?.addEventListener("click", () => dispatchCommand(createRuntimeCommand(types.TOGGLE_MUSIC)));
```

In the keydown handler:

```js
if (e.code === "Space") {
  e.preventDefault();
  if (game.phase === "menu") {
    dispatchCommand(createRuntimeCommand(types.START_GAME, { mode: "single" }));
    return;
  }
  dispatchCommand(createRuntimeCommand(types.FIRE_HOOK, { player: 0 }));
}
if (e.code === "Enter") {
  if (game.phase === "menu") {
    e.preventDefault();
    dispatchCommand(createRuntimeCommand(types.START_GAME, { mode: "double" }));
    return;
  }
  if (isTwoPlayerMode()) {
    e.preventDefault();
    dispatchCommand(createRuntimeCommand(types.FIRE_HOOK, { player: 1 }));
  }
}
if (e.key === "p" || e.key === "P") dispatchCommand(createRuntimeCommand(types.TOGGLE_PAUSE));
if (e.key === "r" || e.key === "R") dispatchCommand(createRuntimeCommand(types.RESTART_GAME));
if (e.key === "x" || e.key === "X") dispatchCommand(createRuntimeCommand(types.USE_BOMB));
if (e.key === "m" || e.key === "M") dispatchCommand(createRuntimeCommand(types.TOGGLE_MUSIC));
if (e.key === "n" || e.key === "N") dispatchCommand(createRuntimeCommand(types.NEXT_TRACK));
if (e.key === "s" || e.key === "S") dispatchCommand(createRuntimeCommand(types.TOGGLE_SFX));
```

In pointerdown:

```js
if (game.phase === "menu") {
  dispatchCommand(createRuntimeCommand(types.SHOW_MODE_SELECT));
  return;
}
dispatchCommand(createRuntimeCommand(types.FIRE_HOOK, { player: 0 }));
```

- [ ] **Step 8: Run tests**

Run:

```bash
node --check game.js
node --test tests/unit/source-invariants.test.mjs
npm run verify
```

Expected:

- PASS.

---

## Task 5: Documentation, Browser Smoke, And Final Review

**Files:**

- Modify: `docs/architecture-optimization-plan.md`
- Modify: `docs/superpowers/plans/2026-05-24-architecture-next-batches.md`
- Modify: `progress.md`

### Steps

- [ ] **Step 1: Update architecture documentation**

In `docs/architecture-optimization-plan.md`, append under implementation records:

```markdown
### Batch 4：State And Command Boundary

状态：已完成第一阶段。

计划文件：`docs/superpowers/plans/2026-05-24-state-command-boundary.md`

完成内容：

- 新增 `src/state/commands.js`，定义 runtime command vocabulary。
- 新增 `src/state/selectors.js`，提供 command availability selectors。
- 新增 `src/systems/inventorySystem.js`，抽离商店购买和库存消费的纯 helper。
- `src/runtime/moduleBridge.js` 暴露 command/state/inventory helpers。
- `game.js` 新增 `dispatchCommand()`，按钮、键盘、pointer、overlay 和 shop purchase 入口改为派发 command object。
- 保留现有 runtime 函数作为 command handlers，未迁移渲染、音频、主循环或完整状态所有权。

后续风险：

- 下一阶段应把更多 handler 内部的直接状态写入迁移到 reducer-style helpers。
- Audio/FX/overlay 仍是副作用调用，后续 Batch 5 应继续事件化。
```

In `docs/superpowers/plans/2026-05-24-architecture-next-batches.md`:

- Change Batch 4 status to `Completed first stage`.
- Make Batch 5 Event Bus For Side Effects the next recommended batch.

In `progress.md`, append:

```markdown
- 架构 Batch 4：已建立 command vocabulary、state selectors、inventory helpers，并让主要 UI/键盘/pointer/shop 入口通过 `dispatchCommand()` 进入现有 runtime handlers。
```

- [ ] **Step 2: Run browser smoke**

Start static server:

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
  hasCommandType: !!window.GoldMinerModules?.CommandType,
  hasCommand: typeof window.GoldMinerModules?.command === "function",
  hasInventory: typeof window.GoldMinerModules?.buyShopItem === "function",
});
```

Start single-player via the UI and evaluate:

```js
const payload = JSON.parse(window.render_game_to_text());
({
  phase: payload.phase,
  mode: payload.mode,
  seed: payload.seed,
  target: payload.target,
  itemCount: payload.items.length,
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
}
```

Also verify:

- Press `p`, phase remains `playing`, `paused` becomes true.
- Click overlay primary resume, `paused` becomes false.
- Press space once, player 1 hook state becomes `extend`.

- [ ] **Step 3: Run final verification**

Run:

```bash
npm run verify
./macos/build.command
test -f "dist/macos/黄金矿工.app/Contents/Resources/src/state/commands.js"
test -f "dist/macos/黄金矿工.app/Contents/Resources/src/systems/inventorySystem.js"
```

Expected:

- PASS.

- [ ] **Step 4: Final code review**

Dispatch a final code-reviewer subagent for the full Batch 4 implementation. Required result:

- No P0/P1 issues.
- P2 issues are documented as follow-up.

---

## Final Acceptance Criteria

- `CommandType` and `command()` are unit-tested.
- Command availability selectors are unit-tested.
- Inventory helper behavior is unit-tested.
- `GoldMinerModules` exposes command/selectors/inventory helpers.
- `game.js` has `dispatchCommand(rawCommand)`.
- Start, mode select, restart, pause/resume, fire hook, use bomb, shop purchase, next level, music, SFX, and pointer input enter through command dispatch.
- Existing fixed-seed baseline remains stable.
- Browser smoke proves the game still starts and first-level generation remains deterministic.
- macOS bundle includes the new `src/state/` and `src/systems/inventorySystem.js` files.
