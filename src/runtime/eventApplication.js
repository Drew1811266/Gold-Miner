export function applyEventsWithFallback({ events, bridgeApply = null, localApply, onError = null }) {
  if (!Array.isArray(events)) {
    throw new TypeError("events must be an array");
  }
  if (typeof localApply !== "function") {
    throw new TypeError("localApply must be a function");
  }

  if (typeof bridgeApply !== "function") {
    localApply(events);
    return { usedBridge: false, disabled: false, failedIndex: null };
  }

  for (let index = 0; index < events.length; index += 1) {
    try {
      bridgeApply([events[index]]);
    } catch (error) {
      onError?.(error);
      const remainingEvents = events.slice(index + 1);
      if (remainingEvents.length > 0) localApply(remainingEvents);
      return { usedBridge: true, disabled: true, failedIndex: index };
    }
  }

  return { usedBridge: true, disabled: false, failedIndex: null };
}
