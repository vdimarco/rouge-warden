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
- **THEN** the selected identity starts the match; a hovering fine-pointer desktop enters play directly, while touch/coarse-pointer controls open the initial spellbook. Enter on another focused control activates that control's own action.

#### Scenario: Keep long titles and short desktop actions usable
- **WHEN** a long hero name is selected near 1000px width or the desktop viewport is short
- **THEN** the name, skills, description and footer remain legible and fit without overlapping essential controls.

## ADDED Requirements

### Requirement: Clear desktop combat HUD
On screens matching `(hover: hover) and (pointer: fine)`, the combat HUD SHALL hide the movement pad, movement coach and floating spellbook/point control at every viewport size. Desktop matches SHALL start without opening the book. K and the pause menu SHALL open the spellbook on demand; the direct plus badges SHALL remain usable for learning skills. Coarse-pointer/touch controls SHALL retain the movement pad and point control. Starting a new match SHALL clear stale full-icon upgrade mode.

#### Scenario: Enter a desktop match
- **WHEN** a mouse-and-keyboard player starts a match at 1440x900 or in a compact desktop window
- **THEN** play begins directly, the left movement controls and floating book control are absent, and eligible skills show their direct upgrade actions.

#### Scenario: Inspect spells on demand
- **WHEN** a desktop player presses K or chooses Spellbook from the pause menu
- **THEN** the book opens, training remains available, and Escape returns to play.

#### Scenario: Use a touch screen
- **WHEN** a touch/coarse-pointer player enters a match at 390x844 or 844x390
- **THEN** the initial book and movement/point controls remain available, and independent movement and ability touches continue to work.
