## ADDED Requirements

### Requirement: Mission 14 beats a faster runner on a shorter line
After the grab is banked, the card SHALL ask the player to step on the line, then reach the finish on foot before the runner does. The runner SHALL take the longer road and SHALL be faster than a sprint. A straight sprint on the grass SHALL arrive first. A straight walk on the grass SHALL NOT. A sprint along their road SHALL NOT. A rider SHALL NOT start the race or take the finish. When the runner arrives first, including a tie, the line SHALL return and the beat SHALL NOT pay. The purse SHALL be 600 session cash, paid once. The seven story banks SHALL stay seven. A frame longer than a quarter of a second SHALL spend only that quarter. The lap ghost SHALL stay on the race route.

#### Scenario: The line
- **WHEN** a dry walker steps on the line
- **THEN** the runner leaves on the road and the beat does not pay

#### Scenario: The walk
- **WHEN** the player walks the grass to the finish
- **THEN** the runner arrives first and the line is back

#### Scenario: The sprint
- **WHEN** a dry walker reaches the finish on the grass before the runner
- **THEN** the short way is banked and the purse is 600 once

#### Scenario: The open lines
- **WHEN** the grass and both legs of the runner's road are measured against the surveyed building shells
- **THEN** each line stays more than 2 m from every shell

### Requirement: Recover stands north of the line
Recover SHALL place the player north of the line, outside the line and outside the finish, and SHALL NOT add time. A race replay SHALL NOT rewind the short way.

#### Scenario: The gaps
- **WHEN** the line, the finish, and the north recover are measured
- **THEN** the recover is outside both doors, and the line is more than 50 m from the finish

### Requirement: The short way is stored on version 7
The slot SHALL keep completed missions at 0–2. Version 7 SHALL store the short-way step only after the grab is banked. Version 6 SHALL still load and SHALL start the short way over. Version 1 SHALL still load and SHALL start the pond over. Version 2 SHALL stay rejected and SHALL NOT be overwritten. The runner's clock SHALL stay in the session. A reload during the race SHALL put the runner back on the line.

#### Scenario: A race in progress
- **WHEN** version 7 is read with the grab banked and the short way on the run
- **THEN** the run resumes and the runner is back on the line

#### Scenario: An older grab slot
- **WHEN** version 6 is read
- **THEN** the grab resumes and the short way starts over
