# gta-graphics

## ADDED Requirements

### Requirement: A low sun throws shafts and the distance hazes

Light shafts and volumetric fog turn on when the sun is below 8 degrees. The haze density is 0.00015 per centimetre. The opening camera stays at pitch −16 with the socket at (0, 70, 110). The opening weather stays clear.

#### Scenario: Distance hazes and the sun throws a shaft

- **WHEN** the sun is low and a surface is far
- **THEN** the far surface hazes more than a near one, and a pixel toward the sun is brighter than a pixel facing away

#### Scenario: The opening aim stays

- **WHEN** the player spawns on foot
- **THEN** the look is pitch −16, the socket is (0, 70, 110), and the weather is clear
