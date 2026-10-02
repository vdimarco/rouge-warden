# Vehicle theft

### Requirement: Every intact car can be taken
The player SHALL be able to enter the driver's door of every intact slow or stopped car, regardless of kind, ownership, occupancy or source, using the existing keyboard, touch or gamepad interaction. Occupied passenger-door entry SHALL remain a ride, including Gabe's jeep. Wrecks and cars moving too fast SHALL not offer entry.

#### Scenario: Take a driven vehicle
- **WHEN** the player uses the driver's door of an occupied car
- **THEN** the occupant leaves the driver's seat and AI relinquishes control
- **AND** the player can accelerate, steer, exit and re-enter

#### Scenario: Take traffic or a parked prop
- **WHEN** the player enters an ambient traffic car or a parked lot car
- **THEN** one drivable car replaces its previous representation without duplicate collision bodies
- **AND** ambient cleanup cannot remove the stolen car
- **AND** a new session restores parked lots and removes stale prompts

#### Scenario: Take a patrol
- **WHEN** the player takes a patrol even with its officer seated
- **THEN** existing police theft consequences apply and the car cannot act as its own witness

#### Scenario: Controls and layouts
- **WHEN** the player approaches a car on desktop or a landscape phone layout
- **THEN** the existing interaction prompt supports entry without adding a new control
- **AND** portrait retains the existing rotate-phone prompt
