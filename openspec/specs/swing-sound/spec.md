# swing-sound Specification

## Purpose
In Full Swing, how sound starts, how it comes back when the browser stops it, and how the player sees and fixes it.

## Requirements

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

### Requirement: A mission stabs, a trial counts in
A job that carries a mission name SHALL play a short brass stab when it starts. A job with no mission name, a crime, and a trial SHALL play the trial countdown. The stab SHALL put its sound in the first third of a second and SHALL be quiet after four fifths of a second. The stab's voice SHALL last at least six tenths of a second, through the second brass note. The trial countdown SHALL still be sounding after four fifths of a second. The first flush SHALL NOT play the stab.

#### Scenario: The first flush
- **WHEN** one clog is flushed and no mission starts
- **THEN** the stab does not play and the trial countdown does not play

#### Scenario: The second flush
- **WHEN** the second clog is flushed and the falling rescue starts
- **THEN** the short stab plays and the trial countdown does not

#### Scenario: An odd job
- **WHEN** a job with no mission name starts
- **THEN** the trial countdown plays and the short stab does not

#### Scenario: The two cues
- **WHEN** both cues are rendered
- **THEN** the stab is quiet after four fifths of a second and the countdown is still sounding

#### Scenario: The stab's voice
- **WHEN** the stab is played
- **THEN** its voice lasts at least six tenths of a second

### Requirement: A job win has its own sting
A won job SHALL play a short sting that matches the job, and SHALL NOT play the ring-trial fanfare. A flush, the Sludge Run or the Sludge Tanker, SHALL play a wet sting. A fight, the Rooftop Brawl or a Mugging, SHALL play a hit. A chase or a delivery, Stop, Thief!, Pizza Rush, the Getaway Car, or Taxi!, SHALL play a dash. A rescue, Catch!, the Window Washer, or the Balloon Chase, SHALL play a lift. Each of those stings SHALL be quiet after seven tenths of a second, while the ring-trial fanfare SHALL still be sounding then. The four stings SHALL NOT be the same shape. A failed job SHALL play none of them. A finished ring trial SHALL still play the fanfare. Each sting's voice SHALL last through its longest note.

#### Scenario: The purse snatcher
- **WHEN** Stop, Thief! is won
- **THEN** the dash plays and the ring-trial fanfare does not

#### Scenario: The falling rescue
- **WHEN** Catch! is won
- **THEN** the lift plays and the dash does not

#### Scenario: The roof fight
- **WHEN** the Rooftop Brawl is won
- **THEN** the hit plays and the ring-trial fanfare does not

#### Scenario: The sludge run
- **WHEN** the Sludge Run is won
- **THEN** the wet sting plays and the ring-trial fanfare does not

#### Scenario: A miss
- **WHEN** a job fails
- **THEN** none of the four win stings play and the ring-trial fanfare does not

#### Scenario: The four stings and the fanfare
- **WHEN** the four stings and the ring-trial fanfare are rendered
- **THEN** each sting is quiet after seven tenths of a second, the fanfare is still sounding, and the four stings are not the same shape

