import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createMinerPose,
  drawMinerBackLayer,
  drawMinerFrontLayer,
} from "../../src/render/minerRenderer.js";

function createGradient(calls, type, args) {
  const gradient = { type, args };
  return Object.assign(gradient, {
    addColorStop(offset, color) {
      calls.push(["addColorStop", type, offset, color]);
    },
  });
}

function createFakeCtx(overrides = {}) {
  const calls = [];
  const ctx = {
    calls,
    save() {
      calls.push(["save"]);
    },
    restore() {
      calls.push(["restore"]);
    },
    translate(...args) {
      calls.push(["translate", ...args]);
    },
    rotate(...args) {
      calls.push(["rotate", ...args]);
    },
    beginPath() {
      calls.push(["beginPath"]);
    },
    ellipse(...args) {
      calls.push(["ellipse", ...args]);
    },
    fill() {
      calls.push(["fill"]);
    },
    stroke() {
      calls.push(["stroke"]);
    },
    arc(...args) {
      calls.push(["arc", ...args]);
    },
    moveTo(...args) {
      calls.push(["moveTo", ...args]);
    },
    lineTo(...args) {
      calls.push(["lineTo", ...args]);
    },
    quadraticCurveTo(...args) {
      calls.push(["quadraticCurveTo", ...args]);
    },
    fillRect(...args) {
      calls.push(["fillRect", ...args]);
    },
    drawImage(...args) {
      calls.push(["drawImage", ...args]);
    },
    arcTo(...args) {
      calls.push(["arcTo", ...args]);
    },
    closePath() {
      calls.push(["closePath"]);
    },
    createLinearGradient(...args) {
      calls.push(["createLinearGradient", ...args]);
      return createGradient(calls, "linear", args);
    },
    createRadialGradient(...args) {
      calls.push(["createRadialGradient", ...args]);
      return createGradient(calls, "radial", args);
    },
    set globalAlpha(value) {
      calls.push(["globalAlpha", value]);
    },
    set fillStyle(value) {
      calls.push(["fillStyle", value]);
    },
    set strokeStyle(value) {
      calls.push(["strokeStyle", value]);
    },
    set lineWidth(value) {
      calls.push(["lineWidth", value]);
    },
    set lineCap(value) {
      calls.push(["lineCap", value]);
    },
    set lineJoin(value) {
      calls.push(["lineJoin", value]);
    },
  };

  return Object.assign(ctx, overrides);
}

const poseOptions = () => ({
  hook: { angle: 0.42, maxAngle: 1.05, reelAngle: 1.2 },
  miner: { crank: 0.75, grip: 0.64, releasePop: 0.18 },
  pivot: { x: 180, y: 92 },
  reel: { x: 180, y: 70 },
  now: 123456,
  attachedItem: { weight: 5.2 },
});

function loadedAsset(label) {
  return { status: "loaded", image: { label, naturalWidth: 128, naturalHeight: 128 } };
}

function registryWith(entries) {
  return {
    get(key) {
      return entries[key] ?? null;
    },
  };
}

test("createMinerPose is deterministic for fixed runtime inputs", () => {
  const options = poseOptions();
  const pose = createMinerPose(options);

  assert.deepEqual(createMinerPose(options), pose);
  assert.equal(pose.pivot, options.pivot);
  assert.equal(pose.reel, options.reel);
  assert.equal(pose.now, 123456);
  assert.equal(pose.crank, 0.75);
  assert.equal(pose.phase, 1.2);
  assert.equal(pose.grip, 0.64);
  assert.equal(pose.releasePop, 0.18);
  assert.equal(Number(pose.aim.toFixed(4)), 0.4);
  assert.equal(Number(pose.strainBase.toFixed(6)), 0.8125);
  assert.equal(Number(pose.x.toFixed(6)), 182.446603);
  assert.equal(Number(pose.y.toFixed(6)), 33.714102);
});

test("drawMinerBackLayer draws the body, head, helmet, lamp, and canvas guards", () => {
  const ctx = createFakeCtx();
  const pose = createMinerPose(poseOptions());

  const summary = drawMinerBackLayer({ ctx, pose });

  assert.deepEqual(summary, { drewMinerBack: true });
  assert.equal(ctx.calls[0][0], "save");
  assert.equal(ctx.calls.at(-1)[0], "restore");
  assert.ok(ctx.calls.some((call) => call[0] === "translate" && call[1] === pose.x && call[2] === pose.y));
  assert.ok(ctx.calls.some((call) => call[0] === "fillRect"));
  assert.ok(ctx.calls.some((call) => call[0] === "createLinearGradient"));
  assert.ok(ctx.calls.some((call) => call[0] === "createRadialGradient" && call[6] === 24));
  assert.ok(ctx.calls.some((call) => call[0] === "arc" && call[1] === pose.x && call[3] === 19.5));
  assert.ok(ctx.calls.some((call) => call[0] === "fillStyle" && call[1] === "#ffd34d"));
  assert.ok(ctx.calls.filter((call) => call[0] === "arcTo").length >= 12);
});

test("miner layer draws the complete crayon miner asset without duplicate head layering", () => {
  const ctx = createFakeCtx();
  const pose = createMinerPose(poseOptions());
  const artAssets = registryWith({
    "sprite.minerBody": loadedAsset("body"),
    "sprite.minerHead": loadedAsset("head"),
  });

  drawMinerBackLayer({ ctx, pose, artAssets });

  assert.ok(
    ctx.calls.some(
      (call) =>
        call[0] === "drawImage" &&
        call[1].label === "body" &&
        call[2] === pose.x - 42 &&
        call[3] === pose.y - 42 &&
        call[4] === 84 &&
        call[5] === 121,
    ),
  );
  assert.equal(ctx.calls.some((call) => call[0] === "drawImage" && call[1].label === "head"), false);
});

test("drawMinerFrontLayer draws both articulated arms and heavy strain marks", () => {
  const ctx = createFakeCtx();
  const pose = createMinerPose(poseOptions());

  const summary = drawMinerFrontLayer({ ctx, pose });

  assert.deepEqual(summary, { drewMinerFront: true });
  assert.equal(ctx.calls[0][0], "save");
  assert.equal(ctx.calls.at(-1)[0], "restore");
  assert.ok(ctx.calls.some((call) => call[0] === "lineCap" && call[1] === "round"));
  assert.ok(ctx.calls.some((call) => call[0] === "lineJoin" && call[1] === "round"));
  assert.equal(ctx.calls.filter((call) => call[0] === "quadraticCurveTo").length, 4);
  assert.ok(ctx.calls.filter((call) => call[0] === "ellipse" && call[3] === 5.8 && call[4] === 4.8).length >= 2);
  assert.ok(ctx.calls.some((call) => call[0] === "strokeStyle" && call[1] === "rgba(255,255,255,0.55)"));
  assert.ok(ctx.calls.some((call) => call[0] === "moveTo" && call[1] === pose.x - 24 && call[2] === pose.y + 10));
});

test("miner layers restore canvas state when drawing throws", () => {
  const pose = createMinerPose(poseOptions());
  const backCtx = createFakeCtx({
    fill() {
      backCtx.calls.push(["fill"]);
      throw new Error("paint failed");
    },
  });
  const frontCtx = createFakeCtx({
    stroke() {
      frontCtx.calls.push(["stroke"]);
      throw new Error("stroke failed");
    },
  });

  assert.throws(() => drawMinerBackLayer({ ctx: backCtx, pose }), /paint failed/);
  assert.equal(backCtx.calls.at(-1)[0], "restore");
  assert.throws(() => drawMinerFrontLayer({ ctx: frontCtx, pose }), /stroke failed/);
  assert.equal(frontCtx.calls.at(-1)[0], "restore");
});

test("miner renderer rejects invalid structural inputs", () => {
  const options = poseOptions();
  const pose = createMinerPose(options);

  assert.throws(() => createMinerPose(), /hook/);
  assert.throws(() => createMinerPose({ ...options, hook: { ...options.hook, angle: Number.NaN } }), /hook\.angle/);
  assert.throws(() => createMinerPose({ ...options, miner: { ...options.miner, grip: "0" } }), /miner\.grip/);
  assert.throws(() => createMinerPose({ ...options, pivot: { x: 0, y: Number.POSITIVE_INFINITY } }), /pivot\.y/);
  assert.throws(() => createMinerPose({ ...options, attachedItem: { weight: Number.NaN } }), /attachedItem\.weight/);
  assert.throws(() => drawMinerBackLayer({ ctx: {}, pose }), /ctx\.save/);
  const ctxWithoutDrawImage = createFakeCtx();
  delete ctxWithoutDrawImage.drawImage;
  assert.throws(() => drawMinerBackLayer({ ctx: ctxWithoutDrawImage, pose }), /ctx\.drawImage/);
  assert.throws(() => drawMinerFrontLayer({ ctx: createFakeCtx(), pose: { ...pose, reel: { x: 0, y: Number.NaN } } }), /reel\.y/);
});
