# The first web hangs from a building

Marvel's Spider-Man 2 (Insomniac, 2023) puts the web on a building and swings under it. A rope shorter than the distance to that building leaves the body outside the sphere, and the catch then skips the pull, so the body flies into the wall. The words and the city stay the ones already in this game. None of the grass, water, outline, or painted-look sources fit.

## Decisions

- The near point stays first (12 body-heights ahead, 14 up). When that point is the sky, the same farther points the held chain already uses are tried.
- A building is accepted only when the distance from the chest to the anchor is no longer than the ground clearance: anchor height, minus the chest, minus 1.5 body-heights above the ground. The rope length is that distance. The hero starts on the sphere.
- A sky rope keeps the 16 body-height cap. Over open water there is no building to hang from, so the web stays in the sky.
- `keepClear` does not pull a building rope back down to 16 body-heights. It still shortens a rope whose arc would put the feet under the line.
