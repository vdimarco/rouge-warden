## ADDED Requirements

### Requirement: A locked door to a private world
The alley SHALL have a door for each private world in `PRIVATE` (hall.js), after the six zone doors. The Home door SHALL
stand on the east wall of the north street, with the name Home on its sign and no picture of its world. Its card SHALL
say "Locked · a private world". A private world SHALL NOT have a zone button, a number key, games, or links in the list.
Going through the door SHALL show a card with a password field, Open and Cancel. A wrong password SHALL be refused with
a message and SHALL NOT load the world. Esc and Cancel SHALL close the card and leave the visitor in the alley. No file
of the world SHALL be requested before the right password. The right password SHALL open the world, and the door SHALL
open without the card again for the rest of the visit.

#### Scenario: A wrong password
- **WHEN** the visitor clicks the Home door and types a wrong password
- **THEN** the card says "That is not the password." and the visitor stays in the alley

#### Scenario: The right password
- **WHEN** the visitor types the right password and presses Enter
- **THEN** the house loads and the visitor stands in the salon, facing the doorways

### Requirement: The sealed files
A private world's splat files SHALL be in the repository only in sealed form: AES-GCM with a key from the password
through PBKDF2-SHA256 with at least 300,000 iterations. The password SHALL NOT be in the repository.

#### Scenario: No plain copy
- **WHEN** the node check reads the Home folder
- **THEN** it finds 150k.bin, 500k.bin and full.bin, none of them a plain SPZ file, and no .spz file

### Requirement: A house with floors
A world with `floors` SHALL be walked on its floor boxes. The visitor SHALL walk from room to room only through the
doorways, SHALL go down the stairs to the basement and back up, and SHALL NOT pass through a wall or drop to a floor
below. The eye SHALL stay at eye height over the floor on the stairs. The portal on the salon's street wall, Esc,
Backspace and the Alley button SHALL lead back to the Home door.

#### Scenario: Down the stairs
- **WHEN** the visitor stands at the top of the stairs and holds W
- **THEN** the view goes down the stairs and stops in the basement, 3.05 m below the ground floor

#### Scenario: A wall
- **WHEN** the visitor walks at the wall between the salon and the bedroom away from the doorway
- **THEN** the wall stops the visitor
