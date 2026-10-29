# Street props

The named street view has lanes, trees, and lamps, and the sidewalks are still empty. Spider-Man 2's avenues read as furnished: bins, posts, and hydrants sit on the walk. This city has none of that furniture.

## What changes

Three instanced meshes add a bin, a bollard, and a hydrant on both sidewalks. Each spot keeps one of the three. They fade out past the near block so distant specks do not flicker, and spots past the fade are not sent to the GPU, so the city stays inside its triangle budget. No new art, no colliders, and no extra full-screen pass.

## Capabilities

- `swing-street-props`: sidewalks along the avenues carry bins, bollards, and hydrants in the existing comic shade.
