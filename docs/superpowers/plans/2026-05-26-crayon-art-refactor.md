# Crayon Art Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current cartoon visuals with a warm realistic storybook crayon art direction while preserving all gameplay behavior and collision data.

**Architecture:** Add a project-local crayon art pack and a pure image asset registry, then pass that registry into the existing render layers as optional presentation data. Canvas renderers draw generated sprites when assets are loaded and keep the current procedural drawing as fallback; UI styling changes stay in `styles.css` and preserve all DOM ids and event bindings.

**Tech Stack:** HTML5 Canvas, ES modules, Node built-in test runner, CSS, Codex built-in image generation, local chroma-key removal helper.

---

## File Structure

- Create `src/render/crayonArtAssets.js`: pure asset definitions, registry creation, loaded/failed state, and a small `drawCrayonImageAsset` helper.
- Create `tests/unit/crayon-art-assets.test.mjs`: registry tests with a fake image constructor.
- Modify `src/runtime/moduleBridge.js`: export and expose crayon asset helpers in `GoldMinerModules`.
- Modify `tests/unit/runtime-bridge.test.mjs`: add the new bridge keys in the exact public key list.
- Modify `tests/unit/dependency-boundaries.test.mjs`: keep the new render asset module inside the render boundary.
- Create `assets/art/crayon/backgrounds/`: generated cave and paper background PNG files.
- Create `assets/art/crayon/textures/`: paper grain and UI paper texture PNG files.
- Create `assets/art/crayon/sprites/`: transparent PNG sprites for game objects, miner, winch, hook, and effects.
- Create `assets/art/crayon/icons/`: transparent PNG UI icons.
- Modify `game.js`: initialize the art registry after bridge load, preload assets, expose debug status, and pass the registry into render layer options.
- Modify `src/render/backgroundRenderer.js`: draw crayon background and wood beam assets when present.
- Modify `src/render/itemRenderer.js`: draw item sprites by existing `item.type` and `item.r` before falling back to procedural art.
- Modify `src/render/minerRenderer.js`: draw crayon miner body/head surface assets while preserving pose and arm animation math.
- Modify `src/render/winchRenderer.js`: draw crayon winch plate/reel assets while preserving reel spin math.
- Modify `src/render/hookRenderer.js`: draw crayon metal/hook texture accents while preserving rope and claw open/close geometry.
- Modify `src/render/fxRenderer.js` and `src/render/carryLabelRenderer.js`: switch effects and score labels to paper/crayon styling with procedural fallback.
- Modify `styles.css`: replace modern dark glass UI with paper surfaces, charcoal borders, wax-crayon button fills, and generated icon backgrounds.
- Update `progress.md`: record this visual refactor, generated asset paths, verification results, and any remaining follow-up suggestions.

## Shared Art Direction Rules

Every generated asset uses the selected style:

```text
Warm realistic storybook wax-crayon illustration on textured sketchbook paper, visible wax strokes, graphite/charcoal contour lines, muted readable color, handmade natural edges, not flat vector, not glossy 3D, not polished cartoon.
```

For transparent sprites, append this chroma-key instruction:

```text
Create the subject on a perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, floor plane, or lighting variation. Keep the subject fully separated from the background with crisp edges and generous padding. Do not use #00ff00 anywhere in the subject. No watermark and no text.
```

## Task 1: Pure Crayon Asset Registry

**Files:**
- Create: `src/render/crayonArtAssets.js`
- Create: `tests/unit/crayon-art-assets.test.mjs`
- Modify: `src/runtime/moduleBridge.js`
- Modify: `tests/unit/runtime-bridge.test.mjs`
- Modify: `tests/unit/dependency-boundaries.test.mjs`

- [ ] **Step 1: Write the failing registry tests**

Create `tests/unit/crayon-art-assets.test.mjs` with this complete test file:

```js
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
```

- [ ] **Step 2: Run the focused tests and confirm the new test fails**

Run:

```bash
node --test tests/unit/crayon-art-assets.test.mjs
```

Expected: FAIL with a module resolution error for `src/render/crayonArtAssets.js`.

- [ ] **Step 3: Add the asset registry module**

Create `src/render/crayonArtAssets.js` with this complete module:

```js
export const CRAYON_ART_BASE_PATH = "./assets/art/crayon/";

export const CRAYON_ART_ASSETS = Object.freeze([
  { key: "background.mine", path: `${CRAYON_ART_BASE_PATH}backgrounds/mine-storybook.png` },
  { key: "texture.paper", path: `${CRAYON_ART_BASE_PATH}textures/paper-grain.png` },
  { key: "texture.uiPaper", path: `${CRAYON_ART_BASE_PATH}textures/ui-paper.png` },
  { key: "texture.woodBeam", path: `${CRAYON_ART_BASE_PATH}textures/wood-beam.png` },
  { key: "sprite.gold", path: `${CRAYON_ART_BASE_PATH}sprites/gold-nugget.png` },
  { key: "sprite.goldBar", path: `${CRAYON_ART_BASE_PATH}sprites/gold-bar.png` },
  { key: "sprite.rock", path: `${CRAYON_ART_BASE_PATH}sprites/rock.png` },
  { key: "sprite.diamond", path: `${CRAYON_ART_BASE_PATH}sprites/diamond.png` },
  { key: "sprite.emerald", path: `${CRAYON_ART_BASE_PATH}sprites/emerald.png` },
  { key: "sprite.ruby", path: `${CRAYON_ART_BASE_PATH}sprites/ruby.png` },
  { key: "sprite.crystal", path: `${CRAYON_ART_BASE_PATH}sprites/crystal.png` },
  { key: "sprite.luckyBag", path: `${CRAYON_ART_BASE_PATH}sprites/lucky-bag.png` },
  { key: "sprite.coinPouch", path: `${CRAYON_ART_BASE_PATH}sprites/coin-pouch.png` },
  { key: "sprite.fossil", path: `${CRAYON_ART_BASE_PATH}sprites/fossil.png` },
  { key: "sprite.keg", path: `${CRAYON_ART_BASE_PATH}sprites/dynamite-keg.png` },
  { key: "sprite.mouse", path: `${CRAYON_ART_BASE_PATH}sprites/mouse.png` },
  { key: "sprite.mouse.diamond", path: `${CRAYON_ART_BASE_PATH}sprites/mouse-diamond.png` },
  { key: "sprite.mouse.goldBar", path: `${CRAYON_ART_BASE_PATH}sprites/mouse-gold-bar.png` },
  { key: "sprite.minerBody", path: `${CRAYON_ART_BASE_PATH}sprites/miner-body.png` },
  { key: "sprite.minerHead", path: `${CRAYON_ART_BASE_PATH}sprites/miner-head.png` },
  { key: "sprite.winchPlate", path: `${CRAYON_ART_BASE_PATH}sprites/winch-plate.png` },
  { key: "sprite.winchReel", path: `${CRAYON_ART_BASE_PATH}sprites/winch-reel.png` },
  { key: "sprite.hookClaw", path: `${CRAYON_ART_BASE_PATH}sprites/hook-claw.png` },
  { key: "sprite.spark", path: `${CRAYON_ART_BASE_PATH}sprites/spark.png` },
  { key: "icon.bomb", path: `${CRAYON_ART_BASE_PATH}icons/bomb.png` },
  { key: "icon.speed", path: `${CRAYON_ART_BASE_PATH}icons/speed.png` },
  { key: "icon.lucky", path: `${CRAYON_ART_BASE_PATH}icons/lucky-bag.png` },
]);

const ITEM_ASSET_KEYS = Object.freeze({
  gold: "sprite.gold",
  bar: "sprite.goldBar",
  rock: "sprite.rock",
  diamond: "sprite.diamond",
  emerald: "sprite.emerald",
  ruby: "sprite.ruby",
  crystal: "sprite.crystal",
  bag: "sprite.luckyBag",
  pouch: "sprite.coinPouch",
  fossil: "sprite.fossil",
  keg: "sprite.keg",
});

export function getCrayonItemAssetKey(item) {
  if (!item || typeof item.type !== "string") return null;
  if (item.type === "mouse") {
    if (item.mouse?.cargo === "diamond") return "sprite.mouse.diamond";
    if (item.mouse?.cargo === "bar") return "sprite.mouse.goldBar";
    return "sprite.mouse";
  }
  return ITEM_ASSET_KEYS[item.type] ?? null;
}

function createEntry(definition) {
  return {
    key: definition.key,
    path: definition.path,
    image: null,
    status: "idle",
    error: null,
  };
}

function assertDefinitions(definitions) {
  if (!Array.isArray(definitions)) {
    throw new TypeError("createCrayonArtRegistry definitions must be an array");
  }
  const keys = new Set();
  for (const definition of definitions) {
    if (!definition || typeof definition.key !== "string" || definition.key.length === 0) {
      throw new TypeError("crayon asset definition key must be a non-empty string");
    }
    if (typeof definition.path !== "string" || definition.path.length === 0) {
      throw new TypeError(`crayon asset ${definition.key} path must be a non-empty string`);
    }
    if (keys.has(definition.key)) {
      throw new TypeError(`duplicate crayon asset key: ${definition.key}`);
    }
    keys.add(definition.key);
  }
}

export function createCrayonArtRegistry({ ImageCtor, definitions = CRAYON_ART_ASSETS } = {}) {
  if (typeof ImageCtor !== "function") {
    throw new TypeError("createCrayonArtRegistry ImageCtor must be a constructor");
  }
  assertDefinitions(definitions);

  const entries = new Map(definitions.map((definition) => [definition.key, createEntry(definition)]));
  let preloadPromise = null;

  const loadEntry = (entry) =>
    new Promise((resolve) => {
      const image = new ImageCtor();
      image.decoding = "async";
      entry.image = image;
      entry.status = "loading";
      image.onload = () => {
        entry.status = "loaded";
        resolve(entry);
      };
      image.onerror = (error) => {
        entry.status = "failed";
        entry.error = error instanceof Error ? error.message : String(error ?? "image load failed");
        resolve(entry);
      };
      image.src = entry.path;
    });

  const registry = {
    preload() {
      if (!preloadPromise) {
        preloadPromise = Promise.all([...entries.values()].map(loadEntry)).then(() => registry.summary());
      }
      return preloadPromise;
    },
    get(key) {
      const entry = entries.get(key) ?? null;
      return entry?.status === "loaded" ? entry : null;
    },
    has(key) {
      return entries.get(key)?.status === "loaded";
    },
    status(key) {
      return entries.get(key)?.status ?? "missing";
    },
    summary() {
      const all = [...entries.values()];
      return {
        total: all.length,
        loaded: all.filter((entry) => entry.status === "loaded").length,
        failed: all.filter((entry) => entry.status === "failed").length,
      };
    },
  };

  return registry;
}

export function drawCrayonImageAsset(ctx, asset, x, y, width, height) {
  if (!asset || asset.status !== "loaded" || !asset.image) return false;
  ctx.drawImage(asset.image, x, y, width, height);
  return true;
}
```

- [ ] **Step 4: Export registry helpers through the runtime bridge**

Modify `src/runtime/moduleBridge.js`:

Add this import near the render imports:

```js
import {
  CRAYON_ART_ASSETS,
  CRAYON_ART_BASE_PATH,
  createCrayonArtRegistry,
  drawCrayonImageAsset,
  getCrayonItemAssetKey,
} from "../render/crayonArtAssets.js";
```

Add this named export block near the render exports:

```js
export {
  CRAYON_ART_ASSETS,
  CRAYON_ART_BASE_PATH,
  createCrayonArtRegistry,
  drawCrayonImageAsset,
  getCrayonItemAssetKey,
};
```

Add these keys to the `GoldMinerModules` object immediately before `createSceneData`:

```js
  CRAYON_ART_ASSETS,
  CRAYON_ART_BASE_PATH,
  createCrayonArtRegistry,
  drawCrayonImageAsset,
  getCrayonItemAssetKey,
```

- [ ] **Step 5: Update bridge key tests**

In `tests/unit/runtime-bridge.test.mjs`, add these strings to `EXPECTED_GOLD_MINER_MODULE_KEYS` immediately before `"createSceneData"`:

```js
  "CRAYON_ART_ASSETS",
  "CRAYON_ART_BASE_PATH",
  "createCrayonArtRegistry",
  "drawCrayonImageAsset",
  "getCrayonItemAssetKey",
```

Add these assertions after the existing render helper assertions:

```js
    assert.equal(modules.CRAYON_ART_BASE_PATH, "./assets/art/crayon/");
    assert.equal(Array.isArray(modules.CRAYON_ART_ASSETS), true);
    assert.equal(typeof modules.createCrayonArtRegistry, "function");
    assert.equal(typeof modules.drawCrayonImageAsset, "function");
    assert.equal(modules.getCrayonItemAssetKey({ type: "gold" }), "sprite.gold");
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
node --test tests/unit/crayon-art-assets.test.mjs tests/unit/runtime-bridge.test.mjs tests/unit/dependency-boundaries.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit Task 1**

Run:

```bash
git add src/render/crayonArtAssets.js tests/unit/crayon-art-assets.test.mjs src/runtime/moduleBridge.js tests/unit/runtime-bridge.test.mjs tests/unit/dependency-boundaries.test.mjs
git commit -m "Add crayon art asset registry"
```

## Task 2: Generate And Commit Project Art Assets

**Files:**
- Create: `assets/art/crayon/backgrounds/mine-storybook.png`
- Create: `assets/art/crayon/textures/paper-grain.png`
- Create: `assets/art/crayon/textures/ui-paper.png`
- Create: `assets/art/crayon/textures/wood-beam.png`
- Create: `assets/art/crayon/sprites/gold-nugget.png`
- Create: `assets/art/crayon/sprites/gold-bar.png`
- Create: `assets/art/crayon/sprites/rock.png`
- Create: `assets/art/crayon/sprites/diamond.png`
- Create: `assets/art/crayon/sprites/emerald.png`
- Create: `assets/art/crayon/sprites/ruby.png`
- Create: `assets/art/crayon/sprites/crystal.png`
- Create: `assets/art/crayon/sprites/lucky-bag.png`
- Create: `assets/art/crayon/sprites/coin-pouch.png`
- Create: `assets/art/crayon/sprites/fossil.png`
- Create: `assets/art/crayon/sprites/dynamite-keg.png`
- Create: `assets/art/crayon/sprites/mouse.png`
- Create: `assets/art/crayon/sprites/mouse-diamond.png`
- Create: `assets/art/crayon/sprites/mouse-gold-bar.png`
- Create: `assets/art/crayon/sprites/miner-body.png`
- Create: `assets/art/crayon/sprites/miner-head.png`
- Create: `assets/art/crayon/sprites/winch-plate.png`
- Create: `assets/art/crayon/sprites/winch-reel.png`
- Create: `assets/art/crayon/sprites/hook-claw.png`
- Create: `assets/art/crayon/sprites/spark.png`
- Create: `assets/art/crayon/icons/bomb.png`
- Create: `assets/art/crayon/icons/speed.png`
- Create: `assets/art/crayon/icons/lucky-bag.png`
- Create: `assets/art/crayon/ART_PROMPTS.md`

- [ ] **Step 1: Create asset directories**

Run:

```bash
mkdir -p assets/art/crayon/backgrounds assets/art/crayon/textures assets/art/crayon/sprites assets/art/crayon/icons tmp/crayon-source
```

Expected: the four `assets/art/crayon/*` directories and `tmp/crayon-source` exist.

- [ ] **Step 2: Generate rectangular background and texture assets with imagegen**

Use the built-in `image_gen` tool once for each prompt below. After each generation, copy the selected generated PNG from `$CODEX_HOME/generated_images/...` into the exact project path listed in the table.

| Target path | Prompt |
| --- | --- |
| `assets/art/crayon/backgrounds/mine-storybook.png` | `Wide 16:9 HTML5 gold miner game background, warm realistic storybook wax-crayon illustration on textured sketchbook paper, visible cave layers, dark lower mine, warm red-brown mid cave, wooden beam area near top, soft cave depth, no characters, no text, no UI, muted readable colors, charcoal outlines, not flat vector, not glossy 3D.` |
| `assets/art/crayon/textures/paper-grain.png` | `Seamless warm sketchbook paper texture, subtle beige fibers, wax-crayon tooth, light graphite smudges, no objects, no text, low contrast, tileable.` |
| `assets/art/crayon/textures/ui-paper.png` | `Warm parchment UI panel texture, sketchbook paper grain, faint wax-crayon scuffs, slightly lighter center, darker hand-smudged edges, no objects, no text, tileable enough for panels.` |
| `assets/art/crayon/textures/wood-beam.png` | `Long horizontal wooden mine beam texture, warm realistic storybook wax-crayon, charcoal outline grain, planks and seams, straight side view, no nails larger than small specks, no text, no background beyond the beam.` |

- [ ] **Step 3: Generate transparent sprite sources with imagegen**

Use the built-in `image_gen` tool once for each target sprite. Each prompt must include the shared art direction and the chroma-key instruction from the top of this plan. Copy the selected generated PNG into `tmp/crayon-source/<filename>` before removal.

| Source path | Subject prompt |
| --- | --- |
| `tmp/crayon-source/gold-nugget.png` | `Single irregular gold nugget for a 2D gold miner game, three-quarter front view, readable at small size, warm yellow ochre wax-crayon texture, charcoal contour.` |
| `tmp/crayon-source/gold-bar.png` | `Single gold bar for a 2D gold miner game, front three-quarter view, beveled ingot, no letters or symbols, warm ochre crayon highlights, charcoal contour.` |
| `tmp/crayon-source/rock.png` | `Single rounded gray mine rock, rough graphite specks, wax-crayon shading, readable silhouette.` |
| `tmp/crayon-source/diamond.png` | `Single pale blue diamond gemstone, faceted but hand-drawn, muted cyan crayon color, charcoal contour, no sparkle star shapes.` |
| `tmp/crayon-source/emerald.png` | `Single green emerald gemstone, faceted but hand-drawn, muted green crayon color, charcoal contour.` |
| `tmp/crayon-source/ruby.png` | `Single red ruby gemstone, faceted but hand-drawn, muted red crayon color, charcoal contour.` |
| `tmp/crayon-source/crystal.png` | `Small blue-white crystal cluster, several points, wax-crayon strokes, graphite outlines, compact silhouette.` |
| `tmp/crayon-source/lucky-bag.png` | `Small drawstring lucky bag, purple cloth, wax-crayon fabric texture, charcoal seams, compact game item silhouette.` |
| `tmp/crayon-source/coin-pouch.png` | `Small old coin pouch with a few visible ancient coins, brown leather and dull gold, wax-crayon texture, charcoal outline.` |
| `tmp/crayon-source/fossil.png` | `Small beige fossil stone with simple bone imprint, hand-drawn crayon texture, charcoal outline, compact oval silhouette.` |
| `tmp/crayon-source/dynamite-keg.png` | `Small red dynamite keg with fuse, warm hand-drawn crayon texture, charcoal outline, no letters, no explosion.` |
| `tmp/crayon-source/mouse.png` | `Small realistic field mouse side view for a 2D game, gray-brown fur in wax-crayon strokes, charcoal outline, readable ears tail feet, no cargo.` |
| `tmp/crayon-source/mouse-diamond.png` | `Small realistic field mouse side view carrying one pale blue diamond on its back, wax-crayon strokes, charcoal outline, compact game silhouette.` |
| `tmp/crayon-source/mouse-gold-bar.png` | `Small realistic field mouse side view carrying one gold bar on its back, wax-crayon strokes, charcoal outline, compact game silhouette.` |
| `tmp/crayon-source/miner-body.png` | `Gold miner upper body without arms, front view, helmet, denim overalls, warm realistic storybook crayon, charcoal outline, designed for 2D game sprite.` |
| `tmp/crayon-source/miner-head.png` | `Gold miner head with helmet and lamp, front view, warm realistic storybook crayon, charcoal outline, no body, designed for 2D game sprite.` |
| `tmp/crayon-source/winch-plate.png` | `Small mine winch metal mounting plate with bolts, front view, hand-drawn crayon metal, graphite contour, compact game sprite.` |
| `tmp/crayon-source/winch-reel.png` | `Small circular mine winch reel, front view, hand-drawn metal and rope spool, wax-crayon texture, charcoal outline, compact game sprite.` |
| `tmp/crayon-source/hook-claw.png` | `Three-prong inward-curving metal claw hook for gold miner game, front view, open neutral pose, hand-drawn crayon metal, charcoal outline, compact sprite.` |
| `tmp/crayon-source/spark.png` | `Small hand-drawn crayon spark burst, warm yellow-orange, charcoal flecks, compact transparent game effect sprite.` |
| `tmp/crayon-source/bomb.png` | `Small bomb icon for game UI, wax-crayon red-black bomb with fuse, charcoal outline, no text.` |
| `tmp/crayon-source/speed.png` | `Small speed lightning icon for game UI, cyan-yellow wax-crayon lightning bolt, charcoal outline, no text.` |
| `tmp/crayon-source/lucky-bag-icon.png` | `Small lucky bag icon for game UI, purple cloth bag, wax-crayon texture, charcoal outline, no text.` |

- [ ] **Step 4: Remove chroma-key background from sprites**

Run this command from the repository root:

```bash
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --input tmp/crayon-source/gold-nugget.png --out assets/art/crayon/sprites/gold-nugget.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --input tmp/crayon-source/gold-bar.png --out assets/art/crayon/sprites/gold-bar.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --input tmp/crayon-source/rock.png --out assets/art/crayon/sprites/rock.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --input tmp/crayon-source/diamond.png --out assets/art/crayon/sprites/diamond.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --input tmp/crayon-source/emerald.png --out assets/art/crayon/sprites/emerald.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --input tmp/crayon-source/ruby.png --out assets/art/crayon/sprites/ruby.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --input tmp/crayon-source/crystal.png --out assets/art/crayon/sprites/crystal.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --input tmp/crayon-source/lucky-bag.png --out assets/art/crayon/sprites/lucky-bag.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --input tmp/crayon-source/coin-pouch.png --out assets/art/crayon/sprites/coin-pouch.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --input tmp/crayon-source/fossil.png --out assets/art/crayon/sprites/fossil.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --input tmp/crayon-source/dynamite-keg.png --out assets/art/crayon/sprites/dynamite-keg.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --input tmp/crayon-source/mouse.png --out assets/art/crayon/sprites/mouse.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --input tmp/crayon-source/mouse-diamond.png --out assets/art/crayon/sprites/mouse-diamond.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --input tmp/crayon-source/mouse-gold-bar.png --out assets/art/crayon/sprites/mouse-gold-bar.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --input tmp/crayon-source/miner-body.png --out assets/art/crayon/sprites/miner-body.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --input tmp/crayon-source/miner-head.png --out assets/art/crayon/sprites/miner-head.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --input tmp/crayon-source/winch-plate.png --out assets/art/crayon/sprites/winch-plate.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --input tmp/crayon-source/winch-reel.png --out assets/art/crayon/sprites/winch-reel.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --input tmp/crayon-source/hook-claw.png --out assets/art/crayon/sprites/hook-claw.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --input tmp/crayon-source/spark.png --out assets/art/crayon/sprites/spark.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --input tmp/crayon-source/bomb.png --out assets/art/crayon/icons/bomb.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --input tmp/crayon-source/speed.png --out assets/art/crayon/icons/speed.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --input tmp/crayon-source/lucky-bag-icon.png --out assets/art/crayon/icons/lucky-bag.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
```

Expected: every output PNG exists and has transparent corners.

- [ ] **Step 5: Record prompts**

Create `assets/art/crayon/ART_PROMPTS.md` and record:

```markdown
# Crayon Art Asset Prompts

Style direction: warm realistic storybook wax-crayon illustration on textured sketchbook paper, visible wax strokes, graphite/charcoal contour lines, muted readable color, handmade natural edges, not flat vector, not glossy 3D, not polished cartoon.

Transparent sprites were generated on flat #00ff00 chroma-key backgrounds and processed with:

`python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`

Asset list:
- `backgrounds/mine-storybook.png`: wide 16:9 cave game background, no characters, no UI.
- `textures/paper-grain.png`: seamless warm sketchbook paper texture.
- `textures/ui-paper.png`: parchment UI panel texture.
- `textures/wood-beam.png`: horizontal mine beam texture.
- `sprites/gold-nugget.png`: single irregular gold nugget.
- `sprites/gold-bar.png`: single gold bar with no text.
- `sprites/rock.png`: rounded gray mine rock.
- `sprites/diamond.png`: pale blue diamond.
- `sprites/emerald.png`: green emerald.
- `sprites/ruby.png`: red ruby.
- `sprites/crystal.png`: blue-white crystal cluster.
- `sprites/lucky-bag.png`: purple lucky bag.
- `sprites/coin-pouch.png`: old coin pouch.
- `sprites/fossil.png`: beige fossil stone.
- `sprites/dynamite-keg.png`: red dynamite keg with fuse.
- `sprites/mouse.png`: side-view field mouse without cargo.
- `sprites/mouse-diamond.png`: side-view field mouse carrying a diamond.
- `sprites/mouse-gold-bar.png`: side-view field mouse carrying a gold bar.
- `sprites/miner-body.png`: miner upper body without arms.
- `sprites/miner-head.png`: miner head with helmet and lamp.
- `sprites/winch-plate.png`: metal mounting plate with bolts.
- `sprites/winch-reel.png`: circular winch reel.
- `sprites/hook-claw.png`: open three-prong inward claw hook.
- `sprites/spark.png`: small crayon spark burst.
- `icons/bomb.png`: bomb UI icon.
- `icons/speed.png`: speed lightning UI icon.
- `icons/lucky-bag.png`: lucky bag UI icon.
```

- [ ] **Step 6: Inspect image metadata**

Run:

```bash
find assets/art/crayon -type f \( -name '*.png' -o -name '*.md' \) -print | sort
file assets/art/crayon/sprites/gold-nugget.png assets/art/crayon/icons/bomb.png assets/art/crayon/backgrounds/mine-storybook.png
```

Expected: all listed files exist; sprite and icon files report PNG image data with alpha-capable PNG format.

- [ ] **Step 7: Commit Task 2**

Run:

```bash
git add assets/art/crayon
git commit -m "Add crayon art asset pack"
```

## Task 3: Browser Host Asset Preload

**Files:**
- Modify: `game.js`
- Modify: `tests/unit/source-invariants.test.mjs`

- [ ] **Step 1: Add source invariant tests for host preload**

Append this test to `tests/unit/source-invariants.test.mjs`:

```js
test("game preloads crayon art assets without coupling gameplay state to asset loading", () => {
  const source = read("game.js");

  assert.match(source, /let crayonArtRegistry = null;/);
  assert.match(source, /function initCrayonArt\(\)/);
  assert.match(source, /GoldMinerModules\.createCrayonArtRegistry\(\{ ImageCtor: Image \}\)/);
  assert.match(source, /crayonArtRegistry\.preload\(\)\.then\(\(\) => render\(\)\)/);
  assert.match(source, /window\.__goldMinerCrayonArtStatus =/);
  assert.match(source, /function crayonArtAssets\(\)/);
  assert.match(source, /initCrayonArt\(\);/);
  assert.ok(
    source.indexOf("initCrayonArt();") > source.indexOf("initBackgrounds();"),
    "crayon art preload should start after existing background setup",
  );
});
```

- [ ] **Step 2: Run invariant test and confirm it fails**

Run:

```bash
node --test tests/unit/source-invariants.test.mjs
```

Expected: FAIL because `initCrayonArt` does not exist.

- [ ] **Step 3: Add host preload state**

In `game.js`, after `const bgAssets = { ... };`, add:

```js
let crayonArtRegistry = null;
```

After `initBackgrounds()`, add:

```js
function initCrayonArt() {
  if (!GoldMinerModules.createCrayonArtRegistry || typeof Image !== "function") {
    window.__goldMinerCrayonArtStatus = { total: 0, loaded: 0, failed: 0, skipped: true };
    return;
  }

  crayonArtRegistry = GoldMinerModules.createCrayonArtRegistry({ ImageCtor: Image });
  window.__goldMinerCrayonArtStatus = crayonArtRegistry.summary();
  crayonArtRegistry
    .preload()
    .then(() => render())
    .catch((error) => {
      window.__goldMinerCrayonArtError = error instanceof Error ? error.message : String(error);
    })
    .finally(() => {
      window.__goldMinerCrayonArtStatus = crayonArtRegistry?.summary() ?? { total: 0, loaded: 0, failed: 0 };
    });
}

function crayonArtAssets() {
  return crayonArtRegistry;
}
```

In `boot()`, after `initBackgrounds();`, add:

```js
  initCrayonArt();
```

- [ ] **Step 4: Pass art registry through render layer options**

In `game.js`, add `artAssets: crayonArtAssets(),` to each returned options object in:

```js
backgroundLayerOptions()
winchLayerOptions()
itemShapeLayerOptions()
hookShapeLayerOptions()
minerLayerOptions()
```

The `itemLayerOptions()` object stays unchanged because it calls `drawItem(item, metadata)`, and `drawItem()` creates the shape options.

- [ ] **Step 5: Run focused tests**

Run:

```bash
node --check game.js
node --test tests/unit/source-invariants.test.mjs tests/unit/runtime-bridge.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

Run:

```bash
git add game.js tests/unit/source-invariants.test.mjs
git commit -m "Preload crayon art in browser host"
```

## Task 4: Background And Beam Art Integration

**Files:**
- Modify: `src/render/backgroundRenderer.js`
- Modify: `tests/unit/background-renderer.test.mjs`

- [ ] **Step 1: Add renderer tests for crayon background assets**

In `tests/unit/background-renderer.test.mjs`, extend `createFakeCtx()` with:

```js
    drawImage(...args) {
      calls.push(["drawImage", ...args]);
    },
```

Add this helper after `backgroundOptions`:

```js
function createLoadedAsset(label) {
  return { status: "loaded", image: { label, naturalWidth: 1200, naturalHeight: 675 } };
}

function createRegistry(entries) {
  return {
    get(key) {
      return entries[key] ?? null;
    },
  };
}
```

Add this test:

```js
test("drawBackgroundLayer prefers crayon background and paper texture when loaded", () => {
  const ctx = createFakeCtx();
  const artAssets = createRegistry({
    "background.mine": createLoadedAsset("mine"),
    "texture.paper": createLoadedAsset("paper"),
  });

  drawBackgroundLayer(backgroundOptions({ ctx, image: null, artAssets }));

  const imageCalls = ctx.calls.filter((call) => call[0] === "drawImage");
  assert.equal(imageCalls.length, 2);
  assert.equal(imageCalls[0][1].label, "mine");
  assert.equal(imageCalls[1][1].label, "paper");
  assert.equal(ctx.calls.some((call) => call[0] === "createLinearGradient"), false);
});
```

Add this test:

```js
test("drawPlankLayer draws crayon wood beam asset when loaded", () => {
  const ctx = createFakeCtx();
  const artAssets = createRegistry({
    "texture.woodBeam": createLoadedAsset("wood"),
  });

  drawPlankLayer({
    ctx,
    viewport: { w: 400, h: 300 },
    plankY: 108,
    plankHeight: 22,
    colors: COLORS,
    artAssets,
  });

  assert.ok(ctx.calls.some((call) => call[0] === "drawImage" && call[1].label === "wood"));
});
```

- [ ] **Step 2: Run focused test and confirm it fails**

Run:

```bash
node --test tests/unit/background-renderer.test.mjs
```

Expected: FAIL because `artAssets` is not used.

- [ ] **Step 3: Implement crayon background drawing**

In `src/render/backgroundRenderer.js`, add this helper near `drawImageCover`:

```js
function loadedArtImage(artAssets, key) {
  const asset = artAssets?.get?.(key);
  return asset?.status === "loaded" ? asset.image : null;
}
```

In `drawBackgroundLayer`, before the existing `if (!drawImageCover(...))` block, add:

```js
  const crayonBackground = loadedArtImage(options.artAssets, "background.mine");
  const paperTexture = loadedArtImage(options.artAssets, "texture.paper");
  if (crayonBackground && drawImageCover(ctx, crayonBackground, 0, 0, viewport.w, viewport.h)) {
    if (paperTexture) {
      ctx.save();
      try {
        ctx.globalAlpha = 0.28;
        drawImageCover(ctx, paperTexture, 0, 0, viewport.w, viewport.h);
      } finally {
        ctx.restore();
      }
    }
  } else if (!drawImageCover(ctx, image, 0, 0, viewport.w, viewport.h)) {
    drawFallbackBackground(ctx, viewport, colors);
  }
```

Then remove the original two-line background block:

```js
  if (!drawImageCover(ctx, image, 0, 0, viewport.w, viewport.h)) {
    drawFallbackBackground(ctx, viewport, colors);
  }
```

In `drawPlankLayer`, before creating the gradient beam, add:

```js
    const woodBeam = loadedArtImage(options.artAssets, "texture.woodBeam");
    if (woodBeam) {
      ctx.drawImage(woodBeam, 0, plankY, viewport.w, plankHeight);
      return true;
    }
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
node --test tests/unit/background-renderer.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

Run:

```bash
git add src/render/backgroundRenderer.js tests/unit/background-renderer.test.mjs
git commit -m "Render crayon background assets"
```

## Task 5: Item Sprite Integration

**Files:**
- Modify: `src/render/itemRenderer.js`
- Modify: `tests/unit/item-renderer.test.mjs`

- [ ] **Step 1: Add item sprite tests**

In `tests/unit/item-renderer.test.mjs`, add `drawImage` to `createFakeCtx()`:

```js
    drawImage(...args) {
      calls.push(["drawImage", ...args]);
    },
```

Add this helper:

```js
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
```

Add this test:

```js
test("drawItemShape draws loaded crayon item sprites in the existing radius box", () => {
  const item = {
    id: 101,
    type: "gold",
    x: 90,
    y: 110,
    r: 22,
    grabbed: false,
    art: { rot: 0 },
  };

  const { ctx, result } = draw(item, {
    artAssets: registryWith({ "sprite.gold": loadedAsset("gold") }),
  });

  assert.equal(result, true);
  const drawCall = ctx.calls.find((call) => call[0] === "drawImage");
  assert.equal(drawCall[1].label, "gold");
  assert.equal(drawCall[2], -26.4);
  assert.equal(drawCall[3], -26.4);
  assert.equal(drawCall[4], 52.8);
  assert.equal(drawCall[5], 52.8);
});
```

Update the `draw()` helper signature to pass `artAssets` into `drawItemShape`:

```js
    artAssets: options.artAssets ?? null,
```

- [ ] **Step 2: Run focused test and confirm it fails**

Run:

```bash
node --test tests/unit/item-renderer.test.mjs
```

Expected: FAIL because `drawImage` is never called for crayon item assets.

- [ ] **Step 3: Implement item sprite drawing**

In `src/render/itemRenderer.js`, add imports:

```js
import { drawCrayonImageAsset, getCrayonItemAssetKey } from "./crayonArtAssets.js";
```

Add `artAssets` to `validateOptions` destructuring and do not require it:

```js
function validateOptions({ ctx, item, now, createRng }) {
```

Add this helper before `drawItemShape`:

```js
function drawCrayonItemSprite(ctx, item, artAssets) {
  const key = getCrayonItemAssetKey(item);
  if (!key) return false;
  const asset = artAssets?.get?.(key);
  const scale = item.type === "bar" ? 1.45 : item.type === "mouse" ? 1.9 : 1.2;
  const size = item.r * 2 * scale;
  return drawCrayonImageAsset(ctx, asset, -size / 2, -size / 2, size, size);
}
```

In `drawItemShape`, change the options destructuring to include `artAssets`:

```js
export function drawItemShape({ ctx, item, metadata, now, createRng, artAssets = null } = {}) {
```

After `ctx.rotate(baseRot + wobble);`, add:

```js
    if (drawCrayonItemSprite(ctx, item, artAssets)) return true;
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
node --test tests/unit/item-renderer.test.mjs tests/unit/crayon-art-assets.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit Task 5**

Run:

```bash
git add src/render/itemRenderer.js tests/unit/item-renderer.test.mjs
git commit -m "Render crayon item sprites"
```

## Task 6: Miner, Winch, And Hook Crayon Surfaces

**Files:**
- Modify: `src/render/minerRenderer.js`
- Modify: `src/render/winchRenderer.js`
- Modify: `src/render/hookRenderer.js`
- Modify: `tests/unit/miner-renderer.test.mjs`
- Modify: `tests/unit/winch-renderer.test.mjs`
- Modify: `tests/unit/hook-renderer.test.mjs`

- [ ] **Step 1: Add fake ctx `drawImage` support to renderer tests**

In each of `tests/unit/miner-renderer.test.mjs`, `tests/unit/winch-renderer.test.mjs`, and `tests/unit/hook-renderer.test.mjs`, add this method to the fake canvas context:

```js
    drawImage(...args) {
      calls.push(["drawImage", ...args]);
    },
```

Add this helper to each test file:

```js
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
```

- [ ] **Step 2: Add focused render assertions**

In `tests/unit/miner-renderer.test.mjs`, add:

```js
test("miner layers draw crayon body and head assets when loaded", () => {
  const ctx = createFakeCtx();
  const pose = createMinerPose(poseOptions());
  const artAssets = registryWith({
    "sprite.minerBody": loadedAsset("body"),
    "sprite.minerHead": loadedAsset("head"),
  });

  drawMinerBackLayer({ ctx, pose, artAssets });

  assert.ok(ctx.calls.some((call) => call[0] === "drawImage" && call[1].label === "body"));
  assert.ok(ctx.calls.some((call) => call[0] === "drawImage" && call[1].label === "head"));
});
```

In `tests/unit/winch-renderer.test.mjs`, add:

```js
test("drawWinchLayer draws crayon plate and reel assets when loaded", () => {
  const ctx = createFakeCtx();
  const hook = { reelAngle: 0.4, spoolSpeed: 0 };
  const artAssets = registryWith({
    "sprite.winchPlate": loadedAsset("plate"),
    "sprite.winchReel": loadedAsset("reel"),
  });

  drawWinchLayer({
    ctx,
    pivot: { x: 200, y: 106 },
    reel: { x: 200, y: 92 },
    plankY: 108,
    hook,
    artAssets,
  });

  assert.ok(ctx.calls.some((call) => call[0] === "drawImage" && call[1].label === "plate"));
  assert.ok(ctx.calls.some((call) => call[0] === "drawImage" && call[1].label === "reel"));
});
```

In `tests/unit/hook-renderer.test.mjs`, add:

```js
test("drawHookLayer overlays crayon hook claw asset when loaded", () => {
  const ctx = createFakeCtx();
  const artAssets = registryWith({
    "sprite.hookClaw": loadedAsset("claw"),
  });

  drawHookLayer({
    ctx,
    hook: { length: 100, maxLength: 300, state: "swing", angle: 0.2, reelAngle: 0, clawClose: 0 },
    pivot: { x: 200, y: 106 },
    tip: { x: 220, y: 180 },
    dir: { x: 0.2, y: 0.98 },
    carriedItem: null,
    canBomb: false,
    hookConfig: { ringToTip: 44, jawBase: 16 },
    now: 0,
    itemGlowColor: null,
    artAssets,
  });

  assert.ok(ctx.calls.some((call) => call[0] === "drawImage" && call[1].label === "claw"));
});
```

- [ ] **Step 3: Run focused tests and confirm failures**

Run:

```bash
node --test tests/unit/miner-renderer.test.mjs tests/unit/winch-renderer.test.mjs tests/unit/hook-renderer.test.mjs
```

Expected: FAIL because these renderers do not draw crayon assets yet.

- [ ] **Step 4: Add crayon asset helpers to the three renderers**

In each of `src/render/minerRenderer.js`, `src/render/winchRenderer.js`, and `src/render/hookRenderer.js`, add:

```js
import { drawCrayonImageAsset } from "./crayonArtAssets.js";
```

In `minerRenderer.js`, change the back layer signature to keep the full options object available:

```js
export function drawMinerBackLayer(options = {}) {
  const { ctx, pose } = options;
```

Inside `drawMinerBackLayer`, after the shadow and before procedural backpack/torso details, add:

```js
    const bodyAsset = options.artAssets?.get?.("sprite.minerBody");
    drawCrayonImageAsset(ctx, bodyAsset, x - 36, y - 18, 72, 104);
    const headAsset = options.artAssets?.get?.("sprite.minerHead");
    drawCrayonImageAsset(ctx, headAsset, x - 27, y - 31, 54, 54);
```

In `winchRenderer.js`, change the reel and winch layer signatures to keep the full options object available:

```js
export function drawReelLayer(options = {}) {
  const { ctx, pivot, centerY, hook, artAssets = null } = options;
```

```js
export function drawWinchLayer(options = {}) {
  const { ctx, pivot, reel, plankY, hook, artAssets = null } = options;
```

Inside `drawWinchLayer`, before drawing the procedural plate, add:

```js
    drawCrayonImageAsset(ctx, artAssets?.get?.("sprite.winchPlate"), reel.x - 42, plankY - 29, 84, 34);
```

In `drawReelLayer`, after `ctx.translate(pivot.x, centerY);`, add:

```js
    drawCrayonImageAsset(ctx, artAssets?.get?.("sprite.winchReel"), -20, -20, 40, 40);
```

In `drawWinchLayer`, update the delegated reel call to pass `artAssets`:

```js
    drawReelLayer({ ctx, pivot, centerY: reel.y, hook, artAssets });
```

In `hookRenderer.js`, after `ctx.rotate(theta - Math.PI / 2);`, add:

```js
    drawCrayonImageAsset(ctx, artAssets?.get?.("sprite.hookClaw"), -24, -6, 48, 58);
```

Change the hook layer signature to include `artAssets`:

```js
export function drawHookLayer({
  ctx,
  hook,
  pivot,
  tip,
  dir,
  carriedItem = null,
  canBomb = false,
  hookConfig,
  now,
  itemGlowColor = null,
  artAssets = null,
} = {}) {
```

Keep the procedural geometry after these calls so open/close motion, highlights, fuse state, and rope state remain visible and testable.

- [ ] **Step 5: Run focused tests**

Run:

```bash
node --test tests/unit/miner-renderer.test.mjs tests/unit/winch-renderer.test.mjs tests/unit/hook-renderer.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit Task 6**

Run:

```bash
git add src/render/minerRenderer.js src/render/winchRenderer.js src/render/hookRenderer.js tests/unit/miner-renderer.test.mjs tests/unit/winch-renderer.test.mjs tests/unit/hook-renderer.test.mjs
git commit -m "Add crayon surfaces to miner and tools"
```

## Task 7: Effects And Carry Label Crayon Styling

**Files:**
- Modify: `src/render/fxRenderer.js`
- Modify: `src/render/carryLabelRenderer.js`
- Modify: `tests/unit/fx-renderer.test.mjs`
- Modify: `tests/unit/carry-label-renderer.test.mjs`

- [ ] **Step 1: Add effect sprite tests**

In `tests/unit/fx-renderer.test.mjs`, add `drawImage` to the fake ctx and add a loaded asset helper:

```js
    drawImage(...args) {
      calls.push(["drawImage", ...args]);
    },
```

```js
function loadedAsset(label) {
  return { status: "loaded", image: { label, naturalWidth: 64, naturalHeight: 64 } };
}
```

Add:

```js
test("drawFxLayer draws crayon spark sprites for particles when loaded", () => {
  const ctx = createFakeCtx();

  drawFxLayer({
    ctx,
    fx: {
      rings: [],
      particles: [{ x: 10, y: 20, age: 0, life: 1, size: 5, color: "#ffd34d" }],
      pops: [],
    },
    artAssets: { get: () => loadedAsset("spark") },
  });

  assert.ok(ctx.calls.some((call) => call[0] === "drawImage" && call[1].label === "spark"));
});
```

In `tests/unit/carry-label-renderer.test.mjs`, add an assertion to the existing text label test:

```js
  assert.ok(ctx.calls.some((call) => call[0] === "strokeStyle" && String(call[1]).includes("rgba(70, 45, 25")));
```

- [ ] **Step 2: Run focused tests and confirm failures**

Run:

```bash
node --test tests/unit/fx-renderer.test.mjs tests/unit/carry-label-renderer.test.mjs
```

Expected: FAIL because effect particles do not draw the crayon spark asset and carry labels do not use the new charcoal stroke color.

- [ ] **Step 3: Update effects**

In `src/render/fxRenderer.js`, import:

```js
import { drawCrayonImageAsset } from "./crayonArtAssets.js";
```

In the particle loop, before drawing the current arc, add:

```js
      const sparkAsset = options.artAssets?.get?.("sprite.spark");
      if (drawCrayonImageAsset(ctx, sparkAsset, particle.x - particle.size, particle.y - particle.size, particle.size * 2, particle.size * 2)) {
        particles += 1;
        return;
      }
```

Change the function signature to:

```js
export function drawFxLayer(options = {}) {
  const { ctx, fx } = options;
```

- [ ] **Step 4: Update carry label colors**

In `src/render/carryLabelRenderer.js`, change the opaque label background block to:

```js
    ctx.globalAlpha = 0.94;
    ctx.fillStyle = "rgba(244, 226, 185, 0.94)";
    roundRectPath(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(70, 45, 25, 0.72)";
    ctx.lineWidth = 1.4;
    ctx.stroke();
```

Change label text color to:

```js
    ctx.fillStyle = "rgba(45, 31, 20, 0.94)";
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
node --test tests/unit/fx-renderer.test.mjs tests/unit/carry-label-renderer.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit Task 7**

Run:

```bash
git add src/render/fxRenderer.js src/render/carryLabelRenderer.js tests/unit/fx-renderer.test.mjs tests/unit/carry-label-renderer.test.mjs
git commit -m "Restyle effects for crayon art"
```

## Task 8: UI Paper And Crayon Skin

**Files:**
- Modify: `styles.css`
- Modify: `tests/unit/source-invariants.test.mjs`

- [ ] **Step 1: Add source invariant for crayon UI assets**

Append this test to `tests/unit/source-invariants.test.mjs`:

```js
test("styles use crayon art textures and keep existing UI selectors", () => {
  const css = read("styles.css");

  assert.match(css, /--paper:/);
  assert.match(css, /url\("\.\/assets\/art\/crayon\/textures\/ui-paper\.png"\)/);
  assert.match(css, /url\("\.\/assets\/art\/crayon\/textures\/paper-grain\.png"\)/);
  assert.match(css, /\.chip\.bomb \.chipIcon/);
  assert.match(css, /url\("\.\/assets\/art\/crayon\/icons\/bomb\.png"\)/);
  assert.match(css, /\.overlay/);
  assert.match(css, /\.shopItem/);
  assert.match(css, /border-radius: 8px;/);
});
```

- [ ] **Step 2: Run invariant test and confirm it fails**

Run:

```bash
node --test tests/unit/source-invariants.test.mjs
```

Expected: FAIL because `styles.css` does not reference crayon assets yet.

- [ ] **Step 3: Replace the root visual variables**

In `styles.css`, replace the `:root` block with:

```css
:root {
  color-scheme: light;
  --paper: #efe2c5;
  --paper-deep: #d4b982;
  --ink: #2c2118;
  --ink-soft: rgba(44, 33, 24, 0.72);
  --charcoal: rgba(39, 28, 21, 0.78);
  --panel: rgba(244, 226, 185, 0.9);
  --panel-border: rgba(74, 49, 31, 0.45);
  --text: #2c2118;
  --muted: rgba(44, 33, 24, 0.66);
  --primary: #d8a63b;
  --primary-ink: #271a0d;
  --danger: #b65343;
  --shadow: rgba(70, 45, 25, 0.24);
}
```

- [ ] **Step 4: Replace body, topbar, panels, and controls styling**

Update the major UI selectors with these values:

```css
body {
  margin: 0;
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans",
    "Helvetica Neue", Arial, "Apple Color Emoji", "Segoe UI Emoji";
  background:
    linear-gradient(rgba(239, 226, 197, 0.74), rgba(239, 226, 197, 0.74)),
    url("./assets/art/crayon/textures/paper-grain.png") center / 520px 520px repeat,
    radial-gradient(1100px 720px at 50% -12%, #f4d992, #8a5940 52%, #2b1c17 100%);
  color: var(--text);
}

.topbar {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 2px solid rgba(74, 49, 31, 0.4);
  background:
    linear-gradient(rgba(244, 226, 185, 0.88), rgba(222, 190, 132, 0.9)),
    url("./assets/art/crayon/textures/ui-paper.png") center / 420px 420px repeat;
  position: sticky;
  top: 0;
  z-index: 10;
  flex-wrap: wrap;
  box-shadow: 0 8px 24px rgba(70, 45, 25, 0.16);
}

.stat,
.chip,
.panel,
.shopItem,
.shopIcon {
  border-radius: 8px;
  border: 2px solid var(--panel-border);
  background:
    linear-gradient(rgba(244, 226, 185, 0.86), rgba(218, 186, 128, 0.82)),
    url("./assets/art/crayon/textures/ui-paper.png") center / 360px 360px repeat;
  box-shadow: 0 8px 18px var(--shadow);
}

.btn {
  appearance: none;
  border: 2px solid rgba(74, 49, 31, 0.52);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(236, 207, 134, 0.96), rgba(184, 124, 58, 0.92)),
    url("./assets/art/crayon/textures/ui-paper.png") center / 280px 280px repeat;
  color: var(--primary-ink);
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 120ms ease, filter 120ms ease, opacity 120ms ease;
  box-shadow: 0 8px 16px var(--shadow);
}

.btn:hover {
  transform: translateY(-1px);
  filter: saturate(1.08) brightness(1.03);
}

.btn.primary {
  background:
    linear-gradient(180deg, rgba(236, 195, 80, 0.98), rgba(202, 137, 48, 0.96)),
    url("./assets/art/crayon/textures/ui-paper.png") center / 280px 280px repeat;
}

.btn.warning {
  background:
    linear-gradient(180deg, rgba(196, 93, 72, 0.98), rgba(139, 58, 48, 0.96)),
    url("./assets/art/crayon/textures/ui-paper.png") center / 280px 280px repeat;
  color: #2d1510;
}

.canvasWrap {
  width: min(1100px, 100%);
  height: min(660px, 100%);
  border-radius: 8px;
  border: 3px solid rgba(58, 38, 26, 0.72);
  overflow: hidden;
  position: relative;
  box-shadow: 0 20px 48px rgba(43, 28, 23, 0.38);
  background: #2b1c17;
}

.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(48, 31, 24, 0.48);
}
```

- [ ] **Step 5: Swap chip icons to image-backed crayon icons**

Add this CSS after `.chipIcon`:

```css
.chipIcon {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  background-position: center;
  background-repeat: no-repeat;
  background-size: contain;
}

.chipIcon use,
.shopIcon svg use {
  display: none;
}

.chip.bomb .chipIcon,
.shopIcon.bomb svg {
  background-image: url("./assets/art/crayon/icons/bomb.png");
}

.chip.speed .chipIcon,
.shopIcon.speed svg {
  background-image: url("./assets/art/crayon/icons/speed.png");
}

.chip.lucky .chipIcon,
.shopIcon.lucky svg {
  background-image: url("./assets/art/crayon/icons/lucky-bag.png");
}
```

- [ ] **Step 6: Run syntax and invariant checks**

Run:

```bash
npm run check:syntax
node --test tests/unit/source-invariants.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit Task 8**

Run:

```bash
git add styles.css tests/unit/source-invariants.test.mjs
git commit -m "Restyle UI with crayon paper skin"
```

## Task 9: Full Verification And Visual Smoke

**Files:**
- Modify: `progress.md`
- Create: `output/gold-miner-crayon-final.png`

- [ ] **Step 1: Run full unit verification**

Run:

```bash
npm run verify
```

Expected: PASS with all unit tests passing.

- [ ] **Step 2: Start the local static server**

Run:

```bash
python3 -m http.server 5173 --bind 127.0.0.1
```

Expected: server listens at `http://127.0.0.1:5173/`. If port 5173 is occupied, use port 5174 and update the smoke URL.

- [ ] **Step 3: Run the web game smoke client**

Set the skill paths and run:

```bash
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export WEB_GAME_CLIENT="$CODEX_HOME/skills/develop-web-game/scripts/web_game_playwright_client.js"
node "$WEB_GAME_CLIENT" --url "http://127.0.0.1:5173/?seed=12345" --actions-json '{"steps":[{"buttons":["left_mouse_button"],"frames":2,"mouse_x":550,"mouse_y":210},{"buttons":[],"frames":18},{"buttons":["space"],"frames":3},{"buttons":[],"frames":24},{"buttons":["p"],"frames":2},{"buttons":[],"frames":8},{"buttons":["p"],"frames":2},{"buttons":[],"frames":8}]}' --iterations 1 --pause-ms 250
```

Expected:
- `window.__goldMinerModulesReady === true`
- `window.__goldMinerCrayonArtStatus.loaded > 0`
- mode can enter gameplay
- hook leaves swing state after input
- pause and resume work
- console error count is 0

- [x] **Step 4: Inspect gameplay screenshot**

Capture the gameplay viewport to:

```text
output/gold-miner-crayon-final.png
```

Use the Browser or Playwright screenshot tool after the smoke client has entered gameplay. Open the captured image and confirm:
- background uses crayon cave art
- miner, winch, hook, and at least one item show the crayon style
- UI has paper surfaces and charcoal outlines
- no old glass panel styling is dominant
- text remains readable

- [x] **Step 5: Verify shop and two-player state through debug hooks**

In the browser console or Playwright evaluation, run:

```js
JSON.parse(window.render_game_to_text())
window.__goldMinerSmoke.enterShop({ score: 500 })
```

Expected after shop setup:
- `phase` is `shop`
- `score` is `500`
- overlay/shop panel is visible and uses crayon paper UI styling

Then start a new double-player game through the overlay and press Space/Enter once each. Expected:
- debug text reports two hooks
- both hooks can leave swing state
- no console error or warning is introduced by the crayon art registry

- [x] **Step 6: Update progress log**

Append this entry to `progress.md`:

```markdown
- Visual refactor: added warm realistic storybook crayon art pack under `assets/art/crayon/`, wired optional crayon asset registry into canvas renderers, restyled UI with paper/crayon surfaces, and preserved gameplay/collision/state behavior. Verification: `npm run verify` passed; browser smoke at `http://127.0.0.1:5173/?seed=12345` passed with crayon assets loaded, gameplay input working, shop visible, two-player hooks working, and final screenshot at `output/gold-miner-crayon-final.png`.
```

- [x] **Step 7: Commit Task 9**

Run:

```bash
git add progress.md output/gold-miner-crayon-final.png
git commit -m "Verify crayon art refactor"
```

## Self-Review

Spec coverage:
- Visual-only scope is covered by Tasks 1, 3, 4, 5, 6, 7, and 8 preserving gameplay data and DOM ids.
- Image generation and project-local storage are covered by Task 2.
- Canvas elements are covered by Tasks 4 through 7.
- UI elements and icons are covered by Task 8.
- Fallback behavior is covered by Tasks 1, 4, and 5.
- Verification and browser smoke are covered by Task 9.

Consistency check:
- Asset keys in `crayonArtAssets.js` match all renderer integration steps.
- Runtime bridge keys in Task 1 match host usage in Task 3.
- Asset paths in CSS match Task 2 output paths.
- Test commands use the repository's Node built-in test runner and existing `npm run verify` script.
