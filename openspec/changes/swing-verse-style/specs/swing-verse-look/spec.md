## ADDED Requirements

### Requirement: The hero moves on twos
In flat play with Comic motion on Full or Calm, the hero SHALL take a new pose 12 times a second. Between poses the body SHALL move
with the player, and the hands, the head and the feet SHALL move with it, so a rope still starts at the hand. A yank, an attack,
a hit or a roll SHALL take a new pose at once. While the hero holds a wall, and with a full focus meter or with Comic motion Off,
the hero SHALL take a new pose every frame. The headset SHALL not change.

#### Scenario: Walk on twos
- **WHEN** the hero walks for one second at 60 frames a second with an empty focus meter
- **THEN** the hand's place on the body changes 8 to 14 times

#### Scenario: In the zone
- **WHEN** the focus meter is full and the hero walks for one second
- **THEN** the hand's place on the body changes at least 40 times

### Requirement: The colour plates slip with distance
In flat play with Comic motion on Full or Calm, the last full-screen draw SHALL offset the red plate and the blue plate in opposite
directions by an amount that is near zero at the hero's distance from the camera and grows toward the far city and the sky. The
green plate SHALL stay in place. The slip SHALL grow with speed and grow for a moment after a release boost or a zip strike. A phone
with no bloom SHALL still run this pass.

#### Scenario: The street at rest
- **WHEN** the hero stands on a street and one frame draws with Comic motion Full and then Off
- **THEN** under 40 % of the pixels differ, and among the pixels that differ some have red and blue moved while green stays

### Requirement: Impact frames
With Comic motion Full, a kick, a zip strike, a finisher or a slam SHALL turn the frame into two inks (ink and a red hold) for about
0.07 s. Two flashes SHALL be at least 0.5 s apart. With Comic motion Calm or Off there SHALL be no impact frame.

#### Scenario: The third blow
- **WHEN** the player lands punch, punch, kick on a goon
- **THEN** the kick flashes an impact frame, and it is gone within 0.1 s

#### Scenario: Two kicks close together
- **WHEN** a second kick lands 0.2 s after a kick that flashed
- **THEN** no new impact frame shows

#### Scenario: Calm
- **WHEN** Comic motion is Calm and the player lands punch, punch, kick
- **THEN** no impact frame shows and the camera does not shake

### Requirement: Spider-sense
In flat play with Comic motion on Full or Calm, while a goon within 4 m winds up or swings at the hero, wavy lines SHALL show over
the hero's head in the third-person view.

#### Scenario: A wind-up
- **WHEN** a goon next to the hero winds up
- **THEN** the spider-sense lines show over the hero's head together with the DODGE prompt

### Requirement: The camera leans into a swing
With Comic motion Full, in third person, while a rope holds or the hero flies faster than 10 m/s, the camera SHALL roll toward the
side the path turns to, at most 7 degrees. On the ground or in a car, the roll SHALL ease back to level. The roll SHALL be drawn
only: aim and tap rays use the level camera.

#### Scenario: A turning swing
- **WHEN** the body moves round a circle of 20 m at 20 m/s for two seconds
- **THEN** the camera rolls by more than 3 degrees and at most 7 degrees, and back to level once on the ground

### Requirement: The Comic motion setting
The Comfort page on a flat screen SHALL have a row "Comic motion" with Full, Calm and Off. Full is the default. The choice SHALL be
saved.

#### Scenario: Pick Off
- **WHEN** the player picks Off
- **THEN** the frame draws with no plates, no impact frames and no spider-sense, and the hero takes a pose every frame
