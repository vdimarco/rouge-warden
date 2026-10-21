# Street props

## Source

None of the city-dressing papers fit a three-band comic street. The shapes are original boxes and low cylinders on the instanced prop draw already in `cityview.js`. Placement follows the lamp runs in that file: both sidewalks, clear of parks, carriageways, the Needle plaza, and the Dome.

## Decisions

- One extra draw. The bin, bollard, and hydrant share a mesh. The instance hash picks a kind. The vertex shader scales the other kinds to nothing, and the fragment shader discards them so a collapsed part cannot leave a speck.
- The lamp distance shrink stays on the lamp pole and head only. A curb part does not use it.
- Furniture sits further onto the walk than the lamp pole, and it is visual only. People may overlap it.
- Props fade between 70 m and 110 m. Past that they are not drawn.
- Colours stay in the comic inks: a dark green bin, a dark bollard with a pale band, a red hydrant. They go through the existing `comicCel`.
