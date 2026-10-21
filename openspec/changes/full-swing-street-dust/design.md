# Street dust

## Source

Carsten Wenzel, "Real-Time Atmospheric Effects in Games" (SIGGRAPH 2006 course), the height split only. The 18 m layer is already that split. This round only changes the colour of level views through it, and thickens the layer one print step. The warm colour is this avenue's own low light (`vec3(0.78, 0.42, 0.26)`), not a port of another game's scattering. Nothing is taken from Spider-Man 2.

## Decisions

- `skyHaze` still samples the painted strip just above the horizon and pulls it toward violet. A view whose direction is nearly level then mixes most of the way to the warm dust (`0.78` of the way). Above about 12 degrees of elevation the mix is gone, so roofs and the dome stay the sky.
- The short layer's density goes from `0.012` and a `0.40` cap to `0.022` and `0.70`. Far down the avenue that crosses from the first print step into the second. Around 80 m it stays on the first step. The near kerb still starts past 28 m. `comicPoster` still snaps the amount to four steps.
- `gradeInk` now grades the surface colour, then the haze mixes on top ungraded. A warm dust pixel sits around luma 0.30 to 0.38, which is inside the grade's hold, so grading the composite would teal the dust and cancel the change. The sky dome still grades its own colour, with no haze on it.
- The same density and the same dust mix are copied into the short prop kit in `game.js`, so a person or a prop in that air matches the walls.
- No new pass. A headset still draws the scene shaders, which already sample this fog.
