# Asset style kit

A review of the asset pipelines found that a game's look is restated in every request instead of living in one place. Shore of the Ancients changed style four times and regenerated its assets each time. Several art sets cannot be remade, because their prompts were never saved. River Rush pasted the same seamless-tile loop into three scripts. The user approved two fixes: a research rule in `AGENTS.md`, and a shared kit for styles and tiling textures.

## Scope
- `AGENTS.md`: before building a rendering or art technique, look up how others already solve it, and name the source in the change's `design.md`.
- `higgsfield/styles/<game>.json`: one style file per game with recorded style text and committed reference images. The first six are Shore of the Ancients, In Full Swing, Breath of the Lake, River Rush, Reel It In and Olympus. Games with no recorded style text get no file.
- `npm run gen -- … --style <game>` adds the style text and reference images to a request. `--dry-run` prints the request and stops. With `--out`, a request record is saved next to the outputs.
- `npm run swatch` makes a texture tile and can save a 2 by 2 preview. Its edge crossfade lives in `higgsfield/seamless.ts`, and River Rush's three pack scripts use it.
- `sharp` becomes a dependency of the Higgsfield tools. `pack-surfaces.mjs` already loaded it from there without listing it.
- No game changes. River Rush's packed textures stay byte for byte the same.

## Capabilities
- Add `asset-style-kit`.
