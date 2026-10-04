## MODIFIED Requirements

### Requirement: Celestial spacecraft upgrade console
Full Tilt SHALL offer three upgrades at each gate, picked by the seed from a pool of six, in a readable celestial spacecraft console with current and next sector context.

#### Scenario: The offer
- **WHEN** the console opens at a gate
- **THEN** it offers three of Quick pulse, Hull repair, Comet drive, Long flippers, Double strike and Magnet save, and the seed and the world choose the three
- **AND** Long flippers leaves the pool once installed, and on the last heart Hull repair is one of the three

#### Scenario: Upgrades that change the flip
- **WHEN** the player installs Long flippers, Double strike or Magnet save
- **THEN** Long flippers makes both blades 12% longer, once in a voyage, Double strike counts each Good or Perfect flip twice in the rally row, and Magnet save throws a lost ball back up once in each world

#### Scenario: Install a module
- **WHEN** the player clicks an offered module, or presses its 1/2/3 shortcut
- **THEN** that upgrade is applied once and the normal jump begins

#### Scenario: Choose on a phone
- **WHEN** the console opens in portrait or landscape
- **THEN** all three module names, descriptions and action targets fit the viewport or remain reachable by vertical scrolling without horizontal overflow

#### Scenario: Accessible controls
- **WHEN** the player navigates by keyboard or enables reduced motion
- **THEN** focused choices have visible feedback, all controls retain meaningful names, and decorative motion is removed

#### Scenario: Pause safely
- **WHEN** the player pauses after installing an upgrade during the jump
- **THEN** pause remains visible, shortcuts cannot apply another upgrade, and the jump resumes normally afterward
