# Crayon Art Asset Prompts

Style direction: warm realistic storybook wax-crayon illustration on textured sketchbook paper, visible wax strokes, graphite/charcoal contour lines, muted readable color, handmade natural edges, not flat vector, not glossy 3D, not polished cartoon.

Transparent sprites and icons were generated on flat #00ff00 chroma-key backgrounds and processed with:

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
```

Asset list:
- `backgrounds/mine-storybook.png`: wide 16:9 cave game background, no characters, no UI.
- `textures/paper-grain.png`: seamless warm sketchbook paper texture.
- `textures/ui-paper.png`: parchment UI panel texture.
- `textures/wood-beam.png`: horizontal mine beam texture.
- `sprites/gold-nugget.png`: single irregular gold nugget.
- `sprites/gold-bar.png`: single gold bar with no text.
- `sprites/rock.png`: rounded gray mine rock.
- `sprites/diamond.png`: pale blue diamond.
- `sprites/emerald.png`: green emerald.
- `sprites/ruby.png`: red ruby.
- `sprites/crystal.png`: blue-white crystal cluster.
- `sprites/lucky-bag.png`: purple lucky bag.
- `sprites/coin-pouch.png`: old coin pouch.
- `sprites/fossil.png`: beige fossil stone.
- `sprites/dynamite-keg.png`: red dynamite keg with fuse.
- `sprites/mouse.png`: side-view field mouse without cargo.
- `sprites/mouse-diamond.png`: side-view field mouse carrying a diamond.
- `sprites/mouse-gold-bar.png`: side-view field mouse carrying a gold bar.
- `sprites/miner-body.png`: miner upper body without arms.
- `sprites/miner-head.png`: miner head with helmet and lamp.
- `sprites/winch-plate.png`: metal mounting plate with bolts.
- `sprites/winch-reel.png`: circular winch reel.
- `sprites/hook-claw.png`: open three-prong inward claw hook.
- `sprites/spark.png`: small crayon spark burst.
- `icons/bomb.png`: bomb UI icon.
- `icons/speed.png`: speed lightning UI icon.
- `icons/lucky-bag.png`: lucky bag UI icon.
