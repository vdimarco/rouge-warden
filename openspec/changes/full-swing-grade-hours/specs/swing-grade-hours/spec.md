## ADDED Requirements

### Requirement: The sunset grade has four inks

At the painted sunset, the dark end of a shade SHALL read violet, an open shade SHALL read teal, the step between shade and sun SHALL read rose, and a sunlit face SHALL read amber. Bright lamps, the sun disc, and near-black ink SHALL stay out of the grade.

#### Scenario: Street at sunset

- **GIVEN** the city at the painted sunset
- **WHEN** the player looks down the street
- **THEN** shaded walls show violet and teal, and sunlit walls show rose and amber

#### Scenario: Ink and the sun disc stay

- **GIVEN** the city at the painted sunset
- **WHEN** the canyon and the needle are drawn
- **THEN** building edges stay ink, and the painted sun stays bright yellow-orange

### Requirement: Play walks the grade to blue hour

While the city is being played, the grade SHALL move from the painted sunset to blue hour and back. At blue hour the open shade SHALL read violet and the sun step SHALL read rose.

#### Scenario: Blue hour

- **GIVEN** the grade is pinned at blue hour
- **WHEN** the player looks down the same street
- **THEN** the teal of sunset has given way to violet, and the amber sun step has given way to rose
