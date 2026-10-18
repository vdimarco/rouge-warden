# Paper cut: the reference art for First Breath

This folder keeps the paper-cut reference art that design.md sections 13 and 14 point at. It was copied from the art
session's scratch folder, which is not kept. Nothing here ships in the game: `render/` ports the ideas, not the files.

## What is here

| File | What it is |
|---|---|
| `kit.src.js` | The shared paper helpers (`window.PaperCut`, called `PC` below): `cut`, `circle`, `path`, `shadow`, `paper`, `sheet`, `margin`, `bake`, `blit`, `roundRect`, `tag`, `sperm`. Each scene file carries the same block between `// <paper-kit>` markers. |
| `scenes/paper-race.js` | Stage 1, The Race, as a shadow box: plum wall sheets over a rose floor, the fork, the amber lane with cream chevrons, 20 cut sperm. |
| `scenes/paper-guard.js` | Stage 2, The Egg: paper rings like a target, a cloud of paper dots, the cream arc, mauve sperm, your marigold sperm with cream dashes. |
| `scenes/paper-grow.js` | Stage 5, First Trimester, week 12: a tunnel book of scalloped frames, the baby in four rounded pieces, the twisted cord with gold lights. |
| `kit.js` | The art harness (`window.FB`) the scenes need: `FB.scene`, `FB.rng`, `FB.noise2`, `FB.mix`, `FB.ui.font`. Most of it is the older glow kit; the paper scenes use only those calls. |
| `preview.html` | The scene runner. `?scene=<id>` plays one scene; `&t=still` draws one frame; `&bench=N&w=&h=` times N frames; `&flush=1` adds a 1 px `getImageData` after each draw; `&low=1` turns grain off and shadows flat (a stand-in for the low tier). Do not pass `&wrf=1` (`willReadFrequently`) except to see the trap below. |
| `bench.mjs` | Times a scene in headless Chromium. `--raster cpu` uses `--disable-gpu`. |
| `board-paper.webp` | The paper-cut board (race, guard, grow), reduced. |
| `compare-race.webp`, `compare-guard.webp`, `compare-grow.webp` | The side-by-side boards: paper cut, watercolour wash, oil impasto and oil haze, reduced. |

To run: `python3 -m http.server 8767 --directory openspec/changes/add-first-breath/research/paper-cut`, then open
`http://127.0.0.1:8767/preview.html?scene=paper-race`. To time it:
`CHROMIUM=/opt/pw-browsers/chromium NODE_PATH=qa/browser/node_modules node openspec/changes/add-first-breath/research/paper-cut/bench.mjs paper-race 60 390 844 --raster cpu --flush`.

## The look in short

- Flat sheets of coloured paper stacked like a shadow box or a tunnel book. Each sheet is one flat colour with a
  fine grain that moves and turns with its sheet.
- Hand-cut edges from short straight snips: a slow wobble along the normal plus a small jitter per snip.
- Depth comes only from soft drop shadows between sheets. The light is above and a little left, so shadows fall down
  and a little right (`PC.LX = 0.42`, `PC.LY = 1` per px of height).
- Frame sheets get darker toward the viewer. The subject sits on the highest sheet, with the deepest shadow.
- One marigold accent for "you". Small cream tags for labels (in the game they are DOM elements, design 13.1).
- Motion: sheets sway a few px in parallax, tails beat, waves and dots slide.

## How the kit draws

- `PC.cut(pts, closed, o)` resamples a polyline every `step` px and pushes each point along its normal by
  `amp · noise(arc / λ)` plus `jitter · hash(index)`. In the game the jitter must come from world position instead
  (design 14.1), because the stages send a sliding window of the course.
- `PC.shadow(ctx, path, h, o)` fills the silhouette once at offset `(0.42 h, h)`, then strokes it up to 8 times with
  widening lines clipped to the outside of the shape, each pass weak enough that the stack sums to the shadow's alpha
  at the edge. `o.fast` is one fill plus one stroke at half alpha. There is no `ctx.filter` and no `shadowBlur`.
- `PC.paper(ctx, path, color, o)` draws a lit edge (the sheet shifted toward the light and mixed toward cream), the
  flat colour, an optional paler core along the cut edge (`o.core`), then the grain pattern with
  `CanvasPattern.setTransform` so the grain turns with the sheet.
- `PC.margin` is a sticker's cream backing. `PC.bake` and `PC.blit` bake still sheets into one offscreen canvas and
  copy it at whole device pixels.

## Palettes (from each scene's header)

| Scene | Hex values |
|---|---|
| Race | floor `#86355a`, floor dots `#9b4a6c` and `#702b4c`, wave bands `#a3536f`, walls `#64224a` / `#4c1839` / `#36102a` (inner to outer), warm side `#e8834f`, lane `#f6ab48`, chevrons `#fde7c6`, cool side `#4e3a5e`, rivals `#e6c4d2` (back `#c99fb5`), you `#ffc53d` (back `#ee951c`) on cream card `#fff0cf`, tag `#fff0dc` with ink `#3a1029`, shadow `#1c0612` |
| Guard | board `#5e1c34`, ripples `#6c2440`, corona `#f2a07e` / `#f8c3a2` / `#e07f66`, cell `#ffc49c`, shell `#fbe3d0`, inner disc `#ffd8b8`, nucleus `#f08c6c`, arc `#fff4e2`, rivals `#e6c4d2` (back `#c99fb5`, resting `#d1a9bb`), your sperm `#ffc53d` (back `#ee951c`) on `#fff0cf`, tag `#fff0dc` with ink `#3a1029`, shadow `#1c0612` |
| Grow | frames `#4e1430` / `#8e2c4b` / `#c25470` (front to back), sac `#f6d6cc`, motes `#ebb5b2`, placenta `#d65a72` with `#e9858f`, pools `#c2283d`, cord `#e98a96` (back `#c9667b`), body `#f39477`, head `#f6a585`, limbs `#e57a62`, heart `#ffc53d` on `#fff0cf`, lights `#ffd25a`, tag `#fff0dc` with ink `#3a1029`, shadow `#1c0612` |

The game does not take these as they are. design.md 13.2 changes several of them so the contrast and brightness
checks pass: darker rivals (`#967088`), ink `#1a0610` in place of the shadow `#1c0612`, a darker cord under the
lights, a rose sac in stage 5, rose pools with a wavy rim in place of the crimson drops, and darker corona dots along
the gold sperm's path.

## Measured cost (390 × 844, DPR 1, headless Chromium)

| Setup | Race | Guard | Grow |
|---|---|---|---|
| JS draw time only, no readback (p95, ms, SwiftShader or `--disable-gpu`) | 1.4 to 3.2 | 2.3 to 3.6 | 1.4 to 2.9 |
| SwiftShader flags (`--use-gl=angle --use-angle=swiftshader`): rAF gap | 257 to 405 ms (3 to 4 fps), also at 195 × 422 | | |
| SwiftShader, 1 px readback (mean / p95, ms) | 94 / 118 | | |
| `--disable-gpu`, 1 px readback, full size (p95, ms) | 32 to 35 | 35 to 36 | 19 to 23 |
| `--disable-gpu`, 1 px readback, scale step 0.5 (p95, ms) | 17.4 | 16.9 | 8.6 |
| `--disable-gpu`, 1 px readback, scale step 0.35 (p95, ms) | 13.4 to 13.8 | | |
| `--disable-gpu`, 1 px readback, `&low=1`, full size (p95, ms) | 7.8 | 9.0 | 6.1 |
| `willReadFrequently` on the main canvas with GPU-backed bake canvases | 289 to 335 ms a frame | | |

What follows from these numbers (design 14.3): the JS time alone always passes, so it measures almost nothing; a 2D
canvas in SwiftShader is too slow for any real-time check; the cost follows the number of shapes, not the pixels, so
the scale step cannot bring it down on its own; baking more sheets and the low tier can.

## Sources the artist named

Henri Matisse's cut-outs ("The Snail", 1953; "Polynesia, the Sky", 1946; "Blue Nude II", 1952); Charley Harper's flat
geometric prints; Tearaway (Media Molecule) and Rex Crowle's GDC 2013 talk "Building the Touchy-Feely World of
Tearaway"; Gris (Nomada Studio) for layered silhouettes; tunnel books and shadow boxes; Abduzeedo, "Learn How to
Create Paper Cut Effect with this Photoshop Tutorial"; Red Shark Digital, "How to create layered cut out paper in Adobe
Illustrator". design.md 14.2 lists what the game adapts from each and what is our own.
