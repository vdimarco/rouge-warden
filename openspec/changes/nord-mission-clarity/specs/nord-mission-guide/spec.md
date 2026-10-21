## ADDED Requirements

### Requirement: Free-roam mission card names a side job
After the story campaign is complete, the mission card SHALL name a side job and the gold diamond SHALL mark where to go. While the story is still in progress, the story objective SHALL keep the diamond.

#### Scenario: Story still in progress
- **WHEN** the campaign is not complete
- **THEN** the mission card shows the story title and objective
- **AND** a running side job does not replace that card

#### Scenario: Next job after the story
- **WHEN** the campaign is complete, no side job is running, and at least one side job is unfinished
- **THEN** the card title is NEXT SIDE JOB, the action names the nearest unfinished job, and the gold diamond sits on that job's marker with a distance
- **AND** the status tells a keyboard player to press E at the yellow M and a touch player to use Use at the yellow M

#### Scenario: Running job after the story
- **WHEN** the campaign is complete and a side job is running
- **THEN** the card shows that job's title, its objective and its remaining time
- **AND** the gold diamond sits on the job target
- **AND** the status tells a keyboard player that R restarts and a touch player that Menu · Recover restarts

#### Scenario: Every job already finished
- **WHEN** the campaign is complete, no side job is running, and every side job is finished
- **THEN** the card title is REPLAY A SIDE JOB and the diamond marks the nearest marker

### Requirement: A failed job tells a touch player how to retry
The failure banner SHALL name the control that restarts the job on both keyboard and touch.

#### Scenario: Touch failure
- **WHEN** a side job fails and the player is on a touch screen during the retry window
- **THEN** the MISSION RATÉE line includes Menu · Recover

#### Scenario: Keyboard failure
- **WHEN** a side job fails and the player is on a keyboard during the retry window
- **THEN** the MISSION RATÉE line includes R réessaie
