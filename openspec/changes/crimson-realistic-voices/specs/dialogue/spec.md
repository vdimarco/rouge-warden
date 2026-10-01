# Dialogue

## ADDED Requirements

### Requirement: Consistent recorded character voices
The game SHALL play bundled character recordings for every spoken LINES entry, with a distinct male voice for each crew member and Gabe. The speaker identity and text SHALL determine the recording. Notes, phone text and stage directions SHALL remain silent.

#### Scenario: Normal conversation
- WHEN the player starts a conversation before entering a cutscene
- THEN its recorded voice plays through the game audio output
- AND the subtitles remain visible until the recording finishes.

#### Scenario: Selected crew narrator
- WHEN the player selects a different crew member
- THEN pick/hero lines use that member's voice and script variant.

#### Scenario: Matching words from different men
- WHEN two characters say the same words
- THEN each character uses his own recording.

### Requirement: Speech timing and control
The game SHALL wait for pending audio, stop canceled lines, and synchronize mouth movement to audio. It SHALL lower the score during speech.

#### Scenario: Reveal subtitles
- WHEN the player taps while modal text types
- THEN the complete text appears and its voice continues.

#### Scenario: Advance or skip
- WHEN the player advances to the next line or skips the scene
- THEN the old voice stops, including any pending download.

#### Scenario: Failed audio
- WHEN a requested recording fails to load
- THEN its handle finishes without freezing the dialogue flow.

### Requirement: Bounded scene loading
The game SHALL preload the current cutscene's voices and cache requested recordings. It SHALL not preload the whole dialogue library.

#### Scenario: New scene
- WHEN a cutscene starts
- THEN only that scene's lines and the score are requested before playback.

