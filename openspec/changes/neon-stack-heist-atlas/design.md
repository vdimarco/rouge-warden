# Design

The level is instanced quads in the existing WebGL2 renderer, one atlas texture, nearest filtering, and the integer blit already used for the art buffer. That is the usual way to draw a pixel-art sheet; the supplied atlas is the source, and no other technique fit the sheet better.

Signs are full 32×48 quads on the south faces the spawn camera sees. A building between a sign and the camera is kept at most 2 storeys. Street light is additive on the ground only, one pool per sign, and the two alley lights sit on different tiles. The runner outline is one atlas texel thick and turns on inside 2 tiles of a lit sign. Movement is in the camera's ground plane.

The runner frame is drawn at the same pixel size as a 16px ground tile. The visible figure is about 26px of the 32px frame, about 1.6 tiles.
