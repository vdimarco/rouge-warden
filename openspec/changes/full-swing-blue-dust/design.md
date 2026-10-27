# Blue-hour dust

## Source

James Gurney, Color and Light (2010). The air takes the colour of the sky at that hour. The height split is the one already in the street layer, from Carsten Wenzel, SIGGRAPH 2006, the height only. Nothing is taken from Spider-Man 2.

## Decisions

- The dust colour mixes from the sunset rose (0.78, 0.42, 0.26) toward a violet (0.28, 0.20, 0.68) with `uDay`. The mix itself goes from 0.78 at sunset to 0.92 at blue hour. Sunset, which is day 0, is unchanged.
- Only the level air takes the dust. Looking up still reads the painted strip.
- The stone courses and the grade are left as they are. The dust is the haze colour, mixed after the surfaces.
- Both ends stay lighter than the ink line.
