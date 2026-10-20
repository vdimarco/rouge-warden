## ADDED Requirements

### Requirement: The Music setting
Settings SHALL have a Music switch next to Sound, on by default and kept in the save. Music off SHALL silence the score within 0.35 s and schedule no more of it, while her heartbeat and every other sound play on. Music on SHALL bring the score back on the next bar line. Sound off, by the arcade mute or M, SHALL silence the score too, whatever the Music switch says.

#### Scenario: Turn the music off
- **GIVEN** stage 2 in play at 390 × 844
- **WHEN** the player pauses, turns Music off in Settings and resumes
- **THEN** the score is silent within 0.35 s, her heartbeat still plays, and after a reload Music is still off
- **CHECK** `qa/first-breath/music.e2e.mjs`, `qa/first-breath/save.test.mjs`

#### Scenario: Turn it back on
- **GIVEN** stage 2 with Music off
- **WHEN** the player turns Music on and resumes
- **THEN** the stage's cue comes back on the next bar line at the level the stage's mood gives
- **CHECK** `qa/first-breath/music.e2e.mjs`

#### Scenario: The switch in every layout
- **GIVEN** Settings at 390 × 844 and 844 × 390 with touch, and at 1440 × 900
- **WHEN** the Music switch is found
- **THEN** it sits next to Sound, is at least 44 px on its shorter side, overlaps nothing, and Tab reaches it with a visible focus ring
- **CHECK** `qa/first-breath/layout.e2e.mjs`

#### Scenario: M silences the score
- **GIVEN** stage 1 with Music on
- **WHEN** the player presses M, and then M again
- **THEN** the score falls silent with the rest of the sound, and comes back with it
- **CHECK** `qa/first-breath/music.e2e.mjs`

### Requirement: The score pauses with the game
While the game is paused or the page is hidden, the score SHALL schedule no notes. After Resume it SHALL come back on the next bar line of the cue it was playing, at the level the stage's mood gives then.

#### Scenario: Hidden, then resumed
- **GIVEN** stage 4 with the score at level 1
- **WHEN** the page is hidden for 5 s, shown again, and the player taps Resume
- **THEN** no score note was scheduled while the page was hidden or the game was paused, and the first note after Resume lands on a bar line of the stage 4 cue
- **CHECK** `qa/first-breath/music.e2e.mjs`, `qa/arcade/quiet.mjs`

#### Scenario: Esc on desktop
- **GIVEN** stage 7 at 1440 × 900 with the score at level 2
- **WHEN** the player presses Esc, waits 3 s and resumes with Enter
- **THEN** the score is silent while paused and comes back on a bar line after Enter
- **CHECK** `qa/first-breath/music.e2e.mjs`
