## MODIFIED Requirements

### Requirement: Shoreline ducking branches
Duck hazards SHALL visibly grow from rooted shoreline trees in WebGL and the
2D fallback. Generated trees SHALL offer three contiguous widths covering one,
two or three river lanes. One- and two-lane branches SHALL originate from the
nearest bank; full-width branches SHALL vary bank sides. One tree SHALL present
each coherent span. Its visible low wood, markers, hint and physical coverage
SHALL agree, including between covered lanes. Timed ducking SHALL clear every
covered lane; uncovered lanes SHALL remain safely traversable. Accepted speed,
inputs, action windows, protection feedback and finite finishes SHALL remain.
Tree resources SHALL be prepared and bounded.

#### Scenario: Read and react to three widths
- **WHEN** a player approaches one-, two- or three-lane branches on phone, desktop or short landscape
- **THEN** each rooted tree visibly covers its marked contiguous lanes and shows a readable duck cue
- **AND** a timely duck clears any covered lane while an uncovered lane remains safe

#### Scenario: Physical span contact
- **WHEN** the standing raft crosses in a covered lane or between two covered lanes
- **THEN** that single branch triggers the existing collision outcome once
- **AND** coin pickups still require actual coin contact and a perfect duck earns one row reward

#### Scenario: Safe routes and stopped state
- **WHEN** seeded play completes all three maps, pauses or uses the fallback
- **THEN** full-width branches remain duckable, partial spans retain a fair clear or duck route, paused pixels stay fixed, and fallback coverage agrees within fixed resource bounds

### Requirement: Natural tree anatomy and materials
Shoreline duck trees SHALL have rooted broad trunks, detailed bark, naturally
tapering main limbs and multiple connected secondary and smaller offshoots
distributed along each span. The low limb SHALL sag gently across its covered
lanes without a steep angular drop, singular needle end or upward hook.
The primary 3D limb SHALL retain optimized local Meshy geometry and recorded
provenance. All three widths SHALL have distinct readable silhouettes from
both banks. Low wood and foliage SHALL respect covered/clear lanes and duck
clearance; decorative trees SHALL stay outside playable water. Texture and
geometry preparation SHALL finish before active play; failed assets SHALL
retain matching playable fallback anatomy and controls.

#### Scenario: Read connected natural anatomy
- **WHEN** a one-, two- or three-lane branch approaches from either bank
- **THEN** broad connected wood grows smoothly from the trunk, multiple substantial offshoots stem from it, and taper and bark remain readable on phone and desktop

#### Scenario: Preserve clearance and resources
- **WHEN** the raft ducks, changes between covered lanes, pauses or advances deep into a map
- **THEN** low wood agrees with span coverage, the ducking silhouette clears it, uncovered lanes stay open, paused pixels remain identical and prepared tree resources stay bounded
