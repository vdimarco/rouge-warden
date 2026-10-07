## ADDED Requirements

### Requirement: Epic adaptive gameplay soundtrack
River Rush SHALL play a locally hosted original instrumental adventure loop during active gameplay, with a smoothly fuller mix as course intensity and Rush increase. Action cues SHALL remain distinct. Playback SHALL reuse bounded resources and SHALL NOT delay the frame loop.

#### Scenario: Start and build momentum
- **WHEN** a new player starts a run on desktop or portrait/landscape touch layouts
- **THEN** the score begins from that gesture, loops continuously and smoothly increases in energy with the rapids while jump, duck and pickup sounds remain available

#### Scenario: Pause, hide, finish and retry
- **WHEN** a sounding run pauses, the page hides, the run ends or the player returns to the menu
- **THEN** playback becomes silent and stays silent until an explicit sounding Start or Resume; retry does not create duplicate media elements or contexts

#### Scenario: Persist mute
- **WHEN** the player mutes sound and retries a map or reloads the page
- **THEN** the preference remains muted until the player explicitly enables sound

#### Scenario: Soundtrack unavailable
- **WHEN** the soundtrack cannot load or browser audio playback is rejected
- **THEN** the game, pause, retry and keyboard/swipe controls continue to work without an unhandled rejection or repeated allocation

## MODIFIED Requirements

### Requirement: Readable bank rocks and physical hazard contact
Decorative bank rocks SHALL remain outside navigable lanes throughout the seeded curved course. Redstone and Moonlit riverbanks SHALL NOT show detached white vertical cards or stripes from bank effects. Hazard outcomes SHALL follow the raft position at the hazard crossing, rather than the lane selected before the raft has moved there. Rocks SHALL remain dodge-only; jump, duck, shield and Rush behaviors SHALL retain their readable action rules and fair traversable routes.

#### Scenario: Swipe toward a neighboring rock
- **WHEN** a player selects a neighboring rock lane immediately before its crossing but the raft remains clear of the rock
- **THEN** the rock passes without an invisible hit or shield consumption

#### Scenario: Swipe away from a contacted rock
- **WHEN** a player selects another lane while the raft still overlaps a rock at its crossing
- **THEN** contact produces the normal protection or wipeout feedback rather than target-lane immunity

#### Scenario: Ride both affected banks
- **WHEN** a player rides through opening and late sections of Redstone and Moonlit on phone, desktop or short landscape
- **THEN** rock scenery remains outside playable lanes, banks have no detached white vertical strips, and upcoming hazards remain readable

#### Scenario: Preserved action and rendering lifecycle
- **WHEN** the player jumps, ducks, activates protection, pauses or uses reduced motion
- **THEN** controls respond immediately, stopped frames remain unchanged, action barriers stay traversable, and the correction adds no active shader or texture preparation

#### Scenario: A dodged rock passes beside the raft
- **WHEN** the raft successfully passes beside a rock or jumps over a log
- **THEN** the obstacle remains solid as it passes the raft and retires after leaving the near viewport behind the raft; only an actual shield or Rush impact removes it, without reappearing when feedback expires
