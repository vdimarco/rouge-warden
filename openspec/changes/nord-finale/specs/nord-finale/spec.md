## ADDED Requirements

### Requirement: Mission 16 is one shorter day
After the tail is lost, the card SHALL ask the player to walk up, cross a shorter dark, sprint a page, cut the grass, and drive a short hide. A fail SHALL return to that stage and SHALL NOT return to the meet. The purse SHALL be 800 session cash, paid once, when the hide is reached in a real car. The seven story banks SHALL stay seven. A walker, a bike, a pedalo, or a scooter SHALL NOT clear a foot stage or take the seat or the hide. The lap ghost SHALL stay on the race route. The police chase SHALL stay on wanted cars. No extra car SHALL be spawned.

#### Scenario: The walk-up
- **WHEN** the player walks up to them
- **THEN** the dark opens and the beat does not pay

#### Scenario: The dark
- **WHEN** the player walks the straight line between the lamps
- **THEN** the crossing burns and the south dark does not open until they return to the pocket

#### Scenario: The page
- **WHEN** the player sprints the page on foot, including from the south edge of the case or the north edge
- **THEN** the cut opens
- **WHEN** the player walks the page, including from the south edge of the case
- **THEN** the page is back and the beat does not pay

#### Scenario: The grass
- **WHEN** the player sprints the grass, including from the south edge of the line or the north edge
- **THEN** the seat opens
- **WHEN** the player walks the grass, including from the south edge of the line, or sprints their road
- **THEN** the line is back

#### Scenario: The last drive
- **WHEN** a real car drives the short road to the hide ahead of the tail
- **THEN** the day is banked and the purse is 800 once
- **WHEN** the car crawls or stops
- **THEN** the seat is back and nothing is paid

### Requirement: The marks sit on open ground
The foot marks SHALL sit more than 14 m from a road centre. The seat, the hide, and the tail's park SHALL sit on the surveyed road. The drives and the walks SHALL stay more than 2.5 m from every surveyed building shell.

#### Scenario: The ground
- **WHEN** the meet, the dark, the page, the grass, and the car edge are measured against the surveyed roads and the building shells
- **THEN** the foot marks are off the roads, the car marks are on the road, and each path stays clear of the shells

### Requirement: Recover keeps the stage
Recover SHALL place the player off the current stage. On the dark it SHALL clear the burn. It SHALL NOT rewind the stage, the page clock, the rival's clock, or the tail. A race replay SHALL NOT rewind the day.

#### Scenario: The stage stays
- **WHEN** the player recovers during the page, the cut, or the chase
- **THEN** the stage is the same and the clock or the tail is not put back

### Requirement: The day is stored on version 9
The slot SHALL keep completed missions at 0–2. Version 9 SHALL store the finale stage only after the chase is banked. Version 8 SHALL still load and SHALL start the day over. Version 1 SHALL still load and SHALL start the pond over. Version 2 SHALL stay rejected and SHALL NOT be overwritten. The burn, the page clock, the rival's clock, and the tail's place SHALL stay in the session. A reload SHALL keep the stage and SHALL clear those.

#### Scenario: A day in progress
- **WHEN** version 9 is read with the chase banked and the day on the page
- **THEN** the page resumes and the clock is back at the start

#### Scenario: An older chase slot
- **WHEN** version 8 is read
- **THEN** the chase resumes and the day starts over
