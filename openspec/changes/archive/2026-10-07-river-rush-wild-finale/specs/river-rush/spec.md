## MODIFIED Requirements

### Requirement: Longer faster river courses
Each map SHALL have a finite finish at 4,200 / 5,400 / 6,600 m respectively.
Travel SHALL retain current fast start/cap speeds and responsive controls.
Routes SHALL progressively vary and intensify through four course sections,
offer recovery stretches and remain traversable with ordinary reaction delay.
The last 150 m SHALL be hazard-free. Historical progress/scores SHALL remain usable.

#### Scenario: Complete the wilder adventure
- **WHEN** a player clears the three maps in order
- **THEN** simulation stops exactly, the total distance is 16,200 m, the latter
  sections are more demanding and public score storage accepts the result

#### Scenario: Recover and react
- **WHEN** delayed-input players ride at 30, 60 or 120 Hz
- **THEN** changing seeded route episodes, burst/recovery spacing and legal
  action routes allow every map to finish without requiring a shield

### Requirement: Coin pickup follows visible overlap
Every coin SHALL require actual visible raft overlap at its crossing, including
coin-boost and Rush runs. Selecting a lane before arrival SHALL NOT award a
side coin. Misses SHALL pass without reward or pickup feedback. Raised coins
SHALL require the appropriate jump contact; powered play SHALL NOT bypass
contact. Contact rewards SHALL appear while the raft is touching the coin.

#### Scenario: Miss coins during powered play
- **WHEN** a stationary or late-steering raft passes beside a coin during
  ordinary play, the timed coin boost or Rush
- **THEN** no coin, points, charge or streak are awarded and the coin passes
  visibly uncollected

#### Scenario: Touch and show the award
- **WHEN** the raft overlaps a coin while steering, reversing or jumping
- **THEN** that coin rewards exactly once and the counter/contact effect agree
  with the visible collection in 3D and fallback views

### Requirement: Coins streaks and power-ups
Coin trails and successful actions SHALL reward points and Rush charge.
Streaks SHALL increase the multiplier and expire after a collection gap.
The eight-second coin power SHALL boost rewards for physically collected
coins, with a clear name and HUD feedback. Shield SHALL absorb one impact.
Rush SHALL grant four seconds of faster invulnerable riding, SHALL NOT collect
remote coins or recharge itself, and SHALL use Shift or its touch control.

#### Scenario: Use the contact coin boost
- **WHEN** a raft acquires the timed coin power by actual overlap
- **THEN** touched coins earn a clearly communicated bonus for eight seconds
  while adjacent coins remain missed

#### Scenario: Use Rush
- **WHEN** a player activates full Rush charge
- **THEN** charge spends once, speed/protection activate and expire normally,
  and coins continue to require contact

### Requirement: Animated runner rewards and powers
Collected coins SHALL disappear at contact and fly toward the HUD as small,
distinct score tokens with immediate reward feedback. Perspective SHALL NOT
enlarge feedback into apparent collectible coins beside the raft. The timed
coin boost SHALL visibly enhance contact rewards.
Shield SHALL show a shatter/recoil on impact; Rush SHALL show motion trails
and obstacle bursts. Effects SHALL remain bounded and preserve legible controls.

#### Scenario: Score at contact
- **WHEN** a coin is touched during a rapid lane change or a coin boost
- **THEN** its reward is shown at contact rather than delayed until the raft
  appears beside its former lane, no remote pickup animation is shown and
  its small score token remains distinct from golden coins in the river

### Requirement: Visible power pickup contact
Timed coin powers and shields SHALL activate only on actual raft overlap at
their crossing. Target-lane selection alone SHALL NOT grant a power. Crossed
items SHALL resolve in travel order; bonuses SHALL affect only later coins.
Missed powers SHALL remain visible as they pass.

#### Scenario: Steer too late toward a power
- **WHEN** a player selects a power's lane without reaching it in time
- **THEN** the power passes uncollected and later side coins remain missed

## ADDED Requirements

### Requirement: Escalating organic river acts
All maps SHALL pass through four visibly distinct intensity sections with
continuous geography and shared CPU/GPU buoyancy/placement. Late sections
SHALL contain stronger varied bends, chutes and whitewater, with readable
recovery pools and consistent downstream motion. Resources SHALL be bounded
and prepared before play; paused/reduced-motion behavior SHALL remain usable.

#### Scenario: Ride from opening to finale
- **WHEN** a player moves through each map's four sections
- **THEN** the river becomes progressively wilder, seeded episodes vary,
  boundaries do not pop and water, raft, hazards and banks remain registered

### Requirement: Memorable themed finish gate
Each map SHALL end at a substantial gate across the navigation corridor with
a legible themed checkered banner, beacons and approach markers. The gate
SHALL be registered to the exact finish and readable on portrait phone,
landscape and desktop layouts in primary 3D and 2D fallback views.

#### Scenario: Approach and cross the gate
- **WHEN** a raft approaches the last hazard-free stretch and crosses the gate
- **THEN** increasing approach cues make the finish unmistakable, all lanes
  pass safely beneath it and the clear bonus/result occur once at the exact end
