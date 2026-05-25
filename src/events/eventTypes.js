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

function cloneAndFreeze(value, seen = new WeakMap()) {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return seen.get(value);

  if (Array.isArray(value)) {
    const clone = [];
    seen.set(value, clone);
    for (const item of value) clone.push(cloneAndFreeze(item, seen));
    return Object.freeze(clone);
  }

  const clone = {};
  seen.set(value, clone);
  for (const [key, nestedValue] of Object.entries(value)) {
    clone[key] = cloneAndFreeze(nestedValue, seen);
  }
  return Object.freeze(clone);
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
    payload: cloneAndFreeze(payload),
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
