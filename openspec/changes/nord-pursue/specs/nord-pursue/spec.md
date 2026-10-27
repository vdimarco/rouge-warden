## ADDED Requirements

### Requirement: Catch the traffic car
After the send-off is banked, a traffic car SHALL cruise one surveyed avenue and SHALL NOT steer toward the player. A real car alongside it, before the avenue ends, SHALL bank the beat and pay 460 once. A walker SHALL NOT catch it. If the traffic car reaches the end first, it SHALL be ahead again and the beat SHALL stay open. The step SHALL be saved on version 15. A version-14 slot SHALL start this beat over. How far the traffic car has driven SHALL stay in the session. The seven story banks SHALL stay seven.

#### Scenario: Pull alongside
- **WHEN** the player catches the traffic car in a real car before the avenue ends
- **THEN** the pursuit is banked and the purse is 460 once
- **WHEN** the traffic car reaches the end first
- **THEN** it is ahead again, the beat stays open, and the purse is not paid

#### Scenario: Read the pursuit
- **WHEN** the objective appears at 1280×720, 1920×1080, or a supported tall phone frame
- **THEN** the existing wrapping keeps the title, the alongside instruction, and the recover line readable

#### Scenario: Replay during the pursuit
- **WHEN** the player replays the race while the pursuit is open
- **THEN** the step stays where it was and the slot is not rewritten
