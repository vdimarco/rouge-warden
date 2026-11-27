# neon-runner-stack

## ADDED Requirements

### Requirement: Idle and run are a slice stack

The idle pose and the two run poses SHALL be drawn as horizontal slices of Art's voxel strips, turned so the front faces the walking direction. A camera yaw SHALL show a different side of that volume. Crouch, hack, and spotted SHALL stay the flat card.

#### Scenario: Four yaws

- **GIVEN** the runner is idle on the block at the in-game tilt
- **WHEN** the camera yaw is 0, 90, 180, and 270
- **THEN** the runner is a hooded figure with a pack, and the side yaws show the pack's depth

#### Scenario: Crouch stays a card

- **GIVEN** the runner is idle
- **WHEN** the pose changes to crouch
- **THEN** the figure changes to the flat crouch card and movement input is unchanged

### Requirement: The stack stays inside the frame budget

The stack SHALL use the existing three draws, keep the block at 900 slices or fewer, and keep the synced frame at 390 px width at or under 35 ms at yaw 0, 90, 180, and 270. The added JavaScript SHALL stay within 2 KB gzipped of main.

#### Scenario: Draws and slices

- **GIVEN** seed 7 at 390 px width
- **WHEN** a frame is drawn
- **THEN** the draw count is 3 and the slice count is at most 900
