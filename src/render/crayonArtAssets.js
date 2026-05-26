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
