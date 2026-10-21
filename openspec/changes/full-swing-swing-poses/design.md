# The swing follows the arc

## Source

John Lasseter, "Principles of Traditional Animation Applied to 3D Computer Animation" (SIGGRAPH 1987). The chest leads through the bottom of the arc, the legs and the free arm follow through, and the knees tuck on the way up (overlapping action). The run stays the CMU run already credited in `public/vr/anim/CREDITS.md`. None of the swing clips in that file fit an airborne rope, so the swing stays a pose in code.

## Decisions

- The blend is the rope, not a clock. Hang is how far the chest is under the anchor. Across is speed on the arc. The bottom is a high hang, little speed along the rope, and a high across. A taut rope keeps the radial speed near zero, so the tuck is a low hang while the body is rising, or while it slows at the top. It does not wait for speed toward the anchor.
- A quiet hang (little speed, or the blend in and out) keeps the previous mild trail, so a stop on a rope does not snap into a sprint.
- The rope arm still reaches the anchor after this pose, and the captured ground loops still replace the idle and the run on the ground.
- No new draw, and the skinned triangle count stays where it is.
