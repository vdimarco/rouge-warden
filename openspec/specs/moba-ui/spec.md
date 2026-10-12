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
- **THEN** the selected identity starts a live match, new players receive contextual guidance, and the spellbook opens only on request; Enter on another focused control activates that control's own action.

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

### Requirement: Short first match
The game SHALL let the player start with the selected hero directly, retain optional draft inspection and remember the chosen hero. A new player SHALL start with Apprentice unless they choose another difficulty. Match start SHALL show a short contextual guide and SHALL NOT open the full spellbook automatically.

#### Scenario: Begin on any supported layout
- **WHEN** a new player starts at 1440x900, 390x844, 320x568 or 844x390
- **THEN** play starts without a paused spellbook, movement remains available, and one guide at a time explains learning, movement and spell aim/cancel.

#### Scenario: Return or inspect more
- **WHEN** the player returns or opens the draft or spellbook
- **THEN** their saved hero is restored and the requested full controls remain available.

#### Scenario: Inspect before learning on touch
- **WHEN** a phone player opens Spellbook from the pause menu while a skill point is available
- **THEN** the full spell details remain reachable without spending the point or casting, and leaving the book resumes play.

### Requirement: Visible combat actions
Recall SHALL be visible during active play with remaining channel time and a cancel action. Phone controls SHALL show attack status and useful mana readiness. Rejected casts SHALL give a concise reason without blocking movement. A touch action that opens a panel SHALL keep that panel open until the player closes it or chooses an action.

#### Scenario: Recall and interruption
- **WHEN** a living player taps Recall, then cancels it, moves or takes damage
- **THEN** the channel begins visibly and ends without healing at home; an uninterrupted channel retains the existing completion behavior.

#### Scenario: Inspect a rejected spell
- **WHEN** a player attempts an unlearned, cooling-down, unaffordable or control-blocked spell
- **THEN** its actual rejection reason appears outside the finger's touch area and no unintended spell fires.

#### Scenario: Open a panel by touch
- **WHEN** a player taps the map and the browser delivers a follow-up compatibility click
- **THEN** the map stays open, the old click cannot activate its Close action, and a separate press or keyboard activation remains available.

### Requirement: Current lane and control guidance
HUD and map objectives SHALL follow the nearest lane with hysteresis. Touch guidance SHALL describe drag movement and tap selection; mouse guidance SHALL describe click movement.

#### Scenario: Change lanes
- **WHEN** a hero walks from the middle lane into the west lane
- **THEN** the HUD and Next tower action identify the west lane's next eligible objective, while shared lane segments do not cause rapid label changes.

#### Scenario: Choose a map route on any supported layout
- **WHEN** a player opens the tactical map at a supported desktop, portrait or landscape size
- **THEN** the map, all five route actions and Back remain visible together without moving to another panel page.
