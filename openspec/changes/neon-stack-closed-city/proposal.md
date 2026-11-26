# Close the Neon Stack block

Buildings read as hollow from the side and the back, and past the 6×6 block the frame is empty ground.

## Why

Issue 855. Walls were only emitted on some faces, back-face culling was off, and nothing stood outside the playable block.

## Scope

- Close every exposed face of a playable building, with a lit window on every face, and turn back-face culling on with winding that keeps those faces.
- Add a ring of dark filler buildings, three lots deep, outside the walkable grid. No signs and no lights.
- Keep three draw calls, at most 900 slices, and the existing stack checks.

## Out of scope

- A new draw call, a new image file, or a new dependency.
