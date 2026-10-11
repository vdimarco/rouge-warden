# Shore of the Ancients: winding forest roads

The player said: "Can we make the map a little bit more varied? Right now the roads are a bit too straight. Let's make them
more procedural and level up the aesthetics."

## Problem
- Each lane is one smooth spline through four knots per half. The side lanes read as two halves of one big circle. The
  tightest bend on a side lane had a radius of about 2500 units.
- The painted road was one flat strip of dirt texture with a faint border. It had no ruts, no stones and no worn edges.

## Scope
- The lane roads wind. A seeded meander pushes each lane sideways by up to about 160 units, with bends of different
  tightness and several left-right changes (S-bends) on each half.
- The roads keep their ends, their river crossings and the ward walk distances. They stay mirrored between the teams,
  clear of cover, camps and river gates, and close to their old lengths.
- The 2D painted ground gets a richer road: a soft trampled verge, a width that wanders, packed earth, cart ruts with rain
  puddles, grass tufts and stones on the edges, roots, fallen leaves, and worn cobbles out of each base court and around
  each ward.
- The 3D ground mask gets cobbles where each road leaves a base court. The 3D roads follow the new winding paths.
- The large tactical map draws a dashed trail line down the middle of each road.

## Art direction
Keep the painted-fantasy look of the Shore: muted greens, warm packed earth, grey-ochre stone, autumn leaf colours that
match the orange and violet foliage. No new image assets.

## Not in scope
- New lanes, new knots, new towers or moved camps.
- A different meander per match. The map stays the same for every match (see design.md).

## Capabilities
- Modify `moba-combat`: add a requirement for winding lane roads and one for the painted road detail.
