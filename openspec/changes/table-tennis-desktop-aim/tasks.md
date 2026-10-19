# Tasks

- [x] Remove keyboard and click-to-swing from the desktop court.
- [x] Track the ball sideways, aim with cursor x within ±30 degrees, and set depth from cursor y.
- [x] Measure flicks over 60 ms with coalesced pointermove samples, in window widths per second: push 1.2 to 2.3, drive to 4.3, smash above 4.3. The bands match at 1280 and 2560. Keep the 350 ms cooldown and the ±120 ms window.
- [x] Treat a 20 degree upward bend as topspin and a downward bend as backspin.
- [x] Start on one click, hide the cursor for a small aim dot, and update the hint.
- [x] Cover the bands at 1280 and 2560, a slow move, and an opening point in `qa/pingpong/desktop.test.mjs`. Screenshot 1280 and 390.
- [x] The OpenSpec CLI is not installed here, so the change docs were checked by reading them.
- [x] Treat a browser without a coarse pointer and without touch as desktop, including pointer none with DeviceMotionEvent.
- [x] Switch the phone gate to the mouse on the first real mousemove.
- [x] Check that path in plain headless Chrome at 1280, not only the Playwright fine-pointer context.
- [x] Select mouse mode for a fine pointer, including when touch points are also reported, and on the first real mousemove. After start at 1280, `__test.state().inputMode` is `mouse`.
- [x] Let the opening hook help only a flick of at least 1.2 window widths per second inside ±200 ms. A speed-0 miss 383 ms early, or no flick, loses or replays.
