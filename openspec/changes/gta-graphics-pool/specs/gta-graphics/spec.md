## ADDED Requirements

### Requirement: Night roads pick up a lamp pool
On a clear night, a road pixel under a lamp head SHALL gain a warm pool. A clear day SHALL keep its colour. A window and a headlight SHALL not start a pool.

#### Scenario: A lamp head over the road
- **WHEN** the night grade is shaded with NightFactor 1 and a lamp-coloured sample in the upward gather
- **THEN** the road pixel's red channel rises and stays above its blue channel

#### Scenario: Clear day
- **WHEN** the same gather is shaded with NightFactor 0
- **THEN** the road pixel keeps its colour

#### Scenario: A window or a headlight
- **WHEN** the gather holds a lit window or a white headlight and no lamp head
- **THEN** the road pixel keeps its colour
