## MODIFIED Requirements

### Requirement: Brief spoken action hints
When Voice hints and Sound are enabled and speech synthesis is available, the game SHALL speak brief nibble and hook-set hints in a measured British wildlife-narrator style. It SHALL prefer an installed British English voice, fall back when unavailable, avoid repeated or queued speech, prioritize the hook-set hint, and stop when play pauses, the page hides, or either setting is disabled. Visual, haptic, sound, and screen-reader feedback SHALL remain available without speech synthesis.

#### Scenario: Nibble followed by strike
- **WHEN** a fish nibbles and then strikes while Voice hints and Sound are enabled and a British English voice is installed
- **THEN** the game uses that voice with measured pacing for a brief hold-steady hint and a short hook-set command; the command can interrupt the nibble hint.

#### Scenario: Repeated nibble
- **WHEN** repeated nibble events arrive within a short interval
- **THEN** the game does not queue or speak the same instruction for every event.

#### Scenario: Speech disabled or interrupted
- **WHEN** the player turns off Voice hints or Sound, pauses, or leaves the page while a hint is speaking
- **THEN** the speech stops, while the on-screen cue and screen-reader instruction remain available.

#### Scenario: No speech support
- **WHEN** speech synthesis is unavailable on a device
- **THEN** gameplay proceeds without an error and the other cues still communicate what to do.

#### Scenario: Voices load after play begins
- **WHEN** the speech engine first reports no British English voice but adds one later
- **THEN** subsequent hints can use the newly available voice without restarting the game.

#### Scenario: No British voice
- **WHEN** no British English voice is installed but speech synthesis is available
- **THEN** the game uses an understandable available voice for the same short hints.
