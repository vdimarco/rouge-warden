# Frostwing

## ADDED Requirements

### Requirement: A match is two teams of four against a clock

A match SHALL put four Lantern Squadron ships against four Corvid Pack ships. The player flies one Lantern ship. Bots fly the rest. A match lasts four minutes. A down scores 10 for the team of the ship that fired, and a crash scores 10 for the other team. A downed ship comes back with a full shield after four seconds.

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

Every action SHALL be playable from the keyboard, a gamepad and a touch screen, and fire and charge also from the mouse. Every touch button SHALL be at least 44 px. The pitch direction SHALL be settable to "up = climb" or "up = dive", and the game SHALL save the choice. The key map is on the How to fly screen.

#### Scenario: Phone in portrait

- GIVEN a phone held upright, 320 px wide or more
- WHEN a match starts
- THEN the scoreboard, systems panel, banner, radar and buttons are inside the screen and do not overlap, and the steering area covers the lower left

#### Scenario: Phone in landscape

- GIVEN a phone held sideways
- WHEN a match starts
- THEN the banner sits under the scoreboard, the buttons sit beside the radar, and no HUD panel overlaps another

#### Scenario: Pause

- GIVEN a match is under way
- WHEN the player presses Esc, taps the pause button, or the page is hidden
- THEN the clock stops, the sound stops, and the pause menu offers Resume, Sound, Quit and Switch game

### Requirement: The game has an arcade cabinet

Frostwing SHALL have a cabinet at the end of the Action row of the arcade home and an entry in the game switcher.

#### Scenario: Cabinet

- GIVEN the arcade home at 390, 320 or 1280 px wide
- WHEN the player opens the Action group
- THEN Frostwing is the last machine in the row, its marquee shows FROSTWING and DOGFIGHT whole (the subtitle hides in short windows), and START opens `/frostwing/`

#### Scenario: Cabinet line

- GIVEN a player has finished a match
- WHEN the arcade home loads
- THEN the cabinet line reads the best Lantern score and the number of wins
