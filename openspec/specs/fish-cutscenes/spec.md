# fish-cutscenes Specification

## Purpose
Reel It In has short cutscenes drawn in its own scene: the opening, the arrival at a new place, a legend's first reveal, a legend landed, and the finale. They play once, never cost the player a fish or a cast, can be skipped, and can be watched again.

## Requirements

### Requirement: Short in-engine cutscenes
The game SHALL have four kinds of short cutscenes, drawn live in the game's own scene and art: the opening, the arrival at a new place, a legend's reveal, and a legend landed (with a finale after the last legend). Each SHALL last from 4 to 9 s, show letterbox bars and one short caption in the game's voice, and play its own sound. The cutscenes SHALL need no network and no new video files. A legend's reveal SHALL never play after the player has hooked or landed that legend. When a cutscene ends, by itself or by a skip, the first frame after it SHALL show the game's own view, with no camera flight back from the shot, at any frame rate.

#### Scenario: Opening
- **WHEN** a player with a fresh save taps "Go fishing" for the first time
- **THEN** the camera glides low over Loon Lake at dawn and settles on the dock in the cast view, the caption names the place, and the cast starts when it ends.

#### Scenario: Camera back on the dock
- **WHEN** the opening or a legend's reveal ends by itself or by a skip, also on a slow frame
- **THEN** the first frame after it shows the cast view from the dock.

#### Scenario: Arrival
- **WHEN** the player travels to a place for the first time
- **THEN** a fly-in shows that place's look with its name before the arrival card.

#### Scenario: Legend reveal
- **WHEN** a legend's gold ring rises at a place for the first time, outside a fight, and the player has landed at least one fish
- **THEN** the camera pushes toward the ring, the legend breaches, its name shows, and play goes on from the same cast state.

#### Scenario: Space chain
- **WHEN** the player presses Space to end the beat after a cast, or on the catch card, and the legend's first gold ring is on the water
- **THEN** the reveal plays in place of the Space cast, and Space held through it casts nothing.

#### Scenario: Legend met first
- **WHEN** the player hooks or lands a legend before its reveal plays
- **THEN** its reveal does not play after that, and its next gold ring shows the gold ring toast.

#### Scenario: Legend landed
- **WHEN** the player lands a legend
- **THEN** a hero shot shows the legend with its name and weight before the catch card. After the fourth legend, a short finale says the player fished them all.

### Requirement: Cutscenes never cost the player
A cutscene SHALL play once for each event, SHALL never start during a fight, and SHALL hold the fish, the clock, and the derby while it plays. A press that is down when a cutscene starts SHALL cast nothing, during the cutscene or after it. Escape and the Android back button SHALL skip it at once. A tap, Space, or Enter SHALL skip it after its first 0.5 s, so the second tap of a double tap does not skip a cutscene it started. The game SHALL remember which cutscenes the player has seen, and an old save SHALL load with none marked seen except the ones its progress has passed.

#### Scenario: Skip
- **WHEN** the player taps the screen 1 s into any cutscene
- **THEN** it ends within 0.3 s and the game is in the state it would reach at the end.

#### Scenario: Derby clock
- **WHEN** a legend reveal plays in a derby
- **THEN** the derby clock and the cast count are the same after it as before it.

#### Scenario: Press held into a reveal
- **WHEN** the player presses the lake with the mouse or a finger just before a legend's reveal starts, and holds, drags, or lets go during it or after it
- **THEN** no cast flies, the derby cast count stays the same, and the next press after the reveal casts as usual, also when it comes before the game draws its next frame.

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
