# Monster Mash opening UI

### Requirement: Epic opening scene
The opening screen SHALL show a painted moonlit folklore stage, a prominent selected hero, role filters, spell previews and the existing match facts.

#### Scenario: Select a legend
- **WHEN** the player selects any of the twelve heroes or changes a role filter
- **THEN** the selected state, hero name, portrait, stats and four spells update correctly and all matching heroes remain reachable.

#### Scenario: Browse unframed heroes
- **WHEN** the player views or selects a hero in the opening lineup
- **THEN** the portraits appear without card borders, filled card backgrounds or a decorative portrait frame; a highlighted and underlined name identifies selection and keyboard focus remains visible.

### Requirement: Contained opening layout
The opening and game panels SHALL fit the current viewport without vertical scrolling. The hero lineup SHALL show three cards below 600px wide, four below 1000px, and five on wider screens. Footer actions SHALL remain visible with safe-area insets.

#### Scenario: Browse by swipe
- **WHEN** the player swipes left or right through the lineup
- **THEN** the centered hero becomes selected and its name, portrait, stats and four spells update; all twelve heroes remain reachable.

#### Scenario: Select without a swipe
- **WHEN** the player taps a hero, uses a lineup arrow or presses a keyboard arrow
- **THEN** the requested hero is centered and selected without moving the page vertically.

#### Scenario: Compact viewport
- **WHEN** the player opens selection or a game panel at 320x568, 360x640, 390x844 or 844x390
- **THEN** the content uses compact rows or pages and all actions remain reachable without a vertical scroll.


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

### Requirement: Animated hero portraits
The lineup SHALL display actual animated GIF idle loops for all twelve heroes, preserving the existing identity and static artwork fallback.

#### Scenario: Reduce motion or lose a GIF
- **WHEN** reduced motion is requested or an animated portrait fails to load
- **THEN** the original static portrait is shown and selection remains usable.

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
