## ADDED Requirements

### Requirement: Hooked fish visibly swim against the reel
During a fight, hooked fish SHALL visibly swim as they move through water. Tail and body motion SHALL follow speed and fight moves, strengthen during bursts, and settle at rest. Fish SHALL follow the simulation position and heading with the line at the head. The effect SHALL preserve line length, scale, physics, and catch framing. Calm and reduced-motion settings SHALL keep swimming readable without extra camera shake.

#### Scenario: Reeling in a swimming fish
- **WHEN** a player reels a hooked fish from mid-range toward the rod on a phone
- **THEN** the fish moves toward the rod with visible repeated tail kicks and body motion while the line stays attached near its head.

#### Scenario: Run and rest
- **WHEN** a hooked fish runs or thrashes, then rests
- **THEN** its swimming motion grows during the effort and settles during rest, without shifting its body away from the simulated path.

#### Scenario: Wide view and reduced motion
- **WHEN** the fight is viewed in a wide layout or with Calm effects or reduced motion enabled
- **THEN** the fish still visibly swims, remains within the view, and does not gain extra camera shake or decorative flashes.
