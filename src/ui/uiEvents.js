import { GameEventType, gameEvent, isGameEvent } from "../events/eventTypes.js";

export function hudUpdateEvent() {
  return gameEvent(GameEventType.HUD_UPDATE);
}

export function hudBumpEvent(target) {
  return gameEvent(GameEventType.HUD_BUMP, { target });
}

export function overlayShowEvent(config) {
  return gameEvent(GameEventType.OVERLAY_SHOW, { config });
}

export function overlayHideEvent() {
  return gameEvent(GameEventType.OVERLAY_HIDE);
}

export function shopRenderEvent() {
  return gameEvent(GameEventType.SHOP_RENDER);
}

export function applyUiEvents(events = [], handlers = {}) {
  for (const event of events) {
    if (!isGameEvent(event)) continue;
    switch (event.type) {
      case GameEventType.HUD_UPDATE:
        handlers.updateHud?.();
        break;
      case GameEventType.HUD_BUMP:
        handlers.bumpHud?.(event.payload.target);
        break;
      case GameEventType.OVERLAY_SHOW:
        handlers.showOverlay?.(event.payload.config);
        break;
      case GameEventType.OVERLAY_HIDE:
        handlers.hideOverlay?.();
        break;
      case GameEventType.SHOP_RENDER:
        handlers.renderShop?.();
        break;
      default:
        break;
    }
  }
}
