## MODIFIED Requirements

### Requirement: Sound follows the arcade
The game SHALL start its AudioContext on the Play tap, use `navigator.audioSession.type = "playback"` where it exists, follow the arcade's shared mute `arcade.sound` and the M key, and be silent while the page is hidden. The score SHALL follow the same mute, and SHALL schedule nothing while the page is hidden.

#### Scenario: Hidden page
- **GIVEN** the quiet check's First Breath entry, which plays its own music
- **WHEN** the quiet check presses `#play` and then hides the page in the middle of a stage
- **THEN** its sound stops while hidden, the score schedules nothing new, and the game pauses
- **CHECK** `qa/arcade/quiet.mjs`

#### Scenario: Muted in the arcade
- **GIVEN** `arcade.sound` set to off
- **WHEN** the player opens First Breath and taps Play
- **THEN** the game starts muted with no score heard, and captions and rings still show every cue
- **CHECK** `qa/first-breath/smoke.e2e.mjs`
