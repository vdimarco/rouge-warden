# loon-echo Specification

## Purpose
Loon Echo has the player lead a line of chicks home past an eel and boats, one clutch after another.

## Requirements

### Requirement: Rocks block without damage
Loon Echo SHALL let the loon slide around rocks without losing energy.

#### Scenario: Swim into a rock
- **WHEN** the loon swims into a rock
- **THEN** it slides around the rim with a soft bonk, and it loses no energy

#### Scenario: A target inside a rock
- **WHEN** the player taps a point inside a rock
- **THEN** the loon stops at the rim

### Requirement: The chick line keeps its shape
Loon Echo SHALL keep the rescued chicks spaced along the loon's path, so the loon stays easy to see.

#### Scenario: Honk
- **WHEN** the player honks
- **THEN** the chicks keep their spacing, and the loon's ring stays in view

### Requirement: Clutch after clutch
Loon Echo SHALL go on after a full nest, with more danger each time, and end only when energy runs out.

#### Scenario: A full nest
- **WHEN** all eight chicks of a clutch are home
- **THEN** energy refills and the next clutch hatches at new spots, with a faster eel, a second eel from clutch 3, and more boats from clutch 4

#### Scenario: The end
- **WHEN** the loon's energy runs out
- **THEN** the run ends, and the end card shows the clutches, the chicks home and the time

### Requirement: Only a warned strike costs energy
Loon Echo SHALL warn of every eel strike that costs energy.

#### Scenario: A lunge
- **WHEN** an eel lunges
- **THEN** a warning in sight and sound comes at least 0.55 s before the strike

#### Scenario: A touch from a hunting eel
- **WHEN** a hunting eel touches the chick line
- **THEN** it takes back one chick, and the loon loses no energy

### Requirement: A big bank is a big moment
Loon Echo SHALL celebrate a large group of chicks brought home at once.

#### Scenario: Bank four or more
- **WHEN** the player banks 4 or more chicks at once
- **THEN** at least 0.6 s of slow motion plays while the chicks hop into the nest on a rising scale and "+100 × n²" counts up

#### Scenario: Bank all eight
- **WHEN** the player banks all eight chicks at once
- **THEN** fireworks go off

### Requirement: Today's lake
Loon Echo SHALL give the crew the same lake each day, and a line to share.

#### Scenario: The same day
- **WHEN** two players open the game on the same day
- **THEN** they get the same rocks, fish, boat lanes and chick spots

#### Scenario: Share a run
- **WHEN** a run ends
- **THEN** the end card shows a line to copy, for example "Lake #276 · 3 clutches · 22 home · 2:14"
