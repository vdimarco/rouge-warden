# moonwell Specification

## Purpose
Moonwell is side-scrolling pinball across an endless row of moonlit islands: the player flips a pearl over ridge after ridge for as long as its pearls last.

## Requirements

### Requirement: An endless row of islands
Moonwell SHALL build its level from a seed as the pearl travels right, with no last island. Between two islands, a pair of gold flippers SHALL guard a gap over the water. Each bowl SHALL be 40 to 140 units lower than the one before it, so the ridge behind a bowl is taller than the ridge ahead of the bowl before it. Moonwell SHALL keep the 40 islands behind the pearl, and a wall SHALL stand on the ridge beyond them. The same seed SHALL always give the same islands.

#### Scenario: The level goes on
- **WHEN** a run passes island 200
- **THEN** new islands keep appearing ahead, islands more than 40 behind are dropped behind a wall, and the game keeps the same frame rate

#### Scenario: Same seed, same world
- **WHEN** two runs start from the same seed
- **THEN** they have the same islands, ridges, flippers and features

### Requirement: Shoot forward, pass back
The left flipper SHALL send a pearl up and to the right, over the next ridge when the shot is good. The right flipper SHALL swing at 78% of the left flipper's speed and send the pearl up and to the left. A pass from near its pivot SHALL usually stay in the bowl, and a hit near its tip SHALL be able to send the pearl back over the ridge behind. A pearl that rolls off a flipper that is not raised SHALL fall into the gap and drain.

#### Scenario: A forward shot
- **WHEN** a pearl rolls down the left slope and the player flips the left flipper as it reaches the flipper
- **THEN** the pearl flies up and right, clears the ridge, and lands in the next bowl

#### Scenario: A pass
- **WHEN** the pearl rolls onto the right flipper and the player flips it
- **THEN** the pearl flies up and to the left

#### Scenario: A cradle
- **WHEN** the player holds a flipper up as the pearl rolls onto it
- **THEN** the pearl rests against the raised flipper until the player lets go

#### Scenario: A drain
- **WHEN** the pearl rolls past a flipper that is down and falls between the flippers
- **THEN** the pearl is lost, unless the moon shield or Moonrise is on

### Requirement: The camera scrolls with the pearl
The camera SHALL follow the pearl to the right and to the left, and look ahead in the direction it moves. It SHALL show the next ridge ahead of a bowl when it fits, and keep the flippers of the current bowl on the screen. When the pearl flies above the screen, the camera SHALL zoom out, up to a limit, and an arrow SHALL show where the pearl is.

#### Scenario: Crossing a ridge
- **WHEN** the pearl crosses a ridge into the next bowl
- **THEN** the camera moves smoothly to the new bowl, and its flippers are on the screen

#### Scenario: Going back
- **WHEN** the pearl crosses the ridge behind it into the bowl before
- **THEN** the camera follows it left, and the pearl stays on the screen

#### Scenario: Phone in portrait
- **WHEN** the game runs at 390 by 844 and the pearl has rolled down to the flippers
- **THEN** both flippers of the bowl and the next ridge are on the screen together

### Requirement: Features and a director
Each bowl SHALL get features from a director that varies them and makes the run harder with distance: stars, bumpers, lanterns, rotating mills, gold rails, moon portals and, every 10 islands, a big pearl. The first island SHALL be gentle and teach the shot.

#### Scenario: A gold rail
- **WHEN** the pearl enters a rail mouth
- **THEN** it rides the rail over two or three islands, each island it passes counts as cleared, and it drops into a later bowl

#### Scenario: A moon portal
- **WHEN** the pearl enters a moon portal
- **THEN** it comes out of the paired portal two islands ahead

#### Scenario: Lanterns
- **WHEN** the pearl lights the third lantern in a bowl
- **THEN** the player gets the lantern bonus and moon light

#### Scenario: Harder with distance
- **WHEN** the run is past island 30
- **THEN** ridges are taller, the gap between the flippers is wider and mills appear more often than on the first islands

### Requirement: Score, streak and Moonrise
Each ridge the pearl crosses for the first time SHALL score and add to a streak, and the streak SHALL raise the score multiplier up to x8. Crossing a ridge again, either way, SHALL NOT score or change the streak. A drain SHALL reset the streak. A rail or a portal SHALL pay its bonus only the first time. Stars, bumpers, lanterns, ridges, rails and portals SHALL fill the moon meter. A full meter SHALL start Moonrise for 12 seconds: points count double, the flippers are stronger and a drain bounces the pearl back.

#### Scenario: A long shot
- **WHEN** one shot carries the pearl over two new ridges
- **THEN** both ridges count and the player gets the long shot bonus

#### Scenario: Back and forward again
- **WHEN** the pearl goes back over a ridge and then crosses it forward again
- **THEN** neither crossing scores, and the streak and the multiplier stay the same

#### Scenario: Moonrise saves a drain
- **WHEN** the pearl falls between the flippers during Moonrise
- **THEN** it bounces back up and the pearl is not lost

### Requirement: Shrines and charms
Every eighth island SHALL be a shrine. A sealed gate SHALL block its ridge, and a moonwell SHALL float above its flippers and pull a nearby pearl in. When the pearl enters the well, the game SHALL pause and offer three charms. After the choice, the pearl SHALL go on into the next region, the seal SHALL open so the pearl can come back this way, and the well SHALL NOT open again.

#### Scenario: Choose a charm
- **WHEN** the pearl enters the shrine's moonwell
- **THEN** three charms are offered, the player picks one with a tap, a click, the 1 to 3 keys or the flipper keys and Space, and its effect starts at once

#### Scenario: Back through a shrine
- **WHEN** the pearl goes back into a shrine's bowl after its charm
- **THEN** the well stays shut and no charm is offered

### Requirement: Pearls and the end of a run
A run SHALL start with three pearls. A lost pearl SHALL come back in the bowl where it was lost, with a short moon shield. A big pearl SHALL give one more pearl, up to five. When the last pearl is lost, a summary SHALL show the score, the furthest island and any new best, and one tap or key SHALL start a new run.

#### Scenario: Next pearl
- **WHEN** a pearl drains and pearls remain
- **THEN** the next pearl waits in a moonbeam above the same bowl and drops on a flip, a tap or Space, or after 1.6 seconds

#### Scenario: Game over
- **WHEN** the last pearl drains
- **THEN** the summary shows, and Space, Enter or Play again starts a new run at island 1

### Requirement: Best run
Moonwell SHALL save the best score and the furthest island in this browser. A flag SHALL stand on the ridge of the furthest island. The head-up display SHALL show the furthest island while the pearl is behind it. The arcade machine SHALL show the best score and island. A save that cannot be read SHALL leave the game and the machine working.

#### Scenario: Pass the flag
- **WHEN** the pearl crosses the ridge with the best flag
- **THEN** the game says NEW BEST, and the save holds the new island when the run ends

#### Scenario: Behind the furthest island
- **WHEN** the pearl is in island 4 and it has been as far as island 5
- **THEN** the head-up display shows ISLAND 4 · FURTHEST 5

#### Scenario: Machine line
- **WHEN** the save holds a score of 12345 at island 17
- **THEN** the Moonwell machine shows BEST 12,345 · ISLAND 17

### Requirement: Controls on every screen
Moonwell SHALL play with Z, A or Left for the left flipper and X, D or Right for the right flipper. Space SHALL start and drop a pearl, C or Up SHALL pulse, and Escape or P SHALL pause. On a touch screen, a touch on the left half SHALL hold the left flipper, and a touch on the right half SHALL hold the right one, with several touches at once. A gamepad SHALL use its shoulder buttons for the flippers. The first island SHALL show how to flip.

#### Scenario: Touch both flippers
- **WHEN** a player holds one thumb on each half of a phone screen
- **THEN** both flippers stay up until each thumb lifts

#### Scenario: Pause on blur
- **WHEN** the page loses focus during play
- **THEN** the game pauses and the flippers drop

### Requirement: Feel and comfort
Moonwell SHALL give feedback for each hit with sound, light and particles, and a short pause on big moments. With reduced motion, it SHALL NOT shake the screen. The sound button and M SHALL mute all sound. The page SHALL load `/arcade/quiet.js` first, so its sound stops while it is hidden.

#### Scenario: Reduced motion
- **WHEN** the system asks for reduced motion
- **THEN** the screen does not shake and the camera does not punch in

### Requirement: A brisk pace
Play SHALL run at 1.22 times real time from the first island, rising to 1.55 times at island 60, as a time scale on the physics so every shot keeps its shape. Rails, portals and the camera SHALL keep up with it.

#### Scenario: From the start
- **WHEN** a run starts
- **THEN** the pace is at least 1.2, and it is at least 1.5 from island 61
