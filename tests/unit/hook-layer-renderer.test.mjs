import { test } from "node:test";
import assert from "node:assert/strict";
import { createHookLayerHandlers, drawHookPlayerLayer } from "../../src/render/hookLayerRenderer.js";

test("drawHookPlayerLayer delegates hookTrail with hook miner index metadata", () => {
  const calls = [];
  const hook = { id: "h1" };
  const miner = { id: "m1" };

  const result = drawHookPlayerLayer({
    hook,
    miner,
    index: 2,
    layerName: "hookTrail",
    drawHookTrail: (receivedHook, metadata) => {
      calls.push([receivedHook, metadata.hook, metadata.miner, metadata.index, metadata.layerName]);
      return "trail-result";
    },
    drawHook: () => assert.fail("wrong layer"),
    drawCarryLabel: () => assert.fail("wrong layer"),
  });

  assert.equal(result, "trail-result");
  assert.deepEqual(calls, [[hook, hook, miner, 2, "hookTrail"]]);
});

test("drawHookPlayerLayer delegates hook and carryLabel through their own callbacks", () => {
  const hook = { id: "h1" };
  const miner = { id: "m1" };
  const calls = [];

  const hookResult = drawHookPlayerLayer({
    hook,
    miner,
    index: 0,
    layerName: "hook",
    drawHookTrail: () => assert.fail("wrong layer"),
    drawHook: (receivedHook, metadata) => {
      calls.push(["hook", receivedHook, metadata.layerName]);
      return "hook-result";
    },
    drawCarryLabel: () => assert.fail("wrong layer"),
  });

  const labelResult = drawHookPlayerLayer({
    hook,
    miner,
    index: 0,
    layerName: "carryLabel",
    drawHookTrail: () => assert.fail("wrong layer"),
    drawHook: () => assert.fail("wrong layer"),
    drawCarryLabel: (receivedHook, metadata) => {
      calls.push(["carryLabel", receivedHook, metadata.layerName]);
      return "label-result";
    },
  });

  assert.equal(hookResult, "hook-result");
  assert.equal(labelResult, "label-result");
  assert.deepEqual(calls, [
    ["hook", hook, "hook"],
    ["carryLabel", hook, "carryLabel"],
  ]);
});

test("createHookLayerHandlers returns render-pipeline compatible player layer callbacks", () => {
  const hook = { id: "h1" };
  const miner = { id: "m1" };
  const calls = [];

  const handlers = createHookLayerHandlers({
    drawHookTrail: (receivedHook, metadata) => calls.push(["trail", receivedHook, metadata.miner, metadata.index]),
    drawHook: (receivedHook, metadata) => calls.push(["hook", receivedHook, metadata.miner, metadata.index]),
    drawCarryLabel: (receivedHook, metadata) => calls.push(["label", receivedHook, metadata.miner, metadata.index]),
  });

  handlers.hookTrail(hook, miner, 1);
  handlers.hook(hook, miner, 1);
  handlers.carryLabel(hook, miner, 1);

  assert.deepEqual(calls, [
    ["trail", hook, miner, 1],
    ["hook", hook, miner, 1],
    ["label", hook, miner, 1],
  ]);
});

test("hook layer renderer rejects invalid inputs", () => {
  assert.throws(() => drawHookPlayerLayer({ layerName: "bad" }), /unsupported hook layer/);
  assert.throws(
    () => drawHookPlayerLayer({ layerName: "hook", hook: {}, miner: {}, index: 0, drawHook: null }),
    /drawHook must be a function/,
  );
  assert.throws(
    () => createHookLayerHandlers({ drawHookTrail() {}, drawHook() {} }),
    /drawCarryLabel must be a function/,
  );
});
