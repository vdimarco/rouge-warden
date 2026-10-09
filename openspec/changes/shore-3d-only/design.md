# Design

Use Shore's current greens, warm earth and golden-hour light. Roads cross rolling ground so relief is visible near the hero. Preserve mirrored geometry, planar gameplay, structure footprints and level bridge approaches. Extract map and overlay helpers from the former illustrated renderer so 3D startup does not download its sprite atlas or creature renderer.

Startup checks WebGL2, loads 3D models, and exposes failure beside the disabled Play button. Existing 2D URLs and stored settings have no effect. Context loss interrupts play until the 3D view returns, without changing renderer.

Verify mesh/CPU sampling, pointer intersections, mirrored relief, dry lane elevation variation and crossing heights. Browser checks cover legacy 2D settings, ordinary entry, 3D failure, movement, maps and skills at desktop and phone sizes.
