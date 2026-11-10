# Design

## Fighter art: one generated pose sheet per leader, cut by chroma key

Each leader starts as one front-view concept image. An image-edit model (Nano Banana 2.1 on fal) redraws that character as a 4 by 2 sheet of eight side-view poses on flat magenta. `games/lake-brawl/tools/slice_sheet.py` turns a sheet into sprites:

- The key is `min(red, blue) - green`, with a soft edge, so anti-aliased outlines keep partial alpha.
- Figures are found as connected blobs, not by cell, because a kick or a rear foot often crosses a cell line by 10 to 30 px.
- Magenta spill is pulled out of the two outermost pixels only, so purple and maroon clothes keep their colour.
- Every pose is scaled by the height of the idle pose, and each sprite records where its feet are, so poses line up on the ground when they swap.

Source adapted: this is ordinary chroma keying with a despill pass, as film and sprite pipelines use for green and blue screens. No published sprite-sheet tool fit, because they cut on a fixed grid and these sheets do not hold one.

Magenta was chosen over green because one fighter wears olive green. The raw sheets are about 62 MB and are not in the repository; the cut sprites in `public/lake-brawl/assets/sprites/` are.

## Animation is pose swapping

A move shows one drawing, with a small lunge, tilt and bob added in code. Walking alternates the stance and stride poses. This keeps each fighter to eight images. Smooth animation would need several frames per move, and the edit model does not hold a character steady across that many.

## Stages

Each stage is one generated 16:9 painting with a flat floor in the lower 40%. All five share one ground line, so fighters, shadows and the sign need no per-stage numbers. Only the ice sets `ice: true`, which lowers acceleration and stopping.

## Difficulty

A campaign rival's damage is multiplied by 0.75, 0.85, 0.95, 1.05 and 1.15 across the five chapters. The computer also decides sooner and blocks an incoming attack more often each chapter. These numbers are a first guess and have not been tuned by play.

## Save

`lake-brawl.save.v1` holds the campaign in flight (`run`), the leaders who finished (`cleared`) and the roster size (`total`). The game discards a `run` or `cleared` of the wrong shape. The arcade cabinet reads `cleared` and `total` for its line.
