import {
  DDA_BASE_MAX,
  DDA_BASE_PER_STAGE,
  DDA_INERTIA,
  DDA_OVER_FOR_MAX_SIGNAL,
  DDA_STAGE_SIZE,
  MARKET_COMMODITIES as SOURCE_MARKET_COMMODITIES,
  MARKET_DAY_NAMES as SOURCE_MARKET_DAY_NAMES,
  POST_LEVEL4_RAMP_LEVELS,
  POST_LEVEL4_START_LEVEL,
} from "../config/balance.js";
import {
  ITEM_COUNT_SCALE,
  ITEM_PLACEMENT,
  ITEM_VALUE_SCALE,
  LEVEL_VALUE_RANDOM_MAX,
  LEVEL_VALUE_RANDOM_MIN,
  LEVEL_VALUE_RANDOM_START_LEVEL,
  MARKET_SEED_SALT,
  MAX_LEVEL_TIME,
  MIN_LEVEL_TIME,
  MOUSE_CARGO_CHANCE,
  MOUSE_MAX_PER_LEVEL,
  MOUSE_MIN_LEVEL,
  MOUSE_SPEED_MAX,
  MOUSE_SPEED_MIN,
  TWO_PLAYER_TARGET_MULTIPLIER,
} from "../config/items.js";
import { getLevelConfig, LEVELS } from "../config/levels.js";
import { clamp, dist2, lerp, segmentCircleIntersect } from "../core/geometry.js";
import { createRng } from "../core/rng.js";
import { createRandomStream } from "../core/randomStreams.js";
import {
  CommandType,
  assertCommand,
  command,
  isCommand,
  isCommandType,
} from "../state/commands.js";
import { dispatchGameCommand } from "../state/commandDispatcher.js";
import { createInitialGameState } from "../state/createInitialState.js";
import { stepPlayingState } from "../state/stateKernel.js";
import {
  GameEventType,
  assertGameEvent,
  gameEvent,
  isGameEvent,
  isGameEventType,
} from "../events/eventTypes.js";
import {
  clearEvents,
  createEventQueue,
  drainEvents,
  enqueueEvent,
  hasPendingEvents,
  peekEvents,
} from "../events/eventQueue.js";
import {
  audioPlayEvent,
  audioSyncButtonsEvent,
} from "../audio/audioEvents.js";
import {
  applyAudioEventsToFacade,
  createAudioButtonSnapshot,
} from "../audio/audioAdapter.js";
import {
  applyUiEvents,
  hudBumpEvent,
  hudUpdateEvent,
  overlayHideEvent,
  overlayShowEvent,
  shopRenderEvent,
} from "../ui/uiEvents.js";
import { applyHudSnapshot, createHudSnapshot } from "../ui/domUiAdapter.js";
import {
  mapButtonInput,
  mapKeyboardInput,
  mapPointerInput,
} from "../ui/inputAdapter.js";
import {
  applyFxEvents,
  fxBurstEvent,
  fxFlashEvent,
  fxRingEvent,
  fxShakeEvent,
  scorePopEvent,
} from "../fx/fxEvents.js";
import { createPlayerRenderOrder, renderFrameWithLayers } from "../render/renderPipeline.js";
import { drawBackgroundLayer, drawPlankLayer } from "../render/backgroundRenderer.js";
import { createItemRenderOrder, drawItemsLayer } from "../render/itemLayerRenderer.js";
import { drawItemShape } from "../render/itemRenderer.js";
import { drawHookTrailLayer } from "../render/hookTrailRenderer.js";
import { drawHookLayer } from "../render/hookRenderer.js";
import { drawCarryLabelLayer } from "../render/carryLabelRenderer.js";
import { drawReelLayer, drawWinchLayer } from "../render/winchRenderer.js";
import { createHookLayerHandlers, drawHookPlayerLayer } from "../render/hookLayerRenderer.js";
import { createMinerPose, drawMinerBackLayer, drawMinerFrontLayer } from "../render/minerRenderer.js";
import { drawFxLayer } from "../render/fxRenderer.js";
import { createSceneData } from "../render/sceneSystem.js";
import { createRenderSnapshot } from "../render/renderSnapshot.js";
import {
  CRAYON_ART_ASSETS,
  CRAYON_ART_BASE_PATH,
  createCrayonArtRegistry,
  drawCrayonImageAsset,
  getCrayonItemAssetKey,
} from "../render/crayonArtAssets.js";
import { applyEventsWithFallback } from "./eventApplication.js";
import {
  canFireHook,
  canOpenModeSelect,
  canRestart,
  canTogglePause,
  canUseBomb,
  isMenu,
  isPlaying,
  isTwoPlayerMode,
} from "../state/selectors.js";
import {
  computeDdaTuning,
  ddaBaseDifficulty,
  ddaOverSignal,
  ddaStage,
  postLevel4Pressure,
  updateDdaRating,
} from "../systems/ddaSystem.js";
import {
  buyShopItem,
  canBuyShopItem,
  consumeInventoryItem,
  createEmptyInventory,
  getInventoryCount,
} from "../systems/inventorySystem.js";
import { createItemArt, createItemSpec, intRange, makeItem } from "../systems/itemFactory.js";
import { generateLevelData } from "../systems/levelGenerator.js";
import { createMarketDay, formatMarketDelta } from "../systems/marketSystem.js";
import { bagValueRange, createLevelItemValue, scaleItemValue } from "../systems/valueSystem.js";
import { updateFxState } from "../systems/fxSystem.js";
import {
  updateFallingKegMotion,
  updateMouseItemMotion,
} from "../systems/itemMotionSystem.js";
import {
  findFallingKegCollision,
  selectKegBlastAffectedIds,
} from "../systems/kegSystem.js";
import { createDeliveryResult } from "../systems/scoringSystem.js";
import {
  createDebugAdvancePlan,
  createDebugShopSetup,
  createDebugSnapshot,
  renderDebugSnapshotToText,
} from "../testing/debugApi.js";
import {
  clampHookLength,
  getHookDir,
  getHookEndPoint,
  updateHookReelState,
  updateHookSwingState,
  updateHookTrailState,
} from "../systems/hookSystem.js";

export { updateFxState };
export { createRandomStream };
export { applyAudioEventsToFacade, createAudioButtonSnapshot };
export { createDebugAdvancePlan, createDebugShopSetup, createDebugSnapshot, renderDebugSnapshotToText };
export { createInitialGameState, stepPlayingState };
export { applyHudSnapshot, createHudSnapshot };
export {
  mapButtonInput,
  mapKeyboardInput,
  mapPointerInput,
};
export {
  findFallingKegCollision,
  selectKegBlastAffectedIds,
  updateFallingKegMotion,
  updateMouseItemMotion,
};
export { createDeliveryResult };
export {
  clampHookLength,
  getHookDir,
  getHookEndPoint,
  updateHookReelState,
  updateHookSwingState,
  updateHookTrailState,
};
export {
  CRAYON_ART_ASSETS,
  CRAYON_ART_BASE_PATH,
  createCrayonArtRegistry,
  drawCrayonImageAsset,
  getCrayonItemAssetKey,
};

const MARKET_COMMODITIES = Object.freeze(
  SOURCE_MARKET_COMMODITIES.map((commodity) => Object.freeze({ ...commodity })),
);
const MARKET_DAY_NAMES = Object.freeze([...SOURCE_MARKET_DAY_NAMES]);

export const GoldMinerModules = Object.freeze({
  CommandType,
  command,
  isCommand,
  isCommandType,
  assertCommand,
  dispatchGameCommand,
  createInitialGameState,
  stepPlayingState,
  GameEventType,
  gameEvent,
  isGameEvent,
  isGameEventType,
  assertGameEvent,
  createEventQueue,
  enqueueEvent,
  drainEvents,
  peekEvents,
  clearEvents,
  hasPendingEvents,
  audioPlayEvent,
  audioSyncButtonsEvent,
  applyAudioEventsToFacade,
  createAudioButtonSnapshot,
  createDebugAdvancePlan,
  createDebugShopSetup,
  createDebugSnapshot,
  renderDebugSnapshotToText,
  hudUpdateEvent,
  hudBumpEvent,
  overlayShowEvent,
  overlayHideEvent,
  shopRenderEvent,
  applyUiEvents,
  createHudSnapshot,
  applyHudSnapshot,
  mapButtonInput,
  mapKeyboardInput,
  mapPointerInput,
  fxRingEvent,
  fxBurstEvent,
  fxFlashEvent,
  fxShakeEvent,
  scorePopEvent,
  applyFxEvents,
  applyEventsWithFallback,
  createPlayerRenderOrder,
  CRAYON_ART_ASSETS,
  CRAYON_ART_BASE_PATH,
  createCrayonArtRegistry,
  drawCrayonImageAsset,
  getCrayonItemAssetKey,
  createSceneData,
  createRenderSnapshot,
  renderFrameWithLayers,
  drawBackgroundLayer,
  drawPlankLayer,
  createItemRenderOrder,
  drawItemsLayer,
  drawItemShape,
  drawHookTrailLayer,
  drawHookLayer,
  drawCarryLabelLayer,
  drawReelLayer,
  drawWinchLayer,
  drawHookPlayerLayer,
  createHookLayerHandlers,
  createMinerPose,
  drawMinerBackLayer,
  drawMinerFrontLayer,
  drawFxLayer,
  updateFxState,
  getHookDir,
  getHookEndPoint,
  clampHookLength,
  updateHookTrailState,
  updateHookSwingState,
  updateHookReelState,
  updateMouseItemMotion,
  updateFallingKegMotion,
  findFallingKegCollision,
  selectKegBlastAffectedIds,
  createDeliveryResult,
  isMenu,
  isPlaying,
  isTwoPlayerMode,
  canOpenModeSelect,
  canRestart,
  canTogglePause,
  canFireHook,
  canUseBomb,
  createEmptyInventory,
  getInventoryCount,
  canBuyShopItem,
  buyShopItem,
  consumeInventoryItem,
  clamp,
  lerp,
  dist2,
  segmentCircleIntersect,
  createRng,
  createRandomStream,
  getLevelConfig,
  formatMarketDelta,
  createMarketDay,
  ddaStage,
  ddaBaseDifficulty,
  ddaOverSignal,
  postLevel4Pressure,
  computeDdaTuning,
  updateDdaRating,
  scaleItemValue,
  bagValueRange,
  createLevelItemValue,
  intRange,
  createItemArt,
  createItemSpec,
  makeItem,
  generateLevelData,
  DDA_STAGE_SIZE,
  DDA_BASE_PER_STAGE,
  DDA_BASE_MAX,
  DDA_OVER_FOR_MAX_SIGNAL,
  DDA_INERTIA,
  POST_LEVEL4_START_LEVEL,
  POST_LEVEL4_RAMP_LEVELS,
  ITEM_COUNT_SCALE,
  ITEM_VALUE_SCALE,
  LEVEL_VALUE_RANDOM_START_LEVEL,
  LEVEL_VALUE_RANDOM_MIN,
  LEVEL_VALUE_RANDOM_MAX,
  MIN_LEVEL_TIME,
  MAX_LEVEL_TIME,
  TWO_PLAYER_TARGET_MULTIPLIER,
  MARKET_SEED_SALT,
  MOUSE_MIN_LEVEL,
  MOUSE_MAX_PER_LEVEL,
  MOUSE_CARGO_CHANCE,
  MOUSE_SPEED_MIN,
  MOUSE_SPEED_MAX,
  ITEM_PLACEMENT,
  LEVELS,
  MARKET_COMMODITIES,
  MARKET_DAY_NAMES,
});

function isCompatibleGoldMinerModules(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    Object.keys(GoldMinerModules).every((key) => key in value)
  );
}

export function installGoldMinerModules(target = globalThis) {
  const targetType = typeof target;
  if (target === null || (targetType !== "object" && targetType !== "function")) {
    throw new TypeError("installGoldMinerModules target must be an object or function");
  }

  if (Object.prototype.hasOwnProperty.call(target, "GoldMinerModules")) {
    if (target.GoldMinerModules === GoldMinerModules) return GoldMinerModules;
    if (isCompatibleGoldMinerModules(target.GoldMinerModules)) return target.GoldMinerModules;
    throw new Error("Cannot install GoldMinerModules: target already has a different GoldMinerModules");
  }

  Object.defineProperty(target, "GoldMinerModules", {
    value: GoldMinerModules,
    writable: false,
    enumerable: false,
    configurable: true,
  });

  return GoldMinerModules;
}

try {
  installGoldMinerModules(globalThis);
} catch {
  // The runtime host may recover with the exported namespace even when a polluted global cannot be replaced.
}
