## ADDED Requirements

### Requirement: The walking street carries dust the far haze does not
A clear-day surface between about 5 m and 18 m, on a horizontal ray, SHALL move toward warm dust. A surface nearer than 5 m SHALL stay. A surface beyond about 70 m SHALL stay with the far aerial colour. The sky, and a night factor of 1, SHALL leave the colour.

#### Scenario: The middle of the street softens
- **WHEN** the walking camera looks down the street on a clear day
- **THEN** the road ahead pales toward warm dust and the foreground stays

#### Scenario: Night and sky stay
- **WHEN** the night factor is 1, or the pixel is sky
- **THEN** the dust term leaves the colour

#### Scenario: The far window still owns the distance
- **WHEN** a surface is beyond the dust band
- **THEN** the near dust mix is zero and the far haze is unchanged
