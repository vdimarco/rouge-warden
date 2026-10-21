# Masonry unit colour

## Source

Adam Lake, Carl Marshall, Mark Harris, and Marc Blackstein, "Stylized Rendering Techniques for Scalable Real-Time 3D Animation", NPAR 2000. Their cel ramp shades the surface colour. It does not replace the surface with one flat tone. Nothing is taken from Spider-Man 2.

The course grid is the one this shader already draws. No second brick texture fit a three-band wall.

## Decisions

- The multiply sits on the wall albedo before `comicCelX`, so shade, mid, and lit still come from the same bands. The old weathering step is about four percent, which the ramp swallows. A unit step has to be wide enough to remain after that multiply.
- Brick and loft shift between a darker clay and a lighter one. Stone and concrete shift less, and stay in their own grey. The joint colour is mixed on after the tint, so the mortar stays the dark line.
- The top of a unit is lighter and the bottom, just above the joint, is darker. That lip uses the course `fwidth` and fades with the joint, so a distant course does not shimmer.
- A batch about 1.7 m wide and 1.15 m tall is a second, coarser tint. It fades only when that batch is itself smaller than a pixel. From the avenue a single brick is already gone, and the batch is still a patch of colour.
- The pier between window groups uses the same tint. A painted window tile is one flat brick up close, so its wall (not its glass) takes the batch only. The per-course lip stays on the procedural wall, where it lines up with the joint. Glass kinds are unchanged. The warm shade bounce from the street stays after this, on the shaded lower floors.
