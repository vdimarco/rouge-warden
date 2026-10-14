# NORD browser media lifecycle

## Purpose
Avoid unused page video work during streaming and respect still-only preferences.

## Requirements


### Requirement: Load only needed page videos
The browser SHALL load the title loop only on a visible eligible title screen, and load the full trailer only when the player opens it explicitly.

#### Scenario: Data saver or reduced motion
- **WHEN** data saver or reduced motion is enabled
- **THEN** the title keeps its poster without assigning or requesting a title-video source; explicitly opening the full trailer remains possible.

#### Scenario: Start or connect to play
- **WHEN** the intro opens or the player connects, chooses a slot, waits to play or plays
- **THEN** the title pauses and removes its media source, and rotation cannot request hidden title/trailer videos.

#### Scenario: Return or rotate
- **WHEN** a visible eligible title returns or rotates
- **THEN** only its correct orientation clip loads; closing the full trailer cancels its media and restores the eligible title.

#### Scenario: Background and asynchronous playback
- **WHEN** the page becomes hidden or an earlier title play promise settles after the title became inactive
- **THEN** the title remains stopped without a source, no late fallback restarts it, and a visible title can resume on return; an open trailer pauses in the background.
