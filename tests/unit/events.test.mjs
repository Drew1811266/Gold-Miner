import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GameEventType,
  assertGameEvent,
  gameEvent,
  isGameEvent,
  isGameEventType,
} from "../../src/events/eventTypes.js";
import {
  clearEvents,
  createEventQueue,
  drainEvents,
  enqueueEvent,
  hasPendingEvents,
  peekEvents,
} from "../../src/events/eventQueue.js";

test("gameEvent creates immutable event objects with immutable payloads", () => {
  const sourcePayload = {
    name: "level_start",
    options: {
      amount: 100,
      colors: ["#ffd34d"],
    },
  };
  const event = gameEvent(GameEventType.AUDIO_PLAY, sourcePayload);

  assert.deepEqual(event, {
    type: "AUDIO_PLAY",
    payload: {
      name: "level_start",
      options: {
        amount: 100,
        colors: ["#ffd34d"],
      },
    },
  });
  assert.ok(Object.isFrozen(event));
  assert.ok(Object.isFrozen(event.payload));
  assert.ok(Object.isFrozen(event.payload.options));
  assert.ok(Object.isFrozen(event.payload.options.colors));
  assert.equal(isGameEvent(event), true);
  assert.equal(assertGameEvent(event), event);

  sourcePayload.options.amount = 200;
  sourcePayload.options.colors.push("#ffffff");
  assert.equal(event.payload.options.amount, 100);
  assert.deepEqual(event.payload.options.colors, ["#ffd34d"]);
  assert.throws(() => {
    event.payload.options.amount = 300;
  }, TypeError);
});

test("event validation rejects unsupported and malformed events", () => {
  assert.equal(isGameEventType(GameEventType.HUD_UPDATE), true);
  assert.equal(isGameEventType("UNKNOWN"), false);
  assert.throws(() => gameEvent("UNKNOWN"), /Unsupported game event type/);
  assert.throws(
    () => gameEvent(GameEventType.AUDIO_PLAY, null),
    /payload must be an object/,
  );
  assert.equal(isGameEvent({ type: GameEventType.AUDIO_PLAY, payload: [] }), false);
  assert.throws(
    () => assertGameEvent({ type: "UNKNOWN", payload: {} }),
    /Unsupported game event type/,
  );
});

test("event queue enqueues peeks drains and clears without exposing internal array", () => {
  const queue = createEventQueue();
  const first = gameEvent(GameEventType.AUDIO_PLAY, { name: "ui_click" });
  const second = enqueueEvent(queue, GameEventType.HUD_UPDATE);

  assert.equal(hasPendingEvents(queue), true);
  const storedFirst = enqueueEvent(queue, first);
  assert.notEqual(storedFirst, first);
  assert.deepEqual(storedFirst, first);
  assert.deepEqual(peekEvents(queue), [second, storedFirst]);
  assert.equal("events" in queue, false);
  assert.equal(queue.events, undefined);

  const drained = drainEvents(queue);
  assert.deepEqual(drained, [second, storedFirst]);
  assert.equal(hasPendingEvents(queue), false);

  enqueueEvent(queue, GameEventType.OVERLAY_HIDE);
  clearEvents(queue);
  assert.deepEqual(drainEvents(queue), []);
});

test("event queue normalizes externally mutable events before storing them", () => {
  const mutableEvent = {
    type: GameEventType.AUDIO_PLAY,
    payload: {
      name: "score",
      options: {
        amount: 100,
      },
    },
  };
  const queue = createEventQueue([mutableEvent]);

  mutableEvent.payload.options.amount = 999;
  assert.equal(peekEvents(queue)[0].payload.options.amount, 100);

  const enqueued = enqueueEvent(queue, mutableEvent);
  mutableEvent.payload.options.amount = 500;

  assert.notEqual(enqueued, mutableEvent);
  assert.equal(enqueued.payload.options.amount, 999);
  assert.equal(drainEvents(queue)[1].payload.options.amount, 999);
});

import {
  applyAudioEvents,
  audioPlayEvent,
  audioSyncButtonsEvent,
} from "../../src/audio/audioEvents.js";
import {
  applyUiEvents,
  hudBumpEvent,
  hudUpdateEvent,
  overlayHideEvent,
  overlayShowEvent,
  shopRenderEvent,
} from "../../src/ui/uiEvents.js";
import {
  applyFxEvents,
  fxBurstEvent,
  fxFlashEvent,
  fxRingEvent,
  fxShakeEvent,
  scorePopEvent,
} from "../../src/fx/fxEvents.js";
import { applyEventsWithFallback } from "../../src/runtime/eventApplication.js";

test("audio event adapter routes only audio events", () => {
  const calls = [];
  const events = [
    audioPlayEvent("score", { amount: 100 }),
    hudUpdateEvent(),
    audioSyncButtonsEvent(),
  ];

  applyAudioEvents(events, {
    init: () => calls.push(["init"]),
    play: (name, options) => calls.push(["play", name, options]),
    syncButtons: () => calls.push(["syncButtons"]),
  });

  assert.deepEqual(calls, [
    ["init"],
    ["play", "score", { amount: 100 }],
    ["syncButtons"],
  ]);
});

test("ui event adapter routes HUD overlay and shop events", () => {
  const calls = [];
  const overlayConfig = { title: "商店", text: "购买道具" };

  applyUiEvents(
    [
      hudUpdateEvent(),
      hudBumpEvent("scoreStat"),
      shopRenderEvent(),
      overlayShowEvent(overlayConfig),
      overlayHideEvent(),
      audioPlayEvent("ignored"),
    ],
    {
      updateHud: () => calls.push(["updateHud"]),
      bumpHud: (target) => calls.push(["bumpHud", target]),
      renderShop: () => calls.push(["renderShop"]),
      showOverlay: (config) => calls.push(["showOverlay", config]),
      hideOverlay: () => calls.push(["hideOverlay"]),
    },
  );

  assert.deepEqual(calls, [
    ["updateHud"],
    ["bumpHud", "scoreStat"],
    ["renderShop"],
    ["showOverlay", overlayConfig],
    ["hideOverlay"],
  ]);
});

test("fx event adapter routes visual effects", () => {
  const calls = [];

  applyFxEvents(
    [
      fxRingEvent({ x: 1, y: 2, r0: 3, r1: 4, life: 0.5, color: "#fff", width: 2 }),
      fxBurstEvent({
        x: 1,
        y: 2,
        count: 5,
        colors: ["#fff"],
        speedMin: 1,
        speedMax: 2,
        sizeMin: 1,
        sizeMax: 2,
        lifeMin: 0.1,
        lifeMax: 0.2,
      }),
      fxFlashEvent(0.4),
      fxShakeEvent(0.3),
      scorePopEvent({ amount: 120, color: "#ffd34d", hookId: "p1" }),
      audioPlayEvent("ignored"),
    ],
    {
      spawnRing: (payload) => calls.push(["ring", payload.x, payload.y]),
      spawnBurst: (payload) => calls.push(["burst", payload.count]),
      flash: (amount) => calls.push(["flash", amount]),
      shake: (amount) => calls.push(["shake", amount]),
      scorePop: (payload) => calls.push(["scorePop", payload.amount, payload.color, payload.hookId]),
    },
  );

  assert.deepEqual(calls, [
    ["ring", 1, 2],
    ["burst", 5],
    ["flash", 0.4],
    ["shake", 0.3],
    ["scorePop", 120, "#ffd34d", "p1"],
  ]);
});

test("event adapters no-op when handlers are omitted", () => {
  assert.doesNotThrow(() => applyAudioEvents([audioPlayEvent("ui_click")]));
  assert.doesNotThrow(() => applyUiEvents([hudUpdateEvent()]));
  assert.doesNotThrow(() => applyFxEvents([fxFlashEvent(0.2)]));
});

test("event adapters ignore malformed matching events without crashing", () => {
  const calls = [];

  assert.doesNotThrow(() => {
    applyAudioEvents(
      [
        { type: GameEventType.AUDIO_PLAY, payload: null },
        { type: GameEventType.AUDIO_SYNC_BUTTONS, payload: [] },
      ],
      {
        init: () => calls.push(["audioInit"]),
        play: () => calls.push(["audioPlay"]),
        syncButtons: () => calls.push(["syncButtons"]),
      },
    );
    applyUiEvents(
      [
        { type: GameEventType.HUD_BUMP, payload: null },
        { type: GameEventType.OVERLAY_SHOW, payload: [] },
      ],
      {
        bumpHud: () => calls.push(["bumpHud"]),
        showOverlay: () => calls.push(["showOverlay"]),
      },
    );
    applyFxEvents(
      [
        { type: GameEventType.FX_FLASH, payload: null },
        { type: GameEventType.SCORE_POP, payload: [] },
      ],
      {
        flash: () => calls.push(["flash"]),
        scorePop: () => calls.push(["scorePop"]),
      },
    );
  });

  assert.deepEqual(calls, []);
});

test("applyEventsWithFallback skips the failed bridge event and falls back for remaining events", () => {
  const events = [
    gameEvent(GameEventType.HUD_UPDATE, { id: 1 }),
    gameEvent(GameEventType.HUD_UPDATE, { id: 2 }),
    gameEvent(GameEventType.HUD_UPDATE, { id: 3 }),
  ];
  const calls = [];
  const errors = [];

  const result = applyEventsWithFallback({
    events,
    bridgeApply: ([event]) => {
      calls.push(["bridge", event.payload.id]);
      if (event.payload.id === 2) throw new Error("bridge failed after partial work");
    },
    localApply: (remainingEvents) => {
      for (const event of remainingEvents) calls.push(["local", event.payload.id]);
    },
    onError: (error) => errors.push(error.message),
  });

  assert.deepEqual(calls, [
    ["bridge", 1],
    ["bridge", 2],
    ["local", 3],
  ]);
  assert.deepEqual(errors, ["bridge failed after partial work"]);
  assert.deepEqual(result, { usedBridge: true, disabled: true, failedIndex: 1 });
});

test("applyEventsWithFallback uses local apply when bridge is disabled by caller", () => {
  const events = [gameEvent(GameEventType.HUD_UPDATE, { id: 4 })];
  const calls = [];
  let bridgeEnabled = true;

  const first = applyEventsWithFallback({
    events,
    bridgeApply: () => {
      calls.push(["bridge", 4]);
      throw new Error("disable bridge");
    },
    localApply: (remainingEvents) => {
      for (const event of remainingEvents) calls.push(["local", event.payload.id]);
    },
  });
  if (first.disabled) bridgeEnabled = false;

  const second = applyEventsWithFallback({
    events,
    bridgeApply: bridgeEnabled ? () => calls.push(["bridge", 4]) : null,
    localApply: (remainingEvents) => {
      for (const event of remainingEvents) calls.push(["local", event.payload.id]);
    },
  });

  assert.deepEqual(calls, [
    ["bridge", 4],
    ["local", 4],
  ]);
  assert.deepEqual(second, { usedBridge: false, disabled: false, failedIndex: null });
});
