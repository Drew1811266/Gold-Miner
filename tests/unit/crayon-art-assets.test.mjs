import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CRAYON_ART_ASSETS,
  CRAYON_ART_BASE_PATH,
  createCrayonArtRegistry,
  drawCrayonImageAsset,
  getCrayonItemAssetKey,
} from "../../src/render/crayonArtAssets.js";

class FakeImage {
  constructor() {
    this.naturalWidth = 64;
    this.naturalHeight = 64;
    this.decoding = "";
  }

  set src(value) {
    this._src = value;
    if (value.includes("missing")) {
      this.onerror?.(new Error("missing image"));
    } else {
      this.onload?.();
    }
  }

  get src() {
    return this._src;
  }
}

function createCtx() {
  const calls = [];
  return {
    calls,
    drawImage(...args) {
      calls.push(["drawImage", ...args]);
    },
  };
}

test("crayon asset definitions contain stable keys and paths", () => {
  assert.equal(CRAYON_ART_BASE_PATH, "./assets/art/crayon/");
  const keys = CRAYON_ART_ASSETS.map((asset) => asset.key);
  assert.ok(keys.includes("background.mine"));
  assert.ok(keys.includes("texture.paper"));
  assert.ok(keys.includes("sprite.gold"));
  assert.ok(keys.includes("sprite.mouse.goldBar"));
  assert.ok(keys.includes("sprite.hookClaw"));
  assert.ok(keys.includes("icon.bomb"));
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(CRAYON_ART_ASSETS.every((asset) => asset.path.startsWith("./assets/art/crayon/")), true);
});

test("registry preloads images and reports loaded status", async () => {
  const registry = createCrayonArtRegistry({
    ImageCtor: FakeImage,
    definitions: [
      { key: "sprite.gold", path: "./assets/art/crayon/sprites/gold-nugget.png" },
      { key: "sprite.rock", path: "./assets/art/crayon/sprites/rock.png" },
    ],
  });

  const summary = await registry.preload();

  assert.deepEqual(summary, { total: 2, loaded: 2, failed: 0 });
  assert.equal(registry.status("sprite.gold"), "loaded");
  assert.equal(registry.has("sprite.rock"), true);
  assert.equal(registry.get("sprite.gold").image.src, "./assets/art/crayon/sprites/gold-nugget.png");
});

test("registry records failed images without throwing", async () => {
  const registry = createCrayonArtRegistry({
    ImageCtor: FakeImage,
    definitions: [{ key: "sprite.missing", path: "./assets/art/crayon/sprites/missing.png" }],
  });

  const summary = await registry.preload();

  assert.deepEqual(summary, { total: 1, loaded: 0, failed: 1 });
  assert.equal(registry.status("sprite.missing"), "failed");
  assert.equal(registry.has("sprite.missing"), false);
  assert.equal(registry.get("sprite.missing"), null);
});

test("drawCrayonImageAsset draws only loaded assets", () => {
  const ctx = createCtx();
  const loaded = { status: "loaded", image: { naturalWidth: 64, naturalHeight: 64 } };
  const failed = { status: "failed", image: { naturalWidth: 64, naturalHeight: 64 } };

  assert.equal(drawCrayonImageAsset(ctx, loaded, 10, 20, 30, 40), true);
  assert.equal(drawCrayonImageAsset(ctx, failed, 10, 20, 30, 40), false);
  assert.equal(drawCrayonImageAsset(ctx, null, 10, 20, 30, 40), false);
  assert.deepEqual(ctx.calls, [["drawImage", loaded.image, 10, 20, 30, 40]]);
});

test("getCrayonItemAssetKey maps runtime item types to sprite keys", () => {
  assert.equal(getCrayonItemAssetKey({ type: "gold" }), "sprite.gold");
  assert.equal(getCrayonItemAssetKey({ type: "bar" }), "sprite.goldBar");
  assert.equal(getCrayonItemAssetKey({ type: "diamond" }), "sprite.diamond");
  assert.equal(getCrayonItemAssetKey({ type: "emerald" }), "sprite.emerald");
  assert.equal(getCrayonItemAssetKey({ type: "ruby" }), "sprite.ruby");
  assert.equal(getCrayonItemAssetKey({ type: "crystal" }), "sprite.crystal");
  assert.equal(getCrayonItemAssetKey({ type: "bag" }), "sprite.luckyBag");
  assert.equal(getCrayonItemAssetKey({ type: "pouch" }), "sprite.coinPouch");
  assert.equal(getCrayonItemAssetKey({ type: "fossil" }), "sprite.fossil");
  assert.equal(getCrayonItemAssetKey({ type: "keg" }), "sprite.keg");
  assert.equal(getCrayonItemAssetKey({ type: "rock" }), "sprite.rock");
  assert.equal(getCrayonItemAssetKey({ type: "mouse", mouse: { cargo: "diamond" } }), "sprite.mouse.diamond");
  assert.equal(getCrayonItemAssetKey({ type: "mouse", mouse: { cargo: "bar" } }), "sprite.mouse.goldBar");
  assert.equal(getCrayonItemAssetKey({ type: "mouse", mouse: { cargo: null } }), "sprite.mouse");
  assert.equal(getCrayonItemAssetKey({ type: "unknown" }), null);
});
