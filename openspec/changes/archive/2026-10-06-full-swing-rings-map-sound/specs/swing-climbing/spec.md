## ADDED Requirements

### Requirement: A brushed wall does not stop a swing
In the air, a wall SHALL hold the player only when the player comes at it slowly (under 8 m/s) or fairly head-on (at least 40% of the speed goes into the wall, not counting a fall). A wall the player only brushes during a fast swing SHALL let the swing go on. A fall steered into a wall SHALL still catch it.

#### Scenario: Brush a wall mid-swing
- **WHEN** the player swings past a wall at 20 m/s and touches it at 2 m/s
- **THEN** the player does not hold on, and keeps the swing's speed

#### Scenario: Fall into a wall
- **WHEN** the player falls at 14 m/s while steering into a wall at 3 m/s
- **THEN** the player holds on to the wall in the air

#### Scenario: Tap-only phone play
- **WHEN** the player plays 12 s from the start roof with taps only
- **THEN** the average speed is at least 15 m/s (measured 20.9 m/s with this rule, 18.9 m/s without)
