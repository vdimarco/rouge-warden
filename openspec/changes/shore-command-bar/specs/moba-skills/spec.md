## REMOVED Requirements

### Requirement: Four-button thumb fan
**Reason**: The command bar replaces the thumb fan on every screen.
**Migration**: The skills keep their names, art, ranks, cooldowns, lock states and keys in the command bar.

## ADDED Requirements

### Requirement: Command bar
The HUD SHALL show one framed command bar at the bottom of every screen. It SHALL hold the hero portrait with the level, the four skills in a row in the order Q, E, C, R, the health, mana and experience bars, and the six item slots with the market and quick-buy buttons. Each skill SHALL show its key, art, ranks, cooldown and lock state. The "+" upgrade badges and the skill point button SHALL sit above the skill row. Training SHALL be separate from casting.
#### Scenario: Read the bar on a large screen
- **WHEN** a match starts at 1280x720, 1440x900 or 1920x1080
- **THEN** the portrait, skills, bars and item slots sit in one frame centred at the bottom edge, in that order from left to right, and none of them overlaps the movement pad, the rally button or another control.
#### Scenario: Play on a phone on its side
- **WHEN** a match starts at 844x390, 640x360 or 568x320
- **THEN** the bar sits at the bottom right with the items, the portrait and the skills from left to right, R is within 150 px of the bottom-right corner, and no control overlaps another.
#### Scenario: Play on an upright phone
- **WHEN** a match starts at 390x844 or 320x568
- **THEN** the bar fills the bottom of the screen with the portrait and the skills on top, the bars below them and the items at the bottom, and the movement pad, the rally button and the team chat sit above the bar without overlap.
#### Scenario: Train and cast from the bar
- **WHEN** the player taps or clicks a "+" badge above a skill, then presses its key, clicks it or taps it
- **THEN** one point is spent on that skill, and the skill casts and shows its cooldown in the bar; an unlearned skill cannot cast.
#### Scenario: Buy an item
- **WHEN** the player buys an item with the quick-buy button
- **THEN** the item appears in the first empty slot.
#### Scenario: Click the frame between buttons
- **WHEN** the player clicks or taps an empty part of the bar
- **THEN** the hero gets no move order from that press.
#### Scenario: Hit the controls by touch
- **WHEN** the game runs on a touch screen
- **THEN** each skill is at least 48 px and each "+" badge at least 34 px.
