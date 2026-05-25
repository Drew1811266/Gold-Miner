import { test } from "node:test";
import assert from "node:assert/strict";
import { createItemRenderOrder, drawItemsLayer } from "../../src/render/itemLayerRenderer.js";

test("createItemRenderOrder sorts non-attached items by ascending y", () => {
  const items = [
    { id: 1, y: 30 },
    { id: 2, y: 10 },
    { id: 3, y: 20 },
  ];

  const order = createItemRenderOrder({ items, hooks: [] });

  assert.deepEqual(
    order.map((entry) => entry.item.id),
    [2, 3, 1],
  );
  assert.deepEqual(
    order.map(({ attached, hookIndex }) => ({ attached, hookIndex })),
    [
      { attached: false, hookIndex: null },
      { attached: false, hookIndex: null },
      { attached: false, hookIndex: null },
    ],
  );
});

test("createItemRenderOrder places attached items after scene items in hook order", () => {
  const items = [
    { id: 1, y: 10 },
    { id: 2, y: 5 },
    { id: 3, y: 1 },
  ];
  const hooks = [{ attachedId: 3 }, { attachedId: 1 }];

  const order = createItemRenderOrder({ items, hooks });

  assert.deepEqual(
    order.map((entry) => entry.item.id),
    [2, 3, 1],
  );
  assert.deepEqual(
    order.map(({ attached, hookIndex }) => ({ attached, hookIndex })),
    [
      { attached: false, hookIndex: null },
      { attached: true, hookIndex: 0 },
      { attached: true, hookIndex: 1 },
    ],
  );
});

test("createItemRenderOrder draws duplicate attached ids only once", () => {
  const items = [
    { id: 1, y: 10 },
    { id: 2, y: 5 },
  ];
  const hooks = [{ attachedId: 2 }, { attachedId: 2 }, { attachedId: 1 }];

  const order = createItemRenderOrder({ items, hooks });

  assert.deepEqual(
    order.map((entry) => [entry.item.id, entry.attached, entry.hookIndex]),
    [
      [2, true, 0],
      [1, true, 2],
    ],
  );
});

test("createItemRenderOrder ignores invalid attached ids and missing item ids", () => {
  const items = [
    { id: 1, y: 30 },
    { id: 2, y: 10 },
    { id: 3, y: 20 },
  ];
  const hooks = [
    { attachedId: 0 },
    { attachedId: Number.NaN },
    { attachedId: "" },
    { attachedId: 99 },
    {},
  ];

  const order = createItemRenderOrder({ items, hooks });

  assert.deepEqual(
    order.map((entry) => [entry.item.id, entry.attached, entry.hookIndex]),
    [
      [2, false, null],
      [3, false, null],
      [1, false, null],
    ],
  );
});

test("createItemRenderOrder does not mutate items or hooks", () => {
  const items = [
    { id: 1, y: 30 },
    { id: 2, y: 10 },
    { id: 3, y: 20 },
  ];
  const hooks = [{ attachedId: 3 }, { attachedId: null }];
  const originalItems = items.map((item) => ({ ...item }));
  const originalHooks = hooks.map((hook) => ({ ...hook }));

  createItemRenderOrder({ items, hooks });

  assert.deepEqual(items, originalItems);
  assert.deepEqual(hooks, originalHooks);
});

test("createItemRenderOrder rejects invalid array inputs", () => {
  assert.throws(() => createItemRenderOrder({ items: null, hooks: [] }), /items must be an array/);
  assert.throws(() => createItemRenderOrder({ items: [], hooks: null }), /hooks must be an array/);
});

test("drawItemsLayer calls drawItem with each item and metadata in computed order", () => {
  const items = [
    { id: 1, y: 30 },
    { id: 2, y: 10 },
    { id: 3, y: 20 },
  ];
  const hooks = [{ attachedId: 3 }];
  const calls = [];

  const order = drawItemsLayer({
    items,
    hooks,
    drawItem: (item, entry) => {
      calls.push([item.id, entry.attached, entry.hookIndex, entry.item === item]);
    },
  });

  assert.deepEqual(calls, [
    [2, false, null, true],
    [1, false, null, true],
    [3, true, 0, true],
  ]);
  assert.deepEqual(
    order.map((entry) => entry.item.id),
    [2, 1, 3],
  );
});
