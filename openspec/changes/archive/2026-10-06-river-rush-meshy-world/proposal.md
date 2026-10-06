# River Rush: Meshy world and connected water

## Why
The filmed river and projected scenery do not feel like a real place. Decorative bobbing does not connect the raft to the water.

## What Changes
Replace primary gameplay presentation with a genuine Three.js world, Meshy-generated textured raft and tropical bank models, continuous terrain, volumetric hazards, directional lighting and distance fog. Use a shared analytic wave field for water displacement and four-point raft buoyancy. Add steering wakes, obstacle foam and landing impulses while retaining the approved rider likeness and fast three-lane controls. Preserve a playable 2D fallback for unavailable WebGL.

## Impact
River Rush renderer, asset pipeline, physics presentation, browser verification and deployed static bundle. Collision, score, course and input timing remain deterministic and independent of cosmetic water physics.
