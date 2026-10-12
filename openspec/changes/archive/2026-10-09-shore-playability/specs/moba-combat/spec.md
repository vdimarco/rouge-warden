## ADDED Requirements

### Requirement: Stable selected target
Manual selection SHALL persist while the player moves directly. Movement SHALL end pursuit, and SHALL NOT silently replace a selected wisp with an enemy hero. Selected targets SHALL clear on explicit stop, Recall, death or lost sight.

#### Scenario: Move while attacking a wisp
- **WHEN** a player selects a visible wisp near an enemy hero and then moves with keys, the pad or a battlefield drag
- **THEN** pursuit ends, the selected wisp remains selected, attacks in range use it and releasing movement does not restart pursuit.

#### Scenario: Lose or cancel a target
- **WHEN** the target dies, leaves team sight or the player explicitly stops or Recalls
- **THEN** selection clears and normal automatic targeting can resume without revealing hidden units.
