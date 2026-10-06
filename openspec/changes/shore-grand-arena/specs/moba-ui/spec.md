## MODIFIED Requirements

### Requirement: Reference opening scene
The opening SHALL match the supplied Shore reference composition at 1536x864 with a framed four-column hero roster, a full-length figure of the selected hero rendered from its 3D model over the cinematic stage, a right skill panel, gold wordmark and a
bronze selection frame. Panels, buttons and text SHALL use the mythic palette: bronze and iron frames, parchment text, umber and slate
panels, muted teal for allies and crimson for enemies. Native controls SHALL remain functional over the artwork.

#### Scenario: Select a reference hero
- **WHEN** the player selects any of the sixteen heroes
- **THEN** the selected card, stage art, name, roles and four skill previews update together.

#### Scenario: Inspect a skill
- **WHEN** a skill receives hover, focus or a tap
- **THEN** its actual effect, cooldown and mana information appear, and the player can return to selection.

#### Scenario: Use the selection navigation
- **WHEN** the player opens hero details, realms, lore, the market explanation, the match record or settings
- **THEN** the matching panel opens and the player can return to hero selection without starting a match.

#### Scenario: Reduce motion or lose stage art
- **WHEN** reduced motion is requested or cinematic stage art cannot load
- **THEN** decorative motion stops or the dark fallback is shown, while native selection controls stay usable.

#### Scenario: See the hero that will fight
- **WHEN** the player selects a hero
- **THEN** the stage shows the same armour, weapon and colours as that hero's model in the battle.

## ADDED Requirements

### Requirement: Mythic match HUD
The match HUD SHALL use the same mythic palette and fonts as the opening. Body text SHALL keep a contrast of at least 4.5:1 against its panel.
The HUD SHALL show the player's portrait beside the health bar, and the six heroes of the match beside the score, each with a portrait. Chat
lines and kill-feed names SHALL carry a small portrait of the hero who spoke or acted.

#### Scenario: Read the lineup during a match
- **WHEN** a hero of either team falls
- **THEN** its portrait beside the score darkens and shows the seconds until it returns, and it clears when the hero is back.

#### Scenario: Use the HUD on every supported screen
- **WHEN** a match runs at 1440x900, 3440x1440, 390x844, 844x390 or 320x568, with sound on or saved off
- **THEN** the lineup, health frame, skill buttons, objective clock, market and menu fit the screen without overlap and stay readable over
  the battlefield. On screens narrower than 700 px the lineup is a row of smaller portraits under the score, and the objective clock
  stays on one line.

#### Scenario: Read the final countdown
- **WHEN** sudden death starts
- **THEN** the match clock turns crimson and counts down the last three minutes, and screens at least 700 px wide show a sudden death
  label under the score.

### Requirement: Skill buttons are easy to hit
The skill cluster SHALL place Q, E and C on an arc around the ultimate R in the bottom-right corner. E and C, the buttons nearest the middle of the screen, SHALL be at least 80 px wide on desktop and at least 70 px wide in the phone layout (width up to 430 px, or height up to 520 px). Every point of each skill's visible disc SHALL activate that skill, and no other control SHALL cover it. Each "+" upgrade badge SHALL sit on the outer side of its skill, cover no skill disc, and be at least 34 px wide. In upgrade mode no second "+" mark SHALL show on a tile. A press in a gap of the cluster SHALL go to the skill with the nearest disc edge. The cluster SHALL NOT overlap the market bar, the inventory slots, the auto-status label, the minimap, the point button, the health bar, the movement pad or the rally button, and in the phone layout every skill centre SHALL be within 250 px of the bottom-right corner. Drag-to-aim, return-to-centre cancel and the Q/E/C/R keys SHALL work as before. qa/tidebreak/skill-targets.e2e.mjs measures this at nine screen sizes.

#### Scenario: A press on the rim of a skill casts that skill
- **WHEN** the player presses anywhere on the visible disc of Q, E, C or R at 1440x900, 1920x1080, 3440x1440, 844x390, 600x500, 640x360, 568x320, 390x844 or 320x568, with or without skill points to spend
- **THEN** that skill takes the press

#### Scenario: The upgrade badges do not cover the skills
- **WHEN** the player has skill points and the four "+" badges show
- **THEN** each badge sits outside every skill disc, a press on a badge spends a point on its skill, and no tile shows a second "+" mark

#### Scenario: A slightly missed press still casts
- **WHEN** the player presses in the gap between two skills, or in the middle of the cluster
- **THEN** the skill with the nearest disc edge takes the press, and a drag from there aims it as usual

#### Scenario: The cluster keeps clear of the market on small landscape windows
- **WHEN** the window is 600 to 659 px wide and up to 520 px high
- **THEN** no skill or badge overlaps the market bar or an inventory slot

#### Scenario: Small phones on their side keep the minimap and the point button apart
- **WHEN** the window is 540 to 699 px wide and up to 400 px high, for example 568x320 or 640x360
- **THEN** the minimap is 72 px wide, the point button is a pill to the left of the minimap, and the minimap, the point button, the objective timers, the difficulty label and every skill and badge do not overlap
- **AND** under 600 px wide the rally button stands beside the movement pad, clear of the objective text

#### Scenario: A press clear of the cluster reaches the battlefield
- **WHEN** the player presses 30 px or more outside the cluster
- **THEN** no skill takes the press

### Requirement: Hunted mark
The HUD SHALL show a "Hunted" mark under the player's health bar while the enemy bots' team focus is the player. The mark SHALL be a
status for screen readers, SHALL stay on screen, and SHALL cover no HUD control at 1440x900, 390x844, 844x390, 320x568 and 568x320. The
enemy team focus SHALL need the enemy team to see the player.

#### Scenario: The enemy bots pick the player
- **WHEN** the enemy team focus moves to the player
- **THEN** "Hunted" shows under the health bar, and it goes away when the focus moves to another hero.
