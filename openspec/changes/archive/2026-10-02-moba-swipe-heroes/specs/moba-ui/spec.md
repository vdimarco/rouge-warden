## MODIFIED Requirements

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

## ADDED Requirements

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
