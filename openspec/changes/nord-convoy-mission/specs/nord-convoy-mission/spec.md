## ADDED Requirements

### Requirement: Mission 7 leads after the groups
Once the picnic, the court, the show and every group are banked, and the convoy is not banked, the mission card SHALL show mission 7 and the gold diamond SHALL mark the current convoy stop. Missions 1 through 6 SHALL keep their cards while their own beats are open. CompletedMissions SHALL stay at most 2.

#### Scenario: Convoy opens after the groups
- **WHEN** the campaign phase is Complete, the earlier beats are banked, and the convoy step is 0
- **THEN** the card title is 07 / CAN'T TOW TOMORROW
- **AND** the objective names the ink feeder
- **AND** a side job does not replace that card

#### Scenario: Groups stay first
- **WHEN** a rescue group is still open
- **THEN** the card title is 06 / NOBODY LEFT IN THE PICTURE
- **AND** the convoy posts are hidden

### Requirement: The feeder pull waits for the gap
On the gap step, E at the feeder SHALL advance only while the beam is not painting. A pull during the paint SHALL stay on that step. A pull during the warning SHALL advance. The plate and the escape gate SHALL follow in order, and the escape SHALL bank the mission without writing the save.

#### Scenario: Painted beam
- **WHEN** the player pulls the feeder while the beam is painting
- **THEN** the step stays on the gap
- **AND** the message says to wait for the gap

#### Scenario: Open gap
- **WHEN** the player pulls the feeder during the gap
- **THEN** the step becomes the plate
- **AND** CompletedMissions is unchanged

#### Scenario: Escape
- **WHEN** the plate is inverted and the player takes the escape gate
- **THEN** the step becomes banked
- **AND** CompletedMissions is still 2
- **AND** the side-job guide can return

### Requirement: Recover does not rewind a disruption
R SHALL put the player beside the current stop without lowering the step. T SHALL wait until the escape is banked. Starting a side job while the convoy is open SHALL be refused.

#### Scenario: Recover
- **WHEN** the player presses R during an open convoy step
- **THEN** the player is moved beside that stop
- **AND** the step index is unchanged
- **AND** the status says R recovers this wagon

#### Scenario: Race replay waits
- **WHEN** the player presses T while the convoy is open
- **THEN** the race does not restart
- **AND** the message says T replays the race after the escape

## MODIFIED Requirements

### Requirement: Mission 6 leads after the curtain
Once the picnic, the court and the show are banked and a group is still in the picture, the mission card SHALL show mission 6 and the gold diamond SHALL mark the first unfinished group. After every group is out, mission 7 SHALL lead until the escape is banked, and only then SHALL the side-job guide return. CompletedMissions SHALL stay at most 2.

#### Scenario: Groups open after the curtain
- **WHEN** the campaign phase is Complete, the pond, court and show are banked, and the rescue mask is 0
- **THEN** the card title is 06 / NOBODY LEFT IN THE PICTURE
- **AND** a side job does not replace that card

#### Scenario: Groups banked
- **WHEN** the rescue mask is 7 and the convoy step is before banked
- **THEN** the card shows mission 7
- **AND** the side-job guide waits
