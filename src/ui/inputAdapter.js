const REQUIRED_COMMAND_KEYS = Object.freeze([
  "SHOW_MODE_SELECT",
  "START_GAME",
  "RESTART_GAME",
  "TOGGLE_PAUSE",
  "FIRE_HOOK",
  "USE_BOMB",
  "TOGGLE_MUSIC",
  "NEXT_TRACK",
  "TOGGLE_SFX",
]);

const BUTTON_COMMAND_KEYS = Object.freeze({
  start: "SHOW_MODE_SELECT",
  pause: "TOGGLE_PAUSE",
  restart: "RESTART_GAME",
  bomb: "USE_BOMB",
  sound: "TOGGLE_SFX",
  music: "TOGGLE_MUSIC",
});

const KEY_COMMAND_KEYS = Object.freeze({
  p: "TOGGLE_PAUSE",
  r: "RESTART_GAME",
  x: "USE_BOMB",
  m: "TOGGLE_MUSIC",
  n: "NEXT_TRACK",
  s: "TOGGLE_SFX",
});

function assertRecord(value, name) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

function assertCommandTypes(commandTypes) {
  assertRecord(commandTypes, "commandTypes");
  for (const key of REQUIRED_COMMAND_KEYS) {
    if (typeof commandTypes[key] !== "string") {
      throw new TypeError(`commandTypes.${key} must be a string`);
    }
  }
}

function assertInputState(state, { requirePaused = false, requireTwoPlayer = false } = {}) {
  assertRecord(state, "input state");
  if (typeof state.phase !== "string") {
    throw new TypeError("input state phase must be a string");
  }
  if (requirePaused && typeof state.paused !== "boolean") {
    throw new TypeError("input state paused must be a boolean");
  }
  if (requireTwoPlayer && typeof state.twoPlayer !== "boolean") {
    throw new TypeError("input state twoPlayer must be a boolean");
  }
}

function assertKeyboardInput(input) {
  assertRecord(input, "keyboard input");
  if (input.code !== undefined && typeof input.code !== "string") {
    throw new TypeError("keyboard code must be a string");
  }
  if (input.key !== undefined && typeof input.key !== "string") {
    throw new TypeError("keyboard key must be a string");
  }
}

function descriptor(commandTypes, commandKey, payload = {}, preventDefault = false) {
  return {
    command: {
      type: commandTypes[commandKey],
      payload: { ...payload },
    },
    preventDefault,
  };
}

export function mapButtonInput(action, commandTypes) {
  if (typeof action !== "string") {
    throw new TypeError("button action must be a string");
  }
  assertCommandTypes(commandTypes);

  const commandKey = BUTTON_COMMAND_KEYS[action];
  if (!commandKey) return null;
  return descriptor(commandTypes, commandKey);
}

export function mapKeyboardInput(input, state, commandTypes) {
  assertKeyboardInput(input);
  assertInputState(state, { requirePaused: true, requireTwoPlayer: true });
  assertCommandTypes(commandTypes);

  if (input.code === "Space") {
    if (state.phase === "menu") {
      return descriptor(commandTypes, "START_GAME", { mode: "single" }, true);
    }
    return descriptor(commandTypes, "FIRE_HOOK", { player: 0 }, true);
  }

  if (input.code === "Enter") {
    if (state.phase === "menu") {
      return descriptor(commandTypes, "START_GAME", { mode: "double" }, true);
    }
    if (state.phase === "playing" && !state.paused && state.twoPlayer) {
      return descriptor(commandTypes, "FIRE_HOOK", { player: 1 }, true);
    }
    return null;
  }

  const commandKey = KEY_COMMAND_KEYS[input.key?.toLowerCase()];
  if (!commandKey) return null;
  return descriptor(commandTypes, commandKey);
}

export function mapPointerInput(state, commandTypes) {
  assertInputState(state);
  assertCommandTypes(commandTypes);

  if (state.phase === "menu") return descriptor(commandTypes, "SHOW_MODE_SELECT");
  return descriptor(commandTypes, "FIRE_HOOK", { player: 0 });
}
