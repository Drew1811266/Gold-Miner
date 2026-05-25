import { applyAudioEvents } from "./audioEvents.js";

function assertRecord(value, name, { optional = false } = {}) {
  if (optional && value === undefined) return;
  const type = typeof value;
  if (value === null || (type !== "object" && type !== "function")) {
    throw new TypeError(`${name} must be an object or function`);
  }
}

function assertOptionalFunction(value, name) {
  if (value !== undefined && typeof value !== "function") {
    throw new TypeError(`${name} must be a function`);
  }
}

function optionalAudio(audio) {
  assertRecord(audio, "audio facade", { optional: true });
  return audio ?? {};
}

export function createAudioButtonSnapshot(audio = undefined) {
  const facade = optionalAudio(audio);
  const sfxEnabled = facade.isSfxEnabled?.() ?? true;
  const musicEnabled = facade.isMusicEnabled?.() ?? true;
  const trackName = facade.getTrackName?.() ?? "";

  return {
    sfxEnabled,
    musicEnabled,
    trackName,
    soundText: `音效: ${sfxEnabled ? "开" : "关"}`,
    musicText: `音乐: ${musicEnabled ? "开" : "关"}${trackName ? ` · ${trackName}` : ""}`,
  };
}

export function applyAudioEventsToFacade(events = [], facade = {}) {
  if (!Array.isArray(events)) {
    throw new TypeError("audio events must be an array");
  }
  assertRecord(facade, "audio facade options");

  const audio = optionalAudio(facade.audio);
  assertOptionalFunction(facade.syncButtons, "audio facade syncButtons");

  applyAudioEvents(events, {
    init: () => audio.init?.(),
    play: (name, options) => audio.play?.(name, options),
    syncButtons: () => facade.syncButtons?.(),
  });
}
