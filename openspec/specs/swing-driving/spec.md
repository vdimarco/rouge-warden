# swing-driving Specification

## Purpose
In Full Swing, the parked cars the hero can get into, and how a car drives.

## Requirements

### Requirement: Parked cars to drive
In flat play, up to ten parked cars SHALL wait at the kerbs within 120 m of the player, clear of buildings and junctions. Next to
one (3.4 m), on the ground with no rope out, a prompt SHALL say R GET IN (B on a pad); a phone SHALL show a CAR button. The key or
button SHALL put the hero in: the hero is hidden, the ropes let go, and the chase camera pulls back behind the car.

#### Scenario: Get in
- **WHEN** the player stands at a parked car's door and presses R
- **THEN** the hero is in the car and the prompt says R GET OUT

### Requirement: Driving
W (the stick, a phone's GAS) SHALL drive forward up to 28 m/s; S (BRAKE) SHALL brake, then reverse. A and D (the stick, the
phone's arrows) SHALL steer, more sharply at low speed. Space (a pad's A) SHALL be the handbrake. A car SHALL never enter a
building or the lake: it stops and bounces back. People SHALL run out of the way of a moving car. R (B, OUT) SHALL get the hero
out at the driver's side.

#### Scenario: A short drive
- **WHEN** the player holds W for 2 s in a car on a street
- **THEN** the car moves at more than 6 m/s, and R puts the hero back on the street beside it

#### Scenario: Wild steering
- **WHEN** the car drives with the throttle down and the steering swinging for 20 s
- **THEN** it is never inside a building, and it bounces off at least one wall
