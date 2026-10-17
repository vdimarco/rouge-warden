## ADDED Requirements

### Requirement: The gang moves on threes
In flat play with Comic motion on Full or Calm, a goon SHALL take a new pose 8 times a second, and at once when his pose or his
state changes. His place SHALL move every frame. A walking goon SHALL swing his legs. With Comic motion Off, a goon SHALL pose every
frame.

#### Scenario: A goon walks at the hero
- **WHEN** a goon 10 m away walks at the hero for one second
- **THEN** his drawn pose changes 5 to 11 times, and his drawn place changes at least 50 times

### Requirement: The key pose of a blow
A punch, a kick, a zip kick and a finisher SHALL start at the strike's full reach, so the hit-stop holds the blow.

#### Scenario: A punch
- **WHEN** the player punches a goon
- **THEN** the hero's pose is the punch on the first frame

### Requirement: Squash and stretch
In flat play, a landing SHALL squash the hero and a jump SHALL stretch him, about his feet, with his volume kept, and he SHALL settle
back to his shape. There SHALL be none on a wall or in a roll.

#### Scenario: Jump and land
- **WHEN** the hero jumps from the street and lands
- **THEN** he stretches by more than 3 % after the jump, squashes by more than 3 % on the landing, and is back within 1.5 s

### Requirement: Multiples
In flat play, a blow SHALL leave a see-through copy of the hero's pose before the blow, and a zip SHALL leave copies along its
flight. A copy SHALL fade within 0.16 s. At most two copies SHALL show.

#### Scenario: A punch leaves a copy
- **WHEN** the player punches a goon
- **THEN** a copy shows, and it is gone half a second later

### Requirement: Words that fit the fight
In flat play, the finisher word SHALL be a third of the view wide. With Comic motion on, a crash into a wall SHALL leave a small word
on the wall for 20 s, at most six at once, the oldest giving way.

#### Scenario: A finisher
- **WHEN** the player finishes two goons
- **THEN** the KASPLASH word is between 28 % and 40 % of the view wide

#### Scenario: Seven wall words
- **WHEN** seven wall words are made
- **THEN** six show after 10 s, and none after 21 s

### Requirement: A heavy blow hits the camera
With Comic motion Full, a kick, a zip kick, a finisher or a slam SHALL narrow the view by 10 % to 15 % at once and widen it back
within about six frames. With Full or Calm it SHALL double the plate slip for a moment.

#### Scenario: A kick
- **WHEN** the third blow of a combo lands
- **THEN** the plate slip is at least 1.8 times its value before, and the view is 10 % to 15 % narrower, and back within 8 frames

### Requirement: Paper and the frame edge
With Comic motion on, the frame SHALL show a fine paper grain in its mid-tones, none on black or white, and the plates SHALL slip
more toward the frame edge.

#### Scenario: The street
- **WHEN** one frame draws with Comic motion Full and then Off
- **THEN** under 40 % of the pixels differ by more than 24 in a channel
