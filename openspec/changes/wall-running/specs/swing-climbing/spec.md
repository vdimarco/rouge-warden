## ADDED Requirements

### Requirement: A fast hit runs the wall
Touching a building side at 4 body-heights a second or faster, with at least half of that speed going into the wall, SHALL stick the hero to it and start a wall run. A slower touch SHALL still cling, hold still with no input, and climb at 6 m/s. A brush that does not put that speed into the wall SHALL NOT stick. Headset play SHALL NOT run or climb.

#### Scenario: Standing run to a 10-body-height roof
- **WHEN** the hero sprints into a building side from the street and the roof is 10 body-heights up
- **THEN** the hero sticks and stands on that roof in under 3 seconds

#### Scenario: A slow touch
- **WHEN** the hero meets a wall slower than 4 body-heights a second
- **THEN** the hero clings, and with no input stays still

#### Scenario: A brush
- **WHEN** the hero swings past a wall at 20 m/s and touches it at 2 m/s
- **THEN** the hero does not stick

### Requirement: Up, along, and the slide
Forward, and no direction, SHALL run up the wall at 6 body-heights a second. A sideways push SHALL run along the wall at 7 body-heights a second. After 3 seconds on the wall the hero SHALL slide down at 2 body-heights a second. Landing, including standing on a roof or the street, SHALL reset the timer. Leaving the wall in the air SHALL NOT reset it.

#### Scenario: Run up
- **WHEN** the hero is on a wall run and does not push sideways
- **THEN** the hero moves up the wall at 6 body-heights a second

#### Scenario: Run along
- **WHEN** the hero pushes sideways on a wall run
- **THEN** the hero moves along the wall at 7 body-heights a second

#### Scenario: The slide
- **WHEN** the hero has been on the wall run for 3 seconds
- **THEN** the hero slides down at 2 body-heights a second

#### Scenario: Landing
- **WHEN** the hero lands after leaving a wall run in the air
- **THEN** the timer is 0

### Requirement: The roof and the kick
At a roof edge a wall run SHALL vault the hero onto the roof. Jump on a wall run SHALL kick the hero off at 8 body-heights a second, straight away from the wall, with no upward speed. A cling jump SHALL still leave at 6 m/s out and 6 m/s up. Firing a web from the wall SHALL swing the hero straight off it.

#### Scenario: The roof
- **WHEN** a wall run reaches the top edge of a building
- **THEN** the hero stands on the roof

#### Scenario: Jump
- **WHEN** the hero jumps during a wall run
- **THEN** the hero leaves the wall at 8 body-heights a second away from it

#### Scenario: A web
- **WHEN** the hero fires a web while holding a wall
- **THEN** the hero leaves the wall and the web flies

### Requirement: Phone swipe and the run on the wall
A swipe up on the right half of a phone, while the hero is on a wall, SHALL jump. It SHALL NOT add a button. The climb pad and its JUMP button SHALL stay. The pose SHALL be the existing run cycle turned 90 degrees so the feet are on the wall. Every other step SHALL drop a small smog puff of colour `#8A8378`, drawn in code. `window.__test.wall` SHALL be `{ onWall, face: { x, z }, timer, mode }` with `mode` one of `up`, `along`, `slide`, `cling`, `off`.

#### Scenario: Swipe up
- **WHEN** a phone player on a wall swipes up on the right half
- **THEN** the hero jumps off the wall and no new button is shown

#### Scenario: The test hook
- **WHEN** the hero is running up a wall
- **THEN** `window.__test.wall.onWall` is true, `mode` is `up`, and `timer` advances
