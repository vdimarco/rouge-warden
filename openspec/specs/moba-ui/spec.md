# Monster Mash opening UI

### Requirement: Epic opening scene
The opening screen SHALL show a painted moonlit folklore stage, a prominent selected hero, role filters, spell previews and the existing match facts.

#### Scenario: Select a legend
- **WHEN** the player selects any of the twelve heroes or changes a role filter
- **THEN** the selected state, hero name, portrait, stats and four spells update correctly and all matching heroes remain reachable.

### Requirement: Contained opening layout
The opening screen SHALL fit the viewport with a reserved footer row and scrollable content. It SHALL provide readable controls at 360x640, 390x844, 844x390 and desktop sizes.

#### Scenario: Browse on a phone
- **WHEN** the player browses the roster on a narrow or short viewport
- **THEN** the Start button does not cover a hero card, the final hero is reachable, and there is no horizontal page overflow.

#### Scenario: Enter and leave a match
- **WHEN** the player previews a spell, starts a match, trains a skill and returns to hero selection
- **THEN** the existing preview, learning and game controls work with the new UI.

#### Scenario: Reduce motion or lose background art
- **WHEN** reduced motion is requested or the painted backdrop cannot load
- **THEN** decorative motion stops and the native selection controls remain legible and usable.

### Requirement: Fal cinematic opening artwork
The opening screen SHALL use a Fal-generated cinematic folklore environment while preserving native controls.

#### Scenario: Use generated art
- **WHEN** approved Fal artwork is integrated
- **THEN** the moonlit hero stage remains readable with all selection and Start controls reachable at supported viewports.

#### Scenario: Load without artwork
- **WHEN** the generated background is unavailable
- **THEN** the native hero preview, roster and Start controls remain readable and usable on the dark fallback.

#### Scenario: Enter and return
- **WHEN** a player selects a hero, previews a spell, starts and returns to selection
- **THEN** the cinematic stage preserves the existing selection, learning and game controls.
