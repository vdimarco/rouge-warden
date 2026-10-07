# Procedural downhill river

The river is now a wider, seeded downhill course rather than a level strip. A
pulled-back chase camera makes the raft smaller in the surrounding landscape.
Continuous centerline bends, changing channel width, and smooth chute drops
drive the water, terrain, scenery and hazards together. The character still
faces downstream, paddles continuously, and has a separate near-prone duck.

Water has directional foam, broken standing crests, shallow bank turbulence,
wet shoal boulders and downstream eddies. The raft samples the same wave field
and bed elevation as the displaced mesh, with stronger heave, pitch and spray
inside rapids. Rendering samples continuous time; it does not swap video frames.
Logical lanes and collision/action timing retain the existing fast response.

The course uses bounded arithmetic and deterministic smooth noise. Drop
amplitudes telescope across 130-unit cells, avoiding an accumulated history.
Foam advects downstream at a constant rate so a changing rapid envelope cannot
reverse its movement late in a run. Bank shapes sample absolute distance and
meet across terrain tiles. Scenery has seeded spacing, asymmetric landmarks,
varied scale and rotation. The approved fal textures, models and valley art
are reused locally; this update does not depend on new remote asset downloads.

Width is bounded between 21.2 and 44.2 scene units, compared with the former
19-unit corridor. Decorative boulders retain clearance outside the playable
lanes even after their rotation and irregular shape are considered. Geometry
and instancing remain bounded. Native rendering retains a 300,000-triangle
budget; software rendering uses fewer distant props and a 125,000-triangle
budget. Both retain a 65-draw-call budget. These bounds and software browser
checks do not establish a frame rate on a physical phone or GPU.

Verification:

- `npm test --prefix games/river-rush`: course continuity, descent, variation,
  gradients, boulder clearance, 30/60/120 Hz float stability and existing play.
- `node qa/river-rush/rapids.mjs`: actual pool, chute, bend and narrow sections
  in both render paths and three screen layouts, projected lane/character
  visibility, pause pixels and geometry budgets.
- `node qa/river-rush/world-direction.mjs`: all three scenery districts,
  full/lite models, reduced-motion pixels and shader errors.
- `node qa/river-rush/scene3d.mjs`: real keyboard and touch controls, jumping,
  ducking, pause, reduced motion, asset retries, missing assets and WebGL loss.
- `FULL_DETAIL=1 node qa/river-rush/temple-rig.mjs`: continuous skeletal paddle
  samples, hand registration, steering reversal and distinct duck anatomy.

`SOURCE_URL` selects the Vite source server for the scenery/course harnesses.
`ARCADE_URL` selects the built or deployed arcade for the actual-play checks.
`procedural-rapids-verification.json` records the checked build and deployment.
