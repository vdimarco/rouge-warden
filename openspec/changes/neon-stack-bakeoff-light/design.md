# Design

## Light on the asphalt

The ground shader already tints a tile from the sign uniforms. This pass keeps that one sample of the atlas and, inside the same light loop, picks the nearest live sign instead of adding the colours together. A chebyshev pool reaches about two tiles. A narrow streak runs south from each light, scaled by the asphalt texel that was already read, so a wet reflection does not add a texture fetch or a draw.

No screened-space reflection paper fit. A second pass or a blur would break the three-draw budget. The streak is the anisotropic term of the pool that was already here.

## Faces, shadow, skyline

Walls take three lot hues (maroon, green, slate) at the luminance of the concrete faces: roof `#4A4852`, street face `#2B2A33`, side face `#1A1A22`. A one-pixel lip uses the quad coordinate, not a new texture. The bottom storey is multiplied by 0.80. Contact darkening, a one-tile cast along the sun, and ovals under the runner and the street props are computed in that ground block before the sign colour is mixed, so the pool draws over the shadow.

The skyline card follows 0.70 of the camera's move from the spawn view, so it slides at 0.30 relative to the block. Distance along the street fades geometry up to 30% toward `#1A1A22`.

## What stays short

Cross and arrow stand on the lots in front of noodle and bar. Those two lots stay one storey. A three-storey front covers the plate behind it, and both plates have to stay on the lower floors. Noodle and bar are centred at 1.42 tiles so their bottoms clear the near plates.
