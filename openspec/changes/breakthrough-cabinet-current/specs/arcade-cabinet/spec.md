## ADDED Requirements

### Requirement: Current Breakthrough cabinet
The Cottage Arcade homepage SHALL include a BREAKTHROUGH cabinet that launches `/breakthrough2/`. The older page at `/breakthrough/` SHALL remain available and SHALL NOT be the cabinet destination.

#### Scenario: Start from the arcade
- **WHEN** the player starts the BREAKTHROUGH cabinet
- **THEN** the browser opens `/breakthrough2/` and the current game loads

#### Scenario: Cabinet identity stays
- **WHEN** the homepage shows the BREAKTHROUGH cabinet
- **THEN** the marquee still reads BREAKTHROUGH with the century subtitle, the aria label is unchanged, and the mini-game scene still draws the landscape attract screen

#### Scenario: Narrow homepage
- **WHEN** the homepage is about 390 pixels wide and the player selects and starts the BREAKTHROUGH cabinet
- **THEN** the landing page is `/breakthrough2/` and the game title is visible
