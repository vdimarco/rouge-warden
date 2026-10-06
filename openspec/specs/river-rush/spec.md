# River Rush Specification

## Purpose
Define River Rush's endless three-lane raft runner, responsive keyboard/swipe/touch actions, fair escalating hazards, coin streaks, challenges, power-ups, Higgsfield title scene, and Cottage Arcade integration.

## Requirements

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

### Requirement: Shared audio lifecycle
The arcade build SHALL load `/arcade/quiet.js` before other scripts so audio suspends when the page is hidden.

#### Scenario: Hide the page
- **WHEN** game audio has started and the page becomes hidden
- **THEN** the shared lifecycle script silences the game without breaking its own mute control

### Requirement: Motion lifecycle and accessibility
The simulation SHALL stop on pause, page hide and completion; canvas frames SHALL remain unchanged while paused, including the cached animated water frame and sprite animation. All inactive screens and page visibility loss SHALL pause water videos. Data-saving preferences SHALL use still water without downloading gameplay videos. Live reduced-motion preferences SHALL disable video playback, water displacement and decorative motion/effects while preserving course movement and action feedback. All actions SHALL be available without swipes through keyboard and touch buttons.
#### Scenario: Pause mid-effect
- **WHEN** the player pauses during a jump or animated river/pickup effect
- **THEN** simulation, sprite state and the cached water frame remain unchanged until resume
#### Scenario: Reduced motion
- **WHEN** reduced motion changes during play
- **THEN** water displacement, decorative particles, frame cycling and rocking stop while lane/jump/duck controls remain functional

### Requirement: Higgsfield living title scene
The title scene SHALL use a Higgsfield-generated silent looping video based on the approved character art, with a still-image fallback. It SHALL preserve live readable menu controls, pause while hidden or covered by instructions, and use the still image for reduced motion or data-saving.

#### Scenario: Enter the menu
- **WHEN** the menu loads in a normal-motion browser
- **THEN** the river and character artwork animate behind working Start and Switch game controls

#### Scenario: Video unavailable
- **WHEN** video cannot load or motion/data preferences disable it
- **THEN** the approved still image and all menu actions remain usable

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

### Requirement: Living gameplay river
River Rush SHALL animate flowing water and ripples over the generated portrait and landscape gameplay environments using optional fal.ai-generated video loops, with a GPU texture effect and moving-foam fallbacks. Water displacement SHALL remain within the river surface while camera, shores, ruins and hazard projection remain stable. Animation SHALL NOT delay starting a run or require video readiness.
#### Scenario: Ride through living rapids
- **WHEN** a normal-motion player starts a run
- **THEN** river foam and water texture visibly move behind the projected hazards and live controls
#### Scenario: Video and GPU unavailable
- **WHEN** video playback fails and a water graphics context is unavailable or lost
- **THEN** the matching still background and moving-foam fallback remain and the runner is fully playable

### Requirement: Runner character animation
The approved character SHALL use a generated multi-frame paddling cycle, brief ride/jump/duck transitions, lane banking and landing recoil/splash. His face, long hair and modest loincloth SHALL remain consistent. Visual animation SHALL NOT change action windows, speed, collision outcomes or score rules.
#### Scenario: Paddle and chain actions
- **WHEN** the player rides, changes lanes, jumps and ducks
- **THEN** paddle/arm positions cycle, the raft banks, action poses transition quickly and a landing splash marks the end of a jump

### Requirement: Animated runner rewards and powers
Coins SHALL spin and fly toward the HUD on collection; magnet attraction SHALL visibly travel from other lanes toward the raft. Shield impacts SHALL show a short shatter burst and recoil; Rush SHALL show motion trails and obstacle bursts. Reward HUD pulses SHALL remain small and preserve readable values and controls.
#### Scenario: Coin and shield feedback
- **WHEN** a player collects a coin and later consumes a shield on impact
- **THEN** the coin travels toward the counter and a shield burst/recoil communicates protection lost without obscuring upcoming hazards
#### Scenario: Magnet and Rush
- **WHEN** magnet or Rush is active
- **THEN** attracted coins and invulnerable obstacle clears have distinct animated feedback and effects expire with bounded counts

### Requirement: Snappy runner response
The runner SHALL start at 42 m/s and escalate to a bounded 72 m/s, use .66-second jumps and .60-second ducks, and settle visual lane changes to 95% within 90 ms at normal frame rates. Actions SHALL cancel or chain without animation locks. A launch-frame jump SHALL clear a log and its raised coin before the visible arc reaches full height. Touch drags SHALL support successive lane changes at an initial 26-pixel segment and subsequent 56-pixel segments.
#### Scenario: Chain a dodge and action
- **WHEN** a player rapidly changes lanes, jumps and ducks
- **THEN** each input takes effect on the next simulation update, each action silhouette appears immediately and movement settles without long trailing interpolation
#### Scenario: Late launch
- **WHEN** a player taps jump just before a log reaches the raft
- **THEN** the launch frame clears the log and its raised coin without consuming protection
#### Scenario: Continuous touch drag
- **WHEN** a player drags across an initial lane-change segment and a deliberate longer additional segment
- **THEN** two lane changes occur without lifting the finger, and a cancelled pointer produces no further action

### Requirement: Coherent fluid motion
Projected foam SHALL travel toward the raft at course speed. Character animation SHALL retain registered raft centers, base width and waterline across paddle frames and actions, with a registered paddle cycle and continuous ride/action transforms, without crossfading different rider images. River playback SHALL respond to normal speed escalation and Rush.
#### Scenario: Accelerate and dodge
- **WHEN** a run accelerates and the player dodges
- **THEN** water cues and upcoming objects approach together, the raft moves continuously and its animation does not jump between anchors

### Requirement: Bounded frame rendering
The renderer SHALL composite native decoded video directly behind the gameplay canvas, cap total backing-buffer pixels and avoid full-frame video copies or repeatedly drawing inactive runs. Rendering SHALL preserve exact paused pixels and late-decode freeze, and remain playable through unavailable video/GPU and live motion/data preferences.
#### Scenario: Warm active rendering
- **WHEN** a normal-motion run is sampled with 60fps river media
- **THEN** there are zero full-frame video-to-canvas copies during active native playback, and warmed active frame cost is measured against the prior build
#### Scenario: Inactive run
- **WHEN** a run is paused or completed
- **THEN** simulation and captured pixels remain unchanged and the renderer stops repeating full scene work

### Requirement: Continuous forward world motion
The runner SHALL present continuously approaching whitewater and bank scenery in the same perspective and world-distance coordinate system as hazards. Decorative scenery SHALL remain outside playable lanes, fade into the distant scene, pass beyond the viewport and remain bounded independently of run length. Reduced motion SHALL omit this decorative movement.
#### Scenario: Ride without steering
- **WHEN** a normal-motion player rides forward on phone, desktop or landscape
- **THEN** foreground scenery grows and passes beside the raft, whitewater approaches continuously and forward movement remains visible between obstacle rows
#### Scenario: Pause or reduce motion
- **WHEN** the player pauses or enables reduced motion
- **THEN** pause freezes all scenery and pixels, and reduced motion suppresses decorative flow while preserving course movement

### Requirement: Continuous steering and character geometry
Visual steering SHALL preserve position and velocity through repeated lane inputs, settle a single-lane step to 95% within 90 ms and retain immediate logical lane selection. Jump and duck SHALL use the current approved rider appearance, continuous lift or body compression, and registered raft geometry rather than swapping the full character image.
#### Scenario: Reverse a dodge and jump
- **WHEN** the player changes lanes, immediately reverses and jumps or ducks
- **THEN** steering follows a short continuous trajectory, the face and raft remain consistent and controls are available throughout the action
