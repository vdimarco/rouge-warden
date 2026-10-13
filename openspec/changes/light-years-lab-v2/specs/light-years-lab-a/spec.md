## ADDED Requirements

### Requirement: Lab chooser button for A
The lab chooser at `/light-years-home/lab/` SHALL be a silent black page in the video's look with a thin-ring button "A · LIGHT YEARS AHEAD · steer and skim" and one plain line under it. The button SHALL open `/light-years-home/lab/a/`. The chooser and A SHALL carry `noindex`, load `/arcade/quiet.js` as their first script, and offer a way back to the arcade.

#### Scenario: Open A from the chooser
- **GIVEN** the chooser at 390×844, 844×390 or 1440×900
- **WHEN** the player taps or clicks the A button, or presses A or 1 on a keyboard
- **THEN** `/light-years-home/lab/a/` opens

#### Scenario: Chooser stays quiet and fits
- **GIVEN** the chooser at 390×844, 844×390 or 1440×900
- **WHEN** it has loaded
- **THEN** it has made no AudioContext, every button and link is at least 44 px tall, and the page does not scroll sideways
- **AND** it shows a back link to the arcade and a Switch game button

#### Scenario: Keys wait for the switcher
- **GIVEN** the game switcher is open over the chooser
- **WHEN** the player presses A or 1
- **THEN** the chooser stays where it is

### Requirement: Start with the ship moving
The title SHALL show the name and "TAP TO FLY" on touch screens or "CLICK OR PRESS SPACE" on desktop. That tap or key SHALL start play with the ship already moving, create the AudioContext, and set `navigator.audioSession.type` to `playback` where it exists. The first scripted hazard SHALL pass before 3.5 s, with its tick lit at least 1.2 s before it passes.

#### Scenario: First input within 3 seconds
- **GIVEN** a first run in portrait
- **WHEN** the player taps the title
- **THEN** the ring draws itself, the drone fades in and DRAG TO STEER shows within 0.3 s
- **AND** a knot on the ship's line lights its tick at about 1.9 s and passes at beat 6, before 3.5 s

### Requirement: Steering on every device
A SHALL steer the ship round the ring with one continuous input. On phones it SHALL be a relative horizontal drag at 0.9° of ring per px, in portrait below the ring's centre line and in landscape anywhere. On desktop it SHALL be ← → or A D at 330°/s with a 60 ms ramp, with mouse aim as an option. The ship SHALL chase its target at no more than 600°/s. Input SHALL be ignored while the game switcher is open.

#### Scenario: Drag on a phone
- **GIVEN** play in portrait at 390×844
- **WHEN** the player drags 50 px to the right below the ring's centre
- **THEN** the ship's bearing moves 45° to the right within 0.1 s

#### Scenario: Re-grip keeps the line
- **GIVEN** the ship is steady at some bearing
- **WHEN** the player lifts the thumb and presses somewhere else
- **THEN** the ship does not move until the thumb drags

#### Scenario: Keys on desktop
- **GIVEN** play at 1440×900
- **WHEN** the player holds the right arrow or D
- **THEN** the ship turns right, reaching 330°/s after 60 ms

#### Scenario: Mouse aim on desktop
- **GIVEN** play at 1440×900
- **WHEN** the player moves the mouse
- **THEN** the fixed camera is selected and the ship heads for the bearing under the pointer

#### Scenario: Halves option
- **GIVEN** the URL has `?scheme=halves`
- **WHEN** the player holds the left half of the screen
- **THEN** the ship turns anticlockwise at 330°/s until the thumb lifts

### Requirement: Pause, retry and mute
A SHALL have a 44 px pause button at the top right on every layout. On desktop Esc or P SHALL pause, Enter, Space or R SHALL retry from a result card, and M SHALL mute. The game SHALL pause when the page is hidden.

#### Scenario: Hidden page pauses
- **GIVEN** play is running
- **WHEN** the page is hidden and shown again
- **THEN** the simulation time did not advance while it was hidden and the game shows as paused

### Requirement: The ring and the light-speed feel
Hazards SHALL be drawn with Penrose's stereographic aberration, so everything beside the ship lands on the ring. As speed η rises, the ring SHALL shrink from 42 % of the short side to a floor of 30 % (at least 112 px), the beat SHALL rise from 112 bpm, and the sky SHALL squeeze ahead and turn blue at the true speed, capped at φ 3.0.

#### Scenario: Faster is tighter
- **GIVEN** play in portrait at 390×844
- **WHEN** η goes from 1.0 to 2.6
- **THEN** the ring radius shrinks from about 164 px to about 117 px, the beat rises from 112 to about 157 bpm, and the sky's now-circle shrinks from about 164 px to about 29 px

#### Scenario: Hits happen on the ring
- **WHEN** a hazard's depth crosses zero
- **THEN** its drawn position is on the ring at its bearing

### Requirement: Reading aids
1.3 s before a hazard passes, an arc SHALL light on the ring at its bearing and width; a wall SHALL light all but its gap. From 1.2 s out each hazard inside the ring SHALL get a thin hit outline. A tick SHALL turn orange when the current bearing would graze it. When the current bearing would hit within 0.9 s, the chevron SHALL flash red and a lane alarm SHALL sound.

#### Scenario: Warned before a hit
- **GIVEN** the ship holds a bearing that will hit a hazard
- **WHEN** the hit comes
- **THEN** an alarm event fired at least 0.3 s earlier, with a red chevron and a rising tone

### Requirement: Grazes, gears and the chain
A pass SHALL be a hit when the edge gap is under 0°, a hairline under 2.5° and a graze under 7°. A graze SHALL add 0.06 η, a hairline 0.12, a rail skim 0.04 a second and a gate thread 0.25 (Coma's 0.8). Above η 1.0 drag SHALL take 0.03 a second; below it the engine SHALL add 0.08 a second, up to a cap of 3.0. Each 0.4 of η above 1.0 SHALL be a gear. A chain SHALL count grazes in a row and break on a hit or 3.0 s without a graze.

#### Scenario: A graze pays and is felt
- **WHEN** a hazard passes 5° from the ship's edge
- **THEN** η rises by 0.06, the chain rises by 1, a zip with falling pitch pans to the hazard's side, a white streak runs along the ring, the ring cinches 2 px, and the points show in small white

#### Scenario: A hairline stops time
- **WHEN** a hazard passes 1.5° from the ship's edge
- **THEN** η rises by 0.12, the game holds still for 60 ms, and HAIRLINE shows in caption style

#### Scenario: A gear up is heard
- **WHEN** η crosses 1.4
- **THEN** on the next downbeat the key rises a whole tone and hats join the music

### Requirement: Headlight
At η 2.6 or more, or when the player threads Coma's gate, A SHALL enter the Headlight: 0.4 s of slow motion at 0.35×, the ring snapping to 26 % and easing back over 1 s, the sky at φ 4.0 for 1 s with a blue-white eye, a bass drop, the caption HEADLIGHT, and points ×2. It SHALL end on a hit or a chain timeout, with η dropping to at most 2.3.

#### Scenario: Threading Coma's gate
- **GIVEN** the ship is lined up with the 30° gap between NGC 4889 and NGC 4874 at beat 98
- **WHEN** the gate passes
- **THEN** THREAD shows, η rises by 0.8, and the Headlight starts with slow motion and a white flash from the centre

### Requirement: Hits
After the first 10 s a hit SHALL cost one gear (η −0.4, never below 0.6), break the chain, end the Headlight, take 0.8 s of lead, and make the ship flicker for 1.0 s, during which nothing else can hit it. In the first 10 s a hit SHALL only push the ship 10° aside with a bump sound, at no cost.

#### Scenario: A hit after the soft start
- **GIVEN** 20 s into the stage at η 1.8 with a chain of 6
- **WHEN** the ship hits a knot
- **THEN** play freezes for 120 ms, the edge tints red, the screen shakes 6 px, η drops to 1.4, the chain breaks into falling red digits, a thud plays and the music tape-stops a layer down

#### Scenario: A hit during the soft start
- **GIVEN** 5 s into the stage
- **WHEN** the ship hits a knot
- **THEN** it is pushed 10° aside with a boing, and η, chain and lead do not change

### Requirement: The burst and retry
A burst's light SHALL chase the ship. The lead SHALL start at 9 s and fall by 0.4 × (1 − β) each second. Under 3 s a white glow SHALL grow from the screen rim, a heartbeat SHALL speed up and "LEAD 2.4 S" SHALL show. At 0 the player is CAUGHT: white floods in over 0.5 s and a card shows how far they got and their best. A tap SHALL restart the stage at η 1.0 with steering back within 1.2 s.

#### Scenario: Caught and straight back in
- **GIVEN** the lead reaches 0 at 81 % of the stage
- **WHEN** the card shows "CAUGHT AT 81 % · BEST 92 %"
- **THEN** input is ignored for 0.4 s, and a tap after that has the ship steerable within 1.2 s

#### Scenario: Help after two catches
- **GIVEN** the player was caught twice in a row
- **WHEN** the next try starts
- **THEN** it starts with 2 s more lead and shows "+2 S HEAD START"

### Requirement: Score and rank
Points SHALL be multiplied by γ: a graze 10 × (1 + chain / 10) with the chain counted up to 40, a hairline 3 grazes, a skim 30 a second, a thread 250, and 100 for each second of lead at the clear, all ×2 in the Headlight. The rank SHALL be a spectral class O, B, A, F, G, K or M by share of par, the graze bot's score on the same seed, coloured by its blackbody colour.

#### Scenario: Clear the stage
- **WHEN** the player passes beat 128
- **THEN** a card shows the rank letter in its colour, score, best, lead left, grazes, hairlines, hits and Headlight seconds, counting up over 0.8 s
- **AND** it offers AGAIN (same seed, back in play within 1.5 s), NEW SKY and Copy log

#### Scenario: Sun class
- **WHEN** a run scores 5 % of par
- **THEN** its rank is G with the line LIKE THE SUN

### Requirement: Stage one, the web to Coma
A SHALL play one stage of 128 beats written in beats, with course speed tied to tempo, so every scripted hazard passes on its beat at any speed. In order it SHALL teach single knots, pairs, walls with gaps, bait knots, a rail, the long way round, a breather where Coma's ring and label draw on, a seeded swarm, Coma's gate, silhouettes in the glare, and Coma passing in slow motion.

#### Scenario: Passes land on the beat
- **WHEN** any scripted hazard passes
- **THEN** its pass time is within 0.01 beats of its slot

#### Scenario: The first minute
- **GIVEN** a first-time player in portrait who steers toward things
- **WHEN** they play for a minute
- **THEN** they hear zips from 2 to 10 s, meet walls and bait from 10 to 30 s, the rail by about 30 s, see Coma labelled by about 34 s, ride the swarm, and thread the gate into HEADLIGHT at about 53 s

#### Scenario: Toy mode
- **GIVEN** the URL has `?toy=1`
- **WHEN** the player plays for 5 minutes
- **THEN** hazards keep coming, the lead never runs out and the stage never ends

### Requirement: Feedback every time
Every graze, hairline, hit, gear change, thread, Headlight, warning and catch SHALL play its sound and show its visual on the frame it happens. The music SHALL follow the simulation's beat clock in D minor, lifting a whole tone and adding a layer per gear. Where `navigator.vibrate` exists each of these SHALL buzz. With reduced motion there SHALL be no shake or FOV kick, softer flashes, and the fixed camera.

#### Scenario: Sound follows the game clock
- **WHEN** the game runs in slow motion
- **THEN** the beat voices slow with it, because each plays on the frame its beat crosses

#### Scenario: Reduced motion
- **GIVEN** the system asks for reduced motion
- **WHEN** the ship hits a knot
- **THEN** the screen does not shake, the flash is softer, and the world does not roll

### Requirement: Layouts
The ring centre SHALL sit 40 % down in portrait, 46 % in landscape and 48 % on desktop. Speed SHALL show at the top left, score at the top right, γ under the ring, the chain above the ship, and callouts inside the ring's upper part. The page SHALL not scroll, and HUD items SHALL stay inside the safe area.

#### Scenario: Three screens
- **GIVEN** play at 390×844, 844×390 and 1440×900
- **WHEN** a screenshot is taken mid-stage
- **THEN** the whole ring is on screen, no HUD item overlaps another or the ring, and the pause button is at least 44 px

### Requirement: Tuning, telemetry and the test hook
Every TUNE key SHALL be settable from the URL, ignoring case, along with `seed`, `debug`, `toy` and `bot`. The last 20 runs SHALL be kept in `localStorage` under `lyh-lab-a-runs`, read and written inside try/catch. The page SHALL expose `window.__lab` with `id: 'a'`, `version`, `tune`, `state()`, `events(n)`, `runs()`, `restart(seed)`, `advance(seconds, input)`, `bot(name, opts)`, `input(inp)` and `timing()`.

#### Scenario: Headless advance
- **GIVEN** the page is loaded with `?seed=3`
- **WHEN** a test calls `__lab.advance(10, { aim: null, turn: 0 })`
- **THEN** the simulation runs 1,200 steps of 1/120 s and returns their events

#### Scenario: Same seed, same run
- **WHEN** two runs use the same seed and the same inputs
- **THEN** they give the same events and the same score

#### Scenario: Blocked storage
- **GIVEN** `localStorage` throws
- **WHEN** a run ends
- **THEN** the result card still shows and Copy log still works

### Requirement: Skill spread
The tuning SHALL give a real spread between bots on seeds 1 to 5: `idle` is caught before beat 90; `dodge` clears with under 3.5 s of lead and under 25 % of par; `graze` clears with over 6 s of lead, reaches the Headlight and scores at least 20 times `idle`; a novice `human` bot is caught or clears with under 2.5 s on at least 3 seeds; a mid `human` bot clears on at least 4 with 2 to 6 s left.

#### Scenario: Bots in node
- **WHEN** `node qa/light-years-home/lab-a.test.mjs` runs
- **THEN** every bot check passes and 10,000 steps of random input and random dt give no NaN and no error
