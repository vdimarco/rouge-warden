## ADDED Requirements

### Requirement: Mouse attack orders
Clicking a visible hostile creature SHALL select it, move the player into attack range through passable terrain, and attack it using the existing cooldown and combo rules. The selected target SHALL show a ring and its name in the HUD while approached.

#### Scenario: Attack from outside range
- **WHEN** the player clicks a visible enemy beyond basic attack range
- **THEN** the hero approaches, stops within range and attacks the selected enemy.

#### Scenario: Cancel or replace a chase
- **WHEN** the player moves with keys or the pad, presses Space, clicks open ground, recalls, pauses, dies or loses sight of the enemy
- **THEN** the attack chase ends and the next command takes priority.

#### Scenario: Respect cover and neutral camps
- **WHEN** terrain blocks the direct route or a resting camp is selected
- **THEN** pursuit routes around the terrain and only the selected resting camp is attacked.

### Requirement: Imported neutral artwork
Available free MagicPixel sprites SHALL be stored locally with source metadata and displayed as neutral guardians with health bars and target hitboxes. Existing procedural creatures SHALL remain the fallback for unavailable sprites.

#### Scenario: View and select an imported guardian
- **WHEN** a guardian with imported artwork appears
- **THEN** its sprite, health bar and click target align and its existing camp rules apply.
