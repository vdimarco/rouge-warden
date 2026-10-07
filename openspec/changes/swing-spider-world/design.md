# Design

## Glide

The glide runs in the air branch of `step()`. It adds back the step's gravity, then eases `V.y` toward `-sink`, so the fall settles at the sink rate. The fall speed it removes in that step adds `lift` times itself to the speed along the ground. The speed along the ground is then held between `min` and `max`. The move input turns the heading at up to `turn` rad/s. Plain air control is off while gliding, so the two do not fight.

It needs `inp.glide`, no attached rope, `airT > minAir` (so a jump with Space held does not glide at once) and `V.y < 0.5`. `main.js` sets `inp.glide` from Space held (`jumpHeld`) or the phone button, only in flat play. A held Space in the air with a rope out still yanks on the press, and glides after the rope is gone.

The pose reuses the dive with no tuck: the body follows the flight and the arms stay spread.

## Wall run

The climb check already tells a brush from a hold. The run adds a third case before the plain grab: no rope attached, full speed of at least `run.min`, and the move input toward the wall (`into > 0.3`) or a head-on hit at speed. A plain fall into a wall with no input still clings, as before.

`P.wallRun = { speed, dir }` is read in `climb()`. While it lasts, the climb goes `dir` at `speed`, the side input is ignored, and `speed` falls by `decay` m/s². It ends at the climb speed, or when the player pushes the other way. A jump off it uses `jump.out` and `6 + jump.k × speed` (capped). At the top edge, a run of at least `top` m/s leaves the wall with `leap × speed` up and a small push over the roof, instead of a step on to the roof. That frame does not move the body, so the "no teleport" check of the physics tests holds.

## Throw

`C.throw` picks a target and starts the cool-down. `main.js` flies a lid mesh (a porcelain disc with a back-face ink ring, made once and reused) along a lerp with a 1.5 m arc. `C.landThrow` applies the damage on arrival, so a goon that moves keeps being the target. The throw goes where the camera looks (`flatcam.yaw`), not the body's facing, which lags behind.

## Crimes

A crime is an offer with `crime: true`, `until`, and a bigger take radius at any height. That way it reuses the marker drawing, the start path and the end path of jobs. `J.crimesOn` turns crimes on (main ties it to Mission 1, as for offers). Unit tests create jobs with `crimesOn` false, so no crime starts unless a test asks.

The getaway car and the tanker live in `cars.js` as job cars (`c.job`). They never despawn, the hero cannot get into them, and `autoDrive` gives the getaway car a throttle and a steer toward the next path point, slower in turns. `stopCar` brakes it with a swerve. `jobs.end()` releases the job car to the pool. The car's rope target is a point object that `jobs` moves with the car every frame, so the auto target follows it.

## Music

`st.fight` adds notes inside `playStep` on the same 16th-note grid, so the fight layer is always in time with the groove.
