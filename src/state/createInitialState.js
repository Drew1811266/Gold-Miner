function createInitialHookState({ angleDir = 1, minRope = 60 } = {}) {
  return {
    state: "swing",
    angle: 0,
    angleDir,
    minAngle: -1.15,
    maxAngle: 1.15,
    angleSpeed: 1.55,
    length: minRope,
    minLength: minRope,
    maxLength: 480,
    extendSpeed: 780,
    retractBaseSpeed: 640,
    attachedId: null,
    reelAngle: 0,
    spoolSpeed: 0,
    clawClose: 0,
    lastLength: minRope,
    trail: [],
    dustCooldown: 0,
    pivotX: 0,
  };
}

function createInitialMinerState() {
  return {
    grip: 1,
    crank: 0,
    releasePop: 0,
  };
}

export function createInitialGameState({ minRope = 60, viewport = { w: 960, h: 540 } } = {}) {
  if (!Number.isFinite(minRope) || minRope <= 0) {
    throw new TypeError("initial state minRope must be a positive finite number");
  }
  if (
    viewport === null ||
    typeof viewport !== "object" ||
    !Number.isFinite(viewport.w) ||
    !Number.isFinite(viewport.h)
  ) {
    throw new TypeError("initial state viewport must provide finite width and height");
  }

  return {
    phase: "menu",
    paused: false,
    mode: "single",
    lastHookIndex: 0,
    level: 1,
    score: 0,
    target: 0,
    timeLeft: 60,
    runSeed: 0,
    currentSeed: 0,
    randomStreams: {},
    randomStreamsRunSeed: null,
    randomStreamsLevelSeed: null,
    bgIndex: 0,
    market: {
      name: "等待开盘",
      summary: "金条±0%  钻石±0%  祖母绿±0%  红宝石±0%  水晶簇±0%",
      multipliers: {
        bar: 1,
        diamond: 1,
        emerald: 1,
        ruby: 1,
        crystal: 1,
      },
    },
    items: [],
    scene: {
      stars: [],
      dust: [],
      dirt: [],
    },
    inventory: {
      bombs: 0,
      speed: 0,
      lucky: 0,
    },
    effects: {
      speedMultiplier: 1,
      bombBoost: 0,
    },
    events: [],
    audio: {
      lastCountdownSec: null,
    },
    dda: {
      rating: 0,
      stage: 0,
      base: 0,
      post4Pressure: 0,
      difficulty: 0,
      targetMul: 1,
      timeMul: 1,
      levelStartScore: 0,
      levelTimeTotal: 0,
      firstClearTimeLeft: null,
      lastOverRatio: 0,
      lastSignal: 0,
    },
    fx: {
      pops: [],
      particles: [],
      rings: [],
      shake: 0,
      flash: 0,
      shakeX: 0,
      shakeY: 0,
    },
    hook: createInitialHookState({ angleDir: 1, minRope }),
    hook2: createInitialHookState({ angleDir: -1, minRope }),
    viewport: { w: viewport.w, h: viewport.h },
    miner: createInitialMinerState(),
    miner2: createInitialMinerState(),
  };
}
