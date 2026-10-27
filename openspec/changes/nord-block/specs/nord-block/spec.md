## ADDED Requirements

### Requirement: Head them off on the side street
After the bells are banked, a courier SHALL drive one surveyed road and SHALL NOT follow the player. A real car on the side street SHALL start that drive. Only a real car on the block, while the courier is still short of it, SHALL bank the beat and pay 380 once. A bike, a pedalo, a scooter, or a walker SHALL NOT start it or block it. If the courier reaches the block first, the side street SHALL be back and the beat SHALL stay open. The step SHALL be saved on version 13. A version-12 slot SHALL start this beat over. How far the courier has driven SHALL stay in the session. The seven story banks SHALL stay seven.

#### Scenario: Take the side street
- **WHEN** the player starts a car on the side street and reaches the block before the courier
- **THEN** the road is blocked and the purse is 380 once
- **WHEN** the courier reaches the block first
- **THEN** the side street is back, the beat stays open, and the purse is not paid

#### Scenario: Read the road
- **WHEN** the objective appears at 1280×720, 1920×1080, or a supported tall phone frame
- **THEN** the existing wrapping keeps the title, the side-street instruction, and the recover line readable

#### Scenario: Replay during the block
- **WHEN** the player replays the race while the road is open
- **THEN** the step stays where it was and the slot is not rewritten
