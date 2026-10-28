## ADDED Requirements

### Requirement: Clear day splits warm sun from cool shade
A matte midtone on a clear day SHALL take a warmer hue toward the sun and a cooler hue away from it. The pixel's luminance SHALL stay. Gloss, sky, printed crew, the dark wash and a night factor of 1 SHALL leave the colour.

#### Scenario: Sun and shade are different hues
- **WHEN** two matte midtones share a colour and one faces the sun
- **THEN** the sun-facing hue is warmer and both keep their luminance

#### Scenario: Night, gloss, sky and crew stay
- **WHEN** the night factor is 1, or the surface is glossy, sky, or printed crew
- **THEN** the grade leaves the colour

#### Scenario: The street picture splits
- **WHEN** the walking camera looks down the street
- **THEN** the shade wall, the sunlit wall and the road read as three hues
