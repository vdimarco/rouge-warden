## MODIFIED Requirements

### Requirement: Natural tree anatomy and materials
Shoreline trees SHALL have smooth curved, tapering limbs, rooted broad trunks,
irregular fuller crowns, detailed bark and natural individual leaf textures.
The duck bough SHALL have substantial structural thickness and multiple
connected woody forks with leafy offshoots along its span. Its terminal
silhouette SHALL descend naturally without a curled upward hook.
Matching decorative trees SHALL be placed outside the playable river. Curved
low limbs SHALL remain confined to their duck lane. Texture and geometry work
SHALL finish before active play; missing new textures SHALL retain usable local
materials. All trees SHALL share a bounded renderer budget and retain existing
speed, action windows, inputs and collision outcomes.

#### Scenario: Read a natural duck tree
- **WHEN** a player approaches and ducks a shoreline branch at phone, desktop
  or short landscape size
- **THEN** the tree has a continuous curved limb, recognizable bark and leaves,
  and a successful timed duck preserves protection and earns the existing reward

#### Scenario: Travel through a fuller riverbank
- **WHEN** a run advances through its bank scenery
- **THEN** matching detailed trees remain outside playable lanes, recycle within
  fixed counts and do not obscure low hazard tips with crown foliage

#### Scenario: Pause or use fallback
- **WHEN** the run pauses, reduced motion is active, WebGL fails or a new texture
  cannot load
- **THEN** paused pixels stay fixed, reduced motion preserves readable trees,
  and the fallback remains playable with the same branch geometry and controls

#### Scenario: Read a substantial branched bough
- **WHEN** a player approaches a duck tree on phone, desktop or landscape
- **THEN** a thick supporting bough has multiple clearly connected leafy forks,
  its low end tapers without curling upward, and a timed duck clears the wood
