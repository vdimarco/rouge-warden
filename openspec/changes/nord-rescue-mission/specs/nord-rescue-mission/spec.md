## ADDED Requirements

### Requirement: Mission 6 leads after the curtain
Once the picnic, the court and the show are banked and a group is still in the picture, the mission card SHALL show mission 6 and the gold diamond SHALL mark the first unfinished group. Missions 1 through 5 SHALL keep their cards while their own beats are open. CompletedMissions SHALL stay at most 2.

#### Scenario: Groups open after the curtain
- **WHEN** the campaign phase is Complete, the pond, court and show are banked, and the rescue mask is 0
- **THEN** the card title is 06 / NOBODY LEFT IN THE PICTURE
- **AND** the objective names the terrace, the pond and the court
- **AND** a side job does not replace that card

#### Scenario: Earlier beats stay first
- **WHEN** the show is still open
- **THEN** the card title is 05 / STANDING OVATION
- **AND** the rescue posts are hidden

### Requirement: Any open group accepts the pull
While mission 6 is open, E at an unfinished post SHALL set that group's bit and SHALL leave the other bits unchanged. E at a finished post SHALL say that group is already out. The last new bit SHALL bank the mission without writing the save.

#### Scenario: One group
- **WHEN** the player frees the pond while the terrace and the court are still open
- **THEN** the pond bit is set
- **AND** the terrace and the court stay open
- **AND** CompletedMissions is unchanged

#### Scenario: Repeat
- **WHEN** the player uses E at a group that is already out
- **THEN** the mask is unchanged
- **AND** the message says that group is already out

#### Scenario: Last group
- **WHEN** the player frees the only remaining group
- **THEN** the mask is 7
- **AND** CompletedMissions is still 2
- **AND** the side-job guide can return

### Requirement: Recover does not clear a freed group
R SHALL put the player beside the current group without clearing bits. The terrace recover SHALL step east. The pond and court recovers SHALL step south. T SHALL wait until every group is out. Starting a side job while a group is open SHALL be refused.

#### Scenario: Recover
- **WHEN** the player presses R during an open group
- **THEN** the player is moved beside that group
- **AND** the freed bits stay set
- **AND** the status says R recovers this group

#### Scenario: Terrace stays dry
- **WHEN** the current group is the terrace
- **THEN** the recover point is east of that post

#### Scenario: Race replay waits
- **WHEN** the player presses T while a group is still open
- **THEN** the race does not restart
- **AND** the message says T replays the race after the last group is out

## MODIFIED Requirements

### Requirement: Mission 4 leads after the picnic
Once the picnic is banked and the court is still looping, the mission card SHALL show mission 4 and the gold diamond SHALL mark the current court step. After the court clamp is banked, mission 5 SHALL lead until the show is banked. After the curtain, mission 6 SHALL lead until every group is out, and only then SHALL the side-job guide return. CompletedMissions SHALL stay at most 2.

#### Scenario: Court opens after the picnic
- **WHEN** the campaign phase is Complete, the pond step is banked, and the court step is before banked
- **THEN** the card title is 04 / MATCH POINTLESS
- **AND** a side job does not replace that card

#### Scenario: Court banked
- **WHEN** the court step is banked and the show step is before banked
- **THEN** the card shows mission 5
- **AND** CompletedMissions is still 2

#### Scenario: Show banked
- **WHEN** the show is banked and a group is still open
- **THEN** the card shows mission 6
- **AND** the side-job guide waits
