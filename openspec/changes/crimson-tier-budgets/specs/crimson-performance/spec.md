## ADDED Requirements

### Requirement: Lower tiers inside their main-pass budgets
At every perf viewpoint, looking each of the four ways by day, the main pass SHALL stay within the tier's triangle and draw-call budgets in `QUALITY`. This includes Uptown and the Midgley bridge deck on Q1 (220k triangles, 130 draws) and Q0 (150k, 100). The budgets themselves SHALL stay the same.

#### Scenario: Uptown and the bridge on a phone tier
- **GIVEN** free roam on Q1 or Q0 with the crew sent off, the "qa" camera 2.2 m above the ground, fov 55°, by day
- **WHEN** the camera stands at `uptown` or `midgley_deck_s` and looks north, east, south and west
- **THEN** no heading draws more triangles or calls than the tier's budget

#### Scenario: Q2 is unchanged
- **WHEN** the same check runs on Q2
- **THEN** it passes and the Midgley tile's nearest level still uses 2.5 m cells

### Requirement: The Midgley tile's nearest level follows the tier
The Midgley tile (tile 3_1: the turnout, the bridge and the canyon trail) SHALL draw its nearest level with 2.5 m cells on Q2 and with 5 m cells on Q1 and Q0. Its surface SHALL be the same either way. Its middle and far levels SHALL stay at 5 m and 10 m on every tier, so no coarse cell pokes through the turnout's asphalt.

#### Scenario: Tier change near the bridge
- **GIVEN** the camera is within the nearest-level distance of the Midgley tile
- **WHEN** the tier changes between Q2 and Q1 or Q0, by the menu or by adaptive quality
- **THEN** the tile's nearest level is rebuilt for the new tier
- **AND** the old level stays visible until the new one arrives, so the ground never shows a gap
- **AND** walking, driving, cameras and collisions are unaffected, because they read the height field and not the mesh

### Requirement: Nothing is drawn past the fog
An outhouse past the current view distance (day or night) SHALL NOT be drawn, even when it is inside the frustum. An outhouse within 40 m of the camera SHALL still be drawn, so its shadow can fall into view.

#### Scenario: Looking toward a distant trailhead
- **GIVEN** an outhouse 700 m away in the direction the camera faces, on Q0 (450 m view by day)
- **WHEN** the frame is drawn
- **THEN** that outhouse adds no triangles, and the picture is the same because the fog ends at or before the view distance (C8)
