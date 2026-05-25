const INVENTORY_KEY_BY_ITEM_ID = Object.freeze({
  bomb: "bombs",
  speed: "speed",
  lucky: "lucky",
});

export function createEmptyInventory() {
  return { bombs: 0, speed: 0, lucky: 0 };
}

export function getInventoryCount(inventory, itemId) {
  const key = INVENTORY_KEY_BY_ITEM_ID[itemId];
  if (!key) return 0;
  const raw = inventory?.[key] ?? 0;
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, Math.floor(raw));
}

export function canBuyShopItem(score, item) {
  return Number.isFinite(score) && Number.isFinite(item?.cost) && item.cost >= 0 && score >= item.cost;
}

function inventoryKeyForItem(itemId) {
  const key = INVENTORY_KEY_BY_ITEM_ID[itemId];
  if (!key) throw new RangeError(`Unsupported inventory item: ${String(itemId)}`);
  return key;
}

export function buyShopItem({ score, inventory, item }) {
  const key = inventoryKeyForItem(item?.id);
  if (!canBuyShopItem(score, item)) {
    return { bought: false, score, inventory };
  }

  return {
    bought: true,
    score: score - item.cost,
    inventory: {
      ...inventory,
      [key]: getInventoryCount(inventory, item.id) + 1,
    },
  };
}

export function consumeInventoryItem(inventory, itemId) {
  const key = inventoryKeyForItem(itemId);
  const current = getInventoryCount(inventory, itemId);
  if (current <= 0) {
    return { consumed: false, inventory };
  }

  return {
    consumed: true,
    inventory: {
      ...inventory,
      [key]: current - 1,
    },
  };
}
