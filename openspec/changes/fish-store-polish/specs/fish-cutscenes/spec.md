## ADDED Requirements

### Requirement: Short in-engine cutscenes
The game SHALL have four kinds of short cutscenes, drawn live in the game's own scene and art: the opening, the arrival at a new place, a legend's reveal, and a legend landed (with a finale after the last legend). Each SHALL last from 4 to 9 s, show letterbox bars and one short caption in the game's voice, and play its own sound. The cutscenes SHALL need no network and no new video files.

#### Scenario: Opening
- **WHEN** a player with a fresh save taps "Go fishing" for the first time
- **THEN** the camera glides low over Loon Lake at dawn and settles on the dock in the cast view, the caption names the place, and the cast starts when it ends.

#### Scenario: Arrival
- **WHEN** the player travels to a place for the first time
- **THEN** a fly-in shows that place's look with its name before the arrival card.

#### Scenario: Legend reveal
- **WHEN** a legend's gold ring rises at a place for the first time, outside a fight, and the player has landed at least one fish
- **THEN** the camera pushes toward the ring, the legend breaches, its name shows, and play goes on from the same cast state.

#### Scenario: Legend landed
- **WHEN** the player lands a legend
- **THEN** a hero shot shows the legend with its name and weight before the catch card. After the fourth legend, a short finale says the player fished them all.

### Requirement: Cutscenes never cost the player
A cutscene SHALL play once for each event, SHALL never start during a fight, and SHALL hold the fish, the clock, and the derby while it plays. Escape and the Android back button SHALL skip it at once. A tap, Space, or Enter SHALL skip it after its first 0.5 s, so the second tap of a double tap does not skip a cutscene it started. The game SHALL remember which cutscenes the player has seen, and an old save SHALL load with none marked seen except the ones its progress has passed.

#### Scenario: Skip
- **WHEN** the player taps the screen 1 s into any cutscene
- **THEN** it ends within 0.3 s and the game is in the state it would reach at the end.

#### Scenario: Derby clock
- **WHEN** a legend reveal plays in a derby
- **THEN** the derby clock and the cast count are the same after it as before it.

#### Scenario: Seen once
- **WHEN** the player opens Stump Bay a second time
- **THEN** the arrival fly-in does not play again.

### Requirement: Calm and layouts
With calm effects or reduced motion, a cutscene SHALL use still shots joined by fades, with no camera flight. Captions and bars SHALL fit at 390x844, 360x640, 844x390, and 1280x800 and clear the safe areas. Larger text SHALL scale the caption.

#### Scenario: Calm effects
- **WHEN** calm effects is on and the opening plays
- **THEN** it shows still shots with fades, the caption, and the sound.

### Requirement: Replay
The Places card SHALL let the player watch a seen arrival or legend reveal again.

#### Scenario: Watch again
- **WHEN** the player taps "Watch" on the Stump Bay card after its arrival played once
- **THEN** the Stump Bay fly-in plays, and the game returns to the Places card.
