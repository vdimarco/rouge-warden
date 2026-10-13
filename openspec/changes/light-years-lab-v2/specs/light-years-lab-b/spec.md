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
The title SHALL show the name and "Tap to fly" on touch screens or "Click or press Space" on desktop. That tap or key SHALL start play with the ship flying north at 0.76c, create the AudioContext, and set `navigator.audioSession.type` to `playback` where it exists. Mass 1 SHALL be in reach by 0.5 s. On a first run the world SHALL slow to 0.3× as mass 1 comes alongside and wait for the first press. The clock SHALL start at the first fling.

#### Scenario: First grab within 3 seconds
- **GIVEN** a first run in portrait
- **WHEN** the player taps the title and does nothing else
- **THEN** mass 1 is in reach by 0.5 s, and at about 1.3 s, as it comes alongside, the world slows toward 0.3× and HOLD pulses
- **WHEN** the player then puts a thumb down
- **THEN** on that frame a tether snaps to mass 1 with a pluck, the ship starts to orbit at half speed, and the clock still reads +0.00 YR

### Requirement: Hold and lift on every device
B SHALL use one input: hold to grab and reel, lift to let go. On phones any finger on the play area SHALL hold, so a swing lasts until the last finger lifts. On desktop it SHALL be Space or the left mouse button. A 48 px pause button SHALL sit outside the play input. On desktop Esc or P SHALL pause, R restart, M mute, C change camera and B start a bot. `?tap=1` SHALL make a tap grab and a second tap let go. Input SHALL be ignored while the game switcher is open.

#### Scenario: Roll from one thumb to the other
- **GIVEN** one thumb holds an orbit
- **WHEN** a second thumb touches and then the first thumb lifts
- **THEN** the orbit continues until the second thumb lifts too

#### Scenario: Desktop hold
- **GIVEN** play at 1440×900
- **WHEN** the player holds Space and releases it
- **THEN** the ship grabs on the press and flies off on the release, the same as a mouse button

#### Scenario: Tap option
- **GIVEN** the URL has `?tap=1`
- **WHEN** the player taps with a mass in reach and taps again later
- **THEN** the first tap grabs and the second lets go

### Requirement: Pausing keeps the swing
Pausing SHALL never let go of a swing. After P, Esc or the pause button, a thumb or key still down on resume SHALL keep holding. A blur, a hidden page, or the system taking the only touch during a swing SHALL pause instead; on resume the swing SHALL wait under HOLD TO GO ON until a fresh press takes it on. The sound SHALL go quiet while paused or hidden. The pause card SHALL offer Go on, Restart, sound, camera, the lab link and Switch game.

#### Scenario: Pause in mid-swing
- **GIVEN** the player holds Space in an orbit at depth 0.35
- **WHEN** they press P, then P again, still holding Space
- **THEN** the orbit goes on from where it stopped and nothing is released

#### Scenario: Hidden page in mid-swing
- **GIVEN** a thumb holds an orbit
- **WHEN** the page is hidden, shown again, and the player taps Go on
- **THEN** HOLD TO GO ON pulses and the game waits, and the next press carries on the same orbit

#### Scenario: Hidden page pauses
- **GIVEN** play is running
- **WHEN** the page is hidden and shown again
- **THEN** the simulation did not advance while it was hidden and the game shows as paused

### Requirement: The grab
A press SHALL lock a tether to the nearest mass within reach (2.4 R). The catch SHALL be at the ship's distance, but never deeper than depth 0.6: a press closer in eases out to that orbit. The grab SHALL cost 0.35 × max(0, c)² of η, where c is the cosine between the heading and the line to the mass, but never take η below 1.0 or out of LIGHT SPEED. With no mass in reach the press SHALL arm and grab the first mass that enters reach.

#### Scenario: Press alongside
- **GIVEN** a mass is coming alongside
- **WHEN** an orange tick flashes on its ring with a light double tick, 0.12 s before closest approach, and the player presses
- **THEN** the grab costs no speed

#### Scenario: Press too early
- **GIVEN** the ship at η 2.0 is heading straight at a mass, between its reach circle and its latch ring
- **WHEN** the player presses
- **THEN** η drops to 1.65, the orbit starts wide outside the latch ring, a dull pluck plays, the speed flashes red and EARLY shows with about 18% SPEED LOST

#### Scenario: Press at the core
- **GIVEN** the ship is 2 u from the centre of a medium mass
- **WHEN** the player presses
- **THEN** the tether catches at depth 0.6, and the burn warning comes at least 1 s later

#### Scenario: Press with nothing in reach
- **WHEN** the player presses with no mass in reach
- **THEN** a dashed tether probes ahead toward the first mass the line will reach (red if there is none), a soft blip and a search tone play, and that mass is grabbed the moment it comes into reach

### Requirement: Reel, sweep and burn
While held, depth d SHALL rise by 0.24 a second, faster while wide (+0.6, plus 0.6 per unit of negative depth). A release line SHALL sweep at 180 + 60 × max(d, 0) degrees a second, at least 90 while wide. The world and music SHALL run at 1 − 0.6 × clamp(d, 0, 1), and the screen edges SHALL darken. Every core SHALL show its burn zone as a thin red circle at 0.3 R. A core SHALL flash red and crackle 0.5 s before any burn, held or in flight.

#### Scenario: Deep is slow
- **GIVEN** the ship is held at depth 0.8
- **WHEN** time passes
- **THEN** the world runs at 52 % speed and the hum's filter closes with it

#### Scenario: Warned before a burn
- **WHEN** the player holds until the ship reaches a core
- **THEN** a warn event fired at least 0.45 s before the burn

#### Scenario: Grab to save a flight
- **GIVEN** the ship is flying into the core of a mass in reach
- **WHEN** the core warns
- **THEN** GRAB flashes in orange, and a press now catches at depth 0.6 instead of burning

### Requirement: Release and the preview line
On a lift the ship SHALL fly along the tangent. The release SHALL be graded toward the best mass ahead by the worse of two numbers: the angle to its band (PERFECT up to 8°, GOOD 16°, WIDE 30°) and how far the line misses the band (0.6, 1.0 and 1.4 R; misses toward the core count 2.5 times). A line inside 0.45 R of a centre SHALL be WIDE at best, and a line into any core MISS. While held a 2 px white line SHALL run 70 u ahead; `?cue=1` SHALL colour it by grade.

#### Scenario: A perfect fling
- **GIVEN** the preview line crosses the next ring's orange band
- **WHEN** the player lifts
- **THEN** PERFECT shows, a chime one step above the last plays, the game holds for 80 ms and then runs at half speed for 0.3 s
- **AND** the camera kicks forward with +8° of FOV and a whoosh plays

#### Scenario: Too close to a core
- **WHEN** the player lets go on a line that passes 0.4 R from the next mass's centre
- **THEN** WIDE shows in grey and the chain breaks, even if the angle was perfect

#### Scenario: Into a core
- **GIVEN** the preview line runs into a core
- **WHEN** the player lets go
- **THEN** that core showed red while the line pointed at it, and MISS shows with INTO A CORE

### Requirement: The approach ring and LET GO
While held, an orange approach ring SHALL close on the spot where the line will cross the next band, starting 0.75 s ahead and meeting it at the window's best moment, with a bigger mark for a deeper window. A window whose best moment comes in the first 0.3 s of a hold SHALL get no ring. The line SHALL brighten over the 0.3 s before a window. On a first run, until 3 clean releases, LET GO SHALL show 0.25 s before each window's best moment, never in the first 0.4 s of a hold.

#### Scenario: The ring closes on the moment
- **GIVEN** the ship is held and a window is 0.75 s away
- **WHEN** the player watches the next ring
- **THEN** an orange ring shrinks onto a mark in the band and meets it at the best moment to let go

#### Scenario: Let go on the cue
- **GIVEN** a first run, held on mass 1
- **WHEN** LET GO shows and the player lifts 200 to 300 ms later
- **THEN** the release grades GOOD or PERFECT

#### Scenario: The first swing is gentle
- **GIVEN** a first run
- **WHEN** the player grabs mass 1
- **THEN** the line sweeps at half speed until the first clean release, and the first two clean releases are judged on windows 1.5 times wider

### Requirement: Speed gain and the nines
A release SHALL add (0.05 + 0.45 × max(d, 0)²) × mass × aim × chain to η, with mass 0.8 to 2.0, aim 1.6, 0.8, 0.4 or 0, and chain 1 + 0.06 per link up to +60 %. A clean release SHALL add one link, and a skip two. η SHALL stay between 1.0 and 5.25. The first time in a run that β crosses 0.9, 0.99, 0.999 and 0.9999 the new speed SHALL show in large digits under the HUD speed, the new 9 in orange, with a radial flash, a chord a tone higher and a squeeze of the sky.

#### Scenario: A deep perfect pays
- **GIVEN** no chain and no skip
- **WHEN** the player releases from depth 0.8 off a medium mass with a PERFECT
- **THEN** η rises by about 0.54

#### Scenario: First nine-up
- **WHEN** η first crosses 1.472
- **THEN** 0.9000c shows large under the speed with the 9 in orange, a ring flashes outward and a chord plays a tone higher

#### Scenario: Losing and regaining a nine
- **GIVEN** the run has reached 0.9c
- **WHEN** an early press drops the speed below 0.9c and a later release climbs back
- **THEN** the drop flashes the speed red with a falling tick and the key steps down, and the climb back flashes it orange with a small rising tick and a small ring, with no big digits

#### Scenario: A skip counts two
- **GIVEN** an approach ring marked SKIP +2
- **WHEN** the player lets go on it with a GOOD or PERFECT
- **THEN** the ship flies past the next mass to the one after, and the chain rises by 2

### Requirement: Light speed
At η 4.952 B SHALL enter LIGHT SPEED: a 150 ms freeze, a 0.2 s white-out, the sky squeezing over about half a second into one point with lines rushing in and a deep red ring behind, the clock in orange, a sub swell, the caption LIGHT SPEED, an 80° view and flights 1.4 times faster. For 1.6 s the camera SHALL turn to face the heading and dip, then ease back to north-up. Clean releases SHALL keep it; a WIDE, MISS, burn or lost SHALL drop η to 3.8.

#### Scenario: Arriving at light speed
- **GIVEN** the ship is heading 40° off north
- **WHEN** a release takes it to LIGHT SPEED
- **THEN** within about half a second the camera has turned so the fold point is near the middle of the screen, and after about 1.6 s it eases back until the course's north is at the top

#### Scenario: Dropping out
- **GIVEN** the ship is at LIGHT SPEED
- **WHEN** the player releases WIDE
- **THEN** η drops to 3.8, the sky unfolds, the edges flash red, and a falling whoosh plays

### Requirement: Camera that keeps north up
The camera SHALL keep the course's north at the top. In flight it SHALL sit 24 u back at a pitch of 30° in portrait and 22° elsewhere, looking 10 u ahead along the heading. While held it SHALL rise to 48° (34°) and 30 u and look at the anchor, easing over 0.3 s. The FOV SHALL be 62° across the short side, 80° at LIGHT SPEED, with +8° on each release. Only LIGHT SPEED SHALL turn it, and only for a moment. `?cam=chart` or C SHALL give a fixed top-down view.

#### Scenario: The world does not spin
- **GIVEN** the ship orbits a mass for a full lap
- **WHEN** a screenshot is taken each quarter lap
- **THEN** the course's north stays at the top of the screen in every one

#### Scenario: Flying back down the course
- **GIVEN** the ship is flying south toward a mass 18 u ahead
- **WHEN** a screenshot is taken in portrait or landscape
- **THEN** that mass is on screen

### Requirement: Burn, lost and rewind
Reaching a core SHALL be a BURN. A line that can reach no mass within 5 s of flight SHALL be LOST after 0.6 s, and any flight with nothing in reach is LOST at 5 s; a line still heading for a mass SHALL never be lost early. Both SHALL rewind 0.9 s to 0.5 s before the last grab, with η 0.3 lower (at least 1.0) and no chain. Input SHALL be back 1.3 s after the fail. The clock SHALL never rewind. After 2 fails on one mass its swings SHALL get a ghost line, 1.5× windows and a 0.6× reel.

#### Scenario: Burn and straight back in
- **WHEN** the ship burns in a core with η 2.0
- **THEN** a white-hot flash, 12 px of shake and a crackle play, the trail runs backward for 0.9 s, and the ship is back on its approach at η 1.7, taking input 1.3 s after the burn
- **AND** for its first 3 s the retry line passes no core closer than 0.45 R

#### Scenario: The clock keeps the cost
- **GIVEN** the clock reads +1.40 YR at a burn
- **WHEN** the rewind ends
- **THEN** the clock reads more than +1.40 YR

#### Scenario: A line to nowhere is lost fast
- **GIVEN** the ship flies on a line that crosses no reach circle
- **WHEN** 0.6 s pass
- **THEN** the screen edges close in, the drone thins and LOST shows

#### Scenario: A long line is not lost
- **GIVEN** the ship flies on a line toward a mass more than 3 s away
- **WHEN** it flies with nothing in reach
- **THEN** it is not lost before it reaches that mass

### Requirement: Score is your clock
The clock SHALL start at the first fling and run at 0.162 / η^1.75 years per real second, a stylised form of time dilation that keeps the second half of the stage worth playing. The score SHALL be the years aged to Coma, lower being better. Ranks SHALL be Lightkeeper up to 1.2 years, Navigator up to 2.5, Wayfinder up to 5 and Drifter above. There SHALL be no game over: the stage ends when the player lets go of Coma.

#### Scenario: Faster keeps you younger
- **WHEN** the ship flies at η 4 instead of η 1
- **THEN** the clock runs about 11 times slower

#### Scenario: Home card
- **WHEN** the player lets go of Coma
- **THEN** the vista plays and a card shows "THE WEB · +2.40 YR · NAVIGATOR · VIRGO NEXT"
- **AND** the result card shows rank, clock, best, top speed, PERFECT %, best chain, burns, losts, time and branch, and "Early grabs cost you +0.40 yr" when early presses cost 0.05 years or more

### Requirement: Fly again
R SHALL restart the stage at any time. On the result card AGAIN, Space, Enter or a tap on the background SHALL fly again, back in play within 1.5 s, and Copy log SHALL copy the runs. After the first time home a tap SHALL skip the vista. The mass-1 tutorial SHALL be skipped once this device has a run with 3 or more releases, or this session has 3 clean releases.

#### Scenario: Tap anywhere to fly again
- **GIVEN** the result card shows
- **WHEN** the player taps its background or presses Space
- **THEN** the ship is back in play within 1.5 s

#### Scenario: Skip the vista
- **GIVEN** the player has been home before
- **WHEN** they tap during the vista
- **THEN** the result card shows at once

#### Scenario: No tutorial for a practised player
- **GIVEN** this device has a saved run with 3 or more releases
- **WHEN** a new run starts
- **THEN** the world does not slow at mass 1, HOLD and LET GO do not show, and the first swing runs at full speed

### Requirement: Stage one, the web to Coma
B SHALL play one hand-placed course of 23 masses from (0, 0) to Coma at (0, 390): a teaching run, a zigzag, a knot, a rescue mass, a void jump, a fork with an avenue of six small masses on the left and two large on the right, Coma's outskirts where its ring and label draw on, and Coma as a landmark judged toward a faint Virgo ring. Rings far up the course SHALL fade so the next few read. `?toy=1` SHALL give an endless strip of random masses with no clock.

#### Scenario: The first minute
- **GIVEN** a first-time player in portrait who follows the cues 200 to 300 ms late
- **WHEN** they play for a minute
- **THEN** they grab mass 1 by 2 s, fling GOOD or PERFECT on LET GO by 5 s, usually reach 0.9c by 10 s, and get past the void jump and the fork within the minute

#### Scenario: Coma vista
- **WHEN** the player lets go of Coma
- **THEN** play freezes for 0.15 s, the sky punches to one point for about a second and whites out, the card shows at 1.15 s and the result card at 2.65 s

#### Scenario: Toy mode
- **GIVEN** the URL has `?toy=1`
- **WHEN** the player flies for 10 minutes
- **THEN** masses keep coming, a burn flings the ship out with no rewind, the clock is hidden, and the game runs as fast as in the first minute

### Requirement: Feedback every time
Every grab, release, grade, nine-up, warning, burn, lost, drop-out and LIGHT SPEED SHALL play its sound and visual the moment it happens; no sound SHALL wait for a beat. The drone SHALL be in D minor, rising a whole tone at each nine and stepping down when a press costs one. Where `navigator.vibrate` exists these SHALL buzz. With reduced motion there SHALL be no shake, FOV kick or LIGHT SPEED turn, and flashes SHALL be softer.

#### Scenario: Grab feel
- **WHEN** the player presses near a mass
- **THEN** the tether draws within 60 ms, the ring clicks bright, a pluck pitched by mass size plays, and the camera starts to rise

#### Scenario: Reduced motion
- **GIVEN** the system asks for reduced motion
- **WHEN** the ship burns
- **THEN** the screen does not shake and the flash is softer

### Requirement: Layouts
Speed SHALL show at the top left with all its nines and the chain under it, the clock at the top right, and nine-up digits just under the speed. Callouts SHALL sit 74 % down in portrait and high in the middle between speed and clock in landscape and on desktop, away from the ring being aimed at, and a grab SHALL clear any callout. The page SHALL not scroll, and HUD items SHALL stay inside the safe area.

#### Scenario: Three screens
- **GIVEN** play at 390×844, 844×390 and 1440×900
- **WHEN** a screenshot is taken during a hold
- **THEN** the anchor mass and the next ring are on screen, no HUD item or callout covers the next ring, no HUD item overlaps another, and the pause button is at least 44 px

### Requirement: Tuning, telemetry and the test hook
Every TUNE key SHALL be settable from the URL, ignoring case, along with `seed`, `debug`, `toy`, `bot`, `cue`, `cam` and `tap`. The last 20 runs SHALL be kept in `localStorage` under `lyh-lab-b-runs`, read and written inside try/catch. The page SHALL expose `window.__lab` with `id: 'b'`, `tune`, `state()`, `events(n)`, `runs()`, `restart(seed)`, `advance(seconds, input)`, `bot(name, opts)`, `input({ down })`, `timing()`, `preview()`, `windows()`, `freeze(on)`, `pause()` and `resume()`.

#### Scenario: Headless advance
- **WHEN** a test calls `__lab.advance(5, { down: false })`
- **THEN** the simulation runs 600 steps of 1/120 s and returns their events

#### Scenario: Same seed, same run
- **WHEN** two runs use the same seed and the same inputs
- **THEN** they give the same events and the same clock

### Requirement: Skill spread
The tuning SHALL give a real spread between bots on seeds 1 to 5: `exact` clears in 40 to 65 s with at most 1 rewind, reaches LIGHT SPEED before mass 12 and ends at 1.2 years or less; `greedy` with 60 ms jitter clears with at most 4 rewinds at a median 1.5 to 3 years; `first` with 110 ms jitter clears within 120 s with at most 8 rewinds, at 4 years or more and without LIGHT SPEED; and the `exact` clock is at most a third of the `first` clock.

#### Scenario: Bots in node
- **WHEN** `node qa/light-years-home/lab-b.test.mjs` runs
- **THEN** every bot check passes, pressing at closest approach gains at least 25 % more η, every burn was warned at least 0.45 s ahead, and 10,000 steps of random presses and random dt give no NaN and no error
