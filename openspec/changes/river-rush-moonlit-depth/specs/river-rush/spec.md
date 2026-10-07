## MODIFIED Requirements

### Requirement: Layered adventurous world presentation
The primary view SHALL distinguish jungle canopy, sandstone gorge and moonlit temple maps using prepared sky/background palettes, textured trees, rock/temple landmarks and driftwood. Jungle MAY retain its locally hosted fal panorama. Redstone and Moonlit SHALL use atmosphere-only skies and course-registered landscape layers. Near scenery SHALL move with the course and the distant environment SHALL provide atmospheric depth. Decorative landmarks SHALL remain outside playable lanes and preserve hazard readability.

#### Scenario: Discover the rivers
- **WHEN** a player advances through all three maps on a supported layout
- **THEN** sky, water, bank composition and landmarks visibly change between the lush jungle, orange gorge and violet moonlit ruin environments

#### Scenario: Preserve motion and performance
- **WHEN** a player paddles, reverses lanes, jumps, ducks or reduces motion
- **THEN** the continuous rider and responsive control timings remain, optional decoration freezes, and measured scenes stay below 65 calls and 300,000 triangles on the full path or 125,000 triangles on the software path

## ADDED Requirements

### Requirement: Coherent Moonlit landscape depth
Moonlit Ruins SHALL use an atmosphere-only night sky and prepared bounded course-registered landscape silhouettes. Near, middle and far landscape layers SHALL move with coherent perspective and relative depth; the background SHALL NOT contain a stationary painted river or near temple scene. Moonlight, violet mist and ruin identity SHALL remain, and landscape silhouettes SHALL stay outside playable lanes.

#### Scenario: Advance through Moonlit Ruins
- **WHEN** a player advances and steers through opening, middle and late Moonlit sections on phone, desktop or short landscape
- **THEN** nearer scenery advances faster than distant silhouettes, shared landscape anchors follow the course, no fixed duplicate river remains, and hazards stay readable

#### Scenario: Cross horizon sections
- **WHEN** a horizon slot enters or leaves the visible course
- **THEN** its silhouette enters or recedes gradually without a sudden replacement, and instance/resource counts stay bounded

#### Scenario: Pause, reduce motion and restart
- **WHEN** the player pauses, enables reduced motion, retries or changes maps
- **THEN** stopped frames are stable, decorative motion reduces, controls retain their timing, and prepared resources introduce no play-time terrain texture or shader work

#### Scenario: Use graphics fallback
- **WHEN** WebGL cannot initialize
- **THEN** Moonlit remains playable with a coherent night environment and no fixed painted near river
