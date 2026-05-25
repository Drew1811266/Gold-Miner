# Browser Smoke Checklist

This project does not currently ship an automated `test:browser` script. Use this checklist with the in-app Browser or Playwright MCP when a task affects boot, rendering, input, packaging, or browser-only globals.

## Setup

Run the game from a local static server:

```bash
python3 -m http.server 5173 --bind 127.0.0.1
```

Open:

```text
http://127.0.0.1:5173/?seed=12345
```

Stop the server after the smoke pass.

## Required Checks

1. Boot
   - No console errors or warnings.
   - `window.__goldMinerBootError` is absent.
   - `window.__goldMinerModulesReady === true`.
   - `typeof window.GoldMinerModules === "object"`.
   - Canvas has nonblank pixels after the menu renders.

2. Single-player start
   - Click start, choose single player, and wait for gameplay.
   - `JSON.parse(window.render_game_to_text()).phase === "playing"`.
   - Payload includes `level`, `score`, `target`, `items`, `hooks`, and `inventory`.

3. Fire hook
   - Press Space or click the canvas.
   - Advance briefly with `window.advanceTime(500)`.
   - The first hook is no longer in its initial idle/swing-only visual position, and no `__goldMiner*Error` global appears.

4. Pause and resume
   - Press `P` or the pause button.
   - Verify the debug payload reports `paused === true`.
   - Press `P` or the continue control and verify gameplay continues without console errors.

5. Double-player start
   - Restart from the menu, choose double player, and wait for gameplay.
   - Verify two hooks are present in `window.render_game_to_text()`.
   - Fire player one and player two shortcuts once each.

6. Shop purchase
   - From an active single-player run, use the sanctioned smoke precondition:
     ```js
     window.__goldMinerSmoke.enterShop({ score: 500 });
     ```
   - Verify `JSON.parse(window.render_game_to_text()).phase === "shop"`.
   - Click the first shop buy button, or run:
     ```js
     document.querySelector(".shopItem button").click();
     ```
   - Verify the purchase is deterministic:
     ```js
     JSON.parse(window.render_game_to_text()).score === 350
     JSON.parse(window.render_game_to_text()).inventory.bombs === 1
     ```

7. Fixed-seed text snapshot
   - Capture `JSON.parse(window.render_game_to_text())` at initial single-player gameplay.
   - Run `window.advanceTime(1000)`.
   - Capture another payload.
   - Confirm both payloads are valid JSON and the second payload reports an advanced clock without changing the seed or level unexpectedly.

## Quick Console Probe

```js
(() => {
  const text = JSON.parse(window.render_game_to_text());
  return {
    ready: window.__goldMinerModulesReady,
    bootError: window.__goldMinerBootError ?? null,
    phase: text.phase,
    level: text.level,
    score: text.score,
    inventory: text.inventory,
    itemCount: text.items?.length ?? 0,
    hooks: text.hooks?.length ?? 0,
    errors: Object.keys(window).filter((key) => /^__goldMiner.*Error$/.test(key)),
  };
})();
```
