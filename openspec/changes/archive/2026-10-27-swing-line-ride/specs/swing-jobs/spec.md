## ADDED Requirements

### Requirement: Ride the line
An odd job SHALL string a line across the street, above it. The card SHALL name the line and tell the player to swing onto it. A swing in the air, within 3.5 m of the line and at 9 m/s or faster across the ground, SHALL catch it. Standing on the ground, or swinging slower than that, SHALL NOT catch it. Once caught, the line SHALL carry the hero to the far end and launch them off. The clock SHALL be 16 s, and running it out before the catch SHALL miss as snapped. The line SHALL NOT replace a flush.

#### Scenario: The line is up
- **WHEN** the player takes the line
- **THEN** the card says to swing onto it

#### Scenario: On the ground
- **WHEN** the hero stands where the line is
- **THEN** the line is not caught

#### Scenario: A fast swing
- **WHEN** the hero swings onto the line in the air, close and fast
- **THEN** the line catches them and carries them

#### Scenario: Off the end
- **WHEN** the ride reaches the far end
- **THEN** the hero is launched off the line

#### Scenario: It goes by
- **WHEN** the 16 s clock runs out before the catch
- **THEN** the lesson card says the line went by
