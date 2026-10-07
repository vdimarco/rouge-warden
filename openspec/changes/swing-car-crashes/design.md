# Design

## Collision shape

A car is 4.4 m long and 1.8 m wide. Two circles of radius 0.95 m, 1.25 m from the middle, cover it with rounded ends. Circle tests are cheap, need no rotation maths, and slide off each other well. The test runs once per frame after every car has stepped. It checks every pair within 6 m on each axis, among at most 8 cars.

The push-out is split in half between the two cars. When one half would go into a wall (`clear()`), the other car takes the full push, or neither moves. The velocity exchange uses equal masses and restitution 0.3. The result is written back as each car's forward `speed` and sideways `side`. The bicycle model then takes the slide away through its grip, so a hit car slides and settles.

## Street cars

Street cars live only in a vertex shader, so there is nothing to push. The driven car looks one half-length ahead of its nose (`nearTraffic`, 3.2 m reach). When it finds a street car, that car becomes a real car where the shader had it, at its lane speed. The next collision pass then handles the hit. Theft uses the same conversion, with the steal count and event turned off (`quiet`).

## Street cars as models

Swapping the traffic shader body for a model would multiply 1,800 instances by 2,500 triangles. Instead `actionview.js` gives 4 model places each frame to the cars nearest the camera. Parked cars, job cars and street cars within 40 m compete for them by distance, and the driven car always has one. A street car that gets a place is drawn in the model instance meshes (capacity: the parked cars + 4), at the place `trafficAt` gives. Their shader cars are veiled by a new instance attribute, `aHide`, which the vertex shader turns into a clipped vertex. The old way to hide a car sinks its lane 500 m down. That would make `nearTraffic` skip the car, so a veiled car could be neither stolen nor hit. A stolen car still sinks its lane. The picker skips sunken lanes, and it gives back any street car that loses its place.

## Budget

The flat budget is 800,000 triangles per view (`PERF.trisPerViewMax`), and `qa/vr/perf.mjs` checks it. Main used 759,000 to 790,000 in its flat-play shots, so the cars had about 10,000 triangles to spend. The first try (5,000-triangle models on 8 parked cars and 12 street cars) went 85,000 over. Three changes bring it in:

- Each body is packed at 2,500 triangles. Renders at 1,500 and 2,000 broke the van's panels into shards; 2,500 keeps the wheels round.
- The ink outline is drawn from its own hull, `<car>-ink.glb`: 600 triangles of positions only (`pack-car.mjs` with texture size 0). A black back-face hull shows only at the edge, so the coarse shape does not show. `outlineOf` (`comic.js`) takes the hull as `geometry`.
- Each model mesh, and its ink, has a bounding sphere round its instances, set every frame, so a view that does not look at the cars skips them. Before, `frustumCulled` was off.

The worst case is now 4 × (2,500 + 600) = 12,400 triangles. The perf shots that look at the cars (harbour, aerial) measure about 798,000.
