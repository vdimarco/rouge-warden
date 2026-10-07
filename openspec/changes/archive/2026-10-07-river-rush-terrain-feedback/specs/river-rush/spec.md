## ADDED Requirements

### Requirement: Terrain-linked river encounters
Each seeded course SHALL alternate visually distinct narrows, rough-water jump sections, low-canopy passages and calmer recoveries. Their shared distance profile SHALL connect river shape and obstacle/coin routes, rather than decorating an unrelated obstacle sequence. Terrain SHALL preserve the three existing finite maps, accepted speed and immediate keyboard/buttons/screen-wide gestures. Every obstacle row SHALL provide either an adjacent clear lane or a consistent jump/duck wave with sufficient action spacing. Wave-train sections SHALL offer raised coin ribbons; complete encounters SHALL provide at least three eligible jump rows and a one-time 350-point bonus for three perfect unprotected jumps within that section. Truncated final encounters SHALL show their pickup route without advertising an unreachable chain objective. A collision or a new section SHALL reset incomplete progress; Rush or collision grace SHALL NOT farm the chain reward. Resources SHALL remain bounded at late-course distances.

#### Scenario: Follow changing terrain
- **WHEN** the player proceeds through each map on desktop, phone or short landscape
- **THEN** narrow boulder slaloms, rough-water jumps, low duck passages and calm recoveries have distinct visible course shapes and corresponding routes, with safe traversable choices and the existing finish

#### Scenario: Collect within a terrain encounter
- **WHEN** the player touches or passes beside a coin while steering or jumping through a terrain section
- **THEN** only physical contact rewards once, raised coins require jump contact, and control and power rules remain consistent

#### Scenario: Chain whitewater jumps
- **WHEN** the player performs three perfect unprotected jumps in a wave-train section with an advertised chain objective
- **THEN** the visible chain fills and awards 350 points once; additional clears or powered contact do not duplicate it, and a collision or next section resets incomplete progress

### Requirement: Audible and tangible contact
Collected coins SHALL produce a distinct short pickup chime at contact. Protected and fatal collisions SHALL produce a distinct impact sound with readable raft/rider recoil and splash. Each emitted contact SHALL be handled once even when a frame also crosses other rewards. A fatal contact SHALL stop the simulation at impact, show a short wipeout beat, and then provide the existing result and one-action retry. Protected impacts SHALL NOT lock controls. Persisted mute, audio failure, pause and hidden state SHALL retain their existing behavior.

#### Scenario: Hit a protected or unprotected obstacle
- **WHEN** the raft physically collides with a hazard with or without protection
- **THEN** contact produces a visible impact and audible transient when sound is enabled, protection remains responsive, and a fatal hit gives a brief wipeout followed by the score/retry screen

#### Scenario: Collect rapid coins
- **WHEN** several physically touched coins and another reward occur in one update
- **THEN** pickup audio remains audible and bounded without skipped contacts or duplicate rewards, while passing beside coins stays silent

#### Scenario: Pause, mute or reduce motion
- **WHEN** the player pauses, hides the page, mutes, retries, or uses reduced motion on a supported layout
- **THEN** pause/hidden/mute stop the appropriate audio, paused pixels freeze, retry resets the impact beat, reduced motion suppresses shake while retaining clear contact feedback, and a failed sound resource cannot stop play

## MODIFIED Requirements

### Requirement: Epic adaptive gameplay soundtrack
River Rush SHALL play a locally hosted original instrumental adventure loop during active gameplay, with a smoothly fuller mix as course intensity and Rush increase. Action cues SHALL remain distinct. Playback SHALL reuse bounded resources and SHALL NOT delay the frame loop.

#### Scenario: Start and build momentum
- **WHEN** a new player starts a run on desktop or portrait/landscape touch layouts
- **THEN** the score begins from that gesture, loops continuously and smoothly increases in energy with the rapids while jump, duck and pickup sounds remain available

#### Scenario: Pause, hide, finish and retry
- **WHEN** a sounding run pauses, the page hides, a map completes, its brief wipeout presentation ends or the player returns to the menu
- **THEN** playback becomes silent and stays silent until an explicit sounding Start or Resume; retry does not create duplicate media elements or contexts

#### Scenario: Persist mute
- **WHEN** the player mutes sound and retries a map or reloads the page
- **THEN** the preference remains muted until the player explicitly enables sound

#### Scenario: Soundtrack unavailable
- **WHEN** the soundtrack cannot load or browser audio playback is rejected
- **THEN** the game, pause, retry and keyboard/swipe controls continue to work without an unhandled rejection or repeated allocation
