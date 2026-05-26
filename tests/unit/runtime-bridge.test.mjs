import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MARKET_COMMODITIES as SOURCE_MARKET_COMMODITIES,
  MARKET_DAY_NAMES as SOURCE_MARKET_DAY_NAMES,
} from "../../src/config/balance.js";

let importCount = 0;

const EXPECTED_GOLD_MINER_MODULE_KEYS = [
  "CommandType",
  "command",
  "isCommand",
  "isCommandType",
  "assertCommand",
  "dispatchGameCommand",
  "createInitialGameState",
  "stepPlayingState",
  "GameEventType",
  "gameEvent",
  "isGameEvent",
  "isGameEventType",
  "assertGameEvent",
  "createEventQueue",
  "enqueueEvent",
  "drainEvents",
  "peekEvents",
  "clearEvents",
  "hasPendingEvents",
  "audioPlayEvent",
  "audioSyncButtonsEvent",
  "applyAudioEventsToFacade",
  "createAudioButtonSnapshot",
  "createDebugAdvancePlan",
  "createDebugShopSetup",
  "createDebugSnapshot",
  "renderDebugSnapshotToText",
  "hudUpdateEvent",
  "hudBumpEvent",
  "overlayShowEvent",
  "overlayHideEvent",
  "shopRenderEvent",
  "applyUiEvents",
  "createHudSnapshot",
  "applyHudSnapshot",
  "mapButtonInput",
  "mapKeyboardInput",
  "mapPointerInput",
  "fxRingEvent",
  "fxBurstEvent",
  "fxFlashEvent",
  "fxShakeEvent",
  "scorePopEvent",
  "applyFxEvents",
  "applyEventsWithFallback",
  "createPlayerRenderOrder",
  "CRAYON_ART_ASSETS",
  "CRAYON_ART_BASE_PATH",
  "createCrayonArtRegistry",
  "drawCrayonImageAsset",
  "getCrayonItemAssetKey",
  "createSceneData",
  "createRenderSnapshot",
  "renderFrameWithLayers",
  "drawBackgroundLayer",
  "drawPlankLayer",
  "createItemRenderOrder",
  "drawItemsLayer",
  "drawItemShape",
  "drawHookTrailLayer",
  "drawHookLayer",
  "drawCarryLabelLayer",
  "drawReelLayer",
  "drawWinchLayer",
  "drawHookPlayerLayer",
  "createHookLayerHandlers",
  "createMinerPose",
  "drawMinerBackLayer",
  "drawMinerFrontLayer",
  "drawFxLayer",
  "updateFxState",
  "getHookDir",
  "getHookEndPoint",
  "clampHookLength",
  "updateHookTrailState",
  "updateHookSwingState",
  "updateHookReelState",
  "updateMouseItemMotion",
  "updateFallingKegMotion",
  "findFallingKegCollision",
  "selectKegBlastAffectedIds",
  "createDeliveryResult",
  "isMenu",
  "isPlaying",
  "isTwoPlayerMode",
  "canOpenModeSelect",
  "canRestart",
  "canTogglePause",
  "canFireHook",
  "canUseBomb",
  "createEmptyInventory",
  "getInventoryCount",
  "canBuyShopItem",
  "buyShopItem",
  "consumeInventoryItem",
  "clamp",
  "lerp",
  "dist2",
  "segmentCircleIntersect",
  "createRng",
  "createRandomStream",
  "getLevelConfig",
  "formatMarketDelta",
  "createMarketDay",
  "ddaStage",
  "ddaBaseDifficulty",
  "ddaOverSignal",
  "postLevel4Pressure",
  "computeDdaTuning",
  "updateDdaRating",
  "scaleItemValue",
  "bagValueRange",
  "createLevelItemValue",
  "intRange",
  "createItemArt",
  "createItemSpec",
  "makeItem",
  "generateLevelData",
  "DDA_STAGE_SIZE",
  "DDA_BASE_PER_STAGE",
  "DDA_BASE_MAX",
  "DDA_OVER_FOR_MAX_SIGNAL",
  "DDA_INERTIA",
  "POST_LEVEL4_START_LEVEL",
  "POST_LEVEL4_RAMP_LEVELS",
  "ITEM_COUNT_SCALE",
  "ITEM_VALUE_SCALE",
  "LEVEL_VALUE_RANDOM_START_LEVEL",
  "LEVEL_VALUE_RANDOM_MIN",
  "LEVEL_VALUE_RANDOM_MAX",
  "MIN_LEVEL_TIME",
  "MAX_LEVEL_TIME",
  "TWO_PLAYER_TARGET_MULTIPLIER",
  "MARKET_SEED_SALT",
  "MOUSE_MIN_LEVEL",
  "MOUSE_MAX_PER_LEVEL",
  "MOUSE_CARGO_CHANCE",
  "MOUSE_SPEED_MIN",
  "MOUSE_SPEED_MAX",
  "ITEM_PLACEMENT",
  "LEVELS",
  "MARKET_COMMODITIES",
  "MARKET_DAY_NAMES",
];

function restoreGlobalGoldMinerModules(descriptor) {
  if (descriptor) {
    Object.defineProperty(globalThis, "GoldMinerModules", descriptor);
    return;
  }

  delete globalThis.GoldMinerModules;
}

async function withCleanGlobal(callback) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "GoldMinerModules");
  delete globalThis.GoldMinerModules;

  try {
    return await callback();
  } finally {
    restoreGlobalGoldMinerModules(descriptor);
  }
}

async function importFreshBridge() {
  importCount += 1;
  return import(`../../src/runtime/moduleBridge.js?runtimeBridgeTest=${importCount}`);
}

test("runtime bridge exports and installs the expected namespace", async () => {
  await withCleanGlobal(async () => {
    const bridge = await importFreshBridge();
    assert.equal(globalThis.GoldMinerModules, bridge.GoldMinerModules);
    assert.ok(Object.isFrozen(bridge.GoldMinerModules));

    const modules = bridge.installGoldMinerModules(globalThis);
    const windowLikeTarget = {};
    const windowModules = bridge.installGoldMinerModules(windowLikeTarget);
    const windowDescriptor = Object.getOwnPropertyDescriptor(windowLikeTarget, "GoldMinerModules");

    assert.equal(modules, bridge.GoldMinerModules);
    assert.equal(globalThis.GoldMinerModules, bridge.GoldMinerModules);
    assert.equal(windowModules, bridge.GoldMinerModules);
    assert.equal(windowLikeTarget.GoldMinerModules, bridge.GoldMinerModules);
    assert.equal(windowDescriptor.value, bridge.GoldMinerModules);
    assert.equal(windowDescriptor.writable, false);
    assert.equal(windowDescriptor.enumerable, false);
    assert.equal(windowDescriptor.configurable, true);

    assert.deepEqual(Object.keys(modules), EXPECTED_GOLD_MINER_MODULE_KEYS);
    assert.equal("applyAudioEvents" in modules, false);

    assert.equal(modules.clamp(5, 1, 3), 3);
    assert.equal(modules.formatMarketDelta(1), "±0%");
    assert.equal(modules.ddaStage(4), 1);
    assert.equal(typeof modules.createSceneData, "function");
    assert.equal(typeof modules.createRenderSnapshot, "function");
    assert.equal(modules.createSceneData({ seed: 1, viewport: { w: 640, h: 360 } }).stars.length, 36);
    assert.equal(
      modules.createRenderSnapshot({
        game: {
          viewport: { w: 320, h: 180 },
          fx: { shakeX: 0, shakeY: 0, flash: 0 },
          phase: "menu",
          paused: false,
          timeLeft: 60,
        },
        ctx: { save() {} },
        canvas: { width: 640, height: 360 },
        dpr: 2,
        players: [],
        layers: {},
        now: 10,
      }).dpr,
      2,
    );
    assert.equal(typeof modules.drawBackgroundLayer, "function");
    assert.equal(typeof modules.drawPlankLayer, "function");
    assert.equal(typeof modules.createItemRenderOrder, "function");
    assert.equal(typeof modules.drawItemsLayer, "function");
    assert.equal(typeof modules.drawItemShape, "function");
    assert.equal(typeof modules.drawHookTrailLayer, "function");
    assert.equal(typeof modules.drawHookLayer, "function");
    assert.equal(typeof modules.drawCarryLabelLayer, "function");
    assert.equal(typeof modules.drawReelLayer, "function");
    assert.equal(typeof modules.drawWinchLayer, "function");
    assert.equal(typeof modules.drawHookPlayerLayer, "function");
    assert.equal(typeof modules.createHookLayerHandlers, "function");
    assert.equal(typeof modules.createMinerPose, "function");
    assert.equal(typeof modules.drawMinerBackLayer, "function");
    assert.equal(typeof modules.drawMinerFrontLayer, "function");
    assert.equal(typeof modules.drawFxLayer, "function");
    assert.equal(modules.CRAYON_ART_BASE_PATH, "./assets/art/crayon/");
    assert.equal(Array.isArray(modules.CRAYON_ART_ASSETS), true);
    assert.equal(typeof modules.createCrayonArtRegistry, "function");
    assert.equal(typeof modules.drawCrayonImageAsset, "function");
    assert.equal(modules.getCrayonItemAssetKey({ type: "gold" }), "sprite.gold");
    assert.equal(bridge.CRAYON_ART_ASSETS, modules.CRAYON_ART_ASSETS);
    assert.equal(bridge.CRAYON_ART_BASE_PATH, modules.CRAYON_ART_BASE_PATH);
    assert.equal(bridge.createCrayonArtRegistry, modules.createCrayonArtRegistry);
    assert.equal(bridge.drawCrayonImageAsset, modules.drawCrayonImageAsset);
    assert.equal(bridge.getCrayonItemAssetKey, modules.getCrayonItemAssetKey);
    assert.equal(typeof modules.updateFxState, "function");
    assert.equal(bridge.updateFxState, modules.updateFxState);
    assert.equal(typeof modules.getHookDir, "function");
    assert.equal(typeof modules.getHookEndPoint, "function");
    assert.equal(typeof modules.clampHookLength, "function");
    assert.equal(typeof modules.updateHookTrailState, "function");
    assert.equal(typeof modules.updateHookSwingState, "function");
    assert.equal(typeof modules.updateHookReelState, "function");
    assert.equal(bridge.getHookDir, modules.getHookDir);
    assert.equal(bridge.getHookEndPoint, modules.getHookEndPoint);
    assert.equal(bridge.clampHookLength, modules.clampHookLength);
    assert.equal(bridge.updateHookTrailState, modules.updateHookTrailState);
    assert.equal(bridge.updateHookSwingState, modules.updateHookSwingState);
    assert.equal(bridge.updateHookReelState, modules.updateHookReelState);
    assert.equal(typeof modules.updateMouseItemMotion, "function");
    assert.equal(typeof modules.updateFallingKegMotion, "function");
    assert.equal(typeof modules.findFallingKegCollision, "function");
    assert.equal(typeof modules.selectKegBlastAffectedIds, "function");
    assert.equal(bridge.updateMouseItemMotion, modules.updateMouseItemMotion);
    assert.equal(bridge.updateFallingKegMotion, modules.updateFallingKegMotion);
    assert.equal(bridge.findFallingKegCollision, modules.findFallingKegCollision);
    assert.equal(bridge.selectKegBlastAffectedIds, modules.selectKegBlastAffectedIds);
    assert.equal(bridge.createDeliveryResult, modules.createDeliveryResult);
    const fx = { flash: 0, shake: 0, shakeX: 1, shakeY: 1, pops: [], rings: [], particles: [] };
    assert.equal(modules.updateFxState(fx, 0, () => 0.5), fx);
    assert.equal(fx.shakeX, 0);
    assert.equal(fx.shakeY, 0);
    assert.deepEqual(modules.getHookDir(0), { x: 0, y: 1 });
    assert.equal(modules.clampHookLength(8, { minLength: 10, maxLength: 20 }), 10);
    const trail = [];
    assert.equal(
      modules.updateHookTrailState({ trail, state: "extend", end: { x: 1, y: 2 }, dt: 0 }),
      trail,
    );
    assert.deepEqual(trail, [{ x: 1, y: 2, age: 0 }]);
    const mouse = { type: "mouse", x: 50, y: 200, r: 10, mouse: { vx: 10, phase: 0 } };
    assert.equal(modules.updateMouseItemMotion(mouse, { dt: 0.5, viewport: { w: 320, h: 240 } }), mouse);
    const keg = { id: "keg", type: "keg", x: 20, y: 20, r: 10, keg: { stage: "fall" } };
    assert.equal(modules.updateFallingKegMotion(keg, { dt: 0.1, gravity: 1000 }), keg);
    assert.deepEqual(
      modules.findFallingKegCollision({
        items: [keg, { id: "hit", x: keg.x, y: keg.y, r: 10 }],
        kegItem: keg,
        kegIndex: 0,
      }),
      { item: { id: "hit", x: keg.x, y: keg.y, r: 10 }, id: "hit", index: 1 },
    );
    assert.deepEqual(
      modules.selectKegBlastAffectedIds({ items: [{ id: "hit", x: 0, y: 0, r: 10 }], x: 0, y: 0, radius: 1 }),
      ["hit"],
    );
    assert.deepEqual(
      modules.createDeliveryResult({
        score: 10,
        item: { type: "gold", value: 25, r: 6 },
        playerIndex: 1,
      }).scorePopPayload,
      { amount: 25, color: "#ffd34d", player: 1 },
    );
    assert.equal(modules.command(modules.CommandType.USE_BOMB).type, modules.CommandType.USE_BOMB);
    assert.equal(modules.isCommandType(modules.CommandType.USE_BOMB), true);
    assert.equal(modules.isCommand(modules.command(modules.CommandType.FIRE_HOOK, { player: 0 })), true);
    assert.equal(bridge.createInitialGameState, modules.createInitialGameState);
    assert.equal(bridge.stepPlayingState, modules.stepPlayingState);
    assert.equal(modules.createInitialGameState().phase, "menu");
    const stepState = modules.createInitialGameState();
    stepState.phase = "playing";
    stepState.timeLeft = 1;
    assert.equal(modules.stepPlayingState({ state: stepState, dt: 0.1 }).shouldContinue, true);
    const queue = modules.createEventQueue();
    modules.enqueueEvent(queue, modules.audioPlayEvent("ui_click"));
    assert.equal(modules.hasPendingEvents(queue), true);
    assert.equal(modules.drainEvents(queue)[0].type, modules.GameEventType.AUDIO_PLAY);
    assert.equal(bridge.applyAudioEventsToFacade, modules.applyAudioEventsToFacade);
    assert.equal(bridge.createAudioButtonSnapshot, modules.createAudioButtonSnapshot);
    assert.equal(
      modules.createAudioButtonSnapshot({
        isSfxEnabled: () => false,
        isMusicEnabled: () => true,
        getTrackName: () => "Bridge",
      }).musicText,
      "音乐: 开 · Bridge",
    );
    assert.equal(bridge.createDebugAdvancePlan, modules.createDebugAdvancePlan);
    assert.equal(bridge.createDebugSnapshot, modules.createDebugSnapshot);
    assert.equal(bridge.renderDebugSnapshotToText, modules.renderDebugSnapshotToText);
    assert.deepEqual(modules.createDebugAdvancePlan(1000).steps, 60);
    assert.deepEqual(modules.createEmptyInventory(), { bombs: 0, speed: 0, lucky: 0 });
    assert.equal(bridge.createHudSnapshot, modules.createHudSnapshot);
    assert.equal(bridge.applyHudSnapshot, modules.applyHudSnapshot);
    assert.equal(bridge.mapButtonInput, modules.mapButtonInput);
    assert.equal(bridge.mapKeyboardInput, modules.mapKeyboardInput);
    assert.equal(bridge.mapPointerInput, modules.mapPointerInput);
    assert.deepEqual(
      modules.mapButtonInput("bomb", modules.CommandType),
      {
        command: { type: modules.CommandType.USE_BOMB, payload: {} },
        preventDefault: false,
      },
    );
    assert.deepEqual(
      modules.mapKeyboardInput(
        { code: "Enter", key: "Enter" },
        { phase: "playing", paused: false, twoPlayer: true },
        modules.CommandType,
      ),
      {
        command: { type: modules.CommandType.FIRE_HOOK, payload: { player: 1 } },
        preventDefault: true,
      },
    );
    assert.deepEqual(
      modules.mapPointerInput({ phase: "menu" }, modules.CommandType),
      {
        command: { type: modules.CommandType.SHOW_MODE_SELECT, payload: {} },
        preventDefault: false,
      },
    );
    assert.equal(
      modules.createHudSnapshot({
        game: {
          level: 1,
          score: 10.9,
          target: 100.1,
          timeLeft: 9.1,
          phase: "playing",
          paused: false,
          inventory: { bombs: 1, speed: 2, lucky: 3 },
          market: null,
        },
        canBomb: true,
      }).text.score,
      "10",
    );
    assert.equal(modules.canBuyShopItem(150, { id: "bomb", cost: 150 }), true);
    assert.equal(
      modules.canFireHook(
        { phase: "playing", paused: false, mode: "single", hook: { state: "swing" } },
        0,
      ),
      true,
    );
    assert.equal(
      modules.canFireHook(
        { phase: "playing", paused: false, mode: "double", hook: { state: "swing" }, hook2: { state: "swing" } },
        2,
      ),
      false,
    );
    assert.equal(
      modules.canUseBomb({
        phase: "playing",
        paused: false,
        mode: "single",
        inventory: { bombs: 1 },
        hook: { state: "retract", attachedId: 1 },
      }),
      true,
    );
    assert.equal(
      modules.canUseBomb({
        phase: "playing",
        paused: false,
        mode: "single",
        inventory: { bombs: 1 },
        hook: { state: "retract", attachedId: "1" },
      }),
      false,
    );
  });
});

test("runtime bridge exposes deterministic shared RNG", async () => {
  await withCleanGlobal(async () => {
    const bridge = await importFreshBridge();
    const { GoldMinerModules } = bridge;

    const a = GoldMinerModules.createRng(12345);
    const b = GoldMinerModules.createRng(12345);

    assert.equal(a.next(), b.next());
    assert.equal(a.range(10, 20), b.range(10, 20));
    assert.equal(bridge.createRandomStream, GoldMinerModules.createRandomStream);

    const firstStream = GoldMinerModules.createRandomStream({
      runSeed: 12345,
      levelSeed: 67890,
      name: "kegImmediate",
      salt: 111,
    });
    const secondStream = GoldMinerModules.createRandomStream({
      runSeed: 12345,
      levelSeed: 67890,
      name: "kegImmediate",
      salt: 111,
    });

    assert.equal(firstStream.next(), secondStream.next());
    assert.equal(firstStream.range(10, 20), secondStream.range(10, 20));
  });
});

test("runtime bridge exposes immutable market configuration snapshots", async () => {
  await withCleanGlobal(async () => {
    const { GoldMinerModules } = await importFreshBridge();

    assert.ok(Object.isFrozen(GoldMinerModules));
    assert.ok(Object.isFrozen(GoldMinerModules.MARKET_DAY_NAMES));
    assert.ok(Object.isFrozen(GoldMinerModules.MARKET_COMMODITIES));
    assert.ok(Object.isFrozen(GoldMinerModules.MARKET_COMMODITIES[0]));
    assert.notEqual(GoldMinerModules.MARKET_DAY_NAMES, SOURCE_MARKET_DAY_NAMES);
    assert.notEqual(GoldMinerModules.MARKET_COMMODITIES, SOURCE_MARKET_COMMODITIES);
    assert.notEqual(GoldMinerModules.MARKET_COMMODITIES[0], SOURCE_MARKET_COMMODITIES[0]);

    assert.throws(() => GoldMinerModules.MARKET_COMMODITIES.push({ key: "fake" }), TypeError);

    const originalMin = GoldMinerModules.MARKET_COMMODITIES[0].min;
    assert.throws(() => {
      GoldMinerModules.MARKET_COMMODITIES[0].min = 0;
    }, TypeError);
    assert.equal(GoldMinerModules.MARKET_COMMODITIES[0].min, originalMin);
  });
});

test("installGoldMinerModules is idempotent and rejects invalid targets", async () => {
  await withCleanGlobal(async () => {
    const bridge = await importFreshBridge();

    assert.equal(bridge.installGoldMinerModules(globalThis), bridge.GoldMinerModules);
    assert.equal(bridge.installGoldMinerModules(globalThis), bridge.GoldMinerModules);

    const inheritedTarget = Object.create({ GoldMinerModules: {} });
    assert.equal(bridge.installGoldMinerModules(inheritedTarget), bridge.GoldMinerModules);
    assert.equal(Object.hasOwn(inheritedTarget, "GoldMinerModules"), true);
    assert.equal(inheritedTarget.GoldMinerModules, bridge.GoldMinerModules);

    assert.throws(
      () => bridge.installGoldMinerModules({ GoldMinerModules: {} }),
      /GoldMinerModules/,
    );
    assert.throws(() => bridge.installGoldMinerModules(null), /target must be an object or function/);
  });
});

test("runtime bridge tolerates duplicate evaluated imports when an equivalent namespace is already installed", async () => {
  await withCleanGlobal(async () => {
    const first = await importFreshBridge();
    const second = await importFreshBridge();

    assert.notEqual(second.GoldMinerModules, first.GoldMinerModules);
    assert.equal(globalThis.GoldMinerModules, first.GoldMinerModules);
    assert.equal(second.installGoldMinerModules(globalThis), first.GoldMinerModules);
  });
});

test("runtime bridge import survives an incompatible preexisting namespace", async () => {
  await withCleanGlobal(async () => {
    const pollutedNamespace = {};
    Object.defineProperty(globalThis, "GoldMinerModules", {
      value: pollutedNamespace,
      writable: true,
      enumerable: false,
      configurable: true,
    });

    const bridge = await importFreshBridge();

    assert.ok(Object.isFrozen(bridge.GoldMinerModules));
    assert.equal(globalThis.GoldMinerModules, pollutedNamespace);
    assert.throws(() => bridge.installGoldMinerModules(globalThis), /GoldMinerModules/);
  });
});
