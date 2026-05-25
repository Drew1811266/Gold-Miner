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
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Expected a valid game command object");
  }

  if (typeof value.type !== "string") {
    throw new TypeError("command type must be a string");
  }

  if (!isCommandType(value.type)) {
    throw new RangeError(`Unsupported command type: ${String(value.type)}`);
  }

  if (value.payload === null || typeof value.payload !== "object" || Array.isArray(value.payload)) {
    throw new TypeError("command payload must be an object");
  }

  return value;
}
