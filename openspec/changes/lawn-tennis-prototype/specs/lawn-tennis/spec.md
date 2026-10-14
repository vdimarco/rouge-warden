## ADDED Requirements

### Requirement: Portrait backyard rally
The game SHALL show a top-down lawn with the player at the bottom and the Neighbour at the top in portrait. A tap anywhere SHALL swing. The player SHALL move toward the predicted landing without a drag. Mouse and keyboard SHALL swing on a wide screen. Every on-screen control SHALL be at least 48 px in both directions.

#### Scenario: Phone width
- **WHEN** the page is opened at 390 by 844
- **THEN** the court is visible, the player is on the near side, and a tap swings

#### Scenario: Wide screen
- **WHEN** the page is opened at 1280 px wide
- **THEN** the court rotates so the swing pad sits on the right, and a click or the Space key swings

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
