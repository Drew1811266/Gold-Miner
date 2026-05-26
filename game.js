"use strict";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d", { alpha: false });

const ui = {
  level: document.getElementById("level"),
  score: document.getElementById("score"),
  target: document.getElementById("target"),
  time: document.getElementById("time"),
  bombs: document.getElementById("bombs"),
  speedTokens: document.getElementById("speedTokens"),
  luckyTokens: document.getElementById("luckyTokens"),
  startBtn: document.getElementById("startBtn"),
  pauseBtn: document.getElementById("pauseBtn"),
  restartBtn: document.getElementById("restartBtn"),
  bombBtn: document.getElementById("bombBtn"),
  soundBtn: document.getElementById("soundBtn"),
  musicBtn: document.getElementById("musicBtn"),
  marketTicker: document.getElementById("marketTicker"),
  overlay: document.getElementById("overlay"),
  overlayTitle: document.getElementById("overlayTitle"),
  overlayText: document.getElementById("overlayText"),
  overlayPrimaryBtn: document.getElementById("overlayPrimaryBtn"),
  overlaySecondaryBtn: document.getElementById("overlaySecondaryBtn"),
  shopPanel: document.getElementById("shopPanel"),
  shopList: document.getElementById("shopList"),
  shopSeed: document.getElementById("shopSeed"),
};

const uiRefs = {
  bombChip: document.getElementById("bombs")?.closest(".chip") ?? null,
  speedChip: document.getElementById("speedTokens")?.closest(".chip") ?? null,
  luckyChip: document.getElementById("luckyTokens")?.closest(".chip") ?? null,
  timeStat: document.getElementById("time")?.closest(".stat") ?? null,
  scoreStat: document.getElementById("score")?.closest(".stat") ?? null,
};

function createAudioButtonSnapshotWithLocalAdapter(audio = window.GameAudio) {
  const sfxEnabled = audio?.isSfxEnabled?.() ?? true;
  const musicEnabled = audio?.isMusicEnabled?.() ?? true;
  const trackName = audio?.getTrackName?.() ?? "";

  return {
    sfxEnabled,
    musicEnabled,
    trackName,
    soundText: `音效: ${sfxEnabled ? "开" : "关"}`,
    musicText: `音乐: ${musicEnabled ? "开" : "关"}${trackName ? ` · ${trackName}` : ""}`,
  };
}

function createAudioButtonSnapshotForHost(audio = window.GameAudio) {
  if (!audioAdapterBridgeDisabled && GoldMinerModules.createAudioButtonSnapshot) {
    try {
      return GoldMinerModules.createAudioButtonSnapshot(audio);
    } catch (error) {
      noteAudioAdapterBridgeError(error);
    }
  }

  return createAudioButtonSnapshotWithLocalAdapter(audio);
}

function syncAudioButtons() {
  const snapshot = createAudioButtonSnapshotForHost();
  if (ui.soundBtn) {
    ui.soundBtn.textContent = snapshot.soundText;
  }
  if (ui.musicBtn) {
    ui.musicBtn.textContent = snapshot.musicText;
  }
}

function audioFacadeForHost() {
  return {
    audio: window.GameAudio,
    syncButtons: () => syncAudioButtons(),
  };
}

function applyAudioEventsToFacadeWithLocalAdapter(events, facade = audioFacadeForHost()) {
  const audio = facade.audio ?? {};
  const types = eventTypes();
  for (const event of events) {
    if (event === null || typeof event !== "object") continue;
    if (event.type === types.AUDIO_PLAY) {
      if (event.payload === null || typeof event.payload !== "object" || Array.isArray(event.payload)) continue;
      audio.init?.();
      audio.play?.(event.payload.name, event.payload.options);
    } else if (event.type === types.AUDIO_SYNC_BUTTONS) {
      facade.syncButtons?.();
    }
  }
}

const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

let GoldMinerModules = window.GoldMinerModules ?? {};
let sceneSystemBridgeDisabled = false;
let renderOrderBridgeDisabled = false;
let renderSnapshotBridgeDisabled = false;
let renderFrameBridgeDisabled = false;
let backgroundLayerBridgeDisabled = false;
let plankLayerBridgeDisabled = false;
let itemLayerBridgeDisabled = false;
let itemShapeLayerBridgeDisabled = false;
let hookLayerBridgeDisabled = false;
let hookTrailLayerBridgeDisabled = false;
let hookShapeLayerBridgeDisabled = false;
let carryLabelLayerBridgeDisabled = false;
let winchLayerBridgeDisabled = false;
let minerLayerBridgeDisabled = false;
let fxLayerBridgeDisabled = false;
let fxStateBridgeDisabled = false;
let hookSystemBridgeDisabled = false;
let itemMotionSystemBridgeDisabled = false;
let kegSystemBridgeDisabled = false;
let scoringSystemBridgeDisabled = false;
let randomStreamsBridgeDisabled = false;
let audioAdapterBridgeDisabled = false;
let uiAdapterBridgeDisabled = false;
let inputAdapterBridgeDisabled = false;
let debugApiBridgeDisabled = false;
let stateKernelBridgeDisabled = false;
let debugApiFallback = null;
let stateKernelFallback = null;

function hasGoldMinerModuleInterface(modules) {
  const type = typeof modules;
  return (
    modules !== null &&
    (type === "object" || type === "function") &&
    typeof modules.createRng === "function" &&
    typeof modules.createRandomStream === "function" &&
    typeof modules.generateLevelData === "function" &&
    typeof modules.createSceneData === "function" &&
    typeof modules.createRenderSnapshot === "function" &&
    typeof modules.applyAudioEventsToFacade === "function" &&
    typeof modules.createAudioButtonSnapshot === "function" &&
    typeof modules.renderDebugSnapshotToText === "function" &&
    typeof modules.createDebugAdvancePlan === "function" &&
    typeof modules.createDebugShopSetup === "function" &&
    typeof modules.createInitialGameState === "function" &&
    typeof modules.stepPlayingState === "function" &&
    typeof modules.createHudSnapshot === "function" &&
    typeof modules.applyHudSnapshot === "function" &&
    typeof modules.mapButtonInput === "function" &&
    typeof modules.mapKeyboardInput === "function" &&
    typeof modules.mapPointerInput === "function"
  );
}

function clearPreexistingGoldMinerModules() {
  try {
    delete window.GoldMinerModules;
  } catch {
    // Some injected globals may be non-configurable; the import path below can still use local exports.
  }
}

function setDebugApiFallback(source) {
  if (
    source &&
    typeof source.renderDebugSnapshotToText === "function" &&
    typeof source.createDebugAdvancePlan === "function" &&
    typeof source.createDebugShopSetup === "function"
  ) {
    debugApiFallback = {
      renderDebugSnapshotToText: source.renderDebugSnapshotToText,
      createDebugAdvancePlan: source.createDebugAdvancePlan,
      createDebugShopSetup: source.createDebugShopSetup,
    };
  }
}

function setStateKernelFallback(source) {
  if (
    source &&
    typeof source.createInitialGameState === "function" &&
    typeof source.stepPlayingState === "function"
  ) {
    stateKernelFallback = {
      createInitialGameState: source.createInitialGameState,
      stepPlayingState: source.stepPlayingState,
    };
  }
}

async function loadGoldMinerModules() {
  if (window.GoldMinerModules) {
    if (hasGoldMinerModuleInterface(window.GoldMinerModules)) {
      GoldMinerModules = window.GoldMinerModules;
      setDebugApiFallback(window.GoldMinerModules);
      setStateKernelFallback(window.GoldMinerModules);
      window.__goldMinerModulesReady = true;
      return GoldMinerModules;
    }

    window.__goldMinerModulesReady = false;
    window.__goldMinerModulesError = "Preexisting GoldMinerModules does not expose the required interface";
    console.warn("Gold Miner module bridge global is incompatible; attempting to reload bridge.");
    clearPreexistingGoldMinerModules();
  }

  try {
    const bridge = await import("./src/runtime/moduleBridge.js");
    setDebugApiFallback(bridge);
    setStateKernelFallback(bridge);
    try {
      GoldMinerModules =
        bridge.installGoldMinerModules?.(window) ?? bridge.GoldMinerModules ?? window.GoldMinerModules ?? {};
    } catch (installError) {
      if (!hasGoldMinerModuleInterface(bridge.GoldMinerModules)) throw installError;
      GoldMinerModules = bridge.GoldMinerModules;
      window.__goldMinerModulesError =
        installError instanceof Error ? installError.message : String(installError);
      console.warn("Gold Miner module bridge imported but could not replace the global namespace.", installError);
    }
    window.__goldMinerModulesReady = hasGoldMinerModuleInterface(GoldMinerModules);
    if (!window.__goldMinerModulesReady) {
      window.__goldMinerModulesError = "Gold Miner module bridge does not expose the required interface";
      console.warn("Gold Miner module bridge unavailable; using legacy runtime helpers.");
    }
  } catch (error) {
    GoldMinerModules = {};
    window.__goldMinerModulesReady = false;
    window.__goldMinerModulesError = error instanceof Error ? error.message : String(error);
    console.warn("Gold Miner module bridge unavailable; using legacy runtime helpers.", error);
    try {
      setDebugApiFallback(await import("./src/testing/debugApi.js"));
    } catch {
      // Debug hooks stay unavailable if their own module cannot be loaded.
    }
    try {
      const initialState = await import("./src/state/createInitialState.js");
      const stateKernel = await import("./src/state/stateKernel.js");
      setStateKernelFallback({ ...initialState, ...stateKernel });
    } catch {
      // State initialization stays unavailable if its own modules cannot be loaded.
    }
  }

  return GoldMinerModules;
}

const FALLBACK_COMMAND_TYPE = Object.freeze({
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

const FALLBACK_GAME_EVENT_TYPE = Object.freeze({
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

let runtimeEventQueueUsesBridge = false;
const runtimeEventQueueMirror = [];
let runtimeAudioEventAdapterEnabled = true;
let runtimeUiEventAdapterEnabled = true;
let runtimeFxEventAdapterEnabled = true;

function commandTypes() {
  return GoldMinerModules.CommandType ?? FALLBACK_COMMAND_TYPE;
}

function createRuntimeCommand(type, payload = {}) {
  if (GoldMinerModules.command) return GoldMinerModules.command(type, payload);
  return { type, payload: { ...payload } };
}

function createInputAdapterResult(type, payload = {}, preventDefault = false) {
  return {
    command: {
      type,
      payload: { ...payload },
    },
    preventDefault,
  };
}

function mapButtonInputWithLocalAdapter(action, types) {
  const commands = {
    start: types.SHOW_MODE_SELECT,
    pause: types.TOGGLE_PAUSE,
    restart: types.RESTART_GAME,
    bomb: types.USE_BOMB,
    sound: types.TOGGLE_SFX,
    music: types.TOGGLE_MUSIC,
  };
  const type = commands[action];
  if (!type) return null;
  return createInputAdapterResult(type);
}

function mapKeyboardInputWithLocalAdapter(input, state, types) {
  if (input.code === "Space") {
    if (state.phase === "menu") {
      return createInputAdapterResult(types.START_GAME, { mode: "single" }, true);
    }
    return createInputAdapterResult(types.FIRE_HOOK, { player: 0 }, true);
  }

  if (input.code === "Enter") {
    if (state.phase === "menu") {
      return createInputAdapterResult(types.START_GAME, { mode: "double" }, true);
    }
    if (state.phase === "playing" && !state.paused && state.twoPlayer) {
      return createInputAdapterResult(types.FIRE_HOOK, { player: 1 }, true);
    }
    return null;
  }

  const commands = {
    p: types.TOGGLE_PAUSE,
    r: types.RESTART_GAME,
    x: types.USE_BOMB,
    m: types.TOGGLE_MUSIC,
    n: types.NEXT_TRACK,
    s: types.TOGGLE_SFX,
  };
  const type = commands[input.key?.toLowerCase()];
  if (!type) return null;
  return createInputAdapterResult(type);
}

function mapPointerInputWithLocalAdapter(state, types) {
  if (state.phase === "menu") return createInputAdapterResult(types.SHOW_MODE_SELECT);
  return createInputAdapterResult(types.FIRE_HOOK, { player: 0 });
}

function normalizeInputAdapterResult(result) {
  if (result === null || result === undefined) return null;

  const command = result.command ?? result;
  if (command === null || typeof command !== "object" || typeof command.type !== "string") {
    throw new TypeError("input adapter command type must be a string");
  }

  const payload = command.payload ?? {};
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("input adapter command payload must be an object");
  }

  return {
    type: command.type,
    payload,
    preventDefault: result.preventDefault === true,
  };
}

function inputStateForHost() {
  return {
    phase: game.phase,
    paused: game.paused,
    twoPlayer: isTwoPlayerMode(),
  };
}

function mapButtonInputForHost(action) {
  const types = commandTypes();
  if (!inputAdapterBridgeDisabled && GoldMinerModules.mapButtonInput) {
    try {
      return normalizeInputAdapterResult(GoldMinerModules.mapButtonInput(action, types));
    } catch (error) {
      noteInputAdapterBridgeError(error);
    }
  }

  return normalizeInputAdapterResult(mapButtonInputWithLocalAdapter(action, types));
}

function mapKeyboardInputForHost(event) {
  const input = { code: event.code, key: event.key };
  const state = inputStateForHost();
  const types = commandTypes();
  if (!inputAdapterBridgeDisabled && GoldMinerModules.mapKeyboardInput) {
    try {
      return normalizeInputAdapterResult(GoldMinerModules.mapKeyboardInput(input, state, types));
    } catch (error) {
      noteInputAdapterBridgeError(error);
    }
  }

  return normalizeInputAdapterResult(mapKeyboardInputWithLocalAdapter(input, state, types));
}

function mapPointerInputForHost() {
  const state = inputStateForHost();
  const types = commandTypes();
  if (!inputAdapterBridgeDisabled && GoldMinerModules.mapPointerInput) {
    try {
      return normalizeInputAdapterResult(GoldMinerModules.mapPointerInput(state, types));
    } catch (error) {
      noteInputAdapterBridgeError(error);
    }
  }

  return normalizeInputAdapterResult(mapPointerInputWithLocalAdapter(state, types));
}

function dispatchInputCommand(mappedInput) {
  if (!mappedInput) return;
  dispatchCommand(createRuntimeCommand(mappedInput.type, mappedInput.payload ?? {}));
}

function eventTypes() {
  return GoldMinerModules.GameEventType ?? FALLBACK_GAME_EVENT_TYPE;
}

function noteRuntimeEventBridgeError(error) {
  window.__goldMinerEventBridgeError = error instanceof Error ? error.message : String(error);
}

function noteAudioAdapterBridgeError(error) {
  audioAdapterBridgeDisabled = true;
  if (!Object.prototype.hasOwnProperty.call(window, "__goldMinerAudioAdapterError")) {
    window.__goldMinerAudioAdapterError = error instanceof Error ? error.message : String(error);
  }
  console.warn("Gold Miner audio adapter failed; using local audio fallback.", error);
}

function noteDebugApiBridgeError(error) {
  debugApiBridgeDisabled = true;
  if (!Object.prototype.hasOwnProperty.call(window, "__goldMinerDebugApiError")) {
    window.__goldMinerDebugApiError = error instanceof Error ? error.message : String(error);
  }
  console.warn("Gold Miner debug API failed; using local debug fallback.", error);
}

function noteStateKernelBridgeError(error) {
  stateKernelBridgeDisabled = true;
  if (!Object.prototype.hasOwnProperty.call(window, "__goldMinerStateKernelError")) {
    window.__goldMinerStateKernelError = error instanceof Error ? error.message : String(error);
  }
  console.warn("Gold Miner state kernel failed; using module fallback.", error);
}

function noteHookSystemBridgeError(error) {
  hookSystemBridgeDisabled = true;
  if (!Object.prototype.hasOwnProperty.call(window, "__goldMinerHookSystemError")) {
    window.__goldMinerHookSystemError = error instanceof Error ? error.message : String(error);
  }
  console.warn("Gold Miner hook system failed; using local hook state fallback.", error);
}

function noteItemMotionSystemBridgeError(error) {
  itemMotionSystemBridgeDisabled = true;
  if (!Object.prototype.hasOwnProperty.call(window, "__goldMinerItemMotionSystemError")) {
    window.__goldMinerItemMotionSystemError = error instanceof Error ? error.message : String(error);
  }
  console.warn("Gold Miner item motion system failed; using local item motion fallback.", error);
}

function noteKegSystemBridgeError(error) {
  kegSystemBridgeDisabled = true;
  if (!Object.prototype.hasOwnProperty.call(window, "__goldMinerKegSystemError")) {
    window.__goldMinerKegSystemError = error instanceof Error ? error.message : String(error);
  }
  console.warn("Gold Miner keg system failed; using local keg fallback.", error);
}

function noteUiAdapterBridgeError(error) {
  uiAdapterBridgeDisabled = true;
  if (!Object.prototype.hasOwnProperty.call(window, "__goldMinerUiAdapterError")) {
    window.__goldMinerUiAdapterError = error instanceof Error ? error.message : String(error);
  }
  console.warn("Gold Miner UI adapter failed; using local HUD fallback.", error);
}

function noteInputAdapterBridgeError(error) {
  inputAdapterBridgeDisabled = true;
  if (!Object.prototype.hasOwnProperty.call(window, "__goldMinerInputAdapterError")) {
    window.__goldMinerInputAdapterError = error instanceof Error ? error.message : String(error);
  }
  console.warn("Gold Miner input adapter failed; using local input fallback.", error);
}

function isRuntimeEventType(type) {
  return Object.values(eventTypes()).includes(type);
}

function cloneAndFreezeRuntimeValue(value, seen = new WeakMap()) {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return seen.get(value);

  if (Array.isArray(value)) {
    const clone = [];
    seen.set(value, clone);
    for (const item of value) clone.push(cloneAndFreezeRuntimeValue(item, seen));
    return Object.freeze(clone);
  }

  const clone = {};
  seen.set(value, clone);
  for (const [key, nestedValue] of Object.entries(value)) {
    clone[key] = cloneAndFreezeRuntimeValue(nestedValue, seen);
  }
  return Object.freeze(clone);
}

function createRuntimeEvent(type, payload = {}) {
  if (GoldMinerModules.gameEvent) {
    try {
      return GoldMinerModules.gameEvent(type, payload);
    } catch (error) {
      noteRuntimeEventBridgeError(error);
    }
  }

  if (!isRuntimeEventType(type)) {
    throw new RangeError(`Unsupported game event type: ${String(type)}`);
  }
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("game event payload must be an object");
  }

  return Object.freeze({
    type,
    payload: cloneAndFreezeRuntimeValue(payload),
  });
}

function replaceRuntimeEventMirror(events) {
  runtimeEventQueueMirror.length = 0;
  runtimeEventQueueMirror.push(...events);
}

function runtimeEventQueueArray() {
  if (runtimeEventQueueUsesBridge) return runtimeEventQueueMirror;
  if (Array.isArray(game.events)) return game.events;
  if (Array.isArray(game.events?.events)) return game.events.events;

  game.events = runtimeEventQueueMirror.slice();
  runtimeEventQueueUsesBridge = false;
  return game.events;
}

function ensureRuntimeEventQueue() {
  if (GoldMinerModules.createEventQueue && !runtimeEventQueueUsesBridge) {
    const pendingEvents = runtimeEventQueueArray().slice();
    try {
      game.events = GoldMinerModules.createEventQueue(pendingEvents);
      replaceRuntimeEventMirror(pendingEvents);
      runtimeEventQueueUsesBridge = true;
    } catch (error) {
      noteRuntimeEventBridgeError(error);
      game.events = pendingEvents;
      runtimeEventQueueUsesBridge = false;
    }
  }

  return game.events;
}

function emitGameEvent(eventOrType, payload = {}) {
  const event =
    typeof eventOrType === "string"
      ? createRuntimeEvent(eventOrType, payload)
      : createRuntimeEvent(eventOrType.type, eventOrType.payload ?? {});

  if (GoldMinerModules.enqueueEvent) {
    ensureRuntimeEventQueue();
    if (runtimeEventQueueUsesBridge) {
      try {
        const queuedEvent = GoldMinerModules.enqueueEvent(game.events, event);
        runtimeEventQueueMirror.push(queuedEvent);
        return queuedEvent;
      } catch (error) {
        noteRuntimeEventBridgeError(error);
        game.events = runtimeEventQueueMirror.slice();
        runtimeEventQueueUsesBridge = false;
      }
    }
  }

  const events = runtimeEventQueueArray();
  events.push(event);
  replaceRuntimeEventMirror(events);
  return event;
}

function drainGameEvents() {
  ensureRuntimeEventQueue();

  if (GoldMinerModules.drainEvents && runtimeEventQueueUsesBridge) {
    try {
      const drained = GoldMinerModules.drainEvents(game.events);
      replaceRuntimeEventMirror([]);
      return drained;
    } catch (error) {
      noteRuntimeEventBridgeError(error);
      const pendingEvents = runtimeEventQueueMirror.slice();
      game.events = [];
      runtimeEventQueueUsesBridge = false;
      replaceRuntimeEventMirror([]);
      return pendingEvents;
    }
  }

  const events = runtimeEventQueueArray().slice();
  runtimeEventQueueArray().length = 0;
  replaceRuntimeEventMirror([]);
  return events;
}

function processGameEvents() {
  const events = drainGameEvents();
  if (events.length === 0) return;

  applyRuntimeAudioEvents(events);
  applyRuntimeUiEvents(events);
  applyRuntimeFxEvents(events);
}

function emitAudioEvent(name, options) {
  const payload = options === undefined ? { name } : { name, options };
  return emitGameEvent(eventTypes().AUDIO_PLAY, payload);
}

function emitAudioSyncEvent() {
  return emitGameEvent(eventTypes().AUDIO_SYNC_BUTTONS);
}

function emitHudUpdateEvent() {
  return emitGameEvent(eventTypes().HUD_UPDATE);
}

function emitOverlayShowEvent(config) {
  return emitGameEvent(eventTypes().OVERLAY_SHOW, { config });
}

function emitOverlayHideEvent() {
  return emitGameEvent(eventTypes().OVERLAY_HIDE);
}

function emitShopRenderEvent() {
  return emitGameEvent(eventTypes().SHOP_RENDER);
}

function emitFxRingEvent(payload) {
  return emitGameEvent(eventTypes().FX_RING, payload);
}

function emitFxBurstEvent(payload) {
  return emitGameEvent(eventTypes().FX_BURST, payload);
}

function emitFxFlashEvent(amount) {
  return emitGameEvent(eventTypes().FX_FLASH, { amount });
}

function emitFxShakeEvent(amount) {
  return emitGameEvent(eventTypes().FX_SHAKE, { amount });
}

function emitScorePopEvent(payload) {
  return emitGameEvent(eventTypes().SCORE_POP, payload);
}

function bumpRuntimeHudTarget(target) {
  const targets = {
    bombs: uiRefs.bombChip,
    bombChip: uiRefs.bombChip,
    speed: uiRefs.speedChip,
    speedChip: uiRefs.speedChip,
    lucky: uiRefs.luckyChip,
    luckyChip: uiRefs.luckyChip,
    score: uiRefs.scoreStat,
    scoreStat: uiRefs.scoreStat,
    time: uiRefs.timeStat,
    timeStat: uiRefs.timeStat,
  };
  bump(targets[target] ?? null);
}

function applyRuntimeAudioEvents(events) {
  const facade = audioFacadeForHost();
  const localApply = (eventBatch) => applyAudioEventsToFacadeWithLocalAdapter(eventBatch, facade);

  if (GoldMinerModules.applyEventsWithFallback) {
    const result = GoldMinerModules.applyEventsWithFallback({
      events,
      bridgeApply:
        GoldMinerModules.applyAudioEventsToFacade &&
        runtimeAudioEventAdapterEnabled &&
        !audioAdapterBridgeDisabled
          ? (eventBatch) => GoldMinerModules.applyAudioEventsToFacade(eventBatch, facade)
          : null,
      localApply,
      onError: (error) => {
        noteRuntimeEventBridgeError(error);
        noteAudioAdapterBridgeError(error);
      },
    });
    if (result.disabled) runtimeAudioEventAdapterEnabled = false;
    return;
  }

  if (
    GoldMinerModules.applyAudioEventsToFacade &&
    runtimeAudioEventAdapterEnabled &&
    !audioAdapterBridgeDisabled
  ) {
    for (let index = 0; index < events.length; index += 1) {
      try {
        GoldMinerModules.applyAudioEventsToFacade([events[index]], facade);
      } catch (error) {
        noteRuntimeEventBridgeError(error);
        noteAudioAdapterBridgeError(error);
        runtimeAudioEventAdapterEnabled = false;
        events = events.slice(index + 1);
        break;
      }
    }
    if (runtimeAudioEventAdapterEnabled) return;
  }

  localApply(events);
}

function applyRuntimeUiEvents(events) {
  const handlers = {
    updateHud: () => updateHud(),
    bumpHud: (target) => bumpRuntimeHudTarget(target),
    showOverlay: (config) => showOverlay(config),
    hideOverlay: () => hideOverlay(),
    renderShop: () => renderShop(),
  };
  const localApply = (eventBatch) => {
    const types = eventTypes();
    for (const event of eventBatch) {
      switch (event.type) {
        case types.HUD_UPDATE:
          updateHud();
          break;
        case types.HUD_BUMP:
          bumpRuntimeHudTarget(event.payload.target);
          break;
        case types.OVERLAY_SHOW:
          showOverlay(event.payload.config);
          break;
        case types.OVERLAY_HIDE:
          hideOverlay();
          break;
        case types.SHOP_RENDER:
          renderShop();
          break;
        default:
          break;
      }
    }
  };

  if (GoldMinerModules.applyEventsWithFallback) {
    const result = GoldMinerModules.applyEventsWithFallback({
      events,
      bridgeApply:
        GoldMinerModules.applyUiEvents && runtimeUiEventAdapterEnabled
          ? (eventBatch) => GoldMinerModules.applyUiEvents(eventBatch, handlers)
          : null,
      localApply,
      onError: (error) => noteRuntimeEventBridgeError(error),
    });
    if (result.disabled) runtimeUiEventAdapterEnabled = false;
    return;
  }

  if (GoldMinerModules.applyUiEvents && runtimeUiEventAdapterEnabled) {
    for (let index = 0; index < events.length; index += 1) {
      try {
        GoldMinerModules.applyUiEvents([events[index]], handlers);
      } catch (error) {
        noteRuntimeEventBridgeError(error);
        runtimeUiEventAdapterEnabled = false;
        events = events.slice(index + 1);
        break;
      }
    }
    if (runtimeUiEventAdapterEnabled) return;
  }

  localApply(events);
}

function applyRuntimeFxEvents(events) {
  const handlers = {
    spawnRing: (payload) => spawnRing(payload),
    spawnBurst: (payload) => spawnBurst(payload),
    flash: (amount) => {
      game.fx.flash = Math.max(game.fx.flash, amount ?? 0);
    },
    shake: (amount) => {
      game.fx.shake = Math.max(game.fx.shake, amount ?? 0);
    },
    scorePop: (payload) =>
      addScorePop(payload.amount, payload.color, payload.hook ?? (payload.player === 1 ? game.hook2 : game.hook)),
  };
  const localApply = (eventBatch) => {
    const types = eventTypes();
    for (const event of eventBatch) {
      switch (event.type) {
        case types.FX_RING:
          spawnRing(event.payload);
          break;
        case types.FX_BURST:
          spawnBurst(event.payload);
          break;
        case types.FX_FLASH:
          game.fx.flash = Math.max(game.fx.flash, event.payload.amount ?? 0);
          break;
        case types.FX_SHAKE:
          game.fx.shake = Math.max(game.fx.shake, event.payload.amount ?? 0);
          break;
        case types.SCORE_POP:
          addScorePop(
            event.payload.amount,
            event.payload.color,
            event.payload.hook ?? (event.payload.player === 1 ? game.hook2 : game.hook),
          );
          break;
        default:
          break;
      }
    }
  };

  if (GoldMinerModules.applyEventsWithFallback) {
    const result = GoldMinerModules.applyEventsWithFallback({
      events,
      bridgeApply:
        GoldMinerModules.applyFxEvents && runtimeFxEventAdapterEnabled
          ? (eventBatch) => GoldMinerModules.applyFxEvents(eventBatch, handlers)
          : null,
      localApply,
      onError: (error) => noteRuntimeEventBridgeError(error),
    });
    if (result.disabled) runtimeFxEventAdapterEnabled = false;
    return;
  }

  if (GoldMinerModules.applyFxEvents && runtimeFxEventAdapterEnabled) {
    for (let index = 0; index < events.length; index += 1) {
      try {
        GoldMinerModules.applyFxEvents([events[index]], handlers);
      } catch (error) {
        noteRuntimeEventBridgeError(error);
        runtimeFxEventAdapterEnabled = false;
        events = events.slice(index + 1);
        break;
      }
    }
    if (runtimeFxEventAdapterEnabled) return;
  }

  localApply(events);
}

function clamp(value, min, max) {
  return GoldMinerModules.clamp
    ? GoldMinerModules.clamp(value, min, max)
    : Math.max(min, Math.min(max, value));
}

function clampHookLengthWithLocalState(length, { minLength, maxLength }) {
  return clamp(length, minLength, maxLength);
}

function clampHookLength(length, { minLength, maxLength }) {
  if (!hookSystemBridgeDisabled && GoldMinerModules.clampHookLength) {
    try {
      return GoldMinerModules.clampHookLength(length, { minLength, maxLength });
    } catch (error) {
      noteHookSystemBridgeError(error);
    }
  }

  return clampHookLengthWithLocalState(length, { minLength, maxLength });
}

function lerp(a, b, t) {
  return GoldMinerModules.lerp ? GoldMinerModules.lerp(a, b, t) : a + (b - a) * t;
}

function dist2(ax, ay, bx, by) {
  if (GoldMinerModules.dist2) return GoldMinerModules.dist2(ax, ay, bx, by);
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function roundRectPath(x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function segmentCircleIntersect(ax, ay, bx, by, cx, cy, radius) {
  if (GoldMinerModules.segmentCircleIntersect) {
    return GoldMinerModules.segmentCircleIntersect(ax, ay, bx, by, cx, cy, radius);
  }

  const abx = bx - ax;
  const aby = by - ay;
  const acx = cx - ax;
  const acy = cy - ay;

  const abLen2 = abx * abx + aby * aby;
  if (abLen2 <= 1e-6) return dist2(ax, ay, cx, cy) <= radius * radius;

  const t = clamp((acx * abx + acy * aby) / abLen2, 0, 1);
  const hx = ax + abx * t;
  const hy = ay + aby * t;
  return dist2(hx, hy, cx, cy) <= radius * radius;
}

function createRng(seed) {
  if (GoldMinerModules.createRng) return GoldMinerModules.createRng(seed);

  let state = seed >>> 0;
  return {
    next() {
      state += 0x6d2b79f5;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    range(min, max) {
      return lerp(min, max, this.next());
    },
    pick(list) {
      return list[Math.floor(this.next() * list.length)];
    },
  };
}

const RANDOM_STREAM_BASE_SEED = 0xa5f1523d;
const RANDOM_STREAM_FNV_OFFSET = 0x811c9dc5;
const RANDOM_STREAM_FNV_PRIME = 0x01000193;

function noteRandomStreamsBridgeError(error) {
  if (!Object.prototype.hasOwnProperty.call(window, "__goldMinerRandomStreamsError")) {
    window.__goldMinerRandomStreamsError = error instanceof Error ? error.message : String(error);
  }
}

function assertRandomStreamInteger(value, label) {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new TypeError(`${label} must be a finite integer`);
  }
  return value >>> 0;
}

function assertRandomStreamName(name) {
  if (typeof name !== "string" || name.trim() === "") {
    throw new TypeError("name must be a non-empty string");
  }
  return name;
}

function hashRandomStreamName(value) {
  let hash = RANDOM_STREAM_FNV_OFFSET;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, RANDOM_STREAM_FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
}

function mixRandomStreamUint32(value) {
  let mixed = value >>> 0;
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 0x7feb352d) >>> 0;
  mixed ^= mixed >>> 15;
  mixed = Math.imul(mixed, 0x846ca68b) >>> 0;
  mixed ^= mixed >>> 16;
  return mixed >>> 0;
}

function mixRandomStreamSeed(seed, value) {
  return mixRandomStreamUint32((seed ^ mixRandomStreamUint32(value)) >>> 0);
}

function createRandomStreamSeedWithLocalState({ runSeed, levelSeed = 0, name, salt = 0 }) {
  const runSeedPart = assertRandomStreamInteger(runSeed, "runSeed");
  const levelSeedPart = assertRandomStreamInteger(levelSeed, "levelSeed");
  const saltPart = assertRandomStreamInteger(salt, "salt");
  const namePart = hashRandomStreamName(assertRandomStreamName(name));

  let seed = RANDOM_STREAM_BASE_SEED;
  seed = mixRandomStreamSeed(seed, runSeedPart);
  seed = mixRandomStreamSeed(seed, levelSeedPart);
  seed = mixRandomStreamSeed(seed, saltPart);
  seed = mixRandomStreamSeed(seed, namePart);
  return seed >>> 0;
}

function createRandomStreamWithLocalState(options) {
  const rng = createRng(createRandomStreamSeedWithLocalState(options));
  return {
    next() {
      return rng.next();
    },
    range(min, max) {
      if (!Number.isFinite(min) || !Number.isFinite(max)) {
        throw new TypeError("random stream range endpoints must be finite numbers");
      }
      return lerp(min, max, rng.next());
    },
    pick(list) {
      if (!Array.isArray(list) || list.length === 0) {
        throw new TypeError("random stream pick list must be a non-empty array");
      }
      return list[Math.floor(rng.next() * list.length)];
    },
  };
}

function assertRandomStreamApi(stream) {
  if (
    stream === null ||
    typeof stream !== "object" ||
    typeof stream.next !== "function" ||
    typeof stream.range !== "function" ||
    typeof stream.pick !== "function"
  ) {
    throw new TypeError("random stream must expose next, range, and pick functions");
  }
  return stream;
}

function createRandomStreamForHost(name, salt = 0) {
  const options = {
    runSeed: game.runSeed,
    levelSeed: game.currentSeed || 0,
    name,
    salt,
  };

  if (!randomStreamsBridgeDisabled && GoldMinerModules.createRandomStream) {
    try {
      return assertRandomStreamApi(GoldMinerModules.createRandomStream(options));
    } catch (error) {
      randomStreamsBridgeDisabled = true;
      noteRandomStreamsBridgeError(error);
      console.warn("Gold Miner random stream bridge failed; using local fallback.", error);
    }
  }

  return createRandomStreamWithLocalState(options);
}

function resetGameplayRandomStreams() {
  game.randomStreams = {
    kegImmediate: createRandomStreamForHost(
      "kegImmediate",
      GAMEPLAY_RANDOM_STREAM_SALTS.kegImmediate,
    ),
  };
  game.randomStreamsRunSeed = game.runSeed;
  game.randomStreamsLevelSeed = game.currentSeed || 0;
}

function gameplayRandomStreams() {
  const levelSeed = game.currentSeed || 0;
  if (
    game.randomStreamsRunSeed !== game.runSeed ||
    game.randomStreamsLevelSeed !== levelSeed ||
    game.randomStreams === null ||
    typeof game.randomStreams !== "object"
  ) {
    resetGameplayRandomStreams();
  }
  return game.randomStreams;
}

function getGameplayRandomStream(name, salt = 0) {
  const streams = gameplayRandomStreams();
  if (!streams[name]) {
    streams[name] = createRandomStreamForHost(name, salt);
  }
  return streams[name];
}

function shouldKegExplodeImmediately() {
  return (
    getGameplayRandomStream("kegImmediate", GAMEPLAY_RANDOM_STREAM_SALTS.kegImmediate).next() <
    KEG_IMMEDIATE_BOOM_CHANCE
  );
}

const BG = {
  w: 1280,
  h: 720,
  groundY: 518,
};

function buildRidgePath(rng, yBase, amplitude, steps, bottomY) {
  const pts = [];
  let last = yBase + (rng.next() - 0.5) * amplitude;
  for (let i = 0; i <= steps; i += 1) {
    const x = (i / steps) * BG.w;
    const n = (rng.next() - 0.5) * amplitude;
    last = lerp(last, yBase + n, 0.55);
    pts.push({ x, y: last });
  }

  let d = `M 0 ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i += 1) {
    d += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
  }
  d += ` L ${BG.w} ${bottomY} L 0 ${bottomY} Z`;
  return d;
}

function buildBackgroundSvg(theme) {
  const rng = createRng(theme.seed);
  const skyId = `sky_${theme.id}`;
  const soilId = `soil_${theme.id}`;
  const hazeId = `haze_${theme.id}`;

  const sunX = rng.range(140, 1140);
  const sunY = rng.range(80, 250);
  const sunR = rng.range(46, 96);

  const parts = [];
  parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BG.w} ${BG.h}" width="${BG.w}" height="${BG.h}" preserveAspectRatio="xMidYMid slice">`
  );
  parts.push(`<defs>`);
  parts.push(
    `<linearGradient id="${skyId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${theme.skyTop}"/><stop offset="1" stop-color="${theme.skyBottom}"/></linearGradient>`
  );
  parts.push(
    `<linearGradient id="${soilId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${theme.soilTop}"/><stop offset="1" stop-color="${theme.soilBottom}"/></linearGradient>`
  );
  parts.push(
    `<radialGradient id="${hazeId}" cx="50%" cy="20%" r="75%"><stop offset="0" stop-color="${theme.haze}" stop-opacity="0.35"/><stop offset="1" stop-color="${theme.haze}" stop-opacity="0"/></radialGradient>`
  );
  parts.push(`</defs>`);

  // Sky base
  parts.push(`<rect width="${BG.w}" height="${BG.h}" fill="url(#${skyId})"/>`);
  parts.push(`<rect width="${BG.w}" height="${BG.groundY}" fill="url(#${hazeId})" opacity="1"/>`);

  // Sun / moon
  parts.push(
    `<circle cx="${sunX.toFixed(1)}" cy="${sunY.toFixed(1)}" r="${sunR.toFixed(
      1
    )}" fill="${theme.sun}" opacity="0.95"/>`
  );
  parts.push(
    `<circle cx="${(sunX + sunR * 0.35).toFixed(1)}" cy="${(sunY + sunR * 0.22).toFixed(
      1
    )}" r="${(sunR * 0.72).toFixed(1)}" fill="${theme.skyTop}" opacity="${theme.stars ? 0.08 : 0.06}"/>`
  );

  // Stars or clouds
  if (theme.stars) {
    const starCount = 90;
    parts.push(`<g fill="#ffffff">`);
    for (let i = 0; i < starCount; i += 1) {
      const x = rng.range(0, BG.w);
      const y = rng.range(0, BG.groundY * 0.62);
      const r = rng.range(0.6, 1.9);
      const a = rng.range(0.08, 0.28);
      parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" opacity="${a.toFixed(3)}"/>`);
    }
    parts.push(`</g>`);
  } else {
    const cloudCount = 8;
    parts.push(`<g opacity="0.16" fill="#ffffff">`);
    for (let i = 0; i < cloudCount; i += 1) {
      const x = rng.range(80, BG.w - 80);
      const y = rng.range(70, BG.groundY * 0.52);
      const w = rng.range(140, 280);
      const h = rng.range(38, 70);
      parts.push(
        `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(w * 0.52).toFixed(
          1
        )}" ry="${(h * 0.52).toFixed(1)}"/>`
      );
      parts.push(
        `<ellipse cx="${(x - w * 0.22).toFixed(1)}" cy="${(y + h * 0.08).toFixed(
          1
        )}" rx="${(w * 0.34).toFixed(1)}" ry="${(h * 0.34).toFixed(1)}"/>`
      );
      parts.push(
        `<ellipse cx="${(x + w * 0.24).toFixed(1)}" cy="${(y + h * 0.1).toFixed(
          1
        )}" rx="${(w * 0.28).toFixed(1)}" ry="${(h * 0.28).toFixed(1)}"/>`
      );
    }
    parts.push(`</g>`);
  }

  // Ridges / silhouettes
  const ridge1 = buildRidgePath(rng, theme.ridge1Y, theme.ridge1Amp, 14, BG.groundY);
  const ridge2 = buildRidgePath(rng, theme.ridge2Y, theme.ridge2Amp, 16, BG.groundY);
  parts.push(`<path d="${ridge1}" fill="${theme.ridgeFar}" opacity="0.95"/>`);
  parts.push(`<path d="${ridge2}" fill="${theme.ridgeNear}" opacity="0.98"/>`);

  // Motif (simple silhouettes)
  if (theme.motif === "cactus") {
    parts.push(`<g fill="rgba(0,0,0,0.18)">`);
    const baseY = BG.groundY - 6;
    for (let i = 0; i < 6; i += 1) {
      const x = rng.range(60, BG.w - 60);
      const h = rng.range(36, 92);
      parts.push(`<rect x="${(x - 6).toFixed(1)}" y="${(baseY - h).toFixed(1)}" width="12" height="${h.toFixed(1)}" rx="6"/>`);
      if (rng.next() > 0.45) {
        const armH = rng.range(18, 42);
        const armW = rng.range(16, 28);
        const dir = rng.next() > 0.5 ? 1 : -1;
        const armY = baseY - h * 0.62;
        const armX = dir > 0 ? x + 4 : x - 4 - armW;
        const farEndX = dir > 0 ? armX + armW : armX;
        parts.push(`<rect x="${armX.toFixed(1)}" y="${armY.toFixed(1)}" width="${armW.toFixed(1)}" height="10" rx="6"/>`);
        parts.push(`<rect x="${(farEndX - 6).toFixed(1)}" y="${(armY - armH).toFixed(1)}" width="12" height="${armH.toFixed(1)}" rx="6"/>`);
      }
    }
    parts.push(`</g>`);
  }

  if (theme.motif === "pines") {
    parts.push(`<g fill="rgba(0,0,0,0.20)">`);
    const baseY = BG.groundY + 1;
    for (let i = 0; i < 8; i += 1) {
      const x = rng.range(40, BG.w - 40);
      const s = rng.range(0.8, 1.3);
      parts.push(
        `<path d="M ${x.toFixed(1)} ${(baseY - 92 * s).toFixed(1)} L ${(x - 34 * s).toFixed(
          1
        )} ${baseY.toFixed(1)} L ${(x + 34 * s).toFixed(1)} ${baseY.toFixed(1)} Z" />`
      );
    }
    parts.push(`</g>`);
  }

  if (theme.motif === "gears") {
    parts.push(`<g opacity="0.14" fill="#ffffff">`);
    for (let i = 0; i < 5; i += 1) {
      const x = rng.range(120, BG.w - 120);
      const y = rng.range(120, BG.groundY * 0.55);
      const r = rng.range(26, 54);
      parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}"/>`);
      parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r * 0.55).toFixed(1)}" fill="${theme.skyTop}" opacity="0.55"/>`);
    }
    parts.push(`</g>`);
  }

  // Ground edge
  parts.push(`<rect x="0" y="${BG.groundY}" width="${BG.w}" height="6" fill="rgba(0,0,0,0.28)"/>`);
  parts.push(`<rect x="0" y="${BG.groundY - 1}" width="${BG.w}" height="2" fill="rgba(255,255,255,0.07)"/>`);

  // Soil base
  parts.push(`<rect x="0" y="${BG.groundY}" width="${BG.w}" height="${BG.h - BG.groundY}" fill="url(#${soilId})"/>`);

  // Underground rocks / texture
  parts.push(`<g opacity="0.26">`);
  for (let i = 0; i < 70; i += 1) {
    const x = rng.range(0, BG.w);
    const y = rng.range(BG.groundY + 18, BG.h);
    const r = rng.range(1.5, 6.5);
    const a = rng.range(0.04, 0.18);
    parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="rgba(0,0,0,${a.toFixed(3)})"/>`);
  }
  parts.push(`</g>`);

  // Crystals
  const crystalCount = 10;
  parts.push(`<g opacity="0.9">`);
  for (let i = 0; i < crystalCount; i += 1) {
    const x = rng.range(60, BG.w - 60);
    const y = rng.range(BG.groundY + 70, BG.h - 40);
    const s = rng.range(18, 44);
    const c = theme.crystals[Math.floor(rng.next() * theme.crystals.length)];
    parts.push(
      `<path d="M ${x.toFixed(1)} ${(y - s).toFixed(1)} L ${(x + s * 0.55).toFixed(
        1
      )} ${y.toFixed(1)} L ${x.toFixed(1)} ${(y + s * 1.05).toFixed(1)} L ${(x - s * 0.55).toFixed(1)} ${y.toFixed(1)} Z" fill="${c}" opacity="0.65"/>`
    );
    parts.push(
      `<path d="M ${x.toFixed(1)} ${(y - s * 0.88).toFixed(1)} L ${(x + s * 0.4).toFixed(
        1
      )} ${y.toFixed(1)} L ${x.toFixed(1)} ${(y + s * 0.8).toFixed(1)} L ${(x - s * 0.4).toFixed(1)} ${y.toFixed(1)} Z" fill="#ffffff" opacity="0.18"/>`
    );
  }
  parts.push(`</g>`);

  // Vignette
  parts.push(
    `<radialGradient id="vig_${theme.id}" cx="50%" cy="45%" r="80%"><stop offset="0" stop-color="rgba(0,0,0,0)"/><stop offset="1" stop-color="rgba(0,0,0,0.32)"/></radialGradient>`
  );
  parts.push(`<rect width="${BG.w}" height="${BG.h}" fill="url(#vig_${theme.id})"/>`);

  parts.push(`</svg>`);
  return parts.join("");
}

function createBackgroundLibrary() {
  const themes = [
    {
      id: "bg01",
      name: "星夜矿山",
      seed: 101,
      stars: true,
      motif: null,
      skyTop: "#0b1230",
      skyBottom: "#050811",
      haze: "#9db6ff",
      sun: "#ffe6a4",
      ridgeFar: "#1b2a5a",
      ridgeNear: "#0f1838",
      ridge1Y: 340,
      ridge2Y: 410,
      ridge1Amp: 70,
      ridge2Amp: 92,
      soilTop: "#2a241b",
      soilBottom: "#0e0b08",
      crystals: ["#8fe9ff", "#b07bff", "#ffd34d"],
    },
    {
      id: "bg02",
      name: "晨曦峡谷",
      seed: 202,
      stars: false,
      motif: "cactus",
      skyTop: "#ffb36a",
      skyBottom: "#4b2569",
      haze: "#fff1c4",
      sun: "#fff1c4",
      ridgeFar: "#7b2b4e",
      ridgeNear: "#3b1836",
      ridge1Y: 350,
      ridge2Y: 425,
      ridge1Amp: 74,
      ridge2Amp: 96,
      soilTop: "#3a2818",
      soilBottom: "#120a06",
      crystals: ["#ffd34d", "#ff8a5c", "#b07bff"],
    },
    {
      id: "bg03",
      name: "黄昏沙丘",
      seed: 303,
      stars: false,
      motif: "cactus",
      skyTop: "#f6c54b",
      skyBottom: "#2f2a63",
      haze: "#ffe08a",
      sun: "#ffe08a",
      ridgeFar: "#a2621a",
      ridgeNear: "#5a3416",
      ridge1Y: 360,
      ridge2Y: 440,
      ridge1Amp: 58,
      ridge2Amp: 76,
      soilTop: "#3d2c17",
      soilBottom: "#130b06",
      crystals: ["#ffd34d", "#8fe9ff"],
    },
    {
      id: "bg04",
      name: "雪原晴空",
      seed: 404,
      stars: false,
      motif: "pines",
      skyTop: "#9fe8ff",
      skyBottom: "#3056a8",
      haze: "#ffffff",
      sun: "#ffffff",
      ridgeFar: "#5378c8",
      ridgeNear: "#2a3f7b",
      ridge1Y: 330,
      ridge2Y: 420,
      ridge1Amp: 84,
      ridge2Amp: 110,
      soilTop: "#2b2a2c",
      soilBottom: "#0a0a0c",
      crystals: ["#8fe9ff", "#ffffff"],
    },
    {
      id: "bg05",
      name: "雨林薄雾",
      seed: 505,
      stars: false,
      motif: "pines",
      skyTop: "#6ce0c2",
      skyBottom: "#0b2b3a",
      haze: "#c8fff0",
      sun: "#c8fff0",
      ridgeFar: "#0f5a52",
      ridgeNear: "#0a2f36",
      ridge1Y: 360,
      ridge2Y: 430,
      ridge1Amp: 78,
      ridge2Amp: 96,
      soilTop: "#243124",
      soilBottom: "#0a120b",
      crystals: ["#8fe9ff", "#ffd34d"],
    },
    {
      id: "bg06",
      name: "火山熔洞",
      seed: 606,
      stars: false,
      motif: null,
      skyTop: "#4a0e12",
      skyBottom: "#12050a",
      haze: "#ff4d4d",
      sun: "#ff8a5c",
      ridgeFar: "#8a1f2a",
      ridgeNear: "#2b0a11",
      ridge1Y: 355,
      ridge2Y: 435,
      ridge1Amp: 70,
      ridge2Amp: 98,
      soilTop: "#241214",
      soilBottom: "#080306",
      crystals: ["#ff4d4d", "#ffd34d"],
    },
    {
      id: "bg07",
      name: "海底蓝洞",
      seed: 707,
      stars: false,
      motif: null,
      skyTop: "#0aa3c7",
      skyBottom: "#04214a",
      haze: "#8fe9ff",
      sun: "#8fe9ff",
      ridgeFar: "#0b5f8a",
      ridgeNear: "#042a4d",
      ridge1Y: 345,
      ridge2Y: 430,
      ridge1Amp: 70,
      ridge2Amp: 100,
      soilTop: "#1b2a36",
      soilBottom: "#070c12",
      crystals: ["#8fe9ff", "#b07bff"],
    },
    {
      id: "bg08",
      name: "水晶矿脉",
      seed: 808,
      stars: true,
      motif: null,
      skyTop: "#1c0f3a",
      skyBottom: "#060512",
      haze: "#b07bff",
      sun: "#b07bff",
      ridgeFar: "#3b2369",
      ridgeNear: "#140b2d",
      ridge1Y: 340,
      ridge2Y: 420,
      ridge1Amp: 76,
      ridge2Amp: 106,
      soilTop: "#241b33",
      soilBottom: "#08050c",
      crystals: ["#b07bff", "#8fe9ff", "#ffd34d"],
    },
    {
      id: "bg09",
      name: "废弃矿井",
      seed: 909,
      stars: false,
      motif: "gears",
      skyTop: "#2c3442",
      skyBottom: "#0b0f18",
      haze: "#ffffff",
      sun: "#ffe08a",
      ridgeFar: "#3f4c5f",
      ridgeNear: "#141a24",
      ridge1Y: 350,
      ridge2Y: 430,
      ridge1Amp: 62,
      ridge2Amp: 92,
      soilTop: "#2a2620",
      soilBottom: "#0a0706",
      crystals: ["#ffd34d", "#a7b0ba"],
    },
    {
      id: "bg10",
      name: "紫雾禁地",
      seed: 1010,
      stars: true,
      motif: null,
      skyTop: "#2b0a3e",
      skyBottom: "#070513",
      haze: "#ff7ad8",
      sun: "#ff7ad8",
      ridgeFar: "#5a1a7a",
      ridgeNear: "#16061f",
      ridge1Y: 352,
      ridge2Y: 430,
      ridge1Amp: 74,
      ridge2Amp: 106,
      soilTop: "#261025",
      soilBottom: "#07030a",
      crystals: ["#ff7ad8", "#b07bff", "#8fe9ff"],
    },
    {
      id: "bg11",
      name: "遗迹神庙",
      seed: 1111,
      stars: false,
      motif: null,
      skyTop: "#ffd34d",
      skyBottom: "#1e6b8f",
      haze: "#ffffff",
      sun: "#fff1c4",
      ridgeFar: "#1f6f6f",
      ridgeNear: "#0d3342",
      ridge1Y: 345,
      ridge2Y: 425,
      ridge1Amp: 68,
      ridge2Amp: 92,
      soilTop: "#2b2a24",
      soilBottom: "#090806",
      crystals: ["#8fe9ff", "#ffd34d"],
    },
    {
      id: "bg12",
      name: "极光之夜",
      seed: 1212,
      stars: true,
      motif: null,
      skyTop: "#082642",
      skyBottom: "#02050b",
      haze: "#8fe9ff",
      sun: "#8fe9ff",
      ridgeFar: "#114a6b",
      ridgeNear: "#061321",
      ridge1Y: 338,
      ridge2Y: 420,
      ridge1Amp: 70,
      ridge2Amp: 98,
      soilTop: "#1e2a33",
      soilBottom: "#06080c",
      crystals: ["#8fe9ff", "#6ce0c2", "#b07bff"],
    },
    {
      id: "bg13",
      name: "秋林金风",
      seed: 1313,
      stars: false,
      motif: "pines",
      skyTop: "#ffb36a",
      skyBottom: "#2a3558",
      haze: "#ffe08a",
      sun: "#ffe08a",
      ridgeFar: "#8a3f1a",
      ridgeNear: "#2a1b1a",
      ridge1Y: 360,
      ridge2Y: 435,
      ridge1Amp: 72,
      ridge2Amp: 96,
      soilTop: "#2e2316",
      soilBottom: "#0b0806",
      crystals: ["#ffd34d", "#b07bff"],
    },
    {
      id: "bg14",
      name: "冰晶洞窟",
      seed: 1414,
      stars: true,
      motif: null,
      skyTop: "#15305a",
      skyBottom: "#050913",
      haze: "#8fe9ff",
      sun: "#ffffff",
      ridgeFar: "#2d5b9a",
      ridgeNear: "#0b1731",
      ridge1Y: 330,
      ridge2Y: 418,
      ridge1Amp: 84,
      ridge2Amp: 116,
      soilTop: "#1b2230",
      soilBottom: "#06070a",
      crystals: ["#8fe9ff", "#ffffff", "#b07bff"],
    },
    {
      id: "bg15",
      name: "机械矿场",
      seed: 1515,
      stars: false,
      motif: "gears",
      skyTop: "#364b6a",
      skyBottom: "#0b1019",
      haze: "#8fe9ff",
      sun: "#ffd34d",
      ridgeFar: "#4a5f7a",
      ridgeNear: "#152033",
      ridge1Y: 350,
      ridge2Y: 430,
      ridge1Amp: 66,
      ridge2Amp: 90,
      soilTop: "#2a2622",
      soilBottom: "#090706",
      crystals: ["#ffd34d", "#a7b0ba", "#8fe9ff"],
    },
  ];

  return themes.map((t) => ({ ...t, svg: buildBackgroundSvg(t) }));
}

const BACKGROUNDS = createBackgroundLibrary();

const bgAssets = {
  ready: false,
  images: [],
};
let crayonArtRegistry = null;

function svgToDataUri(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function pickBackgroundIndex(levelSeed, previousIndex) {
  const rng = createRng((levelSeed ^ 0x51ed270b) >>> 0);
  let idx = Math.floor(rng.next() * BACKGROUNDS.length);
  if (BACKGROUNDS.length > 1 && typeof previousIndex === "number" && idx === previousIndex) {
    idx = (idx + 1 + Math.floor(rng.next() * (BACKGROUNDS.length - 1))) % BACKGROUNDS.length;
  }
  return idx;
}

function drawImageCover(img, x, y, w, h) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;

  const ir = iw / ih;
  const r = w / h;
  let sw;
  let sh;
  let sx;
  let sy;
  if (ir > r) {
    sh = ih;
    sw = ih * r;
    sx = (iw - sw) / 2;
    sy = 0;
  } else {
    sw = iw;
    sh = iw / r;
    sx = 0;
    sy = (ih - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function initBackgrounds() {
  bgAssets.ready = false;
  bgAssets.images = new Array(BACKGROUNDS.length);

  let loaded = 0;
  for (let i = 0; i < BACKGROUNDS.length; i += 1) {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      loaded += 1;
      if (loaded >= BACKGROUNDS.length) bgAssets.ready = true;
    };
    img.onerror = () => {
      loaded += 1;
      if (loaded >= BACKGROUNDS.length) bgAssets.ready = true;
    };
    img.src = svgToDataUri(BACKGROUNDS[i].svg);
    bgAssets.images[i] = img;
  }
}

function initCrayonArt() {
  if (!GoldMinerModules.createCrayonArtRegistry || typeof Image !== "function") {
    window.__goldMinerCrayonArtStatus = { total: 0, loaded: 0, failed: 0, skipped: true };
    return;
  }

  crayonArtRegistry = GoldMinerModules.createCrayonArtRegistry({ ImageCtor: Image });
  window.__goldMinerCrayonArtStatus = crayonArtRegistry.summary();
  crayonArtRegistry.preload().then(() => render())
    .catch((error) => {
      window.__goldMinerCrayonArtError = error instanceof Error ? error.message : String(error);
    })
    .finally(() => {
      window.__goldMinerCrayonArtStatus = crayonArtRegistry?.summary() ?? { total: 0, loaded: 0, failed: 0 };
    });
}

function crayonArtAssets() {
  return crayonArtRegistry;
}

const COLORS = {
  skyTop: "#0f1731",
  skyBottom: "#070a13",
  groundTop: "#1d1a13",
  groundBottom: "#0e0b08",
  wood: "#7a4b2a",
  rope: "rgba(255, 255, 255, 0.75)",
  hook: "#d7d7d7",
  gold: "#f6c54b",
  goldShadow: "#b07b12",
  rock: "#6f7682",
  rockShadow: "#3f4450",
  diamond: "#8fe9ff",
  diamondShadow: "#2f8aa1",
};

const BASE = {
  hookTipRadius: 7,
  pivotY: 106,
  minRope: 60,
  plankOffsetY: 2,
  plankHeight: 22,
};

const HOOK = {
  ringToTip: 44,
  jawBase: 16,
};

const SPEED_BOOST = 0.35;
const BOMB_RETRACT_MULT = 2.2;
const BOMB_BOOST_TIME = 0.55;
const CARRY_PULL_TIME_MULT = 1.3; // carrying any item: retract time +30% (slower pull)

const KEG_IMMEDIATE_BOOM_CHANCE = 0.4;
const GAMEPLAY_RANDOM_STREAM_SALTS = Object.freeze({
  kegImmediate: 0x6b6567,
});
const KEG_RELEASE_FRAC = 0.5; // halfway up
const KEG_GRAVITY = 1750;
const KEG_BLAST_RADIUS = 140;
const KEG_FALL_OUT_PAD = 50;

const MOUSE_MIN_LEVEL = 5; // only after level 4
const MOUSE_MAX_PER_LEVEL = 4;
const MOUSE_CARGO_CHANCE = 0.3;
const MOUSE_SPEED_MIN = 70;
const MOUSE_SPEED_MAX = 150;

// Dynamic difficulty adjustment (DDA)
// Stage-based baseline (every N levels) + adaptive tuning from player's over/under target.
const DDA_STAGE_SIZE = 3;
const DDA_BASE_PER_STAGE = 0.12;
const DDA_BASE_MAX = 0.84;
const DDA_OVER_FOR_MAX_SIGNAL = 0.35; // +35% over target => strong difficulty increase
const DDA_INERTIA = 0.72; // EMA inertia for difficulty rating
const POST_LEVEL4_START_LEVEL = 5;
const POST_LEVEL4_RAMP_LEVELS = 8;

const ITEM_COUNT_SCALE = 0.55;
const ITEM_VALUE_SCALE = 0.4;
const LEVEL_VALUE_RANDOM_START_LEVEL = 4;
const LEVEL_VALUE_RANDOM_MIN = 0.5;
const LEVEL_VALUE_RANDOM_MAX = 0.8;
const MARKET_COMMODITIES = [
  { key: "bar", label: "金条", min: 0.72, max: 1.34 },
  { key: "diamond", label: "钻石", min: 0.7, max: 1.42 },
  { key: "emerald", label: "祖母绿", min: 0.7, max: 1.38 },
  { key: "ruby", label: "红宝石", min: 0.7, max: 1.38 },
  { key: "crystal", label: "水晶簇", min: 0.74, max: 1.32 },
];
const MARKET_DAY_NAMES = ["矿脉狂热日", "交易震荡日", "宝石追涨日", "金属抢购日", "淘金观望日"];

function scaleItemValue(value, extraMultiplier = 1) {
  if (GoldMinerModules.scaleItemValue) return GoldMinerModules.scaleItemValue(value, extraMultiplier);
  return Math.max(0, Math.round(value * ITEM_VALUE_SCALE * extraMultiplier));
}

function formatMarketDelta(multiplier) {
  if (GoldMinerModules.formatMarketDelta) return GoldMinerModules.formatMarketDelta(multiplier);

  const pct = Math.round((multiplier - 1) * 100);
  if (pct > 0) return `↑${pct}%`;
  if (pct < 0) return `↓${Math.abs(pct)}%`;
  return "±0%";
}

function createMarketDay(rng) {
  if (GoldMinerModules.createMarketDay) return GoldMinerModules.createMarketDay(rng);

  const multipliers = {};
  const entries = [];
  for (const cfg of MARKET_COMMODITIES) {
    let value = rng.range(cfg.min, cfg.max);
    multipliers[cfg.key] = value;
    entries.push({ key: cfg.key, label: cfg.label, value });
  }

  // Ensure one obvious hot pick and one obvious cold pick, so strategy changes are noticeable.
  const hotIndex = Math.floor(rng.next() * entries.length);
  let coldIndex = Math.floor(rng.next() * entries.length);
  if (coldIndex === hotIndex) coldIndex = (coldIndex + 1) % entries.length;

  entries[hotIndex].value = clamp(entries[hotIndex].value * rng.range(1.08, 1.2), 0.72, 1.5);
  entries[coldIndex].value = clamp(entries[coldIndex].value * rng.range(0.76, 0.9), 0.58, 1.45);

  multipliers[entries[hotIndex].key] = entries[hotIndex].value;
  multipliers[entries[coldIndex].key] = entries[coldIndex].value;

  const summary = entries.map((entry) => `${entry.label}${formatMarketDelta(entry.value)}`).join("  ");
  return {
    name: MARKET_DAY_NAMES[Math.floor(rng.next() * MARKET_DAY_NAMES.length)],
    multipliers,
    summary,
  };
}

const SHOP_ITEMS = [
  {
    id: "bomb",
    name: "炸药",
    cost: 150,
    desc: "炸掉当前抓到的物品（不计分）",
    icon: "icon-bomb",
  },
  {
    id: "speed",
    name: "加速",
    cost: 220,
    desc: "下关拉回速度 +35%",
    icon: "icon-speed",
  },
  {
    id: "lucky",
    name: "幸运袋",
    cost: 260,
    desc: "下关额外生成 1 个幸运袋",
    icon: "icon-lucky",
  },
];

const LEVELS = [
  {
    target: 650,
    time: 60,
    seed: 1201,
    mix: {
      goldSmall: 6,
      goldMedium: 4,
      goldLarge: 2,
      rock: 4,
      diamond: 1,
      bag: 2,
      bar: 1,
      crystal: 1,
      pouch: 1,
      fossil: 1,
      emerald: 0,
      ruby: 0,
      keg: 0,
    },
  },
  {
    target: 1200,
    time: 58,
    seed: 2315,
    mix: {
      goldSmall: 7,
      goldMedium: 5,
      goldLarge: 2,
      rock: 5,
      diamond: 1,
      bag: 2,
      bar: 1,
      crystal: 1,
      pouch: 1,
      fossil: 1,
      emerald: 0,
      ruby: 0,
      keg: 1,
    },
  },
  {
    target: 1750,
    time: 56,
    seed: 3427,
    mix: {
      goldSmall: 8,
      goldMedium: 5,
      goldLarge: 3,
      rock: 5,
      diamond: 2,
      bag: 2,
      bar: 2,
      crystal: 1,
      pouch: 1,
      fossil: 1,
      emerald: 1,
      ruby: 0,
      keg: 1,
    },
  },
  {
    target: 2350,
    time: 54,
    seed: 4579,
    mix: {
      goldSmall: 8,
      goldMedium: 6,
      goldLarge: 3,
      rock: 6,
      diamond: 2,
      bag: 3,
      bar: 2,
      crystal: 2,
      pouch: 1,
      fossil: 1,
      emerald: 1,
      ruby: 1,
      keg: 1,
    },
  },
  {
    target: 3000,
    time: 52,
    seed: 5683,
    mix: {
      goldSmall: 9,
      goldMedium: 6,
      goldLarge: 4,
      rock: 6,
      diamond: 2,
      bag: 3,
      bar: 2,
      crystal: 2,
      pouch: 1,
      fossil: 2,
      emerald: 1,
      ruby: 1,
      keg: 1,
    },
  },
  {
    target: 3700,
    time: 50,
    seed: 6761,
    mix: {
      goldSmall: 10,
      goldMedium: 7,
      goldLarge: 4,
      rock: 7,
      diamond: 3,
      bag: 3,
      bar: 2,
      crystal: 2,
      pouch: 2,
      fossil: 2,
      emerald: 1,
      ruby: 1,
      keg: 1,
    },
  },
];

let game = null;

function initialGameStateOptions() {
  return {
    minRope: BASE.minRope,
    viewport: { w: 960, h: 540 },
  };
}

function initializeGameState() {
  const options = initialGameStateOptions();
  if (!stateKernelBridgeDisabled && GoldMinerModules.createInitialGameState) {
    try {
      game = GoldMinerModules.createInitialGameState(options);
      return game;
    } catch (error) {
      noteStateKernelBridgeError(error);
    }
  }

  if (stateKernelFallback?.createInitialGameState) {
    game = stateKernelFallback.createInitialGameState(options);
    return game;
  }

  throw new Error("Gold Miner initial state API is unavailable");
}

function isTwoPlayerMode() {
  return game.mode === "double";
}

function getHooks() {
  return isTwoPlayerMode() ? [game.hook, game.hook2] : [game.hook];
}

function getMiners() {
  return isTwoPlayerMode() ? [game.miner, game.miner2] : [game.miner];
}

function getHookByIndex(index) {
  return index === 1 ? game.hook2 : game.hook;
}

function getMinerByIndex(index) {
  return index === 1 ? game.miner2 : game.miner;
}

function layoutPlayers() {
  const w = game.viewport.w;
  const center = w / 2;
  const margin = clamp(w * 0.1, 70, 140);
  const spread = clamp(w * 0.18, 90, 210);

  if (!isTwoPlayerMode()) {
    game.hook.pivotX = center;
    return;
  }

  game.hook.pivotX = clamp(center - spread, margin, w - margin);
  game.hook2.pivotX = clamp(center + spread, margin, w - margin);
}

function getPivot(hook = game.hook) {
  const x = Number.isFinite(hook?.pivotX) ? hook.pivotX : game.viewport.w / 2;
  return { x, y: BASE.pivotY };
}

function getPlankY() {
  return BASE.pivotY + (BASE.plankOffsetY ?? 0);
}

function getReelCenter(hook = game.hook) {
  const pivot = getPivot(hook);
  const y = getPlankY() - 16;
  return { x: pivot.x, y };
}

function getGroundY() {
  return game.viewport.h * 0.72;
}

function getHookDirWithLocalState(angle) {
  return { x: Math.sin(angle), y: Math.cos(angle) };
}

function getHookDir(angle) {
  if (!hookSystemBridgeDisabled && GoldMinerModules.getHookDir) {
    try {
      return GoldMinerModules.getHookDir(angle);
    } catch (error) {
      noteHookSystemBridgeError(error);
    }
  }

  return getHookDirWithLocalState(angle);
}

function getHookEndWithLocalState(hook = game.hook, length = hook.length, pivot = getPivot(hook)) {
  const dir = getHookDirWithLocalState(hook.angle);
  return { x: pivot.x + dir.x * length, y: pivot.y + dir.y * length };
}

function getHookEnd(hook = game.hook, length = hook.length) {
  const pivot = getPivot(hook);
  if (!hookSystemBridgeDisabled && GoldMinerModules.getHookEndPoint) {
    try {
      return GoldMinerModules.getHookEndPoint({ pivot, angle: hook.angle, length });
    } catch (error) {
      noteHookSystemBridgeError(error);
    }
  }

  return getHookEndWithLocalState(hook, length, pivot);
}

function resetHook(hook = game.hook) {
  hook.state = "swing";
  hook.length = hook.minLength;
  hook.attachedId = null;
  hook.clawClose = 0;
  hook.lastLength = hook.length;
  hook.trail.length = 0;
}

function getSeedFromUrl() {
  const param = new URLSearchParams(window.location.search).get("seed");
  if (!param) return null;
  const seed = Number.parseInt(param, 10);
  return Number.isFinite(seed) ? seed : null;
}

function initRunSeed() {
  const seed = getSeedFromUrl();
  if (seed !== null) {
    game.runSeed = seed;
  } else {
    game.runSeed = Math.floor(Math.random() * 900000) + 100000;
  }
}

function getLevelConfig(level) {
  if (GoldMinerModules.getLevelConfig) return GoldMinerModules.getLevelConfig(level);

  const preset = LEVELS[level - 1];
  if (preset) return preset;

  const baseTarget = 650;
  const delta = 450;
  const time = clamp(62 - (level - 1) * 2, 42, 62);
  const mix = {
    goldSmall: 6 + level,
    goldMedium: 4 + Math.floor(level / 2),
    goldLarge: 2 + Math.floor(level / 3),
    rock: 4 + Math.floor(level / 2),
    diamond: 1 + Math.floor(level / 4),
    bag: 2 + Math.floor(level / 3),
    bar: 1 + Math.floor(level / 3),
    crystal: 1 + Math.floor(level / 4),
    pouch: level >= 2 ? 1 + Math.floor(level / 6) : 0,
    fossil: level >= 2 ? 1 + Math.floor(level / 5) : 0,
    emerald: level >= 3 ? 1 : 0,
    ruby: level >= 4 ? 1 : 0,
    keg: level >= 2 ? 1 : 0,
  };

  return { target: baseTarget + (level - 1) * delta, time, seed: 9000 + level * 997, mix };
}

function ddaStage(level) {
  if (GoldMinerModules.ddaStage) return GoldMinerModules.ddaStage(level);

  const lv = Math.max(1, Math.floor(Number(level) || 1));
  return Math.floor((lv - 1) / DDA_STAGE_SIZE);
}

function ddaBaseDifficulty(level) {
  if (GoldMinerModules.ddaBaseDifficulty) return GoldMinerModules.ddaBaseDifficulty(level);

  const lv = Math.max(1, Math.floor(Number(level) || 1));
  const stage = ddaStage(lv);
  const within = (lv - 1) - stage * DDA_STAGE_SIZE;
  const withinFrac = DDA_STAGE_SIZE <= 1 ? 0 : within / (DDA_STAGE_SIZE - 1);
  const base = stage * DDA_BASE_PER_STAGE + withinFrac * (DDA_BASE_PER_STAGE * 0.5);
  return clamp(base, 0, DDA_BASE_MAX);
}

function ddaOverSignal(overRatio) {
  if (GoldMinerModules.ddaOverSignal) return GoldMinerModules.ddaOverSignal(overRatio);

  const r = Number.isFinite(overRatio) ? overRatio : 0;
  return clamp(r / DDA_OVER_FOR_MAX_SIGNAL, -1, 1);
}

function postLevel4Pressure(level) {
  if (GoldMinerModules.postLevel4Pressure) return GoldMinerModules.postLevel4Pressure(level);

  const lv = Math.max(1, Math.floor(Number(level) || 1));
  if (lv < POST_LEVEL4_START_LEVEL) return 0;
  const stepsPast = lv - POST_LEVEL4_START_LEVEL;
  const ramp = clamp(stepsPast / POST_LEVEL4_RAMP_LEVELS, 0, 1);
  return clamp(0.22 + ramp * 0.78, 0, 1);
}

function computeDdaTuning(level) {
  if (GoldMinerModules.computeDdaTuning) {
    return GoldMinerModules.computeDdaTuning(level, game.dda?.rating ?? 0);
  }

  const base = ddaBaseDifficulty(level);
  const rating = clamp(game.dda?.rating ?? 0, -1, 1);
  const hard = clamp(rating, 0, 1);
  const ease = clamp(-rating, 0, 1);
  const post4Pressure = postLevel4Pressure(level);

  const difficulty = clamp(base + rating * 0.22 + post4Pressure * 0.12, 0, 1);
  const targetMul = clamp(1 + base * 0.18 + hard * 0.28 - ease * 0.08 + post4Pressure * 0.24, 0.9, 1.75);
  const timeMul = clamp(1 - base * 0.08 - hard * 0.14 + ease * 0.08 - post4Pressure * 0.18, 0.68, 1.18);

  const mixDiff = clamp(base * 0.85 + hard * 0.95 - ease * 0.25 + post4Pressure * 0.55, 0, 1);
  const mixMul = (key) => {
    switch (key) {
      case "rock":
        return lerp(1, 1.35, mixDiff);
      case "keg":
        return lerp(1, 1.5, mixDiff);
      case "fossil":
        return lerp(1, 1.22, mixDiff);
      case "diamond":
        return lerp(1, 0.82, mixDiff);
      case "emerald":
      case "ruby":
        return lerp(1, 0.84, mixDiff);
      case "crystal":
        return lerp(1, 0.87, mixDiff);
      case "bar":
        return lerp(1, 0.86, mixDiff);
      case "bag":
      case "pouch":
        return lerp(1, 0.88, mixDiff);
      case "goldLarge":
        return lerp(1, 0.92, mixDiff);
      case "goldMedium":
        return lerp(1, 1.06, mixDiff);
      case "goldSmall":
        return lerp(1, 1.14, mixDiff);
      default:
        return 1;
    }
  };

  const mouseSpeedMul = lerp(1, 1.35, difficulty) * lerp(1, 1.18, post4Pressure);
  const mouseMax = clamp(1 + Math.round(difficulty * (MOUSE_MAX_PER_LEVEL - 1)), 1, MOUSE_MAX_PER_LEVEL);

  return {
    stage: ddaStage(level),
    base,
    rating,
    post4Pressure,
    difficulty,
    targetMul,
    timeMul,
    mixMul,
    mouseSpeedMul,
    mouseMax,
  };
}

function bagValueRange(level) {
  const min = 120 + level * 20;
  const max = 800 + level * 60;
  return { min, max };
}

function intRange(rng, min, maxInclusive) {
  return Math.floor(rng.range(min, maxInclusive + 1));
}

function makeBlob(rng, pointsCount, minRadius, maxRadius) {
  const points = [];
  const step = (Math.PI * 2) / pointsCount;
  const offset = rng.range(0, Math.PI * 2);
  for (let i = 0; i < pointsCount; i += 1) {
    points.push({ a: offset + i * step, r: rng.range(minRadius, maxRadius) });
  }
  return points;
}

function createItemArt(item, rng) {
  const rot = rng.range(0, Math.PI * 2);
  if (item.type === "gold") {
    const sparkles = [];
    const sparkleCount = intRange(rng, 1, 3);
    for (let i = 0; i < sparkleCount; i += 1) {
      sparkles.push({
        a: rng.range(0, Math.PI * 2),
        d: rng.range(0.12, 0.58),
        s: rng.range(0.1, 0.22),
        p: rng.range(0, Math.PI * 2),
      });
    }
    return {
      rot,
      blob: makeBlob(rng, intRange(rng, 8, 12), 0.72, 1.06),
      glint: rng.range(0.15, 0.85),
      sparkles,
    };
  }

  if (item.type === "rock") {
    const specks = [];
    const speckCount = intRange(rng, 4, 10);
    for (let i = 0; i < speckCount; i += 1) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(0.1, 0.65);
      specks.push({
        x: Math.cos(a) * d,
        y: Math.sin(a) * d,
        r: rng.range(0.06, 0.18),
        a: rng.range(0.06, 0.22),
      });
    }
    return {
      rot,
      blob: makeBlob(rng, intRange(rng, 7, 10), 0.78, 1.14),
      specks,
      tint: rng.range(-0.08, 0.08),
    };
  }

  if (item.type === "diamond") {
    return {
      rot,
      twinkle: rng.range(0, Math.PI * 2),
    };
  }

  if (item.type === "bag") {
    return {
      rot,
      stripe: rng.range(0.2, 0.85),
      stitch: rng.range(0.15, 0.85),
    };
  }

  if (item.type === "bar") {
    return {
      rot,
      shine: rng.range(0, Math.PI * 2),
      stamp: rng.range(0.1, 0.9),
    };
  }

  if (item.type === "emerald" || item.type === "ruby") {
    return {
      rot,
      twinkle: rng.range(0, Math.PI * 2),
      facet: rng.range(0.2, 0.9),
    };
  }

  if (item.type === "crystal") {
    const spikes = intRange(rng, 4, 7);
    const dirs = [];
    for (let i = 0; i < spikes; i += 1) {
      dirs.push({
        a: rng.range(-0.9, 0.9),
        h: rng.range(0.65, 1.25),
        w: rng.range(0.18, 0.32),
      });
    }
    return {
      rot,
      twinkle: rng.range(0, Math.PI * 2),
      dirs,
    };
  }

  if (item.type === "pouch") {
    return {
      rot,
      jiggle: rng.range(0, Math.PI * 2),
      seam: rng.range(0.15, 0.85),
      coins: intRange(rng, 2, 4),
    };
  }

  if (item.type === "keg") {
    return {
      rot,
      fuse: rng.range(0, Math.PI * 2),
      stripe: rng.range(0.2, 0.85),
    };
  }

  if (item.type === "fossil") {
    const cracks = [];
    const n = intRange(rng, 2, 4);
    for (let i = 0; i < n; i += 1) {
      cracks.push({
        a: rng.range(0, Math.PI * 2),
        d: rng.range(0.15, 0.55),
        l: rng.range(0.35, 0.7),
        w: rng.range(0.04, 0.08),
      });
    }
    return {
      rot,
      cracks,
      tint: rng.range(-0.06, 0.08),
    };
  }

  return { rot };
}

function makeItem({ id, type, x, y, r, value, weight, mouse = null }) {
  return {
    id,
    type, // gold | rock | diamond | bag | bar | emerald | ruby | crystal | pouch | keg | fossil | mouse
    x,
    y,
    r,
    value,
    weight,
    grabbed: false,
    bagValue: type === "bag" ? value : null,
    keg: null,
    mouse,
    art: null,
  };
}

function itemStyle(item) {
  switch (item.type) {
    case "diamond":
      return { fill: COLORS.diamond, shadow: COLORS.diamondShadow };
    case "rock":
      return { fill: COLORS.rock, shadow: COLORS.rockShadow };
    case "bag":
      return { fill: "#b07bff", shadow: "#50278a" };
    case "gold":
    default:
      return { fill: COLORS.gold, shadow: COLORS.goldShadow };
  }
}

function buildScene(seed) {
  if (!sceneSystemBridgeDisabled && GoldMinerModules.createSceneData) {
    try {
      const scene = GoldMinerModules.createSceneData({
        seed,
        viewport: game.viewport,
        background: BACKGROUNDS[game.bgIndex] ?? null,
      });
      game.scene.stars = scene.stars;
      game.scene.dust = scene.dust;
      game.scene.dirt = scene.dirt;
      return;
    } catch (error) {
      sceneSystemBridgeDisabled = true;
      if (!Object.prototype.hasOwnProperty.call(window, "__goldMinerSceneSystemError")) {
        window.__goldMinerSceneSystemError = error instanceof Error ? error.message : String(error);
      }
      console.warn("Gold Miner scene system failed; using local scene fallback.", error);
    }
  }

  const rng = createRng((seed ^ 0x9e3779b9) >>> 0);
  const w = game.viewport.w;
  const h = game.viewport.h;
  const groundY = h * 0.72;

  const stars = [];
  const starCount = clamp(Math.floor((w * groundY) / 19000), 36, 76);
  for (let i = 0; i < starCount; i += 1) {
    stars.push({
      x: rng.range(0, w),
      y: rng.range(0, groundY * 0.58),
      r: rng.range(0.6, 1.8),
      a: rng.range(0.08, 0.28),
      tw: rng.range(0, Math.PI * 2),
    });
  }

  const dust = [];
  const dustCount = clamp(Math.floor((w * (h - groundY)) / 9000), 55, 130);
  for (let i = 0; i < dustCount; i += 1) {
    dust.push({
      x: rng.range(0, w),
      y: rng.range(groundY + 10, h),
      r: rng.range(0.8, 2.2),
      a: rng.range(0.03, 0.12),
      tw: rng.range(0, Math.PI * 2),
    });
  }

  const dirt = [];
  const dirtCount = clamp(Math.floor((w * (h - groundY)) / 5200), 90, 190);
  for (let i = 0; i < dirtCount; i += 1) {
    dirt.push({
      x: rng.range(0, w),
      y: rng.range(groundY + 12, h),
      r: rng.range(0.6, 3.4),
      a: rng.range(0.05, 0.18),
      hue: rng.range(-0.08, 0.08),
    });
  }

  game.scene.stars = stars;
  game.scene.dust = dust;
  game.scene.dirt = dirt;
}

function applyGeneratedLevelData(levelData) {
  game.dda.stage = levelData.dda.stage;
  game.dda.base = levelData.dda.base;
  game.dda.post4Pressure = levelData.dda.post4Pressure;
  game.dda.difficulty = levelData.dda.difficulty;
  game.dda.targetMul = levelData.dda.targetMul;
  game.dda.timeMul = levelData.dda.timeMul;

  game.target = levelData.target;
  game.timeLeft = levelData.timeLeft;
  game.dda.levelTimeTotal = levelData.levelTimeTotal;
  game.currentSeed = levelData.seed;
  game.market = levelData.market;
  game.items = levelData.items;
}

function generateLevel(level, options = {}) {
  if (GoldMinerModules.generateLevelData) {
    try {
      const levelData = GoldMinerModules.generateLevelData({
        level,
        runSeed: game.runSeed,
        viewport: game.viewport,
        mode: game.mode,
        ddaRating: game.dda?.rating ?? 0,
        extraBags: options.extraBags ?? 0,
      });
      applyGeneratedLevelData(levelData);
      resetGameplayRandomStreams();
      window.GameAudio?.setTrackFromSeed?.(levelData.seed);
      syncAudioButtons();
      game.bgIndex = pickBackgroundIndex(levelData.seed, game.bgIndex);
      buildScene(levelData.seed);
      recalcHookMaxLength();
      for (const hook of getHooks()) resetHook(hook);
      return;
    } catch (error) {
      window.__goldMinerLevelGeneratorError = error instanceof Error ? error.message : String(error);
      console.warn("Gold Miner module level generator failed; using legacy level generation.", error);
    }
  }

  const config = getLevelConfig(level);
  const dda = computeDdaTuning(level);
  const playerMul = isTwoPlayerMode() ? 1.3 : 1;
  game.dda.stage = dda.stage;
  game.dda.base = dda.base;
  game.dda.post4Pressure = dda.post4Pressure;
  game.dda.difficulty = dda.difficulty;
  game.dda.targetMul = dda.targetMul;
  game.dda.timeMul = dda.timeMul;

  game.target = Math.ceil(config.target * playerMul * dda.targetMul);
  const minLevelTime = 45;
  game.timeLeft = clamp(Math.round(config.time * dda.timeMul), minLevelTime, 90);
  game.dda.levelTimeTotal = game.timeLeft;

  const seed = (config.seed ?? 0) + game.runSeed;
  game.currentSeed = seed;
  resetGameplayRandomStreams();
  window.GameAudio?.setTrackFromSeed?.(seed);
  syncAudioButtons();
  game.bgIndex = pickBackgroundIndex(seed, game.bgIndex);
  const rng = createRng(seed);
  const marketRng = createRng((seed ^ 0x51d7348d) >>> 0);
  game.market = createMarketDay(marketRng);
  const levelValueMultiplier =
    level >= LEVEL_VALUE_RANDOM_START_LEVEL ? rng.range(LEVEL_VALUE_RANDOM_MIN, LEVEL_VALUE_RANDOM_MAX) : 1;

  const w = game.viewport.w;
  const h = game.viewport.h;

  const minY = 170;
  const margin = 34;

  const items = [];
  let nextId = 1;
  const mixMul = typeof dda.mixMul === "function" ? dda.mixMul : () => 1;
  const mouseSpeedMul = Number.isFinite(dda.mouseSpeedMul) ? dda.mouseSpeedMul : 1;
  const mouseMax = Number.isFinite(dda.mouseMax) ? dda.mouseMax : MOUSE_MAX_PER_LEVEL;
  const marketMultipliers = game.market?.multipliers ?? {};
  const levelItemValue = (min, max, marketKey = null) => {
    const marketMultiplier =
      marketKey && Number.isFinite(marketMultipliers[marketKey]) ? marketMultipliers[marketKey] : 1;
    return scaleItemValue(Math.round(rng.range(min, max)), levelValueMultiplier * marketMultiplier);
  };

  function tryPlace(item) {
    for (const other of items) {
      const minDist = item.r + other.r + 10;
      if (dist2(item.x, item.y, other.x, other.y) <= minDist * minDist) return false;
    }
    return true;
  }

  function buildSpec(type, size) {
    if (type === "bar") {
      return {
        type,
        r: rng.range(16, 22),
        value: levelItemValue(220, 420, "bar"),
        weight: 1.6,
      };
    }

    if (type === "mouse") {
      const r = rng.range(14, 18);
      const hasCargo = rng.next() < MOUSE_CARGO_CHANCE;
      const cargo = hasCargo ? (rng.next() < 0.5 ? "diamond" : "bar") : null;

      const baseValue = levelItemValue(140, 280);
      const cargoValue =
        cargo === "diamond"
          ? levelItemValue(420, 620, "diamond")
          : cargo === "bar"
            ? levelItemValue(220, 420, "bar")
            : 0;

      const value = cargo ? cargoValue : baseValue;
      const vx = rng.range(MOUSE_SPEED_MIN, MOUSE_SPEED_MAX) * (rng.next() < 0.5 ? -1 : 1) * mouseSpeedMul;
      const weight = 1.35 + (cargo === "diamond" ? 0.45 : cargo === "bar" ? 0.9 : 0);

      return {
        type,
        r,
        value,
        weight,
        mouse: {
          vx,
          cargo,
          phase: rng.range(0, Math.PI * 2),
        },
      };
    }

    if (type === "emerald") {
      return {
        type,
        r: rng.range(10, 14),
        value: levelItemValue(480, 800, "emerald"),
        weight: 1.05,
      };
    }

    if (type === "ruby") {
      return {
        type,
        r: rng.range(10, 14),
        value: levelItemValue(520, 900, "ruby"),
        weight: 1.1,
      };
    }

    if (type === "crystal") {
      return {
        type,
        r: rng.range(16, 24),
        value: levelItemValue(180, 360, "crystal"),
        weight: 1.35,
      };
    }

    if (type === "pouch") {
      return {
        type,
        r: rng.range(13, 18),
        value: levelItemValue(150, 1000),
        weight: 2.0,
      };
    }

    if (type === "keg") {
      return {
        type,
        r: rng.range(18, 24),
        value: 0,
        weight: 4.8,
      };
    }

    if (type === "fossil") {
      return {
        type,
        r: rng.range(20, 28),
        value: levelItemValue(300, 650),
        weight: 3.4,
      };
    }

    if (type === "gold") {
      if (size === "small") {
        return {
          type,
          r: rng.range(12, 18),
          value: levelItemValue(60, 120),
          weight: 1.0,
        };
      }
      if (size === "medium") {
        return {
          type,
          r: rng.range(20, 26),
          value: levelItemValue(160, 260),
          weight: 2.0,
        };
      }
      return {
        type,
        r: rng.range(30, 40),
        value: levelItemValue(320, 520),
        weight: 4.2,
      };
    }
    if (type === "rock") {
      return {
        type,
        r: rng.range(18, 32),
        value: levelItemValue(10, 60),
        weight: 5.8,
      };
    }
    if (type === "diamond") {
      return {
        type,
        r: rng.range(10, 14),
        value: levelItemValue(420, 620, "diamond"),
        weight: 1.25,
      };
    }
    const bagRange = bagValueRange(level);
    return {
      type: "bag",
      r: rng.range(12, 18),
      value: levelItemValue(bagRange.min, bagRange.max),
      weight: 1.8,
    };
  }

  const extraBags = options.extraBags ?? 0;
  const scaledCount = (count, key) => Math.max(0, Math.round((count ?? 0) * ITEM_COUNT_SCALE * mixMul(key)));
  const spawnQueue = [];
  for (let i = 0; i < scaledCount(config.mix.goldSmall, "goldSmall"); i += 1) spawnQueue.push(buildSpec("gold", "small"));
  for (let i = 0; i < scaledCount(config.mix.goldMedium, "goldMedium"); i += 1) spawnQueue.push(buildSpec("gold", "medium"));
  for (let i = 0; i < scaledCount(config.mix.goldLarge, "goldLarge"); i += 1) spawnQueue.push(buildSpec("gold", "large"));
  for (let i = 0; i < scaledCount(config.mix.rock, "rock"); i += 1) spawnQueue.push(buildSpec("rock"));
  for (let i = 0; i < scaledCount(config.mix.diamond, "diamond"); i += 1) spawnQueue.push(buildSpec("diamond"));
  for (let i = 0; i < scaledCount(config.mix.bag, "bag") + extraBags; i += 1) spawnQueue.push(buildSpec("bag"));
  for (let i = 0; i < scaledCount(config.mix.bar, "bar"); i += 1) spawnQueue.push(buildSpec("bar"));
  for (let i = 0; i < scaledCount(config.mix.emerald, "emerald"); i += 1) spawnQueue.push(buildSpec("emerald"));
  for (let i = 0; i < scaledCount(config.mix.ruby, "ruby"); i += 1) spawnQueue.push(buildSpec("ruby"));
  for (let i = 0; i < scaledCount(config.mix.crystal, "crystal"); i += 1) spawnQueue.push(buildSpec("crystal"));
  for (let i = 0; i < scaledCount(config.mix.pouch, "pouch"); i += 1) spawnQueue.push(buildSpec("pouch"));
  for (let i = 0; i < scaledCount(config.mix.keg, "keg"); i += 1) spawnQueue.push(buildSpec("keg"));
  for (let i = 0; i < scaledCount(config.mix.fossil, "fossil"); i += 1) spawnQueue.push(buildSpec("fossil"));

  if (level >= MOUSE_MIN_LEVEL) {
    const mouseCount = intRange(rng, 1, mouseMax);
    for (let i = 0; i < mouseCount; i += 1) spawnQueue.push(buildSpec("mouse"));
  }

  for (let i = spawnQueue.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1));
    [spawnQueue[i], spawnQueue[j]] = [spawnQueue[j], spawnQueue[i]];
  }

  for (const spec of spawnQueue) {
    let placed = false;
    for (let attempt = 0; attempt < 42; attempt += 1) {
      const x = rng.range(margin + spec.r, w - margin - spec.r);
      const y = rng.range(minY + spec.r, h - margin - spec.r);
      const item = makeItem({ id: nextId++, ...spec, x, y });
      item.art = createItemArt(item, rng);
      if (tryPlace(item)) {
        items.push(item);
        placed = true;
        break;
      }
    }
    if (!placed) {
      nextId -= 1;
    }
  }

  game.items = items;
  buildScene(seed);
  recalcHookMaxLength();
  for (const hook of getHooks()) resetHook(hook);
}

const bumpTimers = new WeakMap();
function bump(el) {
  if (!el) return;
  const prev = bumpTimers.get(el);
  if (prev) clearTimeout(prev);
  el.classList.remove("bump");
  // Force reflow so the animation can restart.
  void el.offsetWidth;
  el.classList.add("bump");
  bumpTimers.set(
    el,
    setTimeout(() => {
      el.classList.remove("bump");
      bumpTimers.delete(el);
    }, 260)
  );
}

const hudPrev = {
  bombs: 0,
  speed: 0,
  lucky: 0,
  score: 0,
};

function updateHudWithLocalDom(canBomb) {
  const score = Math.floor(game.score);
  const bombs = game.inventory.bombs;
  const speed = game.inventory.speed;
  const lucky = game.inventory.lucky;

  ui.level.textContent = String(game.level);
  ui.score.textContent = String(score);
  ui.target.textContent = String(Math.floor(game.target));
  ui.time.textContent = String(Math.ceil(game.timeLeft));
  ui.bombs.textContent = String(bombs);
  ui.speedTokens.textContent = String(speed);
  ui.luckyTokens.textContent = String(lucky);

  if (bombs !== hudPrev.bombs) bump(uiRefs.bombChip);
  if (speed !== hudPrev.speed) bump(uiRefs.speedChip);
  if (lucky !== hudPrev.lucky) bump(uiRefs.luckyChip);
  if (score !== hudPrev.score && score > hudPrev.score) bump(uiRefs.scoreStat);

  hudPrev.bombs = bombs;
  hudPrev.speed = speed;
  hudPrev.lucky = lucky;
  hudPrev.score = score;

  uiRefs.timeStat?.classList.toggle(
    "danger",
    game.phase === "playing" && !game.paused && game.timeLeft <= 10
  );

  const inGame = game.phase !== "menu";
  ui.pauseBtn.disabled = !inGame || game.phase !== "playing";
  ui.restartBtn.disabled = !inGame;
  ui.startBtn.disabled = game.phase !== "menu";

  ui.bombBtn.disabled = !canBomb;

  ui.pauseBtn.textContent = game.paused ? "继续" : "暂停";
  if (ui.marketTicker) {
    if (game.phase === "menu") {
      ui.marketTicker.textContent = "当日行情：进入关卡后开盘";
    } else {
      const name = game.market?.name ?? "交易日";
      const summary = game.market?.summary ?? "金条±0%  钻石±0%  祖母绿±0%  红宝石±0%  水晶簇±0%";
      ui.marketTicker.textContent = `当日行情[${name}] ${summary}`;
    }
  }
}

function updateHud() {
  const canBomb =
    game.phase === "playing" &&
    !game.paused &&
    game.inventory.bombs > 0 &&
    getHooks().some((hook) => hook.state === "retract" && attachedItem(hook));

  if (
    !uiAdapterBridgeDisabled &&
    GoldMinerModules.createHudSnapshot &&
    GoldMinerModules.applyHudSnapshot
  ) {
    try {
      const snapshot = GoldMinerModules.createHudSnapshot({ game, canBomb });
      GoldMinerModules.applyHudSnapshot({
        ui,
        uiRefs,
        snapshot,
        previous: hudPrev,
        bump,
      });
      return;
    } catch (error) {
      noteUiAdapterBridgeError(error);
    }
  }

  updateHudWithLocalDom(canBomb);
}

let overlayPrimaryAction = null;
let overlaySecondaryAction = null;

function showOverlay({ title, text, primary, secondary, showShop = false }) {
  ui.overlayTitle.textContent = title;
  ui.overlayText.textContent = text;

  if (primary) {
    ui.overlayPrimaryBtn.textContent = primary.label;
    ui.overlayPrimaryBtn.style.display = "";
    overlayPrimaryAction = primary.onClick;
  } else {
    ui.overlayPrimaryBtn.style.display = "none";
    overlayPrimaryAction = null;
  }

  if (secondary) {
    ui.overlaySecondaryBtn.textContent = secondary.label;
    ui.overlaySecondaryBtn.style.display = "";
    overlaySecondaryAction = secondary.onClick;
  } else {
    ui.overlaySecondaryBtn.style.display = "none";
    overlaySecondaryAction = null;
  }

  if (showShop) {
    ui.shopPanel.classList.remove("hidden");
  } else {
    ui.shopPanel.classList.add("hidden");
  }

  ui.overlay.classList.remove("hidden");
}

function hideOverlay() {
  ui.overlay.classList.add("hidden");
  ui.shopPanel.classList.add("hidden");
  overlayPrimaryAction = null;
  overlaySecondaryAction = null;
}

function setGameMode(mode) {
  game.mode = mode === "double" ? "double" : "single";
  game.lastHookIndex = 0;
  layoutPlayers();
  recalcHookMaxLength();
  render();
}

function showModeSelectOverlay() {
  const types = commandTypes();

  showOverlay({
    title: "选择模式",
    text: `单人：保持原玩法。\n双人：两位矿工同时出钩（目标分数 +30%）。\n\n单人放钩：空格 / 点击\n双人放钩：玩家1 空格/点击；玩家2 回车(Enter)\n\n本局种子：${game.runSeed}（可用 ?seed=12345 固定）`,
    primary: {
      label: "单人模式",
      onClick: () => dispatchCommand(createRuntimeCommand(types.START_GAME, { mode: "single" })),
    },
    secondary: {
      label: "双人模式",
      onClick: () => dispatchCommand(createRuntimeCommand(types.START_GAME, { mode: "double" })),
    },
  });
}

function resetInventory() {
  game.inventory.bombs = 0;
  game.inventory.speed = 0;
  game.inventory.lucky = 0;
}

function resetDda() {
  game.dda.rating = 0;
  game.dda.stage = 0;
  game.dda.base = 0;
  game.dda.post4Pressure = 0;
  game.dda.difficulty = 0;
  game.dda.targetMul = 1;
  game.dda.timeMul = 1;
  game.dda.levelStartScore = 0;
  game.dda.levelTimeTotal = 0;
  game.dda.firstClearTimeLeft = null;
  game.dda.lastOverRatio = 0;
  game.dda.lastSignal = 0;
}

function updateDdaAfterLevel() {
  if (GoldMinerModules.updateDdaRating) {
    const next = GoldMinerModules.updateDdaRating({
      currentRating: game.dda.rating,
      score: game.score,
      target: game.target,
      levelTimeTotal: game.dda.levelTimeTotal,
      firstClearTimeLeft: game.dda.firstClearTimeLeft,
    });
    game.dda.rating = next.rating;
    game.dda.lastOverRatio = next.lastOverRatio;
    game.dda.lastSignal = next.lastSignal;
    return;
  }

  const target = Math.max(1, Math.floor(game.target) || 1);
  const overRatio = (game.score - target) / target;
  const overSignal = ddaOverSignal(overRatio);
  let signal = overSignal;

  const tTotal = Math.max(1, Math.round(game.dda.levelTimeTotal) || 1);
  const clearLeft = game.dda.firstClearTimeLeft;
  if (Number.isFinite(clearLeft)) {
    const clearFrac = clamp(clearLeft / tTotal, 0, 1);
    const clearSignal = clamp((clearFrac - 0.35) / 0.45, -1, 1);
    signal = clamp(overSignal * 0.7 + clearSignal * 0.3, -1, 1);
  }
  game.dda.rating = clamp(game.dda.rating * DDA_INERTIA + signal * (1 - DDA_INERTIA), -1, 1);
  game.dda.lastOverRatio = overRatio;
  game.dda.lastSignal = signal;
}

function consumeSpeedBoost() {
  if (game.inventory.speed <= 0) return 0;
  game.inventory.speed -= 1;
  return SPEED_BOOST;
}

function consumeLuckyBag() {
  if (game.inventory.lucky <= 0) return 0;
  game.inventory.lucky -= 1;
  return 1;
}

function prepareLevelStart() {
  game.effects.speedMultiplier = 1 + consumeSpeedBoost();
  game.effects.bombBoost = 0;
  game.audio.lastCountdownSec = null;
  game.dda.levelStartScore = game.score;
  game.dda.firstClearTimeLeft = null;
  const extraBags = consumeLuckyBag();
  generateLevel(game.level, { extraBags });
}

function startGame() {
  game.score = 0;
  game.level = 1;
  game.phase = "playing";
  game.paused = false;
  resetInventory();
  resetDda();
  prepareLevelStart();
  emitOverlayHideEvent();
  emitHudUpdateEvent();
  emitAudioEvent("level_start");
  processGameEvents();
}

function restartGame() {
  startGame();
}

function resumeGame() {
  if (game.phase !== "playing") return;
  game.paused = false;
  emitOverlayHideEvent();
  emitHudUpdateEvent();
  processGameEvents();
}

function startNextLevel() {
  if (game.phase !== "shop") return;

  game.level += 1;
  game.phase = "playing";
  game.paused = false;
  prepareLevelStart();
  emitOverlayHideEvent();
  emitHudUpdateEvent();
  emitAudioEvent("level_start");
  processGameEvents();
}

function buyShopCommandItem(itemId) {
  const item = SHOP_ITEMS.find((candidate) => candidate.id === itemId);
  if (!item) return;

  const result = GoldMinerModules.buyShopItem
    ? GoldMinerModules.buyShopItem({ score: game.score, inventory: game.inventory, item })
    : null;

  if (result) {
    if (!result.bought) return;
    game.score = result.score;
    game.inventory = result.inventory;
    emitAudioEvent("buy");
    emitShopRenderEvent();
    emitHudUpdateEvent();
    processGameEvents();
    return;
  }

  if (game.score < item.cost) return;
  game.score -= item.cost;
  if (item.id === "bomb") game.inventory.bombs += 1;
  if (item.id === "speed") game.inventory.speed += 1;
  if (item.id === "lucky") game.inventory.lucky += 1;
  emitAudioEvent("buy");
  emitShopRenderEvent();
  emitHudUpdateEvent();
  processGameEvents();
}

function runtimeCommandHandlers() {
  return {
    showModeSelect: showModeSelectOverlay,
    startGame: (mode) => {
      setGameMode(mode);
      startGame();
    },
    restartGame,
    togglePause,
    resumeGame,
    fireHook: (player) => dropHookFor(player),
    useBomb,
    buyShopItem: buyShopCommandItem,
    startNextLevel,
    toggleMusic: () => {
      emitAudioEvent("ui_click");
      window.GameAudio?.toggleMusic?.();
      emitAudioSyncEvent();
      processGameEvents();
    },
    nextTrack: () => {
      emitAudioEvent("ui_click");
      window.GameAudio?.nextTrack?.();
      emitAudioSyncEvent();
      processGameEvents();
    },
    toggleSfx: () => {
      const wasOn = window.GameAudio?.isSfxEnabled?.() ?? true;
      if (wasOn) {
        emitAudioEvent("ui_click");
        processGameEvents();
      }
      window.GameAudio?.toggleSfx?.();
      emitAudioSyncEvent();
      const nowOn = window.GameAudio?.isSfxEnabled?.() ?? true;
      if (nowOn) emitAudioEvent("ui_click");
      processGameEvents();
    },
  };
}

function dispatchCommand(rawCommand) {
  if (GoldMinerModules.dispatchGameCommand) {
    GoldMinerModules.dispatchGameCommand({
      rawCommand,
      state: game,
      handlers: runtimeCommandHandlers(),
      commandTypes: commandTypes(),
      assertCommand: GoldMinerModules.assertCommand,
      warn: (...args) => console.warn(...args),
    });
    return;
  }

  let command;

  try {
    command = GoldMinerModules.assertCommand
      ? GoldMinerModules.assertCommand(rawCommand)
      : rawCommand;
  } catch (error) {
    console.warn("Ignoring invalid Gold Miner command.", error);
    return;
  }

  if (command === null || typeof command !== "object") {
    console.warn("Ignoring invalid Gold Miner command.", new TypeError("Expected a valid game command object"));
    return;
  }

  const payload = command.payload ?? {};
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    console.warn("Ignoring invalid Gold Miner command.", new TypeError("command payload must be an object"));
    return;
  }

  const types = commandTypes();
  if (!Object.values(types).includes(command.type)) {
    console.warn(
      "Ignoring invalid Gold Miner command.",
      new RangeError(`Unsupported command type: ${String(command.type)}`),
    );
    return;
  }

  switch (command.type) {
    case types.SHOW_MODE_SELECT:
      if (game.phase === "menu") showModeSelectOverlay();
      break;
    case types.START_GAME:
      if (game.phase === "menu") {
        setGameMode(payload.mode);
        startGame();
      }
      break;
    case types.RESTART_GAME:
      if (game.phase !== "menu") restartGame();
      break;
    case types.TOGGLE_PAUSE:
      togglePause();
      break;
    case types.RESUME_GAME:
      resumeGame();
      break;
    case types.FIRE_HOOK:
      dropHookFor(payload.player ?? 0);
      break;
    case types.USE_BOMB:
      useBomb();
      break;
    case types.BUY_SHOP_ITEM:
      buyShopCommandItem(payload.itemId);
      break;
    case types.START_NEXT_LEVEL:
      startNextLevel();
      break;
    case types.TOGGLE_MUSIC:
      emitAudioEvent("ui_click");
      window.GameAudio?.toggleMusic?.();
      emitAudioSyncEvent();
      processGameEvents();
      break;
    case types.NEXT_TRACK:
      emitAudioEvent("ui_click");
      window.GameAudio?.nextTrack?.();
      emitAudioSyncEvent();
      processGameEvents();
      break;
    case types.TOGGLE_SFX: {
      const wasOn = window.GameAudio?.isSfxEnabled?.() ?? true;
      if (wasOn) {
        emitAudioEvent("ui_click");
        processGameEvents();
      }
      window.GameAudio?.toggleSfx?.();
      emitAudioSyncEvent();
      const nowOn = window.GameAudio?.isSfxEnabled?.() ?? true;
      if (nowOn) emitAudioEvent("ui_click");
      processGameEvents();
      break;
    }
    default:
      break;
  }
}

function togglePause() {
  if (game.phase !== "playing") return;
  game.paused = !game.paused;
  emitAudioEvent(game.paused ? "pause" : "resume");

  if (game.paused) {
    emitOverlayShowEvent({
      title: "已暂停",
      text: "按 P 或点击「继续」返回游戏。",
      primary: {
        label: "继续",
        onClick: () => dispatchCommand(createRuntimeCommand(commandTypes().RESUME_GAME)),
      },
      secondary: {
        label: "重开",
        onClick: () => dispatchCommand(createRuntimeCommand(commandTypes().RESTART_GAME)),
      },
    });
  } else {
    emitOverlayHideEvent();
  }

  emitHudUpdateEvent();
  processGameEvents();
}

function shopSummaryText() {
  return `本关得分 ${Math.floor(game.score)} / 目标 ${Math.floor(
    game.target
  )}。购买道具可提升下一关。`;
}

function createSymbolIcon(symbolId) {
  const wrap = document.createElement("div");
  wrap.className = `shopIcon ${symbolId.replace("icon-", "")}`;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#${symbolId}`);
  use.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", `#${symbolId}`);
  svg.appendChild(use);
  wrap.appendChild(svg);
  return wrap;
}

function renderShop() {
  const types = commandTypes();

  ui.shopList.innerHTML = "";
  const bgName = BACKGROUNDS[game.bgIndex]?.name ?? "未知背景";
  const trackName = createAudioButtonSnapshotForHost().trackName || "—";
  ui.shopSeed.textContent = `本局种子：${game.runSeed} / 关卡种子：${game.currentSeed} / 背景：${bgName} / 音乐：${trackName}`;
  ui.overlayText.textContent = shopSummaryText();

  for (const item of SHOP_ITEMS) {
    const owned =
      item.id === "bomb"
        ? game.inventory.bombs
        : item.id === "speed"
          ? game.inventory.speed
          : game.inventory.lucky;

    const card = document.createElement("div");
    card.className = "shopItem";

    const icon = createSymbolIcon(item.icon);

    const meta = document.createElement("div");
    const title = document.createElement("div");
    title.className = "shopTitle";
    title.textContent = `${item.name} · ${item.cost}分`;

    const desc = document.createElement("div");
    desc.className = "shopDesc";
    desc.textContent = item.desc;

    const ownedLine = document.createElement("div");
    ownedLine.className = "shopOwned";
    ownedLine.textContent = `已拥有 ${owned}`;

    meta.appendChild(title);
    meta.appendChild(desc);
    meta.appendChild(ownedLine);

    const buyBtn = document.createElement("button");
    buyBtn.className = "btn";
    buyBtn.textContent = "购买";
    buyBtn.disabled = game.score < item.cost;
    buyBtn.addEventListener("click", () => {
      dispatchCommand(createRuntimeCommand(types.BUY_SHOP_ITEM, { itemId: item.id }));
    });

    card.appendChild(icon);
    card.appendChild(meta);
    card.appendChild(buyBtn);
    ui.shopList.appendChild(card);
  }
}

function openShop() {
  const types = commandTypes();

  game.phase = "shop";
  game.paused = true;
  emitAudioEvent("shop_open");
  emitShopRenderEvent();
  emitOverlayShowEvent({
    title: "商店",
    text: shopSummaryText(),
    primary: {
      label: "开始下一关",
      onClick: () => dispatchCommand(createRuntimeCommand(types.START_NEXT_LEVEL)),
    },
    secondary: {
      label: "重开",
      onClick: () => dispatchCommand(createRuntimeCommand(types.RESTART_GAME)),
    },
    showShop: true,
  });
  emitHudUpdateEvent();
  processGameEvents();
}

function endLevel() {
  for (const hook of getHooks()) {
    const item = attachedItem(hook);
    if (item) item.grabbed = false;
    resetHook(hook);
  }
  updateDdaAfterLevel();
  if (game.score >= game.target) {
    openShop();
  } else {
    game.phase = "gameOver";
    emitAudioEvent("game_over");
    emitOverlayShowEvent({
      title: "失败",
      text: `还差 ${Math.max(0, Math.floor(game.target - game.score))} 分。再来一次？`,
      primary: {
        label: "再来一次",
        onClick: () => dispatchCommand(createRuntimeCommand(commandTypes().RESTART_GAME)),
      },
      secondary: null,
    });
  }
  emitHudUpdateEvent();
  processGameEvents();
}

function dropHookFor(index) {
  if (game.phase !== "playing" || game.paused) return;
  if (!isTwoPlayerMode() && index !== 0) return;

  const hook = getHookByIndex(index);
  const miner = getMinerByIndex(index);
  if (hook.state !== "swing") return;

  emitAudioEvent("hook_shoot");
  processGameEvents();
  hook.state = "extend";
  miner.releasePop = 1;
  miner.grip = Math.min(miner.grip, 0.15);
  hook.length = hook.minLength;
  hook.trail.length = 0;
  game.lastHookIndex = index;
}

function dropHook() {
  dropHookFor(0);
}

function useBomb() {
  if (game.phase !== "playing" || game.paused) return;
  if (game.inventory.bombs <= 0) return;
  const canBombHook = (hook) => hook.state === "retract" && attachedItem(hook);
  const preferred = getHookByIndex(game.lastHookIndex);
  const hook = canBombHook(preferred) ? preferred : getHooks().find((h) => canBombHook(h)) ?? null;
  if (!hook) return;

  const item = attachedItem(hook);
  if (!item) return;

  emitAudioEvent("bomb");

  const boom = getHookEnd(hook);
  game.inventory.bombs -= 1;
  game.items = game.items.filter((it) => it.id !== item.id);
  hook.attachedId = null;
  hook.clawClose = 0;
  game.effects.bombBoost = BOMB_BOOST_TIME;

  emitFxShakeEvent(0.28);
  emitFxFlashEvent(0.16);
  emitFxRingEvent({
    x: boom.x,
    y: boom.y,
    r0: 8,
    r1: 90,
    life: 0.55,
    color: "rgba(255, 224, 138, 0.9)",
    width: 5,
  });
  emitFxBurstEvent({
    x: boom.x,
    y: boom.y,
    count: 34,
    colors: ["#ffd34d", "#ff8a5c", "#ff4d4d", "#ffe08a"],
    speedMin: 140,
    speedMax: 420,
    sizeMin: 1.4,
    sizeMax: 4.8,
    lifeMin: 0.28,
    lifeMax: 0.85,
    gravity: 650,
  });
  emitFxBurstEvent({
    x: boom.x,
    y: boom.y,
    count: 18,
    colors: ["rgba(30,30,30,0.85)", "rgba(80,80,80,0.7)"],
    speedMin: 60,
    speedMax: 180,
    sizeMin: 2.2,
    sizeMax: 6.2,
    lifeMin: 0.55,
    lifeMax: 1.15,
    gravity: 260,
  });
  emitHudUpdateEvent();
  processGameEvents();
}

function explodeAt({ x, y, radius = 120, strength = 1 }) {
  emitAudioEvent("bomb");

  const pow = clamp(strength, 0.5, 2);
  emitFxShakeEvent(0.26 + 0.18 * pow);
  emitFxFlashEvent(0.14 + 0.12 * pow);

  emitFxRingEvent({
    x,
    y,
    r0: 10,
    r1: radius * (0.92 + 0.18 * pow),
    life: 0.62,
    color: "rgba(255, 224, 138, 0.95)",
    width: 6,
  });
  emitFxBurstEvent({
    x,
    y,
    count: Math.round(44 * pow),
    colors: ["#ffd34d", "#ff8a5c", "#ff4d4d", "#ffe08a", "#ffffff"],
    speedMin: 160,
    speedMax: 520,
    sizeMin: 1.2,
    sizeMax: 5.2,
    lifeMin: 0.24,
    lifeMax: 0.9,
    gravity: 720,
  });
  emitFxBurstEvent({
    x,
    y,
    count: Math.round(22 * pow),
    colors: ["rgba(30,30,30,0.85)", "rgba(80,80,80,0.72)", "rgba(140,140,140,0.55)"],
    speedMin: 80,
    speedMax: 240,
    sizeMin: 2.2,
    sizeMax: 8.0,
    lifeMin: 0.7,
    lifeMax: 1.45,
    gravity: 280,
  });
  processGameEvents();
}

function explodeKegAt(x, y) {
  explodeAt({ x, y, radius: KEG_BLAST_RADIUS, strength: 1.15 });

  const removedIds = new Set(selectKegBlastAffectedIds(x, y, KEG_BLAST_RADIUS));
  game.items = game.items.filter((it) => {
    if (removedIds.has(it.id)) {
      return false;
    }
    return true;
  });

  for (const hook of getHooks()) {
    if (hook.attachedId && removedIds.has(hook.attachedId)) {
      hook.attachedId = null;
      hook.clawClose = 0;
    }
  }
}

function selectKegBlastAffectedIdsWithLocalState(x, y, radius) {
  const affectedIds = [];
  for (const it of game.items) {
    const rr = radius + it.r * 0.15;
    if (dist2(x, y, it.x, it.y) <= rr * rr) {
      affectedIds.push(it.id);
    }
  }

  return affectedIds;
}

function selectKegBlastAffectedIds(x, y, radius) {
  if (!kegSystemBridgeDisabled && GoldMinerModules.selectKegBlastAffectedIds) {
    try {
      return GoldMinerModules.selectKegBlastAffectedIds({
        items: game.items,
        x,
        y,
        radius,
      });
    } catch (error) {
      noteKegSystemBridgeError(error);
    }
  }

  return selectKegBlastAffectedIdsWithLocalState(x, y, radius);
}

function dropKeg(hook, item) {
  item.grabbed = false;
  item.keg = { stage: "fall", vy: 0, x0: item.x };
  hook.attachedId = null;
  hook.clawClose = 0;

  emitAudioEvent("hook_retract_empty");

  emitFxRingEvent({
    x: item.x,
    y: item.y,
    r0: 6,
    r1: 34,
    life: 0.28,
    color: "rgba(255, 77, 77, 0.9)",
    width: 3,
  });
  processGameEvents();
}

function updateFallingKegMotionWithLocalState(item, dt) {
  if (item.type !== "keg") return false;
  if (item.keg?.stage !== "fall") return false;

  const lockX = typeof item.keg.x0 === "number" ? item.keg.x0 : item.x;
  item.x = lockX;

  const vy = (item.keg.vy ?? 0) + KEG_GRAVITY * dt;
  item.keg.vy = vy;
  item.y += vy * dt;

  if (item.art) item.art.rot = (item.art.rot ?? 0) + dt * (0.6 + vy / 1300) * 0.9;

  return item;
}

function findFallingKegCollisionWithLocalState(item, itemIndex) {
  for (let j = 0; j < game.items.length; j += 1) {
    if (j === itemIndex) continue;
    const other = game.items[j];
    const rr = item.r + other.r;
    if (dist2(item.x, item.y, other.x, other.y) <= rr * rr) {
      return { item: other, id: other.id, index: j };
    }
  }

  return null;
}

function findFallingKegCollision(item, itemIndex) {
  if (!kegSystemBridgeDisabled && GoldMinerModules.findFallingKegCollision) {
    try {
      return GoldMinerModules.findFallingKegCollision({
        items: game.items,
        kegItem: item,
        kegIndex: itemIndex,
      });
    } catch (error) {
      noteKegSystemBridgeError(error);
    }
  }

  return findFallingKegCollisionWithLocalState(item, itemIndex);
}

function updateFallingKegs(dt) {
  const h = game.viewport.h;
  for (let i = 0; i < game.items.length; i += 1) {
    const item = game.items[i];
    let updated = false;

    if (!itemMotionSystemBridgeDisabled && GoldMinerModules.updateFallingKegMotion) {
      try {
        updated = GoldMinerModules.updateFallingKegMotion(item, { dt, gravity: KEG_GRAVITY });
      } catch (error) {
        noteItemMotionSystemBridgeError(error);
      }
    }

    if (!updated) updated = updateFallingKegMotionWithLocalState(item, dt);
    if (!updated) continue;

    const collision = findFallingKegCollision(item, i);
    if (collision) {
      explodeKegAt(item.x, item.y);
      return;
    }

    // Fall out of screen => disappear
    if (item.y - item.r > h + KEG_FALL_OUT_PAD) {
      game.items.splice(i, 1);
      i -= 1;
    }
  }
}

function updateMouseItemMotionWithLocalState(item, dt) {
  if (item.type !== "mouse") return false;
  if (item.grabbed) return false;
  const m = item.mouse;
  if (!m) return false;

  const w = game.viewport.w;
  const h = game.viewport.h;
  const margin = 34;
  const vx = Number.isFinite(m.vx) ? m.vx : 0;
  item.x += vx * dt;

  // Keep inside the underground play area.
  const minX = margin + item.r;
  const maxX = w - margin - item.r;
  if (item.x <= minX) {
    item.x = minX;
    m.vx = Math.abs(vx || MOUSE_SPEED_MIN);
  } else if (item.x >= maxX) {
    item.x = maxX;
    m.vx = -Math.abs(vx || MOUSE_SPEED_MIN);
  }

  const minY = 170 + item.r;
  const maxY = h - margin - item.r;
  item.y = clamp(item.y, minY, maxY);

  m.phase = (Number.isFinite(m.phase) ? m.phase : 0) + dt * (3.5 + clamp(Math.abs(vx) / 90, 0, 2.2));

  return item;
}

function updateMice(dt) {
  for (const item of game.items) {
    if (!itemMotionSystemBridgeDisabled && GoldMinerModules.updateMouseItemMotion) {
      try {
        GoldMinerModules.updateMouseItemMotion(item, {
          dt,
          viewport: game.viewport,
          margin: 34,
          minY: 170,
          fallbackSpeed: MOUSE_SPEED_MIN,
        });
        continue;
      } catch (error) {
        noteItemMotionSystemBridgeError(error);
      }
    }

    updateMouseItemMotionWithLocalState(item, dt);
  }
}

function attachedItem(hook = game.hook) {
  if (!hook.attachedId) return null;
  return game.items.find((it) => it.id === hook.attachedId) ?? null;
}

function getHookCatchSfx(item) {
  if (item.type === "mouse") {
    const cargo = item.mouse?.cargo ?? null;
    if (cargo === "diamond") return "hook_catch_mouse_diamond";
    if (cargo === "bar") return "hook_catch_mouse_bar";
    return "hook_catch_mouse";
  }

  switch (item.type) {
    case "gold":
      return "hook_catch_gold";
    case "bar":
      return "hook_catch_bar";
    case "rock":
      return "hook_catch_rock";
    case "diamond":
      return "hook_catch_diamond";
    case "emerald":
      return "hook_catch_emerald";
    case "ruby":
      return "hook_catch_ruby";
    case "crystal":
      return "hook_catch_crystal";
    case "bag":
      return "hook_catch_bag";
    case "pouch":
      return "hook_catch_pouch";
    case "keg":
      return "hook_catch_keg";
    case "fossil":
      return "hook_catch_fossil";
    default:
      return "hook_catch_gold";
  }
}

function attachToHook(hook, item) {
  item.grabbed = true;
  hook.attachedId = item.id;
  hook.state = "retract";
  hook.clawClose = 1;
  game.lastHookIndex = hook === game.hook2 ? 1 : 0;

  emitAudioEvent(getHookCatchSfx(item), { weight: item.weight, cargo: item.mouse?.cargo ?? null });

  if (item.type === "keg") {
    item.keg = { stage: "pull", releaseLength: lerp(hook.minLength, hook.length, KEG_RELEASE_FRAC) };

    if (shouldKegExplodeImmediately()) {
      const p = getHookEnd(hook);
      processGameEvents();
      explodeKegAt(p.x, p.y);
      hook.attachedId = null;
      hook.clawClose = 0;
      item.grabbed = false;
      return;
    }
  }

  emitAudioEvent("hook_retract_carry", { weight: item.weight, type: item.type });

  const p = getHookEnd(hook);
  const color = itemFxColor(item);
  emitFxRingEvent({ x: p.x, y: p.y, r0: 6, r1: 28, life: 0.28, color, width: 2.5 });
  emitFxBurstEvent({
    x: p.x,
    y: p.y,
    count: item.type === "rock" ? 10 : 14,
    colors:
      item.type === "rock"
        ? ["rgba(210, 175, 120, 0.25)", "rgba(120, 85, 45, 0.22)", "#a7b0ba"]
        : [color, "#ffffff", "#ffe08a"],
    speedMin: 60,
    speedMax: item.type === "rock" ? 180 : 240,
    sizeMin: 1.0,
    sizeMax: 3.6,
    lifeMin: 0.2,
    lifeMax: 0.55,
    gravity: item.type === "rock" ? 680 : 520,
  });
  if (item.type === "rock") emitFxShakeEvent(0.08);
  processGameEvents();
}

function itemFxColor(item) {
  switch (item.type) {
    case "mouse": {
      const cargo = item.mouse?.cargo ?? null;
      if (cargo === "diamond") return "#8fe9ff";
      if (cargo === "bar") return "#ffd34d";
      return "#c8cdd8";
    }
    case "diamond":
      return "#8fe9ff";
    case "emerald":
      return "#34e28a";
    case "ruby":
      return "#ff4d6d";
    case "crystal":
      return "#a6f6ff";
    case "rock":
      return "#a7b0ba";
    case "fossil":
      return "#e7d3a5";
    case "bag":
      return "#b07bff";
    case "pouch":
      return "#ffd34d";
    case "keg":
      return "#ff6b5a";
    case "bar":
      return "#ffd34d";
    case "gold":
    default:
      return "#ffd34d";
  }
}

function createDeliveryResultWithLocalScoring({ score, item, playerIndex }) {
  const earned = item.type === "bag" ? item.bagValue ?? item.value : item.value;
  const color = itemFxColor(item);

  return {
    earned,
    nextScore: score + earned,
    color,
    playerIndex,
    scorePopPayload: { amount: earned, color, player: playerIndex },
    scoreAudioPayload: { amount: earned },
    ringPayload: {
      r0: 10,
      r1: 54,
      life: 0.55,
      color,
      width: 3,
      yOffset: 18,
    },
    burstPayload: {
      yOffset: 18,
      count: clamp(Math.round(10 + item.r / 3), 10, 18),
      colors: [color, "#ffffff", "#ffe08a"],
      speedMin: 80,
      speedMax: 220,
      sizeMin: 1.2,
      sizeMax: 3.6,
      lifeMin: 0.35,
      lifeMax: 0.7,
      gravity: 520,
    },
  };
}

function createDeliveryResultForHost(options) {
  if (GoldMinerModules.createDeliveryResult && !scoringSystemBridgeDisabled) {
    try {
      return GoldMinerModules.createDeliveryResult(options);
    } catch (error) {
      scoringSystemBridgeDisabled = true;
      if (!Object.prototype.hasOwnProperty.call(window, "__goldMinerScoringSystemError")) {
        window.__goldMinerScoringSystemError = error instanceof Error ? error.message : String(error);
      }
      console.warn("Gold Miner scoring system failed; using local scoring fallback.", error);
    }
  }

  return createDeliveryResultWithLocalScoring(options);
}

function mergePivotOffsetPayload(payload, pivot) {
  const { yOffset = 0, ...rest } = payload;
  return { ...rest, x: pivot.x, y: pivot.y + yOffset };
}

function spawnBurst({ x, y, count, colors, speedMin, speedMax, sizeMin, sizeMax, lifeMin, lifeMax, gravity }) {
  const grav = gravity ?? 380;
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = lerp(speedMin, speedMax, Math.random());
    game.fx.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - s * 0.15,
      size: lerp(sizeMin, sizeMax, Math.random()),
      age: 0,
      life: lerp(lifeMin, lifeMax, Math.random()),
      color: colors[Math.floor(Math.random() * colors.length)],
      gravity: grav,
    });
  }
}

function spawnRing({ x, y, r0, r1, life, color, width }) {
  game.fx.rings.push({
    x,
    y,
    r0,
    r1,
    width,
    age: 0,
    life,
    color,
  });
}

function spawnDirtPuff(x, y, intensity) {
  const t = clamp(intensity, 0.6, 3);
  spawnBurst({
    x,
    y,
    count: clamp(Math.round(4 + 5 * t), 5, 22),
    colors: ["rgba(255, 224, 138, 0.18)", "rgba(210, 175, 120, 0.28)", "rgba(120, 85, 45, 0.24)"],
    speedMin: 30,
    speedMax: 140,
    sizeMin: 1.2,
    sizeMax: 4.4,
    lifeMin: 0.25,
    lifeMax: 0.75,
    gravity: 420,
  });
}

function addScorePop(amount, color, hook = game.hook) {
  const pivot = getPivot(hook);
  game.fx.pops.push({
    x: pivot.x,
    y: pivot.y + 26,
    vx: lerp(-18, 18, Math.random()),
    vy: lerp(-62, -92, Math.random()),
    age: 0,
    life: 0.9,
    text: `+${amount}`,
    color,
  });
}

function deliverAttachedItem(hook, item) {
  const player = hook === game.hook2 ? 1 : 0;
  const delivery = createDeliveryResultForHost({ score: game.score, item, playerIndex: player });
  const { earned, nextScore } = delivery;

  game.score = nextScore;
  if (game.dda.firstClearTimeLeft == null && game.score >= game.target) {
    game.dda.firstClearTimeLeft = game.timeLeft;
  }
  game.items = game.items.filter((it) => it.id !== item.id);

  emitAudioEvent("score", delivery.scoreAudioPayload);
  emitScorePopEvent(delivery.scorePopPayload);
  const pivot = getPivot(hook);
  emitFxRingEvent(mergePivotOffsetPayload(delivery.ringPayload, pivot));
  emitFxBurstEvent(mergePivotOffsetPayload(delivery.burstPayload, pivot));
  processGameEvents();
}

function updateFxWithLocalState(dt) {
  if (game.fx.flash > 0) game.fx.flash = Math.max(0, game.fx.flash - dt * 2.8);

  if (game.fx.shake > 0) {
    game.fx.shake = Math.max(0, game.fx.shake - dt * 2.2);
    const power = game.fx.shake;
    game.fx.shakeX = (Math.random() * 2 - 1) * power * 10;
    game.fx.shakeY = (Math.random() * 2 - 1) * power * 8;
  } else {
    game.fx.shakeX = 0;
    game.fx.shakeY = 0;
  }

  for (let i = game.fx.pops.length - 1; i >= 0; i -= 1) {
    const p = game.fx.pops[i];
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 180 * dt;
    if (p.age >= p.life) game.fx.pops.splice(i, 1);
  }

  for (let i = game.fx.rings.length - 1; i >= 0; i -= 1) {
    const r = game.fx.rings[i];
    r.age += dt;
    if (r.age >= r.life) game.fx.rings.splice(i, 1);
  }

  for (let i = game.fx.particles.length - 1; i >= 0; i -= 1) {
    const p = game.fx.particles[i];
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += (p.gravity ?? 380) * dt;
    p.vx *= 0.985;
    p.size *= 0.992;
    if (p.age >= p.life || p.size <= 0.2) game.fx.particles.splice(i, 1);
  }

  return game.fx;
}

function updateFx(dt) {
  if (!fxStateBridgeDisabled && GoldMinerModules.updateFxState) {
    try {
      return GoldMinerModules.updateFxState(game.fx, dt, Math.random);
    } catch (error) {
      fxStateBridgeDisabled = true;
      if (!Object.prototype.hasOwnProperty.call(window, "__goldMinerFxSystemError")) {
        window.__goldMinerFxSystemError = error instanceof Error ? error.message : String(error);
      }
      console.warn("Gold Miner fx system failed; using local fx state fallback.", error);
    }
  }

  return updateFxWithLocalState(dt);
}

function updateHookTrailWithLocalState(hook, dt) {
  const trail = hook.trail;

  for (let i = trail.length - 1; i >= 0; i -= 1) {
    trail[i].age += dt;
    if (trail[i].age >= 0.55) trail.splice(i, 1);
  }

  const state = hook.state;
  if (state !== "extend" && state !== "retract") return trail;

  const end = getHookEndWithLocalState(hook);
  const last = trail[trail.length - 1] ?? null;
  if (!last || dist2(last.x, last.y, end.x, end.y) >= 7 * 7) {
    trail.push({ x: end.x, y: end.y, age: 0 });
    if (trail.length > 28) trail.shift();
  } else {
    last.x = end.x;
    last.y = end.y;
  }

  return trail;
}

function updateHookTrail(dt) {
  for (const hook of getHooks()) {
    const state = hook.state;
    if (!hookSystemBridgeDisabled && GoldMinerModules.updateHookTrailState) {
      try {
        const end = state === "extend" || state === "retract" ? getHookEnd(hook) : null;
        if (!hookSystemBridgeDisabled) {
          GoldMinerModules.updateHookTrailState({
            trail: hook.trail,
            state,
            end,
            dt,
          });
          continue;
        }
      } catch (error) {
        noteHookSystemBridgeError(error);
      }
    }

    updateHookTrailWithLocalState(hook, dt);
  }
}

function smoothTo(current, target, speed, dt) {
  const t = 1 - Math.exp(-Math.max(0, speed) * Math.max(0, dt));
  return lerp(current, target, clamp(t, 0, 1));
}

function updateHookSwingWithLocalState(hook, dt) {
  hook.angle += hook.angleDir * hook.angleSpeed * dt;
  if (hook.angle >= hook.maxAngle) {
    hook.angle = hook.maxAngle;
    hook.angleDir = -1;
  } else if (hook.angle <= hook.minAngle) {
    hook.angle = hook.minAngle;
    hook.angleDir = 1;
  }

  return hook;
}

function updateHookSwing(hook, dt) {
  if (!hookSystemBridgeDisabled && GoldMinerModules.updateHookSwingState) {
    try {
      return GoldMinerModules.updateHookSwingState(hook, dt);
    } catch (error) {
      noteHookSystemBridgeError(error);
    }
  }

  return updateHookSwingWithLocalState(hook, dt);
}

function updateHookReelWithLocalState(hook, { prevLength, dt, smoothSpeed = 10.5 }) {
  const deltaLen = hook.length - prevLength;
  if (Math.abs(deltaLen) > 0.0001) {
    hook.reelAngle += deltaLen / 10;
    hook.lastLength = hook.length;
  }
  const speed = deltaLen / Math.max(0.001, dt);
  hook.spoolSpeed = smoothTo(hook.spoolSpeed ?? 0, speed, smoothSpeed, dt);

  return hook;
}

function updateHookReel(hook, { prevLength, dt }) {
  if (!hookSystemBridgeDisabled && GoldMinerModules.updateHookReelState) {
    try {
      return GoldMinerModules.updateHookReelState(hook, { prevLength, dt });
    } catch (error) {
      noteHookSystemBridgeError(error);
    }
  }

  return updateHookReelWithLocalState(hook, { prevLength, dt });
}

function updateMinerFor(miner, hook, dt) {
  const active = game.phase === "playing" && !game.paused;
  const hookState = hook.state;

  const targetGrip = active && hookState === "extend" ? 0 : 1;
  miner.grip = smoothTo(miner.grip, targetGrip, 9.5, dt);

  const reelSpeed = Math.abs(hook.spoolSpeed ?? 0);
  let crankTarget = 0;
  if (active && hookState === "retract") {
    const carried = attachedItem(hook);
    const weight = carried ? carried.weight : 0;
    const effort = clamp(weight / 6.4, 0, 1);
    crankTarget = clamp(0.18 + effort * 0.32 + (reelSpeed / 920) * 0.55, 0, 1);
  }
  miner.crank = smoothTo(miner.crank, crankTarget, 6.5, dt);

  miner.releasePop = Math.max(0, miner.releasePop - dt * 2.8);

  const closeTarget = active && hookState === "retract" && attachedItem(hook) ? 1 : 0;
  hook.clawClose = smoothTo(hook.clawClose ?? 0, closeTarget, 14.5, dt);

  // When the game isn't actively updating rope physics, decay reel motion.
  if (!active) {
    hook.spoolSpeed = smoothTo(hook.spoolSpeed ?? 0, 0, 5.5, dt);
  }
}

function updateMiner(dt) {
  const hooks = getHooks();
  for (let i = 0; i < hooks.length; i += 1) {
    updateMinerFor(getMinerByIndex(i), hooks[i], dt);
  }
}

function stepPlayingStateForHost(dt) {
  const options = {
    state: game,
    dt,
    systems: {},
    events: {
      countdown: () => {
        emitAudioEvent("countdown");
        processGameEvents();
      },
      endLevel: () => endLevel(),
    },
  };

  if (!stateKernelBridgeDisabled && GoldMinerModules.stepPlayingState) {
    try {
      return GoldMinerModules.stepPlayingState(options);
    } catch (error) {
      noteStateKernelBridgeError(error);
    }
  }

  if (stateKernelFallback?.stepPlayingState) {
    return stateKernelFallback.stepPlayingState(options);
  }

  throw new Error("Gold Miner state kernel API is unavailable");
}

function update(dt) {
  const stepResult = stepPlayingStateForHost(dt);
  if (!stepResult.shouldContinue) return;

  const w = game.viewport.w;
  const h = game.viewport.h;
  const groundY = getGroundY();
  const tipR = BASE.hookTipRadius;
  let decayBombBoost = false;

  updateMice(dt);

  for (const hook of getHooks()) {
    const prevLength = hook.length;

    if (hook.state === "swing") {
      updateHookSwing(hook, dt);
    } else if (hook.state === "extend") {
      const before = getHookEnd(hook);
      hook.length += hook.extendSpeed * dt;
      const after = getHookEnd(hook);

      for (const item of game.items) {
        if (item.grabbed) continue;
        if (item.type === "keg" && item.keg?.stage === "fall") continue;
        if (segmentCircleIntersect(before.x, before.y, after.x, after.y, item.x, item.y, item.r + tipR)) {
          attachToHook(hook, item);
          break;
        }
      }

      if (hook.state === "extend") {
        const end = getHookEnd(hook);
        const out = end.x <= 0 || end.x >= w || end.y >= h;
        if (hook.length >= hook.maxLength || out) {
          hook.state = "retract";
          emitAudioEvent("hook_retract_empty");
          processGameEvents();
        }
      }
    } else if (hook.state === "retract") {
      decayBombBoost = true;
      let item = attachedItem(hook);
      const weight = item ? item.weight : 0;
      const bombMultiplier = game.effects.bombBoost > 0 ? BOMB_RETRACT_MULT : 1;
      const carryTimeMul = item ? CARRY_PULL_TIME_MULT : 1;
      const speed = (hook.retractBaseSpeed * game.effects.speedMultiplier * bombMultiplier) / (1 + weight) / carryTimeMul;
      hook.length -= speed * dt;

      if (item) {
        if (hook.length < hook.minLength) hook.length = hook.minLength;
        const end = getHookEnd(hook);
        item.x = end.x;
        item.y = end.y + item.r * 0.25;

        if (item.type === "keg" && item.keg?.stage === "pull" && hook.length <= item.keg.releaseLength) {
          dropKeg(hook, item);
          item = null;
        }
      }

      if (hook.length <= hook.minLength) {
        hook.length = hook.minLength;
        if (item) deliverAttachedItem(hook, item);
        resetHook(hook);
      }
    }

    updateHookReel(hook, { prevLength, dt });

    const end = getHookEnd(hook);
    if ((hook.state === "extend" || hook.state === "retract") && end.y > groundY + 10) {
      hook.dustCooldown -= dt;
      if (hook.dustCooldown <= 0) {
        const item = attachedItem(hook);
        const weight = item ? item.weight : 0;
        spawnDirtPuff(end.x, end.y, 0.75 + weight * 0.25);
        hook.dustCooldown = 0.08;
      }
    } else {
      hook.dustCooldown = Math.max(0, hook.dustCooldown - dt);
    }
  }

  if (decayBombBoost && game.effects.bombBoost > 0) {
    game.effects.bombBoost = Math.max(0, game.effects.bombBoost - dt);
  }

  updateFallingKegs(dt);
  updateHud();
}

function backgroundLayerOptions(now = performance.now()) {
  const bg = BACKGROUNDS[game.bgIndex] ?? BACKGROUNDS[0];
  const img = bgAssets.ready ? bgAssets.images[game.bgIndex] : null;

  return {
    ctx,
    viewport: game.viewport,
    background: bg,
    image: img,
    scene: game.scene,
    colors: COLORS,
    artAssets: crayonArtAssets(),
    now,
  };
}

function drawBackgroundWithLocalLayer(options = backgroundLayerOptions()) {
  const { viewport, background, image, scene, colors, now } = options;
  const w = viewport.w;
  const h = viewport.h;

  if (image && (image.naturalWidth || image.width)) {
    drawImageCover(image, 0, 0, w, h);
  } else {
    const groundY = h * 0.72;
    const grd = ctx.createLinearGradient(0, 0, 0, groundY);
    grd.addColorStop(0, "#1a2450");
    grd.addColorStop(0.55, colors.skyTop);
    grd.addColorStop(1, colors.skyBottom);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    const g2 = ctx.createLinearGradient(0, groundY, 0, h);
    g2.addColorStop(0, "#2a241b");
    g2.addColorStop(0.12, colors.groundTop);
    g2.addColorStop(1, colors.groundBottom);
    ctx.fillStyle = g2;
    ctx.fillRect(0, groundY, w, h - groundY);
  }

  // Subtle animated overlays (adds life without fighting the illustration)
  if (background?.stars) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const s of scene.stars) {
      const tw = 0.55 + 0.45 * Math.sin(now / 680 + s.tw);
      const a = s.a * tw * 0.55;
      if (a <= 0.001) continue;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Underground dust shimmer
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const d of scene.dust) {
    const tw = 0.7 + 0.3 * Math.sin(now / 900 + d.tw);
    const a = d.a * tw * 0.22;
    if (a <= 0.001) continue;
    ctx.fillStyle = `rgba(255, 224, 138, ${a})`;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Light sweep
  ctx.save();
  ctx.globalAlpha = 0.06;
  const sweepX = w * 0.5 + Math.sin(now / 4200) * w * 0.12;
  const sweepY = h * 0.3 + Math.cos(now / 5200) * h * 0.06;
  const sweep = ctx.createRadialGradient(sweepX, sweepY, 80, sweepX, sweepY, Math.max(w, h) * 0.65);
  sweep.addColorStop(0, "rgba(255,255,255,0.35)");
  sweep.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sweep;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // Vignette
  ctx.save();
  ctx.globalAlpha = 0.22;
  const vig = ctx.createRadialGradient(w * 0.5, h * 0.45, Math.min(w, h) * 0.2, w * 0.5, h * 0.45, Math.max(w, h) * 0.75);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawBackground() {
  const options = backgroundLayerOptions();

  if (!backgroundLayerBridgeDisabled && GoldMinerModules.drawBackgroundLayer) {
    try {
      GoldMinerModules.drawBackgroundLayer(options);
      return;
    } catch (error) {
      backgroundLayerBridgeDisabled = true;
      if (!Object.prototype.hasOwnProperty.call(window, "__goldMinerBackgroundRendererError")) {
        window.__goldMinerBackgroundRendererError = error instanceof Error ? error.message : String(error);
      }
      console.warn("Gold Miner background renderer failed; using local background fallback.", error);
    }
  }

  drawBackgroundWithLocalLayer(options);
}

function recalcHookMaxLength() {
  const w = game.viewport.w;
  const h = game.viewport.h;
  for (const hook of getHooks()) {
    const pivot = getPivot(hook);

    const dx = Math.max(pivot.x, w - pivot.x);
    const dy = Math.max(0, h - pivot.y);
    const diagonal = Math.hypot(dx, dy);

    const maxAngle = Math.max(Math.abs(hook.minAngle), Math.abs(hook.maxAngle));
    const sinA = Math.max(0.18, Math.abs(Math.sin(maxAngle)));
    const sideReachAtMaxAngle = dx / sinA;

    const pad = 28;
    hook.maxLength = Math.max(320, diagonal + pad, sideReachAtMaxAngle + pad);
  }
}

function winchLayerOptions(hook = game.hook) {
  return {
    ctx,
    pivot: getPivot(hook),
    reel: getReelCenter(hook),
    plankY: getPlankY(),
    hook,
    artAssets: crayonArtAssets(),
  };
}

function drawReelWithLocalLayer({ ctx: reelCtx, pivot, centerY, hook } = {}) {
  const rOuter = 16;
  const rInner = 7.5;
  const spin = hook.reelAngle;
  const spool = Math.abs(hook.spoolSpeed ?? 0);
  const blur = clamp((spool - 160) / 780, 0, 1);

  reelCtx.save();
  try {
    reelCtx.translate(pivot.x, centerY);

    // Motion blur when the rope is moving fast (extend/retract)
    if (blur > 0.001) {
      reelCtx.save();
      try {
        reelCtx.globalCompositeOperation = "lighter";
        reelCtx.lineCap = "round";
        reelCtx.lineWidth = 2.4;
        reelCtx.globalAlpha = 0.12 + 0.28 * blur;
        reelCtx.strokeStyle = "rgba(255,255,255,0.65)";
        for (let i = 0; i < 5; i += 1) {
          const a0 = spin + i * 0.95;
          const a1 = a0 + 0.55 + blur * 0.38;
          reelCtx.beginPath();
          reelCtx.arc(0, 0, rOuter + 2.4, a0, a1);
          reelCtx.stroke();
        }
        reelCtx.globalAlpha = 0.06 + 0.14 * blur;
        reelCtx.strokeStyle = "rgba(255, 211, 77, 0.65)";
        reelCtx.lineWidth = 1.6;
        reelCtx.beginPath();
        reelCtx.arc(0, 0, rOuter + 1.4, spin, spin + 1.65 + blur * 0.65);
        reelCtx.stroke();
      } finally {
        reelCtx.restore();
      }
    }

    // Shadow
    reelCtx.fillStyle = "rgba(0,0,0,0.35)";
    reelCtx.beginPath();
    reelCtx.ellipse(3, 4, rOuter * 1.05, rOuter * 0.75, 0, 0, Math.PI * 2);
    reelCtx.fill();

    // Metal ring
    const ring = reelCtx.createRadialGradient(-6, -7, 2, 0, 0, rOuter);
    ring.addColorStop(0, "#ffffff");
    ring.addColorStop(0.35, "#d8d8d8");
    ring.addColorStop(0.65, "#9a9a9a");
    ring.addColorStop(1, "#f1f1f1");
    reelCtx.fillStyle = ring;
    reelCtx.beginPath();
    reelCtx.arc(0, 0, rOuter, 0, Math.PI * 2);
    reelCtx.fill();

    // Rim highlight
    reelCtx.strokeStyle = "rgba(255,255,255,0.16)";
    reelCtx.lineWidth = 2;
    reelCtx.beginPath();
    reelCtx.arc(-1.5, -1.5, rOuter - 1.5, 0, Math.PI * 2);
    reelCtx.stroke();

    // Inner hub
    const hub = reelCtx.createRadialGradient(-2, -2, 1, 0, 0, rInner);
    hub.addColorStop(0, "#7a7a7a");
    hub.addColorStop(1, "#1f1f1f");
    reelCtx.fillStyle = hub;
    reelCtx.beginPath();
    reelCtx.arc(0, 0, rInner, 0, Math.PI * 2);
    reelCtx.fill();

    // Spokes + handle rotate with rope
    reelCtx.rotate(spin);
    reelCtx.strokeStyle = "rgba(0,0,0,0.42)";
    reelCtx.lineWidth = 3;
    for (let i = 0; i < 3; i += 1) {
      reelCtx.beginPath();
      reelCtx.moveTo(0, 0);
      reelCtx.lineTo(rOuter - 4, 0);
      reelCtx.stroke();
      reelCtx.rotate((Math.PI * 2) / 3);
    }

    reelCtx.strokeStyle = "rgba(255,255,255,0.28)";
    reelCtx.lineWidth = 1.6;
    for (let i = 0; i < 3; i += 1) {
      reelCtx.beginPath();
      reelCtx.moveTo(0, 0);
      reelCtx.lineTo(rOuter - 4, 0);
      reelCtx.stroke();
      reelCtx.rotate((Math.PI * 2) / 3);
    }

    // Handle
    reelCtx.strokeStyle = "rgba(0,0,0,0.35)";
    reelCtx.lineWidth = 3.6;
    reelCtx.beginPath();
    reelCtx.moveTo(rInner + 1.2, 0);
    reelCtx.lineTo(rOuter - 5.2, 0);
    reelCtx.stroke();

    reelCtx.strokeStyle = "rgba(255,255,255,0.18)";
    reelCtx.lineWidth = 1.6;
    reelCtx.beginPath();
    reelCtx.moveTo(rInner + 2.2, -0.6);
    reelCtx.lineTo(rOuter - 6.2, -0.6);
    reelCtx.stroke();

    reelCtx.fillStyle = "#ffd34d";
    reelCtx.beginPath();
    reelCtx.arc(rOuter - 2, 0, 3.8, 0, Math.PI * 2);
    reelCtx.fill();
    reelCtx.fillStyle = "rgba(0,0,0,0.22)";
    reelCtx.beginPath();
    reelCtx.arc(rOuter - 1, 1, 1.3, 0, Math.PI * 2);
    reelCtx.fill();
  } finally {
    reelCtx.restore();
  }

  return { drewReel: true };
}

function plankLayerOptions() {
  return {
    ctx,
    viewport: game.viewport,
    plankY: getPlankY(),
    plankHeight: BASE.plankHeight ?? 22,
    colors: COLORS,
  };
}

function drawPlankWithLocalLayer(options = plankLayerOptions()) {
  const { viewport, plankY, plankHeight, colors } = options;
  const w = viewport.w;

  ctx.save();
  const beam = ctx.createLinearGradient(0, plankY, 0, plankY + plankHeight);
  beam.addColorStop(0, "#9a663a");
  beam.addColorStop(0.45, colors.wood);
  beam.addColorStop(1, "#5a351f");
  ctx.fillStyle = beam;
  ctx.fillRect(0, plankY, w, plankHeight);

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, plankY + plankHeight - 2, w, 2);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(0, plankY, w, 2);

  // Plank seams
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  for (let x = 18; x < w; x += 72) {
    ctx.fillRect(x, plankY, 4, plankHeight);
  }

  ctx.restore();
}

function drawPlank() {
  const options = plankLayerOptions();

  if (!plankLayerBridgeDisabled && GoldMinerModules.drawPlankLayer) {
    try {
      GoldMinerModules.drawPlankLayer(options);
      return;
    } catch (error) {
      plankLayerBridgeDisabled = true;
      if (!Object.prototype.hasOwnProperty.call(window, "__goldMinerPlankRendererError")) {
        window.__goldMinerPlankRendererError = error instanceof Error ? error.message : String(error);
      }
      console.warn("Gold Miner plank renderer failed; using local plank fallback.", error);
    }
  }

  drawPlankWithLocalLayer(options);
}

function roundRectPathForWinch(winchCtx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  winchCtx.beginPath();
  winchCtx.moveTo(x + rr, y);
  winchCtx.arcTo(x + w, y, x + w, y + h, rr);
  winchCtx.arcTo(x + w, y + h, x, y + h, rr);
  winchCtx.arcTo(x, y + h, x, y, rr);
  winchCtx.arcTo(x, y, x + w, y, rr);
  winchCtx.closePath();
}

function drawWinchWithLocalLayer(options = winchLayerOptions()) {
  const { ctx: winchCtx, pivot, reel, plankY, hook } = options;

  winchCtx.save();
  try {
    // Base shadow on the plank
    winchCtx.save();
    try {
      winchCtx.globalAlpha = 0.25;
      winchCtx.fillStyle = "rgba(0,0,0,0.65)";
      winchCtx.beginPath();
      winchCtx.ellipse(reel.x + 8, plankY + 6, 44, 12, 0, 0, Math.PI * 2);
      winchCtx.fill();
    } finally {
      winchCtx.restore();
    }

    // Mount plate
    const plateW = 72;
    const plateH = 26;
    const plateX = reel.x - plateW / 2;
    const plateY = plankY - plateH + 3;
    const metal = winchCtx.createLinearGradient(plateX, plateY, plateX + plateW, plateY + plateH);
    metal.addColorStop(0, "#f3f3f3");
    metal.addColorStop(0.5, "#a9a9a9");
    metal.addColorStop(1, "#e8e8e8");
    winchCtx.fillStyle = "rgba(0,0,0,0.30)";
    roundRectPathForWinch(winchCtx, plateX + 2, plateY + 3, plateW, plateH, 8);
    winchCtx.fill();
    winchCtx.fillStyle = metal;
    roundRectPathForWinch(winchCtx, plateX, plateY, plateW, plateH, 8);
    winchCtx.fill();
    winchCtx.strokeStyle = "rgba(0,0,0,0.35)";
    winchCtx.lineWidth = 1.1;
    winchCtx.stroke();

    const bolt = (x, y2) => {
      const g = winchCtx.createRadialGradient(x - 1, y2 - 1, 1, x, y2, 6);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(1, "#6c6c6c");
      winchCtx.fillStyle = g;
      winchCtx.beginPath();
      winchCtx.arc(x, y2, 4.4, 0, Math.PI * 2);
      winchCtx.fill();
      winchCtx.fillStyle = "rgba(0,0,0,0.22)";
      winchCtx.beginPath();
      winchCtx.arc(x + 1.2, y2 + 1.1, 1.4, 0, Math.PI * 2);
      winchCtx.fill();
    };
    bolt(plateX + 14, plateY + 9);
    bolt(plateX + plateW - 14, plateY + 9);
    bolt(plateX + 14, plateY + plateH - 9);
    bolt(plateX + plateW - 14, plateY + plateH - 9);

    drawReelWithLocalLayer({ ctx: winchCtx, pivot, centerY: reel.y, hook });
  } finally {
    winchCtx.restore();
  }

  return { drewWinch: true, drewReel: true };
}

function drawWinch(hook = game.hook) {
  const options = winchLayerOptions(hook);

  if (!winchLayerBridgeDisabled && GoldMinerModules.drawWinchLayer) {
    try {
      return GoldMinerModules.drawWinchLayer(options);
    } catch (error) {
      winchLayerBridgeDisabled = true;
      if (!Object.prototype.hasOwnProperty.call(window, "__goldMinerWinchRendererError")) {
        window.__goldMinerWinchRendererError = error instanceof Error ? error.message : String(error);
      }
      console.warn("Gold Miner winch renderer failed; using local winch fallback.", error);
    }
  }

  return drawWinchWithLocalLayer(options);
}

function itemLayerOptions() {
  return {
    items: game.items,
    hooks: getHooks(),
    drawItem: (item, metadata) => drawItem(item, metadata),
  };
}

function hasRenderableAttachedId(attachedId) {
  return Number.isInteger(attachedId) && attachedId > 0;
}

function createLocalItemRenderOrder({ items, hooks }) {
  const attachedIds = new Set();
  for (const hook of hooks) {
    if (hasRenderableAttachedId(hook?.attachedId)) attachedIds.add(hook.attachedId);
  }

  const order = items
    .filter((item) => !attachedIds.has(item.id))
    .slice()
    .sort((a, b) => a.y - b.y)
    .map((item) => ({
      item,
      attached: false,
      hookIndex: null,
    }));

  const drawnAttachedIds = new Set();
  for (let hookIndex = 0; hookIndex < hooks.length; hookIndex += 1) {
    const attachedId = hooks[hookIndex]?.attachedId;
    if (!hasRenderableAttachedId(attachedId) || drawnAttachedIds.has(attachedId)) continue;
    const item = items.find((candidate) => candidate.id === attachedId) ?? null;
    if (!item) continue;

    drawnAttachedIds.add(attachedId);
    order.push({
      item,
      attached: true,
      hookIndex,
    });
  }

  return order;
}

function drawItemsWithLocalLayer(options = itemLayerOptions()) {
  const { items, hooks, drawItem: drawLayerItem } = options;
  const order = createLocalItemRenderOrder({ items, hooks });
  for (const entry of order) {
    drawLayerItem(entry.item, entry);
  }
  return order;
}

function drawItems() {
  const options = itemLayerOptions();

  if (!itemLayerBridgeDisabled && GoldMinerModules.drawItemsLayer) {
    try {
      GoldMinerModules.drawItemsLayer(options);
      return;
    } catch (error) {
      itemLayerBridgeDisabled = true;
      if (!Object.prototype.hasOwnProperty.call(window, "__goldMinerItemRendererError")) {
        window.__goldMinerItemRendererError = error instanceof Error ? error.message : String(error);
      }
      console.warn("Gold Miner item renderer failed; using local item fallback.", error);
    }
  }

  drawItemsWithLocalLayer(options);
}

function withSavedItemShape(drawCtx, draw) {
  drawCtx.save();
  try {
    return draw();
  } finally {
    drawCtx.restore();
  }
}

function blobPathForItemShape(drawCtx, blob, radius) {
  const pts = blob.map((p) => ({ x: Math.cos(p.a) * radius * p.r, y: Math.sin(p.a) * radius * p.r }));
  const n = pts.length;
  const mid0 = { x: (pts[n - 1].x + pts[0].x) / 2, y: (pts[n - 1].y + pts[0].y) / 2 };
  drawCtx.beginPath();
  drawCtx.moveTo(mid0.x, mid0.y);
  for (let i = 0; i < n; i += 1) {
    const p = pts[i];
    const next = pts[(i + 1) % n];
    const mid = { x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 };
    drawCtx.quadraticCurveTo(p.x, p.y, mid.x, mid.y);
  }
  drawCtx.closePath();
}

function roundRectPathForItemShape(drawCtx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  drawCtx.beginPath();
  drawCtx.moveTo(x + rr, y);
  drawCtx.arcTo(x + w, y, x + w, y + h, rr);
  drawCtx.arcTo(x + w, y + h, x, y + h, rr);
  drawCtx.arcTo(x, y + h, x, y, rr);
  drawCtx.arcTo(x, y, x + w, y, rr);
  drawCtx.closePath();
}

function itemShapeLayerOptions(item, metadata = {}) {
  return {
    ctx,
    item,
    metadata,
    now: performance.now(),
    createRng,
    artAssets: crayonArtAssets(),
  };
}

function drawItemWithLocalLayer(options = itemShapeLayerOptions()) {
  const { ctx: itemCtx, item, now, createRng: makeRng } = options;
  const art = item.art ?? { rot: 0 };

  if (!item.grabbed) {
    withSavedItemShape(itemCtx, () => {
      itemCtx.fillStyle = "rgba(0,0,0,0.25)";
      itemCtx.beginPath();
      itemCtx.ellipse(
        item.x + item.r * 0.08,
        item.y + item.r * 0.62,
        item.r * 0.85,
        Math.max(2, item.r * 0.32),
        0,
        0,
        Math.PI * 2,
      );
      itemCtx.fill();
    });
  }

  return withSavedItemShape(itemCtx, () => {
    const ctx = itemCtx;

    ctx.translate(item.x, item.y);

    let wobble = 0;
    if (item.type === "diamond") wobble = 0.14 * Math.sin(now / 620 + (art.twinkle ?? 0));
    if (item.type === "gold") wobble = 0.06 * Math.sin(now / 880 + (art.glint ?? 0) * 6);
    if (item.type === "bag") wobble = 0.1 * Math.sin(now / 760 + (art.stripe ?? 0) * 6);
    if (item.type === "rock") wobble = 0.04 * Math.sin(now / 920 + (art.rot ?? 0));
    if (item.type === "bar") wobble = 0.055 * Math.sin(now / 920 + (art.shine ?? 0));
    if (item.type === "emerald" || item.type === "ruby") wobble = 0.12 * Math.sin(now / 680 + (art.twinkle ?? 0));
    if (item.type === "crystal") wobble = 0.1 * Math.sin(now / 700 + (art.twinkle ?? 0));
    if (item.type === "pouch") wobble = 0.1 * Math.sin(now / 760 + (art.jiggle ?? 0));
    if (item.type === "keg") wobble = 0.06 * Math.sin(now / 840 + (art.fuse ?? 0));
    if (item.type === "fossil") wobble = 0.05 * Math.sin(now / 980 + (art.rot ?? 0));

    const baseRot = item.type === "mouse" ? 0 : (art.rot ?? 0);
    ctx.rotate(baseRot + wobble);

    if (item.type === "mouse") {
      const mouse = item.mouse ?? {};
      const vx = Number.isFinite(mouse.vx) ? mouse.vx : 0;
      const facing = vx >= 0 ? 1 : -1;
      const phase = Number.isFinite(mouse.phase) ? mouse.phase : 0;
      const bob = Math.sin(phase) * item.r * 0.06;

      ctx.translate(0, bob);
      ctx.scale(facing, 1);

      withSavedItemShape(ctx, () => {
        ctx.strokeStyle = "rgba(255, 141, 161, 0.6)";
        ctx.lineWidth = Math.max(1.2, item.r * 0.12);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-item.r * 0.88, item.r * 0.06);
        ctx.quadraticCurveTo(
          -item.r * 1.28,
          -item.r * 0.35 + Math.sin(phase * 0.75) * item.r * 0.14,
          -item.r * 1.58,
          item.r * 0.2,
        );
        ctx.stroke();
      });

      const bodyW = item.r * 1.55;
      const bodyH = item.r * 0.95;
      const bodyX = -item.r * 0.05;
      const bodyY = item.r * 0.1;
      const fur = ctx.createRadialGradient(
        bodyX - item.r * 0.25,
        bodyY - item.r * 0.3,
        item.r * 0.2,
        bodyX,
        bodyY,
        item.r * 1.25,
      );
      fur.addColorStop(0, "#f5f7fc");
      fur.addColorStop(0.55, "#c8cdd8");
      fur.addColorStop(1, "#7b808d");
      ctx.fillStyle = fur;
      ctx.beginPath();
      ctx.ellipse(bodyX, bodyY, bodyW / 2, bodyH / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = Math.max(1, item.r * 0.07);
      ctx.stroke();

      const cargo = mouse.cargo ?? null;
      if (cargo) {
        const cargoX = bodyX - item.r * 0.2;
        const cargoY = bodyY - item.r * 0.52;
        if (cargo === "diamond") {
          const size = item.r * 0.36;
          const diamondGradient = ctx.createLinearGradient(cargoX - size, cargoY - size, cargoX + size, cargoY + size);
          diamondGradient.addColorStop(0, "#e9fbff");
          diamondGradient.addColorStop(0.4, "#8fe9ff");
          diamondGradient.addColorStop(1, "#2f8aa1");
          ctx.fillStyle = diamondGradient;
          ctx.beginPath();
          ctx.moveTo(cargoX, cargoY - size);
          ctx.lineTo(cargoX + size * 0.85, cargoY);
          ctx.lineTo(cargoX, cargoY + size);
          ctx.lineTo(cargoX - size * 0.85, cargoY);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = "rgba(0,0,0,0.22)";
          ctx.lineWidth = Math.max(1, item.r * 0.055);
          ctx.stroke();

          withSavedItemShape(ctx, () => {
            ctx.globalAlpha = 0.22;
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.ellipse(
              cargoX - size * 0.18,
              cargoY - size * 0.18,
              size * 0.22,
              size * 0.16,
              -0.6,
              0,
              Math.PI * 2,
            );
            ctx.fill();
          });
        } else if (cargo === "bar") {
          const width = item.r * 0.7;
          const height = item.r * 0.38;
          const barGradient = ctx.createLinearGradient(
            cargoX - width * 0.6,
            cargoY - height * 0.6,
            cargoX + width * 0.6,
            cargoY + height * 0.6,
          );
          barGradient.addColorStop(0, "#fff6d6");
          barGradient.addColorStop(0.35, "#ffd86f");
          barGradient.addColorStop(0.7, "#f6b027");
          barGradient.addColorStop(1, "#7f4f0a");
          ctx.fillStyle = barGradient;
          roundRectPathForItemShape(ctx, cargoX - width / 2, cargoY - height / 2, width, height, 8);
          ctx.fill();
          ctx.strokeStyle = "rgba(0,0,0,0.22)";
          ctx.lineWidth = Math.max(1, item.r * 0.05);
          ctx.stroke();
        }
      }

      const headR = item.r * 0.48;
      const headX = item.r * 0.68;
      const headY = -item.r * 0.08;
      const headFur = ctx.createRadialGradient(
        headX - headR * 0.4,
        headY - headR * 0.35,
        headR * 0.2,
        headX,
        headY,
        headR * 1.25,
      );
      headFur.addColorStop(0, "#f6f8fd");
      headFur.addColorStop(0.55, "#c8cdd8");
      headFur.addColorStop(1, "#7b808d");
      ctx.fillStyle = headFur;
      ctx.beginPath();
      ctx.ellipse(headX, headY, headR, headR * 0.82, 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = Math.max(1, item.r * 0.065);
      ctx.stroke();

      const earR = headR * 0.42;
      const earY = headY - headR * 0.62;
      ctx.fillStyle = "#c0c5d0";
      ctx.beginPath();
      ctx.arc(headX - headR * 0.3, earY, earR, 0, Math.PI * 2);
      ctx.arc(headX + headR * 0.2, earY + headR * 0.05, earR * 0.92, 0, Math.PI * 2);
      ctx.fill();

      withSavedItemShape(ctx, () => {
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = "#ff9fb1";
        ctx.beginPath();
        ctx.arc(headX - headR * 0.3, earY, earR * 0.55, 0, Math.PI * 2);
        ctx.arc(headX + headR * 0.2, earY + headR * 0.05, earR * 0.5, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.fillStyle = "rgba(20,20,20,0.9)";
      ctx.beginPath();
      ctx.arc(headX + headR * 0.24, headY - headR * 0.05, Math.max(1.3, item.r * 0.07), 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ff8da1";
      ctx.beginPath();
      ctx.arc(headX + headR * 0.66, headY + headR * 0.2, Math.max(1.4, item.r * 0.08), 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(20,20,20,0.38)";
      ctx.lineWidth = Math.max(1, item.r * 0.035);
      ctx.lineCap = "round";
      for (const sign of [-1, 0, 1]) {
        const whiskerY = headY + headR * 0.2 + sign * headR * 0.12;
        ctx.beginPath();
        ctx.moveTo(headX + headR * 0.5, whiskerY);
        ctx.lineTo(headX + headR * 1.05, whiskerY - sign * headR * 0.08);
        ctx.stroke();
      }

      const footY = bodyY + bodyH * 0.52;
      const stepA = Math.sin(phase);
      const stepB = Math.sin(phase + Math.PI);
      ctx.strokeStyle = "rgba(20,20,20,0.28)";
      ctx.lineWidth = Math.max(1.2, item.r * 0.07);
      ctx.lineCap = "round";
      for (const foot of [
        { x: bodyX - bodyW * 0.25, t: stepA },
        { x: bodyX - bodyW * 0.05, t: stepB },
        { x: bodyX + bodyW * 0.15, t: stepA },
        { x: bodyX + bodyW * 0.32, t: stepB },
      ]) {
        const lift = clamp((foot.t + 1) / 2, 0, 1) * item.r * 0.08;
        ctx.beginPath();
        ctx.moveTo(foot.x, footY - lift);
        ctx.lineTo(foot.x + item.r * 0.12, footY - lift + item.r * 0.1);
        ctx.stroke();
      }

      return true;
    }

    if (item.type === "gold") {
      const goldGradient = ctx.createRadialGradient(-item.r * 0.35, -item.r * 0.55, item.r * 0.2, 0, 0, item.r * 1.35);
      goldGradient.addColorStop(0, "#fff6d6");
      goldGradient.addColorStop(0.35, "#ffd86f");
      goldGradient.addColorStop(0.7, "#f6b027");
      goldGradient.addColorStop(1, "#7f4f0a");
      ctx.fillStyle = goldGradient;
      blobPathForItemShape(ctx, art.blob ?? makeBlob(makeRng(item.id), 9, 0.8, 1.05), item.r);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.22)";
      ctx.lineWidth = Math.max(1, item.r * 0.08);
      ctx.stroke();

      const glint = 0.18 + 0.12 * Math.sin(now / 280 + (art.glint ?? 0) * 6);
      ctx.fillStyle = `rgba(255,255,255,${glint})`;
      ctx.beginPath();
      ctx.arc(-item.r * 0.28, -item.r * 0.28, Math.max(1.5, item.r * 0.22), 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(1, item.r * 0.06);
      for (const sparkle of art.sparkles ?? []) {
        const pulse = 0.55 + 0.45 * Math.sin(now / 320 + sparkle.p);
        const sparkleX = Math.cos(sparkle.a) * item.r * sparkle.d;
        const sparkleY = Math.sin(sparkle.a) * item.r * sparkle.d;
        const size = item.r * sparkle.s;
        ctx.globalAlpha = 0.35 * pulse;
        ctx.beginPath();
        ctx.moveTo(sparkleX - size, sparkleY);
        ctx.lineTo(sparkleX + size, sparkleY);
        ctx.moveTo(sparkleX, sparkleY - size);
        ctx.lineTo(sparkleX, sparkleY + size);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      return true;
    }

    if (item.type === "bar") {
      const width = item.r * 1.8;
      const height = item.r * 1.1;
      const barGradient = ctx.createLinearGradient(-width * 0.6, -height * 0.6, width * 0.6, height * 0.6);
      barGradient.addColorStop(0, "#fff3c6");
      barGradient.addColorStop(0.35, "#ffd86f");
      barGradient.addColorStop(0.7, "#f6b027");
      barGradient.addColorStop(1, "#7f4f0a");
      ctx.fillStyle = barGradient;
      roundRectPathForItemShape(ctx, -width / 2, -height / 2, width, height, 10);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.22)";
      ctx.lineWidth = Math.max(1, item.r * 0.07);
      ctx.stroke();

      withSavedItemShape(ctx, () => {
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = "#ffffff";
        roundRectPathForItemShape(ctx, -width * 0.42, -height * 0.32, width * 0.84, height * 0.38, 8);
        ctx.fill();
      });

      withSavedItemShape(ctx, () => {
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.font = `700 ${Math.max(10, Math.floor(item.r * 0.55))}px ui-sans-serif, system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Au", 0, item.r * 0.06);
      });

      const shine = 0.12 + 0.14 * Math.sin(now / 300 + (art.shine ?? 0) * 6);
      withSavedItemShape(ctx, () => {
        ctx.globalAlpha = shine;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(-width * 0.18, -height * 0.1, width * 0.22, height * 0.18, -0.6, 0, Math.PI * 2);
        ctx.fill();
      });

      return true;
    }

    if (item.type === "rock") {
      const tint = art.tint ?? 0;
      const light = clamp(56 + tint * 26, 40, 68);
      const dark = clamp(28 + tint * 20, 18, 38);
      const rockGradient = ctx.createRadialGradient(-item.r * 0.25, -item.r * 0.35, item.r * 0.2, 0, 0, item.r * 1.25);
      rockGradient.addColorStop(0, `hsl(220, 10%, ${light}%)`);
      rockGradient.addColorStop(1, `hsl(220, 10%, ${dark}%)`);
      ctx.fillStyle = rockGradient;
      blobPathForItemShape(ctx, art.blob ?? makeBlob(makeRng(item.id), 8, 0.82, 1.12), item.r);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.28)";
      ctx.lineWidth = Math.max(1, item.r * 0.07);
      ctx.stroke();

      ctx.fillStyle = "rgba(0,0,0,0.22)";
      for (const speck of art.specks ?? []) {
        ctx.globalAlpha = speck.a;
        ctx.beginPath();
        ctx.arc(speck.x * item.r, speck.y * item.r, Math.max(0.8, speck.r * item.r), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      return true;
    }

    if (item.type === "diamond") {
      const twinkle = 0.65 + 0.35 * Math.sin(now / 360 + (art.twinkle ?? 0));
      const diamondGradient = ctx.createLinearGradient(-item.r, -item.r, item.r, item.r);
      diamondGradient.addColorStop(0, "rgba(215, 252, 255, 0.95)");
      diamondGradient.addColorStop(0.55, "rgba(120, 231, 255, 0.95)");
      diamondGradient.addColorStop(1, "rgba(45, 130, 155, 0.95)");
      ctx.fillStyle = diamondGradient;
      ctx.beginPath();
      ctx.moveTo(0, -item.r * 1.25);
      ctx.lineTo(item.r * 0.95, -item.r * 0.15);
      ctx.lineTo(item.r * 0.7, item.r * 0.95);
      ctx.lineTo(0, item.r * 1.22);
      ctx.lineTo(-item.r * 0.7, item.r * 0.95);
      ctx.lineTo(-item.r * 0.95, -item.r * 0.15);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${0.22 * twinkle})`;
      ctx.lineWidth = Math.max(1, item.r * 0.06);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.14 * twinkle})`;
      ctx.lineWidth = Math.max(1, item.r * 0.03);
      ctx.beginPath();
      ctx.moveTo(0, -item.r * 1.25);
      ctx.lineTo(0, item.r * 1.22);
      ctx.moveTo(-item.r * 0.7, item.r * 0.95);
      ctx.lineTo(item.r * 0.7, item.r * 0.95);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.38 * twinkle})`;
      ctx.lineWidth = Math.max(1, item.r * 0.05);
      ctx.beginPath();
      ctx.moveTo(item.r * 0.35, -item.r * 0.55);
      ctx.lineTo(item.r * 0.35, -item.r * 0.12);
      ctx.moveTo(item.r * 0.13, -item.r * 0.33);
      ctx.lineTo(item.r * 0.57, -item.r * 0.33);
      ctx.stroke();
      return true;
    }

    if (item.type === "emerald" || item.type === "ruby") {
      const isRuby = item.type === "ruby";
      const twinkle = 0.65 + 0.35 * Math.sin(now / 340 + (art.twinkle ?? 0));
      const emeraldGradient = ctx.createLinearGradient(-item.r, -item.r, item.r, item.r);
      emeraldGradient.addColorStop(0, isRuby ? "rgba(255, 200, 215, 0.95)" : "rgba(210, 255, 235, 0.95)");
      emeraldGradient.addColorStop(0.55, isRuby ? "rgba(255, 80, 115, 0.95)" : "rgba(52, 226, 138, 0.95)");
      emeraldGradient.addColorStop(1, isRuby ? "rgba(120, 20, 40, 0.95)" : "rgba(18, 95, 55, 0.95)");
      ctx.fillStyle = emeraldGradient;
      ctx.beginPath();
      ctx.moveTo(0, -item.r * 1.25);
      ctx.lineTo(item.r * 0.95, -item.r * 0.45);
      ctx.lineTo(item.r * 1.1, item.r * 0.25);
      ctx.lineTo(item.r * 0.6, item.r * 1.05);
      ctx.lineTo(0, item.r * 1.22);
      ctx.lineTo(-item.r * 0.6, item.r * 1.05);
      ctx.lineTo(-item.r * 1.1, item.r * 0.25);
      ctx.lineTo(-item.r * 0.95, -item.r * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${0.22 * twinkle})`;
      ctx.lineWidth = Math.max(1, item.r * 0.06);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.14 * twinkle})`;
      ctx.lineWidth = Math.max(1, item.r * 0.03);
      ctx.beginPath();
      ctx.moveTo(0, -item.r * 1.25);
      ctx.lineTo(0, item.r * 1.22);
      ctx.moveTo(-item.r * 0.6, item.r * 1.05);
      ctx.lineTo(item.r * 0.6, item.r * 1.05);
      ctx.moveTo(-item.r * 1.1, item.r * 0.25);
      ctx.lineTo(item.r * 1.1, item.r * 0.25);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.32 * twinkle})`;
      ctx.lineWidth = Math.max(1, item.r * 0.05);
      ctx.beginPath();
      ctx.moveTo(item.r * 0.25, -item.r * 0.62);
      ctx.lineTo(item.r * 0.25, -item.r * 0.18);
      ctx.moveTo(item.r * 0.03, -item.r * 0.4);
      ctx.lineTo(item.r * 0.47, -item.r * 0.4);
      ctx.stroke();
      return true;
    }

    if (item.type === "crystal") {
      const twinkle = 0.65 + 0.35 * Math.sin(now / 320 + (art.twinkle ?? 0));

      withSavedItemShape(ctx, () => {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.12 * twinkle;
        const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, item.r * 1.6);
        glow.addColorStop(0, "rgba(166, 246, 255, 0.95)");
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, item.r * 1.6, 0, Math.PI * 2);
        ctx.fill();
      });

      for (const spike of art.dirs ?? []) {
        const angle = spike.a ?? 0;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const len = item.r * (spike.h ?? 1);
        const halfW = item.r * (spike.w ?? 0.25);
        const baseX = cos * item.r * 0.12;
        const baseY = sin * item.r * 0.12;
        const tipX = baseX + cos * len;
        const tipY = baseY + sin * len;
        const perpX = -sin * halfW;
        const perpY = cos * halfW;
        const crystalGradient = ctx.createLinearGradient(baseX, baseY, tipX, tipY);
        crystalGradient.addColorStop(0, "rgba(220, 252, 255, 0.95)");
        crystalGradient.addColorStop(0.55, "rgba(120, 231, 255, 0.95)");
        crystalGradient.addColorStop(1, "rgba(45, 130, 155, 0.95)");
        ctx.fillStyle = crystalGradient;
        ctx.beginPath();
        ctx.moveTo(baseX + perpX, baseY + perpY);
        ctx.lineTo(tipX, tipY);
        ctx.lineTo(baseX - perpX, baseY - perpY);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = `rgba(255,255,255,${0.18 * twinkle})`;
        ctx.lineWidth = Math.max(1, item.r * 0.04);
        ctx.stroke();
      }

      const core = ctx.createRadialGradient(-item.r * 0.2, -item.r * 0.35, item.r * 0.2, 0, 0, item.r * 1.1);
      core.addColorStop(0, "rgba(235, 255, 255, 0.95)");
      core.addColorStop(0.55, "rgba(140, 238, 255, 0.95)");
      core.addColorStop(1, "rgba(45, 120, 150, 0.95)");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.ellipse(0, item.r * 0.1, item.r * 0.78, item.r * 0.64, 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${0.16 * twinkle})`;
      ctx.lineWidth = Math.max(1, item.r * 0.04);
      ctx.stroke();
      return true;
    }

    if (item.type === "pouch") {
      const jiggle = 0.5 + 0.5 * Math.sin(now / 520 + (art.jiggle ?? 0));
      const pouchGradient = ctx.createRadialGradient(-item.r * 0.25, -item.r * 0.45, item.r * 0.2, 0, 0, item.r * 1.35);
      pouchGradient.addColorStop(0, "#f1d2a5");
      pouchGradient.addColorStop(0.5, "#c28a50");
      pouchGradient.addColorStop(1, "#4a2413");
      ctx.fillStyle = pouchGradient;
      ctx.beginPath();
      ctx.moveTo(-item.r * 0.62, -item.r * 0.15);
      ctx.quadraticCurveTo(-item.r * 0.95, item.r * 0.35, -item.r * 0.36, item.r * 0.82);
      ctx.quadraticCurveTo(0, item.r * 1.08, item.r * 0.36, item.r * 0.82);
      ctx.quadraticCurveTo(item.r * 0.95, item.r * 0.35, item.r * 0.62, -item.r * 0.15);
      ctx.quadraticCurveTo(0, -item.r * 0.78, -item.r * 0.62, -item.r * 0.15);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.28)";
      ctx.lineWidth = Math.max(1, item.r * 0.07);
      ctx.stroke();

      withSavedItemShape(ctx, () => {
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = "#6b3f24";
        ctx.beginPath();
        ctx.ellipse(0, -item.r * 0.22, item.r * 0.68, item.r * 0.26, 0, 0, Math.PI * 2);
        ctx.fill();
        const coinCount = art.coins ?? 3;
        for (let index = 0; index < coinCount; index += 1) {
          const angle = (index / Math.max(1, coinCount)) * Math.PI * 2 + (art.seam ?? 0) * 4;
          const coinX = Math.cos(angle) * item.r * 0.34;
          const coinY = -item.r * 0.3 + Math.sin(angle) * item.r * 0.1;
          const radius = item.r * (0.16 + 0.03 * jiggle);
          const coinGradient = ctx.createRadialGradient(coinX - radius * 0.3, coinY - radius * 0.35, radius * 0.2, coinX, coinY, radius);
          coinGradient.addColorStop(0, "#fff3c6");
          coinGradient.addColorStop(0.6, "#ffd34d");
          coinGradient.addColorStop(1, "#9a6a12");
          ctx.fillStyle = coinGradient;
          ctx.beginPath();
          ctx.arc(coinX, coinY, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "rgba(0,0,0,0.22)";
          ctx.lineWidth = Math.max(1, item.r * 0.03);
          ctx.stroke();
        }
      });

      withSavedItemShape(ctx, () => {
        ctx.globalAlpha = 0.16 + 0.12 * jiggle;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(-item.r * 0.22, -item.r * 0.08, item.r * 0.22, item.r * 0.16, -0.6, 0, Math.PI * 2);
        ctx.fill();
      });

      return true;
    }

    if (item.type === "keg") {
      const stage = item.keg?.stage ?? "idle";
      const fusePulse = 0.55 + 0.45 * Math.sin(now / 90 + (art.fuse ?? 0));
      const width = item.r * 1.2;
      const height = item.r * 1.55;
      const kegGradient = ctx.createLinearGradient(-width * 0.6, -height * 0.6, width * 0.6, height * 0.6);
      kegGradient.addColorStop(0, "#ffb38a");
      kegGradient.addColorStop(0.35, "#ff6b5a");
      kegGradient.addColorStop(1, "#6d1414");
      ctx.fillStyle = kegGradient;
      roundRectPathForItemShape(ctx, -width / 2, -height / 2, width, height, 12);
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      roundRectPathForItemShape(ctx, -width * 0.55, -height * 0.28, width * 1.1, height * 0.18, 10);
      ctx.fill();
      roundRectPathForItemShape(ctx, -width * 0.55, height * 0.1, width * 1.1, height * 0.18, 10);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      roundRectPathForItemShape(ctx, -width * 0.52, -height * 0.26, width * 1.04, height * 0.08, 8);
      ctx.fill();

      withSavedItemShape(ctx, () => {
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = "rgba(255, 230, 190, 0.92)";
        ctx.beginPath();
        ctx.moveTo(0, -item.r * 0.15);
        ctx.lineTo(item.r * 0.28, item.r * 0.38);
        ctx.lineTo(-item.r * 0.28, item.r * 0.38);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(120, 20, 20, 0.9)";
        ctx.font = `900 ${Math.max(11, Math.floor(item.r * 0.8))}px ui-sans-serif, system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("!", 0, item.r * 0.18);
      });

      ctx.strokeStyle = "rgba(0,0,0,0.28)";
      ctx.lineWidth = Math.max(1, item.r * 0.07);
      ctx.stroke();

      withSavedItemShape(ctx, () => {
        ctx.translate(width * 0.18, -height * 0.46);
        ctx.rotate(-0.7);
        ctx.strokeStyle = "rgba(20,20,20,0.65)";
        ctx.lineWidth = 3.2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(6, -6, 16, -4);
        ctx.stroke();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = (stage === "pull" ? 0.18 : 0.12) + 0.18 * fusePulse;
        const spark = ctx.createRadialGradient(16, -4, 1, 16, -4, 18);
        spark.addColorStop(0, "rgba(255, 241, 196, 0.95)");
        spark.addColorStop(0.45, "rgba(255, 211, 77, 0.75)");
        spark.addColorStop(0.75, "rgba(255, 77, 77, 0.65)");
        spark.addColorStop(1, "rgba(255, 77, 77, 0)");
        ctx.fillStyle = spark;
        ctx.beginPath();
        ctx.arc(16, -4, 18, 0, Math.PI * 2);
        ctx.fill();
      });

      return true;
    }

    if (item.type === "fossil") {
      const tint = art.tint ?? 0;
      const light = clamp(78 + tint * 18, 68, 90);
      const dark = clamp(48 + tint * 14, 36, 62);
      const fossilGradient = ctx.createRadialGradient(-item.r * 0.35, -item.r * 0.55, item.r * 0.2, 0, 0, item.r * 1.45);
      fossilGradient.addColorStop(0, `hsl(38, 40%, ${light}%)`);
      fossilGradient.addColorStop(1, `hsl(32, 30%, ${dark}%)`);
      ctx.fillStyle = fossilGradient;

      const len = item.r * 1.35;
      const boneW = item.r * 0.52;
      const leftX = -len * 0.45;
      const rightX = len * 0.45;
      const endR = boneW * 0.42;

      const drawBoneFill = () => {
        roundRectPathForItemShape(ctx, leftX, -boneW * 0.35, len * 0.9, boneW * 0.7, boneW * 0.35);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(leftX, -boneW * 0.22, endR, 0, Math.PI * 2);
        ctx.arc(leftX, boneW * 0.22, endR, 0, Math.PI * 2);
        ctx.arc(rightX, -boneW * 0.22, endR, 0, Math.PI * 2);
        ctx.arc(rightX, boneW * 0.22, endR, 0, Math.PI * 2);
        ctx.fill();
      };

      drawBoneFill();
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = Math.max(1, item.r * 0.07);
      ctx.stroke();

      withSavedItemShape(ctx, () => {
        ctx.strokeStyle = "rgba(0,0,0,0.22)";
        ctx.lineWidth = Math.max(1, item.r * 0.04);
        ctx.lineCap = "round";
        for (const crack of art.cracks ?? []) {
          const angle = crack.a ?? 0;
          const distance = (crack.d ?? 0.3) * item.r;
          const len = (crack.l ?? 0.5) * item.r;
          const x0 = Math.cos(angle) * distance;
          const y0 = Math.sin(angle) * distance;
          const x1 = x0 + Math.cos(angle + 0.7) * len * 0.55;
          const y1 = y0 + Math.sin(angle + 0.7) * len * 0.55;
          const x2 = x0 + Math.cos(angle - 0.6) * len;
          const y2 = y0 + Math.sin(angle - 0.6) * len;
          ctx.globalAlpha = 0.18;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x0, y0);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      });

      withSavedItemShape(ctx, () => {
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(-item.r * 0.18, -item.r * 0.08, item.r * 0.28, item.r * 0.18, -0.7, 0, Math.PI * 2);
        ctx.fill();
      });

      return true;
    }

    const bagGradient = ctx.createRadialGradient(-item.r * 0.25, -item.r * 0.4, item.r * 0.2, 0, 0, item.r * 1.35);
    bagGradient.addColorStop(0, "#dcc7ff");
    bagGradient.addColorStop(0.5, "#b07bff");
    bagGradient.addColorStop(1, "#4b1e7a");
    ctx.fillStyle = bagGradient;
    ctx.beginPath();
    ctx.moveTo(-item.r * 0.55, -item.r * 0.25);
    ctx.quadraticCurveTo(-item.r * 0.85, item.r * 0.25, -item.r * 0.35, item.r * 0.75);
    ctx.quadraticCurveTo(0, item.r * 1.05, item.r * 0.35, item.r * 0.75);
    ctx.quadraticCurveTo(item.r * 0.85, item.r * 0.25, item.r * 0.55, -item.r * 0.25);
    ctx.quadraticCurveTo(0, -item.r * 0.8, -item.r * 0.55, -item.r * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.28)";
    ctx.lineWidth = Math.max(1, item.r * 0.07);
    ctx.stroke();
    ctx.fillStyle = "#6a3a9e";
    ctx.beginPath();
    ctx.ellipse(0, -item.r * 0.28, item.r * 0.55, item.r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.beginPath();
    ctx.ellipse(-item.r * 0.15, -item.r * 0.33, item.r * 0.32, item.r * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = `${Math.max(10, Math.floor(item.r * 1.15))}px ui-sans-serif, system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", 0, item.r * 0.2);
    return true;
  });
}

function drawItem(item, metadata) {
  const options = itemShapeLayerOptions(item, metadata);

  if (!itemShapeLayerBridgeDisabled && GoldMinerModules.drawItemShape) {
    try {
      return GoldMinerModules.drawItemShape(options);
    } catch (error) {
      itemShapeLayerBridgeDisabled = true;
      if (!Object.prototype.hasOwnProperty.call(window, "__goldMinerItemShapeRendererError")) {
        window.__goldMinerItemShapeRendererError = error instanceof Error ? error.message : String(error);
      }
      console.warn("Gold Miner item shape renderer failed; using local item shape fallback.", error);
    }
  }

  return drawItemWithLocalLayer(options);
}

function hookTrailLayerOptions(hook = game.hook) {
  const item = attachedItem(hook);
  return {
    ctx,
    trail: hook.trail,
    color: item ? itemFxColor(item) : "rgba(255,255,255,0.85)",
    life: 0.55,
  };
}

function drawHookTrailWithLocalLayer(options = hookTrailLayerOptions()) {
  const { ctx: trailCtx, trail, color, life } = options;
  if (trail.length < 2) return 0;

  trailCtx.save();
  try {
    trailCtx.globalCompositeOperation = "lighter";
    trailCtx.lineCap = "round";
    trailCtx.lineJoin = "round";

    for (let i = 0; i < trail.length - 1; i += 1) {
      const p0 = trail[i];
      const p1 = trail[i + 1];
      const t = clamp(1 - p0.age / life, 0, 1);
      const a = 0.08 + 0.22 * t;
      trailCtx.globalAlpha = a * t;
      trailCtx.strokeStyle = color;
      trailCtx.lineWidth = lerp(1.2, 6.0, t);
      trailCtx.beginPath();
      trailCtx.moveTo(p0.x, p0.y);
      trailCtx.lineTo(p1.x, p1.y);
      trailCtx.stroke();

      trailCtx.globalAlpha = a * 0.55 * t;
      trailCtx.strokeStyle = "rgba(255,255,255,0.9)";
      trailCtx.lineWidth = lerp(0.7, 2.4, t);
      trailCtx.beginPath();
      trailCtx.moveTo(p0.x, p0.y);
      trailCtx.lineTo(p1.x, p1.y);
      trailCtx.stroke();
    }
  } finally {
    trailCtx.restore();
  }

  return trail.length - 1;
}

function drawHookTrail(hook = game.hook) {
  const options = hookTrailLayerOptions(hook);

  if (!hookTrailLayerBridgeDisabled && GoldMinerModules.drawHookTrailLayer) {
    try {
      return GoldMinerModules.drawHookTrailLayer(options);
    } catch (error) {
      hookTrailLayerBridgeDisabled = true;
      if (!Object.prototype.hasOwnProperty.call(window, "__goldMinerHookTrailRendererError")) {
        window.__goldMinerHookTrailRendererError = error instanceof Error ? error.message : String(error);
      }
      console.warn("Gold Miner hook trail renderer failed; using local hook trail fallback.", error);
    }
  }

  return drawHookTrailWithLocalLayer(options);
}

function carryLabelLayerOptions(hook = game.hook) {
  if (game.phase !== "playing") return null;
  if (hook.state !== "retract") return null;
  const item = attachedItem(hook);
  if (!item) return null;

  return {
    ctx,
    end: getHookEnd(hook),
    viewport: game.viewport,
    color: itemFxColor(item),
    text: item.type === "bag" ? "?" : item.type === "keg" ? "!!" : `${item.value}`,
  };
}

function roundRectPathForCarryLabel(labelCtx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  labelCtx.beginPath();
  labelCtx.moveTo(x + rr, y);
  labelCtx.arcTo(x + w, y, x + w, y + h, rr);
  labelCtx.arcTo(x + w, y + h, x, y + h, rr);
  labelCtx.arcTo(x, y + h, x, y, rr);
  labelCtx.arcTo(x, y, x + w, y, rr);
  labelCtx.closePath();
}

function drawCarryLabelWithLocalLayer(options = carryLabelLayerOptions()) {
  if (!options) return false;
  const { ctx: labelCtx, end, viewport, color, text } = options;

  labelCtx.save();
  try {
    labelCtx.font = "700 12px ui-sans-serif, system-ui";
    labelCtx.textAlign = "left";
    labelCtx.textBaseline = "middle";

    const paddingX = 10;
    const dot = 10;
    const textW = labelCtx.measureText(text).width;
    const w = dot + 8 + textW + paddingX * 2;
    const h = 22;

    let x = end.x + 16;
    let y = end.y - 42;
    x = clamp(x, 8, viewport.w - w - 8);
    y = clamp(y, 8, viewport.h - h - 8);

    // Glow tint
    labelCtx.globalAlpha = 0.16;
    labelCtx.fillStyle = color;
    roundRectPathForCarryLabel(labelCtx, x, y, w, h, 12);
    labelCtx.fill();

    // Panel
    labelCtx.globalAlpha = 0.92;
    labelCtx.fillStyle = "rgba(0,0,0,0.48)";
    roundRectPathForCarryLabel(labelCtx, x, y, w, h, 12);
    labelCtx.fill();
    labelCtx.strokeStyle = "rgba(255,255,255,0.14)";
    labelCtx.lineWidth = 1;
    labelCtx.stroke();

    // Dot
    labelCtx.globalAlpha = 0.92;
    labelCtx.fillStyle = color;
    labelCtx.beginPath();
    labelCtx.arc(x + paddingX + dot / 2, y + h / 2, dot / 2, 0, Math.PI * 2);
    labelCtx.fill();
    labelCtx.globalAlpha = 0.35;
    labelCtx.fillStyle = "#ffffff";
    labelCtx.beginPath();
    labelCtx.arc(x + paddingX + dot / 2 - 1.2, y + h / 2 - 1.2, 1.8, 0, Math.PI * 2);
    labelCtx.fill();

    // Text
    labelCtx.globalAlpha = 0.9;
    labelCtx.fillStyle = "rgba(255,255,255,0.9)";
    labelCtx.fillText(text, x + paddingX + dot + 8, y + h / 2);
  } finally {
    labelCtx.restore();
  }

  return true;
}

function drawCarryLabel(hook = game.hook) {
  const options = carryLabelLayerOptions(hook);
  if (!options) return false;

  if (!carryLabelLayerBridgeDisabled && GoldMinerModules.drawCarryLabelLayer) {
    try {
      return GoldMinerModules.drawCarryLabelLayer(options);
    } catch (error) {
      carryLabelLayerBridgeDisabled = true;
      if (!Object.prototype.hasOwnProperty.call(window, "__goldMinerCarryLabelRendererError")) {
        window.__goldMinerCarryLabelRendererError = error instanceof Error ? error.message : String(error);
      }
      console.warn("Gold Miner carry label renderer failed; using local carry label fallback.", error);
    }
  }

  return drawCarryLabelWithLocalLayer(options);
}

function hookShapeLayerOptions(hook = game.hook) {
  const carriedItem = attachedItem(hook);
  return {
    ctx,
    hook,
    pivot: getPivot(hook),
    tip: getHookEnd(hook),
    dir: getHookDir(hook.angle),
    carriedItem,
    canBomb:
      game.phase === "playing" &&
      !game.paused &&
      game.inventory.bombs > 0 &&
      hook.state === "retract" &&
      !!carriedItem,
    hookConfig: HOOK,
    now: performance.now(),
    itemGlowColor: carriedItem ? itemFxColor(carriedItem) : null,
    artAssets: crayonArtAssets(),
  };
}

function roundRectPathForHookShape(hookCtx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  hookCtx.beginPath();
  hookCtx.moveTo(x + rr, y);
  hookCtx.arcTo(x + w, y, x + w, y + h, rr);
  hookCtx.arcTo(x + w, y + h, x, y + h, rr);
  hookCtx.arcTo(x, y + h, x, y, rr);
  hookCtx.arcTo(x, y, x + w, y, rr);
  hookCtx.closePath();
}

function drawHookWithLocalLayer(options = hookShapeLayerOptions()) {
  const {
    ctx: hookCtx,
    hook,
    pivot,
    tip,
    dir,
    carriedItem,
    canBomb,
    hookConfig,
    now,
    itemGlowColor,
  } = options;
  const ring = { x: tip.x - dir.x * hookConfig.ringToTip, y: tip.y - dir.y * hookConfig.ringToTip };

  hookCtx.save();
  try {
    const perp = { x: dir.y, y: -dir.x };
    const ropeLen = Math.max(0, hook.length - hookConfig.ringToTip);
    const t = clamp(hook.length / Math.max(1, hook.maxLength), 0, 1);
    const sway = (hook.state === "swing" ? 18 : 8) * (0.25 + 0.75 * t);
    const wobble = Math.sin(now / 260 + hook.angle * 1.7);
    const cx = pivot.x + dir.x * (ropeLen * 0.48 + hookConfig.ringToTip * 0.08) + perp.x * sway * wobble;
    const cy = pivot.y + dir.y * (ropeLen * 0.48 + hookConfig.ringToTip * 0.08) + perp.y * sway * wobble;

    hookCtx.lineCap = "round";
    hookCtx.lineJoin = "round";

    hookCtx.strokeStyle = "rgba(0,0,0,0.35)";
    hookCtx.lineWidth = 4;
    hookCtx.beginPath();
    hookCtx.moveTo(pivot.x, pivot.y);
    hookCtx.quadraticCurveTo(cx, cy, ring.x, ring.y);
    hookCtx.stroke();

    const ropeGrad = hookCtx.createLinearGradient(pivot.x, pivot.y, ring.x, ring.y);
    ropeGrad.addColorStop(0, "rgba(255,255,255,0.95)");
    ropeGrad.addColorStop(1, "rgba(255,255,255,0.55)");
    hookCtx.strokeStyle = ropeGrad;
    hookCtx.lineWidth = 2.2;
    hookCtx.beginPath();
    hookCtx.moveTo(pivot.x, pivot.y);
    hookCtx.quadraticCurveTo(cx, cy, ring.x, ring.y);
    hookCtx.stroke();

    // Rope motion hint (moving dashes)
    if (hook.state !== "swing") {
      hookCtx.save();
      try {
        hookCtx.globalAlpha = 0.22;
        hookCtx.strokeStyle = "rgba(255,255,255,0.85)";
        hookCtx.lineWidth = 1.2;
        hookCtx.setLineDash([6, 12]);
        hookCtx.lineDashOffset = -hook.reelAngle * 12;
        hookCtx.beginPath();
        hookCtx.moveTo(pivot.x, pivot.y);
        hookCtx.quadraticCurveTo(cx, cy, ring.x, ring.y);
        hookCtx.stroke();
      } finally {
        hookCtx.restore();
      }
    }

    hookCtx.fillStyle = "rgba(255,255,255,0.9)";
    hookCtx.beginPath();
    hookCtx.arc(pivot.x, pivot.y, 5.5, 0, Math.PI * 2);
    hookCtx.fill();
    hookCtx.fillStyle = "rgba(0,0,0,0.25)";
    hookCtx.beginPath();
    hookCtx.arc(pivot.x + 1.4, pivot.y + 1.2, 2.1, 0, Math.PI * 2);
    hookCtx.fill();

    hookCtx.translate(ring.x, ring.y);
    const theta = Math.atan2(dir.y, dir.x);
    hookCtx.rotate(theta - Math.PI / 2);

    const close = clamp(hook.clawClose ?? 0, 0, 1);
    const sizeR = carriedItem ? carriedItem.r : 0;
    const sizeT = clamp((sizeR - 11) / 30, 0, 1); // ~diamond -> large gold
    const closeLimit = lerp(1, 0.58, sizeT); // bigger item => leave more gap
    const gripClose = close * closeLimit;

    // ---- Claw (fully redesigned; inward-curling tri-prong) ----
    const baseY = hookConfig.jawBase;
    const tipY = hookConfig.ringToTip;
    const jawLen = Math.max(10, tipY - baseY);

    const open = 1 - close;
    const wob = Math.sin(now / 160 + hook.angle * 1.4);

    const spread = lerp(16.2, 3.9, gripClose) * (1 + 0.03 * open * wob);
    const baseSpread = lerp(7.6, 4.4, gripClose);
    const curlIn = lerp(9.4, 3.1, gripClose);

    const metal = hookCtx.createLinearGradient(-14, -12, 14, 64);
    metal.addColorStop(0, "#fbfbfb");
    metal.addColorStop(0.22, "#d6d6d6");
    metal.addColorStop(0.55, "#f4f4f4");
    metal.addColorStop(1, "#7a7a7a");

    const outline = "rgba(0,0,0,0.42)";
    const highlight = "rgba(255,255,255,0.18)";

    const strokeMetal = (makePath, shadowW, metalW) => {
      hookCtx.lineCap = "round";
      hookCtx.lineJoin = "round";

      hookCtx.strokeStyle = outline;
      hookCtx.lineWidth = shadowW;
      makePath();
      hookCtx.stroke();

      hookCtx.strokeStyle = metal;
      hookCtx.lineWidth = metalW;
      makePath();
      hookCtx.stroke();

      hookCtx.save();
      try {
        hookCtx.globalAlpha = 0.85;
        hookCtx.strokeStyle = highlight;
        hookCtx.lineWidth = Math.max(1.2, metalW * 0.32);
        makePath();
        hookCtx.stroke();
      } finally {
        hookCtx.restore();
      }
    };

    // Ring
    hookCtx.save();
    try {
      hookCtx.strokeStyle = outline;
      hookCtx.lineWidth = 6.2;
      hookCtx.beginPath();
      hookCtx.arc(0, 0, 6.4, 0, Math.PI * 2);
      hookCtx.stroke();
      hookCtx.strokeStyle = metal;
      hookCtx.lineWidth = 4.4;
      hookCtx.beginPath();
      hookCtx.arc(0, 0, 6.4, 0, Math.PI * 2);
      hookCtx.stroke();
      hookCtx.strokeStyle = highlight;
      hookCtx.lineWidth = 1.6;
      hookCtx.globalAlpha = 0.55;
      hookCtx.beginPath();
      hookCtx.arc(0, 0, 5.1, Math.PI * 1.08, Math.PI * 1.42);
      hookCtx.stroke();
    } finally {
      hookCtx.restore();
    }

    // Stem + swivel
    strokeMetal(
      () => {
        hookCtx.beginPath();
        hookCtx.moveTo(0, 7);
        hookCtx.lineTo(0, baseY - 4);
      },
      6.4,
      4.6
    );

    hookCtx.save();
    try {
      hookCtx.translate(0, baseY - 7.5);
      hookCtx.fillStyle = metal;
      roundRectPathForHookShape(hookCtx, -9, -5.5, 18, 11, 5.5);
      hookCtx.fill();
      hookCtx.strokeStyle = outline;
      hookCtx.lineWidth = 1.2;
      hookCtx.stroke();
      hookCtx.fillStyle = "rgba(0,0,0,0.20)";
      hookCtx.beginPath();
      hookCtx.arc(0, 0.2, 2.1, 0, Math.PI * 2);
      hookCtx.fill();
    } finally {
      hookCtx.restore();
    }

    // Prongs (center prong is the lowest point at x=0)
    hookCtx.save();
    try {
      hookCtx.translate(0, baseY);

      const sideOuterY = jawLen * 0.78;
      const sideHookY = jawLen * 0.92;
      const centerHookY = jawLen;

      const drawSideProng = (sign) => {
        const baseX = sign * baseSpread;
        const outerX = sign * spread;
        const inside = Math.max(0.15, spread - curlIn);
        const hookX = sign * inside;

        const cp1x = sign * (baseSpread + 5.2);
        const cp1y = jawLen * 0.22;
        const cp2x = sign * (spread + 4.6);
        const cp2y = jawLen * 0.56;
        const curlCx = sign * (spread + 2.2);
        const curlCy = jawLen * 0.9;

        const path = () => {
          hookCtx.beginPath();
          hookCtx.moveTo(baseX, 0);
          hookCtx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, outerX, sideOuterY);
          hookCtx.quadraticCurveTo(curlCx, curlCy, hookX, sideHookY);
        };

        strokeMetal(path, 7.0, 5.0);

        // Inner grip pad near the hook tip
        hookCtx.save();
        try {
          hookCtx.fillStyle = "rgba(20,20,20,0.30)";
          hookCtx.beginPath();
          hookCtx.ellipse(hookX + sign * 1.15, sideHookY - 0.9, 3.0, 2.1, sign * 0.22, 0, Math.PI * 2);
          hookCtx.fill();
          hookCtx.fillStyle = "rgba(255,255,255,0.14)";
          hookCtx.beginPath();
          hookCtx.ellipse(hookX + sign * 0.45, sideHookY - 1.6, 1.2, 0.9, 0, 0, Math.PI * 2);
          hookCtx.fill();
        } finally {
          hookCtx.restore();
        }
      };

      const drawCenterProng = () => {
        const sway = 0.9 * open * Math.sin(now / 220 + hook.angle * 1.3);
        const path = () => {
          hookCtx.beginPath();
          hookCtx.moveTo(0, 0);
          hookCtx.bezierCurveTo(-1.6 + sway, jawLen * 0.22, 1.4 - sway, jawLen * 0.58, 0, jawLen * 0.86);
          hookCtx.quadraticCurveTo(0, jawLen * 0.96, 0, centerHookY);
        };
        strokeMetal(path, 7.4, 5.4);

        // Small tip barb
        hookCtx.save();
        try {
          hookCtx.fillStyle = metal;
          hookCtx.beginPath();
          hookCtx.moveTo(0, centerHookY + 0.5);
          hookCtx.lineTo(-2.3, centerHookY - 3.0);
          hookCtx.lineTo(2.3, centerHookY - 3.0);
          hookCtx.closePath();
          hookCtx.fill();
          hookCtx.strokeStyle = outline;
          hookCtx.lineWidth = 1;
          hookCtx.stroke();
        } finally {
          hookCtx.restore();
        }
      };

      drawSideProng(-1);
      drawSideProng(1);
      drawCenterProng();
    } finally {
      hookCtx.restore();
    }

    // Hub (covers prong roots)
    hookCtx.save();
    try {
      hookCtx.translate(0, baseY - 1.2);
      hookCtx.fillStyle = metal;
      hookCtx.beginPath();
      hookCtx.arc(0, 0, 7.6, 0, Math.PI * 2);
      hookCtx.fill();
      hookCtx.strokeStyle = outline;
      hookCtx.lineWidth = 1.2;
      hookCtx.stroke();
      hookCtx.fillStyle = "rgba(0,0,0,0.18)";
      hookCtx.beginPath();
      hookCtx.arc(-2.2, -1.8, 1.5, 0, Math.PI * 2);
      hookCtx.arc(2.4, 1.6, 1.3, 0, Math.PI * 2);
      hookCtx.fill();
    } finally {
      hookCtx.restore();
    }

    // Tip glow while carrying (and bomb fuse hint)
    if (carriedItem && hook.state === "retract") {
      hookCtx.save();
      try {
        hookCtx.globalCompositeOperation = "lighter";
        hookCtx.globalAlpha = 0.18;
        const g = hookCtx.createRadialGradient(0, tipY + 1, 2, 0, tipY + 1, 34);
        g.addColorStop(0, itemGlowColor);
        g.addColorStop(1, "rgba(0,0,0,0)");
        hookCtx.fillStyle = g;
        hookCtx.beginPath();
        hookCtx.arc(0, tipY + 1, 34, 0, Math.PI * 2);
        hookCtx.fill();
      } finally {
        hookCtx.restore();
      }
    }

    if (canBomb) {
      const flicker = 0.55 + 0.45 * Math.sin(now / 90);
      hookCtx.save();
      try {
        hookCtx.globalCompositeOperation = "lighter";
        const flame = hookCtx.createRadialGradient(0, tipY + 2.5, 1, 0, tipY + 2.5, 20);
        flame.addColorStop(0, "rgba(255, 241, 196, 0.95)");
        flame.addColorStop(0.45, "rgba(255, 211, 77, 0.75)");
        flame.addColorStop(0.75, "rgba(255, 77, 77, 0.65)");
        flame.addColorStop(1, "rgba(255, 77, 77, 0)");
        hookCtx.globalAlpha = 0.75 * flicker;
        hookCtx.fillStyle = flame;
        hookCtx.beginPath();
        hookCtx.arc(0, tipY + 2.5, 20, 0, Math.PI * 2);
        hookCtx.fill();

        hookCtx.strokeStyle = "rgba(255,255,255,0.55)";
        hookCtx.lineWidth = 2;
        hookCtx.lineCap = "round";
        hookCtx.globalAlpha = 0.42 * flicker;
        hookCtx.beginPath();
        hookCtx.moveTo(-4, tipY + 2.5);
        hookCtx.lineTo(4, tipY + 2.5);
        hookCtx.moveTo(0, tipY - 1.5);
        hookCtx.lineTo(0, tipY + 6.5);
        hookCtx.stroke();
      } finally {
        hookCtx.restore();
      }
    }
  } finally {
    hookCtx.restore();
  }

  return { drewHook: true };
}

function drawHook(hook = game.hook) {
  const options = hookShapeLayerOptions(hook);

  if (!hookShapeLayerBridgeDisabled && GoldMinerModules.drawHookLayer) {
    try {
      return GoldMinerModules.drawHookLayer(options);
    } catch (error) {
      hookShapeLayerBridgeDisabled = true;
      if (!Object.prototype.hasOwnProperty.call(window, "__goldMinerHookShapeRendererError")) {
        window.__goldMinerHookShapeRendererError = error instanceof Error ? error.message : String(error);
      }
      console.warn("Gold Miner hook shape renderer failed; using local hook shape fallback.", error);
    }
  }

  return drawHookWithLocalLayer(options);
}

function lerpVec(a, b, t) {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

function solveElbow(sx, sy, tx, ty, l1, l2, side) {
  const dx = tx - sx;
  const dy = ty - sy;
  const d0 = Math.hypot(dx, dy);
  const d = clamp(d0, Math.abs(l1 - l2) + 0.001, l1 + l2 - 0.001);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const ux = dx / Math.max(0.001, d0);
  const uy = dy / Math.max(0.001, d0);
  const px = sx + ux * a;
  const py = sy + uy * a;
  const nx = -uy * side;
  const ny = ux * side;
  return { x: px + nx * h, y: py + ny * h };
}

function roundRectPathForMiner(minerCtx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  minerCtx.beginPath();
  minerCtx.moveTo(x + rr, y);
  minerCtx.arcTo(x + w, y, x + w, y + h, rr);
  minerCtx.arcTo(x + w, y + h, x, y + h, rr);
  minerCtx.arcTo(x, y + h, x, y, rr);
  minerCtx.arcTo(x, y, x + w, y, rr);
  minerCtx.closePath();
}

function minerLayerOptions(hook = game.hook, miner = game.miner) {
  return {
    ctx,
    hook,
    miner,
    pivot: getPivot(hook),
    reel: getReelCenter(hook),
    now: performance.now(),
    attachedItem: attachedItem(hook),
    artAssets: crayonArtAssets(),
  };
}

function createMinerPoseWithLocalLayer(options) {
  const { hook, miner, pivot, reel, now, attachedItem: carried } = options;
  const bob = 1.15 * Math.sin(now / 620) + 0.55 * Math.sin(now / 980 + 1.7);
  const aim = clamp(hook.angle / Math.max(0.001, hook.maxAngle), -1, 1);

  const crank = miner.crank;
  const phase = hook.reelAngle;
  const weight = carried ? carried.weight : 0;
  const strainBase = clamp(weight / 6.4, 0, 1);

  const leanX = crank * Math.sin(phase) * (2.2 + 1.6 * strainBase);
  const leanY = crank * (0.65 + 0.35 * Math.cos(phase * 2.2)) * (0.8 + 0.4 * strainBase);

  const x = pivot.x + leanX;
  const y = pivot.y - 58 + bob + leanY; // head center
  return { pivot, reel, now, bob, aim, crank, phase, strainBase, x, y, grip: miner.grip, releasePop: miner.releasePop };
}

function drawMinerBackWithLocalLayer(options = minerLayerOptions()) {
  const { ctx: minerCtx } = options;
  const ctx = minerCtx;
  const pose = options.pose ?? createMinerPoseWithLocalLayer(options);
  const { x, y, aim, crank, phase, strainBase } = pose;

  const skin = "#f6d7bf";
  const skinShadow = "#e0b695";
  const jacket = "#2a3f9e";
  const jacketDeep = "#1a2b7a";
  const overall = "#3c7bd8";
  const overallDeep = "#2556b2";
  const helmet = "#ffe7a3";
  const helmetDeep = "#d6a43a";

  const headR = 19.5;
  const torsoW = 54;
  const torsoH = 50;
  const torsoX = x - torsoW / 2;
  const torsoY = y + 18;

  const bodyWobble = crank * 0.7 * Math.sin(phase);
  const bodyTilt = crank * 0.05 * Math.sin(phase + 0.4);

  ctx.save();
  try {
    ctx.translate(x, y);
    ctx.rotate(bodyTilt);
    ctx.translate(-x, -y);

  // Back shadow (gives depth behind the winch)
  ctx.save();
  try {
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.ellipse(x + 10, torsoY + torsoH + 22, 34, 11, 0, 0, Math.PI * 2);
    ctx.fill();
  } finally {
    ctx.restore();
  }

  // Backpack
  ctx.save();
  try {
    ctx.translate(x + 26, torsoY + 26);
    ctx.rotate(-0.08);
    const pack = ctx.createLinearGradient(-12, -18, 14, 18);
    pack.addColorStop(0, "#3a2c22");
    pack.addColorStop(0.55, "#2a1f18");
    pack.addColorStop(1, "#16110d");
    ctx.fillStyle = pack;
    roundRectPathForMiner(ctx, -15, -20, 26, 38, 10);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    roundRectPathForMiner(ctx, -12, -17, 20, 14, 8);
    ctx.fill();
  } finally {
    ctx.restore();
  }

  // Torso base
  const torsoGrad = ctx.createLinearGradient(torsoX, torsoY, torsoX + torsoW, torsoY + torsoH);
  torsoGrad.addColorStop(0, jacket);
  torsoGrad.addColorStop(1, jacketDeep);
  ctx.fillStyle = torsoGrad;
  roundRectPathForMiner(ctx, torsoX, torsoY, torsoW, torsoH, 14);
  ctx.fill();

  // Collar / shirt
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  roundRectPathForMiner(ctx, torsoX + 8, torsoY + 6, torsoW - 16, 16, 10);
  ctx.fill();

  // Overalls bib
  const bibGrad = ctx.createLinearGradient(torsoX, torsoY + 16, torsoX, torsoY + torsoH);
  bibGrad.addColorStop(0, overall);
  bibGrad.addColorStop(1, overallDeep);
  ctx.fillStyle = bibGrad;
  roundRectPathForMiner(ctx, torsoX + 10, torsoY + 16, torsoW - 20, 30, 12);
  ctx.fill();

  // Straps
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - 18, torsoY + 6);
  ctx.lineTo(x - 10, torsoY + 22);
  ctx.moveTo(x + 18, torsoY + 6);
  ctx.lineTo(x + 10, torsoY + 22);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 18, torsoY + 6);
  ctx.lineTo(x - 10, torsoY + 22);
  ctx.moveTo(x + 18, torsoY + 6);
  ctx.lineTo(x + 10, torsoY + 22);
  ctx.stroke();

  // Belt + buckle
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(torsoX + 4, torsoY + 38, torsoW - 8, 6);
  ctx.fillStyle = "#ffd34d";
  roundRectPathForMiner(ctx, x - 7, torsoY + 37, 14, 8, 3);
  ctx.fill();

  // Pouch
  ctx.save();
  try {
    ctx.translate(x - 22, torsoY + 44);
    ctx.rotate(0.08);
    ctx.fillStyle = "#2b2018";
    roundRectPathForMiner(ctx, -10, -6, 18, 14, 5);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    roundRectPathForMiner(ctx, -8, -4, 14, 6, 4);
    ctx.fill();
  } finally {
    ctx.restore();
  }

  // Head
  const face = ctx.createRadialGradient(x - 6 + aim * 2, y - 6, 3, x, y + 2, 24);
  face.addColorStop(0, "#ffe0c6");
  face.addColorStop(1, skinShadow);
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.arc(x, y, headR, 0, Math.PI * 2);
  ctx.fill();

  // Nose
  ctx.fillStyle = "rgba(0,0,0,0.10)";
  ctx.beginPath();
  ctx.ellipse(x + 3 + aim * 1.4, y + 2, 2.8, 2.2, 0.25, 0, Math.PI * 2);
  ctx.fill();

  // Cute cheeks + smile (no beard)
  ctx.save();
  try {
    const drawCheek = (cx) => {
      const g = ctx.createRadialGradient(cx, y + 6, 2, cx, y + 6, 11);
      g.addColorStop(0, "rgba(255,120,150,0.32)");
      g.addColorStop(1, "rgba(255,120,150,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, y + 7, 11, 0, Math.PI * 2);
      ctx.fill();
    };
    drawCheek(x - 10);
    drawCheek(x + 10);
  } finally {
    ctx.restore();
  }
  ctx.strokeStyle = "rgba(90,55,40,0.55)";
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(x + aim * 1.1, y + 12.5, 7.2, Math.PI * 1.12, Math.PI * 1.88);
  ctx.stroke();

  // Helmet
  const helm = ctx.createLinearGradient(x - 18, y - 26, x + 18, y);
  helm.addColorStop(0, helmet);
  helm.addColorStop(1, helmetDeep);
  ctx.fillStyle = helm;
  ctx.beginPath();
  ctx.ellipse(x, y - 12, 20, 16, 0, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  roundRectPathForMiner(ctx, x - 22, y - 23, 44, 10, 7);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  roundRectPathForMiner(ctx, x - 19, y - 22, 38, 5, 6);
  ctx.fill();

  // Glasses strap + cute eyes
  ctx.strokeStyle = "rgba(0,0,0,0.22)";
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.arc(x, y - 4, 20, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();

  const eyeY = y - 3.2;
  const drawEye = (cx) => {
    const ex = cx + aim * 1.05;
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.beginPath();
    ctx.ellipse(cx, eyeY, 4.2, 5.0, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.arc(ex, eyeY + 0.6, 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath();
    ctx.arc(ex - 0.8, eyeY - 0.7, 0.7, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawLens = (cx) => {
    ctx.strokeStyle = "rgba(0,0,0,0.38)";
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(cx, eyeY, 8.2, 0, Math.PI * 2);
    ctx.stroke();

    const g = ctx.createRadialGradient(cx - 3 + aim * 0.7, eyeY - 2, 1, cx, eyeY, 10);
    g.addColorStop(0, "rgba(255,255,255,0.28)");
    g.addColorStop(1, "rgba(80, 120, 160, 0.18)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, eyeY, 7.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    try {
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx - 2.2, eyeY - 1.2, 4.8, Math.PI * 1.15, Math.PI * 1.55);
      ctx.stroke();
    } finally {
      ctx.restore();
    }
  };

  drawEye(x - 9.5);
  drawEye(x + 9.5);
  drawLens(x - 9.5);
  drawLens(x + 9.5);

  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 1.8, eyeY);
  ctx.lineTo(x + 1.8, eyeY);
  ctx.stroke();

  // Headlamp
  ctx.fillStyle = "#ffd34d";
  ctx.beginPath();
  ctx.arc(x, y - 19, 4.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.arc(x + 1.2, y - 18, 1.6, 0, Math.PI * 2);
  ctx.fill();
  const lampGlow = ctx.createRadialGradient(x, y - 19, 2, x, y - 19, 36);
  lampGlow.addColorStop(0, "rgba(255,211,77,0.18)");
  lampGlow.addColorStop(1, "rgba(255,211,77,0)");
  ctx.fillStyle = lampGlow;
  ctx.beginPath();
  ctx.arc(x, y - 19, 36, 0, Math.PI * 2);
  ctx.fill();

  // Strain sweat
  if (strainBase > 0.6 && crank > 0.3) {
    const s = (strainBase - 0.6) / 0.4;
    ctx.save();
    try {
      ctx.globalAlpha = 0.25 * s;
      ctx.fillStyle = "rgba(175, 245, 255, 0.8)";
      ctx.beginPath();
      ctx.ellipse(x + 16, y - 1, 2.2, 3.6, 0.2, 0, Math.PI * 2);
      ctx.ellipse(x + 14, y + 6, 1.6, 2.8, -0.1, 0, Math.PI * 2);
      ctx.fill();
    } finally {
      ctx.restore();
    }
  }

  // Small tool badge
  ctx.save();
  try {
    ctx.translate(torsoX + 14, torsoY + 28);
    ctx.rotate(0.12);
    ctx.fillStyle = "rgba(255, 224, 138, 0.85)";
    roundRectPathForMiner(ctx, -4, -4, 10, 10, 3);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();
  } finally {
    ctx.restore();
  }

  // Subtle body wobble highlight
  ctx.save();
  try {
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    roundRectPathForMiner(ctx, torsoX + 6 + bodyWobble, torsoY + 10, 12, torsoH - 20, 10);
    ctx.fill();
  } finally {
    ctx.restore();
  }

  } finally {
    ctx.restore();
  }

  return { drewMinerBack: true };
}

function drawMinerFrontWithLocalLayer(options = minerLayerOptions()) {
  const { ctx: minerCtx, miner } = options;
  const ctx = minerCtx;
  const pose = options.pose ?? createMinerPoseWithLocalLayer(options);
  const { x, y, reel, crank, phase, strainBase } = pose;
  const grip = miner.grip;
  const releasePop = miner.releasePop;

  const sleeve = "#2a3f9e";
  const sleeveHi = "rgba(255,255,255,0.12)";
  const glove = "#d3a26b";
  const gloveHi = "rgba(255,255,255,0.20)";

  const shoulderY = y + 25;
  const shoulderL = { x: x - 18, y: shoulderY + 2 };
  const shoulderR = { x: x + 18, y: shoulderY };

  const knobR = 14;
  const knob = { x: reel.x + Math.cos(phase) * knobR, y: reel.y + Math.sin(phase) * knobR };
  const rightGrip = knob;
  const leftGrip = {
    x: reel.x - 7 + crank * Math.sin(phase + 0.7) * 2.2,
    y: reel.y + 10 + crank * Math.cos(phase + 0.55) * 4.6,
  };

  const kick = releasePop * (1 - grip);
  const rightRest = { x: x + 34 + kick * 10, y: y + 50 - kick * 12 };
  const leftRest = { x: x - 34 - kick * 6, y: y + 52 - kick * 10 };

  const rightHand = lerpVec(rightRest, rightGrip, grip);
  const leftHand = lerpVec(leftRest, leftGrip, grip);

  const upper = 22;
  const lower = 22;
  const elbowL = solveElbow(shoulderL.x, shoulderL.y, leftHand.x, leftHand.y, upper, lower, 1);
  const elbowR = solveElbow(shoulderR.x, shoulderR.y, rightHand.x, rightHand.y, upper, lower, -1);

  const drawArm = (s, e, h) => {
    ctx.strokeStyle = sleeve;
    ctx.lineWidth = 9.2;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.quadraticCurveTo(e.x, e.y, h.x, h.y);
    ctx.stroke();

    ctx.strokeStyle = sleeveHi;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - 1);
    ctx.quadraticCurveTo(e.x, e.y - 1, h.x, h.y - 1);
    ctx.stroke();

    ctx.fillStyle = glove;
    ctx.beginPath();
    ctx.ellipse(h.x, h.y, 5.8, 4.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = gloveHi;
    ctx.beginPath();
    ctx.ellipse(h.x - 1.8, h.y - 1.7, 2.5, 1.9, -0.2, 0, Math.PI * 2);
    ctx.fill();
  };

  ctx.save();
  try {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    drawArm(shoulderL, elbowL, leftHand);
    drawArm(shoulderR, elbowR, rightHand);

  // Strain lines when pulling heavy stuff
  if (strainBase > 0.65 && crank > 0.25) {
    const a = 0.2 + 0.25 * crank * (strainBase - 0.65) / 0.35;
    ctx.save();
    try {
      ctx.globalAlpha = a;
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 24, y + 10);
      ctx.lineTo(x - 36, y + 2);
      ctx.moveTo(x + 24, y + 10);
      ctx.lineTo(x + 38, y + 1);
      ctx.stroke();
    } finally {
      ctx.restore();
    }
  }

  } finally {
    ctx.restore();
  }

  return { drewMinerFront: true };
}

function noteMinerRendererError(error) {
  minerLayerBridgeDisabled = true;
  if (!Object.prototype.hasOwnProperty.call(window, "__goldMinerMinerRendererError")) {
    window.__goldMinerMinerRendererError = error instanceof Error ? error.message : String(error);
  }
  console.warn("Gold Miner miner renderer failed; using local miner fallback.", error);
}

function drawMinerBack(hook = game.hook, miner = game.miner) {
  const options = minerLayerOptions(hook, miner);

  if (!minerLayerBridgeDisabled && GoldMinerModules.createMinerPose && GoldMinerModules.drawMinerBackLayer) {
    try {
      const pose = GoldMinerModules.createMinerPose(options);
      return GoldMinerModules.drawMinerBackLayer({ ctx: options.ctx, pose });
    } catch (error) {
      noteMinerRendererError(error);
    }
  }

  return drawMinerBackWithLocalLayer(options);
}

function drawMinerFront(hook = game.hook, miner = game.miner) {
  const options = minerLayerOptions(hook, miner);

  if (!minerLayerBridgeDisabled && GoldMinerModules.createMinerPose && GoldMinerModules.drawMinerFrontLayer) {
    try {
      const pose = GoldMinerModules.createMinerPose(options);
      return GoldMinerModules.drawMinerFrontLayer({ ctx: options.ctx, pose });
    } catch (error) {
      noteMinerRendererError(error);
    }
  }

  return drawMinerFrontWithLocalLayer(options);
}

function fxLayerOptions() {
  return {
    ctx,
    fx: game.fx,
  };
}

function withSavedFx(drawCtx, draw) {
  drawCtx.save();
  try {
    return draw();
  } finally {
    drawCtx.restore();
  }
}

function drawFxWithLocalLayer(options = fxLayerOptions()) {
  const { ctx: fxCtx, fx: layerFx } = options;
  let rings = 0;
  let particles = 0;
  let pops = 0;

  if (layerFx.rings.length > 0) {
    withSavedFx(fxCtx, () => {
      fxCtx.globalCompositeOperation = "lighter";
      for (const ring of layerFx.rings) {
        const t = clamp(ring.age / Math.max(0.0001, ring.life), 0, 1);
        const a = (1 - t) * 0.55;
        if (a <= 0) continue;
        const r = lerp(ring.r0, ring.r1, t);
        fxCtx.globalAlpha = a;
        fxCtx.strokeStyle = ring.color;
        fxCtx.lineWidth = lerp(ring.width, 0.8, t);
        fxCtx.beginPath();
        fxCtx.arc(ring.x, ring.y, r, 0, Math.PI * 2);
        fxCtx.stroke();
        rings += 1;
      }
    });
  }

  for (const particle of layerFx.particles) {
    const t = clamp(particle.age / Math.max(0.0001, particle.life), 0, 1);
    const a = (1 - t) * 0.9;
    if (a <= 0) continue;

    withSavedFx(fxCtx, () => {
      fxCtx.globalAlpha = a;
      fxCtx.fillStyle = particle.color;
      fxCtx.beginPath();
      fxCtx.arc(particle.x, particle.y, Math.max(0.6, particle.size), 0, Math.PI * 2);
      fxCtx.fill();
      particles += 1;
    });
  }

  if (layerFx.pops.length > 0) {
    withSavedFx(fxCtx, () => {
      fxCtx.textAlign = "center";
      fxCtx.textBaseline = "middle";
      fxCtx.font = "700 18px ui-sans-serif, system-ui";
      for (const pop of layerFx.pops) {
        const t = clamp(pop.age / pop.life, 0, 1);
        const a = 1 - t;
        if (a <= 0) continue;
        fxCtx.globalAlpha = a;
        fxCtx.lineWidth = 4;
        fxCtx.strokeStyle = "rgba(0,0,0,0.38)";
        fxCtx.strokeText(pop.text, pop.x, pop.y);
        fxCtx.fillStyle = pop.color;
        fxCtx.fillText(pop.text, pop.x, pop.y);
        pops += 1;
      }
    });
  }

  return { rings, particles, pops };
}

function drawFx() {
  const options = fxLayerOptions();

  if (!fxLayerBridgeDisabled && GoldMinerModules.drawFxLayer) {
    try {
      return GoldMinerModules.drawFxLayer(options);
    } catch (error) {
      fxLayerBridgeDisabled = true;
      if (!Object.prototype.hasOwnProperty.call(window, "__goldMinerFxRendererError")) {
        window.__goldMinerFxRendererError = error instanceof Error ? error.message : String(error);
      }
      console.warn("Gold Miner fx renderer failed; using local fx fallback.", error);
    }
  }

  return drawFxWithLocalLayer(options);
}

function createRenderPlayers() {
  const hooks = getHooks();
  if (!renderOrderBridgeDisabled && GoldMinerModules.createPlayerRenderOrder) {
    try {
      return GoldMinerModules.createPlayerRenderOrder({
        hooks,
        getMinerByIndex,
        getPivot,
      });
    } catch (error) {
      renderOrderBridgeDisabled = true;
      if (!Object.prototype.hasOwnProperty.call(window, "__goldMinerRenderOrderError")) {
        window.__goldMinerRenderOrderError = error instanceof Error ? error.message : String(error);
      }
      console.warn("Gold Miner render player ordering failed; using local render order fallback.", error);
    }
  }

  return hooks
    .map((hook, index) => ({
      hook,
      miner: getMinerByIndex(index),
      index,
      pivotX: getPivot(hook).x,
    }))
    .sort((a, b) => a.pivotX - b.pivotX);
}

function hookLayerOptions() {
  return {
    drawHookTrail: (hook, metadata) => drawHookTrail(hook, metadata),
    drawHook: (hook, metadata) => drawHook(hook, metadata),
    drawCarryLabel: (hook, metadata) => drawCarryLabel(hook, metadata),
  };
}

function createLocalHookLayerHandlers(options = hookLayerOptions()) {
  return {
    hookTrail: (hook, miner, index) => options.drawHookTrail(hook, { hook, miner, index, layerName: "hookTrail" }),
    hook: (hook, miner, index) => options.drawHook(hook, { hook, miner, index, layerName: "hook" }),
    carryLabel: (hook, miner, index) => options.drawCarryLabel(hook, { hook, miner, index, layerName: "carryLabel" }),
  };
}

function createBridgeHookLayerHandlers(options = hookLayerOptions()) {
  if (!hookLayerBridgeDisabled && GoldMinerModules.createHookLayerHandlers) {
    try {
      return GoldMinerModules.createHookLayerHandlers(options);
    } catch (error) {
      hookLayerBridgeDisabled = true;
      if (!Object.prototype.hasOwnProperty.call(window, "__goldMinerHookRendererError")) {
        window.__goldMinerHookRendererError = error instanceof Error ? error.message : String(error);
      }
      console.warn("Gold Miner hook renderer failed; using local hook layer fallback.", error);
    }
  }

  return createLocalHookLayerHandlers(options);
}

function renderLayerHandlers() {
  const hookLayers = createBridgeHookLayerHandlers();
  return {
    background: () => drawBackground(),
    plank: () => drawPlank(),
    minerBack: (hook, miner) => drawMinerBack(hook, miner),
    winch: (hook) => drawWinch(hook),
    minerFront: (hook, miner) => drawMinerFront(hook, miner),
    items: () => drawItems(),
    hookTrail: hookLayers.hookTrail,
    hook: hookLayers.hook,
    carryLabel: hookLayers.carryLabel,
    fx: () => drawFx(),
  };
}

function renderFrameWithLocalLayers(options) {
  const {
    ctx: frameCtx,
    canvas: frameCanvas,
    viewport,
    dpr,
    fx,
    phase,
    paused,
    timeLeft,
    players,
    layers,
    now,
  } = options;

  const callLayer = (name) => layers[name]?.();
  const callPlayerLayer = (name) => {
    const layer = layers[name];
    if (!layer) return;
    for (const player of players) layer(player.hook, player.miner, player.index);
  };

  frameCtx.setTransform(1, 0, 0, 1, 0, 0);
  frameCtx.clearRect(0, 0, frameCanvas.width, frameCanvas.height);

  const tx = (fx.shakeX ?? 0) * dpr;
  const ty = (fx.shakeY ?? 0) * dpr;
  frameCtx.setTransform(dpr, 0, 0, dpr, tx, ty);

  callLayer("background");
  callLayer("plank");
  callPlayerLayer("minerBack");
  callPlayerLayer("winch");
  callPlayerLayer("minerFront");
  callLayer("items");
  callPlayerLayer("hookTrail");
  callPlayerLayer("hook");
  callPlayerLayer("carryLabel");
  callLayer("fx");

  if ((fx.flash ?? 0) > 0) {
    frameCtx.save();
    frameCtx.globalAlpha = fx.flash;
    frameCtx.fillStyle = "#fff1c4";
    frameCtx.fillRect(0, 0, viewport.w, viewport.h);
    frameCtx.restore();
  }

  if (phase === "playing" && !paused && timeLeft <= 10) {
    frameCtx.save();
    frameCtx.globalAlpha = 0.12 + 0.08 * Math.sin(now / 110);
    frameCtx.fillStyle = "#ff2a2a";
    frameCtx.fillRect(0, 0, viewport.w, viewport.h);
    frameCtx.restore();
  }
}

function createRenderSnapshotWithLocalData(options) {
  return {
    ctx: options.ctx,
    canvas: options.canvas,
    viewport: options.game.viewport,
    dpr: options.dpr,
    fx: options.game.fx,
    phase: options.game.phase,
    paused: options.game.paused,
    timeLeft: options.game.timeLeft,
    players: options.players,
    layers: options.layers,
    now: options.now,
  };
}

function render() {
  const snapshotInput = {
    game,
    ctx,
    canvas,
    dpr: DPR,
    players: createRenderPlayers(),
    layers: renderLayerHandlers(),
    now: performance.now(),
  };
  let options;

  if (!renderSnapshotBridgeDisabled && GoldMinerModules.createRenderSnapshot) {
    try {
      options = GoldMinerModules.createRenderSnapshot(snapshotInput);
    } catch (error) {
      renderSnapshotBridgeDisabled = true;
      if (!Object.prototype.hasOwnProperty.call(window, "__goldMinerRenderSnapshotError")) {
        window.__goldMinerRenderSnapshotError = error instanceof Error ? error.message : String(error);
      }
      console.warn("Gold Miner render snapshot failed; using local render snapshot fallback.", error);
    }
  }

  if (!options) {
    options = createRenderSnapshotWithLocalData(snapshotInput);
  }

  if (!renderFrameBridgeDisabled && GoldMinerModules.renderFrameWithLayers) {
    try {
      GoldMinerModules.renderFrameWithLayers(options);
      return;
    } catch (error) {
      renderFrameBridgeDisabled = true;
      if (!Object.prototype.hasOwnProperty.call(window, "__goldMinerRenderPipelineError")) {
        window.__goldMinerRenderPipelineError = error instanceof Error ? error.message : String(error);
      }
      console.warn("Gold Miner render pipeline failed; using local render fallback.", error);
    }
  }

  renderFrameWithLocalLayers(options);
}

function resize() {
  const wrap = canvas.parentElement;
  const rect = wrap.getBoundingClientRect();
  const displayW = Math.max(320, rect.width);
  const displayH = Math.max(240, rect.height);

  const prevW = game.viewport.w;
  const prevH = game.viewport.h;

  canvas.style.width = `${displayW}px`;
  canvas.style.height = `${displayH}px`;

  canvas.width = Math.floor(displayW * DPR);
  canvas.height = Math.floor(displayH * DPR);

  game.viewport.w = displayW;
  game.viewport.h = displayH;

  layoutPlayers();
  recalcHookMaxLength();
  const sceneSeed = game.phase === "menu" ? game.runSeed : game.currentSeed || game.runSeed;
  if (sceneSeed) buildScene(sceneSeed);

  if (game.phase !== "menu" && prevW > 0 && prevH > 0) {
    const sx = displayW / prevW;
    const sy = displayH / prevH;
    const s = Math.min(sx, sy);
    const margin = 34;

    for (const item of game.items) {
      item.x *= sx;
      item.y *= sy;
      item.r *= s;
      if (item.type === "mouse" && item.mouse && Number.isFinite(item.mouse.vx)) {
        item.mouse.vx *= sx;
      }
      item.x = clamp(item.x, margin + item.r, displayW - margin - item.r);
      item.y = clamp(item.y, 170 + item.r, displayH - margin - item.r);
    }

    for (const hook of getHooks()) {
      hook.length *= s;
      hook.length = clampHookLength(hook.length, { minLength: hook.minLength, maxLength: hook.maxLength });
    }
  }

  render();
}

function initUi() {
  ui.startBtn.addEventListener("click", () => {
    dispatchInputCommand(mapButtonInputForHost("start"));
  });

  ui.pauseBtn.addEventListener("click", () => dispatchInputCommand(mapButtonInputForHost("pause")));
  ui.restartBtn.addEventListener("click", () => dispatchInputCommand(mapButtonInputForHost("restart")));
  ui.bombBtn.addEventListener("click", () => dispatchInputCommand(mapButtonInputForHost("bomb")));
  ui.soundBtn?.addEventListener("click", () => dispatchInputCommand(mapButtonInputForHost("sound")));
  ui.musicBtn?.addEventListener("click", () => dispatchInputCommand(mapButtonInputForHost("music")));

  ui.overlayPrimaryBtn.addEventListener("click", () => overlayPrimaryAction?.());
  ui.overlaySecondaryBtn.addEventListener("click", () => overlaySecondaryAction?.());

  window.addEventListener("keydown", (e) => {
    const mappedInput = mapKeyboardInputForHost(e);
    if (mappedInput?.preventDefault) e.preventDefault();
    dispatchInputCommand(mappedInput);
  });

  canvas.addEventListener("pointerdown", () => {
    dispatchInputCommand(mapPointerInputForHost());
  });

  syncAudioButtons();
}

function stepFrame(dt) {
  if (game.phase === "playing" && !game.paused) update(dt);
  updateMiner(dt);
  updateFx(dt);
  updateHookTrail(dt);
}

function debugSnapshotInput() {
  return {
    game,
    hooks: getHooks(),
    getPivot,
    getHookEnd,
    attachedItem,
    itemLimit: 24,
  };
}

function renderGameToText() {
  const input = debugSnapshotInput();
  if (!debugApiBridgeDisabled && GoldMinerModules.renderDebugSnapshotToText) {
    try {
      return GoldMinerModules.renderDebugSnapshotToText(input);
    } catch (error) {
      noteDebugApiBridgeError(error);
    }
  }

  if (debugApiFallback?.renderDebugSnapshotToText) {
    return debugApiFallback.renderDebugSnapshotToText(input);
  }
  throw new Error("Gold Miner debug snapshot API is unavailable");
}

window.render_game_to_text = renderGameToText;

function createDebugAdvancePlanForHost(ms) {
  if (!debugApiBridgeDisabled && GoldMinerModules.createDebugAdvancePlan) {
    try {
      return GoldMinerModules.createDebugAdvancePlan(ms);
    } catch (error) {
      noteDebugApiBridgeError(error);
    }
  }

  if (debugApiFallback?.createDebugAdvancePlan) {
    return debugApiFallback.createDebugAdvancePlan(ms);
  }
  throw new Error("Gold Miner debug advance API is unavailable");
}

window.advanceTime = (ms) => {
  const plan = createDebugAdvancePlanForHost(ms);
  for (let i = 0; i < plan.steps; i += 1) stepFrame(plan.dt);
  render();
  return Promise.resolve();
};

function createDebugShopSetupForHost(options = {}) {
  const input = {
    game,
    score: options?.score ?? 500,
  };

  if (!debugApiBridgeDisabled && GoldMinerModules.createDebugShopSetup) {
    try {
      return GoldMinerModules.createDebugShopSetup(input);
    } catch (error) {
      noteDebugApiBridgeError(error);
    }
  }

  if (debugApiFallback?.createDebugShopSetup) {
    return debugApiFallback.createDebugShopSetup(input);
  }
  throw new Error("Gold Miner debug shop setup API is unavailable");
}

function enterDebugShop(options = {}) {
  const setup = createDebugShopSetupForHost(options);
  game.score = setup.score;
  game.phase = setup.phase;
  game.paused = setup.paused;
  openShop();
  render();
  return JSON.parse(renderGameToText());
}

window.__goldMinerSmoke = Object.freeze({
  enterShop: enterDebugShop,
});

let lastTs = 0;
function loop(ts) {
  const dt = clamp((ts - lastTs) / 1000, 0, 0.034);
  lastTs = ts;

  stepFrame(dt);
  render();

  requestAnimationFrame(loop);
}

async function boot() {
  await loadGoldMinerModules();
  initializeGameState();

  initUi();
  initRunSeed();
  initBackgrounds();
  initCrayonArt();
  game.bgIndex = pickBackgroundIndex(game.runSeed, null);
  resize();
  window.addEventListener("resize", resize, { passive: true });

  showModeSelectOverlay();

  updateHud();
  const isVirtualTime = typeof window.__vt_pending !== "undefined";
  if (!isVirtualTime) requestAnimationFrame(loop);
  else render();
}

boot().catch((error) => {
  window.__goldMinerBootError = error instanceof Error ? error.message : String(error);
  console.error("Gold Miner failed to boot.", error);
});
