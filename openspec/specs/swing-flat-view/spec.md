# swing-flat-view Specification

## Purpose
In Full Swing flat play, where the camera sits and where spoken lines show, so the hero stays in view.

## Requirements

### Requirement: The camera stays above the hero
In third-person flat play the chase camera SHALL sit above the hero's head and look down at the hero. At rest it SHALL look down about 20 degrees with the hero in the lower middle of the screen and the aim just above the head. Looking up SHALL bring the camera down toward a floor 0.45 m above the eyes and SHALL NOT take it lower. The look-up limit in third person SHALL keep the hero's head on the screen.

#### Scenario: Default view
- **WHEN** the player starts flat play on desktop or a phone
- **THEN** the camera is more than 1 m above the hero's head, the head is below the middle of the screen, and the aim is above the head

#### Scenario: Look up as far as it goes
- **WHEN** the player looks up to the limit
- **THEN** the camera is at least 0.45 m above the eyes and the hero's head is still on the screen

#### Scenario: Anywhere in the city
- **WHEN** the camera is tested from many places and pitches, near walls and in the open
- **THEN** it is never below the hero's head

#### Scenario: Back from first person
- **WHEN** the player looks up past the third-person limit in first person and presses V
- **THEN** the view eases back to the limit instead of snapping

### Requirement: Spoken lines keep off the hero
Subtitles and toasts SHALL sit at the top of the screen, under the score pills, on desktop and on phones in portrait and landscape.

#### Scenario: Phone portrait
- **WHEN** a line is spoken on a 390×844 phone
- **THEN** the line covers neither the hero, the top buttons, the pills nor the SWING panel
