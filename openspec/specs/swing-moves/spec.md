# swing-moves Specification

## Purpose
In Full Swing, the hero's extra moves: the sprint and the dive roll.

## Requirements

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

### Requirement: One button starts a swing
On the ground, holding a swing input on a building with no move input SHALL walk the hero toward that web at walking speed, so the swing leaves the roof without a forward hold. A rope on a clog, a pipe, or the crack SHALL NOT walk the hero. A move input SHALL still steer.

#### Scenario: The swing button on the start roof
- **WHEN** the player holds only the swing button, aimed at the gold ring, from the start roof
- **THEN** the hero leaves the roof within 4 seconds with the rope attached

#### Scenario: A clog stays put
- **WHEN** the player ropes a clog and does not steer
- **THEN** the hero does not walk toward it

### Requirement: A fast let-go carries the swing
In flat play with a mouse or a pad, letting go of a building rope while the hero is in the air and moving at least 8 m/s across the ground SHALL add speed along that flight and a little upward speed, including when the GO cue is not showing. That let-go SHALL NOT flip the hero and SHALL NOT cancel a fall. A let-go while the GO cue shows SHALL keep the larger boost and the flip. A let-go under 8 m/s SHALL NOT add that carry. A phone's own let-go is unchanged.

#### Scenario: Early, and already fast
- **WHEN** the player lets go of a rope while falling and moving faster than 8 m/s across the ground, outside the GO cue
- **THEN** the flight speeds up, the fall continues, and the hero does not flip

#### Scenario: A slow drop
- **WHEN** the player lets go of a rope while nearly still
- **THEN** no carry is added

### Requirement: A dive lands in a roll
In flat play, a landing from a dive, or a landing faster than 13 m/s down, SHALL be a forward roll of about 0.6 s: the hero tucks
and turns once over, keeps at least 6 m/s along the ground, and then runs on. The landing crouch SHALL not play for a roll. The
dive SHALL hold until a quarter second before the ground. A roll that lands among goons SHALL knock them down.

#### Scenario: A drop from a tall roof
- **WHEN** the hero dives from 90 m and lands on a street
- **THEN** the pose is "roll" after the landing and the speed along the ground at the landing is at least 5.5 m/s

### Requirement: A held swing catches the next building
In flat play with a mouse or a pad, holding the swing button through the GO cue SHALL let that building rope go and then catch a different building ahead, without a new press. The next rope SHALL NOT attach to another tier or the antenna of the building just left. The rope SHALL stay while the button is held until that cue has been showing. A rope in the sky SHALL stay while the button is held. Letting go of the button SHALL still let the rope go, and SHALL NOT catch another building by itself. A clog, a pipe, or the crack SHALL stay while the button is held. With no other building ahead, holding SHALL NOT throw a dry web on every frame. A phone's own let-go is unchanged. A headset is unchanged.

#### Scenario: Hold through the cue
- **WHEN** the player holds the swing button from one building through the GO cue
- **THEN** the rope lets go and a new rope attaches to a different building without a fresh press

#### Scenario: Another piece of the same building
- **WHEN** the next point ahead is another tier or the antenna of the building just left
- **THEN** the new rope does not attach to that building

#### Scenario: Open water
- **WHEN** the player holds the swing button on a sky rope over open water through the GO cue
- **THEN** the sky rope stays attached

#### Scenario: The button comes up
- **WHEN** the player lets the swing button up before the cue
- **THEN** the rope lets go and no new rope fires while the button stays up

#### Scenario: A clog stays
- **WHEN** the player holds the swing button on a clog
- **THEN** the clog rope stays
