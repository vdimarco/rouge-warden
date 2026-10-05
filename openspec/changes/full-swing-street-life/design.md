# Design

## Street people (js/street.js, js/streetview.js)

- `street.js` is pure (no three, no DOM), like `city.js`, so Node tests it. It builds the sidewalk network from
  `city.streets` with the same street model as `cityview.js` (the full lines, the partial avenues, the sidewalk width
  3/4/5 m by street width, the promenade at z = 272). A sidewalk is one strip along one side of one street. Corners are
  where two strips meet at a crossing street.
- A person walks along one strip at its centre line (an offset from the kerb), in one direction. At the end of a block it
  either crosses the street ahead on the zebra (walk light permitting), turns on to the crossing street's strip, or turns
  back. Positions outside every sidewalk (building lots, parks, plazas, the Needle plaza, the Dome) are refused at spawn.
- The pool is fixed at 160. In a headset `street.limit` is 110, and the extra people go back to the pool. A person further than 150 m from the focus goes back to the pool. Free slots
  spawn on random sidewalk points 35 to 140 m from the focus, so people do not pop in at the camera.
- States: `walk`, `wait` (a red light), `idle` (window, phone or talk), `cheer`, `flee`, `look`, `aside`. Each has a timer.
  Reactions come from `notify(event)`: `land` with the hero's position and down speed, and each frame from the hero's
  position and velocity for the low pass and the walk-into.
- The walk light: `walkOn(axis, t)`, where axis is the axis of the road being crossed. The crossings over north-south roads
  and the crossings over east-west roads take turns, 14 s each.
- Signs: `street.signs`, made once from `city.buildings`. For the ground tier of each building in the sign districts or on
  an avenue, every face that looks on to a street (the street edge plus sidewalk is within 1 m of the face) gets a board
  every 8 to 14 m and a blade sign every 18 to 30 m. A blade sign is checked against the colliders so it never sticks into
  another building.
- `streetview.js` draws all people in one `InstancedMesh` plus its ink hull (2 draws). The figure is built in code: torso,
  head, two legs, two arms; a part id per vertex. The vertex shader poses each part from per-instance data (position, yaw,
  walk phase, stride, pose code, pose time) so the CPU writes 3 vec4 per person per frame. Colours are per instance. The
  look is the city's cel bands and ink, with a simple distance haze.
- To keep flat play under the 800k triangle budget (qa/vr/perf.mjs), only people within 110 m of the camera are copied in,
  and only signs within 320 m of the camera go to the GPU. The sign list is rebuilt after 30 m of camera travel, and a sign
  shrinks away from 240 to 290 m so none pops at the edge.
- Signs draw as one instanced box mesh with an emissive shader (neon colour, a bright inner stroke pattern, a flicker from
  time and seed). Colours go over 1.0 so the bloom pass picks them out.

## Bloom (js/bloom.js)

- No post-processing add-ons ship with the game, so `bloom.js` is a small pass of its own: the scene renders to a
  half-float target (4x MSAA where WebGL2 has it), a bright pass keeps what is over a threshold at half size, a chain of
  four down-sampled blurs spreads it, and one full-screen draw adds it back over the scene on the canvas.
- Low and High set the strength and the threshold. Off renders straight to the canvas, so nothing changes from before.
- Flat play only: XR always renders straight. Shots and pixel reads go through the same path, so tests see what the
  player sees.

## The dive (js/hero.js)

- A new weight `S.dive` eases to 1 when: in the air, no rope attached, not on a wall, `vel.y < -8`, and time to the ground
  below (`P.city.topBelow`, else the street) over 1 s at the current fall speed. It eases to 0 fast (rate 16) when any of
  these fail, so the hero is upright for the landing.
- The tilt: the body's up axis goes to the flight direction, mixed with a little of the facing direction so a straight
  drop pitches forward through face-down (never a roll through the side). The same slerp as the swing lean carries it.
- The pose layers over the fall: arms from a wide swan spread to tucked along the hips as speed goes from 10 to 30 m/s, legs
  straight and together, toes pointed, a slight arch, the head up in the body frame (looking along the dive).
- `H.pose` names it "dive"; `H.info().weights.dive` shows the weight.

## Crowd sound (js/audio.js)

- A murmur bed: pink noise through two band-pass filters (babble formants), with a fast random amplitude wobble. Its level
  follows `setCrowd(v)`, where main passes the number of people within 25 m (0 at 0, 1 at 12 or more) times the street-level
  factor the city bed already uses.
- `cheer` and `gasp` one-shots, placed at the reacting people's centre.

## Settings

- `settings.bloom`: "off" | "low" | "high". The default comes from the input at the first flat play when the save has none.
