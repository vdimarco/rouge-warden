## ADDED Requirements

### Requirement: Graded phone steering
The phone wheel SHALL send three steering levels per side, with hysteresis, instead of full lock for any drag.

#### Scenario: Small correction
- **WHEN** a driver drags the wheel a little to one side
- **THEN** the browser holds the one-third steering key for that side, and the car turns about a third as sharply as at full lock

#### Scenario: Thumb near a threshold
- **WHEN** the thumb jitters by a few pixels around a level boundary
- **THEN** the held steering key does not change until the thumb moves past the hysteresis band

#### Scenario: Release
- **WHEN** the steering touch ends, is cancelled, or the player changes mode, rotates, opens the menu or disconnects
- **THEN** every steering key is released and the wheel recentres

### Requirement: Driving that forgives stream delay
The server SHALL steady player-driven cars on the road so that late corrections do not cause swerving.

#### Scenario: Straight road with a late correction
- **WHEN** a driver on a mapped road releases the wheel after a correction
- **THEN** the car settles on the road heading without swinging back and forth, and its yaw rate does not overshoot what the wheel asked for

#### Scenario: Turn at a junction
- **WHEN** the driver holds the wheel through a junction
- **THEN** the assist does not resist the turn

#### Scenario: Scrape a wall
- **WHEN** the car hits a wall at a shallow angle
- **THEN** it slides along the wall and keeps most of its speed

#### Scenario: Stuck
- **WHEN** the driver holds Gas for 1.5 s without the car making progress
- **THEN** the car gets a small nudge free

#### Scenario: Off-road tests keep their numbers
- **WHEN** the host runs the existing `Quebec.Driving` tests
- **THEN** their pinned values still hold, because the assist acts only near mapped roads
