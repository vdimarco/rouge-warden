## MODIFIED Requirements

### Requirement: Readable moving river enemies
Each seeded river SHALL include sparse crocodile, leaping-fish and swooping-bird enemies after its tutorial and early required actions. Crocodiles SHALL repeatedly weave back and forth across lanes, remain moving near contact and weave faster on later maps. Crocodiles and fish SHALL allow jumping or dodging; birds SHALL allow ducking or dodging. Fish SHALL visibly leap from water, and birds SHALL descend into the river from either shoreline. Their visible lane and height SHALL use a shared deterministic pose; physical crossing SHALL use that pose's contact lane. A clear action tell and predicted contact-lane marker SHALL provide enough warning for a timed response. Generation SHALL preserve reachable action rewards, attainable advertised chains, clear routes and finite finishes. Prepared animation resources and active entities SHALL remain bounded.

#### Scenario: React to weaving and leaping wildlife
- **WHEN** a crocodile or fish approaches on desktop, portrait touch or short landscape
- **THEN** the crocodile reverses repeatedly without settling before contact, the fish visibly launches out of water, and their jump/dodge cues and contact markers agree with the physical crossing lane
- **AND** a correctly timed jump clears the enemy and reaches its raised reward without requiring an adjacent-lane coin pickup

#### Scenario: Duck a bank-diving bird
- **WHEN** a bird approaches from either side of the river
- **THEN** its trajectory begins beyond the bank and visibly descends into its marked high contact envelope, with a readable duck/dodge tell and enough response time

#### Scenario: Contact and stopped state
- **WHEN** the raft overlaps an enemy, pauses, retries or enables reduced motion
- **THEN** physical contact uses its shared visible lane and existing protection/wipeout feedback, paused positions remain unchanged, retry resets encounters, and reduced motion keeps essential collision motion clear without extra shake

#### Scenario: Preserve complete varied courses
- **WHEN** delayed-input play proceeds through all three maps including Rush and advertised jump chains
- **THEN** all three species appear, routes and raised coin arcs remain attainable, finishes remain finite, and entities and prepared graphics resources stay within fixed bounds

### Requirement: Shareable scores and gesture guidance
The game SHALL offer a button to save a legible PNG score image with the map,
score and adventure progress. Animated visual guidance SHALL demonstrate
horizontal lane swipes, upward jumping and downward ducking; reduced motion
SHALL retain still diagrams. Guides SHALL not capture gameplay gestures.
Active phone guidance SHALL be compact at the HUD edge and leave the central
river, raft, upcoming hazards and gameplay controls visible. Enemy guidance
SHALL distinguish weaving crocodiles, leaping fish and bank-diving birds.

#### Scenario: Save a score
- **WHEN** a player chooses Save score image during a run or on a result screen
- **THEN** a downloaded PNG contains the current score, map and cleared progress
  and does not depend on retaining WebGL drawing-buffer pixels

#### Scenario: Learn gestures
- **WHEN** a player opens instructions or starts an early run
- **THEN** directional swipe/jump/duck guides visibly show the required gesture,
  remain readable at phone size, respect reduced motion and permit screen-wide input

#### Scenario: Keep the river view open
- **WHEN** opening or enemy hints appear at 390x844, 360x640 or short landscape size
- **THEN** the compact card remains beside the HUD without overlapping score,
  distance, power badges or controls and leaves the central hazard corridor open
- **AND** a drag beginning on the hint still steers the raft through the normal whole-screen gesture handler

### Requirement: Natural tree anatomy and materials
Shoreline trees SHALL have smooth curved, tapering limbs, rooted broad trunks,
irregular fuller crowns, detailed bark and natural individual leaf textures.
The duck bough SHALL have substantial structural thickness and multiple
connected woody forks with leafy offshoots along its span. Its terminal
silhouette SHALL descend naturally without a curled upward hook.
The primary 3D duck-tree visual SHALL use an optimized locally packaged Meshy
asset with recorded generation provenance. Its connecting wood SHALL stay
above safe lanes while the low limb remains confined to its duck lane.
Matching decorative trees SHALL be placed outside the playable river.
Texture and geometry work SHALL finish before active play; missing new assets
SHALL retain usable local fallback materials and geometry. All trees SHALL
share a bounded renderer budget and retain existing speed, action windows,
inputs and collision outcomes.

#### Scenario: Read a natural duck tree
- **WHEN** a player approaches and ducks a shoreline branch at phone, desktop
  or short landscape size
- **THEN** the prepared Meshy tree has thick connected branching wood,
  recognizable bark and foliage and a readable low limb at the marked lane
- **AND** a successful timed duck preserves protection and earns the existing reward

#### Scenario: Travel through a fuller riverbank
- **WHEN** a run advances through its bank scenery
- **THEN** matching detailed trees remain outside playable lanes, recycle within
  fixed counts and do not obscure low hazard tips with crown foliage

#### Scenario: Pause or use fallback
- **WHEN** the run pauses, reduced motion is active, WebGL fails or a new asset
  cannot load
- **THEN** paused pixels stay fixed, reduced motion preserves readable trees,
  and the fallback remains playable with the same branch geometry and controls

#### Scenario: Read a substantial branched bough
- **WHEN** a player approaches a duck tree on phone, desktop or landscape
- **THEN** a thick supporting bough has multiple clearly connected leafy forks,
  its low end tapers without curling upward, and a timed duck clears the wood
