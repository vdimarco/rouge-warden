## ADDED Requirements

### Requirement: Winding lane roads
Each lane road SHALL wind like a forest path: it SHALL swing sideways off the smooth spline through its knots, with bends of
varying tightness and at least two changes between left and right bends on each team's half. The winding SHALL be fixed for
the map, so every match and every replay of a seed has the same roads. Team 1's half of each road SHALL be the exact mirror
of team 0's half. The road SHALL leave each base court and cross the river straight, at the same crossing as the knot on the
river axis. The winding SHALL keep the road at least 210 units from cover in both realms and at least 600 units from spirit
camps and river gates, SHALL bend no tighter than a 300-unit radius where the spline was gentler, SHALL keep consecutive
wards at least 2.5 tower ranges apart, and SHALL add at most 6% to each lane's length. Wards SHALL stay at their walk
distances from the base.

#### Scenario: Walk a side lane
- **WHEN** a hero walks the west or east lane from its base court to the river
- **THEN** the road bends left and right several times, swings up to about 160 units off a smooth curve, and is no more
  than 6% longer than before.

#### Scenario: Both teams walk the same road
- **WHEN** a hero of each team walks the same lane from its own base
- **THEN** both meet the same bends in the same order, reach each ward after the same walk, and cross the river at the same bridge.

#### Scenario: Same map every match
- **WHEN** two matches start, with the same seed or with different seeds
- **THEN** the roads and ward spots are the same in both matches, and each road still crosses the river once, at its halfway point.

#### Scenario: Roads stay open
- **WHEN** the realm shifts between town and woods
- **THEN** every road sample stays at least 210 units from any cover block, and the largest moving body passes along the
  whole road without being pushed aside.

#### Scenario: Tactical map
- **WHEN** a player opens the tactical map on desktop (1440 × 900) or on a phone (844 × 390 or 390 × 844)
- **THEN** the map shows the same winding roads, with a dashed trail line down the middle of each.

### Requirement: Painted forest roads
The 2D painted ground SHALL draw each lane road as a worn forest path in the Shore's painted-fantasy look: a soft trampled
verge instead of a hard border, a width that wanders and widens out of each base court and around each ward, packed earth
with cart ruts, a few rain puddles, grass tufts and stones along the edges, roots and fallen leaves, and worn cobbles out of
each base court and around each ward. The details SHALL come from the match seed, so the same seed paints the same ground.
The road SHALL be painted once into the cached ground canvas and SHALL add no drawing work per frame. The 3D ground SHALL
turn to stone along each road where it leaves a base court.

#### Scenario: Look at a road in a match
- **WHEN** the player's hero stands on a lane in the 2D view at 1440 × 900 or on a phone
- **THEN** the road shows ruts, edge grass and stones, and its edges fade into the grass.

#### Scenario: Frame time
- **WHEN** a 2D match runs with `?perf`
- **THEN** the median frame time and the draw time are no worse than before the change (within measurement noise), and the
  ground canvas stays 3072 × 3072.

#### Scenario: Water stays painted
- **WHEN** the 2D ground is painted for any seed and realm
- **THEN** water covers every river sample and the canvas has no holes.
