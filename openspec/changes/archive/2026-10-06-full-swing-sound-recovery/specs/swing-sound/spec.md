## ADDED Requirements

### Requirement: A sound that is not playing comes back
When the sound is on and a click has asked for it, but nothing plays (the audio engine failed to start, the browser closed
or stopped it, or its clock stands still), the next tap or key SHALL start it again. Turning the sound on SHALL also start
it again. A failed start SHALL log a warning in the console.

#### Scenario: The engine fails at PLAY
- **WHEN** the browser throws while the game builds its audio engine at PLAY, and the player then presses a key
- **THEN** the sound starts and the output is heard

#### Scenario: The browser closes the sound
- **WHEN** the browser closes the game's audio context during play, and the player then presses a key
- **THEN** the game builds a new one and the output is heard

### Requirement: The menus say when the sound is not playing
The title and the pause menu SHALL show the sound as "on" only while it plays (or before the first click). While the sound is
on but not playing they SHALL say "SOUND: ON, NOT PLAYING" and "Sound: on, not playing". A press of that button, or of M,
SHALL start the sound and SHALL NOT turn it off.

#### Scenario: The engine failed
- **WHEN** the audio engine failed to start at PLAY
- **THEN** the title button reads "SOUND: ON, NOT PLAYING"

#### Scenario: A click turns the sound on
- **WHEN** the player clicks SOUND: OFF on the title
- **THEN** it reads "SOUND: ON" at once, while the browser starts the sound

### Requirement: Music under a comic scene
The music and the city sound SHALL go on while a comic scene plays.

#### Scenario: The opening scene
- **WHEN** the opening scene plays after PLAY with the music on
- **THEN** the music keeps stepping and the output is heard
