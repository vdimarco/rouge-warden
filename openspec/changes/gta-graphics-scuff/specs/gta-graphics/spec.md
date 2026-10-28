## ADDED Requirements

### Requirement: A walk leaves dust at the rear shoe
While the player is on foot, faster than 80 cm/s, and not swimming, knocked down, or falling, pale spheres SHALL appear at the rear shoe and be left behind as the walker moves. A puff SHALL fade before its slot is reused. A slow step, a swim, a knockdown, a fall, and a vehicle SHALL NOT birth a puff. The rain streak shader and the leaf slots SHALL stay.

#### Scenario: A walking shoe scuffs
- **WHEN** planar speed is above 80 cm/s on foot
- **THEN** a puff is born at the rear shoe, drifts back, rises, and grows, then fades

#### Scenario: Standing does not scuff
- **WHEN** planar speed is 80 cm/s or less
- **THEN** no new puff is born

#### Scenario: The trail does not steal a leaf slot
- **WHEN** the dust is updated
- **THEN** the leaf count and the rain streak box are unchanged
