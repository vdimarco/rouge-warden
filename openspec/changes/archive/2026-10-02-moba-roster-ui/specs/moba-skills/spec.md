## ADDED Requirements

### Requirement: Readable selection and rank detail
The spellbook SHALL pause the hunt, show four selectable skills, and show the selected move's description, combination hint, current rank, cooldown and level requirements. Spending a point SHALL require the explicit Learn or Upgrade action.
#### Scenario: Preview before learning
- **WHEN** a player selects a spell row
- **THEN** the detail updates and the skill point count does not change.
#### Scenario: Learn and inspect a rank
- **WHEN** a player spends an eligible point
- **THEN** the point count decreases, the rank increases, and the selected detail updates its current and next rank benefits.
#### Scenario: Locked ultimate
- **WHEN** the player inspects an ultimate below level 6
- **THEN** its detail is available and the learning button explains the level requirement.
#### Scenario: Small screen
- **WHEN** the spellbook is viewed at 390x844 or 844x390
- **THEN** spell choices, descriptions and actions remain reachable without horizontal page overflow.
