## ADDED Requirements

### Requirement: Concrete rescue purpose
The opening SHALL identify the player as a courier, explain the three stranded crews and six-beacon rescue route, and give the first destination and action. Persistent mission guidance SHALL name a reachable next landmark and explain its outcome. The scene SHALL identify the player and important landmarks without obscuring the ASCII landscape.
#### Scenario: First minute
- **WHEN** a new player begins
- **THEN** the rescue purpose and first task are readable and they can follow a named destination to an actionable supply pack

### Requirement: Spatial collecting and dodge
Forest grove work SHALL involve catching moving fireflies with a lantern in the scene and returning the catch to the grove. Directional dodge SHALL provide a brief protected movement burst with cooldown, keyboard and touch controls, and visible feedback. Neither action SHALL bypass resource costs or completed-task rewards.
#### Scenario: Catch and deliver
- **WHEN** a player starts a grove task and sweeps their lantern near moving fireflies
- **THEN** caught fireflies accumulate visibly and delivery at the grove completes the task once
#### Scenario: Dodge a hazard
- **WHEN** a player dodges while moving
- **THEN** they burst in that direction, avoid hazard damage briefly and must recover before another dodge

### Requirement: Clear restoration payoff
Activating a final beacon after its local prerequisites SHALL be a direct reward rather than another repeated operation. Feedback SHALL explain which people, supplies or routes the action helped. Existing valid saves SHALL preserve completed work and support the new tasks on remaining locations.
#### Scenario: Restore a beacon
- **WHEN** the player has completed its local tasks and pays its displayed cost
- **THEN** the beacon activates directly and the next route or tool is clearly announced
