## ADDED Requirements

### Requirement: Lab chooser button for B
The lab chooser at `/light-years-home/lab/` SHALL be a silent black page in the video's look with a thin-ring button "B · SLINGSHOT HOME · grab, whip, let go" and one plain line under it. The button SHALL open `/light-years-home/lab/b/`. The chooser and B SHALL carry `noindex`, load `/arcade/quiet.js` as their first script, and offer a way back to the arcade.

#### Scenario: Open B from the chooser
- **GIVEN** the chooser at 390×844, 844×390 or 1440×900
- **WHEN** the player taps or clicks the B button, or presses B or 2 on a keyboard
- **THEN** `/light-years-home/lab/b/` opens

#### Scenario: Chooser stays quiet and fits
- **GIVEN** the chooser at 390×844, 844×390 or 1440×900
- **WHEN** it has loaded
- **THEN** it has made no AudioContext, every button and link is at least 44 px tall, and the page does not scroll sideways

### Requirement: Start with the ship moving
The title SHALL show the name and "TAP TO FLY" on touch screens or "CLICK OR PRESS SPACE" on desktop. That tap or key SHALL start play with the ship flying north at 0.76c, create the AudioContext, and set `navigator.audioSession.type` to `playback` where it exists. Mass 1 SHALL be in reach by 0.5 s, and the world SHALL run at 0.3× from then until the first press.

#### Scenario: First grab within 3 seconds
- **GIVEN** a first run in portrait
- **WHEN** the player taps the title and does nothing else
- **THEN** within 0.5 s mass 1's ring brightens, the world slows to 0.3× and HOLD pulses
- **WHEN** the player then puts a thumb down
- **THEN** on that frame a tether snaps to mass 1 with a pluck and the ship starts to orbit

### Requirement: Hold and lift on every device
B SHALL use one input: hold to grab and reel, lift to let go. On phones it SHALL be a thumb anywhere, with one pointer counted. On desktop it SHALL be Space or the left mouse button. A 44 px pause button SHALL sit outside the play input. On desktop Esc or P SHALL pause, R restart the stage, M mute, C change camera and B start a bot. `?tap=1` SHALL make a tap grab and a second tap let go. Input SHALL be ignored while the game switcher is open.

#### Scenario: Second finger ignored
- **GIVEN** the player holds one thumb down in an orbit
- **WHEN** a second finger touches and lifts
- **THEN** the orbit continues until the first thumb lifts

#### Scenario: Desktop hold
- **GIVEN** play at 1440×900
- **WHEN** the player holds Space and releases it
- **THEN** the ship grabs on the press and flies off on the release, the same as a mouse button

#### Scenario: Hidden page pauses
- **GIVEN** play is running
- **WHEN** the page is hidden and shown again
- **THEN** the simulation did not advance while it was hidden and the game shows as paused

### Requirement: The grab
A press SHALL lock a tether to the nearest mass within reach (2.4 R) at the ship's current distance. With no mass in reach the press SHALL arm and lock the first mass that enters reach. The grab SHALL cost 0.35 × max(0, c)² of η, where c is the cosine between the ship's heading and the line to the mass, so a press at closest approach costs nothing.

#### Scenario: Press alongside
- **GIVEN** a mass is exactly abeam of the ship
- **WHEN** the player presses
- **THEN** the grab costs no speed

#### Scenario: Press too early
- **GIVEN** the ship is heading straight at a mass, between its reach circle and its latch ring
- **WHEN** the player presses
- **THEN** η drops by 0.35 and the orbit starts wide outside the latch ring

### Requirement: Reel, sweep and burn
While held, depth d SHALL rise by 0.20 a second, plus 0.40 a second per unit of negative depth. A release line SHALL sweep at 180 + 60 × max(d, 0) degrees a second, at least 90 while wide. The world and music SHALL run at 1 − 0.6 × clamp(d, 0, 1). At d 0.9 the core SHALL flash red and crackle, 0.5 s before a burn at d 1.

#### Scenario: Deep is slow
- **GIVEN** the ship is held at depth 0.8
- **WHEN** time passes
- **THEN** the world runs at 52 % speed and the hum's filter closes with it

#### Scenario: Warned before a burn
- **WHEN** the player holds until the ship reaches a core
- **THEN** a warn event fired at least 0.45 s before the burn

### Requirement: Release and the preview line
On a lift the ship SHALL fly along the tangent. The release SHALL be graded by the smallest angle to the band centre of any mass ahead: PERFECT up to 8°, GOOD up to 16°, WIDE up to 30°, else MISS. While held, a plain white line SHALL run 70 u ahead, a ring it crosses SHALL brighten, and a ring that is not next in order SHALL show +2. `?cue=1` SHALL colour the line by grade.

#### Scenario: A perfect fling
- **GIVEN** the preview line crosses the next ring's orange band
- **WHEN** the player lifts
- **THEN** PERFECT shows, a chime one step above the last plays, the game holds for 80 ms and then runs at half speed for 0.3 s
- **AND** the camera kicks forward with +8° of FOV and a whoosh plays

#### Scenario: Let go cue
- **GIVEN** a first run
- **WHEN** the line first crosses a band
- **THEN** LET GO shows once

### Requirement: Speed gain and the nines
A release SHALL add (0.05 + 0.45 × max(d, 0)²) × mass × aim × chain × skip to η, with mass 0.8 to 2.0, aim 1.6, 0.8, 0.4 or 0, chain 1 + 0.06 per clean release up to +60 %, and skip × 1.25. The sky SHALL use the true speed. Each time β crosses 0.9, 0.99, 0.999 and 0.9999 the new speed SHALL show in large digits with the new 9 in orange, with a radial flash, a chord a tone higher and a visible squeeze of the sky.

#### Scenario: A deep perfect pays
- **GIVEN** no chain and no skip
- **WHEN** the player releases from depth 0.8 off a medium mass with a PERFECT
- **THEN** η rises by about 0.54

#### Scenario: First nine-up
- **WHEN** η crosses 1.472
- **THEN** 0.9000c shows large with the 9 in orange, the screen flashes outward and a chord plays a tone higher

### Requirement: Light speed
At η 4.952 B SHALL enter LIGHT SPEED: a 150 ms freeze, a 0.2 s white-out, the sky folded into one point with a deep red ring behind, the clock in orange, a sub swell, the caption LIGHT SPEED, and flights 1.4 times faster. GOOD or better releases SHALL keep it. A WIDE, MISS, burn or lost SHALL drop η to 3.8 with a falling whoosh as the sky unfolds.

#### Scenario: Dropping out
- **GIVEN** the ship is at LIGHT SPEED
- **WHEN** the player releases WIDE
- **THEN** η drops to 3.8, the sky unfolds, and a falling whoosh plays

### Requirement: Camera that never turns
The camera SHALL always look up the course. In flight it SHALL sit 24 u behind the ship at a pitch of 30° in portrait and 22° elsewhere. While held it SHALL rise to 55° (45°) and 30 u and look at the anchor, easing in 0.3 s. The FOV SHALL be 62° across the short side, 80° at LIGHT SPEED, with +8° on each release. `?cam=chart` SHALL give a fixed top-down view.

#### Scenario: The world does not spin
- **GIVEN** the ship orbits a mass for a full lap
- **WHEN** a screenshot is taken each quarter lap
- **THEN** the course's north stays at the top of the screen in every one

### Requirement: Burn, lost and rewind
Reaching a core SHALL be a BURN, and 2.2 s with no mass in reach, besides the one just left, SHALL be LOST. Both SHALL play a 0.9 s rewind and return the ship to 0.5 s before its last grab with η = max(0.8, η − 0.3) and the chain reset. Input SHALL be live 1.3 s after the burn. The clock SHALL never rewind. After 3 burns or losts on one mass its next approach SHALL show a ghost line and 1.5× wider windows.

#### Scenario: Burn and straight back in
- **WHEN** the ship burns in a core with η 2.0
- **THEN** a white-hot flash, 12 px of shake and a crackle play, the trail runs backward for 0.9 s, and the ship is back on its approach at η 1.7, taking input 1.3 s after the burn

#### Scenario: The clock keeps the cost
- **GIVEN** the clock reads +1.40 YR at a burn
- **WHEN** the rewind ends
- **THEN** the clock reads more than +1.40 YR

### Requirement: Score is your clock
Your clock SHALL run at 0.38 years per real second ÷ γ, and the score SHALL be the years aged from start to Coma, lower being better. Ranks SHALL be Lightkeeper up to 1.2 years, Navigator up to 2.5, Wayfinder up to 5 and Drifter above. There SHALL be no game over: the stage ends when the player lets go of Coma, and R SHALL restart it in under 1 s.

#### Scenario: Home card
- **WHEN** the player lets go of Coma
- **THEN** the vista plays and a card shows "THE WEB · +2.4 YR · NAVIGATOR · VIRGO NEXT"
- **AND** the result card shows rank, clock, best, top speed, PERFECT %, longest chain, burns, losts, stage time and branch, with AGAIN (back in play within 1.5 s) and Copy log

### Requirement: Stage one, the web to Coma
B SHALL play one hand-placed course of 23 masses from (0, 0) to Coma at (0, 390): a teaching run, a zigzag, a knot, a rescue mass, a void jump, a fork with an avenue of six small masses on the left and two large on the right, Coma's outskirts where its ring and label draw on, and Coma as a landmark judged toward a faint Virgo ring. `?toy=1` SHALL give an endless strip of random masses with no clock.

#### Scenario: The first minute
- **GIVEN** a first-time player in portrait
- **WHEN** they play for a minute
- **THEN** they grab mass 1 by 3 s, fling with LET GO by 5 s, reach 0.9c by about 15 s, meet the knot, the void jump and the fork by 30 s, and reach Coma at 45 to 60 s

#### Scenario: Coma vista
- **WHEN** the player lets go of Coma
- **THEN** play freezes for 0.15 s and the sky punches to one point for 0.8 s before the card

### Requirement: Feedback every time
Every grab, release, grade, nine-up, warning, burn, lost, drop-out and LIGHT SPEED SHALL play its sound and visual the moment it happens; no sound SHALL wait for a beat. The drone SHALL be in D minor, rising a whole tone at each nine-up. Where `navigator.vibrate` exists these SHALL buzz. With reduced motion there SHALL be no shake or FOV kick and softer flashes.

#### Scenario: Grab feel
- **WHEN** the player presses near a mass
- **THEN** the tether draws within 60 ms, the ring clicks bright, a pluck pitched by mass size plays, and the camera starts to rise

#### Scenario: Reduced motion
- **GIVEN** the system asks for reduced motion
- **WHEN** the ship burns
- **THEN** the screen does not shake and the flash is softer

### Requirement: Layouts
Speed SHALL show at the top left with all its nines, the clock at the top right, and the chain under the speed. Callouts SHALL sit 38 % down in portrait and at the centre in landscape. The page SHALL not scroll, and HUD items SHALL stay inside the safe area.

#### Scenario: Three screens
- **GIVEN** play at 390×844, 844×390 and 1440×900
- **WHEN** a screenshot is taken during a hold
- **THEN** the anchor mass and the next ring are on screen, no HUD item overlaps another, and the pause button is at least 44 px

### Requirement: Tuning, telemetry and the test hook
Every TUNE key SHALL be settable from the URL, ignoring case, along with `seed`, `debug`, `toy` and `bot`. The last 20 runs SHALL be kept in `localStorage` under `lyh-lab-b-runs`, read and written inside try/catch. The page SHALL expose `window.__lab` with `id: 'b'`, `version`, `tune`, `state()`, `events(n)`, `runs()`, `restart(seed)`, `advance(seconds, input)`, `bot(name, opts)`, `input({ down })` and `timing()`.

#### Scenario: Headless advance
- **WHEN** a test calls `__lab.advance(5, { down: false })`
- **THEN** the simulation runs 600 steps of 1/120 s and returns their events

#### Scenario: Same seed, same run
- **WHEN** two runs use the same seed and the same inputs
- **THEN** they give the same events and the same clock

### Requirement: Skill spread
The tuning SHALL give a real spread between bots: `exact` clears in 40 to 65 s with at most 1 rewind, reaches LIGHT SPEED before mass 12 and ends at 1.2 years or less; `greedy` with 60 ms jitter clears with at most 4 rewinds at 1.5 to 3 years; `first` with 110 ms jitter clears within 120 s at 4 years or more without LIGHT SPEED; and the `exact` clock is at most a third of the `first` clock.

#### Scenario: Bots in node
- **WHEN** `node qa/light-years-home/lab-b.test.mjs` runs
- **THEN** every bot check passes, pressing at closest approach gains at least 25 % more η, and 10,000 steps of random presses and random dt give no NaN and no error
