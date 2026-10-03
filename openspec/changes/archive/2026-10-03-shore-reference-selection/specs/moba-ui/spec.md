## ADDED Requirements

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

## REMOVED Requirements

### Requirement: Epic opening scene
**Reason:** The supplied Shore reference replaces the folklore opening composition and unframed lineup.
**Migration:** Use Reference opening scene for the framed roster and cinematic hero stage.

### Requirement: Contained opening layout
**Reason:** A four-column roster with contained vertical travel replaces the horizontal carousel.
**Migration:** Use Contained reference layout for keyboard, touch, safe areas and supported sizes.

### Requirement: Fal cinematic opening artwork
**Reason:** The new source-matched shore scene replaces the moonlit folklore backdrop.
**Migration:** Use Reference opening scene for artwork, native controls and fallback behavior.

### Requirement: Animated hero portraits
**Reason:** The supplied framed portrait atlas and new stage sprites replace the twelve animated lineup portraits.
**Migration:** Use the sixteen reference identity artworks, with reduced decorative motion and battle-art fallback.
