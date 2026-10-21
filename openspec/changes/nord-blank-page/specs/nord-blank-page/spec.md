## ADDED Requirements

### Requirement: Mission 8 leads after the escape
Once the convoy is banked and the last page is still open, the mission card SHALL show mission 8 and the gold diamond SHALL mark the current gate. Missions 1 through 7 SHALL keep their cards while their own beats are open. CompletedMissions SHALL stay at most 2.

#### Scenario: Page opens after the escape
- **WHEN** the campaign phase is Complete, the earlier beats are banked, and the blank step is 0
- **THEN** the card title is 08 / LEAVE THE LAST PAGE BLANK
- **AND** the objective names the first projection gate
- **AND** a side job does not replace that card

#### Scenario: Convoy stays first
- **WHEN** the convoy is still open
- **THEN** the card title is 07 / CAN'T TOW TOMORROW
- **AND** the blank-page posts are hidden

### Requirement: The gates stay in order
Walking through the current gate SHALL advance one step and SHALL NOT skip a later gate. E at the cue SHALL bank the page without writing the save. E at a gate SHALL NOT bank the page.

#### Scenario: One gate
- **WHEN** the player walks through the first gate
- **THEN** the diamond marks the second gate
- **AND** the third gate is not the objective

#### Scenario: Blank page
- **WHEN** the third gate is crossed and the player leaves the page blank
- **THEN** the step becomes banked
- **AND** CompletedMissions is still 2
- **AND** the side-job guide can return

### Requirement: Recover does not uncross a gate
R SHALL put the player beside the current gate without lowering the step. T SHALL wait until the page is blank. Starting a side job while the page is open SHALL be refused.

#### Scenario: Recover
- **WHEN** the player presses R during an open blank step
- **THEN** the player is moved beside that step
- **AND** the step index is unchanged
- **AND** the status says R recovers this page

#### Scenario: Race replay waits
- **WHEN** the player presses T while the page is open
- **THEN** the race does not restart
- **AND** the message says T replays the race after it is blank

## MODIFIED Requirements

### Requirement: Mission 7 leads after the groups
Once the picnic, the court, the show and every group are banked, and the convoy is not banked, the mission card SHALL show mission 7 and the gold diamond SHALL mark the current convoy stop. After the escape, mission 8 SHALL lead until the page is blank, and only then SHALL the side-job guide return. CompletedMissions SHALL stay at most 2.

#### Scenario: Convoy opens after the groups
- **WHEN** the campaign phase is Complete, the earlier beats are banked, and the convoy step is 0
- **THEN** the card title is 07 / CAN'T TOW TOMORROW
- **AND** a side job does not replace that card

#### Scenario: Escape banked
- **WHEN** the convoy step is banked and the blank step is before banked
- **THEN** the card shows mission 8
- **AND** the side-job guide waits
