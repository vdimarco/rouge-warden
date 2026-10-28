## ADDED Requirements

### Requirement: The compass dial shows a ring and ticks

The chase compass on a flat screen SHALL show a rose ring and four ink ticks on the cream disc. The ticks SHALL stay put while the arrow turns. The score row's box SHALL stay where it was.

#### Scenario: A desktop play frame shows the dial

- **WHEN** the player is in flat play at 1280×720
- **THEN** a pixel on a tick is ink where the disc was cream
- **AND** a pixel on the ring is the plate's rose
- **AND** the score row's box is unchanged

#### Scenario: The arrow still turns

- **WHEN** the goal is not straight ahead
- **THEN** the arrow svg carries the rotation
- **AND** the tick svg does not
