## ADDED Requirements

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
