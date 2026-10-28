## ADDED Requirements

### Requirement: Trois affiches is a tour in any order
The fifth side job SHALL send the player to three corners of rue Gauthier. The corners SHALL be pasteable in any order. Pasting one corner twice SHALL NOT count as two. The clock SHALL stay the base two minutes. A walk of the nearest-first route SHALL fit that clock. The pay SHALL be 350, and the goon pay SHALL stay 300.

#### Scenario: Any order
- **WHEN** the three corners are pasted in either direction
- **THEN** the tour is done and the mask is the same

#### Scenario: Twice
- **WHEN** the Papineau corner is pasted twice
- **THEN** it still counts as one corner

#### Scenario: The walk
- **WHEN** the player takes the nearest unfinished corner each time, starting from the marker
- **THEN** the walk fits two minutes and the marker itself does not paste a corner
