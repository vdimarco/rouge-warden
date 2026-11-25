# Design

The level is instanced quads in the existing WebGL2 renderer, one atlas texture, nearest filtering, and the integer blit already used for the art buffer. That is the usual way to draw a pixel-art sheet; the supplied atlas is the source, and no other technique fit the sheet better.

Signs are full 32×48 quads on the south faces, facing the camera. Each one tints the street within two tiles and colours the puddle under it. The runner outline is a 2px sample clamped to its own frame, and only while a lit sign is within about two tiles. Windows, the terminal, and the exit stay lit when the signs go off. A storey-wide 20% wall wash still counts as saturated neon, so that wash stays off.

The runner frame is drawn at the same pixel size as a 16px ground tile. The visible figure is about 26px of the 32px frame, about 1.6 tiles.
