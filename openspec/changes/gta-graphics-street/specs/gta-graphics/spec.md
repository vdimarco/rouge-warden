# gta-graphics

## ADDED Requirements

### Requirement: Sherbrooke shows lane traffic and sidewalk walkers

The scored Sherbrooke frame draws cars at 145 cm either side of the road centre and walkers at 850 cm either side. The cars are not all in one lane. The walkers are not all on one sidewalk. The opening camera stays at pitch −16 with the socket at (0, 70, 110).

#### Scenario: Both lanes and both sidewalks are occupied

- **WHEN** the Sherbrooke frame is drawn
- **THEN** cars sit at lateral 145 and −145, and walkers sit at lateral 850 and −850

#### Scenario: The opening aim stays

- **WHEN** the player spawns on foot
- **THEN** the look is pitch −16 and the socket is (0, 70, 110)
