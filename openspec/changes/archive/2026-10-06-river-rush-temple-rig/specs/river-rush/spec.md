## ADDED Requirements

### Requirement: Distinctive lost-temple models
The primary world SHALL present locally hosted fal-generated textured expedition raft, serpent temple landmarks and carved guardian obstacles with coherent mossy stone, warm timber and restrained gold/teal accents. Temple landmarks SHALL remain outside the three playable lanes. Repeated scenery and hazards SHALL share model resources and remain bounded. Existing speed, collision types and arcade route SHALL remain unchanged.
#### Scenario: Inspect upgraded course
- **WHEN** a player starts River Rush on phone, desktop or landscape and passes riverbank landmarks
- **THEN** carved temple silhouettes and guardian obstacles are visibly distinct from generic boulders, hazards remain readable and controls retain their timings

### Requirement: Continuous skeletal rider motion
The primary view SHALL use a fal-generated humanoid skeletal rider with long dark hair, modest loincloth and downstream orientation. Paddling SHALL follow a continuous time-based stroke with a physical paddle and coordinated arm joints. Steering SHALL use continuous bank, torso and leg weight shifts without pose teleportation or animation locks. Rendering SHALL follow display animation-frame cadence and SHALL NOT quantize the paddle cycle to a handful of still frames.
#### Scenario: Paddle while reversing lanes
- **WHEN** the player watches a full stroke and rapidly steers left then right
- **THEN** the paddle follows a continuous reach, plant, pull and recovery path, both hands follow its grip, and rider balance transitions without an abrupt side-to-side jump
#### Scenario: Actions and accessibility
- **WHEN** the player jumps, ducks, pauses, resumes or enables reduced motion
- **THEN** raised jump and near-prone duck remain distinct, pause freezes pixels, reduced motion disables decorative cycling, and every control remains available
#### Scenario: Asset unavailable
- **WHEN** a new model fails after bounded retries or WebGL cannot initialize
- **THEN** the existing registered rear-facing character art and usable geometric substitutes keep the course playable


## MODIFIED Requirements

### Requirement: Runner character animation
The approved adult character SHALL use a rear-facing fal-generated skeletal rider in the primary WebGL view, with continuous coordinated paddling, a raised-knee jump and an independent near-prone brace for ducking. Generated registered rear-facing art SHALL remain available in the 2D and missing-rig fallback. His long hair, bare torso, modest loincloth and identity SHALL remain consistent. The chase view SHALL show him facing downstream toward upcoming hazards, with the wake behind the raft and approaching scenery moving toward the camera. Rider feet and raft anchors SHALL remain registered. Visual animation SHALL NOT change action windows, speed, collision outcomes or scores.
#### Scenario: Paddle and chain actions
- **WHEN** the player rides, changes lanes, jumps and ducks
- **THEN** paddling faces downstream, the raft banks, jump and duck use visibly different anatomical silhouettes and a landing splash marks a completed jump
#### Scenario: Direction and fallback
- **WHEN** the player rides in the primary 3D view or 2D fallback
- **THEN** the rider faces the upcoming course, the wake trails behind and scenery approaches the camera coherently

### Requirement: Near-prone duck silhouette
Ducking SHALL use an independent near-prone rear-facing rider pose, with head and shoulders close to the deck and a low horizontal paddle. The primary view SHALL fold the skeletal body anatomically; fallback SHALL retain the independent registered brace image. Its visible silhouette SHALL be at most 45% of the jumping pose height at the same art scale. Jump SHALL retain its raised-leg and lifted-paddle appearance. Both poses SHALL preserve the approved identity, hair, modest loincloth, downstream orientation and raft registration without vertical compression or gameplay changes.
#### Scenario: Chain a jump into a duck
- **WHEN** the player jumps and immediately ducks using keyboard or touch
- **THEN** the raised jump pose changes into a visibly low near-prone brace in both WebGL and fallback, with the same immediate collision windows and raft anchor
