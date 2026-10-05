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
