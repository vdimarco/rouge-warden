# Neon Stack

## ADDED Requirements

### Requirement: The exit and the terminal are on the block

The exit and the terminal each stand on a walkable tile inside the 6×6 grid. From the spawn, a four-neighbour search reaches both. At 390×844 and 1280×800, tilt 55, yaw 0, the exit is fully on screen and reads cyan.

#### Scenario: Search from spawn

- GIVEN seed 1, 4, 7, or 9
- WHEN a breadth-first search starts at the spawn tile
- THEN it reaches the exit tile and the terminal tile

#### Scenario: The door is on screen

- GIVEN the player is at the spawn, tilt 55, yaw 0
- WHEN the frame is 390×844 or 1280×800
- THEN every corner of the exit is inside the art buffer
- AND a pixel on the door is cyan

### Requirement: Sign light stays off the spawn

No neon sign is within 2.1 tiles of the spawn, so the runner's outline is off there. Each sign's colour tints the asphalt out to about two tiles, and most of the asphalt stays dark. With every sign switched off, no sign hue remains.

#### Scenario: Spawn is dark

- GIVEN any of seeds 1, 4, 7, 9
- WHEN the distance from the spawn to each sign is measured
- THEN the nearest sign is further than 2.1 tiles

### Requirement: Spawn framing

The tower is exactly six storeys and every other lot is at most four. At 1280×800 from the spawn, the tower top and a strip of skyline are on screen near the top, and the terminal is fully on screen. The skyline card moves at 0.30 relative to the block when the camera pans or turns.

#### Scenario: Tower and skyline

- GIVEN seed 1 at 1280×800, the player at the spawn, tilt 55, yaw 0
- WHEN the tower top and the skyline are projected
- THEN both are inside the art buffer
- AND the skyline sits above the tower top
