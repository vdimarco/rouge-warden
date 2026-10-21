# Palette grade

## Source

James Gurney, Color and Light (Andrews McMeel, 2010). A shadow is its own hue, not a darker copy of the lit colour, and the half-step is not the average of the two. Nothing is taken from Spider-Man 2.

## Decisions

- The grade sits on the colour after the cel bands and the haze. Streets go through `fogMix`. Walls, trees, and cars composite the vertex haze and then take the same grade. It is not a full-screen pass. A headset still draws the same meshes.
- Cool colour (low luma) moves toward teal: less blue, a little more green. The step up from that moves toward rose: more red, less green. Past a bright lamp or the sun, the grade fades off, so windows and the sun disc stay.
- Near-black ink is left alone.
- The sky dome uses the same grade after the painted strip and the flat zenith. `skyColorAt` still returns the strip, so the sun, the dusk violet, and the zenith checks keep reading the painting.
- `comic.js` and the default `toonify` ramp are unchanged. The lit-sphere check still sees the stock cel.
