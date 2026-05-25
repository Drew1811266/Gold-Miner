export function isMenu(state) {
  return state?.phase === "menu";
}

export function isPlaying(state) {
  return state?.phase === "playing";
}

export function isTwoPlayerMode(state) {
  return state?.mode === "double";
}

function isKnownNonMenuPhase(state) {
  return state?.phase === "playing" || state?.phase === "shop" || state?.phase === "gameOver";
}

export function canOpenModeSelect(state) {
  return isMenu(state);
}

export function canRestart(state) {
  return isKnownNonMenuPhase(state);
}

export function canTogglePause(state) {
  return isPlaying(state);
}

function hookForPlayer(state, player = 0) {
  return player === 1 ? state?.hook2 : state?.hook;
}

function isValidPlayerIndex(player) {
  return Number.isInteger(player) && (player === 0 || player === 1);
}

export function canFireHook(state, player = 0) {
  if (!isValidPlayerIndex(player)) return false;
  if (!isPlaying(state) || state?.paused) return false;
  if (!isTwoPlayerMode(state) && player !== 0) return false;
  return hookForPlayer(state, player)?.state === "swing";
}

function hasAttachedItem(hook) {
  return Number.isInteger(hook?.attachedId) && hook.attachedId > 0;
}

export function canUseBomb(state) {
  if (!isPlaying(state) || state?.paused) return false;
  if ((state?.inventory?.bombs ?? 0) <= 0) return false;

  const hooks = isTwoPlayerMode(state) ? [state?.hook, state?.hook2] : [state?.hook];
  return hooks.some((hook) => hook?.state === "retract" && hasAttachedItem(hook));
}
