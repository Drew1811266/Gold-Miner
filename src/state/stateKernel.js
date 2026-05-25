function assertState(state) {
  if (state === null || typeof state !== "object" || Array.isArray(state)) {
    throw new TypeError("stepPlayingState state must be an object");
  }
  if (typeof state.phase !== "string") {
    throw new TypeError("stepPlayingState state.phase must be a string");
  }
  if (!Number.isFinite(state.timeLeft)) {
    throw new TypeError("stepPlayingState state.timeLeft must be finite");
  }
  if (state.audio === null || typeof state.audio !== "object" || Array.isArray(state.audio)) {
    throw new TypeError("stepPlayingState state.audio must be an object");
  }
}

function assertEvents(events) {
  if (events === null || typeof events !== "object" || Array.isArray(events)) {
    throw new TypeError("stepPlayingState events must be an object");
  }
  for (const key of ["countdown", "endLevel"]) {
    if (events[key] !== undefined && typeof events[key] !== "function") {
      throw new TypeError(`stepPlayingState events.${key} must be a function`);
    }
  }
}

export function stepPlayingState({ state, dt, systems = {}, events = {} } = {}) {
  assertState(state);
  if (!Number.isFinite(dt) || dt < 0) {
    throw new TypeError("stepPlayingState dt must be a non-negative finite number");
  }
  if (systems === null || typeof systems !== "object" || Array.isArray(systems)) {
    throw new TypeError("stepPlayingState systems must be an object");
  }
  assertEvents(events);

  if (state.phase !== "playing") {
    return { shouldContinue: false, ended: false, countdownSec: null };
  }

  state.timeLeft -= dt;
  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    events.endLevel?.();
    return { shouldContinue: false, ended: true, countdownSec: null };
  }

  const secLeft = Math.ceil(state.timeLeft);
  if (secLeft > 0 && secLeft <= 10 && state.audio.lastCountdownSec !== secLeft) {
    state.audio.lastCountdownSec = secLeft;
    events.countdown?.(secLeft);
    return { shouldContinue: true, ended: false, countdownSec: secLeft };
  }

  return { shouldContinue: true, ended: false, countdownSec: null };
}
