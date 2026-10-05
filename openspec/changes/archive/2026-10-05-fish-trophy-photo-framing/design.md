# Design

## One clock for the beat

Two clocks drive the beat. `main.js` sets the flash and the card with `setTimeout`, so they follow the wall clock. `world.js` eases the push-in and the camera in `update(dt)`, and `main.js` gives it at most 50 ms a frame.

Chosen: `world.js` runs the photo beat by the wall clock too. `beatT` gives the seconds since `showCatch`, from `performance.now()`. The hook-set punch and the freeze already use `performance.now()`, for the same reason: they must line up with a moment that `main.js` times. The beat keeps its length on every phone, and no test has to wait longer.

Not chosen: `main.js` waits for the lake's clock before the flash and the card. `world.js` would keep one clock, but the beat would get longer on slow frames, the card could wait for ever if the lake stopped drawing, and every check that waits for the card would wait longer under software rendering.

`PHOTO` in `main.js` now comes from `WORLD.PHOTO`: the flash at the end of the push-in, the card at the end of the hold.

## The camera's move

`updateCamera` eases toward its target at a fixed rate. It gets close but never arrives, and a far start (a jump's zoom looks up) leaves more of the way at the flash. During the push-in, `photoStep` gives the share of the remaining way for this frame from the push-in's curve, (1 - t / 1.2)³. So the camera reaches the photo's pose when the push-in ends, from any pose and at any frame rate. After that, the usual ease takes over, so a later refit (a resize, or the card's new height) still eases.

With Calm effects there is no push-in, but the card still waits 1.5 s. So the timed move applies to every catch that has the beat (`beat`), and the push-in only to `photo`.

## Check

`qa/fish/moments.e2e.mjs` Part D: a smallmouth jumps 11 m out, a trophy is landed while the zoom is still on, and from then on every frame takes 150 ms (the lake's clock runs at a third of the wall clock). At the flash, the fish's middle must be within 3% of the view's size from the middle of the free part. Then the card must come up beside the fish. At 390x844, 360x640 and 844x390.

`qa/fish/world.render.mjs` steps the world by hand. Its push-in check now waits 1.3 s of real time before it measures.
