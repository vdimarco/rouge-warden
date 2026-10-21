# Design

Body height `h` is `SWING.bodyH` (1.8), next to `chestH`.

## Anchor

`easyAnchor` in `physics.js` places a point 12h along the horizontal velocity and 14h above the feet. The order is the one in the spec. A marked tutorial or mission point within 16h is copied onto the result before the search. `nearestSurface` within 6h, then the closest point on a collider in that ball, snaps to that face. A ray from inside a box does not hit it (`city.js`), which is why the face search is there as well as the ray fan. `opt.avoid` skips that building id, including another tier and its antenna. With none, the point stays, tagged `sky`, and `playerEasy` raises it until `project()` says it is off the screen, unless `opt.lesson` names the gold-ring tower. That face wins over sky even past 16h.

In the chase view the gold ring, and any tutorial or mission target within 16h, is fired by the picker as a normal cup (`aimAndFire` leaves easy off). An easy web would land on the same step and cap the rope, so an 80 ms click on the 65 m tower would not let go on the frame after the attach. Over open water an empty 6h ball stays sky, even when the aim can still see a building past the shore. Over the city that same empty ball uses the aimed building, so a roof shot and a kick in the air still land on it. On the ground with no target the cup dry-fires. No outside anchor write-up fit this order; it is the game's own reach rules.

Both ropes free: `buttonHand` maps the left swing button to the left rope and the right button to the right rope. The side of the target was sending the left button to the right rope when the ring sat near the middle of a 1280-wide view.

A held building rope stays until that button comes up. `ropeInput` releases when the hand is no longer holding. The old catch, which let go on the GO cue and fired the next building, does not run.

The result object is reused. `fire` copies it, then `armEasy` sets `flyDur` to 0 so the cup attaches on the next physics step while the hold is still down.

This runs in the chase view during play, when there is no `G.test.aimAt`, the hero is not on a wall, and the view is not first person. A phone tap (a fire with no held finger) still uses `phoneAim`. A finger held on the right half (`phoneHeld`) uses the auto anchor. No new control is added.

## Rope

Length is the distance to the anchor, capped at 16h. `h` is `SWING.bodyH`, 1.8 m, so 16h is 28.8 m. An open-ground rope of 25.3 m is under that cap. A longer span clamps to 28.8 m. `keepClear` shortens `len` immediately when `anchor.y - len - chest` would put the feet under `groundY + 1.5h` (the water plane `y = 0` over the lake). A trailing `lenTarget` would scrape for a step, so the length itself changes.

Gravity is the existing pendulum. Holding forward (`inp.move.y > 0.2`) multiplies speed by 1.15 once per attach, when the fall has turned into a rise under the anchor (`prevY < -1`, chest mostly below the anchor). Letting go calls `easyBoost`: the velocity is kept and 10% of the speed is added along the horizontal velocity and upward. `swingCool` is 0.15 s per hand.

## Line

The hemp mesh rope is not drawn for an easy web. In the 3D scene the web is its own instanced cylinder, `easyWeb`, from the hand to the anchor. The hang is `(1 - tension) * 16` CSS pixels at the middle of the part on screen, perpendicular to that chord and toward the bottom of the screen, then unprojected at the same depth. The samples keep going past the edge to the anchor, so the line is not cut off there. A belly at the middle of the whole rope does not fit a sky web: that point is off the screen and the line you see stays straight. The thickness uses the camera's vertical field (`2 / projectionMatrix[5] / innerHeight`, the same size `screenWide` uses). Eight short segments keep the width even along a long rope. The vertex shader sets the radius to one CSS pixel times distance from the camera, so the diameter stays about 2 px on a 1280-wide view at every distance. The fragment writes `#2B2A33` and the fade alpha. Release fades it over 150 ms. No outside line shader was a better fit: the vendored three build has no `Line2`.

The paper speed lines stay on the 2D canvas `#webLine`, unchanged: at peak speed above 12 m/s, 4 lines (3 just under the peak) of `#F3E9D6` at 25% opacity trail the body. That canvas stays hidden until those lines are drawn. A view that is not the perspective scene still strokes the web in CSS pixels and clips it to the screen edge.

`window.__test.swing` is one reused object: `attached`, `anchor: {x,y,z,offscreen}`, `ropeLength`, `speed`.

## Headset

A headset session (`G.mode` is `vr` or `ar`, or the input mode is `xr`) does not add swing follow to the rig yaw. `playYaw` in `playturn.js` returns the stick turn alone and ignores a follow amount. `phoneFollow` does not run, and `turnToSwing` does not run. The stick snap and the smooth turn stay, including while a rope is out: that yaw is the player asking to turn. Each hand starts its rope through `handFiresRope`, which is that hand's trigger edge. Grip reels and does not start a rope. The other hand is a separate call. The anchor distances, the rope cap, the 15% and 10% adds, the 150 ms wait, the ink, and `window.__test.swing` are unchanged. Flat play still adds its follow.
