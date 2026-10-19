# Table Tennis

## ADDED Requirements

### Requirement: Casual game to 11
The game SHALL play one casual game to 11, win by 2. The Neighbour SHALL serve every point in this slice. The server named by the scoring rule SHALL still alternate every two points, and every point from 10-10.

#### Scenario: Win by two
- WHEN the score reaches 11 to 9
- THEN the game is over
- AND a score of 11 to 10 continues
- AND 12 to 10 ends the game

#### Scenario: Named server
- WHEN no points have been played
- THEN the named server is the Neighbour
- AND after two points the named server is the player
- AND from 10-10 the named server changes every point

### Requirement: Swing bands, timing, aim and spin
A swing SHALL start over 300 deg/s. The peak in the next 150 ms SHALL choose the shot: 300 to 600 deg/s pushes at 6 m/s, above 600 through 1100 drives at 11 m/s, and above 1100 smashes at 17 m/s only when the ball is at least 15 cm above the net. Contact inside +/-40 ms SHALL add 15% speed and no aim pull. Contact out to +/-120 ms SHALL pull the shot up to 25 degrees off the aim line at the window edge. Gamma of +/-30 degrees SHALL map to +/-0.7 m. Beta of +/-20 degrees SHALL map from 0.3 m past the net to the far baseline. Wrist roll over 200 deg/s SHALL add topspin or backspin. Level 3 topspin SHALL reach the table 15% sooner than the same shot with no spin. A swing SHALL cool down for 350 ms. A swing while the ball is going away SHALL be ignored.

#### Scenario: Bands and the window
- WHEN the peak is 300, 600, 601, 1100 or 1101 deg/s
- THEN the shot is push, push, drive, drive, or smash on a high ball
- AND a low ball over 1100 deg/s stays a drive
- AND offsets of 0 and 40 ms are perfect
- AND offsets of -120 and 120 ms pull 25 degrees
- AND an offset of 121 ms does not hit the ball

#### Scenario: Eight centimetres long
- WHEN a casual shot lands 7.9 cm past the end line
- THEN the ball is in and nudged back onto the table
- AND a landing 8.1 cm past the end line is out

### Requirement: Opening point inside five seconds
The first point SHALL be a 5 m/s high ball with no spin. On the phone, a swing SHALL count only above 300 deg/s. On the desktop, a swing SHALL count only at 1.2 window widths per second or faster. A counted swing inside +/-200 ms SHALL return the feed as a perfect drive and win the point. A speed of 0, a slower swing on that input, or a swing outside that window, SHALL NOT win that point. From the start of play, that chance SHALL arrive in under five seconds.

#### Scenario: Swing at the feed
- WHEN the player swings at 400 deg/s on the opening feed
- THEN the score becomes 1 to 0
- AND the clock is still under five seconds

### Requirement: Neighbour win rate
Against the average bot, the casual Neighbour SHALL take between 20% and 40% of points over 1,000 points and SHALL lose most games.

#### Scenario: One thousand points
- WHEN the sim plays 1,000 points from a fixed seed
- THEN the Neighbour's point share is inside 20% to 40%
- AND his share of finished games is under half

### Requirement: Gate, fallback and test hooks
The gate tap SHALL call motion permission, orientation permission and audio resume synchronously, before any await. `?input=swing` SHALL skip the gate. `?seed` and `?fast` SHALL select the rally and 4x sim speed. `__test.swing` SHALL accept degPerSec, dir, tiltX, tiltY, rollDegPerSec and offsetMs. Swipe and mouse drag SHALL use the same three speed bands.

#### Scenario: Test swing
- WHEN a page loads with `?input=swing`
- THEN the gate is not shown
- AND `__test.swing` plays a shot without a sensor

### Requirement: Drawn scene and distinct sounds
The room, floor, lamp, table and net SHALL be painted once into an offscreen canvas and copied each frame. The canvas backing store SHALL use a device pixel ratio of at most 2. The ball SHALL draw a table shadow every frame. The bat hit and the table bounce SHALL be synthesized and SHALL differ in pitch and length. No image or audio file SHALL be added under `public/pingpong/`.

#### Scenario: Shadow and voices
- WHEN a rally is on screen
- THEN the ball has a shadow on the table
- AND the pock and the tik use different frequencies and durations
