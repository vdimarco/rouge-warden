## ADDED Requirements

### Requirement: Roll a cart that waits
After the gap is banked, a cart SHALL sit on the north lawn west of that line. The player SHALL start the roll by standing at the handles on foot. A car SHALL NOT start it. The cart SHALL roll only while a walker stays at the handles at a walk. A stop SHALL leave the cart where it is. A sprint at the handles SHALL tip it back to the start and SHALL stay on this beat. A partner sprinting in the handles SHALL tip it. A matched walk SHALL pay 360 once at the stop. The step SHALL be saved on version 11. A version-10 slot SHALL start this beat over. How far the cart has rolled SHALL stay in the session. The seven story banks SHALL stay seven.

#### Scenario: Walk the cart
- **WHEN** the player stands at the handles and walks at a walk to the stop
- **THEN** the cart reaches the stop and the purse is 360 once
- **WHEN** the player stops away from the handles after the cart has moved
- **THEN** the cart stays there
- **WHEN** the player sprints at the handles after the cart has moved
- **THEN** the cart returns to the start, the beat stays open, and the purse is not paid

#### Scenario: Read the cart
- **WHEN** the objective appears at 1280×720, 1920×1080, or a supported tall phone frame
- **THEN** the existing wrapping keeps the title, the cart instruction, and the recover line readable

#### Scenario: Replay during the roll
- **WHEN** the player replays the race while the cart is out
- **THEN** the step stays where it was and the slot is not rewritten
