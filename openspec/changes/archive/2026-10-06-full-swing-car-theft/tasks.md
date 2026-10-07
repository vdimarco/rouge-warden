# Tasks

- [x] cityview.js: expose the traffic arrays and hide or show one street car (small block, apart from the facade code)
- [x] cars.js: `trafficAt` and `nearTraffic` (the shader's formula in JS), `steal`, the stolen car's longer range and release event
- [x] street.js: `bail`, a driver who runs to the sidewalk and flees
- [x] main.js: the car key steals the closest traffic car, the press buffer, the STEAL prompt, the driver's shout, release, test hooks
- [x] actionhud.js: the driver's speech bubble
- [x] Node checks in qa/vr/action.test.mjs
- [x] Browser check in qa/vr/action.e2e.mjs, with a screenshot of the steal
- [x] Run qa/vr/perf.mjs: under 800k triangles and 120 draw calls
- [x] Validate with the OpenSpec CLI
- [x] Recorded device limits, not checked in a cloud session: a real phone (the CAR button), a pad (B), sound by ear; the 0.35 s press buffer and the airborne steal are covered by code review only, not by a browser check
