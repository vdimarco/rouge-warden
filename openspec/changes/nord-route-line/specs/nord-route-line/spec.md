## ADDED Requirements

### Requirement: The card points the way to the diamond
While the mission card is leading to a diamond, it SHALL name whether that stop is ahead, left, right, behind, or here, and SHALL draw a needle in that direction when the stop is not here. On foot the words follow the camera yaw, flattened, so ahead means walk forward and right means strafe right. In a car the words follow the nose. A stop under 1.5 m SHALL say here and SHALL NOT draw a needle.

#### Scenario: Ahead
- **WHEN** the player is on foot, the camera yaw faces the current stop, and it is at least 1.5 m away
- **THEN** the card says ahead
- **AND** the needle points up

#### Scenario: Car nose
- **WHEN** the player is driving and the stop lies along the car's nose, even if the camera yaw points elsewhere
- **THEN** the card says ahead

#### Scenario: Right
- **WHEN** the stop is to the player's right
- **THEN** the card says right
- **AND** the needle points right

#### Scenario: Here
- **WHEN** the player is under 1.5 m from the stop
- **THEN** the card says here
- **AND** no needle is drawn

### Requirement: The radar strokes the route
The radar SHALL draw a gold stroke from the player toward the current diamond, stopping short of the player arrow and the diamond. When the beat has a sequenced next stop, a fainter stroke SHALL continue from the current stop toward that next stop. A rescue group and a side-job guide SHALL NOT draw that continuation.

#### Scenario: Stroke
- **WHEN** the diamond is far enough from the player arrow to leave a gap
- **THEN** the stroke runs from outside the arrow to short of the diamond

#### Scenario: Next stop
- **WHEN** the blank page is on its first gate
- **THEN** the continuation leads toward the second gate

#### Scenario: Either order
- **WHEN** the ovation is on the choice, before either station
- **THEN** no continuation is drawn

#### Scenario: After one station
- **WHEN** the followspot is already set and the backdrop is still open
- **THEN** the continuation leads to the curtain
- **AND** it does not lead back to the followspot

#### Scenario: Rescue
- **WHEN** a rescue group is open
- **THEN** the card still names the turn to the current group
- **AND** no continuation is drawn

### Requirement: An off-screen stop stays on the frame
When the world diamond is outside the safe view, or the pin does not project, the HUD SHALL draw a gold chevron on the inset edge of that view, pointing toward the stop. A stop behind the camera SHALL leave through the bottom of the frame. The on-screen diamond SHALL stay a diamond.

#### Scenario: Off the right
- **WHEN** the stop is ahead and to the right of the camera, outside the safe view
- **THEN** the chevron sits on the right edge of the inset view

#### Scenario: Behind
- **WHEN** the stop is directly behind the camera
- **THEN** the chevron sits on the bottom edge of the inset view

## MODIFIED Requirements

### Requirement: Mission 8 leads after the escape
Once the convoy is banked and the last page is still open, the mission card SHALL show mission 8, the gold diamond SHALL mark the current gate, and the route line SHALL name the turn to that gate. After the page is blank, the side-job guide SHALL return and SHALL keep its own turn line. CompletedMissions SHALL stay at most 2.

#### Scenario: Page opens after the escape
- **WHEN** the campaign phase is Complete, the earlier beats are banked, and the blank step is 0
- **THEN** the card title is 08 / LEAVE THE LAST PAGE BLANK
- **AND** the route line points at the first projection gate
- **AND** a side job does not replace that card
