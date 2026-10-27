## ADDED Requirements

### Requirement: Ring three bells in order
After the cart is banked, three bells SHALL sit on the north lawn east of the follow line. The player SHALL ring the north bell, then the middle, then the south, on foot. A car SHALL NOT ring a bell. An early bell SHALL return the order to the north bell and SHALL stay on this beat. A sprint SHALL still ring the bell the step is waiting for. The south bell SHALL pay 340 once. Which bell is next SHALL be saved on version 12. A version-11 slot SHALL start this beat over. The seven story banks SHALL stay seven.

#### Scenario: Ring them north to south
- **WHEN** the player rings the north bell, then the middle, then the south
- **THEN** the order is banked and the purse is 340 once
- **WHEN** the player rings a later bell before the one this step is waiting for
- **THEN** the order returns to the north bell, the beat stays open, and the purse is not paid

#### Scenario: Read the order
- **WHEN** the objective appears at 1280×720, 1920×1080, or a supported tall phone frame
- **THEN** the existing wrapping keeps the title, the bell instruction, and the recover line readable

#### Scenario: Replay during the order
- **WHEN** the player replays the race while the bells are quiet
- **THEN** the step stays where it was and the slot is not rewritten
