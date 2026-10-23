# Populated car and marker transfers

Reuse populated update ranges for model and fallback car matrix/color buffers and mission beam/ring matrix/color buffers. Initial allocations, instance counts, bounding spheres and visual output remain unchanged.

The focused browser fixture records actual WebGL bufferSubData bytes after allocations at 3,1,0,7,20,2 cars. Seven cars exercise four model slots and three fallback cars; zero batches request zero bytes. A same-frame reference retains full-capacity update policy to compare nonblank output. No FPS-benefit gate or affected Chrome acceptance claim.

All20 rubric dimensions retain historical context only, with no new points awarded. Composition, lighting, color, detail, texture, characters, environment, vehicles, animation, UI, controls, mission clarity, pacing, fun, difficulty, feedback, sound and variety receive no new acceptance scores. Responsiveness/input latency and performance stability remain unverified on the affected user Chrome; current total/delta withheld. No physical-device, listening or full-playthrough claim.

Review/CI/current deployed preview/rebase/production verification pending. OpenSpec CLI unavailable; scenarios checked manually.

The original fixture placed cars 0.2m apart (overlapping 4m vehicles), producing two differing components with max delta6. That failed comparison was retained. Spacing cars 3m apart and separating marker centers removes coincident surfaces: exact zero-component difference, no tolerance used. Corrected test passes9checks.
