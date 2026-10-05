## ADDED Requirements
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

## MODIFIED Requirements
### Requirement: Motion lifecycle and accessibility
The simulation SHALL stop on pause, page hide and completion; canvas frames SHALL remain unchanged while paused, including the cached animated water frame and sprite animation. All inactive screens and page visibility loss SHALL pause water videos. Data-saving preferences SHALL use still water without downloading gameplay videos. Live reduced-motion preferences SHALL disable video playback, water displacement and decorative motion/effects while preserving course movement and action feedback. All actions SHALL be available without swipes through keyboard and touch buttons.
#### Scenario: Pause mid-effect
- **WHEN** the player pauses during a jump or animated river/pickup effect
- **THEN** simulation, sprite state and the cached water frame remain unchanged until resume
#### Scenario: Reduced motion
- **WHEN** reduced motion changes during play
- **THEN** water displacement, decorative particles, frame cycling and rocking stop while lane/jump/duck controls remain functional
