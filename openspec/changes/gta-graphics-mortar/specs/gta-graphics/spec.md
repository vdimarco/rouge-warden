## ADDED Requirements

### Requirement: Courses read as masonry
The estimated facade shader SHALL draw a pale mortar bed between courses and a lighter upper edge on each course. Doors, lamps, and rails SHALL stay readable.

#### Scenario: Read a wall from the street
- **WHEN** the facade shader is evaluated across several courses of a wall
- **THEN** the joints are a pale bed rather than a darkened brick, the top of each course is lighter, and the door and lit windows remain
