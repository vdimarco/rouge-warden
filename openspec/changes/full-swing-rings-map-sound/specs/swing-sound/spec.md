## ADDED Requirements

### Requirement: The player can always see and fix the sound
The title SHALL show a SOUND: ON/OFF button that reflects the sound state, including a mute inherited from the arcade-wide switch ("arcade.sound"). Pressing PLAY with the sound off SHALL show how to turn it on. In flat play, M SHALL turn the sound on or off, and the choice SHALL be saved for this game.

#### Scenario: Muted by the arcade
- **WHEN** the arcade's speaker button (or another game) has turned the sound off, and the player opens In Full Swing
- **THEN** the title shows SOUND: OFF, and pressing PLAY shows "Sound is off. Press M to turn it on." (on a phone: turn it on in the pause menu)

#### Scenario: Press M
- **WHEN** the player presses M in flat play with the sound off
- **THEN** the sound comes on at once with an audible click, the title button shows SOUND: ON, and the game remembers it

#### Scenario: Title button
- **WHEN** the player presses SOUND: OFF on the title, then PLAY
- **THEN** the game is heard

### Requirement: The start is heard on a desktop
Pressing PLAY SHALL play a click when the sound is on. The desktop opening SHALL keep the city ambience loud enough to hear on desktop speakers: over −40 dBFS RMS at the output.

#### Scenario: Fresh desktop
- **WHEN** a desktop player with no saved sound setting presses PLAY
- **THEN** a click plays at once, and the opening plays at over −40 dBFS RMS

### Requirement: Sound comes back after the browser stops it
When the browser stops the audio context while the sound is on (for example Safari's "interrupted" state), the game SHALL ask for it back, and the next tap or key SHALL retry. No oscillator SHALL be set above half the sample rate.

#### Scenario: Context stopped by the browser
- **WHEN** the audio context leaves the running state with the sound on and the page visible
- **THEN** the game calls resume, and calls it again on the next pointer or key press

#### Scenario: A long trial
- **WHEN** the player passes ring 10 or later of a trial
- **THEN** the ring sound plays with no out-of-range frequency warning

### Requirement: Sound on an iPhone on silent
On iOS the game SHALL ask for the "playback" audio session (navigator.audioSession), and on older iOS SHALL play a silent looping media element inside the start tap, so the ring/silent switch does not mute the game.

#### Scenario: iPhone on silent
- **WHEN** an iPhone with the ring/silent switch on silent starts flat play
- **THEN** the game is heard (device check; not testable in this repository's headless Chromium)
