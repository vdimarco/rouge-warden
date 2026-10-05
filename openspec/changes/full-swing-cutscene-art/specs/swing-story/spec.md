## ADDED Requirements

### Requirement: Painted scene panels
The opening, the King waking and the finale SHALL show painted pictures of the game's city, King and hero in their panels. A
picture SHALL fill the inked frame, cropped so its subject stays in view on a wide screen and on a phone held upright, with
no live city showing round the frame. A balloon SHALL point at the speaker's face in the picture, and no balloon SHALL cover
the caption.

#### Scenario: Opening on desktop
- **WHEN** a new player finishes the cottage opening in flat play
- **THEN** the five opening panels show the city and the Needle, the King asleep, the clogs, the hero with the plunger, and the swing behind the Mission 1 card

#### Scenario: Opening on a phone
- **WHEN** the opening plays on a phone held upright
- **THEN** each picture fills the frame around its subject, and its caption and balloon sit inside the screen, clear of each other and of the SKIP button

### Requirement: Live shot when a picture is missing
A panel whose picture has not loaded when the panel starts SHALL show the live city shot instead, with the same words.

#### Scenario: Offline before the cache
- **WHEN** a picture cannot load
- **THEN** its panel shows the live shot and the scene plays on
