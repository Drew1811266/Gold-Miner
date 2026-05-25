const HOOK_LAYER_CALLBACKS = Object.freeze({
  hookTrail: "drawHookTrail",
  hook: "drawHook",
  carryLabel: "drawCarryLabel",
});

function assertFunction(value, name) {
  if (typeof value !== "function") {
    throw new TypeError(`${name} must be a function`);
  }
}

function assertSupportedLayerName(layerName) {
  if (!Object.prototype.hasOwnProperty.call(HOOK_LAYER_CALLBACKS, layerName)) {
    throw new TypeError(`unsupported hook layer: ${String(layerName)}`);
  }
}

export function drawHookPlayerLayer(options = {}) {
  const { hook, miner, index, layerName } = options;
  assertSupportedLayerName(layerName);

  const callbackName = HOOK_LAYER_CALLBACKS[layerName];
  const callback = options[callbackName];
  assertFunction(callback, callbackName);

  return callback(hook, { hook, miner, index, layerName });
}

export function createHookLayerHandlers({ drawHookTrail, drawHook, drawCarryLabel } = {}) {
  assertFunction(drawHookTrail, "drawHookTrail");
  assertFunction(drawHook, "drawHook");
  assertFunction(drawCarryLabel, "drawCarryLabel");

  return {
    hookTrail: (hook, miner, index) =>
      drawHookPlayerLayer({ hook, miner, index, layerName: "hookTrail", drawHookTrail }),
    hook: (hook, miner, index) => drawHookPlayerLayer({ hook, miner, index, layerName: "hook", drawHook }),
    carryLabel: (hook, miner, index) =>
      drawHookPlayerLayer({ hook, miner, index, layerName: "carryLabel", drawCarryLabel }),
  };
}
