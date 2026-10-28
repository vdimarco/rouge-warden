## ADDED Requirements

### Requirement: A running job states its objective in English

The job objective, the 3D sign, and the resident lines are English. A place name stays a name. While a job runs, the column shows the objective under the job name.

#### Scenario: The thief objective is English

- **GIVEN** the car thief job is running
- **WHEN** the column is shown
- **THEN** the objective is Ram the stolen car until it gives
- **AND** that sentence has no French accent

#### Scenario: A resident speaks English

- **GIVEN** a resident greets the player
- **WHEN** the line is shown
- **THEN** it is one of the three English greetings
- **AND** it has no French accent

### Requirement: The play shell can show the objective and a resident line with no host

The play page has the objective on the job column and a speech line. A page script can fill both without a running game. An empty line hides the speech.

#### Scenario: An offline frame shows both

- **GIVEN** the play page is open and the host is offline
- **WHEN** the page is given Car thief, Ram the stolen car until it gives, and Hi! A walk in the park feels good.
- **THEN** both are visible
- **AND** those words are shown
