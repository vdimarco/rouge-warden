## REMOVED Requirements
### Requirement: A complete treasure race
**Reason**: User requests a faster endless runner with constant decisions.
**Migration**: Replace treasure timing and escape objectives with runner controls, obstacles and score.
### Requirement: Surge and close-call rewards
**Reason**: Replace balance spending with a runner reward loop.
**Migration**: Coin streaks and successful actions charge an invulnerable Rush.

### Requirement: Animated river adventure
**Reason**: Replace overhead race presentation with runner depth and actions.
**Migration**: Runner perspective art specifies the new presentation.
### Requirement: Animated action feedback
**Reason**: Treasure rewards are superseded by runner interactions.
**Migration**: Runner action feedback specifies new rewards and impacts.

## MODIFIED Requirements
### Requirement: River Rush arcade cabinet
The arcade SHALL retain the River Rush cabinet id `river-rush`, name `River Rush`, route `/river-rush/`, Action membership, existing art direction and shared switcher entry. Its copy SHALL describe the endless runner.
#### Scenario: Launch from the arcade
- **WHEN** a player selects River Rush and starts its cabinet
- **THEN** the runner menu loads at `/river-rush/` with Start run
#### Scenario: Shared switcher
- **WHEN** a player opens Switch game from the menu or results
- **THEN** the shared switcher marks River Rush as current and allows another game or the arcade

### Requirement: Validated best score
The game SHALL save positive finite best runner scores in `river-rush-best` with a runner version. Legacy race scores SHALL NOT become runner records. The cabinet SHALL display positive finite scores and tolerate malformed storage.
#### Scenario: End and retry
- **WHEN** a run ends with a new personal best and the player retries
- **THEN** the record persists and a fresh run starts with zero distance and coins
#### Scenario: Saved and invalid scores
- **WHEN** the save is invalid or a legacy race record
- **THEN** the game starts without a runner record and remains playable

### Requirement: Motion lifecycle and accessibility
The simulation SHALL stop on pause, page hide and completion; canvas frames SHALL remain unchanged while paused. Live reduced-motion preferences SHALL disable decorative motion/effects while preserving course movement and action feedback. All actions SHALL be available without swipes through keyboard and touch buttons.
#### Scenario: Pause mid-effect
- **WHEN** the player pauses during a jump
- **THEN** distance, action timing and canvas frame remain unchanged until resume
#### Scenario: Reduced motion
- **WHEN** reduced motion changes during play
- **THEN** decorative particles and rocking stop and lane/jump/duck controls remain functional

## ADDED Requirements
### Requirement: Runner perspective art
River Rush SHALL present a three-lane forward-perspective river with generated environment, approved character likeness, long hair and only a modest loincloth. Lane swaps, raft jumps, ducks and obstacle depth SHALL clearly communicate their gameplay state at 1536×1024, 390×844 and 844×390.
#### Scenario: Chain actions
- **WHEN** the player swaps lane, jumps a log and ducks a branch
- **THEN** the raft and character visibly perform the actions while upcoming hazards remain readable

### Requirement: Runner action feedback
Coins, successful obstacle actions, power-ups, shield impacts and fatal collisions SHALL provide short readable feedback with bounded effects and no change to control timing.
#### Scenario: Earn and spend protection
- **WHEN** a protected player hits a hazard
- **THEN** a shield burst communicates protection consumed, the streak breaks and the run continues with brief collision grace


### Requirement: Endless runner controls and retry
The game SHALL offer three discrete lanes, immediate lane-change input, jump, duck and Rush through keyboard and touch buttons; touch SHALL also support directional swipes. Inputs SHALL consume each tap once. A fatal collision SHALL show score, distance, coins, cause and a one-action retry, without a two-minute finish timer.
#### Scenario: Keyboard and swipe
- **WHEN** a player presses A/D or left/right, W/up/Space or S/down, or swipes in those directions
- **THEN** the player changes lane, jumps or ducks correspondingly, with no missed short taps
#### Scenario: Restart
- **WHEN** the player chooses Ride again after a collision
- **THEN** the next run begins immediately without navigating through the menu

### Requirement: Fair escalating obstacle course
The seeded course SHALL continuously introduce rocks requiring avoidance, low logs cleared by jumping, and overhead branches cleared by ducking. Speed and pattern complexity SHALL increase gradually. Rows SHALL have a clear lane or a traversable jump/duck barrier and sufficient spacing for an action to complete before the next required action. Course entities SHALL remain bounded during long runs.
#### Scenario: Choose an action
- **WHEN** a player meets a log during a jump or a branch while ducking
- **THEN** the hazard is cleared and rewards action points; the same hazard without the correct action consumes protection or ends the run
#### Scenario: Long course
- **WHEN** a player survives for several minutes
- **THEN** varied harder patterns continue, a reachable legal route remains and passed entities are removed

### Requirement: Coins streaks and power-ups
The game SHALL reward coin trails and successful actions with points and Rush charge. Coin streaks SHALL increase the score multiplier and expire after a collection gap; the HUD SHALL communicate time remaining. Rush SHALL NOT recharge itself. Magnet SHALL collect nearby coins across lanes for eight seconds; shield SHALL absorb one impact; full Rush charge SHALL grant four seconds of faster invulnerable riding and be activated by Shift or its touch button.
#### Scenario: Build and use Rush
- **WHEN** a player fills the Rush meter and activates it
- **THEN** charge is spent once, speed increases, hazards are safely cleared and the timed state expires
#### Scenario: Collect magnet
- **WHEN** a player picks up a magnet and passes coins in other lanes
- **THEN** those coins are collected while the timer lasts and normal lane collection returns afterward

### Requirement: Active runner challenges
The runner SHALL offer rotating trick, coin and distance challenges with visible progress, a one-time 500-point reward, and a fresh target relative to the start of each challenge.
#### Scenario: Complete a trick challenge
- **WHEN** the player performs the required perfect jumps and ducks
- **THEN** the challenge pays once, shows completion feedback and advances to a new coin target
