## MODIFIED Requirements

### Requirement: Mission 1, Sludge Run
A gang runner in hazard yellow SHALL run the streets from under the start roof to the Market drain at 5.4 m/s. The card SHALL show the time left and the distance, and the compass SHALL point at him. Knocking him down (a punch, a rope pull, a dive or a car) SHALL bring his crew of three.

On a first lesson (the training checklist or the spoken tutorial still on its first row), the runner SHALL wait and the clock SHALL NOT count down. The card SHALL keep the time left and SHALL say to swing first. The first rope, or the end of that first row (including Skip), SHALL start the run and the clock. A start with the lesson already past, including a retry, SHALL run at once.

#### Scenario: The chase
- **WHEN** Mission 1 starts after the first lesson
- **THEN** the card shows SLUDGE RUN with the time left, and the runner moves toward the Market drain

#### Scenario: The first lesson holds the chase
- **WHEN** Mission 1 starts while the first training row is still open
- **THEN** the card shows SLUDGE RUN with the time left and tells the player to swing first
- **AND** three seconds later the time left is the same and the runner has not moved along his path

#### Scenario: A swing starts the clock
- **WHEN** the player attaches a rope during that wait
- **THEN** the runner runs toward the Market drain and the time left falls
