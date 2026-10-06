## ADDED Requirements

### Requirement: Every tap swings on
On a phone, every press of SWING and every tap on the city SHALL shoot a rope. With a rope out, the press SHALL move the rope
to the next building ahead (or the tapped one) with no let-go between. SWING SHALL NOT let go of a rope. A press while the
cup still flies SHALL do nothing, so the rope that is coming lands.

#### Scenario: A second press of SWING
- **WHEN** the player presses SWING, the rope catches, and the player presses SWING again
- **THEN** a new rope shoots at once, the button still shows SWING ("Again: the next building"), and the speed stays over 10 m/s

#### Scenario: A steady beat of taps
- **WHEN** the player presses SWING every 0.5, 0.8 or 1.2 s for 12 s from the start roof, with no steering
- **THEN** for each beat the average speed is at least 17 m/s, the player covers at least 120 m, the feet are under 8 m for at most 2.5 s, and the player is on the ground for at most 1.5 s (before this change: 11 to 16 m/s and 5.6 to 7.3 s under 8 m)

#### Scenario: Only the held building is in reach
- **WHEN** the player presses SWING with a rope out and no other building qualifies
- **THEN** the rope stays and the hint says the rope is kept

### Requirement: A phone rope keeps the speed and the height
On a phone, a rope on a building that catches SHALL keep the player's speed: the part that flies away from the anchor SHALL
turn into swing toward where the player looks. The rope SHALL shorten so the lowest point of its arc stays 6 m over the
street, unless the anchor is too low for that. The phone marker SHALL prefer a point at least 22 m up and 8 m over the chest.

#### Scenario: A catch while falling
- **WHEN** the player falls toward the street and a new rope catches a high building ahead
- **THEN** the speed after the catch is not lower than before it, and the rope pulls the player up so the swing passes over the street

#### Scenario: On or just over a street
- **WHEN** the phone marker searches from 600 sampled spots on a street, or 10 to 20 m over one and falling
- **THEN** it takes a point at least 22 m up and 8 m over the chest at no fewer than 78 % of the spots and at 10 % more spots than the plain marker (measured: 497 against 404), and never a low point where the plain marker has a high one
