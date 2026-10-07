# Design

## Traffic on the CPU

The street cars move in `CAR_VS` (cityview.js) from per-instance attributes: `aLane` (start x, y, z, heading) and
`aMove` (lane length, speed, phase). The car's middle at time t is `aLane.xyz + f * mod(phase + speed * t, length)`,
where f is the heading's unit vector. The attribute arrays already live on the CPU (they are written there before upload),
so no second traffic list is needed:

- cityview.js exposes `traffic()` (the live `aLane`, `aMove` and `aColor` arrays and the count) and `hideTraffic(i, on)`.
  It is a small block next to the traffic build and does not touch the facade or window code.
- cars.js gets pure functions: `trafficAt(T, i, t)` mirrors the shader (GLSL `mod`, the heading table) and returns the
  car's place, yaw, speed and colour; `nearTraffic(T, x, z, t, reach)` finds the closest street car within reach of the
  hero. It skips expressway lanes (y above 1), hidden cars and cars in the shrink zone at the ends of a lane (8 m). The
  time is `G.time`, the same value the shader gets as `uTime` in that frame.

Alternative rejected: a separate CPU traffic simulation feeding the shader. It would change how the city's 1,800 cars draw
and would need the shader rewritten; the mirror needs no change to the shader.

## Hiding a stolen car

`hideTraffic(i, true)` stores the lane's y and writes y = -500 into `aLane`, with an update range of one float. The car
still runs its lane, far under the ground, so the instance count and draw calls do not change. `hideTraffic(i, false)` puts
y back. The ink twin shares the geometry, so it hides too. `nearTraffic` skips the hidden car (its y is not 0).

## The stolen car

`cars.steal({ x, z, yaw, paint, traffic })` takes a free car slot (or the farthest car the hero does not drive), puts it
at the traffic car's place and heading with its colour, stopped, and marks it with the traffic slot. main.js then gets in
with the usual `enterCar`. A stolen car stays out to 400 m (parked cars 170 m). When its slot is freed (far away or reused)
cars.js emits `{ type: "release", traffic }` and main.js shows the traffic car again. The models in actionview.js draw it
like any car, so no draw call is added.

## The driver

street.js gets `bail(x, z, awayX, awayZ, axis)`: a person from the pool (a free one, else the farthest) appears at the driver's
door, runs (state "bail", the flee pose) to the nearest sidewalk of the car's street (axis: the way the car drove), then flees along it away from the hero and walks on.
streetview.js already draws every pooled person, so the driver is one more figure in the same draw. main.js plays the crowd
gasp there and, for 2.4 s, projects the driver's head to the screen; actionhud.js draws a comic speech bubble there, "HEY!"
and then "MY CAR!". The 3D comic words (fx.js) come from a fixed sticker atlas with no such words, so a DOM bubble is used.

## Input and prompt

The car key works as before; when the hero is not in a car it takes the closer of the parked car (`cars.near`) and the
traffic car (`nearTraffic`). A press with nothing in reach is kept for 0.35 s. Stealing is allowed on the ground or up to
3 m above it with no wall run (ropes are let go by `enterCar`). The prompt reads STEAL for a traffic car and GET IN for a
parked one; the phone CAR button shows for both.

## Checks

- Node (qa/vr/action.test.mjs): `trafficAt` matches the shader formula for every heading and wraps like GLSL `mod`;
  `nearTraffic` finds a car beside the hero and skips hidden and expressway cars; `steal` makes a stopped, driven car in the
  traffic colour; a stolen car outlives the parked range and its release event fires; `bail` puts a fleeing person on a
  sidewalk.
- Browser (qa/vr/action.e2e.mjs): beside a street car the prompt says STEAL; R puts the hero in a car tied to that traffic
  slot; the slot is hidden; a person is bailing; W drives; R gets out and the car stays.
- Performance (qa/vr/perf.mjs): flat play stays under 800k triangles and 120 draw calls.
