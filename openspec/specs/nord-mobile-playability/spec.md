# NORD mobile playability

## Purpose
Support natural touch gestures, sustained neighbourhood traffic and safe mapped-pond swimming.

## Requirements


### Requirement: Natural mobile gestures
The browser SHALL support double-tap sprint on movement or Sprint and camera dragging from held action buttons without losing movement/action keys.

#### Scenario: Sprint and look with two thumbs
- **WHEN** a walking player double-taps and holds Move, or double-taps Sprint while moving
- **THEN** sprint stays active while movement is held, and dragging a held action changes the camera.
- **AND** menu, blur, rotation, cancellation, disconnect and entering a car release latched sprint and all touch-held keys; steering remains independent of camera dragging.

### Requirement: Visible circulating traffic
The live city SHALL show moving traffic on usable streets in the starting neighbourhood and on district routes, keeping it circulating over sustained play, yielding safely to occupied roads and junctions.

#### Scenario: Longer session
- **WHEN** a session runs for several minutes and a player watches the starting street or drives nearby
- **THEN** nearby ambient cars traverse the street and traffic does not permanently stop from stale or mutually blocking reservations.

### Requirement: Mapped ponds support swimming
Walking characters SHALL swim in actual pond water, float at the surface and return to walking safely at a bank, retaining network authority and normal land/collision behavior.

#### Scenario: Enter, swim and leave
- **WHEN** a local or remote character moves into a mapped pond
- **THEN** it enters native swimming movement, has an observable swimming pose and swims at the waterline rather than walking on top.
- **WHEN** it reaches a safe bank or island
- **THEN** it returns to grounded walking without being stuck below terrain, teleported through an obstacle or retaining stale swimming pose/collision.

#### Scenario: Water boundaries
- **WHEN** a player crosses dry land, an island, a bridge or water in the air
- **THEN** only actual water at swimming height activates swimming; dry ground, bridges and jumping above water retain appropriate collision/movement.


### Requirement: Visible movement direction
The move stick SHALL remain visible while held, with its knob showing the current direction without increasing its footprint.

#### Scenario: Hold and release Move
- **WHEN** a player holds and drags Move in portrait or landscape
- **THEN** the stick retains at least 0.5 opacity and the knob reflects direction; release resets its knob and normal appearance.
