## ADDED Requirements

### Requirement: Short first match
The game SHALL let the player start with the selected hero directly, retain optional draft inspection and remember the chosen hero. A new player SHALL start with Apprentice unless they choose another difficulty. Match start SHALL show a short contextual guide and SHALL NOT open the full spellbook automatically.

#### Scenario: Begin on any supported layout
- **WHEN** a new player starts at 1440x900, 390x844, 320x568 or 844x390
- **THEN** play starts without a paused spellbook, movement remains available, and one guide at a time explains learning, movement and spell aim/cancel.

#### Scenario: Return or inspect more
- **WHEN** the player returns or opens the draft or spellbook
- **THEN** their saved hero is restored and the requested full controls remain available.

### Requirement: Visible combat actions
Recall SHALL be visible during active play with remaining channel time and a cancel action. Phone controls SHALL show attack status and useful mana readiness. Rejected casts SHALL give a concise reason without blocking movement.

#### Scenario: Recall and interruption
- **WHEN** a living player taps Recall, then cancels it, moves or takes damage
- **THEN** the channel begins visibly and ends without healing at home; an uninterrupted channel retains the existing completion behavior.

#### Scenario: Inspect a rejected spell
- **WHEN** a player attempts an unlearned, cooling-down, unaffordable or control-blocked spell
- **THEN** its actual rejection reason appears outside the finger's touch area and no unintended spell fires.

### Requirement: Current lane and control guidance
HUD and map objectives SHALL follow the nearest lane with hysteresis. Touch guidance SHALL describe drag movement and tap selection; mouse guidance SHALL describe click movement.

#### Scenario: Change lanes
- **WHEN** a hero walks from the middle lane into the west lane
- **THEN** the HUD and Next tower action identify the west lane's next eligible objective, while shared lane segments do not cause rapid label changes.
