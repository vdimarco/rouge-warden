# Design

The level is instanced quads in the existing WebGL2 renderer, one atlas texture, nearest filtering, and the integer blit already used for the art buffer. That is the usual way to draw a pixel-art sheet; the supplied atlas is the source, and no other technique fit the sheet better.

Wall colour is one flat step per tile: 40% on the sign's own tile, then 30%, 20%, and 10% down that column. Ground streaks stay the 1px dither at 35%, two tiles long.

The runner frame is drawn at the same pixel size as a 16px ground tile. The visible figure is about 26px of the 32px frame, about 1.6 tiles.
