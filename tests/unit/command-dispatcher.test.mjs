import { test } from "node:test";
import assert from "node:assert/strict";
import { CommandType, command } from "../../src/state/commands.js";
import { dispatchGameCommand } from "../../src/state/commandDispatcher.js";

function createHarness({ phase = "playing", assertCommand = null } = {}) {
  const calls = [];
  const warnings = [];
  const handlers = {
    showModeSelect: () => calls.push(["showModeSelect"]),
    startGame: (mode) => calls.push(["startGame", mode]),
    restartGame: () => calls.push(["restartGame"]),
    togglePause: () => calls.push(["togglePause"]),
    resumeGame: () => calls.push(["resumeGame"]),
    fireHook: (player) => calls.push(["fireHook", player]),
    useBomb: () => calls.push(["useBomb"]),
    buyShopItem: (itemId) => calls.push(["buyShopItem", itemId]),
    startNextLevel: () => calls.push(["startNextLevel"]),
    toggleMusic: () => calls.push(["toggleMusic"]),
    nextTrack: () => calls.push(["nextTrack"]),
    toggleSfx: () => calls.push(["toggleSfx"]),
  };

  const dispatch = (rawCommand) =>
    dispatchGameCommand({
      rawCommand,
      state: { phase },
      handlers,
      commandTypes: CommandType,
      assertCommand,
      warn: (...args) => warnings.push(args),
    });

  return { calls, warnings, dispatch };
}

test("dispatchGameCommand rejects unknown commands in fallback mode without side effects", () => {
  const harness = createHarness({ phase: "playing", assertCommand: null });

  assert.equal(harness.dispatch({ type: "BAD", payload: {} }), false);
  assert.deepEqual(harness.calls, []);
  assert.equal(harness.warnings.length, 1);
  assert.match(String(harness.warnings[0][1]), /Unsupported command type/);
});

test("dispatchGameCommand gates next-level advancement to shop phase", () => {
  for (const phase of ["playing", "gameOver"]) {
    const harness = createHarness({ phase });

    assert.equal(harness.dispatch(command(CommandType.START_NEXT_LEVEL)), false);
    assert.deepEqual(harness.calls, []);
  }

  const shopHarness = createHarness({ phase: "shop" });
  assert.equal(shopHarness.dispatch(command(CommandType.START_NEXT_LEVEL)), true);
  assert.deepEqual(shopHarness.calls, [["startNextLevel"]]);
});

test("dispatchGameCommand routes pause resume and item purchase commands", () => {
  const harness = createHarness({ phase: "playing" });

  assert.equal(harness.dispatch(command(CommandType.TOGGLE_PAUSE)), true);
  assert.equal(harness.dispatch(command(CommandType.RESUME_GAME)), true);
  assert.equal(harness.dispatch(command(CommandType.BUY_SHOP_ITEM, { itemId: "bomb" })), true);

  assert.deepEqual(harness.calls, [["togglePause"], ["resumeGame"], ["buyShopItem", "bomb"]]);
});

test("dispatchGameCommand routes keyboard-equivalent commands with payloads", () => {
  const harness = createHarness({ phase: "playing" });

  for (const rawCommand of [
    command(CommandType.FIRE_HOOK, { player: 0 }),
    command(CommandType.FIRE_HOOK, { player: 1 }),
    command(CommandType.RESTART_GAME),
    command(CommandType.USE_BOMB),
    command(CommandType.TOGGLE_MUSIC),
    command(CommandType.NEXT_TRACK),
    command(CommandType.TOGGLE_SFX),
  ]) {
    assert.equal(harness.dispatch(rawCommand), true);
  }

  assert.deepEqual(harness.calls, [
    ["fireHook", 0],
    ["fireHook", 1],
    ["restartGame"],
    ["useBomb"],
    ["toggleMusic"],
    ["nextTrack"],
    ["toggleSfx"],
  ]);
});

test("dispatchGameCommand gates menu-only start commands", () => {
  const playingHarness = createHarness({ phase: "playing" });

  assert.equal(playingHarness.dispatch(command(CommandType.START_GAME, { mode: "single" })), false);
  assert.deepEqual(playingHarness.calls, []);

  const menuHarness = createHarness({ phase: "menu" });
  assert.equal(menuHarness.dispatch(command(CommandType.START_GAME, { mode: "double" })), true);
  assert.deepEqual(menuHarness.calls, [["startGame", "double"]]);
});
