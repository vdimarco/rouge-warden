# Shore of the Ancients opening UI

### Requirement: Reference opening scene
The opening SHALL match the supplied Shore reference composition at 1536x864 with a framed four-column hero roster, cinematic selected-hero artwork, a right skill panel, gold wordmark and cyan selection feedback. Native controls SHALL remain functional over the artwork.

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

### Requirement: Contained reference layout
The screen SHALL keep the Play action, hero selection and skill inspection usable at 1536x864, 390x844, 320x568 and 844x390. Roster scroll SHALL remain within its panel. Footer actions, skill buttons, key labels and the description SHALL fit without overlap. Safe areas SHALL preserve reachable actions.

#### Scenario: Use a compact screen
- **WHEN** a supported phone or landscape size is used
- **THEN** persistent controls fit the viewport without overlap, and all sixteen heroes remain reachable.

#### Scenario: Browse the desktop roster
- **WHEN** the player opens selection at 1536x864
- **THEN** all sixteen framed portraits appear in four columns and four rows in the left panel, which occupies approximately 32% of the viewport width.

#### Scenario: Swipe a portrait
- **WHEN** the player swipes vertically from a portrait on a compact screen
- **THEN** the roster scrolls within its panel and the Play action remains visible.

#### Scenario: Use the keyboard
- **WHEN** the player uses arrow keys, Home or End within the roster
- **THEN** the requested grid entry is selected, focused and revealed within the roster without moving the page.

#### Scenario: Start or activate a focused action
- **WHEN** the player uses Play or Enter to start from hero selection
- **THEN** the selected identity starts the match and opens its spellbook; Enter on another focused control activates that control's own action.

#### Scenario: Keep long titles and short desktop actions usable
- **WHEN** a long hero name is selected near 1000px width or the desktop viewport is short
- **THEN** the name, skills, description and footer remain legible and fit without overlapping essential controls.

### Requirement: Independent movement and ability touches
A held movement touch SHALL remain active while a second touch casts or upgrades an ability.

#### Scenario: Spend a point while moving
- **WHEN** the player holds the pad and taps an eligible plus with a second finger
- **THEN** exactly one point is spent, the correct rank increases and movement continues until the movement finger is released or cancelled.

#### Scenario: Cast while moving
- **WHEN** the player holds the pad and aims or taps a learned ability with another finger
- **THEN** the cast uses the ability finger and releasing it does not stop movement.

#### Scenario: Cancel a touch
- **WHEN** a captured ability or upgrade pointer is cancelled
- **THEN** it does not cast or train and the unrelated movement pointer remains active.
