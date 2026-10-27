## ADDED Requirements

### Requirement: The play shell shows the mission

While a mission is open, the play page shows the title, the objective, the stage, and a marker for the objective. A setback adds its reason on that card and leaves it there until the step changes.

#### Scenario: An open stage

- **WHEN** the host reports a title, an objective, and a stage
- **THEN** the play page shows those words and a marker for the objective

#### Scenario: A setback

- **WHEN** a beat fails and the step does not change
- **THEN** the fail sentence stays on the card

#### Scenario: The step changes

- **WHEN** the beat advances
- **THEN** the fail sentence leaves the card

#### Scenario: An offline frame

- **WHEN** the page shows a mission card without a host
- **THEN** the title, the objective, the stage, the fail sentence, and the marker are visible
