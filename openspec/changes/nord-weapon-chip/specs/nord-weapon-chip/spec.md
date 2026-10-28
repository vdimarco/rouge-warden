## ADDED Requirements

### Requirement: The play shell names the weapon in English

The current weapon is Fists, Hockey stick, Pistol, SMG, or Shotgun. The play page shows that name. An empty name hides the chip.

#### Scenario: An offline frame shows the pistol

- **GIVEN** the play page is open and the host is offline
- **WHEN** the page is given PISTOL
- **THEN** the chip is visible
- **AND** the name is PISTOL
- **AND** it has no French accent
