# Tasks

- [x] Map side tilt and forward tilt onto the bat, with a 2.5° dead zone and a 16 ms pose filter.
- [x] Draw roll, pitch, perspective scale, and the gyro push toward the net.
- [x] Keep aim on the swing angle. Use the bat's x and depth for reach. Leave motion assist at 15%.
- [x] Add `__test.tilt(beta, gamma)` and `__test.bat`, and cover range, dead zone, and reach in `qa/pingpong/bat.test.mjs`.
- [x] Re-run `qa/pingpong` and the 1,000-point win rate. Screenshot the bat left, right, near, and far at 390x844.
- [x] Count 3, 2, 1 Ready before every serve, with a soft tick. Serve at 3.5 m/s with a short ease-in. Neighbour returns at 6 to 7 m/s. Keep the point-1 hook.
- [x] Replace the 16 ms pole with a power curve, a critically damped spring, and a 2 s drift. Shrink depth to a lean plus a bounce step. Hover the bat. Put the new constants on `BAT`.
- [x] Ink, grain, glow, a faced Neighbour, and the hit slash, drawn so the static layer stays one blit. Drop to 1.5x if the frame rate needs it.
- [x] Tests for the count-in, the serve speed, the spring, and the drift. Screenshots of the count, the slash, and the bat at the sides.
- [x] Paint the hall, Neighbour and bat from the sheets, with a code fallback, and keep the tests green.
