## ADDED Requirements

### Requirement: Hit-stop
In flat play, a blow that lands SHALL stop the world for a time set by its weight: a punch 45 ms, a rope pull 50 ms, a hurt 50 ms,
a slam 60 ms, a kick 80 ms, a zip strike 90 ms, a finisher 120 ms. The frame SHALL keep drawing while the world stops, and the
camera shake SHALL keep moving. Hit-stop SHALL run with every Comic motion choice.

#### Scenario: A punch
- **WHEN** the player punches a goon in reach
- **THEN** the world stops for between 30 ms and 100 ms

#### Scenario: A kick
- **WHEN** the third blow of the combo (the kick) lands
- **THEN** the world stops longer than for a punch

### Requirement: Camera shake
With Comic motion Full, each blow and each hurt SHALL add trauma (0 to 1) to the camera. The shake SHALL grow with the square of the
trauma, and the trauma SHALL decay by 1.8 a second in real time. The shake SHALL be drawn only. With Calm or Off there SHALL be no
shake.

#### Scenario: A punch shakes
- **WHEN** the player punches a goon in reach with Comic motion Full
- **THEN** the camera trauma is above 0.1

### Requirement: The zip strike
In flat play, while a combo runs (a blow landed under 2 s ago), a press of the swing input with no goon in reach SHALL zip the hero
to the living goon 2.6 m to 14 m away, within 4 m up or down and about 50 degrees of the view, nearest the middle of the view. The
hero SHALL fly at 26 m/s at the goon's chest, any rope out SHALL let go, and in reach the hero SHALL land a flying kick (2 damage,
a 3.5 m push), bounce back 3 m/s and up 5 m/s, and fill the focus meter. A zip that does not arrive in 0.7 s SHALL end. With no
combo running, the press SHALL fire a rope as before.

#### Scenario: Chain to the next goon
- **WHEN** a punch knocks a goon down and a second goon stands 8 m ahead in the view, and the player presses the swing input
- **THEN** the hero zips to the second goon and lands a flying kick within 0.7 s

#### Scenario: No combo
- **WHEN** no blow has landed and a goon stands 8 m ahead, and the player presses the swing input
- **THEN** the hero does not zip

### Requirement: Combo words grow
The BONK word of a punch or a kick SHALL be 5 % larger for each blow in the combo count, up to 10 blows.

#### Scenario: A long combo
- **WHEN** the combo count is 6 and the player lands a punch
- **THEN** the BONK word is 30 % larger than the first
