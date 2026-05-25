import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CommandType,
  command,
  isCommand,
  isCommandType,
  assertCommand,
} from "../../src/state/commands.js";
import {
  canFireHook,
  canOpenModeSelect,
  canRestart,
  canTogglePause,
  canUseBomb,
  isMenu,
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
  assert.equal(isCommandType(CommandType.FIRE_HOOK), true);
  assert.equal(isCommandType("UNKNOWN"), false);
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
  assert.throws(() => command(CommandType.FIRE_HOOK, []), /payload must be an object/);
  assert.equal(isCommand({ type: "UNKNOWN", payload: {} }), false);
  assert.throws(() => assertCommand({}), /command type must be a string/);
  assert.throws(
    () => assertCommand({ payload: {} }),
    /command type must be a string/,
  );
  assert.throws(
    () => assertCommand({ type: CommandType.FIRE_HOOK }),
    /command payload must be an object/,
  );
  assert.throws(
    () => assertCommand({ type: CommandType.FIRE_HOOK, payload: [] }),
    /command payload must be an object/,
  );
  assert.throws(
    () => assertCommand({ type: "UNKNOWN", payload: {} }),
    /Unsupported command type/,
  );
});

test("selectors identify runtime phase and mode", () => {
  assert.equal(isMenu(baseState), false);
  assert.equal(isMenu({ ...baseState, phase: "menu" }), true);
  assert.equal(isPlaying(baseState), true);
  assert.equal(isPlaying({ ...baseState, phase: "shop" }), false);
  assert.equal(isTwoPlayerMode(baseState), false);
  assert.equal(isTwoPlayerMode({ ...baseState, mode: "double" }), true);
});

test("selectors gate command availability", () => {
  assert.equal(canOpenModeSelect({ ...baseState, phase: "menu" }), true);
  assert.equal(canOpenModeSelect(baseState), false);
  assert.equal(canRestart(baseState), true);
  assert.equal(canRestart({ ...baseState, phase: "shop" }), true);
  assert.equal(canRestart({ ...baseState, phase: "gameOver" }), true);
  assert.equal(canRestart({ ...baseState, phase: "menu" }), false);
  assert.equal(canRestart(undefined), false);
  assert.equal(canRestart({ ...baseState, phase: "bad" }), false);
  assert.equal(canTogglePause(baseState), true);
  assert.equal(canTogglePause({ ...baseState, phase: "shop" }), false);
  assert.equal(canFireHook(baseState, 0), true);
  assert.equal(canFireHook(baseState, 1), false);
  assert.equal(canFireHook({ ...baseState, mode: "double" }, 1), true);
  assert.equal(canFireHook({ ...baseState, mode: "double" }, 2), false);
  assert.equal(canFireHook({ ...baseState, mode: "double" }, -1), false);
  assert.equal(canFireHook({ ...baseState, mode: "double" }, "1"), false);
  assert.equal(canFireHook({ ...baseState, hook: { state: "extend" } }, 0), false);
  assert.equal(
    canUseBomb({
      ...baseState,
      hook: { state: "retract", attachedId: 9 },
    }),
    true,
  );
  assert.equal(canUseBomb({ ...baseState, inventory: { bombs: 0 } }), false);
  assert.equal(canUseBomb({ ...baseState, hook: { state: "retract", attachedId: 0 } }), false);
  assert.equal(canUseBomb({ ...baseState, hook: { state: "retract", attachedId: -1 } }), false);
  assert.equal(canUseBomb({ ...baseState, hook: { state: "retract", attachedId: Number.NaN } }), false);
  assert.equal(canUseBomb({ ...baseState, hook: { state: "retract", attachedId: "9" } }), false);
});
