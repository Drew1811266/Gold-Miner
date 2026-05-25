function assertArray(value, name) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${name} must be an array`);
  }
}

function assertFunction(value, name) {
  if (typeof value !== "function") {
    throw new TypeError(`${name} must be a function`);
  }
}

function hasAttachedId(hook) {
  return Number.isInteger(hook?.attachedId) && hook.attachedId > 0;
}

function createItemById(items) {
  const itemById = new Map();

  for (const item of items) {
    if (!itemById.has(item.id)) {
      itemById.set(item.id, item);
    }
  }

  return itemById;
}

export function createItemRenderOrder({ items, hooks } = {}) {
  assertArray(items, "items");
  assertArray(hooks, "hooks");

  const attachedIds = new Set();
  for (const hook of hooks) {
    if (hasAttachedId(hook)) {
      attachedIds.add(hook.attachedId);
    }
  }

  const order = items
    .filter((item) => !attachedIds.has(item.id))
    .slice()
    .sort((a, b) => a.y - b.y)
    .map((item) => ({
      item,
      attached: false,
      hookIndex: null,
    }));

  const itemById = createItemById(items);
  const drawnAttachedIds = new Set();

  hooks.forEach((hook, hookIndex) => {
    if (!hasAttachedId(hook) || drawnAttachedIds.has(hook.attachedId)) {
      return;
    }

    const item = itemById.get(hook.attachedId);
    if (!item) {
      return;
    }

    drawnAttachedIds.add(hook.attachedId);
    order.push({
      item,
      attached: true,
      hookIndex,
    });
  });

  return order;
}

export function drawItemsLayer({ items, hooks, drawItem } = {}) {
  assertFunction(drawItem, "drawItem");

  const order = createItemRenderOrder({ items, hooks });
  for (const entry of order) {
    drawItem(entry.item, entry);
  }

  return order;
}
