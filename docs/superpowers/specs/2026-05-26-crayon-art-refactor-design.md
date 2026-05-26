# Gold Miner Crayon Art Refactor Design

## Original Request

The user wants the current cartoon visual style refactored into a realistic sketchbook paper and wax-crayon style. Every in-game element should be redesigned, using Codex image generation element by element. The selected direction is **B: warm realistic storybook crayon**.

## Scope

This refactor is visual only.

Keep unchanged:
- Gameplay rules, scoring, item values, level generation, market system, DDA, shop behavior, timers, controls, and two-player behavior.
- Object positions, collision radii, hook state machine, movement, weights, and pull speeds.
- Existing DOM ids and event bindings.

Change:
- Canvas-rendered art for the full game scene.
- UI styling for the top bar, stats, market ticker, inventory chips, buttons, overlay, and shop.
- UI icons and app icons when practical, as visual assets only.

## Visual Direction

Use a warm, realistic storybook crayon style:
- Visible paper grain and handmade wax-crayon strokes.
- Charcoal or graphite-like outlines.
- Muted but readable colors.
- Warm cave and wood tones.
- Gold and gems remain recognizable, but avoid glossy vector highlights or 3D shine.
- Friendly enough for the existing casual game tone, without preserving the current cartoon-flat look.

Avoid:
- Modern glass UI.
- Bright polished cartoon rendering.
- Pure flat-color vector assets.
- Near-monochrome art that makes item recognition slow.

## Architecture

Add a project-local art pack under `assets/art/crayon/`.

Add a lightweight render asset registry that:
- Preloads image assets.
- Exposes assets by stable keys.
- Reports load readiness without blocking game logic.
- Allows renderers to fall back to existing procedural drawing if an image fails to load.

Keep the existing render layer boundaries:
- `src/render/backgroundRenderer.js`
- `src/render/itemRenderer.js`
- `src/render/minerRenderer.js`
- `src/render/winchRenderer.js`
- `src/render/hookRenderer.js`
- `src/render/fxRenderer.js`
- `src/render/carryLabelRenderer.js`

The renderers may draw generated sprites or texture overlays, but they must continue to use the existing input data such as `item.x`, `item.y`, `item.r`, `hook.angle`, `hook.length`, and viewport dimensions.

## Asset Plan

Generate and store final project assets in the repository. Do not reference temporary `.codex/generated_images` paths from the game.

Canvas assets:
- Background mine scene, paper grain, cave strata, and wood beam treatment.
- Miner body/head/helmet/lamp styling compatible with the current pose system.
- Winch base, reel, hub, bolts, and handle.
- Rope treatment and three-prong hook metal styling.
- Gold nugget.
- Gold bar.
- Rock.
- Diamond.
- Emerald.
- Ruby.
- Crystal cluster.
- Lucky bag.
- Ancient coin pouch.
- Fossil.
- Dynamite keg.
- Mouse.
- Mouse cargo variants for diamond and gold bar.
- Score pop text treatment, explosion rings, sparks, dust, and grab highlight.

UI assets and styling:
- Paper-textured page and panel surfaces.
- Hand-drawn borders and crayon button fills.
- Stats, market ticker, inventory chips, controls, overlays, and shop panel.
- Bomb, speed, and lucky-bag icons in the same style.
- Favicon/app icons may be updated to a matching miner lamp or gold nugget motif if it can be done without touching behavior.

Assets that need transparent canvas composition should be generated on a flat chroma-key background and then processed into transparent PNGs locally. Background and UI texture assets can remain rectangular.

## Integration Details

Canvas:
- Draw each sprite in the same logical bounding area used by the current procedural art.
- Preserve item center points and visual scale tied to `item.r`.
- Preserve miner, hook, and winch animation math.
- Keep procedural fallback paths in place for missing assets.
- Avoid changing entity data to accommodate art.

UI:
- Update `styles.css` only for presentation.
- Preserve all existing HTML ids, button semantics, and controls.
- Use paper texture, charcoal outlines, crayon color fills, and restrained shadows.
- Do not add instructional text or change gameplay copy unless needed for visual fit.

## Testing

Automated checks:
- Add focused unit coverage for the asset registry and fallback behavior.
- Run `npm run verify`.

Browser smoke:
- Serve the game locally.
- Enter single-player gameplay.
- Fire the hook.
- Confirm visible crayon-style background, miner, winch, hook, and items.
- Trigger or inspect item pickup and score pop styling.
- Inspect shop overlay.
- Pause and resume.
- Confirm console has no new errors or warnings.

Regression checks:
- `window.render_game_to_text()` still reports the same state shape.
- `window.advanceTime(ms)` still advances deterministic time.
- Two-player mode still creates two hooks and accepts Space/Enter controls.
- Shop purchases still update score and inventory as before.

## Acceptance Criteria

- All in-game visual elements have a coherent warm realistic storybook crayon treatment.
- The UI and canvas feel like one art direction.
- No obvious cartoon-flat or glossy remnants remain in active gameplay.
- Gameplay behavior, collision, scoring, controls, levels, and shop logic are unchanged.
- Missing or failed image loads do not break gameplay.
- `npm run verify` passes.
- Browser smoke passes with no new console errors or warnings.
