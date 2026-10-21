# Design

Body height `h` is `SWING.bodyH` (1.8). Speeds in `CLIMB.run` are in body-heights per second: stick at 4, up at 6, along at 7, slide at 2, kick off at 8, for 3 seconds.

## Stick

`step` in `physics.js` already records `touch.speed` and `touch.into` before the bounce takes the speed into the wall. A contact sticks as a run when no rope is attached, `touch.speed` is at least `4h`, and `touch.into` is at least half of that. The old decaying run (`keep`, `decay`, `leap`) is gone. A slower contact, a walk, and a fall steered in still use `grab` with `wallRun` left null, so the cling, the Needle and the brush rule stay.

Head-on (`|along|` not greater than the speed into the wall) starts in mode `up`. Mostly along the wall starts in mode `along`. `P.wallBudget` counts only while a run or a slide is on the wall. `land`, a vault, and standing at the bottom set it to 0. A jump or a web leaves it, so the next wall in the air does not refresh the 3 seconds.

## On the wall

`climb` reads `P.wallRun`. Mode `up` moves up at `6h` when the player pushes forward or gives no direction. Mode `along` moves along at `7h` when the sideways wish is the stronger one. After `wallBudget` reaches 3 seconds the mode is `slide` and the hero goes down at `2h`. Down on the stick, during a run, still goes down, at the up rate. The roof edge uses the existing mantle, which stands the hero on the roof. Jump while `wallRun.mode` is set calls `leaveWall` with `{ out: 8h, up: 0 }`. A cling jump stays `{ out: 6, up: 6 }`. `fire` already calls `leaveWall` before the cup flies, so a web swings straight off.

## Pose

The run the player sees is the procedural two-beat cycle in `hero.js` (`update`, the block under `if (wR > 0.001)`), not a sprite sheet. Nothing else in the repo fit a wall run: the climb pose is a frog crouch on holds (`climbStep`), and there is no run sheet to rotate. While `P.wallRun.mode` is set, that cycle's weight goes to 1, `climbStep` does not run, and the tilt quaternion is a +90° turn about local X. Feet (−Y) land on the wall (local −Z, the facing). The stride that was forward goes up the wall.

Dust is four reused `THREE.Mesh` spheres, radius 0.12, `MeshBasicMaterial` color `0x8A8378`, transparent. `S.phase` already advances with the gait. A step is half a cycle (`π`). Every other step, when the step index changes onto an even value, one puff is placed at the feet, nudged out along the wall normal. It fades over 0.4 s. No new file.

## Touch and the test hook

`mobile.js` `pointermove`: a right-half finger on a wall that moves up more than 56 px, and more up than sideways, sets `state.jump` and `thrown`. `desktop.js` already turns `phone.jump` into `jumpDown`. The finger does not also fire a web. The JUMP button on `.phone-climb` stays.

`publishWall` in `main.js` writes one reused object on `window.__test.wall`: `onWall`, `face` `{x, z}` (the wall normal), `timer` (seconds on this run), `mode` (`up`, `along`, `slide`, `cling`, or `off`).
