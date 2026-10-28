# Glass fresnel

## Source

Christophe Schlick, "An Inexpensive BRDF Model for Physically-based Rendering", Computer Graphics Forum, 1994. The Fresnel term is `F0 + (1 - F0) (1 - N·V)^5`. Here F0 is not a physical glass index. The facing mix stays near the sky amount the towers already used, and the grazing mix rises toward the sky, so a pane down the avenue mirrors and a pane in front stays a window. The sky sample is the shader's existing `skyAt`. Nothing is taken from Spider-Man 2.

## Decisions

- Only `glassy` towers (kinds 0 and 1) take the term. The low path leaves `mirror` at 0, as it does now.
- Lit rooms stay the lamp colour. Dark glass, the flat blocks, the painted tiles, and the close interior all read the same `mirror` value.
- The added sky is the colour already mixed in. It is not a second reflection pass.
- Brick, stone, concrete, and loft walls get a darkened masonry joint on the albedo. No brick paper fit a three-band comic wall, so the joint is original. It fades out with `fwidth` once a course is smaller than a pixel, and glass towers are left plain.
