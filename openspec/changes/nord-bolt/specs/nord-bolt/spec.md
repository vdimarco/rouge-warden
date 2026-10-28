## ADDED Requirements

### Requirement: Bolting after the drive

After the parcel is banked, the bolt is open on a surveyed road. A real car reaching the far end still fast, nose down the road, starts a seeker that steers. Reaching the bay in that car before the seeker closes, then reaching the gate on foot before the clock, banks the beat and pays 720 once. A crawl is caught, the chase starts again, and the drive stays banked. A car at the gate does not bank it. A timeout starts the clock again and leaves the chase banked.

#### Scenario: A fast drive, then the gate on foot

- **WHEN** the parcel is banked and a real car reaches the end still fast, holds that pace to the bay, and the player then walks to the gate
- **THEN** the beat banks and pays 720 once

#### Scenario: A crawl is caught

- **WHEN** the chase has started and the car crawls toward the bay
- **THEN** the seeker catches it, the chase starts again, and the beat pays nothing

#### Scenario: A car at the gate

- **WHEN** the bay has been reached and a car stands on the gate
- **THEN** the beat stays open and pays nothing

#### Scenario: Recover during the bolt

- **WHEN** the player recovers while the bolt is open
- **THEN** they return to the start of the open stage and the step stays
