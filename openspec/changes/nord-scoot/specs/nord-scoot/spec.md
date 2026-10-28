## ADDED Requirements

### Requirement: The scooter is faster than a walk and slower than the bike
A kick scooter SHALL top out at 620 cm/s on land and 60 cm/s in the water. It SHALL NOT count as a car, a pedalo, or a bike. Coasting from the top SHALL slow it, and a full lock SHALL turn less at the top than at a stop.

#### Scenario: The kick
- **WHEN** the scooter holds the gas on dry ground
- **THEN** it reaches 620 cm/s and does not climb past it

#### Scenario: The dunk
- **WHEN** the scooter holds the gas in the water
- **THEN** it tops out at 60 cm/s

#### Scenario: The kind
- **WHEN** the ride kind is checked
- **THEN** only kind 3 is a scooter

### Requirement: The stand is a dry lawn
The stand SHALL sit east of the ponds, more than 14 m from a mapped road centre, and more than 6 m from the bike stand.

#### Scenario: The lawn
- **WHEN** the stand is measured
- **THEN** it is east of the pond survey and clear of the bike stand and the roads
