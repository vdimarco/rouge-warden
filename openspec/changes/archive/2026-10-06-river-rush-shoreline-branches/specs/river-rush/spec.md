## ADDED Requirements

### Requirement: Shoreline ducking branches
Duck hazards SHALL visibly grow from rooted shoreline trees in WebGL and the
2D fallback, with textured tapering limbs and foliage. Their low tips SHALL
align to the existing branch lane and collision distance. Connecting limbs
crossing other lanes SHALL stay above the standing rider. The existing speed,
duck window and collision outcomes SHALL remain unchanged. Tree geometry SHALL
remain bounded and use locally available resources prepared before active play.

#### Scenario: Approach and duck a shoreline limb
- **WHEN** a player approaches a branch on phone, desktop or short landscape
- **THEN** its tree is grounded on a shoreline, its limb reaches into the marked
  lane, and a correctly timed duck clears it with the existing reward

#### Scenario: Safe route and passed tree
- **WHEN** a player avoids the branch lane or passes below its tip
- **THEN** connecting wood stays overhead outside the hazard lane and the rooted
  tree continues past before being removed within the existing entity bounds

#### Scenario: Fallback and inactive play
- **WHEN** WebGL is unavailable, reduced motion is enabled, or the run pauses
- **THEN** rooted branches remain readable in fallback and reduced motion, and
  pause preserves the rendered scene without decorative branch movement
