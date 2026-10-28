## ADDED Requirements

### Requirement: Mission 4 leads after the picnic
Once the picnic is banked and the court is still looping, the mission card SHALL show mission 4 and the gold diamond SHALL mark the current court step. Missions 1, 2 and 3 SHALL keep the card while they are in progress. After the court clamp is banked, the side-job guide SHALL return. CompletedMissions SHALL stay at most 2.

#### Scenario: Pond still in progress
- **WHEN** the campaign phase is Complete and the pond step is before banked
- **THEN** the card title is 03 / STILL LIFE, MOVING TARGET
- **AND** the court posts stay hidden

#### Scenario: Court opens after the picnic
- **WHEN** the campaign phase is Complete, the pond step is banked, and the court step is before banked
- **THEN** the card title is 04 / MATCH POINTLESS
- **AND** the gold diamond marks the current court step
- **AND** a side job does not replace that card

#### Scenario: Court banked
- **WHEN** the campaign phase is Complete and the court step is banked
- **THEN** the card returns to the side-job guide
- **AND** CompletedMissions is still 2

### Requirement: The gold panel restarts the rally once
Scoring a panel other than the gold panel, or scoring the gold panel while the ball is elsewhere, SHALL leave the rally step in place. Scoring the gold panel while the ball is on it SHALL open the return gate. Scoring the gold panel again SHALL stay on that checkpoint.

#### Scenario: Score too early
- **WHEN** the player scores before arriving on the court
- **THEN** the step stays on arrive

#### Scenario: Decoy or mistimed gold
- **WHEN** the player scores a decoy panel, or the gold panel while the ball is on another panel
- **THEN** the step stays on the rally

#### Scenario: Gold once
- **WHEN** the player scores the gold panel while the ball is on it
- **THEN** the step becomes the return-gate bank
- **AND** scoring the gold panel again leaves the step there

### Requirement: The bank shot waits for a clear middle
Banking before the return gate is open SHALL leave the rally in place. Banking while the ink is dangerous, or while the ball is not on the middle panel, SHALL leave the redirect step in place. A clear bank SHALL expose the clamp. Pulling the clamp SHALL bank the court without writing the save.

#### Scenario: Bank before the loop
- **WHEN** the player banks the ball before the gold panel has been scored
- **THEN** the step stays on the rally

#### Scenario: Ink on the line
- **WHEN** the player banks while the sweep is dangerous
- **THEN** the step stays on the redirect

#### Scenario: Clear bank and pull
- **WHEN** the player banks while the ball is on the middle panel and the sweep is clear, then pulls the clamp
- **THEN** the step becomes banked
- **AND** CompletedMissions is unchanged

### Requirement: Recover does not rewind the court
R SHALL put the player back near the current rally without lowering the step index. T SHALL wait until the court is banked. Starting a side job while the court is open SHALL be refused.

#### Scenario: Recover
- **WHEN** the player presses R during an open court step
- **THEN** the player is moved north of that step
- **AND** the step index is unchanged

#### Scenario: Race replay waits
- **WHEN** the player presses T while the court is open
- **THEN** the race does not restart
- **AND** the message says T replays the race after the court is free

#### Scenario: Side job waits
- **WHEN** the player presses E at a side-job marker while the court is open
- **THEN** the job does not start

## MODIFIED Requirements

### Requirement: Mission 3 leads after the race
Once the race is banked and the picnic is still in the picture, the mission card SHALL show mission 3 and the gold diamond SHALL mark the current pond step. Missions 1 and 2 SHALL keep the card while they are in progress. After the picnic is banked, mission 4 SHALL lead until the court is banked, and only then SHALL the side-job guide return.

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
- **WHEN** the campaign phase is Complete and the pond step is banked and the court step is before banked
- **THEN** the card shows mission 4
- **AND** CompletedMissions is still 2
