## ADDED Requirements

### Requirement: A warning and a dodge
In flat play, a goon who winds up or swings within 4 m of the hero SHALL show a red warning mark over his head, and the prompt
line SHALL say DODGE with the jump input (Space, pad A); a phone SHALL show a DODGE button instead. That input SHALL then dodge
instead of jumping: the hero rolls to the side away from the goon, and every blow on its way from a goon within 4 m SHALL miss.
A dodge started during the wind-up is a perfect dodge. With no threat, the input SHALL jump as before.

#### Scenario: Dodge a punch
- **WHEN** a goon next to the hero winds up and the player presses Space
- **THEN** the warning mark shows during the wind-up, the hero moves at least 1.5 m away, and no heart is lost

#### Scenario: Dodge on a phone
- **WHEN** a goon next to the hero winds up on a phone
- **THEN** a DODGE button shows, and a tap on it dodges the blow

#### Scenario: No threat
- **WHEN** the player presses Space on a street with no goon winding up
- **THEN** the hero jumps

### Requirement: A perch takedown
In flat play, while the hero stands on a roof or holds a wall with no swing rope out, a goon who has not seen him, stands at least
5 m below him and within 34 m SHALL be a rope target, and the prompt line SHALL say TAKEDOWN when the marker is on him. A rope that
catches him SHALL lift him up to 5 m (never higher than 1.5 m under the hero) and leave him hanging upside down for 7 s, after
which he is gone. He counts as down. The other goons SHALL not notice. In a swing, an unaware goon SHALL not be a rope target.

#### Scenario: Take down a guard from a roof
- **WHEN** the hero stands on a roof edge 29 m over a street, and the player ropes a guard 14 m out on the street
- **THEN** the guard hangs upside down over the street, and the guard 3 m from him stays unaware

### Requirement: A focus meter and a finisher
In flat play, each blow SHALL fill a focus meter (a punch 10 %, a kick 16 %, a rope pull 12 %, a slam 12 %, a takedown 25 %, a
dodge 8 %, a perfect dodge 20 %). The meter and a count of the blows in a row (shown from 2, ended by a gap of 2 s) SHALL show at
the right edge of the screen during a fight. With the meter full and a goon in reach, the prompt line SHALL say FINISH, and F
(pad RB) with no rope out SHALL knock down every goon within 3.5 m, empty the meter and run the world at 30 % speed for 0.7 s.
That press SHALL not yank.

#### Scenario: A finisher on two goons
- **WHEN** the meter is full, two goons stand within 2 m of the hero, and the player presses F
- **THEN** both goons are down, the meter is empty, the world slows, and no rope yanks
