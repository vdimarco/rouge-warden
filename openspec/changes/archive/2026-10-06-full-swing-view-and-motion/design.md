# Design

## Camera (flatcam.js)

Two designs were built and judged on the same nine screenshots (a workflow): a "high boom" (the arm's angle follows the pitch only when looking down) and "decoupled framing" (a fixed boom and a view offset). The boom won 55 to 39. The framing design's `setViewOffset(1, 1, ...)` set `camera.aspect = 1` in this three.js build and stretched the picture, and its offset bought only about 4 degrees.

- The pivot is 0.35 m over the eyes (it was 0.25 m over the chest). The default pitch is -20 degrees.
- Looking down: the arm's angle is the pitch. Looking up: it bends toward `top = -asin((0.45 - 0.35) / arm)` with `tanh`, which has the same slope at the default, so the camera does not jerk there. Past level the arm shortens to 90 %.
- The look-up limit is 25 degrees (the judge asked for more than the boom's 22; at 25 the head is at NDC y about -0.88). Third person eases a pitch left outside its range back in at rate 6.
- The arm always points up from the pivot, so the old street floor clamp is gone.
- `info()` adds `el` (the arm's angle) and `room` (the wall room).

How to check: `qa/vr/view-shots.mjs` (nine shots with the camera height over the head), hero.mjs (a sweep of 13,600 city views finds none under the head; a pitch sweep).

## Mouse look (desktop.js, main.js)

The cause was the PLAY click: full screen first used up the click, then the lock. Firefox refuses a lock with no activation outside full screen, and Chromium on macOS can fail a lock taken during the full-screen animation. Fixes: lock first, then full screen; on macOS let go and take the lock again on `fullscreenchange`; `unadjustedMovement` with a fallback on NotSupportedError; RESUME locks in its own click and asks again after Chrome's Esc wait; with no lock the cursor turns the view and the edges turn it at 2.2 rad/s; a caption; the lock click fires no rope (after two refused clicks, clicks fire again). Chromium's fake first move is dropped by its time stamp and size. The arcade opens /vr/ at the top level (no iframe).

How to check: `qa/vr/mouse-look.e2e.mjs` (stubbed lock and full screen). A real macOS cursor, Safari and Firefox could not be checked here.

## Climbing (hero.js cling path)

Holds are world points on the wall; a limb steps when half a step behind its home and lands half a step ahead. Diagonal pairs take strict turns; the swing time fits inside the other pair's hold. Hand first going up or sideways, foot first going down. A shared two-bone solver serves `legIK` and the new `armIK` with per-side bone lengths. The mantle is drawn over 0.55 s while the body jumps. How to check: `climb.e2e.mjs` and `hero.mjs` (held limbs under 5 cm/s, diagonal pairs only).

## Walk and run (hero.js, public/vr/anim/)

`qa/vr/bake-mocap.mjs` retargets CMU 16_15 (walk), 35_17 (jog), 09_01 (run) and Quaternius Idle_Loop onto crew5 (rest-pose deltas with limb, arm-roll and foot fixes), makes in-place loops starting at the left foot strike, pins planted feet, and writes `anim/locomotion.json` (76 KB). Licences: CMU allows use in products (not resale of the data); Quaternius is CC0; see CREDITS.md.

Playback (`groundClips`): weights by ground speed (idle to walk 0.15-0.6 m/s, walk to jog 1.4-2.4, jog to run 2.9-3.3), eased at rate 8; one phase for the moving loops advanced by `speed / blended stride`; per-bone nlerp of the sampled turns; the limb fix `D' = D * corr` for a rig whose rest limbs differ (the built-in figure); then a per-bone slerp into the code-built pose. Weights: legs `on × (1 - crouch)`, body `on × (1 - 0.6 crouch)`, an arm also `× (1 - reach)`, the head 0.4 (it keeps the camera look). `on` eases in at 10 and out at 14 when the hero leaves the ground or grabs a wall.

How to check: measured on the glb at 3.5 m/s, the planted toe moves 0.06 and 0.18 m/s (median, left and right) while in contact. Starts peak at 0.20 rad a frame and stops at 0.16 (the old gait: 0.41 and 0.15).

## Opening (main.js)

The cottage room hangs from the rig, so turning the rig turned the room with the view. On desktop the turn now goes into the head's local yaw (`introYaw`), which the opening reads as a headset head; the muzzles turn with it; the hand-off adds it to the rig's yaw.

## Sound and layout

`game.start` turns the music on for every run (settings.music still wins). The player's report of no sound at all is still open: the live site could not be loaded in this sandbox's browser (its proxy drops files), and the same code passes `sound.e2e`. `.fs-sub` and `.fs-toast` sit under the pills at the top.
