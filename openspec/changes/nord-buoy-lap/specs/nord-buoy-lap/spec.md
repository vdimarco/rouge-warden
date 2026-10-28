## ADDED Requirements

### Requirement: The pedalo tags the buoy before the berth pays
A pedalo that reaches the north-pond buoy SHALL move the lap from the dock to the buoy and SHALL NOT be paid yet. A pedalo that then reaches the berth SHALL finish the lap and pay 120 session cash once. A later visit SHALL NOT pay again. A car SHALL NOT move the lap. Reaching the berth before the buoy SHALL NOT finish the lap.

#### Scenario: Out and back
- **WHEN** a pedalo reaches the buoy and then the berth
- **THEN** the lap is done and the purse is 120

#### Scenario: The berth first
- **WHEN** a pedalo is at the berth before it has reached the buoy
- **THEN** the lap stays at the dock and the purse is 0

#### Scenario: A car
- **WHEN** a car reaches the buoy or the berth
- **THEN** the lap does not move and the purse is 0

#### Scenario: A second time
- **WHEN** the lap is already done
- **THEN** it stays done and the purse is 0

### Requirement: The buoy is across the pond from the berth
The buoy SHALL sit on the north-pond swim point, farther than two reaches from the pedalo berth.

#### Scenario: The gap
- **WHEN** the buoy is measured from the berth
- **THEN** the gap is more than 50 m and the two reaches do not overlap
