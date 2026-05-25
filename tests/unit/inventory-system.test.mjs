import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buyShopItem,
  canBuyShopItem,
  consumeInventoryItem,
  createEmptyInventory,
  getInventoryCount,
} from "../../src/systems/inventorySystem.js";

const bombItem = { id: "bomb", cost: 150 };
const speedItem = { id: "speed", cost: 220 };
const luckyItem = { id: "lucky", cost: 260 };

test("inventory helpers create and read runtime inventory shape", () => {
  const inventory = createEmptyInventory();

  assert.deepEqual(inventory, { bombs: 0, speed: 0, lucky: 0 });
  assert.equal(getInventoryCount({ bombs: 2, speed: 1, lucky: 3 }, "bomb"), 2);
  assert.equal(getInventoryCount({ bombs: 2, speed: 1, lucky: 3 }, "speed"), 1);
  assert.equal(getInventoryCount({ bombs: 2, speed: 1, lucky: 3 }, "lucky"), 3);
  assert.equal(getInventoryCount({ bombs: 2, speed: 1, lucky: 3 }, "unknown"), 0);
  assert.equal(getInventoryCount({ bombs: 2.8, speed: 1, lucky: 3 }, "bomb"), 2);
  assert.equal(getInventoryCount({ bombs: -2, speed: 1, lucky: 3 }, "bomb"), 0);
  assert.equal(getInventoryCount({ bombs: Number.NaN, speed: 1, lucky: 3 }, "bomb"), 0);
  assert.equal(getInventoryCount({ bombs: "2", speed: 1, lucky: 3 }, "bomb"), 0);
});

test("buyShopItem returns updated score and inventory without mutating input", () => {
  const inventory = { bombs: 0, speed: 0, lucky: 0 };
  const result = buyShopItem({ score: 500, inventory, item: bombItem });

  assert.deepEqual(result, {
    bought: true,
    score: 350,
    inventory: { bombs: 1, speed: 0, lucky: 0 },
  });
  assert.deepEqual(inventory, { bombs: 0, speed: 0, lucky: 0 });
  assert.equal(canBuyShopItem(149, bombItem), false);
  assert.equal(canBuyShopItem(150, bombItem), true);
  assert.equal(canBuyShopItem(150, { id: "bomb", cost: -5 }), false);
  assert.equal(canBuyShopItem(150, { id: "bomb", cost: "5" }), false);
  assert.equal(canBuyShopItem(150, { id: "bomb", cost: Number.NaN }), false);
});

test("buyShopItem supports speed and lucky items and rejects unsupported ids", () => {
  assert.deepEqual(buyShopItem({ score: 500, inventory: createEmptyInventory(), item: speedItem }).inventory, {
    bombs: 0,
    speed: 1,
    lucky: 0,
  });
  assert.deepEqual(buyShopItem({ score: 500, inventory: createEmptyInventory(), item: luckyItem }).inventory, {
    bombs: 0,
    speed: 0,
    lucky: 1,
  });
  assert.throws(
    () => buyShopItem({ score: 500, inventory: createEmptyInventory(), item: { id: "bad", cost: 1 } }),
    /Unsupported inventory item/,
  );
  assert.deepEqual(buyShopItem({ score: 500, inventory: createEmptyInventory(), item: { id: "bomb", cost: -1 } }), {
    bought: false,
    score: 500,
    inventory: { bombs: 0, speed: 0, lucky: 0 },
  });
  assert.deepEqual(buyShopItem({ score: 500, inventory: createEmptyInventory(), item: { id: "bomb", cost: "1" } }), {
    bought: false,
    score: 500,
    inventory: { bombs: 0, speed: 0, lucky: 0 },
  });
  assert.deepEqual(
    buyShopItem({
      score: 500,
      inventory: { bombs: Number.NaN, speed: 0, lucky: 0 },
      item: bombItem,
    }),
    {
      bought: true,
      score: 350,
      inventory: { bombs: 1, speed: 0, lucky: 0 },
    },
  );
});

test("consumeInventoryItem decrements one item without mutating input", () => {
  const inventory = { bombs: 2, speed: 1, lucky: 0 };

  assert.deepEqual(consumeInventoryItem(inventory, "bomb"), {
    consumed: true,
    inventory: { bombs: 1, speed: 1, lucky: 0 },
  });
  assert.deepEqual(consumeInventoryItem(inventory, "lucky"), {
    consumed: false,
    inventory,
  });
  assert.deepEqual(inventory, { bombs: 2, speed: 1, lucky: 0 });
});
