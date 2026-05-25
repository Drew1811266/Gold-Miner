import { GameEventType, gameEvent, isGameEvent } from "../events/eventTypes.js";

export function audioPlayEvent(name, options = undefined) {
  return gameEvent(GameEventType.AUDIO_PLAY, options === undefined ? { name } : { name, options });
}

export function audioSyncButtonsEvent() {
  return gameEvent(GameEventType.AUDIO_SYNC_BUTTONS);
}

export function applyAudioEvents(events = [], handlers = {}) {
  for (const event of events) {
    if (!isGameEvent(event)) continue;
    if (event.type === GameEventType.AUDIO_PLAY) {
      handlers.init?.();
      handlers.play?.(event.payload.name, event.payload.options);
    } else if (event.type === GameEventType.AUDIO_SYNC_BUTTONS) {
      handlers.syncButtons?.();
    }
  }
}
