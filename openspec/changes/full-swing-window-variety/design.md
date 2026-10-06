# Design: window variety

## Where

All in `FACADE_FS` in `public/vr/js/cityview.js`, inside `wallColor`. The vertex attributes stay as they are (`aInfo`
gives the seed, floor height and bay; `aFace` gives u, face width, salt and tier top), so no geometry or upload change.

## Window family

`familyOf(style, hash)` picks one of seven families per building. The style limits the choice:

| style | families |
| --- | --- |
| glass, gold | painted, curtain wall, ribbon, pair |
| brick | painted, tall, punched, pair, grid |
| stone | painted, tall, pair, punched |
| concrete | painted, ribbon, punched, pair |
| loft | painted, grid, tall, ribbon |
| condo | painted, ribbon, tall, curtain wall |

About 30 % keep the painted family, so the art stays in the city.

Each family gives a window rectangle `wr` in the window's own cell, glazing bars `mun` (columns, rows) and a cell count
`sub` (2 for pairs: the cell is split in two and each half has a window). Sizes come from three more seed hashes.
Ribbon and curtain wall use the full cell width (no piers, no window groups) so the glass runs across the face.

## Shapes

`shape` is 0 (box), 1 (arched head: a half circle as wide as the window on top of the box) or 2 (round). The rounded cut
is a distance in metres (`dR`); box edges keep the existing per-axis smoothstep and per-axis fade, so a far facade still
fades each axis to its average (`det2`), and the rounded cut fades to its area fraction (`roundAvg`).

## Up close

The painted family draws the atlas tile as before. The other families sample only the window part of a borrowed tile
(office glass, gold glass, the brick sash, the loft grid or the ribbon), remapped into their own rectangle, with the
texture gradients scaled to match. The wall around them is the flat wall paint with procedural joints: brick courses
with staggered head joints, stone blocks, or concrete panel joints, all in face metres with `stripe()`, which fades
where it would shimmer.

## Frames, bars and trims

The non-painted families draw a frame (0.07 to 0.14 m) in one of eight paints, then an ink line just outside it. The
frame and ink are differences of expanded boxes, so they fade to their average. Glazing bars are `stripe()` lines in
the window; for ribbon and curtain walls they run in face-cell coordinates, so the bar on a cell edge is one continuous
line. Homes get sills, lintels (box heads only) and, on some buildings with room for them, shutters with louvres.

## Top floor and cornice

The top full floor row of a face (`lastRow`) on homes of three floors or more can switch to an arched tall window, a
round window or a small attic window. A cornice with dentils and an ink line sits under the top of some home walls.

## Light and glass

Lit rooms keep the existing room tints. A per-building pattern scales the lit chance by floor, by column or by 3 x 2
blocks of rooms; the average stays the building's own, so the far look keeps its tone. Pairs light each half on its own.
The dark glass takes one of five tints, in the flat look and on the painted tile (shifted the same way as the wall paint).

## Cost

No new texture fetch per pixel (still one `tileSample` up close), a few more hashes and smoothsteps. The LOW define
skips joints, sills, shutters and the shades as before; frames, bars, families, tints and light patterns stay.
