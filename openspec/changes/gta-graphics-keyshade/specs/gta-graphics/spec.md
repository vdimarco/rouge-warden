## ADDED Requirements

### Requirement: Clear-day shade is darker than the sunlit side
A matte surface facing away from the sun SHALL be darker than the same surface facing the sun. A sunlit matte surface SHALL keep its value. Gloss, sky, printed crew and a night factor of 1 SHALL leave the colour.

#### Scenario: The shade wall darkens
- **WHEN** a matte midtone faces away from the sun on a clear day
- **THEN** its luminance drops and the sunlit copy of that colour stays

#### Scenario: Night, gloss, sky and crew stay
- **WHEN** the night factor is 1, or the surface is glossy, sky, or printed crew
- **THEN** the shade term leaves the colour

#### Scenario: The street picture splits by value
- **WHEN** the walking camera looks down the street
- **THEN** the shade wall is darker and the sunlit wall and the road keep their value
