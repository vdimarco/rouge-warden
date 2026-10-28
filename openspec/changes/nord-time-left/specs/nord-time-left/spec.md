## ADDED Requirements

### Requirement: The card names the time left to the diamond
On foot the card SHALL name the walk and the sprint left to the current diamond. At or inside the widest step reach that clock SHALL drop. The last approach of a beat, and a rescue group, SHALL get that clock even though the stored next leg is silent. In a car the card SHALL keep the stored leg.

#### Scenario: Still on the way
- **WHEN** you are eighteen metres from the diamond
- **THEN** the clock is a four-second walk and a two-second sprint, and that walk is not the pond's next leg

#### Scenario: At the work
- **WHEN** you are inside the widest step reach
- **THEN** the clock drops

#### Scenario: Last approach
- **WHEN** the pond's last stored leg is silent and you are still walking from the dash to the picnic
- **THEN** the clock names a walk and a shorter sprint

#### Scenario: Rescue
- **WHEN** a rescue group has no stored walk and you are nine metres from it
- **THEN** the clock is a two-second walk and a one-second sprint
