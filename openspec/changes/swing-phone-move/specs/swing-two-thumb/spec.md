## ADDED Requirements

### Requirement: Two thumbs together throw a pair
On a phone, two fingers that are down on the city at the same time SHALL throw a pair: when both plungers catch, neither SHALL let
the other go, however far apart the fingers lift. Taps on alternate sides that do not overlap SHALL still hand the swing over (the
old plunger lets go just after the new one catches).

#### Scenario: Thumbs that lift apart
- **WHEN** the player presses both thumbs, lifts the left, and lifts the right 0.5 s later
- **THEN** both plungers catch and both hold

#### Scenario: Alternate taps
- **WHEN** the player taps left, then taps right 0.5 s later with no overlap
- **THEN** the left plunger lets go just after the right one catches
