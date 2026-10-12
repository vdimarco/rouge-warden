# Design

Use deterministic two-dimensional periodic gradient noise with quintic interpolation and two weighted octaves. CPU terrain foot placement and GPU ground displacement share the same formulas and seed. Shape Canopy into rounded hills, Redstone into eroded/terraced ridges, and Moonlit into broken stepped banks. Fade additional relief smoothly outside the river shoreline and leave navigable lane heights unchanged.

The existing six 64 m terrain instances per bank already bound memory. Give them explicit absolute chunk identities and recycle their prepared slots at forward boundaries. Schedule enough ahead to cover visible water and obstacles; retire behind-camera chunks. The vertex shader applies travel each frame, so instance matrices need uploads only when slots recycle. Keep all geometries/materials prepared, with no per-run growth or generation blocking.

Validate noise value/derivative seams and seed determinism, shared CPU/GPU samples, forward coverage and stable pool identity under normal motion and resets. Compare actual terrain and bank registration across all three maps on phone, desktop and landscape, preserve paused/reduced pixels, and measure existing draw/triangle/resource bounds. Browser plugin is unavailable; use the existing Playwright workflow.

## Implemented details

The periodic gradient field has a 64-cell period: 2,048 m across and 8,192 m along the river. Two weighted octaves use 8 small integer gradient hashes per sample with quintic interpolation. Added relief is bounded below 12 m and fades over the first 5 m outside the bank.

Six 64 m slots cover 384 m continuously, keeping 32–96 m behind and 288–352 m ahead of the raft. Two reusable CPU descriptors schedule upcoming sections. Stable absolute matrix translations are unchanged within a section; each crossing uploads only the changed 16-float matrix range per bank. The shader adds current travel, so forward motion needs no per-frame terrain matrix updates. Direct seeks and seed/stage resets reuse the same pools.

Fallback shoreline branches now cache the immutable map profile rather than using legacy numeric-seed terrain, matching the primary scene fields. No speed, action, score, coin contact or course-generation changes are included.

## Boundary correction from rendered QA

A same-origin framebuffer probe found 62–70 high-contrast pixels from a newly inserted far terrain slot at 288 m. Add a prepared 248–276 m opacity fade to the ground material and discard fully faded fragments before depth writes. Keep near terrain depth writes and a single pass for both bank batches, preserving tile occlusion and draw counts. Thus future chunks are fully hidden on insertion and become visible gradually as they approach. CPU height fields, active chunk count and collision rules are unchanged.
