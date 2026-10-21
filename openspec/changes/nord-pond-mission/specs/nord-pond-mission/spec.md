## ADDED Requirements

### Requirement: Mission 3 leads after the race
Once the race is banked and the picnic is still in the picture, the mission card SHALL show mission 3 and the gold diamond SHALL mark the current pond step. Missions 1 and 2 SHALL keep the card while they are in progress. After the picnic is banked, the side-job guide SHALL return.

#### Scenario: Story still in progress
- **WHEN** the campaign phase is before Complete
- **THEN** the mission card shows mission 1 or mission 2
- **AND** the pond posts stay hidden

#### Scenario: Pond opens after the lap
- **WHEN** the campaign phase is Complete and the pond step is before banked
- **THEN** the card title is 03 / STILL LIFE, MOVING TARGET
- **AND** the gold diamond marks the current step
- **AND** a side job does not replace that card

#### Scenario: Picnic banked
- **WHEN** the campaign phase is Complete and the pond step is banked
- **THEN** the card returns to the side-job guide
- **AND** CompletedMissions is still 2

### Requirement: The postcard beam is the one that stays lit
Tagging a blinking beam SHALL leave the player on the tag step. Tagging the steady beam SHALL move the worklight to the near lock.

#### Scenario: Wrong beam
- **WHEN** the player tags a beam that blinks
- **THEN** the step stays on tag
- **AND** the message says that beam blinks with the sky

#### Scenario: Steady beam
- **WHEN** the player tags the beam that never blinks
- **THEN** the step becomes the near lock

### Requirement: The path is a sprint
Walking onto the finish SHALL leave the dash step in place. Sprinting into the finish from outside the ring, after having been far from it, SHALL open the picnic clamp.

#### Scenario: Walk
- **WHEN** the player walks across the finish ring
- **THEN** the step stays on the dash

#### Scenario: Sprint
- **WHEN** the player was far from the finish and sprints across the ring
- **THEN** the step becomes the picnic pull

### Requirement: Recover does not rewind the pond
R SHALL put the player back near the current step without lowering the step index. T SHALL wait until the picnic is banked. Starting a side job while the pond is open SHALL be refused.

#### Scenario: Recover
- **WHEN** the player presses R during an open pond step
- **THEN** the player is moved north of that step
- **AND** the step index is unchanged

#### Scenario: Race replay waits
- **WHEN** the player presses T while the pond is open
- **THEN** the race does not restart
- **AND** the message says T replays the race after the picnic is free

#### Scenario: Side job waits
- **WHEN** the player presses E at a side-job marker while the pond is open
- **THEN** the job does not start
- **AND** the notice says PAS MAINTENANT
