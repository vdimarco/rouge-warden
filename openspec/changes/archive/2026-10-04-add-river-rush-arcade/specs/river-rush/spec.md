## ADDED Requirements

### Requirement: River Rush arcade cabinet
The arcade SHALL append a River Rush cabinet with id `river-rush`, name `River Rush`, route `/river-rush/`, a real game picture, and membership in the Action group. The shared switcher SHALL use the same id, name and route.

#### Scenario: Launch from the arcade
- **WHEN** a player selects River Rush and starts its cabinet
- **THEN** the browser opens `/river-rush/` and its approved menu art and Start adventure button load

#### Scenario: Shared switcher
- **WHEN** a player opens Switch game from River Rush's menu or result screen
- **THEN** River Rush is marked as the current game and the player can return to the arcade or another cabinet

### Requirement: A complete treasure race
River Rush SHALL retain keyboard and touch steering, timed key release, reduced steering while reaching, key-gated sustained chest unlocking, balance damage and recoverable falls, a rival and a marked left escape channel. A win SHALL require unlocked treasure and escape before the rival within two minutes.

#### Scenario: Catch and unlock
- **WHEN** the player reaches near a key and releases within the catch window, then holds Unlock for two seconds
- **THEN** the key is secured, treasure is claimed, and the objective progresses to escape

#### Scenario: Pause and restart
- **WHEN** the player pauses or the page is hidden
- **THEN** race time stops until resumed, and Restart begins a fresh run

#### Scenario: Desktop and phone
- **WHEN** the game is played at 1536 by 1024 or 390 by 844
- **THEN** art loads from the game subpath, controls respond, and no horizontal overflow hides the main actions

### Requirement: Validated best score
The game SHALL save successful best runs in `river-rush-best`. The cabinet SHALL display a positive finite saved score; invalid or absent data SHALL leave the plain cabinet line without errors.

#### Scenario: Saved and invalid scores
- **WHEN** the save contains a best score of 2102
- **THEN** the cabinet displays BEST 2,102 PTS
- **WHEN** that save is malformed or its score is nonpositive or not finite
- **THEN** the default cabinet line is shown and the arcade remains usable

### Requirement: Shared audio lifecycle
The arcade build SHALL load `/arcade/quiet.js` before other scripts so audio suspends when the page is hidden.

#### Scenario: Hide the page
- **WHEN** game audio has started and the page becomes hidden
- **THEN** the shared lifecycle script silences the game without breaking its own mute control
