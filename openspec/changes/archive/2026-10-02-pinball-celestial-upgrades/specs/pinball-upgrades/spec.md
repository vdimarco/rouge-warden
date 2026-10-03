## ADDED Requirements

### Requirement: Celestial spacecraft upgrade console
Full Tilt SHALL present its three existing upgrades in a readable celestial spacecraft console with current and next sector context.

#### Scenario: Install a module
- **WHEN** the player clicks Quick pulse, Hull repair or Comet drive, or presses its 1/2/3 shortcut
- **THEN** that existing upgrade is applied once and the normal jump begins

#### Scenario: Choose on a phone
- **WHEN** the console opens in portrait or landscape
- **THEN** all three module names, descriptions and action targets fit the viewport or remain reachable by vertical scrolling without horizontal overflow

#### Scenario: Accessible controls
- **WHEN** the player navigates by keyboard or enables reduced motion
- **THEN** focused choices have visible feedback, all controls retain meaningful names, and decorative motion is removed

#### Scenario: Pause safely
- **WHEN** the player pauses after installing an upgrade during the jump
- **THEN** pause remains visible, shortcuts cannot apply another upgrade, and the jump resumes normally afterward
