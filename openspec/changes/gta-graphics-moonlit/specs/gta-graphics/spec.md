## ADDED Requirements

### Requirement: Unlit night road takes a cool fill
On a clear night, road the lamp pool did not claim SHALL shift cooler. A road pixel under a lamp head SHALL stay warmer than it is blue. A clear day SHALL keep its colour.

#### Scenario: Open road at night
- **WHEN** the grade is shaded with NightFactor 1 and no lamp head in the gather
- **THEN** the road's blue channel rises above its red channel

#### Scenario: Under a lamp
- **WHEN** the gather holds a lamp head close above the pixel
- **THEN** the road stays warmer than it is blue

#### Scenario: Clear day
- **WHEN** the same road is shaded with NightFactor 0
- **THEN** the road keeps its colour
