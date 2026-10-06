## ADDED Requirements

### Requirement: Steal a moving traffic car
In flat play, when the hero is on the ground or less than 3 m above it, not on a wall and not in a car, and the body of a
moving street car is within 3.5 m, the car key (R on a keyboard, B on a pad, the CAR button on a phone) SHALL steal that car.
The car SHALL stop where it was, in the traffic car's colour and heading, and the hero SHALL drive it with the driving model
of the parked cars.

#### Scenario: Step out beside a car
- **WHEN** the hero stands on the road 3 m to the side of a street car driving past, and the player presses R
- **THEN** the hero is in a stopped car at that car's place, facing its way, in its colour
- **AND** W drives it faster than 6 m/s within 2 s

#### Scenario: Land beside a car from a swing
- **WHEN** the hero drops to 2 m above the road next to a moving street car and the player presses the car key
- **THEN** the ropes let go and the hero drives the stolen car

### Requirement: Theft is forgiving and limited to street cars
A car key press made up to 0.35 s before a street car comes into reach SHALL count. Expressway cars, streetcars and cars
fading in or out at the ends of their lane SHALL not be stolen. A headset SHALL not offer theft.

#### Scenario: An expressway car overhead
- **WHEN** the hero stands under the expressway as cars pass above
- **THEN** no STEAL prompt shows and the car key does nothing

#### Scenario: A press just too early
- **WHEN** the player presses R 0.2 s before a street car comes within 3.5 m of the hero
- **THEN** the hero steals that car when it comes into reach

### Requirement: The stolen car leaves the traffic
While a stolen car exists, the traffic SHALL not draw its traffic car. The number of draw calls SHALL not change. When the
stolen car is removed (the player has gone more than 400 m away, or its slot is reused), the traffic car SHALL be drawn again.

#### Scenario: No double car
- **WHEN** the hero steals a street car
- **THEN** that traffic car is hidden, and only the hero's car is drawn at its place

#### Scenario: Far away
- **WHEN** the player leaves a stolen car and travels more than 400 m away
- **THEN** the stolen car is gone and its traffic car drives its lane again

### Requirement: The driver runs off
When the hero steals a car, its driver SHALL jump out at the driver's door, run to the nearest sidewalk and flee along it
away from the hero, then walk on. A speech bubble SHALL follow the driver, saying "HEY!" and then "MY CAR!", with a gasp
from there.

#### Scenario: The driver flees
- **WHEN** the hero steals a street car
- **THEN** a person appears next to the car in the flee pose, reaches a sidewalk within 4 s and runs away from the hero

### Requirement: The car prompt tells parked and traffic cars apart
The prompt SHALL say "R STEAL" ("B STEAL" with a pad) when a traffic car is the closest car in reach, and "R GET IN"
("B GET IN") when a parked or left stolen car is. On a phone the CAR button SHALL show for both, and no prompt text.

#### Scenario: Next to a traffic car
- **WHEN** a street car drives within 3.5 m of a hero on a keyboard
- **THEN** the prompt reads "R STEAL"

#### Scenario: Next to a parked car
- **WHEN** the hero stands at the driver's door of a parked car with no traffic car in reach
- **THEN** the prompt reads "R GET IN"

#### Scenario: On a phone
- **WHEN** a street car drives within reach of a hero playing on a phone
- **THEN** the CAR button shows, and a tap steals the car

### Requirement: A stolen car stays where it is left
When the hero gets out of a stolen car, the car SHALL stay where it stopped and SHALL be a car the hero can get into again
with GET IN. It SHALL stay while the player is within 400 m.

#### Scenario: Get out and back in
- **WHEN** the hero drives a stolen car, gets out and walks back to its door
- **THEN** the car is still there, the prompt says GET IN, and R drives it again

### Requirement: Theft keeps flat play within budget
Theft SHALL add no draw call: the stolen car draws with the parked cars and the driver with the people. Flat play SHALL stay
under 800,000 triangles and 120 draw calls.

#### Scenario: The performance check
- **WHEN** qa/vr/perf.mjs runs
- **THEN** flat play reports under 800,000 triangles and under 120 draw calls
