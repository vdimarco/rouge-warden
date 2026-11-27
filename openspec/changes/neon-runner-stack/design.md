# Runner stack

## Source

The horizontal-slice method in [sprite stacking](https://github.com/danielwh2/sprite-stacking/blob/main/skills/sprite-stacking/SKILL.md): each slice is a top-down plan, ground at the bottom of the stack, and the stack turns with one angle. The pixels are Art's voxel strips (`slices20-*.png`), not a hull carved by `views_to_slices.py`. That carver fattens the striding legs. The 24-slice strips were left unused; 20 slices at 1.2 art pixels of height cover the same 24-voxel body and keep the slice count down.

## Draw

The 20 slices are kind 1, orient 0, low, bid -1. They ride the one existing instanced draw. A heading uniform rotates only those flat kind-1 quads about the runner. Building quads stay axis-aligned. Crouch, hack, and spotted keep the upright card and its left/right flip. Swapping idle, run_0, and run_1 only changes the slice UVs.

Strips are pasted into the atlas at y = 320, 336, and 352, x = 0, cell i at x = 12*i. The old 24 by 32 runner frames stay where they are. No new image file is served.
