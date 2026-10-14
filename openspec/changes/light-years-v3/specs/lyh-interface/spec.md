## ADDED Requirements

### Requirement: Start fast
The title SHALL show LIGHT YEARS HOME in the caption style over a live field of white points, with PLAY live within about 1.5 s on a mid-range phone, and CONTINUE when a save exists. Any key or tap SHALL play. The ship SHALL take input within 0.3 s of PLAY, and the player's first input SHALL count within 3 s. Nothing SHALL wait on art: if the player is faster than the loading, traffic SHALL show as sized points until its images land.

#### Scenario: PLAY to control
- **WHEN** a player at 390×844, 844×390 or 1440×900 taps or clicks PLAY
- **THEN** the ship takes input in under 500 ms of wall time and the first steer is accepted within 3 s

#### Scenario: Continue
- **WHEN** a player with a save from Coma City opens the game
- **THEN** CONTINUE shows on the title and puts them at Coma's entry, or at its exit gate when that is open

### Requirement: HUD layout on each screen
The HUD SHALL come from one pure layout table, and the page SHALL match it within 2 px. No element SHALL overlap another, the ship's rectangle or the safe areas, captions SHALL never sit in the bottom third, and the page SHALL never scroll sideways. A left-hand setting SHALL mirror the layout. The table SHALL hold for 390×844, 844×390 and 1440×900, and also 375×667, 430×932 and 1024×768, in both phone schemes.

#### Scenario: Portrait 390×844
- **WHEN** the game plays in portrait with stick and pedals
- **THEN** the speed gauge, mission line and pause run along the top, captions sit under them with the toast below, the radar sits top right with the info box beside it, the action chip sits under the ship, and BOOST, BRAKE and GAS sit under the right thumb, with the stick anywhere in the lower screen

#### Scenario: Landscape 844×390
- **WHEN** the game plays in landscape
- **THEN** the speed, mission line and pause sit in one top row, captions, toast and one hint-or-info slot stack in the top half, the radar sits top left, the stick works in the lower left, and BOOST, GAS and BRAKE sit on the right inside the safe area

#### Scenario: Desktop 1440×900
- **WHEN** the game plays at 1440×900 with keys
- **THEN** the mission line sits top centre, captions and toast under it, the radar lower left, the hint pill and action chip under the ship, and no touch controls show

### Requirement: Hints
Hints SHALL use their own pill, never the caption band: at most one at a time, for 3 s, and at most four in the first minute, in the words of the device in use. The first SHALL come 0.5 s after PLAY (DRAG TO STEER on touch, A D TO STEER · W FOR GAS on keys, LEFT STICK TO STEER on a gamepad), and the drift hint SHALL come near the Bend Giant before the boost hint.

#### Scenario: Hints on a phone
- **WHEN** a new player in portrait plays the first 20 s with no input
- **THEN** DRAG TO STEER shows at 0.5 s, HOLD A HARD TURN shows near the Bend Giant, and FLICK UP TO BOOST comes only after the first drift-boost or at 15 s

#### Scenario: Hints on desktop
- **WHEN** a new player at 1440×900 drifts for the first time
- **THEN** SPACE + STEER TO DRIFT has already shown, and RELEASE SPACE TO BOOST shows at the first tier

### Requirement: Menus and settings
Pause SHALL offer RESUME, LOG, SETTINGS, SWITCH GAME (the arcade's game switcher) and QUIT TO ARCADE. Settings SHALL offer stick and pedals or one thumb, left hand, tilt steering in landscape, invert climb, mouse steer, the Cruise or Pilot assists, auto-drift, reduced motion, slow captions, sound and music through the arcade's shared setting, quality (auto, high, mid, low) and Copy log.

#### Scenario: Pausing
- **WHEN** a desktop player presses Esc or P, or a phone player taps the pause button
- **THEN** the game freezes, sound ducks, and the pause menu shows its five choices

#### Scenario: Switching scheme
- **WHEN** the player picks one thumb in settings and resumes in portrait
- **THEN** the GAS and BRAKE pedals leave the screen, BOOST moves to its one-thumb place, and nothing overlaps

### Requirement: Saves
Progress, settings and ghosts SHALL be saved in local storage under `light-years-home.v3.*` 1 s after a change, at most every 2 s, and when the page is hidden. Missing, blocked, throwing or junk storage SHALL never stop the game. At most 48 ghosts SHALL be kept. A mission left half done SHALL start again from its first beat, and a save made inside the jet pocket SHALL continue in Virgo at M87. Nothing SHALL be sent anywhere.

#### Scenario: Blocked storage
- **WHEN** the game runs with local storage that throws on every call
- **THEN** it plays normally and simply forgets progress on reload

#### Scenario: Saved in the pocket
- **WHEN** the player reloads while inside M87's jet
- **THEN** CONTINUE puts them in Virgo beside M87

### Requirement: Sound and feedback
All sound SHALL be made in code with Web Audio, start on the PLAY tap, follow the arcade's shared sound setting and stop when the page is hidden. Every core event SHALL map to a sound and an effect: the engine opens up with speed, near misses zzip, drift tiers chime, gates play the place's scale, and the radio dips by the Doppler factor at light speed. Android SHALL buzz on near misses, tiers, boosts and hits; nothing SHALL depend on it.

#### Scenario: Every action answers
- **WHEN** the test hook steps the core through a near miss, a drift tier, a boost, a scrape and a gate
- **THEN** a sound really starts for each one, counted by the hook, and a flash, tick or shake shows for each

#### Scenario: Quiet when hidden
- **WHEN** the page is hidden and shown again
- **THEN** the sound stops and comes back, and `/arcade/quiet.js` is the first script the page loads

### Requirement: Reduced motion and access
Under reduced motion, from the system or the settings, there SHALL be no shake, FOV kicks of at most 4°, speed streaks at half length, flashes of at most 0.3 alpha, and 0.2 s dips in place of the zoom and the restart streak. Every caption SHALL also go to an `aria-live` line, and colour SHALL never be the only cue: gates change brightness, split times carry a sign and the racing line uses dashes.

#### Scenario: Reduced motion
- **WHEN** a player with reduced motion on punches into a jump
- **THEN** the flash stays at or under 0.3 alpha, nothing shakes, and the view does not roll

### Requirement: Performance budgets
On the mid tier, used by phones, the game SHALL aim for 45 draw calls and stay under 60, with at most 50,000 points, 60,000 triangles and 48 MB of textures, and a pixel ratio capped at 1.5. When the slowest 5% of frames pass 20 ms over 3 s it SHALL lower the pixel ratio, then points, then impostors. A load that died SHALL start one tier lower and say `LOW GRAPHICS · CHANGE IN SETTINGS`. A lost graphics context SHALL resume paused with the place rebuilt.

#### Scenario: Busiest places under the caps
- **WHEN** the browser check measures Coma downtown and the jump corridor on the mid tier
- **THEN** draw calls, points, triangles and texture bytes are all under the mid caps

#### Scenario: After a crash on load
- **WHEN** the page reloads with a boot breadcrumb left in session storage
- **THEN** it starts one tier lower and the hint pill says `LOW GRAPHICS · CHANGE IN SETTINGS`

#### Scenario: Lost context
- **WHEN** the graphics context is lost and restored
- **THEN** the game is paused with the place rebuilt and resumes on RESUME

### Requirement: The test hook
The page SHALL expose `window.__lyh` with version 3 for tests: start anywhere with any save and settings, step the core with an input record and get its events, read state, sounds that really started, layout rectangles, timing and performance, force a slow load or a lost context, and drive a bot. Gameplay SHALL never read the hook, and every read SHALL return a copy. URL switches SHALL cover `?bot=`, `?zone=`, `?quality=`, `?tune.GROUP.KEY=`, `?perf` and `?debug`.

#### Scenario: Stepping through the hook
- **WHEN** a test calls `__lyh.start({ zone: 'wall', seed: 1 })` and then `__lyh.step({ steer: 0 }, 4)`
- **THEN** the call returns at least three `near` events and `__lyh.played()` counts at least three near-miss sounds

### Requirement: The arcade machine
In Round 2, Light Years Home SHALL stand as a machine in the arcade's Action group and in the game switcher, with a cabinet screen taken from a real frame of the drop-out into Coma, and a cabinet line read from the save, such as `COMA CITY · GOLDS 3` or `CHAPTER I DONE · GOLDS 9`. The pause menu's SWITCH GAME SHALL open the arcade's switcher.

#### Scenario: The cabinet
- **WHEN** a player with a save at Coma opens the Action group in the arcade
- **THEN** the Light Years Home machine shows its screen and the line `COMA CITY · GOLDS` with their gold count, and playing it opens `/light-years-home/`
