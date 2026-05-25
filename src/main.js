import "./runtime/moduleBridge.js";

try {
  await import("../game.js");
} catch (error) {
  if (typeof window !== "undefined") {
    window.__goldMinerBootError = error instanceof Error ? error.message : String(error);
  }
  console.error("Gold Miner module entry failed.", error);
  throw error;
}
