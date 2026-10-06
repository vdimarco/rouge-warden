## MODIFIED Requirements

### Requirement: Runner character animation
The approved character SHALL use rear-facing generated paddling frames, a distinct raised-knee jump pose and a low folded crouch pose for ducking. His long hair, body, modest loincloth and identity SHALL remain consistent. The chase view SHALL show him facing downstream toward upcoming hazards, with the wake behind the raft and approaching scenery moving toward the camera. Rider feet and raft anchors SHALL remain registered. Visual animation SHALL NOT change action windows, speed, collision outcomes or scores.
#### Scenario: Paddle and chain actions
- **WHEN** the player rides, changes lanes, jumps and ducks
- **THEN** paddling faces downstream, the raft banks, jump and crouch use visibly different silhouettes and a landing splash marks a completed jump
#### Scenario: Direction and fallback
- **WHEN** the player rides in the primary 3D view or 2D fallback
- **THEN** the rider faces the upcoming course, the wake trails behind and scenery approaches the camera coherently

### Requirement: Continuous steering and character geometry
Visual steering SHALL preserve position and velocity through repeated lane inputs, settle a single-lane step to 95% within 90 ms and retain immediate logical lane selection. Jump and duck SHALL retain the approved rider identity, with continuous raft lift and distinct registered rider poses. Duck SHALL use a low anatomical crouch with no vertical image compression. Rider art SHALL remain independent of the registered raft geometry.
#### Scenario: Reverse a dodge and jump
- **WHEN** the player changes lanes, immediately reverses and jumps or ducks
- **THEN** steering follows a short continuous trajectory, the rider identity and raft remain consistent, distinct jump/duck silhouettes remain registered and controls are available throughout the action

## ADDED Requirements

### Requirement: Rich river presentation with preserved pace
The river SHALL use textured shoreline and rocks, varied foliage and layered lighting/atmosphere while preserving the existing fixed scene budgets and runner speed. Normal speed SHALL start at 42 m/s and cap at 72 m/s; jump SHALL last .66 seconds and duck .60 seconds. Reduced motion, exact paused frames and readable hazards/controls SHALL be retained at phone, desktop and short landscape layouts.
#### Scenario: Ride through upgraded scenery
- **WHEN** the player starts the updated game and chains lane/jump/duck actions
- **THEN** the new scenery and distinct rider poses remain readable while speed, action timing and legal routes match the prior build
