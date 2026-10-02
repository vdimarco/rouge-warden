## ADDED Requirements

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
