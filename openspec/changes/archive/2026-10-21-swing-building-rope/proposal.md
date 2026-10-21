## Why

The first web over the roofs is the sky. A building farther than 16 body-heights was a short rope, and the hero flew past it into the wall. Spider-Man 2 swings from the building.

## What changes

- The first easy web takes a building the hero can hang under, looking farther along the swing when the near point is empty.
- That rope is the real distance to the building. The feet still stay 1.5 body-heights up. A sky rope stays at most 16 body-heights.
- A building the arc cannot clear is not the web. Over open water the web stays in the sky.

## Capabilities

### Modified Capabilities

- `swing-moves`: the first easy web can be a building, and that rope is the real distance.

## Impact

`public/vr/js/physics.js` (`attach`, `keepClear`), `public/vr/js/main.js` (`playerEasy`, `chainAim`), `qa/vr/holdchain.e2e.mjs`.
