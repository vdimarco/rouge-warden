# Glass fresnel

Tower glass already mixes in the painted sky by a fixed amount, so a pane facing the camera looks the same as one seen along the avenue. Spider-Man 2's glass stays a window head-on and turns into the sky at a glance.

## What changes

On glassy towers, the sky mix follows a Schlick fresnel: a little sky when the pane faces the camera, and most of the sky when the view skims the glass, plus a small sun glint at that glance. Lit rooms stay lamps. Brick, stone, concrete, and loft walls gain a masonry joint that fades out once a course is smaller than a pixel. No new art.

## Capabilities

- `swing-glass-fresnel`: dark glass on glassy towers mirrors more of this game's sky as the view becomes grazing.
