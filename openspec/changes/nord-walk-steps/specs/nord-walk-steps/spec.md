## ADDED Requirements

### Requirement: The on-foot stick has three steps
A short push SHALL walk at a third of full speed. A longer push SHALL stride at two thirds. The edge of the stick SHALL stay full speed on W, A, S and D. WASD and the arrow keys SHALL stay full lock. A latched sprint SHALL wait for that full step.

#### Scenario: Short push
- **WHEN** the thumb is past the first edge and short of the second
- **THEN** the stick sends a third of full speed and does not send WASD

#### Scenario: Full push
- **WHEN** the thumb reaches the outer edge
- **THEN** the stick sends W, A, S or D

#### Scenario: Sprint
- **WHEN** sprint is latched and the thumb is only on the first step
- **THEN** the player does not sprint
