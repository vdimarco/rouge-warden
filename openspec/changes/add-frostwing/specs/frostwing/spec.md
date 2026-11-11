# Frostwing

## ADDED Requirements

### Requirement: A match is two teams of four against a clock

A quick match SHALL put four Lantern Squadron ships against four Corvid Pack ships. A story operation can field three ships a side. The player flies one Lantern ship. Bots fly the rest. A match lasts four minutes. A down scores 10 for the team of the ship that fired, and a crash scores 10 for the other team. A downed ship comes back with a full shield after four seconds.

#### Scenario: Downing a rival

- GIVEN a match is under way
- WHEN the player's lasers take a Corvid ship's shield to zero
- THEN the ship explodes, the kill feed shows the player's portrait and the rival's portrait marked DOWN, and Lantern's score rises by 10

#### Scenario: The clock ends the match

- GIVEN a match is under way
- WHEN the clock reaches zero
- THEN the team with the higher score wins, and the results list every pilot's downs, losses and energy with an MVP

### Requirement: Meteor showers drop energy

A 24-second meteor shower SHALL start every 50 seconds. The banner reads "SHOOT THE METEORITES AND COLLECT THEIR ENERGY", and its bar shows each team's energy for that shower. A broken meteorite drops orbs. An amber orb scores 5. A red orb adds a bomb. A green orb repairs 40% of the shield.

#### Scenario: Collecting energy during a shower

- GIVEN a shower is on
- WHEN the player flies through an amber orb
- THEN Lantern's score rises by 5 and Lantern's side of the banner bar grows

#### Scenario: Winning a shower

- GIVEN a shower ends
- WHEN one team gathered more energy in it
- THEN that team earns 25 more points and the result shows in the middle of the screen

### Requirement: Pilots differ

The player SHALL choose Juno Reyes, Pip Okafor, Brann Hale or Silas Vane. They SHALL differ in shield, speed, gun damage, boost refill, lock time and bombs. Silas Vane is the veteran. His charged shot fires three homing bolts, and allies near him repair slowly.

#### Scenario: Choosing Silas Vane

- GIVEN the pilot screen
- WHEN the player picks Silas Vane and launches
- THEN the player flies as Silas Vane, holds the charge button until the lock bracket turns green, and the release fires three homing bolts at the locked ship

### Requirement: Flight and weapons

The ship SHALL turn and climb as the player steers. Boost speeds up and widens the view. Brake slows down and tightens turns. Boost and brake draw from one meter that refills. A barrel roll cuts the damage of a bolt that hits during the roll to one fifth. A U-turn loops back onto the ship behind. The ground, the ruins and the storm wall at the edge of the bowl cost shield.

#### Scenario: Barrel roll

- GIVEN a rival is shooting at the player
- WHEN the player rolls as the bolts arrive
- THEN the bolts do a fifth of their damage and the hit sparks white

#### Scenario: Leaving the bowl

- GIVEN the player flies toward the edge
- WHEN the ship passes the storm wall
- THEN "TURN BACK · STORM WALL" flashes, the wind pushes the ship back, and the shield drains if the ship stays out

### Requirement: Controls on every device

Every action SHALL be playable from the keyboard and a gamepad, and fire and charge also from the mouse. A touch screen SHALL use drag and tap: a drag anywhere steers and fires the lasers, and a tap sends a homing shot. Roll, U-turn, bomb and boost SHALL have touch buttons. Brake is on the keyboard and gamepad only. Every touch button SHALL be at least 44 px. The pitch direction SHALL be settable to "up = climb" or "up = dive", and the game SHALL save the choice. The key map is on the How to fly screen.

#### Scenario: Mouse flight

- GIVEN mouse flight is on (the default on a computer) and a match has started
- WHEN the player clicks the screen and moves the mouse
- THEN the mouse is captured, a ring shows the virtual stick, the ship turns and climbs with the mouse, the stick eases back to centre when the mouse stops, the left button fires, the right button locks on, and Esc frees the mouse and pauses

#### Scenario: Drag and tap on a phone

- GIVEN a match on a touch screen
- WHEN the player drags a finger anywhere on the screen
- THEN a ring shows where the drag began, the ship turns and climbs with the drag, and the lasers fire while the finger steers
- AND WHEN the player taps a rival ship
- THEN a homing shot goes after that ship, the inner reticle dims while the shot recharges for the pilot's lock time plus one second, and a tap during the recharge fires nothing
- AND WHEN the player taps open sky
- THEN the homing shot goes to the rival nearest the nose

#### Scenario: Touch hint

- GIVEN a player on a touch screen who has not yet dragged and tapped
- WHEN a match starts
- THEN "DRAG TO STEER AND FIRE · TAP A RIVAL FOR A HOMING SHOT" shows for up to 20 seconds, and it goes once the player has done both

#### Scenario: Phone in portrait

- GIVEN a phone held upright, 320 px wide or more
- WHEN a match starts
- THEN the scoreboard, systems panel, banner, radar and the four buttons are inside the screen and do not overlap, and the whole screen takes drags and taps

#### Scenario: Phone in landscape

- GIVEN a phone held sideways
- WHEN a match starts
- THEN the banner sits under the scoreboard, the buttons sit beside the radar, and no HUD panel overlaps another

#### Scenario: Pause

- GIVEN a match is under way
- WHEN the player presses Esc, taps the pause button, or the page is hidden
- THEN the clock stops, the sound stops, and the pause menu offers Resume, Sound, Quit and Switch game

### Requirement: A story of five operations

The game SHALL offer a story of five operations, each a match with its own place, sky, clock, rosters and rivals. A cut scene SHALL play before the first operation, before each operation and after each win. Progress SHALL be saved after each win.

#### Scenario: Starting the story

- GIVEN a player with no story progress
- WHEN the player chooses STORY
- THEN the prologue plays, then the briefing for Operation 1, then the pilot screen offers Juno, Pip and Brann for a three-on-three match

#### Scenario: Winning an operation

- GIVEN a story operation ends with Lantern ahead
- WHEN the results show
- THEN they read OPERATION COMPLETE, CONTINUE plays the debrief and the next briefing, and the title later offers CONTINUE STORY

#### Scenario: Losing an operation

- GIVEN a story operation ends with Lantern behind or level
- WHEN the results show
- THEN they read OPERATION FAILED or DRAW with a line from the squad, TRY AGAIN restarts the same operation, and no progress is lost

#### Scenario: Silas Vane returns

- GIVEN Operation 1 is won
- WHEN Operation 2 begins
- THEN its briefing tells how Silas Vane comes out of retirement, and he joins the pilot screen from then on

#### Scenario: The last operation

- GIVEN Operation 5
- WHEN the match starts at dawn
- THEN Vex Morrow flies the Nightjar with 1.8 times his shield and a quarter more gun damage, and a win plays the ending and marks the story complete

### Requirement: Cut scenes

A cut scene SHALL show stills with a slow pan and a caption that types out. A pilot's line SHALL show their portrait and name. The player SHALL be able to finish the line, go to the next slide, or skip the scene, with a key, a click or a tap.

#### Scenario: Reading a cut scene

- GIVEN a cut scene is on screen
- WHEN the player presses Enter or taps while the caption is still typing
- THEN the whole line shows, and the next press goes to the next slide

#### Scenario: Skipping

- GIVEN a cut scene is on screen
- WHEN the player presses Esc or SKIP
- THEN the scene ends and the game goes to what follows it

#### Scenario: Cut scene on a phone

- GIVEN a phone in portrait or landscape, 320 px wide or more
- WHEN a cut scene plays
- THEN the whole caption fits above the Next and Skip buttons, and both buttons are at least 44 px tall

#### Scenario: Reduced motion

- GIVEN the device asks for reduced motion
- WHEN a cut scene plays
- THEN the stills do not pan and each caption shows at once

### Requirement: Logbook

The title SHALL offer a logbook of 16 entries about the world. Eight SHALL be open at the start, and each won operation SHALL open more.

#### Scenario: Opening entries

- GIVEN a player wins Operation 1
- WHEN the player opens the logbook
- THEN the entries on the Corvid Pack and Ostrander Deepcore are open, and the locked entries say which operation opens them

### Requirement: Graphics quality

The game SHALL offer High and Fast graphics. High shows sun shadows, bloom and reflections on the ships. Fast leaves them out. High is the default on a computer and Fast is the default on a touch screen.

#### Scenario: Choosing Fast

- GIVEN the pilot screen
- WHEN the player picks FAST
- THEN the next match draws with no shadows and no bloom, and the game saves the choice

#### Scenario: A slow machine

- GIVEN the player has not chosen a graphics setting and a match runs on High
- WHEN the frame rate stays under 22 frames per second for 4 seconds
- THEN the game changes to Fast and shows "GRAPHICS: FAST"

#### Scenario: Models fail to load

- GIVEN the model files do not arrive within 15 seconds
- WHEN the title screen opens
- THEN PLAY is enabled and the match uses the simple built-in ships

### Requirement: Music

The game SHALL play recorded instrumental music: a title theme, a battle theme that depends on the sky, a story underscore in cut scenes, and a short sting when a match is won or lost. The music SHALL start on the player's first tap, click or key, pause with the game, and follow the sound setting.

#### Scenario: Music across the screens

- GIVEN a player opens the game and clicks anywhere
- WHEN the player goes from the title to a match by day, wins it, and then starts the story
- THEN the title theme plays, then the first battle theme, then the victory sting followed by the title theme under the results, then the story underscore in the cut scene

#### Scenario: Night, storm and dawn

- GIVEN a match at night, in a storm or at dawn
- WHEN the match starts
- THEN the second, darker battle theme plays

#### Scenario: Pause and a hidden page

- GIVEN music is playing in a match
- WHEN the player pauses, or the page is hidden
- THEN the music stops, and it continues when the player resumes or the page shows again

### Requirement: The game has an arcade cabinet

Frostwing SHALL have a cabinet at the end of the Action row of the arcade home, a cabinet in the Corridor after First Breath, an entry in the game switcher, and dates for the All Games New and Updated orders.

#### Scenario: Corridor

- GIVEN the arcade home opens on the Corridor
- WHEN the player opens the index and picks Frostwing, or walks to cabinet 17
- THEN the cabinet shows Frostwing's screen art, and "Insert coin · Play" opens `/frostwing/`

#### Scenario: Cabinet

- GIVEN the arcade home at 390, 320 or 1280 px wide
- WHEN the player opens the Action group
- THEN Frostwing is the last machine in the row, its marquee shows FROSTWING and DOGFIGHT whole (the subtitle hides in short windows), and START opens `/frostwing/`

#### Scenario: Cabinet line

- GIVEN a player has finished a match
- WHEN the arcade home loads
- THEN the cabinet line reads the best Lantern score and the number of wins
