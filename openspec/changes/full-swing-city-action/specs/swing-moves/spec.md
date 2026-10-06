## ADDED Requirements

### Requirement: Sprint with an energy gauge
In flat play, holding Shift (a pad's left stick click) while walking on the ground with no rope out SHALL make the hero run at
2.2 times the walking speed. An energy gauge SHALL show while it is not full, drain over 5 s of sprinting, and end the sprint
when empty. It SHALL fill again after 0.8 s without sprinting. With a rope out, Shift SHALL still reel in. A headset does not
sprint.

#### Scenario: A sprint down the street
- **WHEN** the player holds W and Shift on a street
- **THEN** the hero runs at least 1.8 times the walking speed and the gauge drains

#### Scenario: Out of energy
- **WHEN** the player sprints for more than 5 s
- **THEN** the sprint ends at walking pace, and the gauge fills again after the player lets go

### Requirement: A dive lands in a roll
In flat play, a landing from a dive, or a landing faster than 13 m/s down, SHALL be a forward roll of about 0.6 s: the hero tucks
and turns once over, keeps at least 6 m/s along the ground, and then runs on. The landing crouch SHALL not play for a roll. The
dive SHALL hold until a quarter second before the ground. A roll that lands among goons SHALL knock them down.

#### Scenario: A drop from a tall roof
- **WHEN** the hero dives from 90 m and lands on a street
- **THEN** the pose is "roll" after the landing and the speed along the ground at the landing is at least 5.5 m/s
