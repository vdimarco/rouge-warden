## ADDED Requirements

### Requirement: The radar heading reads on an avenue
The heading mark SHALL be a paper wedge with a larger ink wedge behind it. The point and the two tails SHALL stay where they are. Avenue strokes SHALL stay cased, and side streets SHALL stay the grey line.

#### Scenario: The heading sits on the avenue
- **WHEN** the player faces along a wide road and the radar draws
- **THEN** the heading is a solid paper wedge and an ink edge still shows where the avenue is paper

#### Scenario: The avenue rank stays
- **WHEN** the radar draws a wide road and a side street
- **THEN** the wide road keeps its ink casing and paper center, and the side street stays grey
