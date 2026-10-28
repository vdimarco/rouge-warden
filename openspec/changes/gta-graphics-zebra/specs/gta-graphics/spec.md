## ADDED Requirements

### Requirement: Wide roads carry a ladder crossing
A road at least 9 m wide and 15 m long SHALL get eight bars across its middle. Each bar SHALL be 40 cm along the road and stop 80 cm short of each curb. A narrower road SHALL stay unmarked. The center dashes SHALL stay.

#### Scenario: The avenue gets eight bars
- **WHEN** the lane paint is built for a wide road
- **THEN** eight bars are added at the middle, 90 cm apart, and the dash count is unchanged

#### Scenario: A local street stays bare
- **WHEN** the road is narrower than 9 m or shorter than 15 m
- **THEN** it gets neither a new bar nor a center dash

#### Scenario: The walking picture shows the ladder
- **WHEN** the walking camera looks along the road toward the bars
- **THEN** the bars read across the asphalt and the center dashes remain
