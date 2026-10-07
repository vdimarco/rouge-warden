# Tasks

The OpenSpec CLI is not installed here, so `openspec validate` has not run.

- [x] Check Meshy: the Higgsfield `image_to_3d` (Meshy) model is reachable, but the account has 0 credits. Not run.
- [x] Download the full SAM meshes for the three cars from their Higgsfield jobs, and render them beside the game models to find the jank (the cut to 1,200 to 1,900 triangles).
- [x] `higgsfield/models3d/pack-car.mjs`; pack the three cars at 5,000 triangles; compare renders; turn the hatchback 180 degrees to match.
- [x] `actionview.js`: turn quantized attributes into floats before the resize; a model on every drawn car; the 12 nearest street cars as models; `cityview.js` `veilTraffic` and `aHide`.
- [x] `cars.js`: two-circle collision with push-out and velocity exchange; the driven car turns a street car ahead into a real car (`struck`); `main.js` passes the traffic and veils struck cars.
- [x] Unit tests: a driven car pushes a parked car and never overlaps it; a street car is struck, becomes a real car and takes the hit (three runs in a row).
- [x] Version 1.19.0 (APK code 26); `pwa.mjs` passes.
- [ ] Browser suites: `perf`, `action.e2e`, `spider-world.e2e`, `street.e2e`, `render`.
- [ ] New Meshy models once the account has credits (about 90 for the three cars).
