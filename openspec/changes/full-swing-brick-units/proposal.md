# Masonry units keep their own colour

Brick, stone, and concrete walls are one cel colour with a joint line. A course is smaller than a pixel from the avenue, so the joint fades and the wall goes flat.

## What changes

Each masonry unit takes its own clay, stone, or panel tone, with a lighter top edge and a darker bottom edge. A coarser batch of those tones stays once a single course is too small to draw. Glass towers are left alone. The three cel bands still shade the colour.

## Capabilities

- `swing-brick-units`: a near brick face reads as separate units, and the avenue still shows batches of that colour.
