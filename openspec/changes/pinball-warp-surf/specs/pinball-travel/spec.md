## ADDED Requirements

### Requirement: Steer through perspective rings during warp
Full Tilt SHALL offer an optional three-ring challenge while travelling through space, using projected depth and the same physical crossing coordinates for rendering and hit checks.

#### Scenario: One-thumb or keyboard flight
- **WHEN** the player drags on the warp view or holds WASD during normal travel
- **THEN** the ship steers smoothly and approaching rings grow toward the viewer

#### Scenario: Earn a bounded reward
- **WHEN** the player crosses at least two rings and arrives
- **THEN** one gravity charge is awarded up to the normal inventory cap, and each collected ring earns points only once

#### Scenario: Missing or skipping remains safe
- **WHEN** the player misses rings or skips the jump
- **THEN** the ship arrives at the correct playable dock without a penalty, with only already earned rewards

#### Scenario: Pause and reduced motion
- **WHEN** the player pauses, hides the tab or changes screen orientation
- **THEN** steering input is cleared and pause stops all challenge progress
- **WHEN** reduced motion is enabled
- **THEN** travel uses its calm short fade and awards the charge without a speed challenge

### Requirement: Readable plasma field lines
Full Tilt SHALL draw richer plasma rails and trails around their accurate gameplay paths with bounded visual work.

#### Scenario: Read the live field
- **WHEN** the player launches, aims or approaches a dock
- **THEN** the ball and collision paths remain visible within layered plasma effects in portrait, landscape and desktop layouts
