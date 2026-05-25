import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const countMatches = (source, pattern) => source.match(pattern)?.length ?? 0;

const extractFunctionBody = (source, functionName) => {
  const signatureIndex = source.indexOf(`function ${functionName}(`);
  assert.notEqual(signatureIndex, -1, `${functionName} should exist`);
  const openParenIndex = source.indexOf("(", signatureIndex);
  assert.notEqual(openParenIndex, -1, `${functionName} should have parameters`);

  let parenDepth = 0;
  let closeParenIndex = -1;
  for (let index = openParenIndex; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") parenDepth += 1;
    if (char === ")") parenDepth -= 1;
    if (parenDepth === 0) {
      closeParenIndex = index;
      break;
    }
  }
  assert.notEqual(closeParenIndex, -1, `${functionName} parameters should be closed`);

  const openBraceIndex = source.indexOf("{", closeParenIndex);
  assert.notEqual(openBraceIndex, -1, `${functionName} should have a body`);

  let depth = 0;
  for (let index = openBraceIndex; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(openBraceIndex + 1, index);
  }

  throw new Error(`${functionName} body was not closed`);
};

const extractObjectLiteralBody = (source, declarationPattern, label) => {
  const declarationMatch = declarationPattern.exec(source);
  assert.ok(declarationMatch, `${label} should exist`);
  const openBraceIndex = source.indexOf("{", declarationMatch.index);
  assert.notEqual(openBraceIndex, -1, `${label} should have an object literal`);

  let depth = 0;
  for (let index = openBraceIndex; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(openBraceIndex + 1, index);
  }

  throw new Error(`${label} object literal was not closed`);
};

const parseImportedNamesFrom = (source, specifier) => {
  const escapedSpecifier = specifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const importPattern = new RegExp(`import\\s*\\{(?<names>[\\s\\S]*?)\\}\\s*from\\s*"${escapedSpecifier}";`, "g");
  const names = [];
  let match;
  while ((match = importPattern.exec(source)) !== null) {
    names.push(
      ...match.groups.names
        .split(",")
        .map((name) => name.trim().split(/\s+as\s+/i)[0].trim())
        .filter(Boolean),
    );
  }
  return names;
};

const parseScriptTags = (html) => {
  const scriptTagPattern = /<script\b(?<attributes>[^>]*)>/gi;
  const attributePattern = /([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  const scripts = [];
  let scriptMatch;

  while ((scriptMatch = scriptTagPattern.exec(html)) !== null) {
    const attributes = {};
    const attributeText = scriptMatch.groups.attributes;
    let attributeMatch;

    while ((attributeMatch = attributePattern.exec(attributeText)) !== null) {
      const [, rawName, doubleQuotedValue, singleQuotedValue, unquotedValue] = attributeMatch;
      attributes[rawName.toLowerCase()] = doubleQuotedValue ?? singleQuotedValue ?? unquotedValue ?? "";
    }

    scripts.push(attributes);
  }

  return scripts;
};

const isModuleScript = ({ type }) => type?.trim().toLowerCase() === "module";

test("index loads audio before the module entry", () => {
  const html = read("index.html");
  const audioIndex = html.indexOf('src="./audio.js"');
  const mainIndex = html.indexOf('src="./src/main.js"');

  assert.notEqual(audioIndex, -1, "index.html should load audio.js");
  assert.notEqual(mainIndex, -1, "index.html should load src/main.js");
  assert.ok(audioIndex < mainIndex, "audio.js must load before src/main.js");
});

test("game exposes browser automation debug hooks", () => {
  const source = read("game.js");

  assert.match(source, /window\.render_game_to_text\s*=/);
  assert.match(source, /window\.advanceTime\s*=/);
  assert.match(source, /function debugSnapshotInput\(\)/);
  assert.match(source, /function renderGameToText\(\)/);
  assert.match(source, /function createDebugAdvancePlanForHost\(ms\)/);
  assert.match(source, /GoldMinerModules\.renderDebugSnapshotToText\(input\)/);
  assert.match(source, /GoldMinerModules\.createDebugAdvancePlan\(ms\)/);
  assert.match(source, /debugApiFallback\.renderDebugSnapshotToText\(input\)/);
  assert.match(source, /debugApiFallback\.createDebugAdvancePlan\(ms\)/);
  assert.match(source, /window\.__goldMinerDebugApiError =/);
});

test("index starts through the module entry while keeping audio classic", () => {
  const html = read("index.html");
  const scripts = parseScriptTags(html);
  const audioScriptIndex = scripts.findIndex(({ src }) => src === "./audio.js");
  const mainScriptIndex = scripts.findIndex(({ src }) => src === "./src/main.js");

  assert.notEqual(audioScriptIndex, -1, "index.html should load audio.js");
  assert.notEqual(mainScriptIndex, -1, "index.html should load src/main.js");
  assert.ok(audioScriptIndex < mainScriptIndex, "audio.js must load before src/main.js");
  assert.equal(isModuleScript(scripts[audioScriptIndex]), false, "audio.js must remain non-module");
  assert.equal(isModuleScript(scripts[mainScriptIndex]), true, "src/main.js must be the module entry");
  assert.equal(
    scripts.some(({ src }) => src === "./game.js"),
    false,
    "index.html should not load game.js directly after entry migration",
  );
  assert.equal(
    scripts.some(({ src, type }) => src === "./src/runtime/moduleBridge.js" && isModuleScript({ type })),
    false,
    "index.html should let src/main.js own bridge installation instead of loading the bridge directly",
  );
});

test("main entry installs the bridge before importing the browser host", () => {
  const source = read("src/main.js");

  assert.match(source, /^import "\.\/runtime\/moduleBridge\.js";/);
  assert.match(source, /await import\("\.\.\/game\.js"\)/);
  assert.ok(
    source.indexOf('import "./runtime/moduleBridge.js";') < source.indexOf('await import("../game.js")'),
    "module bridge should be installed before game.js is imported",
  );
  assert.match(source, /window\.__goldMinerBootError = error instanceof Error \? error\.message : String\(error\);/);
});

test("game dynamically loads the runtime module bridge before boot", () => {
  const source = read("game.js");
  const loadBody = extractFunctionBody(source, "loadGoldMinerModules");

  assert.match(source, /let GoldMinerModules = window\.GoldMinerModules \?\? \{\};/);
  assert.match(source, /function hasGoldMinerModuleInterface\(modules\)/);
  assert.match(source, /typeof modules\.createRandomStream === "function"/);
  assert.match(source, /typeof modules\.createSceneData === "function"/);
  assert.match(source, /typeof modules\.createRenderSnapshot === "function"/);
  assert.match(source, /typeof modules\.applyAudioEventsToFacade === "function"/);
  assert.match(source, /typeof modules\.createAudioButtonSnapshot === "function"/);
  assert.match(source, /typeof modules\.renderDebugSnapshotToText === "function"/);
  assert.match(source, /typeof modules\.createDebugAdvancePlan === "function"/);
  assert.match(source, /typeof modules\.createDebugShopSetup === "function"/);
  assert.match(source, /typeof modules\.createInitialGameState === "function"/);
  assert.match(source, /typeof modules\.stepPlayingState === "function"/);
  assert.match(source, /typeof modules\.createHudSnapshot === "function"/);
  assert.match(source, /typeof modules\.applyHudSnapshot === "function"/);
  assert.match(source, /typeof modules\.mapButtonInput === "function"/);
  assert.match(source, /typeof modules\.mapKeyboardInput === "function"/);
  assert.match(source, /typeof modules\.mapPointerInput === "function"/);
  assert.match(loadBody, /hasGoldMinerModuleInterface\(window\.GoldMinerModules\)/);
  assert.match(loadBody, /window\.__goldMinerModulesReady = false;/);
  assert.match(loadBody, /Preexisting GoldMinerModules does not expose the required interface/);
  assert.match(source, /async function loadGoldMinerModules\(\)/);
  assert.match(source, /import\("\.\/src\/runtime\/moduleBridge\.js"\)/);
  assert.match(source, /function setDebugApiFallback\(source\)/);
  assert.match(source, /function setStateKernelFallback\(source\)/);
  assert.match(loadBody, /setDebugApiFallback\(window\.GoldMinerModules\)/);
  assert.match(loadBody, /setStateKernelFallback\(window\.GoldMinerModules\)/);
  assert.match(loadBody, /setDebugApiFallback\(bridge\)/);
  assert.match(loadBody, /setStateKernelFallback\(bridge\)/);
  assert.match(loadBody, /setDebugApiFallback\(await import\("\.\/src\/testing\/debugApi\.js"\)\)/);
  assert.match(loadBody, /import\("\.\/src\/state\/createInitialState\.js"\)/);
  assert.match(loadBody, /import\("\.\/src\/state\/stateKernel\.js"\)/);
  assert.match(source, /async function boot\(\)/);
  assert.match(source, /await loadGoldMinerModules\(\);/);
  assert.match(source, /async function boot\(\)\s*\{\s*await loadGoldMinerModules\(\);/);
  assert.match(source, /^\s*boot\(\)\.catch\(\(error\) => \{\s*$/m);
  assert.match(source, /window\.__goldMinerBootError = error instanceof Error \? error\.message : String\(error\);/);
  assert.match(source, /console\.error\("Gold Miner failed to boot\.", error\);/);
});

test("game wrappers prefer runtime bridge modules when available", () => {
  const source = read("game.js");

  for (const key of [
    "clamp",
    "lerp",
    "dist2",
    "segmentCircleIntersect",
    "createRng",
    "createRandomStream",
    "createSceneData",
    "createRenderSnapshot",
    "applyAudioEventsToFacade",
    "createAudioButtonSnapshot",
    "renderDebugSnapshotToText",
    "createDebugAdvancePlan",
    "createDebugShopSetup",
    "createInitialGameState",
    "stepPlayingState",
    "createHudSnapshot",
    "applyHudSnapshot",
    "mapButtonInput",
    "mapKeyboardInput",
    "mapPointerInput",
    "formatMarketDelta",
    "createMarketDay",
    "ddaStage",
    "ddaBaseDifficulty",
    "ddaOverSignal",
    "postLevel4Pressure",
    "computeDdaTuning",
    "updateDdaRating",
    "getLevelConfig",
    "scaleItemValue",
    "generateLevelData",
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
  ]) {
    assert.match(source, new RegExp(`GoldMinerModules\\.${key}`), `game.js should reference ${key} from bridge`);
  }
});

test("game defines runtime event queue helpers and side-effect handlers", () => {
  const source = read("game.js");
  const initialSource = read("src/state/createInitialState.js");
  const eventTypesBody = extractFunctionBody(source, "eventTypes");
  const createRuntimeEventBody = extractFunctionBody(source, "createRuntimeEvent");
  const emitGameEventBody = extractFunctionBody(source, "emitGameEvent");
  const drainGameEventsBody = extractFunctionBody(source, "drainGameEvents");
  const processGameEventsBody = extractFunctionBody(source, "processGameEvents");
  const emitAudioEventBody = extractFunctionBody(source, "emitAudioEvent");
  const emitOverlayShowEventBody = extractFunctionBody(source, "emitOverlayShowEvent");
  const emitFxBurstEventBody = extractFunctionBody(source, "emitFxBurstEvent");
  const applyRuntimeAudioEventsBody = extractFunctionBody(source, "applyRuntimeAudioEvents");
  const applyRuntimeUiEventsBody = extractFunctionBody(source, "applyRuntimeUiEvents");
  const applyRuntimeFxEventsBody = extractFunctionBody(source, "applyRuntimeFxEvents");

  assert.match(source, /const FALLBACK_GAME_EVENT_TYPE = Object\.freeze\(\{/);
  assert.match(source, /AUDIO_PLAY: "AUDIO_PLAY"/);
  assert.match(source, /SCORE_POP: "SCORE_POP"/);
  assert.match(initialSource, /events:\s*\[\]/);
  assert.match(source, /const runtimeEventQueueMirror = \[\]/);
  assert.match(source, /let runtimeAudioEventAdapterEnabled = true/);
  assert.match(source, /let audioAdapterBridgeDisabled = false/);
  assert.match(source, /let runtimeUiEventAdapterEnabled = true/);
  assert.match(source, /let runtimeFxEventAdapterEnabled = true/);
  assert.match(source, /function createAudioButtonSnapshotForHost\(audio = window\.GameAudio\)/);
  assert.match(source, /function audioFacadeForHost\(\)/);
  assert.match(source, /function applyAudioEventsToFacadeWithLocalAdapter\(events, facade = audioFacadeForHost\(\)\)/);
  assert.match(source, /function noteAudioAdapterBridgeError\(error\)/);
  assert.match(source, /function eventTypes\(\)/);
  assert.match(source, /function cloneAndFreezeRuntimeValue\(value, seen = new WeakMap\(\)\)/);
  assert.match(source, /function createRuntimeEvent\(type, payload = \{\}\)/);
  assert.match(source, /function emitGameEvent\(eventOrType, payload = \{\}\)/);
  assert.match(source, /function drainGameEvents\(\)/);
  assert.match(source, /function processGameEvents\(\)/);
  assert.match(source, /function emitAudioEvent\(name, options\)/);
  assert.match(source, /function emitOverlayShowEvent\(config\)/);
  assert.match(source, /function emitFxBurstEvent\(payload\)/);
  assert.match(source, /function applyRuntimeAudioEvents\(events\)/);
  assert.match(source, /function applyRuntimeUiEvents\(events\)/);
  assert.match(source, /function applyRuntimeFxEvents\(events\)/);

  assert.match(eventTypesBody, /GoldMinerModules\.GameEventType/);
  assert.match(createRuntimeEventBody, /GoldMinerModules\.gameEvent/);
  assert.match(createRuntimeEventBody, /cloneAndFreezeRuntimeValue\(payload\)/);
  assert.match(emitGameEventBody, /GoldMinerModules\.enqueueEvent/);
  assert.match(emitGameEventBody, /runtimeEventQueueMirror\.push\(queuedEvent\)/);
  assert.match(emitGameEventBody, /game\.events = runtimeEventQueueMirror\.slice\(\)/);
  assert.match(drainGameEventsBody, /GoldMinerModules\.drainEvents/);
  assert.match(drainGameEventsBody, /replaceRuntimeEventMirror\(\[\]\)/);
  assert.match(drainGameEventsBody, /const pendingEvents = runtimeEventQueueMirror\.slice\(\)/);
  assert.match(processGameEventsBody, /drainGameEvents\(\)/);
  assert.match(processGameEventsBody, /applyRuntimeAudioEvents\(events\)/);
  assert.match(processGameEventsBody, /applyRuntimeUiEvents\(events\)/);
  assert.match(processGameEventsBody, /applyRuntimeFxEvents\(events\)/);
  assert.match(emitAudioEventBody, /emitGameEvent\(eventTypes\(\)\.AUDIO_PLAY, payload\)/);
  assert.match(emitOverlayShowEventBody, /emitGameEvent\(eventTypes\(\)\.OVERLAY_SHOW, \{ config \}\)/);
  assert.match(emitFxBurstEventBody, /emitGameEvent\(eventTypes\(\)\.FX_BURST, payload\)/);

  assert.match(applyRuntimeAudioEventsBody, /GoldMinerModules\.applyAudioEventsToFacade/);
  assert.match(applyRuntimeAudioEventsBody, /GoldMinerModules\.applyEventsWithFallback/);
  assert.match(applyRuntimeAudioEventsBody, /runtimeAudioEventAdapterEnabled/);
  assert.match(applyRuntimeAudioEventsBody, /audioAdapterBridgeDisabled/);
  assert.match(applyRuntimeAudioEventsBody, /applyAudioEventsToFacadeWithLocalAdapter\(eventBatch, facade\)/);
  assert.match(applyRuntimeAudioEventsBody, /GoldMinerModules\.applyAudioEventsToFacade\(eventBatch, facade\)/);
  assert.match(applyRuntimeAudioEventsBody, /GoldMinerModules\.applyAudioEventsToFacade\(\[events\[index\]\], facade\)/);
  assert.match(applyRuntimeAudioEventsBody, /noteAudioAdapterBridgeError\(error\)/);
  assert.match(applyRuntimeAudioEventsBody, /catch \(error\) \{\s*noteRuntimeEventBridgeError\(error\);\s*noteAudioAdapterBridgeError\(error\);\s*runtimeAudioEventAdapterEnabled = false;\s*events = events\.slice\(index \+ 1\);\s*break;\s*\}/);

  assert.match(applyRuntimeUiEventsBody, /GoldMinerModules\.applyUiEvents/);
  assert.match(applyRuntimeUiEventsBody, /GoldMinerModules\.applyEventsWithFallback/);
  assert.match(applyRuntimeUiEventsBody, /runtimeUiEventAdapterEnabled/);
  assert.match(applyRuntimeUiEventsBody, /GoldMinerModules\.applyUiEvents\(\[events\[index\]\], handlers\)/);
  assert.match(applyRuntimeUiEventsBody, /updateHud\(\)/);
  assert.match(applyRuntimeUiEventsBody, /showOverlay\(event\.payload\.config\)/);
  assert.match(applyRuntimeUiEventsBody, /hideOverlay\(\)/);
  assert.match(applyRuntimeUiEventsBody, /renderShop\(\)/);
  assert.match(applyRuntimeUiEventsBody, /catch \(error\) \{\s*noteRuntimeEventBridgeError\(error\);\s*runtimeUiEventAdapterEnabled = false;\s*events = events\.slice\(index \+ 1\);\s*break;\s*\}/);

  assert.match(applyRuntimeFxEventsBody, /GoldMinerModules\.applyFxEvents/);
  assert.match(applyRuntimeFxEventsBody, /GoldMinerModules\.applyEventsWithFallback/);
  assert.match(applyRuntimeFxEventsBody, /runtimeFxEventAdapterEnabled/);
  assert.match(applyRuntimeFxEventsBody, /GoldMinerModules\.applyFxEvents\(\[events\[index\]\], handlers\)/);
  assert.match(applyRuntimeFxEventsBody, /spawnRing\(event\.payload\)/);
  assert.match(applyRuntimeFxEventsBody, /spawnBurst\(event\.payload\)/);
  assert.match(applyRuntimeFxEventsBody, /addScorePop\(\s*event\.payload\.amount,\s*event\.payload\.color,/);
  assert.match(applyRuntimeFxEventsBody, /game\.fx\.flash = Math\.max\(game\.fx\.flash,/);
  assert.match(applyRuntimeFxEventsBody, /game\.fx\.shake = Math\.max\(game\.fx\.shake,/);
  assert.match(applyRuntimeFxEventsBody, /catch \(error\) \{\s*noteRuntimeEventBridgeError\(error\);\s*runtimeFxEventAdapterEnabled = false;\s*events = events\.slice\(index \+ 1\);\s*break;\s*\}/);
});

test("selected gameplay side effects are routed through runtime events", () => {
  const source = read("game.js");
  const bodies = Object.fromEntries(
    [
      "dropHookFor",
      "useBomb",
      "explodeAt",
      "dropKeg",
      "attachToHook",
      "deliverAttachedItem",
      "update",
    ].map((functionName) => [functionName, extractFunctionBody(source, functionName)]),
  );

  for (const [functionName, body] of Object.entries(bodies)) {
    assert.doesNotMatch(body, /\baudioInit\(\)/, `${functionName} should not initialize audio directly`);
    assert.doesNotMatch(body, /\baudioPlay\(/, `${functionName} should not play audio directly`);
  }

  for (const functionName of ["useBomb", "explodeAt", "dropKeg", "attachToHook", "deliverAttachedItem"]) {
    assert.doesNotMatch(bodies[functionName], /\bspawnRing\(/, `${functionName} should emit ring events`);
    assert.doesNotMatch(bodies[functionName], /\bspawnBurst\(/, `${functionName} should emit burst events`);
  }

  for (const functionName of ["useBomb", "explodeAt", "attachToHook"]) {
    assert.doesNotMatch(
      bodies[functionName],
      /game\.fx\.(?:shake|flash)\s*=/,
      `${functionName} should emit flash and shake events`,
    );
  }

  assert.match(bodies.dropHookFor, /emitAudioEvent\("hook_shoot"\);\s*processGameEvents\(\);/);

  assert.match(bodies.useBomb, /emitAudioEvent\("bomb"\)/);
  assert.match(bodies.useBomb, /emitFxShakeEvent\(0\.28\)/);
  assert.match(bodies.useBomb, /emitFxFlashEvent\(0\.16\)/);
  assert.match(bodies.useBomb, /emitFxRingEvent\(\{/);
  assert.match(bodies.useBomb, /emitFxBurstEvent\(\{/);
  assert.match(bodies.useBomb, /emitHudUpdateEvent\(\)/);
  assert.match(bodies.useBomb, /processGameEvents\(\)/);
  assert.doesNotMatch(bodies.useBomb, /\bupdateHud\(\)/);

  assert.match(bodies.explodeAt, /emitAudioEvent\("bomb"\)/);
  assert.match(bodies.explodeAt, /emitFxShakeEvent\(0\.26 \+ 0\.18 \* pow\)/);
  assert.match(bodies.explodeAt, /emitFxFlashEvent\(0\.14 \+ 0\.12 \* pow\)/);
  assert.match(bodies.explodeAt, /emitFxRingEvent\(\{/);
  assert.match(bodies.explodeAt, /emitFxBurstEvent\(\{/);
  assert.match(bodies.explodeAt, /processGameEvents\(\)/);

  assert.match(bodies.dropKeg, /emitAudioEvent\("hook_retract_empty"\)/);
  assert.match(bodies.dropKeg, /emitFxRingEvent\(\{/);
  assert.match(bodies.dropKeg, /processGameEvents\(\)/);

  assert.match(bodies.attachToHook, /emitAudioEvent\(getHookCatchSfx\(item\)/);
  assert.match(bodies.attachToHook, /weight: item\.weight/);
  assert.match(bodies.attachToHook, /cargo: item\.mouse\?\.cargo \?\? null/);
  assert.match(bodies.attachToHook, /emitAudioEvent\("hook_retract_carry"/);
  assert.match(bodies.attachToHook, /type: item\.type/);
  assert.match(bodies.attachToHook, /emitFxRingEvent\(\{/);
  assert.match(bodies.attachToHook, /x: p\.x/);
  assert.match(bodies.attachToHook, /y: p\.y/);
  assert.match(bodies.attachToHook, /r0: 6/);
  assert.match(bodies.attachToHook, /r1: 28/);
  assert.match(bodies.attachToHook, /life: 0\.28/);
  assert.match(bodies.attachToHook, /width: 2\.5/);
  assert.match(bodies.attachToHook, /emitFxBurstEvent\(\{/);
  assert.match(bodies.attachToHook, /emitFxShakeEvent\(0\.08\)/);
  assert.ok(
    bodies.attachToHook.indexOf("processGameEvents();") < bodies.attachToHook.indexOf("explodeKegAt(p.x, p.y);"),
    "attachToHook should process catch audio before immediate keg explosions",
  );

  assert.match(bodies.deliverAttachedItem, /hook === game\.hook2 \? 1 : 0/);
  assert.match(bodies.deliverAttachedItem, /createDeliveryResultForHost\(\{ score: game\.score, item, playerIndex: player \}\)/);
  assert.match(bodies.deliverAttachedItem, /game\.score = nextScore/);
  assert.match(bodies.deliverAttachedItem, /game\.items = game\.items\.filter/);
  assert.match(bodies.deliverAttachedItem, /emitAudioEvent\("score", delivery\.scoreAudioPayload\)/);
  assert.match(bodies.deliverAttachedItem, /emitScorePopEvent\(delivery\.scorePopPayload\)/);
  assert.match(bodies.deliverAttachedItem, /emitFxRingEvent\(mergePivotOffsetPayload\(delivery\.ringPayload, pivot\)\)/);
  assert.match(bodies.deliverAttachedItem, /emitFxBurstEvent\(mergePivotOffsetPayload\(delivery\.burstPayload, pivot\)\)/);
  assert.match(bodies.deliverAttachedItem, /processGameEvents\(\)/);
  assert.doesNotMatch(bodies.deliverAttachedItem, /\baddScorePop\(/);
  assert.doesNotMatch(bodies.deliverAttachedItem, /emitScorePopEvent\([^)]*hook/s);

  assert.ok(
    bodies.update.indexOf('emitAudioEvent("countdown");') < bodies.update.indexOf("processGameEvents();"),
    "update should drain countdown audio events immediately",
  );
  assert.ok(
    bodies.update.indexOf('emitAudioEvent("hook_retract_empty");') < bodies.update.lastIndexOf("processGameEvents();"),
    "update should drain empty-retract audio events immediately",
  );
});

test("gameplay random streams keep keg outcomes deterministic while visual randomness stays ambient", () => {
  const source = read("game.js");
  const bridgeSource = read("src/runtime/moduleBridge.js");
  const randomStreamSource = read("src/core/randomStreams.js");
  const initialSource = read("src/state/createInitialState.js");
  const attachBody = extractFunctionBody(source, "attachToHook");
  const resetBody = extractFunctionBody(source, "resetGameplayRandomStreams");
  const streamFactoryBody = extractFunctionBody(source, "createRandomStreamForHost");
  const localStreamBody = extractFunctionBody(source, "createRandomStreamWithLocalState");
  const kegDecisionBody = extractFunctionBody(source, "shouldKegExplodeImmediately");
  const spawnBurstBody = extractFunctionBody(source, "spawnBurst");
  const addScorePopBody = extractFunctionBody(source, "addScorePop");
  const localUpdateFxBody = extractFunctionBody(source, "updateFxWithLocalState");
  const updateFxBody = extractFunctionBody(source, "updateFx");

  assert.doesNotMatch(attachBody, /Math\.random\(\)/);
  assert.match(attachBody, /shouldKegExplodeImmediately\(\)/);
  assert.match(kegDecisionBody, /getGameplayRandomStream\("kegImmediate", GAMEPLAY_RANDOM_STREAM_SALTS\.kegImmediate\)/);
  assert.match(kegDecisionBody, /KEG_IMMEDIATE_BOOM_CHANCE/);

  assert.match(initialSource, /randomStreams:\s*\{\}/);
  assert.match(source, /let randomStreamsBridgeDisabled = false;/);
  assert.match(source, /window\.__goldMinerRandomStreamsError =/);
  assert.match(resetBody, /kegImmediate: createRandomStreamForHost\(/);
  assert.match(streamFactoryBody, /GoldMinerModules\.createRandomStream\(options\)/);
  assert.match(streamFactoryBody, /createRandomStreamWithLocalState\(options\)/);
  assert.match(localStreamBody, /createRng\(createRandomStreamSeedWithLocalState\(options\)\)/);

  assert.match(randomStreamSource, /import \{ createRng \} from "\.\/rng\.js";/);
  assert.match(randomStreamSource, /export function createRandomStream\(options\)/);
  assert.doesNotMatch(randomStreamSource, /\bMath\.random\b/);
  assert.doesNotMatch(randomStreamSource, /\bDate\b/);
  assert.doesNotMatch(randomStreamSource, /\bwindow\b/);
  assert.doesNotMatch(randomStreamSource, /\bdocument\b/);

  assert.match(bridgeSource, /import \{ createRandomStream \} from "\.\.\/core\/randomStreams\.js";/);
  assert.match(bridgeSource, /export \{ createRandomStream \};/);
  assert.match(bridgeSource, /createRandomStream,/);

  assert.match(spawnBurstBody, /Math\.random\(\) \* Math\.PI \* 2/);
  assert.match(spawnBurstBody, /Math\.random\(\)/);
  assert.match(addScorePopBody, /Math\.random\(\)/);
  assert.match(localUpdateFxBody, /Math\.random\(\) \* 2 - 1/);
  assert.match(updateFxBody, /GoldMinerModules\.updateFxState\(game\.fx, dt, Math\.random\)/);
});

test("delivery scoring is a bridge-first pure system boundary with host side effects", () => {
  const source = read("game.js");
  const bridgeSource = read("src/runtime/moduleBridge.js");
  const scoringSource = read("src/systems/scoringSystem.js");
  const localBody = extractFunctionBody(source, "createDeliveryResultWithLocalScoring");
  const bridgeBody = extractFunctionBody(source, "createDeliveryResultForHost");
  const mergeBody = extractFunctionBody(source, "mergePivotOffsetPayload");
  const deliverBody = extractFunctionBody(source, "deliverAttachedItem");

  assert.match(bridgeSource, /import \{ createDeliveryResult \} from "\.\.\/systems\/scoringSystem\.js";/);
  assert.match(bridgeSource, /export \{ createDeliveryResult \};/);
  assert.match(bridgeSource, /createDeliveryResult,/);

  assert.match(scoringSource, /export function createDeliveryResult/);
  for (const forbidden of [
    /\bwindow\b/,
    /\bdocument\b/,
    /\bgame\b/,
    /\bctx\b/,
    /\bemitAudioEvent\b/,
    /\bemitScorePopEvent\b/,
    /\bemitFxRingEvent\b/,
    /\bemitFxBurstEvent\b/,
    /\bprocessGameEvents\b/,
    /\baudioPlay\b/,
    /\bspawnRing\b/,
    /\bspawnBurst\b/,
  ]) {
    assert.doesNotMatch(scoringSource, forbidden, "scoring system should remain free of host side effects");
  }

  assert.match(source, /let scoringSystemBridgeDisabled = false;/);
  assert.match(bridgeBody, /GoldMinerModules\.createDeliveryResult/);
  assert.match(bridgeBody, /!scoringSystemBridgeDisabled/);
  assert.match(bridgeBody, /scoringSystemBridgeDisabled = true/);
  assert.match(bridgeBody, /Object\.prototype\.hasOwnProperty\.call\(window, "__goldMinerScoringSystemError"\)/);
  assert.match(bridgeBody, /window\.__goldMinerScoringSystemError =/);
  assert.match(bridgeBody, /createDeliveryResultWithLocalScoring\(options\)/);

  assert.match(localBody, /item\.type === "bag" \? item\.bagValue \?\? item\.value : item\.value/);
  assert.match(localBody, /itemFxColor\(item\)/);
  assert.match(localBody, /nextScore: score \+ earned/);
  assert.match(localBody, /scorePopPayload: \{ amount: earned, color, player: playerIndex \}/);
  assert.match(localBody, /scoreAudioPayload: \{ amount: earned \}/);
  assert.match(localBody, /r0: 10/);
  assert.match(localBody, /r1: 54/);
  assert.match(localBody, /life: 0\.55/);
  assert.match(localBody, /width: 3/);
  assert.match(localBody, /yOffset: 18/);
  assert.match(localBody, /count: clamp\(Math\.round\(10 \+ item\.r \/ 3\), 10, 18\)/);
  assert.match(localBody, /colors: \[color, "#ffffff", "#ffe08a"\]/);
  assert.match(localBody, /gravity: 520/);

  assert.match(mergeBody, /const \{ yOffset = 0, \.\.\.rest \} = payload/);
  assert.match(mergeBody, /x: pivot\.x/);
  assert.match(mergeBody, /y: pivot\.y \+ yOffset/);

  assert.match(deliverBody, /const player = hook === game\.hook2 \? 1 : 0/);
  assert.match(deliverBody, /const delivery = createDeliveryResultForHost\(\{ score: game\.score, item, playerIndex: player \}\)/);
  assert.match(deliverBody, /game\.score = nextScore/);
  assert.match(deliverBody, /game\.dda\.firstClearTimeLeft = game\.timeLeft/);
  assert.match(deliverBody, /game\.items = game\.items\.filter/);
  assert.match(deliverBody, /emitAudioEvent\("score", delivery\.scoreAudioPayload\)/);
  assert.match(deliverBody, /emitScorePopEvent\(delivery\.scorePopPayload\)/);
  assert.match(deliverBody, /emitFxRingEvent\(mergePivotOffsetPayload\(delivery\.ringPayload, pivot\)\)/);
  assert.match(deliverBody, /emitFxBurstEvent\(mergePivotOffsetPayload\(delivery\.burstPayload, pivot\)\)/);
  assert.match(deliverBody, /processGameEvents\(\)/);
});

test("HUD updates use the UI adapter bridge first with a local DOM fallback", () => {
  const source = read("game.js");
  const bridgeSource = read("src/runtime/moduleBridge.js");
  const adapterSource = read("src/ui/domUiAdapter.js");
  const updateBody = extractFunctionBody(source, "updateHud");
  const localBody = extractFunctionBody(source, "updateHudWithLocalDom");

  assert.match(bridgeSource, /import \{ applyHudSnapshot, createHudSnapshot \} from "\.\.\/ui\/domUiAdapter\.js";/);
  assert.match(bridgeSource, /export \{ applyHudSnapshot, createHudSnapshot \};/);
  assert.match(bridgeSource, /createHudSnapshot,/);
  assert.match(bridgeSource, /applyHudSnapshot,/);

  assert.match(adapterSource, /export function createHudSnapshot\(\{ game, canBomb \}\)/);
  assert.match(adapterSource, /export function applyHudSnapshot\(\{ ui, uiRefs, snapshot, previous, bump \}\)/);
  for (const forbidden of [
    /\bwindow\b/,
    /\bdocument\b/,
    /\bglobalThis\b/,
    /\blocalStorage\b/,
    /\bgetHooks\b/,
    /\battachedItem\b/,
    /\bemit[A-Z]\w*\b/,
    /\baudio(?:Init|Play)\b/,
    /\bspawn(?:Ring|Burst)\b/,
    /\bprocessGameEvents\b/,
    /\bctx\b/,
    /\bMath\.random\b/,
  ]) {
    assert.doesNotMatch(adapterSource, forbidden, "UI adapter should not access host side effects");
  }

  assert.match(source, /let uiAdapterBridgeDisabled = false;/);
  assert.match(source, /function noteUiAdapterBridgeError\(error\)/);
  assert.match(source, /window\.__goldMinerUiAdapterError =/);
  assert.match(source, /function updateHudWithLocalDom\(canBomb\)/);

  assert.match(updateBody, /const canBomb =\s*game\.phase === "playing" &&\s*!game\.paused &&\s*game\.inventory\.bombs > 0 &&\s*getHooks\(\)\.some\(\(hook\) => hook\.state === "retract" && attachedItem\(hook\)\)/);
  assert.match(updateBody, /!uiAdapterBridgeDisabled/);
  assert.match(updateBody, /GoldMinerModules\.createHudSnapshot/);
  assert.match(updateBody, /GoldMinerModules\.applyHudSnapshot/);
  assert.match(updateBody, /const snapshot = GoldMinerModules\.createHudSnapshot\(\{ game, canBomb \}\);/);
  assert.match(
    updateBody,
    /GoldMinerModules\.applyHudSnapshot\(\{\s*ui,\s*uiRefs,\s*snapshot,\s*previous: hudPrev,\s*bump,\s*\}\);/s,
  );
  assert.match(updateBody, /catch \(error\) \{\s*noteUiAdapterBridgeError\(error\);\s*\}/);
  assert.match(updateBody, /updateHudWithLocalDom\(canBomb\);/);
  assert.ok(
    updateBody.indexOf("GoldMinerModules.createHudSnapshot") < updateBody.indexOf("updateHudWithLocalDom(canBomb);"),
    "updateHud should try the bridge before the local fallback",
  );
  assert.doesNotMatch(updateBody, /ui\.\w+\.textContent/);
  assert.doesNotMatch(updateBody, /uiRefs\.timeStat\?\.classList\.toggle/);

  assert.match(localBody, /ui\.level\.textContent = String\(game\.level\);/);
  assert.match(localBody, /ui\.score\.textContent = String\(score\);/);
  assert.match(localBody, /ui\.target\.textContent = String\(Math\.floor\(game\.target\)\);/);
  assert.match(localBody, /ui\.time\.textContent = String\(Math\.ceil\(game\.timeLeft\)\);/);
  assert.match(localBody, /ui\.bombs\.textContent = String\(bombs\);/);
  assert.match(localBody, /ui\.speedTokens\.textContent = String\(speed\);/);
  assert.match(localBody, /ui\.luckyTokens\.textContent = String\(lucky\);/);
  assert.match(localBody, /if \(bombs !== hudPrev\.bombs\) bump\(uiRefs\.bombChip\);/);
  assert.match(localBody, /if \(speed !== hudPrev\.speed\) bump\(uiRefs\.speedChip\);/);
  assert.match(localBody, /if \(lucky !== hudPrev\.lucky\) bump\(uiRefs\.luckyChip\);/);
  assert.match(localBody, /if \(score !== hudPrev\.score && score > hudPrev\.score\) bump\(uiRefs\.scoreStat\);/);
  assert.match(
    localBody,
    /uiRefs\.timeStat\?\.classList\.toggle\(\s*"danger",\s*game\.phase === "playing" && !game\.paused && game\.timeLeft <= 10\s*\);/s,
  );
  assert.match(localBody, /ui\.pauseBtn\.disabled = !inGame \|\| game\.phase !== "playing";/);
  assert.match(localBody, /ui\.restartBtn\.disabled = !inGame;/);
  assert.match(localBody, /ui\.startBtn\.disabled = game\.phase !== "menu";/);
  assert.match(localBody, /ui\.bombBtn\.disabled = !canBomb;/);
  assert.match(localBody, /ui\.pauseBtn\.textContent = game\.paused \? "继续" : "暂停";/);
  assert.match(localBody, /ui\.marketTicker\.textContent = "当日行情：进入关卡后开盘";/);
  assert.match(localBody, /ui\.marketTicker\.textContent = `当日行情\[\$\{name\}\] \$\{summary\}`;/);
});

test("game level generation prefers runtime bridge data generator", () => {
  const source = read("game.js");
  const generateLevelBody = extractFunctionBody(source, "generateLevel");

  assert.match(source, /GoldMinerModules\.generateLevelData/);
  assert.match(source, /function applyGeneratedLevelData\(levelData\)/);
  assert.match(generateLevelBody, /if \(GoldMinerModules\.generateLevelData\)\s*\{\s*try\s*\{/);
  assert.match(
    generateLevelBody,
    /const levelData = GoldMinerModules\.generateLevelData\(\{\s*level,\s*runSeed: game\.runSeed,\s*viewport: game\.viewport,\s*mode: game\.mode,\s*ddaRating: game\.dda\?\.rating \?\? 0,\s*extraBags: options\.extraBags \?\? 0,/s,
  );
  assert.match(generateLevelBody, /applyGeneratedLevelData\(levelData\);/);
  assert.match(generateLevelBody, /window\.GameAudio\?\.setTrackFromSeed\?\.?\(levelData\.seed\);/);
  assert.match(generateLevelBody, /buildScene\(levelData\.seed\);/);
  assert.match(generateLevelBody, /recalcHookMaxLength\(\);/);
  assert.match(generateLevelBody, /for \(const hook of getHooks\(\)\) resetHook\(hook\);/);
  assert.match(generateLevelBody, /catch \(error\)/);
  assert.match(generateLevelBody, /window\.__goldMinerLevelGeneratorError =/);
  assert.match(generateLevelBody, /Gold Miner module level generator failed; using legacy level generation/);
  assert.ok(
    generateLevelBody.indexOf("catch (error)") < generateLevelBody.indexOf("const config = getLevelConfig(level);"),
    "legacy generation should remain after the bridge failure catch",
  );
});

test("game scene generation prefers bridge scene system with local fallback", () => {
  const source = read("game.js");
  const buildSceneBody = extractFunctionBody(source, "buildScene");

  assert.match(source, /let sceneSystemBridgeDisabled = false;/);
  assert.match(buildSceneBody, /GoldMinerModules\.createSceneData/);
  assert.match(buildSceneBody, /!sceneSystemBridgeDisabled/);
  assert.match(buildSceneBody, /sceneSystemBridgeDisabled = true/);
  assert.match(buildSceneBody, /window\.__goldMinerSceneSystemError =/);
  assert.match(buildSceneBody, /const scene = GoldMinerModules\.createSceneData\(\{/);
  assert.match(buildSceneBody, /seed,/);
  assert.match(buildSceneBody, /viewport: game\.viewport,/);
  assert.match(buildSceneBody, /background: BACKGROUNDS\[game\.bgIndex\] \?\? null,/);
  assert.match(buildSceneBody, /game\.scene\.stars = scene\.stars;/);
  assert.match(buildSceneBody, /game\.scene\.dust = scene\.dust;/);
  assert.match(buildSceneBody, /game\.scene\.dirt = scene\.dirt;/);
  assert.match(buildSceneBody, /const rng = createRng\(\(seed \^ 0x9e3779b9\) >>> 0\);/);
  assert.match(buildSceneBody, /const starCount = clamp\(Math\.floor\(\(w \* groundY\) \/ 19000\), 36, 76\);/);
});

test("game render orchestration is routed through render pipeline helpers", () => {
  const source = read("game.js");
  const createRenderPlayersBody = extractFunctionBody(source, "createRenderPlayers");
  const renderLayerHandlersBody = extractFunctionBody(source, "renderLayerHandlers");
  const renderFrameWithLocalLayersBody = extractFunctionBody(source, "renderFrameWithLocalLayers");
  const renderBody = extractFunctionBody(source, "render");

  assert.match(source, /function createRenderPlayers\(\)/);
  assert.match(source, /function renderLayerHandlers\(\)/);
  assert.match(source, /function renderFrameWithLocalLayers\(options\)/);
  assert.match(source, /function createRenderSnapshotWithLocalData\(/);
  assert.match(source, /let renderOrderBridgeDisabled = false;/);
  assert.match(source, /let renderSnapshotBridgeDisabled = false;/);
  assert.match(source, /let renderFrameBridgeDisabled = false;/);

  assert.match(createRenderPlayersBody, /GoldMinerModules\.createPlayerRenderOrder/);
  assert.match(createRenderPlayersBody, /!renderOrderBridgeDisabled/);
  assert.match(createRenderPlayersBody, /renderOrderBridgeDisabled = true/);
  assert.match(createRenderPlayersBody, /getHooks\(\)/);
  assert.match(createRenderPlayersBody, /getMinerByIndex/);
  assert.match(createRenderPlayersBody, /getPivot/);
  assert.match(createRenderPlayersBody, /pivotX/);

  for (const layerName of [
    "background",
    "plank",
    "minerBack",
    "winch",
    "minerFront",
    "items",
    "hookTrail",
    "hook",
    "carryLabel",
    "fx",
  ]) {
    assert.match(renderLayerHandlersBody, new RegExp(`${layerName}:`), `render layers should include ${layerName}`);
  }

  assert.match(renderFrameWithLocalLayersBody, /callLayer\("background"\)/);
  assert.match(renderFrameWithLocalLayersBody, /callLayer\("fx"\)/);
  assert.match(renderFrameWithLocalLayersBody, /callPlayerLayer\("minerBack"\)/);
  assert.match(renderFrameWithLocalLayersBody, /callPlayerLayer\("hookTrail"\)/);
  assert.match(renderFrameWithLocalLayersBody, /frameCtx\.setTransform\(1, 0, 0, 1, 0, 0\)/);
  assert.match(renderFrameWithLocalLayersBody, /frameCtx\.clearRect\(0, 0, frameCanvas\.width, frameCanvas\.height\)/);
  assert.match(renderFrameWithLocalLayersBody, /frameCtx\.fillStyle = "#fff1c4"/);
  assert.match(renderFrameWithLocalLayersBody, /frameCtx\.fillStyle = "#ff2a2a"/);

  assert.match(renderBody, /createRenderPlayers\(\)/);
  assert.match(renderBody, /renderLayerHandlers\(\)/);
  assert.match(renderBody, /GoldMinerModules\.createRenderSnapshot/);
  assert.match(renderBody, /!renderSnapshotBridgeDisabled/);
  assert.match(renderBody, /renderSnapshotBridgeDisabled = true/);
  assert.match(renderBody, /window\.__goldMinerRenderSnapshotError =/);
  assert.match(renderBody, /createRenderSnapshotWithLocalData\(/);
  assert.match(renderBody, /GoldMinerModules\.renderFrameWithLayers/);
  assert.match(renderBody, /!renderFrameBridgeDisabled/);
  assert.match(renderBody, /renderFrameBridgeDisabled = true/);
  assert.match(renderBody, /renderFrameWithLocalLayers\(options\)/);
  assert.match(renderBody, /window\.__goldMinerRenderPipelineError =/);
  assert.match(renderBody, /Gold Miner render pipeline failed; using local render fallback/);
  assert.doesNotMatch(renderBody, /for \(const p of players\) drawMinerBack/);
  assert.doesNotMatch(renderBody, /for \(const p of players\) drawHookTrail/);
  assert.doesNotMatch(renderBody, /game\.fx\.flash > 0/);
  assert.doesNotMatch(renderBody, /game\.timeLeft <= 10/);
});

test("scene and render snapshot modules stay pure runtime boundaries", () => {
  const sceneSource = read("src/render/sceneSystem.js");
  const snapshotSource = read("src/render/renderSnapshot.js");

  for (const source of [sceneSource, snapshotSource]) {
    assert.doesNotMatch(source, /\bwindow\b/);
    assert.doesNotMatch(source, /\bdocument\b/);
    assert.doesNotMatch(source, /\bperformance\b/);
  }

  assert.match(sceneSource, /import \{ clamp \} from "\.\.\/core\/geometry\.js";/);
  assert.match(sceneSource, /import \{ createRng \} from "\.\.\/core\/rng\.js";/);
  assert.match(sceneSource, /export function createSceneData/);
  assert.match(snapshotSource, /export function createRenderSnapshot/);
});

test("game background and plank drawing prefer bridge renderers with local fallback", () => {
  const source = read("game.js");
  const backgroundOptionsBody = extractFunctionBody(source, "backgroundLayerOptions");
  const localBackgroundBody = extractFunctionBody(source, "drawBackgroundWithLocalLayer");
  const drawBackgroundBody = extractFunctionBody(source, "drawBackground");
  const plankOptionsBody = extractFunctionBody(source, "plankLayerOptions");
  const localPlankBody = extractFunctionBody(source, "drawPlankWithLocalLayer");
  const drawPlankBody = extractFunctionBody(source, "drawPlank");

  assert.match(source, /let backgroundLayerBridgeDisabled = false;/);
  assert.match(source, /let plankLayerBridgeDisabled = false;/);
  assert.match(source, /function drawBackgroundWithLocalLayer\(options = backgroundLayerOptions\(\)\)/);
  assert.match(source, /function drawPlankWithLocalLayer\(options = plankLayerOptions\(\)\)/);

  assert.match(backgroundOptionsBody, /background: bg/);
  assert.match(backgroundOptionsBody, /scene: game\.scene/);
  assert.match(backgroundOptionsBody, /colors: COLORS/);
  assert.match(localBackgroundBody, /drawImageCover\(image, 0, 0, w, h\)/);
  assert.match(localBackgroundBody, /colors\.skyTop/);
  assert.match(localBackgroundBody, /scene\.stars/);
  assert.match(localBackgroundBody, /scene\.dust/);
  assert.match(drawBackgroundBody, /!backgroundLayerBridgeDisabled/);
  assert.match(drawBackgroundBody, /GoldMinerModules\.drawBackgroundLayer\(options\)/);
  assert.match(drawBackgroundBody, /backgroundLayerBridgeDisabled = true/);
  assert.match(drawBackgroundBody, /window\.__goldMinerBackgroundRendererError =/);
  assert.match(drawBackgroundBody, /drawBackgroundWithLocalLayer\(options\)/);

  assert.match(plankOptionsBody, /plankY: getPlankY\(\)/);
  assert.match(plankOptionsBody, /plankHeight: BASE\.plankHeight \?\? 22/);
  assert.match(plankOptionsBody, /colors: COLORS/);
  assert.match(localPlankBody, /colors\.wood/);
  assert.match(drawPlankBody, /!plankLayerBridgeDisabled/);
  assert.match(drawPlankBody, /GoldMinerModules\.drawPlankLayer\(options\)/);
  assert.match(drawPlankBody, /plankLayerBridgeDisabled = true/);
  assert.match(drawPlankBody, /window\.__goldMinerPlankRendererError =/);
  assert.match(drawPlankBody, /drawPlankWithLocalLayer\(options\)/);
});

test("game item layer drawing prefers bridge renderer while keeping concrete item drawing local", () => {
  const source = read("game.js");
  const rendererSource = read("src/render/itemRenderer.js");
  const itemLayerOptionsBody = extractFunctionBody(source, "itemLayerOptions");
  const localOrderBody = extractFunctionBody(source, "createLocalItemRenderOrder");
  const localItemsBody = extractFunctionBody(source, "drawItemsWithLocalLayer");
  const drawItemsBody = extractFunctionBody(source, "drawItems");
  const itemShapeOptionsBody = extractFunctionBody(source, "itemShapeLayerOptions");
  const localItemShapeBody = extractFunctionBody(source, "drawItemWithLocalLayer");
  const drawItemBody = extractFunctionBody(source, "drawItem");

  assert.match(source, /let itemLayerBridgeDisabled = false;/);
  assert.match(source, /let itemShapeLayerBridgeDisabled = false;/);
  assert.match(source, /function itemLayerOptions\(\)/);
  assert.match(source, /function hasRenderableAttachedId\(attachedId\)/);
  assert.match(source, /function createLocalItemRenderOrder\(\{ items, hooks \}\)/);
  assert.match(source, /function drawItemsWithLocalLayer\(options = itemLayerOptions\(\)\)/);
  assert.match(source, /function withSavedItemShape\(drawCtx, draw\)/);
  assert.match(source, /function blobPathForItemShape\(drawCtx, blob, radius\)/);
  assert.match(source, /function roundRectPathForItemShape\(drawCtx, x, y, w, h, r\)/);
  assert.match(source, /function itemShapeLayerOptions\(item, metadata = \{\}\)/);
  assert.match(source, /function drawItemWithLocalLayer\(options = itemShapeLayerOptions\(\)\)/);
  assert.match(source, /function drawItem\(item, metadata\)/);

  assert.match(itemLayerOptionsBody, /items: game\.items/);
  assert.match(itemLayerOptionsBody, /hooks: getHooks\(\)/);
  assert.match(itemLayerOptionsBody, /drawItem: \(item, metadata\) => drawItem\(item, metadata\)/);
  assert.match(source, /Number\.isInteger\(attachedId\) && attachedId > 0/);
  assert.match(localOrderBody, /hasRenderableAttachedId\(hook\?\.attachedId\)/);
  assert.match(localOrderBody, /\.sort\(\(a, b\) => a\.y - b\.y\)/);
  assert.match(localOrderBody, /attached: false/);
  assert.match(localOrderBody, /hookIndex: null/);
  assert.match(localOrderBody, /drawnAttachedIds/);
  assert.match(localOrderBody, /attached: true/);
  assert.match(localItemsBody, /const \{ items, hooks, drawItem: drawLayerItem \} = options;/);
  assert.match(localItemsBody, /const order = createLocalItemRenderOrder\(\{ items, hooks \}\);/);
  assert.match(localItemsBody, /drawLayerItem\(entry\.item, entry\)/);
  assert.match(localItemsBody, /return order/);
  assert.match(drawItemsBody, /!itemLayerBridgeDisabled/);
  assert.match(drawItemsBody, /GoldMinerModules\.drawItemsLayer\(options\)/);
  assert.match(drawItemsBody, /itemLayerBridgeDisabled = true/);
  assert.match(drawItemsBody, /window\.__goldMinerItemRendererError =/);
  assert.match(drawItemsBody, /drawItemsWithLocalLayer\(options\)/);
  assert.match(itemShapeOptionsBody, /ctx,/);
  assert.match(itemShapeOptionsBody, /item,/);
  assert.match(itemShapeOptionsBody, /metadata,/);
  assert.match(itemShapeOptionsBody, /now: performance\.now\(\)/);
  assert.match(itemShapeOptionsBody, /createRng,/);
  assert.match(localItemShapeBody, /const \{ ctx: itemCtx, item, now, createRng: makeRng \} = options;/);
  assert.match(localItemShapeBody, /withSavedItemShape\(itemCtx,/);
  assert.match(localItemShapeBody, /const ctx = itemCtx;/);
  assert.match(localItemShapeBody, /blobPathForItemShape\(ctx,/);
  assert.match(localItemShapeBody, /roundRectPathForItemShape\(ctx,/);
  assert.match(drawItemBody, /const options = itemShapeLayerOptions\(item, metadata\)/);
  assert.match(drawItemBody, /!itemShapeLayerBridgeDisabled/);
  assert.match(drawItemBody, /GoldMinerModules\.drawItemShape\(options\)/);
  assert.match(drawItemBody, /itemShapeLayerBridgeDisabled = true/);
  assert.match(drawItemBody, /window\.__goldMinerItemShapeRendererError =/);
  assert.match(drawItemBody, /drawItemWithLocalLayer\(options\)/);
  assert.match(drawItemBody, /Gold Miner item shape renderer failed; using local item shape fallback/);
  assert.doesNotMatch(drawItemBody, /item\.type === "mouse"/);
  assert.doesNotMatch(drawItemBody, /createLinearGradient/);

  assert.doesNotMatch(rendererSource, /\bgame\b/);
  assert.doesNotMatch(rendererSource, /\bwindow\b/);
  assert.doesNotMatch(rendererSource, /\bperformance\b/);
  assert.match(rendererSource, /export function drawItemShape/);
  assert.match(rendererSource, /function withSaved\(ctx, draw\)/);
});

test("game hook player layers prefer bridge hook layer renderer while keeping hook callbacks local", () => {
  const source = read("game.js");
  const hookLayerOptionsBody = extractFunctionBody(source, "hookLayerOptions");
  const localHookLayerBody = extractFunctionBody(source, "createLocalHookLayerHandlers");
  const bridgeHookLayerBody = extractFunctionBody(source, "createBridgeHookLayerHandlers");
  const renderLayerHandlersBody = extractFunctionBody(source, "renderLayerHandlers");

  assert.match(source, /let hookLayerBridgeDisabled = false;/);
  assert.match(source, /function hookLayerOptions\(\)/);
  assert.match(source, /function createLocalHookLayerHandlers\(options = hookLayerOptions\(\)\)/);
  assert.match(source, /function createBridgeHookLayerHandlers\(options = hookLayerOptions\(\)\)/);

  assert.match(hookLayerOptionsBody, /drawHookTrail: \(hook, metadata\) => drawHookTrail\(hook, metadata\)/);
  assert.match(hookLayerOptionsBody, /drawHook: \(hook, metadata\) => drawHook\(hook, metadata\)/);
  assert.match(hookLayerOptionsBody, /drawCarryLabel: \(hook, metadata\) => drawCarryLabel\(hook, metadata\)/);
  assert.match(localHookLayerBody, /hookTrail: \(hook, miner, index\) => options\.drawHookTrail\(hook, \{ hook, miner, index, layerName: "hookTrail" \}\)/);
  assert.match(localHookLayerBody, /hook: \(hook, miner, index\) => options\.drawHook\(hook, \{ hook, miner, index, layerName: "hook" \}\)/);
  assert.match(localHookLayerBody, /carryLabel: \(hook, miner, index\) => options\.drawCarryLabel\(hook, \{ hook, miner, index, layerName: "carryLabel" \}\)/);
  assert.match(bridgeHookLayerBody, /GoldMinerModules\.createHookLayerHandlers\(options\)/);
  assert.match(bridgeHookLayerBody, /hookLayerBridgeDisabled = true/);
  assert.match(bridgeHookLayerBody, /window\.__goldMinerHookRendererError =/);
  assert.match(bridgeHookLayerBody, /createLocalHookLayerHandlers\(options\)/);
  assert.match(renderLayerHandlersBody, /const hookLayers = createBridgeHookLayerHandlers\(\)/);
  assert.match(renderLayerHandlersBody, /hookTrail: hookLayers\.hookTrail/);
  assert.match(renderLayerHandlersBody, /hook: hookLayers\.hook/);
  assert.match(renderLayerHandlersBody, /carryLabel: hookLayers\.carryLabel/);
});

test("game hook shape drawing prefers bridge renderer with local canvas fallback", () => {
  const source = read("game.js");
  const rendererSource = read("src/render/hookRenderer.js");
  const hookOptionsBody = extractFunctionBody(source, "hookShapeLayerOptions");
  const localHookBody = extractFunctionBody(source, "drawHookWithLocalLayer");
  const drawHookBody = extractFunctionBody(source, "drawHook");
  const hookLayerOptionsBody = extractFunctionBody(source, "hookLayerOptions");
  const renderLayerHandlersBody = extractFunctionBody(source, "renderLayerHandlers");

  assert.match(source, /let hookShapeLayerBridgeDisabled = false;/);
  assert.match(source, /function hookShapeLayerOptions\(hook = game\.hook\)/);
  assert.match(source, /function drawHookWithLocalLayer\(options = hookShapeLayerOptions\(\)\)/);

  assert.match(hookOptionsBody, /const carriedItem = attachedItem\(hook\)/);
  assert.match(hookOptionsBody, /ctx,/);
  assert.match(hookOptionsBody, /hook,/);
  assert.match(hookOptionsBody, /pivot: getPivot\(hook\)/);
  assert.match(hookOptionsBody, /tip: getHookEnd\(hook\)/);
  assert.match(hookOptionsBody, /dir: getHookDir\(hook\.angle\)/);
  assert.match(hookOptionsBody, /carriedItem,/);
  assert.match(hookOptionsBody, /game\.phase === "playing"/);
  assert.match(hookOptionsBody, /!game\.paused/);
  assert.match(hookOptionsBody, /game\.inventory\.bombs > 0/);
  assert.match(hookOptionsBody, /hook\.state === "retract"/);
  assert.match(hookOptionsBody, /!!carriedItem/);
  assert.match(hookOptionsBody, /hookConfig: HOOK/);
  assert.match(hookOptionsBody, /now: performance\.now\(\)/);
  assert.match(hookOptionsBody, /itemGlowColor: carriedItem \? itemFxColor\(carriedItem\) : null/);

  assert.match(localHookBody, /const \{\s*ctx: hookCtx,/s);
  assert.match(localHookBody, /hookCtx\.save\(\)/);
  assert.match(localHookBody, /try \{/);
  assert.match(localHookBody, /hookConfig\.ringToTip/);
  assert.match(localHookBody, /hookConfig\.jawBase/);
  assert.match(localHookBody, /roundRectPathForHookShape\(hookCtx,/);
  assert.match(localHookBody, /itemGlowColor/);
  assert.match(localHookBody, /if \(canBomb\)/);
  assert.match(localHookBody, /finally \{\s*hookCtx\.restore\(\);?\s*\}/s);
  assert.equal(
    countMatches(localHookBody, /hookCtx\.save\(\)/g),
    countMatches(localHookBody, /finally \{\s*hookCtx\.restore\(\);?\s*\}/gs),
    "every drawHookWithLocalLayer canvas save should have its own finally restore",
  );

  assert.match(drawHookBody, /const options = hookShapeLayerOptions\(hook\)/);
  assert.match(drawHookBody, /!hookShapeLayerBridgeDisabled/);
  assert.match(drawHookBody, /GoldMinerModules\.drawHookLayer\(options\)/);
  assert.match(drawHookBody, /hookShapeLayerBridgeDisabled = true/);
  assert.match(drawHookBody, /window\.__goldMinerHookShapeRendererError =/);
  assert.match(drawHookBody, /Gold Miner hook shape renderer failed; using local hook shape fallback/);
  assert.match(drawHookBody, /drawHookWithLocalLayer\(options\)/);
  assert.doesNotMatch(drawHookBody, /quadraticCurveTo/);
  assert.doesNotMatch(drawHookBody, /createLinearGradient/);

  assert.doesNotMatch(rendererSource, /\bgame\b/);
  assert.doesNotMatch(rendererSource, /\bwindow\b/);
  assert.doesNotMatch(rendererSource, /\bperformance\b/);
  assert.match(rendererSource, /export function drawHookLayer/);
  assert.match(rendererSource, /return \{ drewHook: true \}/);

  assert.match(hookLayerOptionsBody, /drawHook: \(hook, metadata\) => drawHook\(hook, metadata\)/);
  assert.match(renderLayerHandlersBody, /hook: hookLayers\.hook/);
});

test("game hook trail drawing prefers bridge renderer while keeping hook state local", () => {
  const source = read("game.js");
  const hookTrailOptionsBody = extractFunctionBody(source, "hookTrailLayerOptions");
  const localHookTrailBody = extractFunctionBody(source, "drawHookTrailWithLocalLayer");
  const drawHookTrailBody = extractFunctionBody(source, "drawHookTrail");

  assert.match(source, /let hookTrailLayerBridgeDisabled = false;/);
  assert.match(source, /function hookTrailLayerOptions\(hook = game\.hook\)/);
  assert.match(source, /function drawHookTrailWithLocalLayer\(options = hookTrailLayerOptions\(\)\)/);

  assert.match(hookTrailOptionsBody, /const item = attachedItem\(hook\)/);
  assert.match(hookTrailOptionsBody, /trail: hook\.trail/);
  assert.match(hookTrailOptionsBody, /color: item \? itemFxColor\(item\) : "rgba\(255,255,255,0\.85\)"/);
  assert.match(hookTrailOptionsBody, /life: 0\.55/);
  assert.match(localHookTrailBody, /const \{ ctx: trailCtx, trail, color, life \} = options;/);
  assert.match(localHookTrailBody, /trailCtx\.save\(\)/);
  assert.match(localHookTrailBody, /try \{/);
  assert.match(localHookTrailBody, /trailCtx\.globalCompositeOperation = "lighter"/);
  assert.match(localHookTrailBody, /trailCtx\.lineWidth = lerp\(1\.2, 6\.0, t\)/);
  assert.match(localHookTrailBody, /finally \{\s*trailCtx\.restore\(\);?\s*\}/s);
  assert.match(drawHookTrailBody, /GoldMinerModules\.drawHookTrailLayer\(options\)/);
  assert.match(drawHookTrailBody, /hookTrailLayerBridgeDisabled = true/);
  assert.match(drawHookTrailBody, /window\.__goldMinerHookTrailRendererError =/);
  assert.match(drawHookTrailBody, /drawHookTrailWithLocalLayer\(options\)/);
  assert.doesNotMatch(drawHookTrailBody, /for \(let i = 0; i < trail\.length - 1; i \+= 1\)/);
});

test("game carry label drawing prefers bridge renderer while keeping hook state local", () => {
  const source = read("game.js");
  const carryLabelOptionsBody = extractFunctionBody(source, "carryLabelLayerOptions");
  const localCarryLabelBody = extractFunctionBody(source, "drawCarryLabelWithLocalLayer");
  const drawCarryLabelBody = extractFunctionBody(source, "drawCarryLabel");

  assert.match(source, /let carryLabelLayerBridgeDisabled = false;/);
  assert.match(source, /function carryLabelLayerOptions\(hook = game\.hook\)/);
  assert.match(source, /function drawCarryLabelWithLocalLayer\(options = carryLabelLayerOptions\(\)\)/);

  assert.match(carryLabelOptionsBody, /game\.phase !== "playing"/);
  assert.match(carryLabelOptionsBody, /hook\.state !== "retract"/);
  assert.match(carryLabelOptionsBody, /const item = attachedItem\(hook\)/);
  assert.match(carryLabelOptionsBody, /end: getHookEnd\(hook\)/);
  assert.match(carryLabelOptionsBody, /viewport: game\.viewport/);
  assert.match(carryLabelOptionsBody, /color: itemFxColor\(item\)/);
  assert.match(carryLabelOptionsBody, /item\.type === "bag"/);
  assert.match(carryLabelOptionsBody, /item\.type === "keg"/);
  assert.match(localCarryLabelBody, /const \{ ctx: labelCtx, end, viewport, color, text \} = options;/);
  assert.match(localCarryLabelBody, /labelCtx\.save\(\)/);
  assert.match(localCarryLabelBody, /try \{/);
  assert.match(localCarryLabelBody, /labelCtx\.font = "700 12px ui-sans-serif, system-ui"/);
  assert.match(localCarryLabelBody, /labelCtx\.measureText\(text\)\.width/);
  assert.match(localCarryLabelBody, /finally \{\s*labelCtx\.restore\(\);?\s*\}/s);
  assert.match(drawCarryLabelBody, /GoldMinerModules\.drawCarryLabelLayer\(options\)/);
  assert.match(drawCarryLabelBody, /carryLabelLayerBridgeDisabled = true/);
  assert.match(drawCarryLabelBody, /window\.__goldMinerCarryLabelRendererError =/);
  assert.match(drawCarryLabelBody, /drawCarryLabelWithLocalLayer\(options\)/);
  assert.doesNotMatch(drawCarryLabelBody, /item\.type === "bag"/);
});

test("game winch drawing prefers bridge renderer with local canvas fallback", () => {
  const source = read("game.js");
  const rendererSource = read("src/render/winchRenderer.js");
  const winchOptionsBody = extractFunctionBody(source, "winchLayerOptions");
  const bridgeRoundRectBody = extractFunctionBody(rendererSource, "roundRectPath");
  const localRoundRectBody = extractFunctionBody(source, "roundRectPathForWinch");
  const localReelBody = extractFunctionBody(source, "drawReelWithLocalLayer");
  const localWinchBody = extractFunctionBody(source, "drawWinchWithLocalLayer");
  const drawWinchBody = extractFunctionBody(source, "drawWinch");
  const renderLayerHandlersBody = extractFunctionBody(source, "renderLayerHandlers");

  assert.match(source, /let winchLayerBridgeDisabled = false;/);
  assert.match(source, /function winchLayerOptions\(hook = game\.hook\)/);
  assert.match(source, /function drawReelWithLocalLayer\(\{ ctx: reelCtx, pivot, centerY, hook \} = \{\}\)/);
  assert.match(source, /function drawWinchWithLocalLayer\(options = winchLayerOptions\(\)\)/);

  assert.match(winchOptionsBody, /ctx,/);
  assert.match(winchOptionsBody, /pivot: getPivot\(hook\)/);
  assert.match(winchOptionsBody, /reel: getReelCenter\(hook\)/);
  assert.match(winchOptionsBody, /plankY: getPlankY\(\)/);
  assert.match(winchOptionsBody, /hook,/);

  for (const body of [bridgeRoundRectBody, localRoundRectBody]) {
    assert.match(body, /\.arcTo\(x \+ w, y, x \+ w, y \+ h, rr\)/);
    assert.match(body, /\.arcTo\(x \+ w, y \+ h, x, y \+ h, rr\)/);
    assert.match(body, /\.arcTo\(x, y \+ h, x, y, rr\)/);
    assert.match(body, /\.arcTo\(x, y, x \+ w, y, rr\)/);
    assert.match(body, /\.closePath\(\)/);
  }

  assert.match(localReelBody, /reelCtx\.save\(\)/);
  assert.match(localReelBody, /try \{/);
  assert.match(localReelBody, /reelCtx\.translate\(pivot\.x, centerY\)/);
  assert.match(localReelBody, /clamp\(\(spool - 160\) \/ 780, 0, 1\)/);
  assert.match(localReelBody, /finally \{\s*reelCtx\.restore\(\);?\s*\}/s);

  assert.match(localWinchBody, /const \{ ctx: winchCtx, pivot, reel, plankY, hook \} = options;/);
  assert.match(localWinchBody, /winchCtx\.save\(\)/);
  assert.match(localWinchBody, /try \{/);
  assert.match(localWinchBody, /winchCtx\.createLinearGradient\(plateX, plateY, plateX \+ plateW, plateY \+ plateH\)/);
  assert.match(localWinchBody, /roundRectPathForWinch\(winchCtx, plateX, plateY, plateW, plateH, 8\)/);
  assert.match(localWinchBody, /drawReelWithLocalLayer\(\{ ctx: winchCtx, pivot, centerY: reel\.y, hook \}\)/);
  assert.match(localWinchBody, /finally \{\s*winchCtx\.restore\(\);?\s*\}/s);

  assert.match(drawWinchBody, /const options = winchLayerOptions\(hook\)/);
  assert.match(drawWinchBody, /!winchLayerBridgeDisabled/);
  assert.match(drawWinchBody, /GoldMinerModules\.drawWinchLayer\(options\)/);
  assert.match(drawWinchBody, /winchLayerBridgeDisabled = true/);
  assert.match(drawWinchBody, /window\.__goldMinerWinchRendererError =/);
  assert.match(drawWinchBody, /drawWinchWithLocalLayer\(options\)/);
  assert.doesNotMatch(drawWinchBody, /createLinearGradient/);
  assert.match(renderLayerHandlersBody, /winch: \(hook\) => drawWinch\(hook\)/);
});

test("game miner drawing prefers bridge renderer with local canvas fallback", () => {
  const source = read("game.js");
  const rendererSource = read("src/render/minerRenderer.js");
  const minerOptionsBody = extractFunctionBody(source, "minerLayerOptions");
  const localPoseBody = extractFunctionBody(source, "createMinerPoseWithLocalLayer");
  const localBackBody = extractFunctionBody(source, "drawMinerBackWithLocalLayer");
  const localFrontBody = extractFunctionBody(source, "drawMinerFrontWithLocalLayer");
  const drawBackBody = extractFunctionBody(source, "drawMinerBack");
  const drawFrontBody = extractFunctionBody(source, "drawMinerFront");
  const renderLayerHandlersBody = extractFunctionBody(source, "renderLayerHandlers");

  assert.match(source, /let minerLayerBridgeDisabled = false;/);
  assert.match(source, /function minerLayerOptions\(hook = game\.hook, miner = game\.miner\)/);
  assert.match(source, /function createMinerPoseWithLocalLayer\(options\)/);
  assert.match(source, /function drawMinerBackWithLocalLayer\(options = minerLayerOptions\(\)\)/);
  assert.match(source, /function drawMinerFrontWithLocalLayer\(options = minerLayerOptions\(\)\)/);

  assert.match(minerOptionsBody, /ctx,/);
  assert.match(minerOptionsBody, /hook,/);
  assert.match(minerOptionsBody, /miner,/);
  assert.match(minerOptionsBody, /pivot: getPivot\(hook\)/);
  assert.match(minerOptionsBody, /reel: getReelCenter\(hook\)/);
  assert.match(minerOptionsBody, /now: performance\.now\(\)/);
  assert.match(minerOptionsBody, /attachedItem: attachedItem\(hook\)/);

  assert.match(localPoseBody, /const \{ hook, miner, pivot, reel, now, attachedItem: carried \} = options;/);
  assert.match(localPoseBody, /clamp\(hook\.angle \/ Math\.max\(0\.001, hook\.maxAngle\), -1, 1\)/);
  assert.match(localPoseBody, /return \{ pivot, reel, now, bob, aim, crank, phase, strainBase, x, y,/);

  assert.match(localBackBody, /const \{ ctx: minerCtx \} = options;/);
  assert.match(localBackBody, /const ctx = minerCtx;/);
  assert.match(localBackBody, /options\.pose \?\? createMinerPoseWithLocalLayer\(options\)/);
  assert.match(localBackBody, /ctx\.save\(\)/);
  assert.match(localBackBody, /try \{/);
  assert.match(localBackBody, /roundRectPathForMiner\(ctx,/);
  assert.match(localBackBody, /finally \{\s*ctx\.restore\(\);?\s*\}/s);
  assert.equal(
    countMatches(localBackBody, /ctx\.save\(\)/g),
    countMatches(localBackBody, /finally \{\s*ctx\.restore\(\);?\s*\}/gs),
    "every drawMinerBackWithLocalLayer canvas save should have its own finally restore",
  );

  assert.match(localFrontBody, /const \{ ctx: minerCtx, miner \} = options;/);
  assert.match(localFrontBody, /const ctx = minerCtx;/);
  assert.match(localFrontBody, /options\.pose \?\? createMinerPoseWithLocalLayer\(options\)/);
  assert.match(localFrontBody, /ctx\.save\(\)/);
  assert.match(localFrontBody, /try \{/);
  assert.match(localFrontBody, /ctx\.quadraticCurveTo\(e\.x, e\.y, h\.x, h\.y\)/);
  assert.match(localFrontBody, /finally \{\s*ctx\.restore\(\);?\s*\}/s);
  assert.equal(
    countMatches(localFrontBody, /ctx\.save\(\)/g),
    countMatches(localFrontBody, /finally \{\s*ctx\.restore\(\);?\s*\}/gs),
    "every drawMinerFrontWithLocalLayer canvas save should have its own finally restore",
  );

  for (const body of [drawBackBody, drawFrontBody]) {
    assert.match(body, /const options = minerLayerOptions\(hook, miner\)/);
    assert.match(body, /!minerLayerBridgeDisabled/);
    assert.match(body, /GoldMinerModules\.createMinerPose\(options\)/);
    assert.match(body, /ctx: options\.ctx, pose/);
  }
  assert.match(drawBackBody, /GoldMinerModules\.drawMinerBackLayer/);
  assert.match(drawBackBody, /drawMinerBackWithLocalLayer\(options\)/);
  assert.match(drawFrontBody, /GoldMinerModules\.drawMinerFrontLayer/);
  assert.match(drawFrontBody, /drawMinerFrontWithLocalLayer\(options\)/);
  assert.match(source, /window\.__goldMinerMinerRendererError =/);
  assert.match(source, /Gold Miner miner renderer failed; using local miner fallback/);

  assert.doesNotMatch(rendererSource, /\bperformance\b/);
  assert.doesNotMatch(rendererSource, /\bgame\b/);
  assert.doesNotMatch(rendererSource, /\bwindow\b/);
  assert.match(rendererSource, /export function createMinerPose/);
  assert.match(rendererSource, /export function drawMinerBackLayer/);
  assert.match(rendererSource, /export function drawMinerFrontLayer/);

  assert.match(renderLayerHandlersBody, /minerBack: \(hook, miner\) => drawMinerBack\(hook, miner\)/);
  assert.match(renderLayerHandlersBody, /minerFront: \(hook, miner\) => drawMinerFront\(hook, miner\)/);
});

test("game fx drawing prefers bridge renderer with local canvas fallback", () => {
  const source = read("game.js");
  const rendererSource = read("src/render/fxRenderer.js");
  const fxOptionsBody = extractFunctionBody(source, "fxLayerOptions");
  const localFxBody = extractFunctionBody(source, "drawFxWithLocalLayer");
  const drawFxBody = extractFunctionBody(source, "drawFx");
  const renderLayerHandlersBody = extractFunctionBody(source, "renderLayerHandlers");

  assert.match(source, /let fxLayerBridgeDisabled = false;/);
  assert.match(source, /function fxLayerOptions\(\)/);
  assert.match(source, /function withSavedFx\(drawCtx, draw\)/);
  assert.match(source, /function drawFxWithLocalLayer\(options = fxLayerOptions\(\)\)/);

  assert.match(fxOptionsBody, /ctx,/);
  assert.match(fxOptionsBody, /fx: game\.fx/);
  assert.match(localFxBody, /const \{ ctx: fxCtx, fx: layerFx \} = options;/);
  assert.match(localFxBody, /withSavedFx\(fxCtx, \(\) => \{/);
  assert.match(localFxBody, /fxCtx\.globalCompositeOperation = "lighter"/);
  assert.match(localFxBody, /const t = clamp\(ring\.age \/ Math\.max\(0\.0001, ring\.life\), 0, 1\)/);
  assert.match(localFxBody, /fxCtx\.arc\(ring\.x, ring\.y, r, 0, Math\.PI \* 2\)/);
  assert.match(localFxBody, /const a = \(1 - t\) \* 0\.9/);
  assert.match(localFxBody, /fxCtx\.arc\(particle\.x, particle\.y, Math\.max\(0\.6, particle\.size\), 0, Math\.PI \* 2\)/);
  assert.match(localFxBody, /fxCtx\.font = "700 18px ui-sans-serif, system-ui"/);
  assert.match(localFxBody, /fxCtx\.strokeText\(pop\.text, pop\.x, pop\.y\)/);
  assert.match(localFxBody, /fxCtx\.fillText\(pop\.text, pop\.x, pop\.y\)/);

  assert.match(drawFxBody, /const options = fxLayerOptions\(\)/);
  assert.match(drawFxBody, /!fxLayerBridgeDisabled/);
  assert.match(drawFxBody, /GoldMinerModules\.drawFxLayer\(options\)/);
  assert.match(drawFxBody, /fxLayerBridgeDisabled = true/);
  assert.match(drawFxBody, /window\.__goldMinerFxRendererError =/);
  assert.match(drawFxBody, /Gold Miner fx renderer failed; using local fx fallback/);
  assert.match(drawFxBody, /drawFxWithLocalLayer\(options\)/);

  assert.doesNotMatch(rendererSource, /\bgame\b/);
  assert.doesNotMatch(rendererSource, /\bwindow\b/);
  assert.doesNotMatch(rendererSource, /\bperformance\b/);
  assert.match(rendererSource, /export function drawFxLayer/);
  assert.match(rendererSource, /function withSaved\(ctx, draw\)/);
  assert.match(renderLayerHandlersBody, /fx: \(\) => drawFx\(\)/);
});

test("game fx state update prefers bridge system with local fallback", () => {
  const source = read("game.js");
  const systemSource = read("src/systems/fxSystem.js");
  const localUpdateFxBody = extractFunctionBody(source, "updateFxWithLocalState");
  const updateFxBody = extractFunctionBody(source, "updateFx");

  assert.match(source, /let fxStateBridgeDisabled = false;/);
  assert.match(source, /function updateFxWithLocalState\(dt\)/);
  assert.match(source, /function updateFx\(dt\)/);

  assert.match(localUpdateFxBody, /game\.fx\.flash - dt \* 2\.8/);
  assert.match(localUpdateFxBody, /game\.fx\.shake - dt \* 2\.2/);
  assert.match(localUpdateFxBody, /Math\.random\(\) \* 2 - 1/);
  assert.match(localUpdateFxBody, /for \(let i = game\.fx\.pops\.length - 1; i >= 0; i -= 1\)/);
  assert.match(localUpdateFxBody, /p\.vy \+= 180 \* dt/);
  assert.match(localUpdateFxBody, /for \(let i = game\.fx\.rings\.length - 1; i >= 0; i -= 1\)/);
  assert.match(localUpdateFxBody, /for \(let i = game\.fx\.particles\.length - 1; i >= 0; i -= 1\)/);
  assert.match(localUpdateFxBody, /p\.vy \+= \(p\.gravity \?\? 380\) \* dt/);
  assert.match(localUpdateFxBody, /p\.vx \*= 0\.985/);
  assert.match(localUpdateFxBody, /p\.size \*= 0\.992/);
  assert.match(localUpdateFxBody, /return game\.fx/);

  assert.match(updateFxBody, /!fxStateBridgeDisabled && GoldMinerModules\.updateFxState/);
  assert.match(updateFxBody, /GoldMinerModules\.updateFxState\(game\.fx, dt, Math\.random\)/);
  assert.match(updateFxBody, /fxStateBridgeDisabled = true/);
  assert.match(updateFxBody, /window\.__goldMinerFxSystemError =/);
  assert.match(updateFxBody, /Gold Miner fx system failed; using local fx state fallback/);
  assert.match(updateFxBody, /updateFxWithLocalState\(dt\)/);

  assert.doesNotMatch(systemSource, /\bgame\b/);
  assert.doesNotMatch(systemSource, /\bwindow\b/);
  assert.doesNotMatch(systemSource, /\bperformance\b/);
  assert.match(systemSource, /export function updateFxState\(fx, dt, random = Math\.random\)/);
  assert.match(systemSource, /return fx;/);

  const bridgeSource = read("src/runtime/moduleBridge.js");
  assert.match(bridgeSource, /import \{ updateFxState \} from "\.\.\/systems\/fxSystem\.js";/);
  assert.match(bridgeSource, /export \{ updateFxState \};/);
});

test("game hook state helpers prefer bridge system with local fallback", () => {
  const source = read("game.js");
  const systemSource = read("src/systems/hookSystem.js");
  const getHookDirBody = extractFunctionBody(source, "getHookDir");
  const getHookEndBody = extractFunctionBody(source, "getHookEnd");
  const updateHookTrailBody = extractFunctionBody(source, "updateHookTrail");
  const updateHookBody = extractFunctionBody(source, "update");
  const resizeBody = extractFunctionBody(source, "resize");

  assert.match(source, /let hookSystemBridgeDisabled = false;/);
  assert.match(source, /function noteHookSystemBridgeError\(error\)/);
  assert.match(source, /window\.__goldMinerHookSystemError =/);
  assert.match(source, /Gold Miner hook system failed; using local hook state fallback/);

  assert.match(getHookDirBody, /!hookSystemBridgeDisabled && GoldMinerModules\.getHookDir/);
  assert.match(getHookDirBody, /GoldMinerModules\.getHookDir\(angle\)/);
  assert.match(getHookDirBody, /noteHookSystemBridgeError\(error\)/);
  assert.match(getHookDirBody, /getHookDirWithLocalState\(angle\)/);

  assert.match(getHookEndBody, /!hookSystemBridgeDisabled && GoldMinerModules\.getHookEndPoint/);
  assert.match(getHookEndBody, /GoldMinerModules\.getHookEndPoint\(\{ pivot, angle: hook\.angle, length \}\)/);
  assert.match(getHookEndBody, /noteHookSystemBridgeError\(error\)/);
  assert.match(getHookEndBody, /getHookEndWithLocalState\(hook, length, pivot\)/);

  assert.match(updateHookTrailBody, /GoldMinerModules\.updateHookTrailState/);
  assert.match(updateHookTrailBody, /state === "extend" \|\| state === "retract"/);
  assert.match(updateHookTrailBody, /GoldMinerModules\.updateHookTrailState\(\{/);
  assert.match(updateHookTrailBody, /noteHookSystemBridgeError\(error\)/);
  assert.match(updateHookTrailBody, /updateHookTrailWithLocalState\(hook, dt\)/);

  assert.match(updateHookBody, /updateHookSwing\(hook, dt\)/);
  assert.match(updateHookBody, /updateHookReel\(hook, \{ prevLength, dt \}\)/);
  assert.doesNotMatch(updateHookBody, /hook\.reelAngle \+= deltaLen \/ 10/);
  assert.match(resizeBody, /clampHookLength\(hook\.length, \{ minLength: hook\.minLength, maxLength: hook\.maxLength \}\)/);

  assert.doesNotMatch(systemSource, /\bgame\b/);
  assert.doesNotMatch(systemSource, /\bwindow\b/);
  assert.doesNotMatch(systemSource, /\bperformance\b/);
  assert.match(systemSource, /export function getHookDir\(angle\)/);
  assert.match(systemSource, /export function getHookEndPoint\(\{ pivot, angle, length \}\)/);
  assert.match(systemSource, /export function clampHookLength\(length, \{ minLength, maxLength \}\)/);
  assert.match(systemSource, /export function updateHookTrailState\(\{/);
  assert.match(systemSource, /export function updateHookSwingState\(hook, dt\)/);
  assert.match(systemSource, /export function updateHookReelState\(hook, \{ prevLength, dt, smoothSpeed = 10\.5 \}\)/);

  const bridgeSource = read("src/runtime/moduleBridge.js");
  assert.match(
    bridgeSource,
    /import \{\s*clampHookLength,\s*getHookDir,\s*getHookEndPoint,\s*updateHookReelState,\s*updateHookSwingState,\s*updateHookTrailState,\s*\} from "\.\.\/systems\/hookSystem\.js";/s,
  );
  assert.match(
    bridgeSource,
    /export \{\s*clampHookLength,\s*getHookDir,\s*getHookEndPoint,\s*updateHookReelState,\s*updateHookSwingState,\s*updateHookTrailState,\s*\};/s,
  );
});

test("game item motion and keg helpers prefer bridge systems with local fallback", () => {
  const source = read("game.js");
  const itemMotionSource = read("src/systems/itemMotionSystem.js");
  const kegSystemSource = read("src/systems/kegSystem.js");
  const updateMiceBody = extractFunctionBody(source, "updateMice");
  const updateFallingKegsBody = extractFunctionBody(source, "updateFallingKegs");
  const explodeKegAtBody = extractFunctionBody(source, "explodeKegAt");
  const findFallingKegCollisionBody = extractFunctionBody(source, "findFallingKegCollision");
  const selectKegBlastAffectedIdsBody = extractFunctionBody(source, "selectKegBlastAffectedIds");

  assert.match(source, /let itemMotionSystemBridgeDisabled = false;/);
  assert.match(source, /let kegSystemBridgeDisabled = false;/);
  assert.match(source, /function noteItemMotionSystemBridgeError\(error\)/);
  assert.match(source, /function noteKegSystemBridgeError\(error\)/);
  assert.match(source, /window\.__goldMinerItemMotionSystemError =/);
  assert.match(source, /window\.__goldMinerKegSystemError =/);

  assert.match(updateMiceBody, /GoldMinerModules\.updateMouseItemMotion\(item, \{/);
  assert.match(updateMiceBody, /viewport: game\.viewport/);
  assert.match(updateMiceBody, /fallbackSpeed: MOUSE_SPEED_MIN/);
  assert.match(updateMiceBody, /updateMouseItemMotionWithLocalState\(item, dt\)/);

  assert.match(updateFallingKegsBody, /GoldMinerModules\.updateFallingKegMotion\(item, \{ dt, gravity: KEG_GRAVITY \}\)/);
  assert.match(updateFallingKegsBody, /const collision = findFallingKegCollision\(item, i\)/);
  assert.match(updateFallingKegsBody, /explodeKegAt\(item\.x, item\.y\)/);
  assert.match(updateFallingKegsBody, /game\.items\.splice\(i, 1\)/);

  assert.match(findFallingKegCollisionBody, /GoldMinerModules\.findFallingKegCollision\(\{/);
  assert.match(findFallingKegCollisionBody, /items: game\.items/);
  assert.match(findFallingKegCollisionBody, /kegItem: item/);
  assert.match(findFallingKegCollisionBody, /kegIndex: itemIndex/);
  assert.match(findFallingKegCollisionBody, /findFallingKegCollisionWithLocalState\(item, itemIndex\)/);

  assert.match(explodeKegAtBody, /new Set\(selectKegBlastAffectedIds\(x, y, KEG_BLAST_RADIUS\)\)/);
  assert.match(explodeKegAtBody, /game\.items = game\.items\.filter/);
  assert.match(explodeKegAtBody, /hook\.attachedId = null/);
  assert.match(explodeKegAtBody, /hook\.clawClose = 0/);
  assert.match(selectKegBlastAffectedIdsBody, /GoldMinerModules\.selectKegBlastAffectedIds\(\{/);
  assert.match(selectKegBlastAffectedIdsBody, /items: game\.items/);
  assert.match(selectKegBlastAffectedIdsBody, /radius/);
  assert.match(selectKegBlastAffectedIdsBody, /selectKegBlastAffectedIdsWithLocalState\(x, y, radius\)/);

  for (const systemSource of [itemMotionSource, kegSystemSource]) {
    assert.doesNotMatch(systemSource, /\bgame\b/);
    assert.doesNotMatch(systemSource, /\bwindow\b/);
    assert.doesNotMatch(systemSource, /\bdocument\b/);
    assert.doesNotMatch(systemSource, /\bctx\b/);
    assert.doesNotMatch(systemSource, /\baudio\b/i);
    assert.doesNotMatch(systemSource, /\bFX\b/);
  }
  assert.match(itemMotionSource, /export function updateMouseItemMotion\(\s*item,\s*\{/s);
  assert.match(itemMotionSource, /export function updateFallingKegMotion\(item, \{/);
  assert.match(kegSystemSource, /export function findFallingKegCollision\(\{/);
  assert.match(kegSystemSource, /export function selectKegBlastAffectedIds\(\{/);

  const bridgeSource = read("src/runtime/moduleBridge.js");
  assert.match(
    bridgeSource,
    /import \{\s*updateFallingKegMotion,\s*updateMouseItemMotion,\s*\} from "\.\.\/systems\/itemMotionSystem\.js";/s,
  );
  assert.match(
    bridgeSource,
    /import \{\s*findFallingKegCollision,\s*selectKegBlastAffectedIds,\s*\} from "\.\.\/systems\/kegSystem\.js";/s,
  );
  assert.match(
    bridgeSource,
    /export \{\s*findFallingKegCollision,\s*selectKegBlastAffectedIds,\s*updateFallingKegMotion,\s*updateMouseItemMotion,\s*\};/s,
  );
});

test("macOS build copies src modules into the app bundle", () => {
  const source = read("macos/build.command");

  assert.match(source, /cp -R "\$ROOT_DIR\/src" "\$APP_DIR\/Contents\/Resources\/src"/);
});

test("audio adapter remains pure and is exposed through the runtime bridge", () => {
  const source = read("game.js");
  const bridgeSource = read("src/runtime/moduleBridge.js");
  const adapterSource = read("src/audio/audioAdapter.js");
  const audioEventBridgeImports = parseImportedNamesFrom(bridgeSource, "../audio/audioEvents.js");
  const bridgeObjectBody = extractObjectLiteralBody(
    bridgeSource,
    /export const GoldMinerModules = Object\.freeze\(/,
    "GoldMinerModules",
  );

  assert.match(
    bridgeSource,
    /import \{\s*applyAudioEventsToFacade,\s*createAudioButtonSnapshot,\s*\} from "\.\.\/audio\/audioAdapter\.js";/s,
  );
  assert.equal(
    audioEventBridgeImports.includes("applyAudioEvents"),
    false,
    "runtime bridge should not import deprecated applyAudioEvents",
  );
  assert.match(bridgeSource, /export \{ applyAudioEventsToFacade, createAudioButtonSnapshot \};/);
  assert.doesNotMatch(bridgeSource, /export\s*\{[^}]*\bapplyAudioEvents\b[^}]*\}/s);
  assert.doesNotMatch(
    bridgeObjectBody,
    /(?:^|[,\s])applyAudioEvents\s*(?:,|:)/,
    "GoldMinerModules should not expose deprecated applyAudioEvents",
  );
  assert.match(bridgeSource, /applyAudioEventsToFacade,/);
  assert.match(bridgeSource, /createAudioButtonSnapshot,/);

  assert.match(adapterSource, /export function createAudioButtonSnapshot\(audio = undefined\)/);
  assert.match(adapterSource, /export function applyAudioEventsToFacade\(events = \[\], facade = \{\}\)/);
  assert.match(adapterSource, /import \{ applyAudioEvents \} from "\.\/audioEvents\.js";/);
  for (const forbidden of [
    /\bwindow\b/,
    /\bdocument\b/,
    /\bgame\b/,
    /\bcanvas\b/,
    /\bctx\b/,
    /\bdispatchCommand\b/,
  ]) {
    assert.doesNotMatch(adapterSource, forbidden, "audio adapter should not access host globals or dispatch");
  }

  assert.match(source, /let audioAdapterBridgeDisabled = false;/);
  assert.match(source, /function noteAudioAdapterBridgeError\(error\)/);
  assert.match(source, /window\.__goldMinerAudioAdapterError =/);
  assert.match(source, /function createAudioButtonSnapshotForHost\(audio = window\.GameAudio\)/);
  assert.match(source, /GoldMinerModules\.createAudioButtonSnapshot\(audio\)/);
  assert.match(source, /function audioFacadeForHost\(\)/);
  assert.match(source, /audio: window\.GameAudio/);
  assert.match(source, /function applyAudioEventsToFacadeWithLocalAdapter\(events, facade = audioFacadeForHost\(\)\)/);
  assert.match(source, /GoldMinerModules\.applyAudioEventsToFacade\(eventBatch, facade\)/);
});

test("debug API owns browser automation snapshot and advance calculations", () => {
  const source = read("game.js");
  const bridgeSource = read("src/runtime/moduleBridge.js");
  const debugSource = read("src/testing/debugApi.js");
  const renderGameToTextBody = extractFunctionBody(source, "renderGameToText");
  const advanceBody = extractFunctionBody(source, "createDebugAdvancePlanForHost");
  const shopSetupBody = extractFunctionBody(source, "createDebugShopSetupForHost");
  const enterShopBody = extractFunctionBody(source, "enterDebugShop");

  assert.match(
    bridgeSource,
    /import \{\s*createDebugAdvancePlan,\s*createDebugShopSetup,\s*createDebugSnapshot,\s*renderDebugSnapshotToText,\s*\} from "\.\.\/testing\/debugApi\.js";/s,
  );
  assert.match(bridgeSource, /export \{ createDebugAdvancePlan, createDebugShopSetup, createDebugSnapshot, renderDebugSnapshotToText \};/);
  assert.match(bridgeSource, /createDebugAdvancePlan,/);
  assert.match(bridgeSource, /createDebugShopSetup,/);
  assert.match(bridgeSource, /createDebugSnapshot,/);
  assert.match(bridgeSource, /renderDebugSnapshotToText,/);

  assert.match(debugSource, /export function createDebugSnapshot\(\{/);
  assert.match(debugSource, /export function renderDebugSnapshotToText\(input\)/);
  assert.match(debugSource, /export function createDebugAdvancePlan\(ms, \{ frameRate = 60 \} = \{\}\)/);
  assert.match(debugSource, /export function createDebugShopSetup\(\{ game, score = 500 \} = \{\}\)/);
  for (const forbidden of [
    /\bwindow\b/,
    /\bdocument\b/,
    /\bcanvas\b/,
    /\bctx\b/,
    /\brequestAnimationFrame\b/,
    /\bstepFrame\b/,
    /\brender\(/,
  ]) {
    assert.doesNotMatch(debugSource, forbidden, "debug API should not access host runtime directly");
  }

  assert.match(source, /let debugApiBridgeDisabled = false;/);
  assert.match(source, /let debugApiFallback = null;/);
  assert.match(source, /function noteDebugApiBridgeError\(error\)/);
  assert.match(source, /window\.__goldMinerDebugApiError =/);
  assert.doesNotMatch(source, /function createDebugSnapshotWithLocalData\(/);
  assert.doesNotMatch(source, /function createDebugAdvancePlanWithLocalData\(/);
  assert.doesNotMatch(source, /function roundDebugValue\(/);
  assert.match(renderGameToTextBody, /debugSnapshotInput\(\)/);
  assert.match(renderGameToTextBody, /GoldMinerModules\.renderDebugSnapshotToText\(input\)/);
  assert.match(renderGameToTextBody, /debugApiFallback\.renderDebugSnapshotToText\(input\)/);
  assert.match(renderGameToTextBody, /throw new Error\("Gold Miner debug snapshot API is unavailable"\)/);
  assert.match(advanceBody, /GoldMinerModules\.createDebugAdvancePlan\(ms\)/);
  assert.match(advanceBody, /debugApiFallback\.createDebugAdvancePlan\(ms\)/);
  assert.match(advanceBody, /throw new Error\("Gold Miner debug advance API is unavailable"\)/);
  assert.match(shopSetupBody, /GoldMinerModules\.createDebugShopSetup\(input\)/);
  assert.match(shopSetupBody, /debugApiFallback\.createDebugShopSetup\(input\)/);
  assert.match(shopSetupBody, /throw new Error\("Gold Miner debug shop setup API is unavailable"\)/);
  assert.match(enterShopBody, /game\.score = setup\.score;/);
  assert.match(enterShopBody, /game\.phase = setup\.phase;/);
  assert.match(enterShopBody, /game\.paused = setup\.paused;/);
  assert.match(enterShopBody, /openShop\(\);/);
  assert.match(enterShopBody, /render\(\);/);
  assert.match(enterShopBody, /return JSON\.parse\(renderGameToText\(\)\);/);
  assert.match(source, /const plan = createDebugAdvancePlanForHost\(ms\);/);
  assert.match(source, /for \(let i = 0; i < plan\.steps; i \+= 1\) stepFrame\(plan\.dt\);/);
  assert.match(source, /window\.__goldMinerSmoke = Object\.freeze\(\{/);
  assert.match(source, /enterShop: enterDebugShop,/);
});

test("state kernel owns initial state and playing frame shell boundaries", () => {
  const source = read("game.js");
  const bridgeSource = read("src/runtime/moduleBridge.js");
  const initialSource = read("src/state/createInitialState.js");
  const kernelSource = read("src/state/stateKernel.js");
  const initializeBody = extractFunctionBody(source, "initializeGameState");
  const stepBody = extractFunctionBody(source, "stepPlayingStateForHost");
  const updateBody = extractFunctionBody(source, "update");

  assert.match(bridgeSource, /import \{ createInitialGameState \} from "\.\.\/state\/createInitialState\.js";/);
  assert.match(bridgeSource, /import \{ stepPlayingState \} from "\.\.\/state\/stateKernel\.js";/);
  assert.match(bridgeSource, /export \{ createInitialGameState, stepPlayingState \};/);
  assert.match(bridgeSource, /createInitialGameState,/);
  assert.match(bridgeSource, /stepPlayingState,/);

  assert.match(initialSource, /export function createInitialGameState/);
  assert.match(initialSource, /phase: "menu"/);
  assert.match(initialSource, /hook: createInitialHookState\(\{ angleDir: 1, minRope \}\)/);
  assert.match(initialSource, /hook2: createInitialHookState\(\{ angleDir: -1, minRope \}\)/);
  assert.match(kernelSource, /export function stepPlayingState/);
  assert.match(kernelSource, /state\.timeLeft -= dt/);
  assert.match(kernelSource, /events\.countdown\?\.\(secLeft\)/);
  assert.match(kernelSource, /events\.endLevel\?\.\(\)/);
  for (const boundarySource of [initialSource, kernelSource]) {
    for (const forbidden of [
      /\bwindow\b/,
      /\bdocument\b/,
      /\bcanvas\b/,
      /\bctx\b/,
      /\bGameAudio\b/,
      /\bGoldMinerModules\b/,
      /\brequestAnimationFrame\b/,
    ]) {
      assert.doesNotMatch(boundarySource, forbidden, "state modules should not access host globals");
    }
  }

  assert.match(source, /let game = null;/);
  assert.match(source, /let stateKernelBridgeDisabled = false;/);
  assert.match(source, /let stateKernelFallback = null;/);
  assert.match(source, /function setStateKernelFallback\(source\)/);
  assert.match(source, /function noteStateKernelBridgeError\(error\)/);
  assert.match(source, /window\.__goldMinerStateKernelError =/);
  assert.match(source, /function initializeGameState\(\)/);
  assert.match(initializeBody, /GoldMinerModules\.createInitialGameState\(options\)/);
  assert.match(initializeBody, /stateKernelFallback\.createInitialGameState\(options\)/);
  assert.match(source, /initializeGameState\(\);\s*\n\s*initUi\(\);/);
  assert.match(stepBody, /GoldMinerModules\.stepPlayingState\(options\)/);
  assert.match(stepBody, /stateKernelFallback\.stepPlayingState\(options\)/);
  assert.match(stepBody, /emitAudioEvent\("countdown"\)/);
  assert.match(stepBody, /endLevel\(\)/);
  assert.match(updateBody, /const stepResult = stepPlayingStateForHost\(dt\);/);
  assert.match(updateBody, /if \(!stepResult\.shouldContinue\) return;/);
  assert.doesNotMatch(updateBody, /game\.timeLeft -= dt/);
});

test("input adapter remains pure and is exposed through the runtime bridge", () => {
  const source = read("game.js");
  const bridgeSource = read("src/runtime/moduleBridge.js");
  const adapterSource = read("src/ui/inputAdapter.js");

  assert.match(
    bridgeSource,
    /import \{\s*mapButtonInput,\s*mapKeyboardInput,\s*mapPointerInput,\s*\} from "\.\.\/ui\/inputAdapter\.js";/s,
  );
  assert.match(
    bridgeSource,
    /export \{\s*mapButtonInput,\s*mapKeyboardInput,\s*mapPointerInput,\s*\};/s,
  );
  assert.match(bridgeSource, /mapButtonInput,/);
  assert.match(bridgeSource, /mapKeyboardInput,/);
  assert.match(bridgeSource, /mapPointerInput,/);

  assert.match(adapterSource, /export function mapButtonInput\(action, commandTypes\)/);
  assert.match(adapterSource, /export function mapKeyboardInput\(input, state, commandTypes\)/);
  assert.match(adapterSource, /export function mapPointerInput\(state, commandTypes\)/);
  for (const forbidden of [
    /\bgame\b/,
    /\bwindow\b/,
    /\bdocument\b/,
    /\bcanvas\b/,
    /\bDOM\b/,
    /\bdispatchCommand\b/,
    /\bcreateRuntimeCommand\b/,
    /\bGoldMinerModules\b/,
    /\bisTwoPlayerMode\b/,
  ]) {
    assert.doesNotMatch(adapterSource, forbidden, "input adapter should not access host state or side effects");
  }

  assert.match(source, /let inputAdapterBridgeDisabled = false;/);
  assert.match(source, /function noteInputAdapterBridgeError\(error\)/);
  assert.match(source, /window\.__goldMinerInputAdapterError =/);
  assert.match(source, /function mapButtonInputForHost\(action\)/);
  assert.match(source, /function mapKeyboardInputForHost\(event\)/);
  assert.match(source, /function mapPointerInputForHost\(\)/);
  assert.match(source, /function dispatchInputCommand\(mappedInput\)/);
});

test("game input surfaces dispatch command objects", () => {
  const source = read("game.js");
  const initUiBody = extractFunctionBody(source, "initUi");
  const showModeBody = extractFunctionBody(source, "showModeSelectOverlay");
  const togglePauseBody = extractFunctionBody(source, "togglePause");
  const renderShopBody = extractFunctionBody(source, "renderShop");
  const openShopBody = extractFunctionBody(source, "openShop");
  const dispatchBody = extractFunctionBody(source, "dispatchCommand");
  const handlersBody = extractFunctionBody(source, "runtimeCommandHandlers");
  const startGameBody = extractFunctionBody(source, "startGame");
  const resumeBody = extractFunctionBody(source, "resumeGame");
  const startNextBody = extractFunctionBody(source, "startNextLevel");
  const buyShopCommandItemBody = extractFunctionBody(source, "buyShopCommandItem");

  assert.match(source, /function dispatchCommand\(rawCommand\)/);
  assert.match(source, /function runtimeCommandHandlers\(\)/);
  assert.match(source, /function createRuntimeCommand\(type, payload = \{\}\)/);
  assert.match(source, /function commandTypes\(\)/);
  assert.match(source, /const FALLBACK_COMMAND_TYPE = Object\.freeze\(\{/);
  assert.match(source, /BUY_SHOP_ITEM: "BUY_SHOP_ITEM"/);
  assert.match(dispatchBody, /GoldMinerModules\.dispatchGameCommand/);
  assert.match(dispatchBody, /handlers: runtimeCommandHandlers\(\)/);
  assert.match(dispatchBody, /state: game/);
  assert.match(dispatchBody, /GoldMinerModules\.assertCommand\(rawCommand\)/);
  assert.match(dispatchBody, /console\.warn\("Ignoring invalid Gold Miner command\.", error\);/);
  assert.match(dispatchBody, /const payload = command\.payload \?\? \{\};/);
  assert.match(dispatchBody, /if \(!Object\.values\(types\)\.includes\(command\.type\)\) \{/);
  assert.match(dispatchBody, /Unsupported command type: \$\{String\(command\.type\)\}/);
  assert.match(dispatchBody, /setGameMode\(payload\.mode\);/);
  assert.match(dispatchBody, /dropHookFor\(payload\.player \?\? 0\);/);
  assert.match(dispatchBody, /buyShopCommandItem\(payload\.itemId\);/);
  assert.match(dispatchBody, /window\.GameAudio\?\.toggleMusic\?\.?\(\);/);
  assert.match(dispatchBody, /window\.GameAudio\?\.nextTrack\?\.?\(\);/);
  assert.match(dispatchBody, /window\.GameAudio\?\.toggleSfx\?\.?\(\);/);
  assert.match(startGameBody, /emitOverlayHideEvent\(\);/);
  assert.match(startGameBody, /emitHudUpdateEvent\(\);/);
  assert.match(startGameBody, /emitAudioEvent\("level_start"\);/);
  assert.match(startGameBody, /processGameEvents\(\);/);
  assert.match(resumeBody, /if \(game\.phase !== "playing"\) return;/);
  assert.match(resumeBody, /game\.paused = false;/);
  assert.match(resumeBody, /emitOverlayHideEvent\(\);/);
  assert.match(resumeBody, /emitHudUpdateEvent\(\);/);
  assert.match(resumeBody, /processGameEvents\(\);/);
  assert.match(startNextBody, /if \(game\.phase !== "shop"\) return;/);
  assert.match(startNextBody, /game\.level \+= 1;/);
  assert.match(startNextBody, /prepareLevelStart\(\);/);
  assert.match(startNextBody, /emitOverlayHideEvent\(\);/);
  assert.match(startNextBody, /emitHudUpdateEvent\(\);/);
  assert.match(startNextBody, /emitAudioEvent\("level_start"\);/);
  assert.match(startNextBody, /processGameEvents\(\);/);
  assert.match(buyShopCommandItemBody, /GoldMinerModules\.buyShopItem/);
  assert.match(buyShopCommandItemBody, /game\.score = result\.score;/);
  assert.match(buyShopCommandItemBody, /game\.inventory = result\.inventory;/);
  assert.match(buyShopCommandItemBody, /emitAudioEvent\("buy"\);/);
  assert.match(buyShopCommandItemBody, /emitShopRenderEvent\(\);/);
  assert.match(buyShopCommandItemBody, /emitHudUpdateEvent\(\);/);
  assert.match(buyShopCommandItemBody, /processGameEvents\(\);/);
  assert.match(buyShopCommandItemBody, /if \(item\.id === "bomb"\) game\.inventory\.bombs \+= 1;/);
  assert.match(handlersBody, /startGame: \(mode\) => \{/);
  assert.match(handlersBody, /setGameMode\(mode\);/);
  assert.match(handlersBody, /fireHook: \(player\) => dropHookFor\(player\)/);
  assert.match(handlersBody, /emitAudioEvent\("ui_click"\)/);
  assert.match(handlersBody, /emitAudioSyncEvent\(\)/);
  assert.match(handlersBody, /processGameEvents\(\)/);
  assert.match(initUiBody, /dispatchInputCommand\(mapButtonInputForHost\("start"\)\)/);
  assert.match(initUiBody, /dispatchInputCommand\(mapButtonInputForHost\("pause"\)\)/);
  assert.match(initUiBody, /dispatchInputCommand\(mapButtonInputForHost\("restart"\)\)/);
  assert.match(initUiBody, /dispatchInputCommand\(mapButtonInputForHost\("bomb"\)\)/);
  assert.match(initUiBody, /ui\.soundBtn\?\.addEventListener\("click", \(\) => dispatchInputCommand\(mapButtonInputForHost\("sound"\)\)\);/);
  assert.match(initUiBody, /ui\.musicBtn\?\.addEventListener\("click", \(\) => dispatchInputCommand\(mapButtonInputForHost\("music"\)\)\);/);
  assert.match(initUiBody, /const mappedInput = mapKeyboardInputForHost\(e\);/);
  assert.match(initUiBody, /if \(mappedInput\?\.preventDefault\) e\.preventDefault\(\);/);
  assert.match(initUiBody, /dispatchInputCommand\(mappedInput\);/);
  assert.match(initUiBody, /canvas\.addEventListener\("pointerdown", \(\) => \{/);
  assert.match(initUiBody, /dispatchInputCommand\(mapPointerInputForHost\(\)\);/);
  assert.match(showModeBody, /dispatchCommand\(createRuntimeCommand\(types\.START_GAME, \{ mode: "single" \}\)\)/);
  assert.match(showModeBody, /dispatchCommand\(createRuntimeCommand\(types\.START_GAME, \{ mode: "double" \}\)\)/);
  assert.match(togglePauseBody, /dispatchCommand\(createRuntimeCommand\(commandTypes\(\)\.RESUME_GAME\)\)/);
  assert.match(togglePauseBody, /dispatchCommand\(createRuntimeCommand\(commandTypes\(\)\.RESTART_GAME\)\)/);
  assert.match(togglePauseBody, /emitAudioEvent\(game\.paused \? "pause" : "resume"\)/);
  assert.match(togglePauseBody, /emitOverlayShowEvent\(\{/);
  assert.match(togglePauseBody, /emitOverlayHideEvent\(\)/);
  assert.match(togglePauseBody, /emitHudUpdateEvent\(\)/);
  assert.match(togglePauseBody, /processGameEvents\(\)/);
  assert.match(renderShopBody, /dispatchCommand\(createRuntimeCommand\(types\.BUY_SHOP_ITEM, \{ itemId: item\.id \}\)\)/);
  assert.match(openShopBody, /emitAudioEvent\("shop_open"\)/);
  assert.match(openShopBody, /emitShopRenderEvent\(\)/);
  assert.match(openShopBody, /emitOverlayShowEvent\(\{/);
  assert.match(openShopBody, /emitHudUpdateEvent\(\)/);
  assert.match(openShopBody, /processGameEvents\(\)/);
  assert.match(openShopBody, /dispatchCommand\(createRuntimeCommand\(types\.START_NEXT_LEVEL\)\)/);
  assert.match(openShopBody, /dispatchCommand\(createRuntimeCommand\(types\.RESTART_GAME\)\)/);
});
