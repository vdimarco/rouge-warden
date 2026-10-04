# moonwell Specification

## Purpose
Moonwell is side-scrolling pinball across an endless row of moonlit islands: the player flips a pearl over ridge after ridge for as long as its pearls last.

## Requirements

### Requirement: An endless row of islands
Moonwell SHALL build its level from a seed as the pearl travels right, with no last island. Between two islands, a pair of gold flippers SHALL guard a gap over the water. The same seed SHALL always give the same islands.

#### Scenario: The level goes on
- **WHEN** a run passes island 200
- **THEN** new islands keep appearing ahead, the islands behind are dropped, and the game keeps the same frame rate

#### Scenario: Same seed, same world
- **WHEN** two runs start from the same seed
- **THEN** they have the same islands, ridges, flippers and features

### Requirement: Shoot forward, pass back
The left flipper SHALL send a pearl up and to the right, over the next ridge when the shot is good. The right flipper SHALL send it up and to the left, back into the bowl. A pearl that rolls off a flipper that is not raised SHALL fall into the gap and drain.

#### Scenario: A forward shot
- **WHEN** a pearl rolls down the left slope and the player flips the left flipper as it reaches the flipper
- **THEN** the pearl flies up and right, clears the ridge, and lands in the next bowl

#### Scenario: A cradle
- **WHEN** the player holds a flipper up as the pearl rolls onto it
- **THEN** the pearl rests against the raised flipper until the player lets go

#### Scenario: A drain
- **WHEN** the pearl rolls past a flipper that is down and falls between the flippers
- **THEN** the pearl is lost, unless the moon shield or Moonrise is on

### Requirement: The camera scrolls with the pearl
The camera SHALL follow the pearl to the right and show the next ridge ahead of it. It SHALL keep the flippers of the current bowl on the screen. When the pearl flies above the screen, the camera SHALL zoom out, up to a limit, and an arrow SHALL show where the pearl is.

#### Scenario: Crossing a ridge
- **WHEN** the pearl crosses a ridge into the next bowl
- **THEN** the camera moves smoothly to the new bowl, and its flippers are on the screen

#### Scenario: Phone in portrait
- **WHEN** the game runs at 390 by 844 and the pearl has rolled down to the flippers
- **THEN** both flippers of the bowl and the next ridge are on the screen together

### Requirement: Progress goes one way
When the pearl crosses a ridge, a moon gate SHALL close on that ridge. A pearl that hits the gate from the right SHALL bounce back into its bowl.

#### Scenario: A strong pass back
- **WHEN** the right flipper sends the pearl hard to the left after it crossed a ridge
- **THEN** the pearl bounces off the gate and stays in the current bowl

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
Each new ridge SHALL add to a streak, and the streak SHALL raise the score multiplier up to x8. A drain SHALL reset the streak. Stars, bumpers, lanterns, ridges, rails and portals SHALL fill the moon meter. A full meter SHALL start Moonrise for 12 seconds: points count double, the flippers are stronger and a drain bounces the pearl back.

#### Scenario: A long shot
- **WHEN** one shot carries the pearl over two ridges
- **THEN** both ridges count and the player gets the long shot bonus

#### Scenario: Moonrise saves a drain
- **WHEN** the pearl falls between the flippers during Moonrise
- **THEN** it bounces back up and the pearl is not lost

### Requirement: Shrines and charms
Every eighth island SHALL be a shrine. A sealed gate SHALL block its ridge, and a moonwell SHALL float above its flippers and pull a nearby pearl in. When the pearl enters the well, the game SHALL pause and offer three charms. After the choice, the pearl SHALL go on into the next region.

#### Scenario: Choose a charm
- **WHEN** the pearl enters the shrine's moonwell
- **THEN** three charms are offered, the player picks one with a tap, a click, the 1 to 3 keys or the flipper keys and Space, and its effect starts at once

### Requirement: Pearls and the end of a run
A run SHALL start with three pearls. A lost pearl SHALL come back in the current bowl, with a short moon shield. A big pearl SHALL give one more pearl, up to five. When the last pearl is lost, a summary SHALL show the score, the islands and any new best, and one tap or key SHALL start a new run.

#### Scenario: Next pearl
- **WHEN** a pearl drains and pearls remain
- **THEN** the next pearl waits in a moonbeam above the same bowl and drops on a flip, a tap or Space, or after 3 seconds

#### Scenario: Game over
- **WHEN** the last pearl drains
- **THEN** the summary shows, and Space, Enter or Play again starts a new run at island 1

### Requirement: Best run
Moonwell SHALL save the best score and the furthest island in this browser. A flag SHALL stand on the ridge of the furthest island. The arcade machine SHALL show the best score and island. A save that cannot be read SHALL leave the game and the machine working.

#### Scenario: Pass the flag
- **WHEN** the pearl crosses the ridge with the best flag
- **THEN** the game says NEW BEST, and the save holds the new island when the run ends

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
