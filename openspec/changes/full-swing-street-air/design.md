# Street air

## Source

The height integral is already in `fogAmount`. A second scale height is the split in Carsten Wenzel, "Real-Time Atmospheric Effects in Games" (SIGGRAPH 2006 course): denser air near the ground, thinner air above. This takes only that split. It does not port the scattering shader. The colour is still this game's `skyHaze`, and `comicPoster` still snaps the amount to four steps.

## Decisions

- Scale height 18 m, against the 110 m layer already in the uniform. The short layer starts past 28 m so the near kerb stays sharp, and it is capped so it fills the first print step in the avenue without climbing to the next one on the roofs.
- The same integral is copied into the short prop kit in `game.js`, so a coin or a prop in that air matches the walls.
- No new pass. A headset still draws the scene shaders, which already sample this fog.
