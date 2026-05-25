import { GameEventType, gameEvent, isGameEvent } from "../events/eventTypes.js";

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

export function applyFxEvents(events = [], handlers = {}) {
  for (const event of events) {
    if (!isGameEvent(event)) continue;
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
