import { test } from "node:test";
import assert from "node:assert/strict";
import { applyHudSnapshot, createHudSnapshot } from "../../src/ui/domUiAdapter.js";

function createClassList() {
  const classes = new Set();
  return {
    add(name) {
      classes.add(name);
    },
    remove(name) {
      classes.delete(name);
    },
    toggle(name, on) {
      if (on) {
        classes.add(name);
      } else {
        classes.delete(name);
      }
      return classes.has(name);
    },
    contains(name) {
      return classes.has(name);
    },
  };
}

function createElement() {
  return {
    textContent: "",
    disabled: false,
    classList: createClassList(),
  };
}

function createUiFixture() {
  const ui = {
    level: createElement(),
    score: createElement(),
    target: createElement(),
    time: createElement(),
    bombs: createElement(),
    speedTokens: createElement(),
    luckyTokens: createElement(),
    startBtn: createElement(),
    pauseBtn: createElement(),
    restartBtn: createElement(),
    bombBtn: createElement(),
    marketTicker: createElement(),
  };
  const uiRefs = {
    bombChip: createElement(),
    speedChip: createElement(),
    luckyChip: createElement(),
    timeStat: createElement(),
    scoreStat: createElement(),
  };
  return { ui, uiRefs };
}

function createGame(overrides = {}) {
  return {
    level: 3,
    score: 123.9,
    target: 250.7,
    timeLeft: 9.2,
    phase: "playing",
    paused: false,
    inventory: { bombs: 2, speed: 1, lucky: 4 },
    market: { name: "丰收日", summary: "金条+10%  钻石-5%" },
    ...overrides,
  };
}

test("createHudSnapshot formats HUD labels and playing controls", () => {
  const snapshot = createHudSnapshot({ game: createGame(), canBomb: true });

  assert.deepEqual(snapshot.text, {
    level: "3",
    score: "123",
    target: "250",
    time: "10",
    bombs: "2",
    speedTokens: "1",
    luckyTokens: "4",
    pauseBtn: "暂停",
    marketTicker: "当日行情[丰收日] 金条+10%  钻石-5%",
  });
  assert.deepEqual(snapshot.disabled, {
    pauseBtn: false,
    restartBtn: false,
    startBtn: true,
    bombBtn: false,
  });
  assert.deepEqual(snapshot.classes, { timeStat: { danger: true } });
  assert.deepEqual(snapshot.values, { bombs: 2, speed: 1, lucky: 4, score: 123 });
});

test("createHudSnapshot handles menu and paused danger/button states", () => {
  const snapshot = createHudSnapshot({
    game: createGame({ phase: "menu", paused: true, timeLeft: 5 }),
    canBomb: false,
  });

  assert.equal(snapshot.text.pauseBtn, "继续");
  assert.equal(snapshot.text.marketTicker, "当日行情：进入关卡后开盘");
  assert.deepEqual(snapshot.disabled, {
    pauseBtn: true,
    restartBtn: true,
    startBtn: false,
    bombBtn: true,
  });
  assert.equal(snapshot.classes.timeStat.danger, false);
});

test("createHudSnapshot uses playing market fallback text", () => {
  const snapshot = createHudSnapshot({
    game: createGame({ market: null, timeLeft: 30 }),
    canBomb: false,
  });

  assert.equal(
    snapshot.text.marketTicker,
    "当日行情[交易日] 金条±0%  钻石±0%  祖母绿±0%  红宝石±0%  水晶簇±0%",
  );
  assert.equal(snapshot.disabled.bombBtn, true);
  assert.equal(snapshot.classes.timeStat.danger, false);
});

test("applyHudSnapshot writes DOM state, toggles classes, bumps changes, and mutates previous", () => {
  const { ui, uiRefs } = createUiFixture();
  const previous = { bombs: 1, speed: 2, lucky: 3, score: 90 };
  const bumped = [];
  const snapshot = createHudSnapshot({
    game: createGame({ inventory: { bombs: 2, speed: 2, lucky: 4 }, score: 100.4 }),
    canBomb: true,
  });

  applyHudSnapshot({
    ui,
    uiRefs,
    snapshot,
    previous,
    bump: (element) => bumped.push(element),
  });

  assert.equal(ui.level.textContent, "3");
  assert.equal(ui.score.textContent, "100");
  assert.equal(ui.target.textContent, "250");
  assert.equal(ui.time.textContent, "10");
  assert.equal(ui.bombs.textContent, "2");
  assert.equal(ui.speedTokens.textContent, "2");
  assert.equal(ui.luckyTokens.textContent, "4");
  assert.equal(ui.pauseBtn.textContent, "暂停");
  assert.equal(ui.marketTicker.textContent, "当日行情[丰收日] 金条+10%  钻石-5%");
  assert.equal(ui.pauseBtn.disabled, false);
  assert.equal(ui.restartBtn.disabled, false);
  assert.equal(ui.startBtn.disabled, true);
  assert.equal(ui.bombBtn.disabled, false);
  assert.equal(uiRefs.timeStat.classList.contains("danger"), true);
  assert.deepEqual(bumped, [uiRefs.bombChip, uiRefs.luckyChip, uiRefs.scoreStat]);
  assert.deepEqual(previous, { bombs: 2, speed: 2, lucky: 4, score: 100 });
});

test("applyHudSnapshot does not score-bump decreases and removes danger class", () => {
  const { ui, uiRefs } = createUiFixture();
  uiRefs.timeStat.classList.add("danger");
  const previous = { bombs: 2, speed: 2, lucky: 4, score: 100 };
  const bumped = [];
  const snapshot = createHudSnapshot({
    game: createGame({
      score: 80,
      timeLeft: 11,
      inventory: { bombs: 2, speed: 3, lucky: 4 },
    }),
    canBomb: false,
  });

  applyHudSnapshot({
    ui,
    uiRefs,
    snapshot,
    previous,
    bump: (element) => bumped.push(element),
  });

  assert.equal(ui.bombBtn.disabled, true);
  assert.equal(uiRefs.timeStat.classList.contains("danger"), false);
  assert.deepEqual(bumped, [uiRefs.speedChip]);
  assert.deepEqual(previous, { bombs: 2, speed: 3, lucky: 4, score: 80 });
});
