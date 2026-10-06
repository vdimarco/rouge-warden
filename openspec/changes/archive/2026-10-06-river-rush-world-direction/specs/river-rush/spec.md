## ADDED Requirements

### Requirement: Layered adventurous world presentation
The primary view SHALL present a coherent turquoise, jade, warm sandstone and coral river world with a locally hosted fal-generated distant valley panorama, textured sculpted canopy trees, river pavilion landmarks and detailed driftwood hazards. Near scenery SHALL move with the course, distant scenery SHALL provide atmospheric depth, and canopy, falls and harbor stretches SHALL have visibly different landmark density. Decoration SHALL remain outside playable lanes and SHALL NOT obscure incoming hazards. Existing speed, immediate controls, collision types and continuous skeletal rider behavior SHALL remain unchanged.
#### Scenario: Discover the river
- **WHEN** a player rides through canopy, falls and harbor stretches on phone, desktop or landscape
- **THEN** the background and nearby silhouette composition visibly vary, the valley has clouds and distant landmarks, and the three lanes and next obstacle remain readable
#### Scenario: Inspect detailed hazards
- **WHEN** a log or overhead branch approaches the raft
- **THEN** sculpted wood, end grain and moss are visible, low and overhead heights retain their distinct jump/duck meanings, and existing action windows remain effective
#### Scenario: Preserve motion and performance
- **WHEN** the player paddles, reverses lanes, jumps, ducks or enables reduced motion
- **THEN** continuous anatomical animation and accepted speed remain intact, reduced motion freezes decoration, and the measured rendered scene remains below 300000 triangles and 65 calls on the full path or 125000 triangles and 65 calls on software
#### Scenario: Pause and asset failure
- **WHEN** the player pauses or a new scenery model or panorama remains unavailable after bounded retries
- **THEN** pause freezes displayed canvas pixels and unavailable decoration falls back without preventing play or changing collision rules
