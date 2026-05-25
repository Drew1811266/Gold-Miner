import { test } from "node:test";
import assert from "node:assert/strict";
import { createRandomStream } from "../../src/core/randomStreams.js";

const sequence = (stream, count = 5) => Array.from({ length: count }, () => stream.next());

test("random streams are deterministic for the same run, level, name, and salt", () => {
  const first = createRandomStream({
    runSeed: 12345,
    levelSeed: 67890,
    name: "kegImmediate",
    salt: 111,
  });
  const second = createRandomStream({
    runSeed: 12345,
    levelSeed: 67890,
    name: "kegImmediate",
    salt: 111,
  });

  assert.deepEqual(sequence(first), sequence(second));
});

test("random streams change when name, salt, or level seed changes", () => {
  const baseOptions = {
    runSeed: 12345,
    levelSeed: 67890,
    name: "kegImmediate",
    salt: 111,
  };
  const baseSequence = sequence(createRandomStream(baseOptions));

  assert.notDeepEqual(
    baseSequence,
    sequence(createRandomStream({ ...baseOptions, name: "mouseCargo" })),
  );
  assert.notDeepEqual(
    baseSequence,
    sequence(createRandomStream({ ...baseOptions, salt: 222 })),
  );
  assert.notDeepEqual(
    baseSequence,
    sequence(createRandomStream({ ...baseOptions, levelSeed: 67891 })),
  );
});

test("random streams expose range and pick helpers", () => {
  const ranged = createRandomStream({ runSeed: 7, levelSeed: 11, name: "range", salt: 13 });

  for (let index = 0; index < 20; index += 1) {
    const value = ranged.range(10, 20);
    assert.ok(value >= 10);
    assert.ok(value <= 20);
  }

  const picked = createRandomStream({ runSeed: 7, levelSeed: 11, name: "pick", salt: 13 });
  const options = ["gold", "rock", "keg"];
  for (let index = 0; index < 20; index += 1) {
    assert.ok(options.includes(picked.pick(options)));
  }
});

test("random streams validate creation inputs", () => {
  assert.throws(() => createRandomStream(), /options/);
  assert.throws(() => createRandomStream(null), /options/);
  assert.throws(() => createRandomStream({ runSeed: 1.5, name: "stream" }), /runSeed/);
  assert.throws(() => createRandomStream({ runSeed: Number.POSITIVE_INFINITY, name: "stream" }), /runSeed/);
  assert.throws(() => createRandomStream({ runSeed: 1, levelSeed: 2.5, name: "stream" }), /levelSeed/);
  assert.throws(() => createRandomStream({ runSeed: 1, name: "stream", salt: 3.5 }), /salt/);
  assert.throws(() => createRandomStream({ runSeed: 1, name: "" }), /name/);
  assert.throws(() => createRandomStream({ runSeed: 1, name: "   " }), /name/);
  assert.throws(() => createRandomStream({ runSeed: 1, name: 42 }), /name/);
});

test("random streams validate range and pick helper inputs", () => {
  const stream = createRandomStream({ runSeed: 1, name: "helpers" });

  assert.throws(() => stream.range(Number.NaN, 1), /min/);
  assert.throws(() => stream.range(0, Number.NEGATIVE_INFINITY), /max/);
  assert.throws(() => stream.pick([]), /pick list/);
  assert.throws(() => stream.pick("gold"), /pick list/);
});
