# Closed city

## Requirements

### Buildings are closed boxes

Every playable building has a wall on each storey that is not shared with a neighbour of equal or greater height, including the north face and the ground storey. Each exposed face shows a lit window on at least one storey. Back faces are culled. The runner, the skyline, and the street props stay visible when the camera turns.

#### Scenario: No open face

- GIVEN a seeded block
- WHEN a storey has no neighbour covering one side
- THEN that side has a wall slice facing outward

### A dark ring around the block

Filler buildings stand three lots deep on every side of the 6×6 grid. They are not walkable, carry no signs and no lights, and use dark walls with sparse amber windows. At yaw 90 and yaw 270 the frame above the street reads as buildings.

#### Scenario: The ring stays outside the walk

- GIVEN any seed
- THEN the walkable building count stays 16 and the neon light count stays 6
- AND filler walls extend at least two tiles past each edge of the grid
- AND the slice count stays at or under 900

### The existing block still plays

The spawn view still shows the signs, the exit, and the street. Draw calls stay at 3.

#### Scenario: Budget

- GIVEN the page at 390×844 in software GL
- WHEN the camera is at yaw 0, 90, 180, or 270
- THEN the frame uses 3 draws and stays within the existing stack guards
