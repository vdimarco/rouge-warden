## ADDED Requirements

### Requirement: Mission 13 takes a case and beats a short window
After the crossing is banked, the card SHALL ask the player to take the case on foot, then reach the drop on foot before twelve seconds pass. A straight walk SHALL NOT arrive in time. A straight sprint SHALL. A rider SHALL NOT take the case or finish the drop. When the window shuts, the case SHALL return to the start and the beat SHALL NOT pay. The purse SHALL be 560 session cash, paid once. The seven story banks SHALL stay seven. A frame longer than a quarter of a second SHALL spend only that quarter.

#### Scenario: The case
- **WHEN** a dry walker takes the case
- **THEN** the window opens at twelve seconds and does not pay

#### Scenario: The walk
- **WHEN** the player walks the straight line to the drop
- **THEN** the window shuts before they arrive and the case is back

#### Scenario: The sprint
- **WHEN** a dry walker reaches the drop with time left
- **THEN** the grab is banked and the purse is 560 once

#### Scenario: The open line
- **WHEN** the straight line from the case to the drop is measured against the surveyed building shells
- **THEN** the line stays more than 2 m from every shell, so a sprint does not run into a wall

### Requirement: Recover stands north of the case
Recover SHALL place the player north of the case, outside the case and outside the drop, and SHALL NOT add time. A race replay SHALL NOT rewind the grab.

#### Scenario: The gaps
- **WHEN** the case, the drop, and the north recover are measured
- **THEN** the recover is outside both doors, and the case is more than 50 m from the drop

### Requirement: The grab is stored on version 6
The slot SHALL keep completed missions at 0–2. Version 6 SHALL store the grab step only after the crossing is banked. Version 5 SHALL still load and SHALL start the grab over. Version 1 SHALL still load and SHALL start the pond over. Version 2 SHALL stay rejected and SHALL NOT be overwritten. The clock SHALL stay in the session. A reload during the run SHALL give the full window again.

#### Scenario: A grab in progress
- **WHEN** version 6 is read with the crossing banked and the grab on the run
- **THEN** the run resumes and the window is full

#### Scenario: An older crossing slot
- **WHEN** version 5 is read
- **THEN** the crossing resumes and the grab starts over
