# Tasks

- [x] Map side tilt and forward tilt onto the bat, with a 2.5° dead zone and a 16 ms pose filter.
- [x] Draw roll, pitch, perspective scale, and the gyro push toward the net.
- [x] Keep aim on the swing angle. Use the bat's x and depth for reach. Leave motion assist at 15%.
- [x] Add `__test.tilt(beta, gamma)` and `__test.bat`, and cover range, dead zone, and reach in `qa/pingpong/bat.test.mjs`.
- [x] Re-run `qa/pingpong` and the 1,000-point win rate. Screenshot the bat left, right, near, and far at 390x844.
