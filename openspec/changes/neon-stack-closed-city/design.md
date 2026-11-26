# Closed boxes and a filler ring

## Decisions

- A face is emitted only where the neighbour is shorter or missing, one quad per storey on playable lots and one quad for the whole exposed run on filler. Filler storeys are not separate slices.
- Orient 2 faces +Z when `hx` is positive. Orient 1 faces -X. East and north walls, and billboards whose camera is on the back side, negate `hx` and swap U so the front face points outward. Culling stays on. This is the triangle strip already in `render.mjs`; no outside technique was adapted.
- Filler walls use kind 8 and a negative sign. The wall pass paints them `#2B2A33` with a sparse `#C9853A` window band, then returns. Roofs stay on the existing roof pass.
- The south end of the street stays one or two storeys so the spawn view still sees the signs. East, west, and north filler are tall enough that a sideways or backward look is buildings rather than the clear colour.
- Filler is not added to `buildings` or `blocked`. Tiles outside the 6×6 grid were already solid.

## Budget

Playable faces add a few dozen slices. The ring is one quad per exposed face plus a roof, about 550 slices in total, under 900. The filler path does not add a draw.
