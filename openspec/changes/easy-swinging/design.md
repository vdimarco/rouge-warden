# Design

Body height `h` is `SWING.bodyH` (1.8), next to `chestH`.

## Anchor

`easyAnchor` in `physics.js` places a point 12h along the horizontal velocity and 14h above the feet. `nearestSurface` within 6h, then 26 rays from that point, snaps to the closest building face. With none, the point stays, tagged `sky`. `playerEasy` in `main.js` raises a sky anchor until `project()` says it is off the screen.

The result object is reused. `fire` copies it, then `armEasy` sets `flyDur` to 0 so the cup attaches on the next physics step while the hold is still down.

This runs in the chase view during play, when there is no `G.test.aimAt`, the hero is not on a wall, and the view is not first person. A phone tap (a fire with no held finger) still uses `phoneAim`. A finger held on the right half (`phoneHeld`) uses the auto anchor. No new control is added.

## Rope

Length is the distance to the anchor, capped at 16h. `keepClear` shortens `len` immediately when `anchor.y - len - chest` would put the feet under `groundY + 1.5h` (the water plane `y = 0` over the lake). A trailing `lenTarget` would scrape for a step, so the length itself changes.

Gravity is the existing pendulum. Holding forward (`inp.move.y > 0.2`) multiplies speed by 1.15 once per attach, when the fall has turned into a rise under the anchor (`prevY < -1`, chest mostly below the anchor). Letting go calls `easyBoost`: the velocity is kept and 10% of the speed is added along the horizontal velocity and upward. `swingCool` is 0.15 s per hand.

## Line

The mesh rope is not drawn for an easy web. A 2D canvas `#webLine` (z-index 8, under the HUD) strokes it in CSS pixels: `#2B2A33`, width 2, clipped to the screen with Cohen–Sutherland when the anchor is outside. The sag is the parabola in `putRope` (`rope.js`): slack hangs, tension straightens it. On screen that is `(1 - tension) * 16` px of quadratic sag, gone as tension reaches 1, then a 150 ms fade after release. At peak speed above 12 m/s, 4 lines (3 just under the peak) of `#F3E9D6` at 25% opacity trail the body.

`window.__test.swing` is one reused object: `attached`, `anchor: {x,y,z,offscreen}`, `ropeLength`, `speed`.
