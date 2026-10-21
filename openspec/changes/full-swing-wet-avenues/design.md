# Wet avenues

## Source

Sébastien Lagarde, "Water drop 2: Lighting and shading of wet surfaces" (2013, seblagarde.wordpress.com). A porous surface darkens when wet, and its fresnel reflectance goes up, so a grazing view mirrors the environment. The long streak down an avenue is the same idea as an anisotropic highlight: the micro-normal is rippled across the view and left smooth along it, so the glint runs away from the camera. Spider-Man 2 is the look this is judged against. Nothing is copied from it. The environment in the mirror is this game's sky strip (`art/sky.webp`), read with `textureLod` so the lookup does not depend on derivatives inside a branch.

## Decisions

- The wet term is applied after the cel bands and the print dots, and before the ink mix, so the comic print stays and the lines stay black.
- Lane paint is detected by luma and mostly skips the darkening, so the cream dashes stay readable.
- Sidewalks, parks, plazas, the boardwalk, and boulevard medians set the wet weight to 0. Alleys use 0.4. Streets and the expressway deck use 1.
- Puddles are a world-space value noise, fixed in the world, so the pattern does not swim in stereo.
- One ground shader and the landmark shader share `wetAsphalt`. No extra draw, no extra target.
