## ADDED Requirements

### Requirement: Facade courses are not one flat colour
The park-edge facade shader SHALL vary tone per masonry course and darken toward the street, while windows, trim, and the cornice remain distinguishable.

#### Scenario: Read a brick and a stone front
- **WHEN** the facade shader is evaluated across a brick neighbour and a stone neighbour from street level to the cornice
- **THEN** courses are not a single flat fill, the base is darker than the upper floors, and window glass stays a separate tint
