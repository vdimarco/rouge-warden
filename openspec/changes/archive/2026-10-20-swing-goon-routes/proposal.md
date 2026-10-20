# Full Swing: goons go round buildings

## Why
A goon that chased the hero walked in a straight line. When the hero stood round a block corner, the goon walked into the corner
building and stopped there. A post on his line stopped him too. The fight did not come to the hero.

## What changes
- A goon on the street that cannot walk straight to the hero goes by the street crossings (A* over the crossings of the street
  centre lines). He takes the same way back to his post.
- A step that a post or a bench stops turns 45°, then 90°, so he walks past it.
- A goon on a roof is unchanged: he walks straight and never off an edge.

## Not in scope
- Yuka or any other AI library. The city is a grid of blocks, so the existing street lines are the route graph.
- Police, a wanted level, or new goon kinds.

## Capabilities
- Modified: `swing-combat`.
