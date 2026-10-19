## ADDED Requirements

### Requirement: A machine in the arcade
The Cottage Arcade SHALL have a machine for Ahead of the Light: an entry after River Rush in `GAMES` of `public/arcade/switch.js` (id `ahead-of-the-light`, name "Ahead of the Light", sub "Run home", url `/ahead-of-the-light/`, colour `#f08a2c`), an article after River Rush's in `public/index.html` with its colours (`#0b0b14`, `#f08a2c`), and its id in the Action group. The page SHALL drop `noindex` when the machine goes in.

#### Scenario: Start the machine
- **WHEN** a player drops a token in the Ahead of the Light machine and presses START, on a phone or a computer
- **THEN** the browser goes to `/ahead-of-the-light/`, and the machine sits in the Action group's row
- **CHECK** `qa/arcade/machines.mjs`

#### Scenario: The switcher knows it
- **WHEN** a player opens the game switcher on `/ahead-of-the-light/`
- **THEN** the switcher lists Ahead of the Light with the machine's id and name and marks it as the game being played
- **CHECK** `qa/arcade/machines.mjs`

#### Scenario: The machine on a phone
- **WHEN** a player walks to Ahead of the Light in the Action row on a 390 × 844 screen
- **THEN** the machine shows whole, not clipped and not under the sign or the tray
- **CHECK** `qa/arcade/machines.mjs` (the `marquee` part)

### Requirement: The place in the row
The Ahead of the Light article SHALL come after the Action articles that were there before it. The Light Years Home
article, whose cabinet came later, SHALL come after it, as AGENTS.md's New games rule says, so the Action row ends
with Ahead of the Light and then Light Years Home, in the row and in the Action group's `games`.

#### Scenario: The Action row
- **WHEN** a player opens the Action row on a computer, in portrait or in landscape
- **THEN** Ahead of the Light is the 7th of its 8 machines, after River Rush, and Light Years Home is the last
- **CHECK** `qa/arcade/groups.e2e.mjs`

### Requirement: The marquee fits
The marquee of this machine and of the Light Years Home machine SHALL show the whole title and sub line, with nothing
cut, on a machine at least 259 px tall (a box 100 px wide inside). The sub lines SHALL be RUN HOME and DRIVE ON, as in
the switcher's `sub`: 8 characters fit one line in that box (`design.md`). Where it fits, the title SHALL take one line.

#### Scenario: A computer and a phone
- **WHEN** a player opens the Action row at 1280 × 720, 1280 × 800 or 390 × 844 and picks either machine
- **THEN** its title takes one line, its sub line shows under it, and no letter is cut
- **CHECK** `qa/arcade/machines.mjs` (the `marquee` part)

#### Scenario: A small phone
- **WHEN** a player opens the Action row at 360 × 740, 375 × 667 or 320 × 700 and picks either machine
- **THEN** its title takes one or two lines, its sub line shows under it, and no letter is cut
- **CHECK** `qa/arcade/machines.mjs` (the `marquee` part), and the marquee shots reviewed by eye

### Requirement: A short machine hides the sub line
On a machine from about 230 to 259 px tall, these two marquees SHALL hide the sub line and show the whole title on two
lines, so no line is cut in half. On a shorter machine, as on a landscape phone at 844 × 390, the 12 px type floor
leaves no room for the title, and these marquees are cut like every other machine's.

#### Scenario: A short window
- **WHEN** a player opens the Action row at 360 × 640 or 800 × 600 and picks either machine
- **THEN** its title shows whole on two lines, its sub line is hidden, and no letter is cut
- **CHECK** `qa/arcade/machines.mjs` (the `marquee` part), and the marquee shots reviewed by eye

### Requirement: The cabinet screen
The machine's screen SHALL be `public/arcade/key/ahead-of-the-light.webp`, 480 px wide and under 60 KB, cut from a real portrait screenshot at HEADLIGHT with a rival in the wake and the light's ring rising, with the alt text "A ship skims galaxies on a thin white ring while a ring of light closes from behind".

#### Scenario: The screen
- **WHEN** the screen file is checked
- **THEN** it is 480 px wide, under 60 KB, and a frame of the game itself
- **CHECK** `qa/arcade/machines.mjs`, and the frame reviewed by eye

### Requirement: The cabinet line
The cabinet line SHALL read `ahead-of-the-light.meta.v1` inside try/catch and show "FIRST HOME · 14.2 YR" (the best years, once you have come home first), "HOME IN 14.2 YR" (home, never first) or "BEST: VIRGO" (the furthest leg of runs that never got home). With no save it SHALL read SKIM · BURN · WHIP.

#### Scenario: A best run
- **WHEN** the save holds a best run home in 14.2 years ahead of MANTA
- **THEN** the cabinet line reads FIRST HOME · 14.2 YR; home but never first it reads HOME IN 31.0 YR; and with a best that only reached Virgo it reads BEST: VIRGO
- **CHECK** `qa/arcade/machines.mjs`

#### Scenario: A junk save
- **WHEN** `ahead-of-the-light.meta.v1` holds text that is not a save, or storage throws
- **THEN** the machine shows its plain line, wears no gold frame, and the page has no error
- **CHECK** `qa/arcade/machines.mjs`

### Requirement: The cabinet line fits a small phone
Every cabinet line SHALL fit inside the machine's screen. The leg names SHALL be the game's, except that leg 7 SHALL read THE SUN'S STARS, because the word NEIGHBOURS is wider than the screen on a small phone and a word cannot wrap.

#### Scenario: A small phone
- **WHEN** a player whose best run reached any leg, or came home, opens the Action row at 320 × 700 or 375 × 667 and picks the machine
- **THEN** the whole line shows inside the screen; the best run caught on leg 7 reads BEST: THE SUN'S STARS
- **CHECK** `qa/arcade/machines.mjs`

### Requirement: The gold frame
When the save's unlocks hold `gold-frame` (the log's last unlock, at 84 pages), the machine SHALL wear a gold frame round its screen. The frame SHALL be drawn as a shadow on the bezel, so the machine, its coin slots and its START button keep their sizes.

#### Scenario: A full log
- **WHEN** the save's unlocks list `gold-frame` and the player opens the arcade
- **THEN** the Ahead of the Light machine has a gold ring round its screen; with 83 pages, or with unlocks that are not a list, it has none
- **CHECK** `qa/arcade/machines.mjs`

### Requirement: The title starts play in one tap
The title SHALL show AHEAD OF THE LIGHT with LIGHT in orange over black space with white points, and TAP TO FLY (on desktop CLICK OR PRESS SPACE), the hangar chip, DAILY, PRACTICE and LOG once open, settings, a link back to the arcade and the game switcher button. The sky SHALL be built behind the title. Falling stars SHALL streak now and then across the top of the title sky, clear of the buttons, fewer and slower with reduced motion. The tap SHALL start play with the ship already moving, steerable within 1.5 s.

#### Scenario: Three sizes
- **WHEN** a player taps TAP TO FLY at 390 × 844 or 844 × 390, or presses Space at 1440 × 900
- **THEN** `timing().firstSteerMs` is 1,500 or less and galaxies are already streaming
- **CHECK** `qa/ahead-of-the-light/smoke.e2e.mjs`

#### Scenario: A whole run, no errors
- **WHEN** the `mid` bot plays a whole run through `advance` at each of the three sizes, with rendering checked every leg
- **THEN** the page logs no page or console errors, and AGAIN returns to steering within 1.5 s
- **CHECK** `smoke.e2e.mjs`

#### Scenario: Back to the arcade
- **WHEN** a player on the title or the pause menu taps the switcher button or the arcade link
- **THEN** the game switcher opens, or the arcade opens
- **CHECK** `smoke.e2e.mjs`

### Requirement: Sound in the arcade
The page SHALL load `/arcade/quiet.js` as the first script in its `<head>`. The AudioContext SHALL start on the first tap, use `navigator.audioSession.type = 'playback'` where it exists, play at most 24 voices, follow the arcade's shared mute (`arcade.sound`) and M on desktop, and suspend on pause and when the page is hidden.

#### Scenario: Hidden
- **WHEN** the page is hidden mid-leg
- **THEN** its sound stops while it is hidden, the race pauses, and when the page is shown again the pause card has a low-passed drone until the player goes on
- **CHECK** `qa/arcade/quiet.mjs`

#### Scenario: Muted in the arcade
- **WHEN** the arcade's sound is muted and the player opens the game
- **THEN** the game starts muted
- **CHECK** `smoke.e2e.mjs`

#### Scenario: A real iPhone
- **WHEN** the user plays on an iPhone with the silent switch on and off
- **THEN** sound follows the `playback` session and the arcade's mute
- **CHECK** the user's playtest

### Requirement: Smooth on a mid-range phone
On a low-tier phone a frame SHALL fit 16.7 ms: two 120 Hz steps with six ships in 1.5 ms or less, three.js CPU 3 ms or less, the 2D overlay 2.5 ms or less (at most 400 path operations, no `shadowBlur`, no full-screen gradients), at most 20 draw calls and 22,000 points (desktop 30 and 60,000). The pixel ratio SHALL be min(dpr, 1.5) × glScale on phones, stepping down × 0.75 after 2 s under 40 fps, three steps at most. The game's JS SHALL be 350 KB or less uncompressed and the heap 60 MB or less.

#### Scenario: The throttled phone
- **WHEN** the perf check runs a bot's leg at 390 × 844 with a 4 × CPU throttle
- **THEN** draw calls stay at 20 or fewer and points at 22,000 or fewer, and p95 frame time and CPU a frame are reported for comparison between runs
- **CHECK** `perf.e2e.mjs`

#### Scenario: Stepping down
- **WHEN** frames run under 40 fps for 2 s
- **THEN** glScale drops × 0.75, at most three times
- **CHECK** `perf.e2e.mjs`

#### Scenario: A real mid-range phone
- **WHEN** the user plays a whole run on a mid-range phone
- **THEN** it holds 60 fps without visible judder
- **CHECK** the user's playtest

### Requirement: The test hook
The page SHALL expose `window.__race` (id `ahead-of-the-light`, version 1, the live tune) with the readers and controls listed in `design.md`, from `state()` and `feedback()` to `advance()`, `bot()` and `goto()`. Gameplay SHALL never read it. Every `TUNE` key SHALL take a case-insensitive URL override, and every URL option but `seed` and `daily` SHALL make the run unranked.

#### Scenario: Survival through the hook
- **WHEN** a test loads `/ahead-of-the-light/?gapcap=6&seed=7` and reads `__race.survival()`
- **THEN** it returns gap, ttc, light, hull, hullMax, shield, shieldT, fuel, fuelCap, years, earth, cap and leg, and the run is unranked
- **CHECK** `smoke.e2e.mjs`

#### Scenario: Jump anywhere
- **WHEN** a test calls `__race.goto({ leg: 'virgo', lane: 'M87', seed: 3 })`
- **THEN** the game flies that leg and lane, unranked
- **CHECK** `smoke.e2e.mjs`
