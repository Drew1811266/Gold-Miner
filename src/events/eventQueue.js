import { assertGameEvent, gameEvent } from "./eventTypes.js";

const QUEUE_EVENTS = new WeakMap();

function assertQueue(queue) {
  if (queue === null || typeof queue !== "object" || !QUEUE_EVENTS.has(queue)) {
    throw new TypeError("Expected a game event queue object");
  }
  return QUEUE_EVENTS.get(queue);
}

function normalizeEvent(event) {
  const valid = assertGameEvent(event);
  return gameEvent(valid.type, valid.payload);
}

export function createEventQueue(initialEvents = []) {
  if (!Array.isArray(initialEvents)) {
    throw new TypeError("initialEvents must be an array");
  }
  const queue = Object.freeze({});
  QUEUE_EVENTS.set(queue, initialEvents.map((event) => normalizeEvent(event)));
  return queue;
}

export function enqueueEvent(queue, eventOrType, payload = {}) {
  const events = assertQueue(queue);
  const event =
    typeof eventOrType === "string"
      ? gameEvent(eventOrType, payload)
      : normalizeEvent(eventOrType);
  events.push(event);
  return event;
}

export function peekEvents(queue) {
  return assertQueue(queue).slice();
}

export function drainEvents(queue) {
  const events = assertQueue(queue);
  const drained = events.slice();
  events.length = 0;
  return drained;
}

export function clearEvents(queue) {
  assertQueue(queue).length = 0;
}

export function hasPendingEvents(queue) {
  return assertQueue(queue).length > 0;
}
