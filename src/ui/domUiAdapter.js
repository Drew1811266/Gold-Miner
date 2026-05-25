const MARKET_SUMMARY_FALLBACK = "金条±0%  钻石±0%  祖母绿±0%  红宝石±0%  水晶簇±0%";

export function createHudSnapshot({ game, canBomb }) {
  const score = Math.floor(game.score);
  const bombs = game.inventory.bombs;
  const speed = game.inventory.speed;
  const lucky = game.inventory.lucky;
  const inGame = game.phase !== "menu";
  const marketTicker =
    game.phase === "menu"
      ? "当日行情：进入关卡后开盘"
      : `当日行情[${game.market?.name ?? "交易日"}] ${
          game.market?.summary ?? MARKET_SUMMARY_FALLBACK
        }`;

  return {
    text: {
      level: String(game.level),
      score: String(score),
      target: String(Math.floor(game.target)),
      time: String(Math.ceil(game.timeLeft)),
      bombs: String(bombs),
      speedTokens: String(speed),
      luckyTokens: String(lucky),
      pauseBtn: game.paused ? "继续" : "暂停",
      marketTicker,
    },
    disabled: {
      pauseBtn: !inGame || game.phase !== "playing",
      restartBtn: !inGame,
      startBtn: game.phase !== "menu",
      bombBtn: !canBomb,
    },
    classes: {
      timeStat: {
        danger: game.phase === "playing" && !game.paused && game.timeLeft <= 10,
      },
    },
    values: {
      bombs,
      speed,
      lucky,
      score,
    },
  };
}

export function applyHudSnapshot({ ui, uiRefs, snapshot, previous, bump }) {
  ui.level.textContent = snapshot.text.level;
  ui.score.textContent = snapshot.text.score;
  ui.target.textContent = snapshot.text.target;
  ui.time.textContent = snapshot.text.time;
  ui.bombs.textContent = snapshot.text.bombs;
  ui.speedTokens.textContent = snapshot.text.speedTokens;
  ui.luckyTokens.textContent = snapshot.text.luckyTokens;

  if (snapshot.values.bombs !== previous.bombs) bump(uiRefs.bombChip);
  if (snapshot.values.speed !== previous.speed) bump(uiRefs.speedChip);
  if (snapshot.values.lucky !== previous.lucky) bump(uiRefs.luckyChip);
  if (snapshot.values.score !== previous.score && snapshot.values.score > previous.score) {
    bump(uiRefs.scoreStat);
  }

  previous.bombs = snapshot.values.bombs;
  previous.speed = snapshot.values.speed;
  previous.lucky = snapshot.values.lucky;
  previous.score = snapshot.values.score;

  uiRefs.timeStat?.classList.toggle("danger", snapshot.classes.timeStat.danger);

  ui.pauseBtn.disabled = snapshot.disabled.pauseBtn;
  ui.restartBtn.disabled = snapshot.disabled.restartBtn;
  ui.startBtn.disabled = snapshot.disabled.startBtn;
  ui.bombBtn.disabled = snapshot.disabled.bombBtn;
  ui.pauseBtn.textContent = snapshot.text.pauseBtn;

  if (ui.marketTicker) {
    ui.marketTicker.textContent = snapshot.text.marketTicker;
  }
}
