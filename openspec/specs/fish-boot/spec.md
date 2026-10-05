# fish-boot Specification

## Purpose
Reel It In starts with no network, shows its progress while it loads, and recovers from a slow frame or a lost GL context.

## Requirements

### Requirement: Offline start
Reel It In SHALL start and play with no network. three.js r170 and the two fonts SHALL load from files inside `public/fish/`. The page SHALL make no request to another host to reach the title or to play.

#### Scenario: Start with the network blocked
- **WHEN** the game opens at 390x844 with every request to another host blocked
- **THEN** the title shows within 10 s, a cast and a catch work, and the list of requests holds no other host.

#### Scenario: Fonts are slow
- **WHEN** a font file takes 5 s to arrive
- **THEN** the loading screen and the title draw at once in a system font, and the game font swaps in when it arrives.

### Requirement: Loading screen
The game SHALL show the name of the game and a progress sign from the first frame until the title is ready.

#### Scenario: Slow phone
- **WHEN** the game boots on a slow phone or a slow network
- **THEN** the player sees "REEL IT IN", a moving progress sign, and the line "Loading the lake.", never a blank screen.

#### Scenario: Boot fails
- **WHEN** a module fails to load, WebGL is missing, or the title is not ready after 15 s
- **THEN** a card says what went wrong in plain words and gives a "Try again" button that reloads the game.

### Requirement: Render scale recovers
The automatic render scale SHALL go down when frames are slow for a time, and SHALL come back up when frames are fast again. One slow frame SHALL NOT lower it.

#### Scenario: One hitch
- **WHEN** a single 140 ms frame happens during a fight at 60 Hz
- **THEN** the render scale stays the same.

#### Scenario: Long slow stretch, then smooth play
- **WHEN** frames are slow for 2 s and then fast for 4 s
- **THEN** the scale goes down and then returns to its first value in steps.

### Requirement: GL context loss
The game SHALL pause when the WebGL context is lost, and SHALL draw the lake again when the context comes back, also when the pause screen is up.

#### Scenario: Context lost in a fight
- **WHEN** the context is lost in a fight and restored 1 s later
- **THEN** the game shows the pause screen, and after Resume the lake draws and the fight goes on.

### Requirement: Menus cost less
While an opaque screen covers the lake (the title picture, the journal, the places), the game SHALL draw the lake at a lower rate.

#### Scenario: Title at rest
- **WHEN** the title shows for 5 s
- **THEN** the lake draws at no more than 15 frames a second, and play starts at the full rate.
