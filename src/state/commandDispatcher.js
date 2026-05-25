function warnInvalid(warn, error) {
  warn("Ignoring invalid Gold Miner command.", error);
}

function validateFallbackCommand(rawCommand, types, warn) {
  if (rawCommand === null || typeof rawCommand !== "object" || Array.isArray(rawCommand)) {
    warnInvalid(warn, new TypeError("Expected a valid game command object"));
    return null;
  }

  if (rawCommand.payload === null || typeof rawCommand.payload !== "object" || Array.isArray(rawCommand.payload)) {
    warnInvalid(warn, new TypeError("command payload must be an object"));
    return null;
  }

  if (!Object.values(types).includes(rawCommand.type)) {
    warnInvalid(warn, new RangeError(`Unsupported command type: ${String(rawCommand.type)}`));
    return null;
  }

  return rawCommand;
}

export function dispatchGameCommand({
  rawCommand,
  state,
  handlers,
  commandTypes,
  assertCommand = null,
  warn = console.warn,
}) {
  const types = commandTypes;
  let command;

  try {
    command = assertCommand ? assertCommand(rawCommand) : validateFallbackCommand(rawCommand, types, warn);
  } catch (error) {
    warnInvalid(warn, error);
    return false;
  }

  if (!command) return false;

  const payload = command.payload ?? {};
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    warnInvalid(warn, new TypeError("command payload must be an object"));
    return false;
  }

  if (!Object.values(types).includes(command.type)) {
    warnInvalid(warn, new RangeError(`Unsupported command type: ${String(command.type)}`));
    return false;
  }

  switch (command.type) {
    case types.SHOW_MODE_SELECT:
      if (state.phase === "menu") {
        handlers.showModeSelect();
        return true;
      }
      return false;
    case types.START_GAME:
      if (state.phase === "menu") {
        handlers.startGame(payload.mode);
        return true;
      }
      return false;
    case types.RESTART_GAME:
      if (state.phase !== "menu") {
        handlers.restartGame();
        return true;
      }
      return false;
    case types.TOGGLE_PAUSE:
      handlers.togglePause();
      return true;
    case types.RESUME_GAME:
      handlers.resumeGame();
      return true;
    case types.FIRE_HOOK:
      handlers.fireHook(payload.player ?? 0);
      return true;
    case types.USE_BOMB:
      handlers.useBomb();
      return true;
    case types.BUY_SHOP_ITEM:
      handlers.buyShopItem(payload.itemId);
      return true;
    case types.START_NEXT_LEVEL:
      if (state.phase === "shop") {
        handlers.startNextLevel();
        return true;
      }
      return false;
    case types.TOGGLE_MUSIC:
      handlers.toggleMusic();
      return true;
    case types.NEXT_TRACK:
      handlers.nextTrack();
      return true;
    case types.TOGGLE_SFX:
      handlers.toggleSfx();
      return true;
    default:
      return false;
  }
}
