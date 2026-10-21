## ADDED Requirements

### Requirement: One button starts a swing
On the ground, holding a swing input on a building with no move input SHALL walk the hero toward that web at walking speed, so the swing leaves the roof without a forward hold. A rope on a clog, a pipe, or the crack SHALL NOT walk the hero. A move input SHALL still steer.

#### Scenario: The swing button on the start roof
- **WHEN** the player holds only the swing button, aimed at the gold ring, from the start roof
- **THEN** the hero leaves the roof within 4 seconds with the rope attached

#### Scenario: A clog stays put
- **WHEN** the player ropes a clog and does not steer
- **THEN** the hero does not walk toward it
