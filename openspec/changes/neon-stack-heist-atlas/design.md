# Design

The level is instanced quads in the existing WebGL2 renderer, one atlas texture, nearest filtering, and the integer blit already used for the art buffer. That is the usual way to draw a pixel-art sheet; the supplied atlas is the source, and no other technique fit the sheet better.

A 20% mix of magenta or cyan on a whole storey already counts as saturated neon, and six of those faces put the 390 frame over 2%. The wall wash is therefore not composited. Ground streaks stay the 1px dither at 35%, two tiles long. The sign glyphs, the amber windows, and the runner outline carry the neon.

The runner frame is drawn at the same pixel size as a 16px ground tile. The visible figure is about 26px of the 32px frame, about 1.6 tiles.
