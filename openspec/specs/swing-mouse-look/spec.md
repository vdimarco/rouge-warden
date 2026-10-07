# swing-mouse-look Specification

## Purpose
In Full Swing on a desktop, mouse look that never stops at the edge of the screen.

## Requirements

### Requirement: The mouse never catches at the screen edge
On desktop the PLAY and RESUME clicks SHALL ask for the pointer lock before full screen, ask for raw movement where the browser supports it and fall back to a plain lock, and take the lock again after full screen starts where the system drops it. Without a lock, moving the visible cursor SHALL still turn the view, a cursor resting near an edge SHALL keep turning it, and a caption SHALL say how to take the lock. The click that takes the lock SHALL NOT fire a rope.

#### Scenario: PLAY
- **WHEN** the player clicks PLAY ON THIS SCREEN
- **THEN** the lock is asked for before full screen, and the mouse turns the view under the lock

#### Scenario: No lock
- **WHEN** the browser refuses the lock and the player rests the cursor near the right edge
- **THEN** the view keeps turning right every frame, and "Click to look around" shows

#### Scenario: Click to lock
- **WHEN** the player clicks with no lock during play
- **THEN** the lock is taken and no rope fires

#### Scenario: Resume after Esc
- **WHEN** the player presses Esc, then clicks RESUME
- **THEN** the lock is taken inside that click, or asked for again after the browser's short wait
