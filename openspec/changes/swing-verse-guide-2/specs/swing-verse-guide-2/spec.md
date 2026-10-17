## ADDED Requirements

### Requirement: Ink lines from depth
In flat play with Comic motion on Full or Calm, the frame SHALL draw ink where the depth between neighbouring pixels jumps by
over 12 % of the distance, and none where the depth is past a quarter of the camera's far plane.

#### Scenario: The street
- **WHEN** one frame of the street draws with Comic motion Full and then Off
- **THEN** the share of near-black pixels is higher with Full

### Requirement: Hatching in the darkest shadows
In flat play with Comic motion on Full or Calm, pixels darker than a luminance of 0.16 SHALL get diagonal ink lines, denser where
it is darker.

#### Scenario: The street
- **WHEN** one frame of the street draws with Comic motion Full and then Off
- **THEN** the share of near-black pixels is higher with Full

### Requirement: Mood grading
In flat play with Comic motion on Full or Calm, the shadows and mid-tones SHALL lean red while goons fight the hero, and blue as
his hearts fall to two or fewer, the stronger of the two winning, by at most 45 %, easing over about a second. The light SHALL not
change.

#### Scenario: A fight
- **WHEN** a goon fights the hero for a second
- **THEN** the mood is red and over 30 %

#### Scenario: One heart left
- **WHEN** the hero has one heart and no goon fights him
- **THEN** the mood is blue and over 30 %, and it clears once he heals

### Requirement: Velocity smear
In flat play with Comic motion on Full or Calm, the hero's body SHALL stretch along his flight above 16 m/s, up to 30 % longer,
thinner across, about the chest, and SHALL not stretch on a wall, in a roll or at rest.

#### Scenario: Fast flight
- **WHEN** the hero flies at 32 m/s
- **THEN** his body stretches by more than 15 % and at most 30 %

#### Scenario: At rest
- **WHEN** the hero stands on the street
- **THEN** his body does not stretch
