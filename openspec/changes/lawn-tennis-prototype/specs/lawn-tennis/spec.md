## ADDED Requirements

### Requirement: Portrait backyard rally
The game SHALL show a top-down lawn with the player at the bottom and the Neighbour at the top in portrait. A tap anywhere SHALL swing. The player SHALL move toward the predicted landing without a drag. Mouse and keyboard SHALL swing on a wide screen. Every on-screen control SHALL be at least 48 px in both directions.

#### Scenario: Phone width
- **WHEN** the page is opened at 390 by 844
- **THEN** the court is visible, the player is on the near side, and a tap swings

#### Scenario: Wide screen
- **WHEN** the page is opened at 1280 px wide
- **THEN** the court fills the canvas under the control bar, no empty pad is drawn, and a click or the Space key swings

### Requirement: Spec numbers and seed
Gravity SHALL be 8 and bounce restitution SHALL be 0.75. Casual serves SHALL leave at a horizontal pace of 9 metres per second, and pro serves at 13. Rally shots SHALL use a horizontal pace from 8 to 14. The first three player returns SHALL use a 250 ms window, then 160 ms on casual and 110 ms on pro. `?seed=N` SHALL make serves and Neighbour choices repeatable. Point 1 SHALL NOT use that generator.

#### Scenario: Same seed
- **WHEN** two matches with the same seed play the same swings for the same number of steps
- **THEN** the ball positions match

#### Scenario: Window length
- **WHEN** a casual match is in the opening rally and the player has fewer than 3 returns
- **THEN** the hit window is 250 ms, and the next return uses 160 ms

### Requirement: Scripted miss only on point 1
On point 1 the Neighbour SHALL return the first three arrivals and miss the fourth. From point 2 the Neighbour SHALL use the normal error rate, and a casual rally SHALL be able to reach at least 6 hits.

#### Scenario: Point 1
- **WHEN** the player returns every ball in the window on point 1
- **THEN** the Neighbour returns 3 times, misses on the 4th arrival, and the player leads 1 to 0

#### Scenario: Later rally
- **WHEN** the same perfect returns continue on point 2 across casual seeds
- **THEN** at least one seed reaches 6 or more hits, and the scripted miss flag is off

### Requirement: Flower on the hit frame
Each successful return SHALL add one flower to that hitter's bed in the same step as the hit. The flower count SHALL be visible to `window.__test` before the next step.

#### Scenario: Immediate bloom
- **WHEN** the player swings inside the window
- **THEN** the player flower count increases by 1, and the bloom frame equals the hit frame

### Requirement: Test hook
The page SHALL set `window.__test` to an object with `state`, `step`, `advance`, `swing`, `score`, `ballPos`, `forcePoint`, `flowers`, `rally`, and `scriptedMiss`. `state` SHALL include the score, the ball, the rally count, and the flowers.

#### Scenario: Step a rally
- **WHEN** a QA script loads a seeded match and calls `step`, `advance`, and `swing`
- **THEN** it can read the score, ball, rally count, and flowers without clicking the canvas

### Requirement: First points of a match
The match SHALL be first to 7, win by 2. The opening SHALL show the court, a ball already on a slow lob, a glowing racket for about 2 seconds, and a landing ring before the first hit. After point 1 the landing ring SHALL show a coloured early and late edge. The first 30 seconds SHALL NOT depend on written instructions.

#### Scenario: Opening and second serve
- **WHEN** a player returns every ball in the window from the opening
- **THEN** the first hit is a few seconds in, point 1 ends before 30 seconds, and the next serve shows the coloured ring

### Requirement: Cottage cabinet
The Cottage Arcade SHALL show a Lawn Tennis machine in the Cottage group, after In Full Swing. The machine SHALL open `/tennis/`. The game switcher SHALL list Lawn Tennis with the same id and the same name as the machine. The Lab group SHALL stay at 17 machines.

#### Scenario: Cottage row
- **WHEN** the player opens the Cottage group
- **THEN** Lawn Tennis is the last machine in that row, and choosing it opens `/tennis/`

#### Scenario: Same name in the switcher
- **WHEN** the arcade page and the game switcher are read
- **THEN** both call the machine Lawn Tennis and both use the id tennis

### Requirement: Tilt and flick
On a phone the player SHALL move by tilting. Gamma moves sideways, with a 3 degree dead zone and full speed at 25 degrees. Beta moves forward and back at 40 percent of that speed. A flick at or above 250 degrees per second SHALL swing. Peaks from 250 to 450 are a drop, 450 to 900 a drive, and above 900 a smash when the ball is high or in the front half. Above 900 on a low ball SHALL be a hard drive. Timing SHALL still set the angle. A second flick within 350 ms SHALL be ignored, and tilt input SHALL stay frozen for 250 ms after a swing.

#### Scenario: Dead zone and full speed
- **WHEN** tilt is 2 degrees
- **THEN** the player stays still, and at 25 degrees the player runs at full speed

#### Scenario: Flick bands
- **WHEN** flicks of 300, 600, and 1000 degrees per second are injected
- **THEN** the shots are drop, drive, and smash

### Requirement: Gate, sound, and fallback
The first phone screen SHALL be a garden gate reading "Tap to step onto the court". That tap SHALL call the motion and orientation permission requests and resume the AudioContext in the same call, before any wait. Denied or missing motion SHALL fall back to touch. Desktop SHALL skip the gate and use the keyboard and mouse. `?input=tilt` SHALL skip the gate and accept injected tilt. Sounds SHALL be synthesized. A flick SHALL whoosh even on a miss.

#### Scenario: Same call stack
- **WHEN** the gate handler runs
- **THEN** permission is requested and the audio context is created and resumed before the handler returns

### Requirement: Phone bug fixes
Arrow keys SHALL be able to reach a wide ball. A drag used to steer SHALL NOT also swing. `?fast=1` SHALL catch up on a slow frame instead of staying behind.

#### Scenario: Wide ball
- **WHEN** the player holds a sideline direction
- **THEN** the player reaches the edge of the court, past the old short steer target

#### Scenario: Slow fast frame
- **WHEN** `?fast=1` is given a frame at 20 fps
- **THEN** the simulation advances at four times the wall clock and leftover time does not pile up

### Requirement: HUD stays off the court
Arcade and Switch SHALL sit in a bar above the canvas. The court SHALL use the full width under that bar in portrait and in landscape. The page SHALL NOT draw an empty outlined pad over the court.

#### Scenario: Portrait and landscape
- **WHEN** the layout is measured at 390 by 844 and at 568 by 320
- **THEN** the control bar is 56 px at the top, the court starts below it at full width, and the side pad is absent

### Requirement: One metre reach
`REACH` SHALL be 1.0 m. On point 2 and later, a swing SHALL whiff when the player is more than 1.0 m from the ball. Point 1 SHALL still return the ball from anywhere. The Neighbour SHALL hit only while within 1.0 m of the ball. A reach miss SHALL play the swing pose and a whoosh, SHALL NOT play the tok or grow a flower, and SHALL show a short grass puff where the ball passed. The gold landing marker SHALL be centred on the stand spot and SHALL be 1.0 m across in court scale.

#### Scenario: Reach miss
- **WHEN** the player swings on point 2 from more than 1.0 m away
- **THEN** the pose is the swing, a whoosh plays, no tok plays, no flower is added, and a grass puff sits on the ball

#### Scenario: Marker width
- **WHEN** the marker is projected
- **THEN** its width and depth match 1.0 m on the court

### Requirement: Approved Neighbour tables
Casual SHALL be the default. The casual and pro tables SHALL use the approved react, speed, error, scatter, centre, attack, smash, and pace numbers. `__test.ai()` SHALL return the active table and the reach. `__test.setAi` SHALL override that table for the run. A simulated match SHALL report the Neighbour point-win rate for casual against an average bot and pro against a skilled bot, excluding point 1, from seed 1000. Pro against the skilled bot SHALL fall between 30 and 40 percent. Casual against the average bot SHALL fall between 20 and 30 percent.

#### Scenario: Default card
- **WHEN** a match is created with no difficulty
- **THEN** the Neighbour card is the casual table and the reach is 1.0 m

#### Scenario: Simulated rates
- **WHEN** the average bot plays 2,000 casual points and the skilled bot plays 2,000 pro points
- **THEN** the casual Neighbour point-win rate is 20 to 30 percent and the pro rate is 30 to 40 percent
