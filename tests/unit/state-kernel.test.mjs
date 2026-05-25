import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialGameState } from "../../src/state/createInitialState.js";
import { stepPlayingState } from "../../src/state/stateKernel.js";

test("createInitialGameState preserves the runtime default shape", () => {
  const state = createInitialGameState({ minRope: 60 });

  assert.equal(state.phase, "menu");
  assert.equal(state.paused, false);
  assert.equal(state.mode, "single");
  assert.equal(state.level, 1);
  assert.equal(state.score, 0);
  assert.equal(state.target, 0);
  assert.equal(state.timeLeft, 60);
  assert.deepEqual(state.market, {
    name: "等待开盘",
    summary: "金条±0%  钻石±0%  祖母绿±0%  红宝石±0%  水晶簇±0%",
    multipliers: {
      bar: 1,
      diamond: 1,
      emerald: 1,
      ruby: 1,
      crystal: 1,
    },
  });
  assert.deepEqual(state.inventory, { bombs: 0, speed: 0, lucky: 0 });
  assert.deepEqual(state.effects, { speedMultiplier: 1, bombBoost: 0 });
  assert.deepEqual(state.scene, { stars: [], dust: [], dirt: [] });
  assert.deepEqual(state.fx, {
    pops: [],
    particles: [],
    rings: [],
    shake: 0,
    flash: 0,
    shakeX: 0,
    shakeY: 0,
  });
  assert.deepEqual(state.audio, { lastCountdownSec: null });
  assert.equal(state.hook.state, "swing");
  assert.equal(state.hook.angleDir, 1);
  assert.equal(state.hook.length, 60);
  assert.equal(state.hook.minLength, 60);
  assert.equal(state.hook.lastLength, 60);
  assert.equal(state.hook2.angleDir, -1);
  assert.equal(state.hook2.length, 60);
  assert.deepEqual(state.viewport, { w: 960, h: 540 });
  assert.deepEqual(state.miner, { grip: 1, crank: 0, releasePop: 0 });
  assert.deepEqual(state.miner2, { grip: 1, crank: 0, releasePop: 0 });
});

test("createInitialGameState returns fresh nested objects", () => {
  const first = createInitialGameState();
  const second = createInitialGameState();

  assert.notEqual(first, second);
  assert.notEqual(first.hook, second.hook);
  assert.notEqual(first.hook.trail, second.hook.trail);
  assert.notEqual(first.items, second.items);
  assert.notEqual(first.fx.pops, second.fx.pops);
});

test("createInitialGameState accepts runtime rope and viewport inputs", () => {
  const state = createInitialGameState({ minRope: 72, viewport: { w: 800, h: 450 } });

  assert.equal(state.hook.length, 72);
  assert.equal(state.hook2.minLength, 72);
  assert.deepEqual(state.viewport, { w: 800, h: 450 });
});

test("stepPlayingState advances time and returns continue state", () => {
  const state = createInitialGameState();
  state.phase = "playing";
  state.timeLeft = 30;

  assert.deepEqual(stepPlayingState({ state, dt: 0.25 }), {
    shouldContinue: true,
    ended: false,
    countdownSec: null,
  });
  assert.equal(state.timeLeft, 29.75);
});

test("stepPlayingState emits countdown once per second bucket", () => {
  const state = createInitialGameState();
  const calls = [];
  state.phase = "playing";
  state.timeLeft = 10.1;

  assert.deepEqual(
    stepPlayingState({
      state,
      dt: 0.2,
      events: { countdown: (sec) => calls.push(sec) },
    }),
    { shouldContinue: true, ended: false, countdownSec: 10 },
  );
  assert.equal(state.audio.lastCountdownSec, 10);
  assert.deepEqual(calls, [10]);

  assert.deepEqual(
    stepPlayingState({
      state,
      dt: 0.1,
      events: { countdown: (sec) => calls.push(sec) },
    }),
    { shouldContinue: true, ended: false, countdownSec: null },
  );
  assert.deepEqual(calls, [10]);
});

test("stepPlayingState ends the level at zero time", () => {
  const state = createInitialGameState();
  const calls = [];
  state.phase = "playing";
  state.timeLeft = 0.1;

  assert.deepEqual(
    stepPlayingState({
      state,
      dt: 0.2,
      events: { endLevel: () => calls.push("end") },
    }),
    { shouldContinue: false, ended: true, countdownSec: null },
  );
  assert.equal(state.timeLeft, 0);
  assert.deepEqual(calls, ["end"]);
});

test("stepPlayingState ignores non-playing phases", () => {
  const state = createInitialGameState();
  state.phase = "shop";
  state.timeLeft = 20;

  assert.deepEqual(stepPlayingState({ state, dt: 1 }), {
    shouldContinue: false,
    ended: false,
    countdownSec: null,
  });
  assert.equal(state.timeLeft, 20);
});

test("state kernel validates structural inputs", () => {
  assert.throws(() => createInitialGameState({ minRope: 0 }), /minRope/);
  assert.throws(() => createInitialGameState({ viewport: null }), /viewport/);
  assert.throws(() => stepPlayingState(), /state must be an object/);
  assert.throws(
    () => stepPlayingState({ state: { phase: "playing", timeLeft: 1, audio: {} }, dt: -1 }),
    /dt must be a non-negative finite number/,
  );
  assert.throws(
    () => stepPlayingState({ state: { phase: "playing", timeLeft: 1, audio: null }, dt: 0 }),
    /state\.audio must be an object/,
  );
  assert.throws(
    () => stepPlayingState({ state: createInitialGameState(), dt: 0, events: null }),
    /events must be an object/,
  );
  assert.throws(
    () => stepPlayingState({ state: createInitialGameState(), dt: 0, events: { countdown: true } }),
    /events\.countdown must be a function/,
  );
});
