# Design

## Source
- The route is A* on a waypoint graph, as Amit Patel shows in Red Blob Games' "Introduction to the A* Algorithm" and "Grids and
  Graphs" (redblobgames.com). The waypoints are the crossings of the city's street centre lines (`city.streets.xs`, `zs` and the
  avenues), so the graph comes from the city layout and needs no hand-placed points or navmesh.
- The slide past a post is a simple form of the "feelers" obstacle avoidance in Craig Reynolds' "Steering Behaviors For
  Autonomous Characters" (GDC 1999): when the step is blocked, try the step turned to one side, then the other.
- Yuka (MIT, last release 0.7.8 in 2022) has both a graph A* and steering. It was not used: the arcade has no build step, and
  the street grid makes the graph small enough for about 100 lines of code.

## Decisions
- **Graph.** Every street and avenue line in x crossed with every one in z: 17 × 9 nodes. A crossing inside a block (where a
  partial avenue stops) is not clear and drops out. Each crossing and each block side is tested once and cached; the city does
  not change.
- **What blocks a line.** Water, or a solid wider than 2 m under a roof above 2.5 m (a building). A post or a bench does not:
  otherwise a post on the line would send the goon round the whole block. The walk itself still uses the full collision
  (`walk`), so he never goes through a post.
- **Ends of a route.** The goon and the target each link to the nearest 4 crossings within 110 m that they can walk straight
  to. A* stops growing a route past 260 m.
- **Street only.** A goon whose feet are more than 0.5 m above the ground (on a roof) walks straight, as before. Routes on roofs
  would need roof edges in the graph, and a roof guard should not leave his roof.
- **Replanning.** Each goon plans again every 0.375 to 0.625 s (his own beat from his id), or at once when the target has moved
  3 m. The beats spread a crew's plans over frames.
- **The final leg.** When the line to the hero is clear, the goon walks straight as before, so the existing walk-up, wind-up and
  punch timings are unchanged.

## Check
- `node qa/vr/action.test.mjs`: "a goon on the street goes round a block corner" finds every block corner where the straight
  line between the two sidewalks is blocked (132 in the current city), and plays three of them. "a goon whose straight way a
  post blocks slides past it" adds a post on the line. Both tests fail on the old code and pass on the new.
- Cost, measured in Node with eight goons routing round one corner at 60 Hz: 0.1 ms each frame on average, 1.8 ms at worst.
