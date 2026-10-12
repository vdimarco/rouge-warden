## MODIFIED Requirements

### Requirement: Arcade discovery
All six games SHALL be reachable through their own routes, arcade cabinets in the Lab group, the Lab page and the switcher inside each game. All Games at `/` SHALL leave them out.
#### Scenario: Launch and switch
- **WHEN** a player launches a new game from the arcade or switches away during a round
- **THEN** the correct route loads its local assets and opening the switcher pauses the current simulation
