## ADDED Requirements

### Requirement: Wide roads draw a broken center line
A La Fontaine road at least 9 m wide and at least 15 m long SHALL draw a broken white center line. A narrower road SHALL stay unmarked. The dashes SHALL not collide. A second spawn in the same world SHALL add no more dashes.

#### Scenario: A boulevard is marked
- **WHEN** a road is 14 m wide and 83.51 m long
- **THEN** the center line is 18 dashes, each 180 cm by 22 cm, with a gap between them

#### Scenario: A narrow street is bare
- **WHEN** a road is under 9 m wide
- **THEN** no center dash is added

#### Scenario: The pool is one per world
- **WHEN** the paint is spawned and spawned again
- **THEN** the second spawn adds nothing
