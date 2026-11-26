# Tasks

- [x] Emit a north wall and the ground-storey side wall wherever the neighbour does not cover that storey
- [x] Turn back-face culling on and flip winding so outward faces, the runner, the skyline, and street props stay visible
- [x] Add a three-lot filler ring: dark walls, sparse amber windows, roof caps, no signs, no lights, not walkable
- [x] Yaw 90 and 270 at 390, seed 4, read 88% and 85% building pixels in the non-sky band above the street, with the street left out of the count. Synced draw at 390, seed 7, stayed under 35 ms at yaw 0, 90, 180, and 270
- [x] `qa/neon/stack.e2e.mjs` passes after the machine, the stronger pools, and the hood face
- [x] Shots at yaw 90, 180, and 270 at 390 and 1280 are attached to the pull request
