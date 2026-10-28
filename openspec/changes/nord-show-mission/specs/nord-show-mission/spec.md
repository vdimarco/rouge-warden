## ADDED Requirements

### Requirement: Mission 5 leads after the court
Once the court is banked and the show is still open, the mission card SHALL show mission 5 and the gold diamond SHALL mark the current show step. Missions 1 through 4 SHALL keep the card while they are in progress. After the curtain, the side-job guide SHALL return. CompletedMissions SHALL stay at most 2.

#### Scenario: Court still in progress
- **WHEN** the campaign phase is Complete, the pond is banked, and the court step is before banked
- **THEN** the card title is 04 / MATCH POINTLESS
- **AND** the show posts stay hidden

#### Scenario: Show opens after the court
- **WHEN** the campaign phase is Complete, the pond and the court are banked, and the show step is before banked
- **THEN** the card title is 05 / STANDING OVATION
- **AND** the gold diamond marks the current show step
- **AND** a side job does not replace that card

#### Scenario: Show banked
- **WHEN** the show step is banked
- **THEN** the card returns to the side-job guide
- **AND** CompletedMissions is still 2

### Requirement: The first two stations accept either order
Setting the followspot first and the backdrop second SHALL open the curtain. Setting the backdrop first and the followspot second SHALL open the curtain. Setting one station twice SHALL leave the other station still required. The curtain SHALL refuse to fire before both stations are set.

#### Scenario: Followspot first
- **WHEN** the player sets the followspot and then the backdrop
- **THEN** the step becomes the curtain cue

#### Scenario: Backdrop first
- **WHEN** the player hangs the backdrop and then sets the followspot
- **THEN** the step becomes the curtain cue

#### Scenario: Curtain too early
- **WHEN** the player calls the curtain with one station still unset
- **THEN** the step stays on that station

### Requirement: The curtain is a page
Calling the curtain from the loading edge SHALL bank the show and reveal four panels plus the souvenir. The local page sound SHALL play on that transition. The call SHALL not write the save.

#### Scenario: Curtain
- **WHEN** both stations are set and the player calls the curtain at the loading edge
- **THEN** the step becomes banked
- **AND** the four panels are visible
- **AND** CompletedMissions is unchanged

### Requirement: Recover does not rewind the show
R SHALL put the player south of the current step without lowering the step index. T SHALL wait until the show is banked. Starting a side job while the show is open SHALL be refused.

#### Scenario: Recover
- **WHEN** the player presses R during an open show step
- **THEN** the player is moved south of that step
- **AND** the step index is unchanged

#### Scenario: Race replay waits
- **WHEN** the player presses T while the show is open
- **THEN** the race does not restart
- **AND** the message says T replays the race after the curtain

## MODIFIED Requirements

### Requirement: Mission 4 leads after the picnic
Once the picnic is banked and the court is still looping, the mission card SHALL show mission 4 and the gold diamond SHALL mark the current court step. After the court clamp is banked, mission 5 SHALL lead until the show is banked, and only then SHALL the side-job guide return. CompletedMissions SHALL stay at most 2.

#### Scenario: Court opens after the picnic
- **WHEN** the campaign phase is Complete, the pond step is banked, and the court step is before banked
- **THEN** the card title is 04 / MATCH POINTLESS
- **AND** a side job does not replace that card

#### Scenario: Court banked
- **WHEN** the court step is banked and the show step is before banked
- **THEN** the card shows mission 5
- **AND** CompletedMissions is still 2
