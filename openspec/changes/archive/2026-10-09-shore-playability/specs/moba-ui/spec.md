## ADDED Requirements

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

## MODIFIED Requirements

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
