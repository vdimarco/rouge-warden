## ADDED Requirements

### Requirement: La course loses the passenger on foot
The sixth side job SHALL pick the passenger up at its marker and drop them at the quay. After boarding, more than four seconds on foot SHALL fail the job. A car at the quay that is still faster than the arrival speed SHALL NOT count as the drop. A walker at the quay SHALL NOT count as the drop. The clock SHALL stay 100 seconds. The pay SHALL be 450, and the goon pay SHALL stay 300. From the spawn the nearest open job SHALL stay the escape, and from the terrace it SHALL stay the goons.

#### Scenario: Four seconds
- **WHEN** the passenger is aboard and the driver stays on foot for four seconds
- **THEN** the passenger is still aboard, and half a second more loses them

#### Scenario: The drop
- **WHEN** a car reaches the quay at the arrival speed
- **THEN** the fare is done, and the same car one centimetre per second faster is still aboard

#### Scenario: The guides
- **WHEN** no job is finished
- **THEN** the spawn still names the escape and the terrace still names the goons
