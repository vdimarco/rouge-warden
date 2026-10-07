# swing-hero-motion Specification

## Purpose
In Full Swing, how the hero moves on foot and on walls.

## Requirements

### Requirement: Fluid walk and run
On the ground the hero SHALL play motion-captured idle, walk, jog and run loops blended by ground speed, at a rate matched to the speed, so a planted foot does not slide. Starts and stops SHALL blend with no pops, and the air, swing, landing, rope arm and head look SHALL stay on top. Without the motion file the code-built gait SHALL play.

#### Scenario: Run
- **WHEN** the player runs on a roof at 3.5 m/s
- **THEN** the planted toe moves under 0.2 m/s (median) while it carries weight, and the stride, knee bend and arm swing come from the capture

#### Scenario: Start and stop
- **WHEN** the player starts and stops running
- **THEN** no bone turns more than about 12 degrees in one frame

#### Scenario: Offline
- **WHEN** the game starts with no network after one visit
- **THEN** the motion file loads from the offline cache

### Requirement: Climb like a climber
On a wall in flat play both hands and both feet SHALL hold points on the wall and keep still while held. Limbs SHALL step in diagonal pairs, never more than two at once, at a rate that follows the climb speed. The chest SHALL stay close to the wall with the knees out, the head SHALL look along the climb, and at rest all four limbs SHALL hold.

#### Scenario: Climb up, sideways and down
- **WHEN** the player climbs with W, A, S or D
- **THEN** held hands and feet move under 5 cm/s, only diagonal pairs move, hands lead going up and feet lead going down

#### Scenario: Over the top
- **WHEN** the hero mantles onto the roof
- **THEN** the hero is drawn pulling up over the edge with the hands on it, moving at most about 0.15 m a frame
