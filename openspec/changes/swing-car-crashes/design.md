# Design

## Collision shape

A car is 4.4 m long and 1.8 m wide. Two circles of radius 0.95 m, 1.25 m from the middle, cover it with rounded ends. Circle tests are cheap, need no rotation maths, and slide off each other well. The test runs once per frame after every car has stepped. It checks every pair within 6 m on each axis, among at most 8 cars.

The push-out is split in half between the two cars. When one half would go into a wall (`clear()`), the other car takes the full push, or neither moves. The velocity exchange uses equal masses and restitution 0.3. The result is written back as each car's forward `speed` and sideways `side`. The bicycle model then takes the slide away through its grip, so a hit car slides and settles.

## Street cars

Street cars live only in a vertex shader, so there is nothing to push. The driven car looks one half-length ahead of its nose (`nearTraffic`, 3.2 m reach). When it finds a street car, that car becomes a real car where the shader had it, at its lane speed. The next collision pass then handles the hit. Theft uses the same conversion, with the steal count and event turned off (`quiet`).

## Street cars as models

Swapping the traffic shader body for a 5,000-triangle model would multiply 1,800 instances by 5,000. Instead `actionview.js` picks the nearest 12 street cars within 60 m each frame and draws them in the model instance meshes (capacity: 8 cars + 12), at the place `trafficAt` gives. Their shader cars are veiled by a new instance attribute, `aHide`, which the vertex shader turns into a clipped vertex. The old way to hide a car sinks its lane 500 m down. That would make `nearTraffic` skip the car, so a veiled car could be neither stolen nor hit. A stolen car still sinks its lane. The picker skips sunken lanes, and it gives back any street car that leaves the nearest 12.

## Budget

Up to 20 models × 5,000 triangles, twice with the ink hull, is about 200,000 triangles in the worst case. The flat budget is 800,000 per view (`PERF.trisPerViewMax`), and `qa/vr/perf.mjs` checks it.
