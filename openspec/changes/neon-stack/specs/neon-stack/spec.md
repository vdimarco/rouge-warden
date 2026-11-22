# Neon Stack

## Requirements

### A rainy block you can walk

The page opens on a slow spin with no image requests. One tap or click drops the player into the alley. Later taps and clicks walk to a tile at about 3 tiles a second, around buildings and the car. A drag turns or tilts and does not also walk. Tilt stays between 20 and 87 degrees. Yaw covers a full turn.

#### Scenario: Attract, then a walk

- GIVEN the page at `?seed=1`
- WHEN it has painted a frame and the player has not touched it
- THEN the yaw is changing, and there are no console, page, or HTTP errors
- WHEN the player clicks a free tile after entering
- THEN the runner moves onto that tile and does not enter a building

#### Scenario: A drag is not a move

- GIVEN the player is in the alley
- WHEN they drag
- THEN the runner's tile does not change

### Lights and the cutaway

Five signs, the car strip, and the barrel are lights. The barrel is within 2 tiles of a neon sign. The eye sign is the one that flicks off. A building between the camera and the runner is drawn with fewer slices, and the runner stays visible. The same seed builds the same block.

#### Scenario: Cutaway

- GIVEN a building lies between the camera and the runner
- WHEN the cutaway is on
- THEN `slices` is lower than with the cutaway forced off
- AND a pixel on the runner reads as ochre or paper

#### Scenario: Seed

- GIVEN two loads with the same `?seed=`
- THEN the building tiles and heights match

### Budget

A frame uses at most 50 draw calls and draws at most 3000 slices. The scripts gzip under 150 KB.

#### Scenario: Counters

- GIVEN a frame has been drawn at 1280 by 800
- THEN `drawCalls` is at most 50 and `slices` is at most 3000
- AND the art buffer is 320 wide
