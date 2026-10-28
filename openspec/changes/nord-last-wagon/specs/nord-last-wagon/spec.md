## ADDED Requirements

### Requirement: The last wagon is a choice
On the escape step of Can't Tow Tomorrow, the player SHALL see the clear gate and the wagon Green Cap called. Using the clear gate SHALL bank the convoy. Using the called wagon SHALL NOT advance the step and SHALL break the chain. The card SHALL keep marking the clear gate. A second use of the called wagon SHALL NOT bank it.

#### Scenario: Clear gate
- **WHEN** the player uses the clear gate on the escape step
- **THEN** the convoy banks

#### Scenario: Called wagon
- **WHEN** the player uses the wagon he called
- **THEN** the step stays on the escape and the chain breaks

#### Scenario: Held chain
- **WHEN** the chain is already held and the player uses the called wagon
- **THEN** the step still does not advance

#### Scenario: The spot
- **WHEN** the called wagon is placed
- **THEN** it sits north of the clear gate, clear of the race gates, the other convoy posts, and the QA anchors
