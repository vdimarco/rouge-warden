# Tasks

- [x] Remove keyboard and click-to-swing from the desktop court.
- [x] Track the ball sideways, aim with cursor x within ±30 degrees, and set depth from cursor y.
- [x] Measure flicks over 60 ms with coalesced pointermove samples, normalised to a 1280 court, on the 1500, 3000, and 5500 bands. Keep the 350 ms cooldown and the ±120 ms window.
- [x] Treat a 20 degree upward bend as topspin and a downward bend as backspin.
- [x] Start on one click, hide the cursor for a small aim dot, and update the hint.
- [x] Cover the bands at 1280 and 2560, a slow move, and an opening point in `qa/pingpong/desktop.test.mjs`. Screenshot 1280 and 390.
- [x] The OpenSpec CLI is not installed here, so the change docs were checked by reading them.
- [x] Treat a browser without a coarse pointer and without touch as desktop, including pointer none with DeviceMotionEvent.
- [x] Switch the phone gate to the mouse on the first real mousemove.
- [x] Check that path in plain headless Chrome at 1280, not only the Playwright fine-pointer context.
