# Crimson Rouge driving

### Requirement: Forgiving vehicle handling
All drivable vehicle kinds SHALL provide stronger dry-surface cornering and braking, retain reduced water traction, and recenter steering promptly on release. Existing keyboard, touch and gamepad bindings SHALL remain available on desktop and phone layouts. Reverse, handbrake, collision damage and top-speed limits SHALL remain functional.

#### Scenario: Turn and straighten
- **WHEN** a vehicle at 15 m/s turns on asphalt or dirt and the player releases steering
- **THEN** its turning radius is smaller than the previous tuning and its wheel angle returns to zero within 0.15 seconds

#### Scenario: Brake and maneuver
- **WHEN** a driver brakes from 20 m/s on level asphalt
- **THEN** every vehicle stops within 25 meters
- **AND** deliberate reverse and handbrake turns remain available

### Requirement: Tour route compatibility
Gabe's jeep SHALL still reach the Schnebly vista using the shared route driver.

#### Scenario: Ride with Gabe
- **WHEN** the passenger ride begins from the tour lot
- **THEN** Gabe reaches within 25 meters of the vista within 160 seconds
