import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findFallingKegCollision,
  selectKegBlastAffectedIds,
} from "../../src/systems/kegSystem.js";

test("findFallingKegCollision returns the first colliding other item and ignores self index", () => {
  const kegItem = { id: "keg", x: 0, y: 0, r: 10 };
  const exactThreshold = { id: "exact", x: 25, y: 0, r: 15 };
  const laterCollision = { id: "later", x: 1, y: 1, r: 10 };
  const items = [kegItem, exactThreshold, laterCollision];

  const collision = findFallingKegCollision({ items, kegItem, kegIndex: 0 });

  assert.deepEqual(collision, { item: exactThreshold, id: "exact", index: 1 });
});

test("findFallingKegCollision includes exact threshold contact when self is elsewhere in the array", () => {
  const decoy = { id: "decoy", x: 999, y: 0, r: 1 };
  const kegItem = { id: "keg", x: 0, y: 0, r: 10 };
  const exactThreshold = { id: "exact", x: 0, y: 25, r: 15 };
  const items = [decoy, kegItem, exactThreshold];

  const collision = findFallingKegCollision({ items, kegItem, kegIndex: 1 });

  assert.equal(collision.item, exactThreshold);
  assert.equal(collision.id, "exact");
  assert.equal(collision.index, 2);
});

test("findFallingKegCollision returns null when no other item is within collision range", () => {
  const kegItem = { id: "keg", x: 0, y: 0, r: 10 };
  const items = [kegItem, { id: "miss", x: 31, y: 0, r: 20 }];

  assert.equal(findFallingKegCollision({ items, kegItem, kegIndex: 0 }), null);
});

test("selectKegBlastAffectedIds uses radius plus item edge allowance and includes exact threshold", () => {
  const items = [
    { id: "center", x: 0, y: 0, r: 10 },
    { id: "edge", x: 101.5, y: 0, r: 10 },
    { id: "miss", x: 102, y: 0, r: 10 },
  ];

  const affected = selectKegBlastAffectedIds({ items, x: 0, y: 0, radius: 100 });

  assert.deepEqual(affected, ["center", "edge"]);
});

test("selectKegBlastAffectedIds does not mutate items", () => {
  const items = [
    { id: "hit", x: 3, y: 4, r: 5 },
    { id: "miss", x: 300, y: 300, r: 7 },
  ];
  const before = structuredClone(items);

  selectKegBlastAffectedIds({ items, x: 0, y: 0, radius: 10 });

  assert.deepEqual(items, before);
});

test("keg system validates required inputs", () => {
  const items = [{ id: "keg", x: 0, y: 0, r: 10 }];

  assert.throws(() => findFallingKegCollision({ items: null, kegItem: items[0], kegIndex: 0 }), /items must be an array/);
  assert.throws(() => findFallingKegCollision({ items, kegItem: null, kegIndex: 0 }), /kegItem must be an object/);
  assert.throws(() => findFallingKegCollision({ items, kegItem: items[0], kegIndex: Number.NaN }), /kegIndex must be a finite number/);
  assert.throws(() => selectKegBlastAffectedIds({ items, x: Number.NaN, y: 0, radius: 10 }), /x must be a finite number/);
  assert.throws(() => selectKegBlastAffectedIds({ items, x: 0, y: 0, radius: Number.NaN }), /radius must be a finite number/);
});
