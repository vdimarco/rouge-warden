## ADDED Requirements

### Requirement: A running side job names itself in English

The six jobs are Hot delivery, Car thief, Ink overrun, Five stars, Three posters, and The fare. While one runs, the column shows that name, the distance, and damage for the thief or a down count for the crew. The start prompt says JOB and again. A job already running says JOB ON and R restarts. The 3D signs do not change.

#### Scenario: The thief column names the damage

- **GIVEN** the car thief job is running
- **WHEN** the column is shown
- **THEN** the name is Car thief
- **AND** the line includes the distance and damage

#### Scenario: A finished job can be played again

- **GIVEN** a job is already completed
- **WHEN** the player stands at its marker
- **THEN** the prompt includes again

### Requirement: The play shell can show the column with no host

The play page has a job column. A page script can fill it without a running game. An empty name hides it.

#### Scenario: An offline frame shows the thief

- **GIVEN** the play page is open and the host is offline
- **WHEN** the page is given Car thief and a damage line
- **THEN** the column is visible
- **AND** those words are shown
