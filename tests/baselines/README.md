# Baseline Fixtures

These fixtures record fixed-seed stable game summaries used to guard architecture refactors.

The source payload is `window.render_game_to_text()`, but the committed fixtures intentionally omit clock- and viewport-dependent fields such as `timeLeft`, hook geometry, pivot coordinates, hook endpoints, hook length limits, item coordinates, and item placement summaries. Item placement depends on the canvas size, so `items` and `itemCount` are intentionally excluded from these stable fixtures.

Keep only deterministic gameplay summary fields:

- high-level state: `phase`, `paused`, `mode`, `level`, `seed`, `score`, `target`
- `market.name`, `market.summary`, and rounded `market.multipliers`
- DDA summary fields
- hook count plus each hook's `player`, `state`, and `attached`

## seed-12345-initial-single.json

Captured from:

`file:///Users/drew/Project/Gold%20Miner/index.html?seed=12345`

Procedure:

1. Load the page.
2. Start single-player mode.
3. Evaluate `window.render_game_to_text()`.
4. Extract the stable summary fields above.
5. Save summary JSON with two-space indentation.

Expected high-level state:

- `phase`: `playing`
- `paused`: `false`
- `mode`: `single`
- `level`: `1`
- `seed`: `13546`

## seed-12345-after-advance-1000ms.json

Captured from the same initial state after `await window.advanceTime(1000)`.

This fixture records `advancedByMs: 1000` but does not record the actual remaining clock time.
