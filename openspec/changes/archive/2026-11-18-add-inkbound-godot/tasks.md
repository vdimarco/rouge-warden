## Tasks

- [x] Import the standalone project, baked runtime assets, and regeneration scripts.
- [x] Document Godot 4.6 launch and source paths.
- [x] Verify startup, movement, combat, and progression from the imported path.
- [x] Validate the OpenSpec change and archive it.

Verification used Godot 4.6.3 on Linux. A clean editor import and an uncached headless launch passed. Fixed-timestep checks covered floor contact, double jumps, the dash buffer and jump cancel, chained strikes, and progression to the final gate. Desktop renders were inspected at 1280 × 720 and 1920 × 1080.
