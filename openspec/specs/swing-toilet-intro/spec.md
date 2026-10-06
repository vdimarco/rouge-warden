# swing-toilet-intro Specification

## Purpose
In Full Swing, the opening on a flat screen (the overflowing toilet) and a fair Catch! fall.

## Requirements

### Requirement: A Catch! fall is clear to the street
A Catch! faller SHALL fall from a roof edge with no lower tier, ledge or other building under the fall line above 3 m. A roof with
no such edge SHALL get no Catch! marker. The faller SHALL wait 3.5 s on the edge and SHALL say a warning line 1.5 s before the fall.

#### Scenario: Nobody lands on a ledge
- **WHEN** a Catch! job runs and the player stays far away
- **THEN** the faller ends at street level, 3 m or lower, after at least 2.5 s of fall

### Requirement: The flat-screen intro plunges an overflowing toilet
On a flat screen the cottage room SHALL show the toilet in the middle of the wall. It SHALL rattle, then overflow, and then be the
rope target. A plunge and a pull SHALL flush it; the screen SHALL fade and play SHALL start on the start roof with a splash.

#### Scenario: Plunge the toilet
- **WHEN** a flat-screen player starts a first run and the toilet overflows
- **THEN** within 3 s the toilet is the target, and after the player plunges it and yanks, play starts on the start roof

### Requirement: The opening is short
The opening comic SHALL last 15 s or less.

#### Scenario: The comic
- **WHEN** a first run starts on a flat screen
- **THEN** the six panels of the opening comic play in about 14 s
