import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyAudioEventsToFacade,
  createAudioButtonSnapshot,
} from "../../src/audio/audioAdapter.js";
import { audioPlayEvent, audioSyncButtonsEvent } from "../../src/audio/audioEvents.js";
import { hudUpdateEvent } from "../../src/ui/uiEvents.js";
import { GameEventType } from "../../src/events/eventTypes.js";

test("createAudioButtonSnapshot reads GameAudio facade state without DOM access", () => {
  const snapshot = createAudioButtonSnapshot({
    isSfxEnabled: () => false,
    isMusicEnabled: () => true,
    getTrackName: () => "矿洞回声",
  });

  assert.deepEqual(snapshot, {
    sfxEnabled: false,
    musicEnabled: true,
    trackName: "矿洞回声",
    soundText: "音效: 关",
    musicText: "音乐: 开 · 矿洞回声",
  });
});

test("createAudioButtonSnapshot defaults to enabled controls when audio facade is absent", () => {
  assert.deepEqual(createAudioButtonSnapshot(), {
    sfxEnabled: true,
    musicEnabled: true,
    trackName: "",
    soundText: "音效: 开",
    musicText: "音乐: 开",
  });
});

test("applyAudioEventsToFacade routes audio events to the supplied facade", () => {
  const calls = [];

  applyAudioEventsToFacade(
    [
      audioPlayEvent("score", { amount: 100 }),
      hudUpdateEvent(),
      audioSyncButtonsEvent(),
    ],
    {
      audio: {
        init: () => calls.push(["init"]),
        play: (name, options) => calls.push(["play", name, options]),
      },
      syncButtons: () => calls.push(["syncButtons"]),
    },
  );

  assert.deepEqual(calls, [
    ["init"],
    ["play", "score", { amount: 100 }],
    ["syncButtons"],
  ]);
});

test("applyAudioEventsToFacade tolerates missing optional facade methods", () => {
  assert.doesNotThrow(() => {
    applyAudioEventsToFacade([audioPlayEvent("ui_click"), audioSyncButtonsEvent()]);
  });
});

test("applyAudioEventsToFacade ignores malformed matching events through the event adapter", () => {
  const calls = [];

  assert.doesNotThrow(() => {
    applyAudioEventsToFacade(
      [
        { type: GameEventType.AUDIO_PLAY, payload: null },
        { type: GameEventType.AUDIO_SYNC_BUTTONS, payload: [] },
      ],
      {
        audio: {
          init: () => calls.push(["init"]),
          play: () => calls.push(["play"]),
        },
        syncButtons: () => calls.push(["syncButtons"]),
      },
    );
  });

  assert.deepEqual(calls, []);
});

test("audio adapter validates structural inputs", () => {
  assert.throws(
    () => createAudioButtonSnapshot(null),
    /audio facade must be an object or function/,
  );
  assert.throws(
    () => applyAudioEventsToFacade(null),
    /audio events must be an array/,
  );
  assert.throws(
    () => applyAudioEventsToFacade([], null),
    /audio facade options must be an object or function/,
  );
  assert.throws(
    () => applyAudioEventsToFacade([], { audio: null }),
    /audio facade must be an object or function/,
  );
  assert.throws(
    () => applyAudioEventsToFacade([], { syncButtons: true }),
    /audio facade syncButtons must be a function/,
  );
});
