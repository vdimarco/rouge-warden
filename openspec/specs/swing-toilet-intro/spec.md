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
rope target. A plunge and a pull SHALL make it erupt: a column of sludge SHALL blast from the bowl to the ceiling with a
flash and a spray, and the screen SHALL fade. Play SHALL then start with the hero thrown high over the lake shore, falling
toward the lake.

#### Scenario: Plunge the toilet
- **WHEN** a flat-screen player starts a first run and the toilet overflows
- **THEN** within 3 s the toilet is the target, and after the player plunges it and yanks, it erupts and play starts with
  the hero high over the lake

### Requirement: The opening is short
The opening comic SHALL last 15 s or less.

#### Scenario: The comic
- **WHEN** a first run starts on a flat screen
- **THEN** the six panels of the opening comic play in about 14 s

### Requirement: The lake gives the hero back
After the eruption, a fall into the lake SHALL splash and put the hero on the start roof, with a line that he was fished
out of the lake. Mission 1 SHALL start only when the fall is over: after the splash, after a landing anywhere else, or
after 12 s.

#### Scenario: Into the lake
- **WHEN** the hero falls into the lake after the eruption
- **THEN** KASPLASH shows, he is on the start roof, and then the Sludge Run starts with its full time
