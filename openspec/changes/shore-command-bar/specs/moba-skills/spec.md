## MODIFIED Requirements

### Requirement: Four-button thumb fan
On a touch screen, or on a window narrower than 1040 px or lower than 600 px, the HUD SHALL anchor the ultimate at bottom-right, with three separate moves around it. All four SHALL show hero-specific names, iconography, learned ranks, cooldowns and lock states. Training SHALL be separate from casting.
#### Scenario: Use supported screens
- **WHEN** the game runs at 390x844, 844x390 or 320x640
- **THEN** controls fit the viewport, remain distinct and leave movement and market controls accessible.
#### Scenario: Aim a learned move
- **WHEN** the player taps or drags a learned move, or uses Q/E/C/R
- **THEN** its corresponding ability casts and its cooldown appears; an unlearned move cannot cast.

## ADDED Requirements

### Requirement: Desktop command bar
On a mouse-and-keyboard screen at least 1040 px wide and 600 px high, the HUD SHALL show one framed bar at the bottom centre. From left to right it SHALL hold the hero portrait with the level, the four skills in a row in the order Q, E, C, R with the health, mana and experience bars under them, and the six item slots in a three-by-two grid beside the market and quick-buy buttons. Each skill SHALL show its key, art, ranks, cooldown and lock state. The "+" upgrade badges and the skill point button SHALL sit above the skill row.
#### Scenario: Read the bar
- **WHEN** a match starts at 1280x720, 1440x900 or 1920x1080 with a mouse
- **THEN** the portrait, skills, bars and item slots sit inside one frame centred at the bottom edge, and none of them overlaps the movement pad, the rally button or another control.
#### Scenario: Train and cast from the bar
- **WHEN** the player clicks a "+" badge above a skill, then presses its key or clicks the skill
- **THEN** one point is spent on that skill, and the skill casts and shows its cooldown in the bar.
#### Scenario: Buy an item
- **WHEN** the player buys an item with the quick-buy button
- **THEN** the item appears in the first empty slot of the grid.
#### Scenario: Use a touch screen or a small window
- **WHEN** the game runs on a touch screen or in a window narrower than 1040 px
- **THEN** the thumb fan layout shows instead of the bar.
#### Scenario: Click the frame between buttons
- **WHEN** the player clicks an empty part of the bar
- **THEN** the hero gets no move order from that click.
