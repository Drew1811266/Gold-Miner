(() => {
  "use strict";

  const MUSIC_VOLUME = 0.16;
  const MUSIC_FADE_SEC = 0.28;
  const TRACK_FADE_OUT_SEC = 0.38;
  const TRACK_FADE_IN_SEC = 0.8;

  const STORAGE_KEYS = {
    sfx: "gold_miner_sfx",
    music: "gold_miner_music",
  };

  const state = {
    ctx: null,
    master: null,
    sfx: null,
    music: null,
    musicFilter: null,
    musicComp: null,
    musicReverbSend: null,
    musicReverb: null,
    musicReverbGain: null,
    enabledSfx: true,
    enabledMusic: true,
    noiseBuffer: null,
    musicTimer: null,
    nextNoteTime: 0,
    stepIndex: 0,
    trackIndex: 0,
    trackSeed: 0,
    trackSwitchTimer: null,
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function loadPrefs() {
    try {
      const sfx = localStorage.getItem(STORAGE_KEYS.sfx);
      const music = localStorage.getItem(STORAGE_KEYS.music);
      if (sfx !== null) state.enabledSfx = sfx === "1";
      if (music !== null) state.enabledMusic = music === "1";
    } catch {
      // ignore
    }
  }

  function savePrefs() {
    try {
      localStorage.setItem(STORAGE_KEYS.sfx, state.enabledSfx ? "1" : "0");
      localStorage.setItem(STORAGE_KEYS.music, state.enabledMusic ? "1" : "0");
    } catch {
      // ignore
    }
  }

  function createNoiseBuffer(ctx) {
    const seconds = 1.2;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function liftToRange(midi, min, max) {
    let n = midi;
    while (n < min) n += 12;
    while (n > max) n -= 12;
    return n;
  }

  function createReverbImpulse(ctx, seconds = 2.6, decay = 2.4) {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch += 1) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i += 1) {
        const t = i / length;
        const amp = Math.pow(1 - t, decay);
        data[i] = (Math.random() * 2 - 1) * amp;
      }
    }
    return buffer;
  }

  function ensureContext() {
    if (state.ctx) return state.ctx;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    const ctx = new AudioCtx();
    state.ctx = ctx;

    state.master = ctx.createGain();
    state.sfx = ctx.createGain();
    state.music = ctx.createGain();

    state.master.gain.value = 0.9;
    state.sfx.gain.value = state.enabledSfx ? 1 : 0;
    state.music.gain.value = state.enabledMusic ? MUSIC_VOLUME : 0;

    state.sfx.connect(state.master);

    // Music FX chain: warm lowpass + gentle compression + light reverb.
    state.musicFilter = ctx.createBiquadFilter();
    state.musicFilter.type = "lowpass";
    state.musicFilter.frequency.value = 2400;
    state.musicFilter.Q.value = 0.35;

    state.musicComp = ctx.createDynamicsCompressor();
    state.musicComp.threshold.value = -26;
    state.musicComp.knee.value = 18;
    state.musicComp.ratio.value = 3.2;
    state.musicComp.attack.value = 0.008;
    state.musicComp.release.value = 0.18;

    const musicDry = ctx.createGain();
    musicDry.gain.value = 0.9;

    state.musicReverbSend = ctx.createGain();
    state.musicReverbSend.gain.value = 0.32;

    state.musicReverb = ctx.createConvolver();
    state.musicReverb.buffer = createReverbImpulse(ctx, 2.8, 2.5);

    state.musicReverbGain = ctx.createGain();
    state.musicReverbGain.gain.value = 0.38;

    state.music.connect(state.musicFilter);
    state.musicFilter.connect(state.musicComp);
    state.musicComp.connect(musicDry);
    state.musicComp.connect(state.musicReverbSend);
    state.musicReverbSend.connect(state.musicReverb);
    state.musicReverb.connect(state.musicReverbGain);

    musicDry.connect(state.master);
    state.musicReverbGain.connect(state.master);
    state.master.connect(ctx.destination);

    state.noiseBuffer = createNoiseBuffer(ctx);

    return ctx;
  }

  async function init() {
    loadPrefs();
    const ctx = ensureContext();
    if (!ctx) return false;
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        // ignore
      }
    }
    if (state.enabledMusic) startMusic();
    return true;
  }

  function now() {
    const ctx = ensureContext();
    return ctx ? ctx.currentTime : 0;
  }

  function setSfxEnabled(enabled) {
    state.enabledSfx = Boolean(enabled);
    if (state.sfx) state.sfx.gain.value = state.enabledSfx ? 1 : 0;
    savePrefs();
  }

  function setMusicEnabled(enabled) {
    state.enabledMusic = Boolean(enabled);
    const ctx = ensureContext();
    if (ctx && state.music) {
      const t = ctx.currentTime;
      const g = state.music.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(state.enabledMusic ? MUSIC_VOLUME : 0, t + MUSIC_FADE_SEC);
    }
    if (state.enabledMusic) startMusic();
    else stopMusic();
    savePrefs();
  }

  function toggleSfx() {
    setSfxEnabled(!state.enabledSfx);
    return state.enabledSfx;
  }

  function toggleMusic() {
    setMusicEnabled(!state.enabledMusic);
    return state.enabledMusic;
  }

  function isSfxEnabled() {
    loadPrefs();
    return state.enabledSfx;
  }

  function isMusicEnabled() {
    loadPrefs();
    return state.enabledMusic;
  }

  function envelope(gainNode, t0, { attack = 0.005, decay = 0.06, sustain = 0.0, release = 0.12, peak = 1 }) {
    const g = gainNode.gain;
    g.cancelScheduledValues(t0);
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
    g.exponentialRampToValueAtTime(Math.max(0.0002, sustain), t0 + attack + decay);
    g.exponentialRampToValueAtTime(0.0001, t0 + attack + decay + release);
  }

  function playTone({
    type = "sine",
    freq = 440,
    freqTo = null,
    duration = 0.18,
    gain = 0.3,
    detune = 0,
    attack = 0.005,
    decay = 0.05,
    sustain = 0.0,
    release = 0.12,
    filter = null,
    pan = null,
    destination = "sfx",
    time = null,
  }) {
    const ctx = ensureContext();
    if (!ctx) return;

    const t0 = (time ?? ctx.currentTime) + 0.001;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqTo !== null) osc.frequency.exponentialRampToValueAtTime(freqTo, t0 + duration);
    osc.detune.setValueAtTime(detune, t0);

    const g = ctx.createGain();
    g.gain.value = 0.0001;

    let node = osc;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = filter.type ?? "lowpass";
      f.frequency.value = filter.freq ?? 1200;
      f.Q.value = filter.q ?? 0.8;
      node.connect(f);
      node = f;
    }

    if (pan !== null && typeof ctx.createStereoPanner === "function") {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      node.connect(p);
      node = p;
    }

    node.connect(g);
    const dest = destination === "music" ? state.music : state.sfx;
    g.connect(dest);

    envelope(g, t0, { attack, decay, sustain, release, peak: gain });
    osc.start(t0);
    osc.stop(t0 + duration + attack + decay + release + 0.02);
  }

  function playNoise({
    duration = 0.2,
    gain = 0.25,
    filter = { type: "highpass", freq: 800, q: 0.7 },
    attack = 0.001,
    decay = 0.03,
    sustain = 0.0,
    release = 0.12,
    destination = "sfx",
    time = null,
  }) {
    const ctx = ensureContext();
    if (!ctx || !state.noiseBuffer) return;

    const t0 = (time ?? ctx.currentTime) + 0.001;
    const src = ctx.createBufferSource();
    src.buffer = state.noiseBuffer;

    const f = ctx.createBiquadFilter();
    f.type = filter.type ?? "lowpass";
    f.frequency.setValueAtTime(filter.freq ?? 1200, t0);
    f.Q.setValueAtTime(filter.q ?? 0.8, t0);

    const g = ctx.createGain();
    g.gain.value = 0.0001;

    src.connect(f);
    f.connect(g);

    const dest = destination === "music" ? state.music : state.sfx;
    g.connect(dest);

    envelope(g, t0, { attack, decay, sustain, release, peak: gain });
    src.start(t0);
    src.stop(t0 + duration + attack + decay + release + 0.02);
  }

  function play(event, options = {}) {
    loadPrefs();
    const ctx = ensureContext();
    if (!ctx) return;
    if (!state.enabledSfx && event !== "music_start" && event !== "music_stop") return;

    const v = 1 + (Math.random() * 2 - 1) * 0.03;
    const det = (Math.random() * 2 - 1) * 18;

    switch (event) {
      case "ui_click": {
        playNoise({ duration: 0.06, gain: 0.12 * v, filter: { type: "highpass", freq: 1200, q: 0.7 }, release: 0.06 });
        break;
      }
      case "ui_error": {
        playTone({ type: "square", freq: 160, freqTo: 95, duration: 0.16, gain: 0.16, detune: det, filter: { type: "lowpass", freq: 650, q: 0.9 } });
        break;
      }
      case "hook_shoot": {
        // Rope whipping out + metal claw flick.
        playNoise({ duration: 0.2, gain: 0.16 * v, filter: { type: "highpass", freq: 950, q: 0.85 }, release: 0.16 });
        playTone({ type: "triangle", freq: 430, freqTo: 220, duration: 0.11, gain: 0.1 * v, detune: det * 0.6, filter: { type: "bandpass", freq: 720, q: 0.95 } });
        playTone({ type: "square", freq: 980, freqTo: 720, duration: 0.045, gain: 0.07 * v, detune: det, attack: 0.001, decay: 0.015, release: 0.05, filter: { type: "highpass", freq: 900, q: 0.7 } });
        break;
      }
      case "hook_retract_empty": {
        // Empty reel: lighter and faster motor/gear feel.
        playNoise({ duration: 0.14, gain: 0.11 * v, filter: { type: "bandpass", freq: 1200, q: 0.8 }, release: 0.12 });
        playTone({ type: "sawtooth", freq: 280, freqTo: 360, duration: 0.14, gain: 0.07 * v, detune: det * 0.5, filter: { type: "highpass", freq: 260, q: 0.7 }, attack: 0.002, decay: 0.04, release: 0.12 });
        playTone({ type: "square", freq: 760, duration: 0.032, gain: 0.045 * v, detune: det * 0.8, attack: 0.001, decay: 0.012, release: 0.035, filter: { type: "highpass", freq: 950, q: 0.8 } });
        break;
      }
      case "hook_retract_carry": {
        // Carrying load: heavier reel with lower pitch and slower drag.
        const weight = clamp(typeof options.weight === "number" ? options.weight : 1.8, 0.8, 6.2);
        const t = clamp((weight - 0.8) / 5.4, 0, 1);
        const base = lerp(230, 135, t);
        playNoise({ duration: 0.22, gain: lerp(0.1, 0.2, t) * v, filter: { type: "bandpass", freq: lerp(900, 420, t), q: 0.8 }, release: 0.2 });
        playTone({ type: "sawtooth", freq: base, freqTo: base * 0.78, duration: 0.22, gain: lerp(0.07, 0.13, t) * v, detune: det * 0.5, filter: { type: "lowpass", freq: lerp(1200, 650, t), q: 0.75 }, attack: 0.002, decay: 0.05, release: 0.2 });
        playTone({ type: "square", freq: lerp(720, 420, t), duration: 0.03, gain: lerp(0.03, 0.055, t) * v, detune: det, attack: 0.001, decay: 0.01, release: 0.03, filter: { type: "highpass", freq: 600, q: 0.7 } });
        break;
      }
      case "hook_catch_gold": {
        playTone({ type: "triangle", freq: 840, freqTo: 1240, duration: 0.09, gain: 0.14 * v, detune: det, attack: 0.002, decay: 0.03, release: 0.09 });
        playTone({ type: "sine", freq: 1600, duration: 0.06, gain: 0.07 * v, detune: det * 0.5, attack: 0.001, decay: 0.02, release: 0.06 });
        break;
      }
      case "hook_catch_bar": {
        playNoise({ duration: 0.11, gain: 0.12 * v, filter: { type: "bandpass", freq: 520, q: 0.9 }, release: 0.1 });
        playTone({ type: "square", freq: 300, freqTo: 180, duration: 0.11, gain: 0.12 * v, detune: det * 0.7, filter: { type: "lowpass", freq: 720, q: 0.8 }, attack: 0.001, decay: 0.035, release: 0.1 });
        break;
      }
      case "hook_catch_rock": {
        playNoise({ duration: 0.12, gain: 0.17 * v, filter: { type: "bandpass", freq: 260, q: 0.95 }, release: 0.12 });
        playTone({ type: "triangle", freq: 190, freqTo: 120, duration: 0.12, gain: 0.12 * v, detune: det, filter: { type: "lowpass", freq: 520, q: 0.85 } });
        break;
      }
      case "hook_catch_diamond": {
        playTone({ type: "sine", freq: 1280, freqTo: 1940, duration: 0.14, gain: 0.12 * v, detune: det, attack: 0.001, decay: 0.045, release: 0.16 });
        playTone({ type: "triangle", freq: 2420, duration: 0.08, gain: 0.06 * v, detune: det * 0.5, attack: 0.001, decay: 0.02, release: 0.1 });
        break;
      }
      case "hook_catch_emerald": {
        playTone({ type: "triangle", freq: 980, freqTo: 1420, duration: 0.13, gain: 0.12 * v, detune: det * 0.7, attack: 0.001, decay: 0.04, release: 0.14 });
        playTone({ type: "sine", freq: 1840, duration: 0.07, gain: 0.05 * v, detune: det * 0.4, attack: 0.001, decay: 0.02, release: 0.09 });
        break;
      }
      case "hook_catch_ruby": {
        playTone({ type: "triangle", freq: 860, freqTo: 1260, duration: 0.13, gain: 0.12 * v, detune: det * 0.8, attack: 0.001, decay: 0.04, release: 0.14 });
        playTone({ type: "sine", freq: 1640, duration: 0.07, gain: 0.05 * v, detune: det * 0.4, attack: 0.001, decay: 0.02, release: 0.09 });
        break;
      }
      case "hook_catch_crystal": {
        playNoise({ duration: 0.08, gain: 0.09 * v, filter: { type: "highpass", freq: 1800, q: 0.8 }, release: 0.08 });
        playTone({ type: "sine", freq: 1120, freqTo: 1760, duration: 0.14, gain: 0.1 * v, detune: det, attack: 0.001, decay: 0.045, release: 0.15 });
        break;
      }
      case "hook_catch_bag": {
        playNoise({ duration: 0.13, gain: 0.11 * v, filter: { type: "bandpass", freq: 620, q: 0.9 }, release: 0.12 });
        playTone({ type: "triangle", freq: 380, freqTo: 280, duration: 0.11, gain: 0.1 * v, detune: det * 0.6, attack: 0.001, decay: 0.03, release: 0.11 });
        break;
      }
      case "hook_catch_pouch": {
        playNoise({ duration: 0.12, gain: 0.1 * v, filter: { type: "bandpass", freq: 640, q: 0.85 }, release: 0.1 });
        playTone({ type: "triangle", freq: 410, freqTo: 300, duration: 0.1, gain: 0.09 * v, detune: det * 0.6, attack: 0.001, decay: 0.03, release: 0.1 });
        playTone({ type: "sine", freq: 1320, duration: 0.05, gain: 0.05 * v, detune: det * 0.3, attack: 0.001, decay: 0.01, release: 0.06 });
        break;
      }
      case "hook_catch_fossil": {
        playNoise({ duration: 0.1, gain: 0.11 * v, filter: { type: "bandpass", freq: 460, q: 0.9 }, release: 0.1 });
        playTone({ type: "square", freq: 260, freqTo: 170, duration: 0.1, gain: 0.1 * v, detune: det * 0.6, filter: { type: "lowpass", freq: 700, q: 0.75 }, attack: 0.001, decay: 0.03, release: 0.1 });
        break;
      }
      case "hook_catch_keg": {
        playNoise({ duration: 0.14, gain: 0.13 * v, filter: { type: "lowpass", freq: 480, q: 0.7 }, release: 0.14 });
        playTone({ type: "square", freq: 180, freqTo: 125, duration: 0.12, gain: 0.11 * v, detune: det * 0.6, filter: { type: "lowpass", freq: 620, q: 0.8 }, attack: 0.001, decay: 0.04, release: 0.12 });
        playNoise({ duration: 0.08, gain: 0.045 * v, filter: { type: "highpass", freq: 1700, q: 0.7 }, attack: 0.001, decay: 0.03, release: 0.08 });
        break;
      }
      case "hook_catch_mouse": {
        playTone({ type: "square", freq: 920, freqTo: 680, duration: 0.07, gain: 0.06 * v, detune: det * 1.2, filter: { type: "highpass", freq: 700, q: 0.7 }, attack: 0.001, decay: 0.02, release: 0.08 });
        playTone({ type: "triangle", freq: 540, freqTo: 420, duration: 0.06, gain: 0.055 * v, detune: det * 0.8, filter: { type: "lowpass", freq: 900, q: 0.7 }, attack: 0.001, decay: 0.02, release: 0.08 });
        break;
      }
      case "hook_catch_mouse_diamond": {
        playTone({ type: "square", freq: 940, freqTo: 700, duration: 0.07, gain: 0.058 * v, detune: det * 1.2, filter: { type: "highpass", freq: 700, q: 0.7 }, attack: 0.001, decay: 0.02, release: 0.08 });
        playTone({ type: "sine", freq: 1380, freqTo: 1880, duration: 0.11, gain: 0.08 * v, detune: det * 0.4, attack: 0.001, decay: 0.035, release: 0.11 });
        break;
      }
      case "hook_catch_mouse_bar": {
        playTone({ type: "square", freq: 900, freqTo: 680, duration: 0.07, gain: 0.058 * v, detune: det * 1.2, filter: { type: "highpass", freq: 700, q: 0.7 }, attack: 0.001, decay: 0.02, release: 0.08 });
        playTone({ type: "triangle", freq: 460, freqTo: 330, duration: 0.09, gain: 0.085 * v, detune: det * 0.5, filter: { type: "lowpass", freq: 780, q: 0.8 }, attack: 0.001, decay: 0.03, release: 0.1 });
        break;
      }
      case "hook_hit_gold": {
        playTone({ type: "triangle", freq: 880, freqTo: 1320, duration: 0.1, gain: 0.18 * v, detune: det, attack: 0.002, decay: 0.04, release: 0.08 });
        playTone({ type: "sine", freq: 1760, duration: 0.08, gain: 0.08 * v, detune: det, attack: 0.002, decay: 0.02, release: 0.06 });
        break;
      }
      case "hook_hit_rock": {
        playNoise({ duration: 0.12, gain: 0.18 * v, filter: { type: "bandpass", freq: 240, q: 0.9 }, release: 0.12 });
        playTone({ type: "square", freq: 120, freqTo: 85, duration: 0.12, gain: 0.12 * v, detune: det, filter: { type: "lowpass", freq: 480, q: 0.8 } });
        break;
      }
      case "hook_hit_diamond": {
        playTone({ type: "sine", freq: 1240, freqTo: 1860, duration: 0.16, gain: 0.14 * v, detune: det, attack: 0.002, decay: 0.06, release: 0.18 });
        playTone({ type: "triangle", freq: 2480, duration: 0.08, gain: 0.06 * v, detune: det, attack: 0.002, decay: 0.02, release: 0.1 });
        break;
      }
      case "hook_hit_bag": {
        playNoise({ duration: 0.14, gain: 0.12 * v, filter: { type: "bandpass", freq: 680, q: 0.9 }, release: 0.14 });
        playTone({ type: "triangle", freq: 420, freqTo: 300, duration: 0.12, gain: 0.12 * v, detune: det, attack: 0.002, decay: 0.04, release: 0.12 });
        break;
      }
      case "score": {
        const amount = typeof options.amount === "number" ? options.amount : 0;
        const base = amount >= 500 ? 740 : amount >= 250 ? 620 : 520;
        playTone({ type: "triangle", freq: base, freqTo: base * 1.4, duration: 0.11, gain: 0.14 * v, detune: det });
        playTone({ type: "sine", freq: base * 2.02, duration: 0.08, gain: 0.06 * v, detune: det });
        break;
      }
      case "bomb": {
        playNoise({ duration: 0.55, gain: 0.42, filter: { type: "lowpass", freq: 420, q: 0.6 }, attack: 0.001, decay: 0.1, release: 0.55 });
        playTone({ type: "sine", freq: 120, freqTo: 45, duration: 0.45, gain: 0.22, detune: det, filter: { type: "lowpass", freq: 220, q: 0.7 }, attack: 0.001, decay: 0.06, release: 0.55 });
        break;
      }
      case "shop_open": {
        playTone({ type: "triangle", freq: 392, duration: 0.09, gain: 0.1 });
        playTone({ type: "triangle", freq: 523.25, duration: 0.09, gain: 0.1, attack: 0.002, decay: 0.02, release: 0.14 });
        playTone({ type: "sine", freq: 784, duration: 0.12, gain: 0.08, attack: 0.002, decay: 0.03, release: 0.18 });
        break;
      }
      case "buy": {
        playTone({ type: "sine", freq: 660, duration: 0.08, gain: 0.08 });
        playTone({ type: "triangle", freq: 990, duration: 0.12, gain: 0.08, attack: 0.002, decay: 0.02, release: 0.14 });
        break;
      }
      case "pause": {
        playTone({ type: "sine", freq: 330, duration: 0.08, gain: 0.08 });
        break;
      }
      case "resume": {
        playTone({ type: "sine", freq: 440, duration: 0.08, gain: 0.08 });
        break;
      }
      case "countdown": {
        playTone({ type: "square", freq: 880, duration: 0.05, gain: 0.06, attack: 0.001, decay: 0.02, release: 0.06, filter: { type: "highpass", freq: 600, q: 0.7 } });
        break;
      }
      case "level_start": {
        playTone({ type: "triangle", freq: 392, duration: 0.12, gain: 0.1 });
        playTone({ type: "triangle", freq: 523.25, duration: 0.12, gain: 0.08, attack: 0.002, decay: 0.03, release: 0.18 });
        break;
      }
      case "game_over": {
        playTone({ type: "sine", freq: 330, freqTo: 196, duration: 0.35, gain: 0.14, attack: 0.003, decay: 0.08, release: 0.5, filter: { type: "lowpass", freq: 520, q: 0.8 } });
        break;
      }
      default:
        break;
    }
  }

  const TRACKS = [
    {
      name: "云海（C大调）",
      tempo: 68,
      stepsPerBar: 8, // 8th notes
      padEveryBars: 2,
      padHoldBars: 2,
      padGain: 0.08,
      arpGain: 0.04,
      bassGain: 0.03,
      bars: [
        { chord: [48, 55, 59, 62, 64], bass: 36 }, // Cmaj9
        { chord: [48, 55, 59, 62, 64], bass: 36 },
        { chord: [55, 62, 67, 69, 74], bass: 43 }, // Gsus2(add9)
        { chord: [55, 62, 67, 69, 74], bass: 43 },
        { chord: [57, 64, 67, 71, 72], bass: 45 }, // Am9
        { chord: [57, 64, 67, 71, 72], bass: 45 },
        { chord: [53, 60, 64, 67, 69], bass: 41 }, // Fmaj9
        { chord: [53, 60, 64, 67, 69], bass: 41 },
      ],
      arpPattern: [0, null, 2, null, 1, null, 3, null],
      bellBars: [3, 7],
    },
    {
      name: "月光河（D大调）",
      tempo: 60,
      stepsPerBar: 8,
      padEveryBars: 2,
      padHoldBars: 2,
      padGain: 0.085,
      arpGain: 0.038,
      bassGain: 0.028,
      bars: [
        { chord: [50, 57, 61, 64, 66], bass: 38 }, // Dmaj9
        { chord: [50, 57, 61, 64, 66], bass: 38 },
        { chord: [57, 64, 69, 71, 73], bass: 45 }, // Aadd9
        { chord: [57, 64, 69, 71, 73], bass: 45 },
        { chord: [59, 62, 66, 69, 74], bass: 47 }, // Bm7(9)
        { chord: [59, 62, 66, 69, 74], bass: 47 },
        { chord: [55, 62, 66, 69, 71], bass: 43 }, // Gmaj9
        { chord: [55, 62, 66, 69, 71], bass: 43 },
      ],
      arpPattern: [null, 2, null, 1, null, 3, null, 2],
      bellBars: [1, 5],
    },
    {
      name: "松林微风（G大调）",
      tempo: 74,
      stepsPerBar: 8,
      padEveryBars: 2,
      padHoldBars: 2,
      padGain: 0.075,
      arpGain: 0.035,
      bassGain: 0.03,
      bars: [
        { chord: [55, 62, 66, 69, 71], bass: 43 }, // Gmaj9
        { chord: [55, 62, 66, 69, 71], bass: 43 },
        { chord: [54, 62, 66, 69, 73], bass: 42 }, // D(add9)/F#
        { chord: [54, 62, 66, 69, 73], bass: 42 },
        { chord: [52, 59, 62, 66, 67], bass: 40 }, // Em9
        { chord: [52, 59, 62, 66, 67], bass: 40 },
        { chord: [48, 55, 59, 62, 64], bass: 36 }, // Cmaj9
        { chord: [48, 55, 59, 62, 64], bass: 36 },
      ],
      arpPattern: [0, null, 1, null, 2, null, 1, null],
      bellBars: [2, 6],
    },
    {
      name: "沙丘午后（E小调）",
      tempo: 70,
      stepsPerBar: 8,
      padEveryBars: 2,
      padHoldBars: 2,
      padGain: 0.078,
      arpGain: 0.032,
      bassGain: 0.03,
      bars: [
        { chord: [52, 59, 62, 66, 67], bass: 40 }, // Em9
        { chord: [52, 59, 62, 66, 67], bass: 40 },
        { chord: [48, 55, 59, 62, 64], bass: 36 }, // Cmaj9
        { chord: [48, 55, 59, 62, 64], bass: 36 },
        { chord: [55, 62, 66, 69, 71], bass: 43 }, // Gmaj9
        { chord: [55, 62, 66, 69, 71], bass: 43 },
        { chord: [50, 57, 62, 64, 69], bass: 38 }, // Dsus2(add9)
        { chord: [50, 57, 62, 64, 69], bass: 38 },
      ],
      arpPattern: [0, null, null, 2, null, null, 3, null],
      bellBars: [0, 4],
    },
    {
      name: "星砂梦境（F大调）",
      tempo: 62,
      stepsPerBar: 8,
      padEveryBars: 2,
      padHoldBars: 2,
      padGain: 0.082,
      arpGain: 0.036,
      bassGain: 0.028,
      bars: [
        { chord: [53, 60, 64, 67, 69], bass: 41 }, // Fmaj9
        { chord: [53, 60, 64, 67, 69], bass: 41 },
        { chord: [52, 55, 60, 62, 67], bass: 40 }, // Cadd9/E
        { chord: [52, 55, 60, 62, 67], bass: 40 },
        { chord: [50, 57, 60, 64, 65], bass: 38 }, // Dm9
        { chord: [50, 57, 60, 64, 65], bass: 38 },
        { chord: [58, 65, 69, 72, 74], bass: 46 }, // Bbmaj9
        { chord: [58, 65, 69, 72, 74], bass: 46 },
      ],
      arpPattern: [0, null, 2, null, 4, null, 2, null],
      bellBars: [3, 5],
    },
    {
      name: "晨雾湾（A大调）",
      tempo: 66,
      stepsPerBar: 8,
      padEveryBars: 2,
      padHoldBars: 2,
      padGain: 0.082,
      arpGain: 0.036,
      bassGain: 0.029,
      bars: [
        { chord: [57, 61, 64, 68, 71], bass: 45 }, // Amaj9
        { chord: [57, 61, 64, 68, 71], bass: 45 },
        { chord: [52, 56, 59, 63, 66], bass: 40 }, // Emaj9
        { chord: [52, 56, 59, 63, 66], bass: 40 },
        { chord: [54, 57, 61, 64, 68], bass: 42 }, // F#m9
        { chord: [54, 57, 61, 64, 68], bass: 42 },
        { chord: [50, 54, 57, 61, 64], bass: 38 }, // Dmaj9
        { chord: [50, 54, 57, 61, 64], bass: 38 },
      ],
      arpPattern: [0, null, 3, null, 1, null, 4, null],
      bellBars: [1, 6],
    },
    {
      name: "湖面涟漪（Bb大调）",
      tempo: 64,
      stepsPerBar: 8,
      padEveryBars: 2,
      padHoldBars: 2,
      padGain: 0.083,
      arpGain: 0.034,
      bassGain: 0.028,
      bars: [
        { chord: [58, 62, 65, 69, 72], bass: 46 }, // Bbmaj9
        { chord: [58, 62, 65, 69, 72], bass: 46 },
        { chord: [53, 57, 60, 62, 67], bass: 41 }, // F6/9
        { chord: [53, 57, 60, 62, 67], bass: 41 },
        { chord: [55, 58, 62, 65, 69], bass: 43 }, // Gm9
        { chord: [55, 58, 62, 65, 69], bass: 43 },
        { chord: [51, 55, 58, 62, 65], bass: 39 }, // Ebmaj9
        { chord: [51, 55, 58, 62, 65], bass: 39 },
      ],
      arpPattern: [null, 2, null, 4, null, 3, null, 1],
      bellBars: [2, 7],
    },
    {
      name: "石径微雨（C#小调）",
      tempo: 69,
      stepsPerBar: 8,
      padEveryBars: 2,
      padHoldBars: 2,
      padGain: 0.078,
      arpGain: 0.033,
      bassGain: 0.03,
      bars: [
        { chord: [49, 52, 56, 59, 63], bass: 37 }, // C#m9
        { chord: [49, 52, 56, 59, 63], bass: 37 },
        { chord: [57, 64, 68, 71, 73], bass: 45 }, // Amaj9
        { chord: [57, 64, 68, 71, 73], bass: 45 },
        { chord: [52, 56, 59, 63, 66], bass: 40 }, // Emaj9
        { chord: [52, 56, 59, 63, 66], bass: 40 },
        { chord: [59, 62, 66, 69, 73], bass: 47 }, // Bm9
        { chord: [59, 62, 66, 69, 73], bass: 47 },
      ],
      arpPattern: [0, null, null, 2, null, 4, null, 1],
      bellBars: [3, 7],
    },
    {
      name: "雪原微光（Eb大调）",
      tempo: 58,
      stepsPerBar: 8,
      padEveryBars: 2,
      padHoldBars: 4,
      padGain: 0.086,
      arpGain: 0.028,
      bassGain: 0.026,
      bars: [
        { chord: [51, 55, 58, 62, 65], bass: 39 }, // Ebmaj9
        { chord: [51, 55, 58, 62, 65], bass: 39 },
        { chord: [58, 62, 65, 67, 72], bass: 46 }, // Bb6/9
        { chord: [58, 62, 65, 67, 72], bass: 46 },
        { chord: [48, 51, 55, 58, 62], bass: 36 }, // Cm9
        { chord: [48, 51, 55, 58, 62], bass: 36 },
        { chord: [56, 60, 63, 67, 70], bass: 44 }, // Abmaj9
        { chord: [56, 60, 63, 67, 70], bass: 44 },
      ],
      arpPattern: [0, null, null, 2, null, null, 3, null],
      bellBars: [1, 5],
    },
    {
      name: "珊瑚浅滩（G小调）",
      tempo: 76,
      stepsPerBar: 16,
      padEveryBars: 2,
      padHoldBars: 2,
      padGain: 0.072,
      arpGain: 0.026,
      bassGain: 0.03,
      bars: [
        { chord: [55, 58, 62, 65, 69], bass: 43 }, // Gm9
        { chord: [55, 58, 62, 65, 69], bass: 43 },
        { chord: [51, 55, 58, 62, 65], bass: 39 }, // Ebmaj9
        { chord: [51, 55, 58, 62, 65], bass: 39 },
        { chord: [58, 62, 65, 69, 72], bass: 46 }, // Bbmaj9
        { chord: [58, 62, 65, 69, 72], bass: 46 },
        { chord: [53, 57, 60, 62, 67], bass: 41 }, // F6/9
        { chord: [53, 57, 60, 62, 67], bass: 41 },
      ],
      arpPattern: [0, null, 2, null, 1, null, 3, null, 4, null, 2, null, 1, null, 3, null],
      bellBars: [1, 5, 7],
    },
  ];

  function hash32(value) {
    let x = value >>> 0;
    x ^= x >>> 16;
    x = Math.imul(x, 0x7feb352d);
    x ^= x >>> 15;
    x = Math.imul(x, 0x846ca68b);
    x ^= x >>> 16;
    return x >>> 0;
  }

  function pickTrackIndex(seed) {
    const count = TRACKS.length;
    if (count <= 1) return 0;
    const h = hash32(seed >>> 0);
    return h % count;
  }

  function getTrackName() {
    return TRACKS[state.trackIndex]?.name ?? "";
  }

  function applyTrackSwitch(index, { fade = true } = {}) {
    const count = TRACKS.length;
    if (count === 0) return 0;
    const next = ((index % count) + count) % count;
    if (next === state.trackIndex) return state.trackIndex;
    state.trackIndex = next;

    const ctx = state.ctx;
    if (!ctx || !state.enabledMusic) return state.trackIndex;
    if (!state.musicTimer) return state.trackIndex;

    if (state.trackSwitchTimer) {
      clearTimeout(state.trackSwitchTimer);
      state.trackSwitchTimer = null;
    }

    if (!fade || !state.music) {
      stopMusic();
      startMusic();
      return state.trackIndex;
    }

    const t = ctx.currentTime;
    const g = state.music.gain;
    const current = g.value;
    g.cancelScheduledValues(t);
    g.setValueAtTime(current, t);
    g.linearRampToValueAtTime(0, t + TRACK_FADE_OUT_SEC);

    stopMusic();

    state.trackSwitchTimer = setTimeout(() => {
      state.trackSwitchTimer = null;
      if (!state.enabledMusic) return;
      if (!state.ctx || !state.music) return;
      startMusic();
      const t2 = state.ctx.currentTime;
      const g2 = state.music.gain;
      g2.cancelScheduledValues(t2);
      g2.setValueAtTime(g2.value, t2);
      g2.linearRampToValueAtTime(MUSIC_VOLUME, t2 + TRACK_FADE_IN_SEC);
    }, Math.max(0, Math.floor(TRACK_FADE_OUT_SEC * 1000)));

    return state.trackIndex;
  }

  function selectTrack(index, opts) {
    return applyTrackSwitch(index, opts);
  }

  function nextTrack() {
    return applyTrackSwitch(state.trackIndex + 1, { fade: true });
  }

  function setTrackFromSeed(seed) {
    state.trackSeed = seed >>> 0;
    const next = pickTrackIndex(state.trackSeed);
    return applyTrackSwitch(next, { fade: true });
  }

  function startMusic() {
    loadPrefs();
    const ctx = ensureContext();
    if (!ctx || !state.enabledMusic) return;
    if (state.musicTimer) return;

    const track = TRACKS[state.trackIndex] ?? TRACKS[0];
    if (!track) return;

    const beatDur = 60 / track.tempo; // quarter note
    const stepsPerBar = track.stepsPerBar ?? 8;
    const stepDur = (beatDur * 4) / stepsPerBar; // one bar = 4 beats
    const barDur = stepDur * stepsPerBar;
    const loopBars = track.bars.length;

    state.nextNoteTime = ctx.currentTime + 0.05;
    state.stepIndex = 0;

    function playPadChord(chord, time, holdBars) {
      const t = time + 0.002;
      const notes = chord.slice(0);
      const per = (track.padGain ?? 0.08) / Math.max(3, notes.length);
      const attack = 0.7;
      const decay = 0.8;
      const release = 2.8;

      for (let i = 0; i < notes.length; i += 1) {
        const midi = liftToRange(notes[i], 46, 78);
        const pan = notes.length <= 1 ? 0 : lerp(-0.35, 0.35, i / (notes.length - 1));
        const gentle = 0.88 + Math.random() * 0.18;
        playTone({
          destination: "music",
          type: "sine",
          freq: midiToFreq(midi),
          time: t,
          duration: barDur * holdBars,
          gain: per * gentle,
          attack,
          decay,
          sustain: per * 0.72,
          release,
          filter: { type: "lowpass", freq: 1200, q: 0.35 },
          pan,
        });

        // A very soft upper harmonic for air.
        playTone({
          destination: "music",
          type: "triangle",
          freq: midiToFreq(midi + 12),
          time: t,
          duration: barDur * holdBars,
          gain: per * 0.12 * gentle,
          attack: attack + 0.12,
          decay,
          sustain: per * 0.09,
          release: release + 0.4,
          filter: { type: "lowpass", freq: 1400, q: 0.3 },
          pan: pan * 0.9,
        });
      }
    }

    function playBass(midi, time) {
      const t = time + 0.001;
      const n = liftToRange(midi, 28, 48);
      const g = (track.bassGain ?? 0.03) * (0.92 + Math.random() * 0.16);
      playTone({
        destination: "music",
        type: "sine",
        freq: midiToFreq(n),
        time: t,
        duration: barDur * 1.05,
        gain: g,
        attack: 0.03,
        decay: 0.35,
        sustain: g * 0.75,
        release: 1.35,
        filter: { type: "lowpass", freq: 360, q: 0.55 },
        pan: -0.08,
      });
    }

    function playPluckFromChord(chord, index, time) {
      const t = time + (Math.random() * 2 - 1) * 0.008;
      const pick = chord[index % chord.length];
      const n = liftToRange(pick + 12, 60, 84);
      const g = (track.arpGain ?? 0.035) * (0.85 + Math.random() * 0.25);
      const pan = (Math.random() * 2 - 1) * 0.25;
      playTone({
        destination: "music",
        type: "triangle",
        freq: midiToFreq(n),
        time: t,
        duration: stepDur * 0.95,
        gain: g,
        attack: 0.004,
        decay: 0.06,
        sustain: 0.0,
        release: 0.45,
        filter: { type: "lowpass", freq: 1700, q: 0.6 },
        pan,
      });
    }

    function playBell(chord, time) {
      const n0 = chord[chord.length - 1] ?? chord[0];
      const n = liftToRange(n0 + 12, 68, 92);
      const t = time + beatDur * 1.8;
      const pan = (Math.random() * 2 - 1) * 0.3;
      playTone({
        destination: "music",
        type: "sine",
        freq: midiToFreq(n),
        time: t,
        duration: beatDur * 1.6,
        gain: 0.022,
        attack: 0.008,
        decay: 0.18,
        sustain: 0.012,
        release: 1.8,
        filter: { type: "lowpass", freq: 2200, q: 0.35 },
        pan,
      });
      playTone({
        destination: "music",
        type: "sine",
        freq: midiToFreq(n + 12),
        time: t,
        duration: beatDur * 1.3,
        gain: 0.008,
        attack: 0.008,
        decay: 0.14,
        sustain: 0.004,
        release: 1.55,
        filter: { type: "lowpass", freq: 2600, q: 0.3 },
        pan: pan * 0.85,
      });
    }

    function schedule() {
      const horizon = 0.7;
      while (state.nextNoteTime < ctx.currentTime + horizon) {
        const stepInBar = state.stepIndex % stepsPerBar;
        const barIndex = Math.floor(state.stepIndex / stepsPerBar);
        const bar = barIndex % loopBars;
        const info = track.bars[bar];
        const chord = info.chord;

        if (stepInBar === 0) {
          if (bar % (track.padEveryBars ?? 2) === 0) {
            playPadChord(chord, state.nextNoteTime, track.padHoldBars ?? 2);
          }
          playBass(info.bass, state.nextNoteTime);

          if ((track.bellBars ?? []).includes(bar)) {
            playBell(chord, state.nextNoteTime);
          }
        }

        const arpPick = (track.arpPattern ?? [])[stepInBar] ?? null;
        if (arpPick !== null) playPluckFromChord(chord, arpPick, state.nextNoteTime);

        state.stepIndex += 1;
        state.nextNoteTime += stepDur;
      }
    }

    state.musicTimer = setInterval(schedule, 90);
    schedule();
  }

  function stopMusic() {
    if (state.musicTimer) {
      clearInterval(state.musicTimer);
      state.musicTimer = null;
    }
  }

  loadPrefs();

  window.GameAudio = {
    init,
    play,
    startMusic,
    stopMusic,
    setSfxEnabled,
    setMusicEnabled,
    toggleSfx,
    toggleMusic,
    isSfxEnabled,
    isMusicEnabled,
    getTrackName,
    selectTrack,
    nextTrack,
    setTrackFromSeed,
    now,
  };
})();
