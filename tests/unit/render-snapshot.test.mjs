import { test } from "node:test";
import assert from "node:assert/strict";
import { createRenderSnapshot } from "../../src/render/renderSnapshot.js";

function validInput(overrides = {}) {
  const ctx = { save() {} };
  const canvas = { width: 640, height: 360 };
  const players = [];
  const layers = {};
  const game = {
    viewport: { w: 320, h: 180 },
    fx: { shakeX: 0, shakeY: 0, flash: 0 },
    phase: "menu",
    paused: false,
    timeLeft: 60,
  };

  return {
    game,
    ctx,
    canvas,
    dpr: 2,
    players,
    layers,
    now: 123.45,
    ...overrides,
  };
}

test("createRenderSnapshot assembles the render pipeline options from inputs", () => {
  const input = validInput();
  const snapshot = createRenderSnapshot(input);

  assert.deepEqual(snapshot, {
    ctx: input.ctx,
    canvas: input.canvas,
    viewport: input.game.viewport,
    dpr: input.dpr,
    fx: input.game.fx,
    phase: input.game.phase,
    paused: input.game.paused,
    timeLeft: input.game.timeLeft,
    players: input.players,
    layers: input.layers,
    now: input.now,
  });
  assert.equal(snapshot.ctx, input.ctx);
  assert.equal(snapshot.canvas, input.canvas);
  assert.equal(snapshot.viewport, input.game.viewport);
  assert.equal(snapshot.fx, input.game.fx);
  assert.equal(snapshot.players, input.players);
  assert.equal(snapshot.layers, input.layers);
});

test("createRenderSnapshot does not clone or reorder render inputs", () => {
  const players = [{ index: 1 }, { index: 0 }];
  const layers = { background() {} };
  const input = validInput({ players, layers });

  const snapshot = createRenderSnapshot(input);

  assert.equal(snapshot.players, players);
  assert.equal(snapshot.layers, layers);
  assert.deepEqual(snapshot.players.map((player) => player.index), [1, 0]);
});

test("createRenderSnapshot validates required fields", () => {
  assert.throws(() => createRenderSnapshot(), /options must be an object/);
  assert.throws(() => createRenderSnapshot(validInput({ game: null })), /game must be an object/);
  assert.throws(
    () => createRenderSnapshot(validInput({ game: { viewport: null, fx: {}, phase: "menu", paused: false, timeLeft: 60 } })),
    /game.viewport must be an object/,
  );
  assert.throws(
    () => createRenderSnapshot(validInput({ game: { viewport: { w: 320, h: 180 }, fx: null, phase: "menu", paused: false, timeLeft: 60 } })),
    /game.fx must be an object/,
  );
  assert.throws(() => createRenderSnapshot(validInput({ dpr: "2" })), /dpr must be a finite number/);
  assert.throws(() => createRenderSnapshot(validInput({ players: {} })), /players must be an array/);
  assert.throws(() => createRenderSnapshot(validInput({ layers: null })), /layers must be an object/);
  assert.throws(() => createRenderSnapshot(validInput({ now: undefined })), /now must be a finite number/);
});
