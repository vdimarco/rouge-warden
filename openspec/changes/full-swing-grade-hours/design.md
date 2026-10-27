# Grade hours

## Source

James Gurney, Color and Light (Andrews McMeel, 2010). A shadow takes the colour of the sky, not a darker copy of the lit colour. The light takes the colour of the hour. The step between them is not their average. Nothing is taken from Spider-Man 2.

## Decisions

- The grade still sits on the colour after the cel bands. The dark end of the shade (low luma) goes violet. Open shade stays the teal from the earlier grade. The value step stays rose. A sunlit face mixes that step toward amber. Past a bright lamp or the sun disc, the grade still fades off.
- `uDay` is 0 at the painted sunset and 1 at blue hour. At blue hour the violet boundary moves up through the teal, and the amber leaves, so the sun step is rose again. Play advances it on a four-minute turn (blue hour at two minutes, sunset again at four). Title shots and the render check leave it at 0. `setDay` pins a still.
- A pixel whose brightest channel was above the ink line is lifted back to that line if the grade would have put it under. The canyon's ink share has to stay under 35%.
- The sky dome uses the same grade. The sunset side of the dome is the sun argument, the dusk side is the shadow argument. `skyColorAt` still returns the strip.
- `comic.js` and the default `toonify` ramp are unchanged.
