import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mapButtonInput,
  mapKeyboardInput,
  mapPointerInput,
} from "../../src/ui/inputAdapter.js";
import { CommandType } from "../../src/state/commands.js";

const playingState = Object.freeze({
  phase: "playing",
  paused: false,
  twoPlayer: false,
});

const menuState = Object.freeze({
  phase: "menu",
  paused: false,
  twoPlayer: false,
});

const command = (type, payload = {}) => ({
  command: { type, payload },
  preventDefault: false,
});

test("button actions map to command descriptors without default prevention", () => {
  assert.deepEqual(mapButtonInput("start", CommandType), command(CommandType.SHOW_MODE_SELECT));
  assert.deepEqual(mapButtonInput("pause", CommandType), command(CommandType.TOGGLE_PAUSE));
  assert.deepEqual(mapButtonInput("restart", CommandType), command(CommandType.RESTART_GAME));
  assert.deepEqual(mapButtonInput("bomb", CommandType), command(CommandType.USE_BOMB));
  assert.deepEqual(mapButtonInput("sound", CommandType), command(CommandType.TOGGLE_SFX));
  assert.deepEqual(mapButtonInput("music", CommandType), command(CommandType.TOGGLE_MUSIC));
});

test("button action mapping ignores unknown actions", () => {
  assert.equal(mapButtonInput("shop", CommandType), null);
});

test("keyboard maps menu start shortcuts and preventDefault flags", () => {
  assert.deepEqual(
    mapKeyboardInput({ code: "Space", key: " " }, menuState, CommandType),
    {
      command: { type: CommandType.START_GAME, payload: { mode: "single" } },
      preventDefault: true,
    },
  );
  assert.deepEqual(
    mapKeyboardInput({ code: "Enter", key: "Enter" }, menuState, CommandType),
    {
      command: { type: CommandType.START_GAME, payload: { mode: "double" } },
      preventDefault: true,
    },
  );
});

test("keyboard maps hook fire shortcuts with legacy state gates", () => {
  assert.deepEqual(
    mapKeyboardInput({ code: "Space", key: " " }, playingState, CommandType),
    {
      command: { type: CommandType.FIRE_HOOK, payload: { player: 0 } },
      preventDefault: true,
    },
  );
  assert.deepEqual(
    mapKeyboardInput(
      { code: "Enter", key: "Enter" },
      { phase: "playing", paused: false, twoPlayer: true },
      CommandType,
    ),
    {
      command: { type: CommandType.FIRE_HOOK, payload: { player: 1 } },
      preventDefault: true,
    },
  );
});

test("keyboard enter does nothing outside menu or active two-player play", () => {
  assert.equal(
    mapKeyboardInput({ code: "Enter", key: "Enter" }, playingState, CommandType),
    null,
  );
  assert.equal(
    mapKeyboardInput(
      { code: "Enter", key: "Enter" },
      { phase: "playing", paused: true, twoPlayer: true },
      CommandType,
    ),
    null,
  );
  assert.equal(
    mapKeyboardInput(
      { code: "Enter", key: "Enter" },
      { phase: "shop", paused: false, twoPlayer: true },
      CommandType,
    ),
    null,
  );
});

test("keyboard maps letter shortcuts case-insensitively without default prevention", () => {
  for (const [key, type] of [
    ["p", CommandType.TOGGLE_PAUSE],
    ["P", CommandType.TOGGLE_PAUSE],
    ["r", CommandType.RESTART_GAME],
    ["R", CommandType.RESTART_GAME],
    ["x", CommandType.USE_BOMB],
    ["X", CommandType.USE_BOMB],
    ["m", CommandType.TOGGLE_MUSIC],
    ["M", CommandType.TOGGLE_MUSIC],
    ["n", CommandType.NEXT_TRACK],
    ["N", CommandType.NEXT_TRACK],
    ["s", CommandType.TOGGLE_SFX],
    ["S", CommandType.TOGGLE_SFX],
  ]) {
    assert.deepEqual(
      mapKeyboardInput({ code: `Key${key.toUpperCase()}`, key }, playingState, CommandType),
      command(type),
    );
  }
});

test("keyboard mapping ignores unrelated keys", () => {
  assert.equal(
    mapKeyboardInput({ code: "Escape", key: "Escape" }, playingState, CommandType),
    null,
  );
});

test("pointer input maps menu to mode select and other phases to player zero hook fire", () => {
  assert.deepEqual(mapPointerInput(menuState, CommandType), command(CommandType.SHOW_MODE_SELECT));
  assert.deepEqual(
    mapPointerInput(playingState, CommandType),
    command(CommandType.FIRE_HOOK, { player: 0 }),
  );
  assert.deepEqual(
    mapPointerInput({ phase: "shop", paused: false, twoPlayer: false }, CommandType),
    command(CommandType.FIRE_HOOK, { player: 0 }),
  );
});

test("adapter returns new plain descriptors and does not mutate supplied state", () => {
  const state = { phase: "playing", paused: false, twoPlayer: true };
  const before = { ...state };
  const first = mapKeyboardInput({ code: "Enter", key: "Enter" }, state, CommandType);
  const second = mapKeyboardInput({ code: "Enter", key: "Enter" }, state, CommandType);

  assert.deepEqual(state, before);
  assert.notEqual(first, second);
  assert.notEqual(first.command, second.command);
  assert.notEqual(first.command.payload, second.command.payload);
});

test("adapter validates inputs and command type vocabulary", () => {
  assert.throws(() => mapButtonInput(null, CommandType), /button action must be a string/);
  assert.throws(() => mapKeyboardInput(null, playingState, CommandType), /keyboard input must be an object/);
  assert.throws(
    () => mapKeyboardInput({ code: 1, key: "p" }, playingState, CommandType),
    /keyboard code must be a string/,
  );
  assert.throws(
    () => mapKeyboardInput({ code: "KeyP", key: 1 }, playingState, CommandType),
    /keyboard key must be a string/,
  );
  assert.throws(
    () => mapKeyboardInput({ code: "KeyP", key: "p" }, null, CommandType),
    /input state must be an object/,
  );
  assert.throws(
    () => mapKeyboardInput({ code: "KeyP", key: "p" }, { phase: "playing" }, CommandType),
    /input state paused must be a boolean/,
  );
  assert.throws(
    () => mapPointerInput({ phase: 1 }, CommandType),
    /input state phase must be a string/,
  );
  assert.throws(
    () => mapPointerInput(playingState, { ...CommandType, FIRE_HOOK: 1 }),
    /commandTypes\.FIRE_HOOK must be a string/,
  );
});
