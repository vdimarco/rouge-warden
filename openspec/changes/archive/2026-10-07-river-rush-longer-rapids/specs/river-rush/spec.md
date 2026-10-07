## ADDED Requirements

### Requirement: Longer faster river courses
Each map SHALL have a finite finish at 2,800 / 3,600 / 4,400 m respectively.
Downstream travel SHALL be faster than the prior adventure while preserving
the current jump/duck durations, responsive steering and traversable routes.
Campaign totals, saved unlocks and public scores SHALL remain usable.

#### Scenario: Complete the extended adventure
- **WHEN** a player completes the three maps in order
- **THEN** finishes stop exactly, distance totals 10,800 m, speed/difficulty
  increase across maps, and the public board accepts the result

#### Scenario: React to faster hazards
- **WHEN** players react with ordinary input delay at 30, 60 or 120 Hz
- **THEN** every map retains a legal route and sufficient action spacing

### Requirement: Coin pickup follows visible overlap
Ordinary coins SHALL score only when the visibly interpolated raft passes
over them; choosing a target lane alone SHALL NOT collect an adjacent coin.
Missed coins SHALL continue past with no pickup event. Magnet and Rush SHALL
retain explicit visible attraction. Raised coins SHALL require a jump unless
an attraction power-up is active.

#### Scenario: Miss or cross a coin
- **WHEN** a coin reaches a raft that is beside it, steering toward it too late,
  or reversing away without overlap
- **THEN** it passes without scoring or pickup effects; a physically overlapped
  coin scores once, including when crossed during a lane transition

#### Scenario: Powered collection
- **WHEN** a magnet or Rush is active while another lane's coin passes
- **THEN** attraction feedback explains the pickup and normal overlap rules
  resume after the power-up expires

### Requirement: Coherent Redstone horizon and faster current
Redstone SHALL retain its textured gorge and use a distant canyon/sky that
matches perspective, fog and relative motion without a stationary painted
near-river scene. Water/current motion SHALL visibly increase, stay downstream
and remain consistent with raft buoyancy. Resources SHALL be prepared before
play and remain bounded.

#### Scenario: Move through the gorge
- **WHEN** a player rides and reverses lanes in Redstone on supported layouts
- **THEN** near banks move faster than distant silhouettes, the water joins the
  horizon without a painted river wall, and hazards remain legible

#### Scenario: Pause and fall back
- **WHEN** play pauses, motion is reduced or graphics fail
- **THEN** paused pixels freeze, decorative motion reduces, all maps remain
  playable and the prepared skyline introduces no play-time texture/shader work

## MODIFIED Requirements

### Requirement: Snappy runner response
The runner SHALL use map start speeds of 52 / 62 / 72 m/s with respective caps of 68 / 80 / 92 m/s, use .66-second jumps and .60-second ducks, and settle visual lane changes to 95% within 150 ms at normal frame rates. Actions SHALL cancel or chain without animation locks. A launch-frame jump SHALL clear a log and its raised coin before the visible arc reaches full height. Touch drags SHALL support successive lane changes at an initial 26-pixel segment and subsequent 56-pixel segments.
#### Scenario: Chain a dodge and action
- **WHEN** a player rapidly changes lanes, jumps and ducks
- **THEN** each input takes effect on the next simulation update, each action silhouette appears immediately and movement settles without long trailing interpolation
#### Scenario: Late launch
- **WHEN** a player taps jump just before a log reaches the raft
- **THEN** the launch frame clears the log and its raised coin without consuming protection
#### Scenario: Continuous touch drag
- **WHEN** a player drags across an initial lane-change segment and a deliberate longer additional segment
- **THEN** two lane changes occur without lifting the finger, and a cancelled pointer produces no further action

### Requirement: Rich river presentation with preserved pace
The river SHALL use textured shoreline and rocks, varied foliage and layered lighting/atmosphere within the existing fixed scene budgets. Normal speed SHALL follow the three map profiles (52–68 / 62–80 / 72–92 m/s); jump SHALL last .66 seconds and duck .60 seconds. Reduced motion, exact paused frames and readable hazards/controls SHALL be retained at phone, desktop and short landscape layouts.
#### Scenario: Ride through upgraded scenery
- **WHEN** the player starts the updated game and chains lane/jump/duck actions
- **THEN** the new scenery and distinct rider poses remain readable while speed follows the extended-map profiles, action timing stays responsive and routes remain traversable

