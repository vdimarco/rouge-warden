# Shore of the Ancients opening and battlefield UI

## Purpose
The opening screen of Shore of the Ancients shows the hero roster beside the selected hero's art and skills. It works by touch or keyboard on phones and desktops. During a match, one finger can move the hero while another casts or upgrades a skill. Players can zoom the 3D battlefield with the wheel or two battlefield fingers and use Rift Jump at the top center.

## Requirements

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

### Requirement: Battlefield camera zoom
The 3D battlefield SHALL support wheel and two-finger pinch zoom between normal distance and 2.4 times normal distance, retaining zoom across resize and recenter.

#### Scenario: Wheel and pinch reveal terrain
- **WHEN** an active player scrolls down over the battlefield or moves two battlefield fingers together
- **THEN** the camera reveals more ground, and the reverse gesture restores the closer view within the bounds.

#### Scenario: Pinch does not issue combat input
- **WHEN** a second battlefield finger joins a screen drag
- **THEN** screen movement and queued orders stop, and neither finger issues movement or a tap until both lift, including capture loss or cancellation.

#### Scenario: Independent controls and inactive states
- **WHEN** joystick and ability touches are used together, or a menu is open or play is paused
- **THEN** those touches do not form a battlefield pinch and inactive play does not change zoom.

#### Scenario: Accurate zoomed terrain selection
- **WHEN** the player zooms and then targets visible ground
- **THEN** picking follows the visible terrain and the camera footprint, pan scale and atmospheric fog distances match the new distance so terrain remains legible.

### Requirement: Top center Rift Jump
Rift Jump SHALL appear at the top center of the battlefield with a touch target at least 44px high, remaining visible with a disabled Find a gate hint away from gates, and retaining its existing gate eligibility and action.

#### Scenario: Responsive HUD
- **WHEN** a match is displayed on desktop, portrait phone or landscape phone
- **THEN** Rift Jump is centered, within safe areas and clear of the score, team lineup, objective clock, objective panel, minimap and first-spell prompt.
