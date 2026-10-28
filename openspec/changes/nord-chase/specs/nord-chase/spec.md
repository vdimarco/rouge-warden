## ADDED Requirements

### Requirement: Mission 15 outruns a car that follows
After the short way is banked, the card SHALL ask the player to get in a real car on the seat, then reach the hide in that car before the tail catches them. The tail SHALL start behind the seat and SHALL follow the player's position. A drive along the straight road SHALL reach the hide. A crawl SHALL be caught. A stopped car SHALL be caught. A walker, a bike, a pedalo, or a scooter SHALL NOT take the seat or the hide. Getting out SHALL NOT stop the tail. When the tail catches the player, including a tie on the hide, the seat SHALL return and the beat SHALL NOT pay. The purse SHALL be 640 session cash, paid once. The seven story banks SHALL stay seven. A frame longer than a quarter of a second SHALL move the tail for only that quarter. The lap ghost SHALL stay on the race route. The police chase SHALL stay on wanted cars. No extra car SHALL be spawned.

#### Scenario: The seat
- **WHEN** a real car stops on the seat
- **THEN** the tail leaves from behind the seat and the beat does not pay

#### Scenario: The crawl
- **WHEN** the car crawls the straight road toward the hide
- **THEN** the tail catches it and the seat is back

#### Scenario: The drive
- **WHEN** a real car drives the straight road to the hide ahead of the tail
- **THEN** the chase is banked and the purse is 640 once

#### Scenario: The road
- **WHEN** the seat, the hide, and the tail's park are measured against the surveyed road and the building shells
- **THEN** each mark sits on the road and the drive from the park to the hide stays more than 2.5 m from every shell

### Requirement: Recover stands beside the seat
Recover SHALL place the player beside the seat, outside the seat and outside the hide, and SHALL NOT put the tail back behind the seat. A race replay SHALL NOT rewind the chase.

#### Scenario: The gaps
- **WHEN** the seat, the hide, and the side recover are measured
- **THEN** the recover is outside both doors, and the seat is more than 170 m from the hide

### Requirement: The chase is stored on version 8
The slot SHALL keep completed missions at 0–2. Version 8 SHALL store the chase step only after the short way is banked. Version 7 SHALL still load and SHALL start the chase over. Version 1 SHALL still load and SHALL start the pond over. Version 2 SHALL stay rejected and SHALL NOT be overwritten. The tail's place on the road SHALL stay in the session. A reload during the chase SHALL put the tail back behind the seat and SHALL leave the step.

#### Scenario: A chase in progress
- **WHEN** version 8 is read with the short way banked and the chase on the tail
- **THEN** the chase resumes and the tail is back behind the seat

#### Scenario: An older short-way slot
- **WHEN** version 7 is read
- **THEN** the short way resumes and the chase starts over
