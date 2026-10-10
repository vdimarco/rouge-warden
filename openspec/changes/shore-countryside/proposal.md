# Shore: varied countryside in 3D

## Why
The player chose "More varied ground" and sent a video of a three.js landscape: vineyard rows on brown soil, tall
cypress trees along tracks, open meadows with lone round trees, grey rock outcrops, and a stream bed with boulders.
The Shore 3D map is a nearly continuous canopy of round trees over grass, so most ground looks the same.

## What changes
- A seeded, mirrored land-use layout on open ground (`makeLandUse` in `scenery.js`): vineyards, meadows, cypress lines
  and groups, rock outcrops and stream rocks.
- The 3D ground shader takes a second soft mask: tilled soil under the vines, lusher meadow grass, heath round the rocks.
- New 3D scenery: vine rows, a cypress tree built in code, pale limestone rocks for outcrops and the stream bed.
- Scenery trees leave the vineyards and outcrops open and stand thinner in the meadows.

Visual only. Collision, sight, lanes, objectives and the river are unchanged.

## Capabilities
- Modify `shore-terrain`: varied land use on open ground.
