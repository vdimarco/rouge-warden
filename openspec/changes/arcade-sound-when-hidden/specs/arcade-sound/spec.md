## ADDED Requirements

### Requirement: Sound stops when a page is hidden
Every page that makes sound SHALL stop all of it when the page is hidden, and SHALL start again only the sound that was stopped, when the page is visible.

#### Scenario: Minimise
- **WHEN** the music plays and the player minimises the browser, locks the screen, or switches to another tab
- **THEN** every audio context is suspended or closed, no audio or video plays, and no new note is scheduled for as long as the page stays hidden

#### Scenario: Return
- **WHEN** the player returns to the page
- **THEN** the music plays again

#### Scenario: Sound that was off stays off
- **WHEN** the player had muted the game, or the game had suspended its own sound, before the page was hidden
- **THEN** the sound is still off after the page is visible again

#### Scenario: A page asks for sound while hidden
- **WHEN** a page calls `resume()` or `play()` while it is hidden
- **THEN** nothing plays until the page is visible

#### Scenario: A song starts late
- **WHEN** a SoundCloud song starts after the page was hidden, because the player's script loaded late
- **THEN** the song is paused within about a second

### Requirement: New pages load the guard
A page under `public/` that makes sound SHALL load `/arcade/quiet.js` as its first script, unless the test lists it as an exception with a reason.

#### Scenario: A new game with sound
- **WHEN** a page that creates an `AudioContext` does not load the script
- **THEN** `qa/arcade/quiet.mjs` fails and names the page

### Requirement: Headset and phone modes of In Full Swing
In Full Swing SHALL stop its sound when the page is hidden in flat mode, and SHALL keep following the XR session in a headset.

#### Scenario: Flat mode
- **WHEN** the player plays on a phone and the page is hidden
- **THEN** the audio context is suspended, and it resumes when the page is visible
