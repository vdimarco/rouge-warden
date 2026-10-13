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
The title SHALL show the name and "TAP TO FLY" on touch screens or "CLICK OR PRESS SPACE" on desktop. That tap or key SHALL start play with the ship already moving, create the AudioContext, and set `navigator.audioSession.type` to `playback` where it exists. The tap SHALL also grip, so a drag steers at once. The first scripted hazard SHALL pass before 3.5 s, with its tick lit at least 1.2 s before it passes.

#### Scenario: First input within 3 seconds
- **GIVEN** a first run in portrait
- **WHEN** the player taps the title and keeps the thumb down
- **THEN** the ring draws itself, the drone fades in and DRAG TO STEER shows within 0.3 s, and dragging that thumb already steers
- **AND** a knot on the ship's line lights its tick at about 1.9 s, turns it red from 0.9 s out, and passes at beat 6, at about 3.2 s

### Requirement: Steering on every device
A SHALL steer the ship round the ring with one continuous input. On phones it SHALL be a relative horizontal drag anywhere on the play area, at 0.6° of ring per px for slow drags, rising to 1.4° per px for flicks of 1,200 px/s or more. The most recent finger down SHALL steer. On desktop it SHALL be ← → or A D at 330°/s, ramping up over 60 ms and stopping at once. The ship SHALL chase its target at no more than 600°/s. Input SHALL be ignored while the game switcher is open.

#### Scenario: A slow drag is fine, a flick swings far
- **GIVEN** play in portrait at 390×844
- **WHEN** the player drags 50 px to the right slowly
- **THEN** the ship's bearing moves about 30° to the right within 0.1 s
- **AND** a 100 px flick at over 1,200 px/s moves it about 140°

#### Scenario: Re-grip keeps the line
- **GIVEN** the ship is steady at some bearing
- **WHEN** the player lifts the thumb and presses somewhere else
- **THEN** the ship does not move until the thumb drags

#### Scenario: The newest finger steers
- **GIVEN** one thumb rests on the screen
- **WHEN** a second thumb drags to the right
- **THEN** the ship turns as far as it would for the same drag with one thumb, and small moves of the resting thumb add nothing
- **AND** when the second thumb lifts, the first one steers from where it is

#### Scenario: Keys on desktop
- **GIVEN** play at 1440×900
- **WHEN** the player taps the right arrow for 40 ms
- **THEN** the ship turns right by about 6°, and holding the key turns it at up to 330°/s

### Requirement: One steering scheme and camera a run
The first deliberate input of a run SHALL pick its scheme (drag, keys, halves or mouse aim) and its camera. Nothing SHALL change the camera mid-run, and the camera SHALL roll at no more than 280°/s, never in one jump. Mouse aim SHALL take over only on a sweep of 120 px within 0.5 s, never over a button and never within 1.5 s of a key, and it SHALL pick the fixed camera. Reduced motion or `?cam=fixed` SHALL pick the fixed camera on every device.

#### Scenario: Reaching for pause does not steer
- **GIVEN** a desktop player steering with the keys
- **WHEN** they move the mouse to the pause button
- **THEN** the ship keeps its bearing and the camera does not move

#### Scenario: Mouse aim on desktop
- **GIVEN** a new run at 1440×900 with no key pressed for 1.5 s
- **WHEN** the player sweeps the mouse 120 px within half a second
- **THEN** the fixed camera is selected and the ship heads for the bearing under the pointer
- **AND** on the first two runs POINT TO STEER shows

#### Scenario: Fixed camera on a phone
- **GIVEN** a phone that asks for reduced motion, or the URL has `?cam=fixed`
- **WHEN** the player makes six 120 px drags to the right
- **THEN** the ship keeps moving the same way round the ring, past 3 o'clock, and never stalls at the side

#### Scenario: Halves option
- **GIVEN** the URL has `?scheme=halves`
- **WHEN** the player holds the left half of the screen
- **THEN** the ship turns left at 330°/s until the thumb lifts

### Requirement: Pause and mute
A SHALL have a 44 px pause button at the top right on every layout. On desktop Esc or P SHALL pause and M SHALL mute. The pause card SHALL offer RESUME, RESTART, sound and Copy log. Play SHALL go on with 0.6 s of slow motion. The game SHALL pause when the page is hidden.

#### Scenario: Hidden page pauses
- **GIVEN** play is running
- **WHEN** the page is hidden and shown again
- **THEN** the simulation time did not advance while it was hidden and the game shows as paused

#### Scenario: Resume is gentle
- **GIVEN** the game is paused with a knot 0.2 s from the ship
- **WHEN** the player taps RESUME
- **THEN** the course runs at 0.35× for 0.6 s while the ship steers at full speed, so the player can still get clear

### Requirement: The ring and the light-speed feel
Hazards SHALL be drawn with Penrose's stereographic aberration, so everything beside the ship lands on the ring. As speed η rises, the ring SHALL shrink from 42 % of the short side to a floor of 30 % (at least 112 px), the beat SHALL rise from 112 bpm, and the sky SHALL squeeze ahead and turn blue at the true speed, capped at φ 3.0. Light behind and beside the ship SHALL redden but stay visible, and a red rim SHALL glow from gear 3.

#### Scenario: Faster is tighter
- **GIVEN** play in portrait at 390×844
- **WHEN** η goes from 1.0 to 2.6
- **THEN** the ring radius shrinks from about 164 px to about 117 px, the beat rises from 112 to about 157 bpm, and the sky's now-circle shrinks from about 164 px to about 29 px

#### Scenario: Hits happen on the ring
- **WHEN** a hazard's depth crosses zero
- **THEN** its drawn position is on the ring at its bearing

#### Scenario: Hazards come out of the glare
- **GIVEN** the course from beat 56 to the end of the glare slalom, with Coma's bright core dead ahead
- **WHEN** a knot appears in the centre
- **THEN** a dark disc behind the hazards dims the glare there, so the knot reads as soon as it shows
- **AND** the disc lifts for the Headlight's punch

### Requirement: Reading aids
1.3 s before a hazard passes, an arc SHALL light on the ring at its bearing and width; a wall SHALL light all but its gap, and the gap SHALL show faintly from 3 s out. From 1.2 s out each hazard inside the ring SHALL get a thin outline over a dark edge. A tick SHALL turn orange when the current bearing would graze it, and gold and thicker in the hairline band. Within 0.9 s of a hit on the current bearing, the tick, a mark just inside the ring and the chevron SHALL turn red.

#### Scenario: Warned before a hit
- **GIVEN** the ship holds a bearing that will hit a hazard
- **WHEN** the hit comes
- **THEN** the alarm fired at least 0.3 s earlier, with a red tick, a red mark just inside the ring and a flashing red chevron

#### Scenario: The whine says when you are clear
- **GIVEN** both the ship's bearing and the line it is steering to would hit a hazard within 0.6 s
- **WHEN** the player steers to a clear line
- **THEN** a whine that rose in pitch, panned toward the way out, falls away and stops at once

#### Scenario: The hairline band shows
- **WHEN** the current bearing would pass a hazard less than 2.5° from its edge
- **THEN** its tick is gold and thicker than a graze tick

### Requirement: Grazes, gears and the chain
A pass SHALL be a hit when the edge gap is under 0°, a hairline under 2.5° and a graze under 7° (12° in the first 19 beats). A graze SHALL add 0.06 η, a hairline 0.12, a rail skim 0.04 a second and a gate thread 0.25 (Coma's 0.8). Above η 1.0 drag SHALL take 0.03 a second; below it the engine SHALL add 0.08 a second, up to 3.0. Each 0.4 of η above 1.0 SHALL be a gear. A chain SHALL count grazes and threads in a row, show its time left, and break on a hit or 3.0 s without one.

#### Scenario: A graze pays and is felt
- **WHEN** a hazard passes 5° from the ship's edge
- **THEN** η rises by 0.06, the chain rises by 1, a zip with falling pitch pans to the hazard's side, a white streak runs along the ring, the ring cinches in, and the points show in small white

#### Scenario: A hairline keeps the beat
- **WHEN** a hazard passes 1.5° from the ship's edge
- **THEN** η rises by 0.12, a ripple runs out from the ring, a sparkle plays an octave up and the points show in orange
- **AND** the course and the music do not stop

#### Scenario: A gear up is heard
- **WHEN** η crosses 1.4
- **THEN** a rising sweep plays, a blue ring closes in, and from the next sixteenth the key is a whole tone up and hats join the music

#### Scenario: The chain runs out
- **GIVEN** a chain of 12
- **WHEN** 3 s pass with no graze
- **THEN** the bar under the number empties, flashing orange in its last third, and the chain ends with two falling plucks and grey digits falling away

### Requirement: Headlight
At η 2.6 or more, or when the player threads Coma's gate, A SHALL enter the Headlight: slow motion at 0.35× for 0.4 s (0.6 s at Coma), the ring snapping to 26 % and easing back over 1 s, the sky at φ 4.0 for 1 s with a blue-white eye, a white flash, a bass drop, the caption HEADLIGHT, an orange speed readout and points ×2. It SHALL end on a hit or a chain timeout, with η dropping to at most 2.3.

#### Scenario: Threading Coma's gate at any speed
- **GIVEN** the ship arrives at η 1.0 lined up with the 30° gap between NGC 4889 and NGC 4874 at beat 98
- **WHEN** the gate passes
- **THEN** in the same step η rises to at least 2.7 and the Headlight starts, with HEADLIGHT, 0.6 s of slow motion, the white flash, and Coma's ring and label turning orange

#### Scenario: Coma when the Headlight is already on
- **GIVEN** the ship is already in the Headlight
- **WHEN** it threads Coma's gate
- **THEN** the peak fires again: THROUGH COMA, 0.6 s of slow motion, the ring and sky punch and the flash

#### Scenario: The Headlight runs out
- **GIVEN** the ship is in the Headlight
- **WHEN** the chain times out
- **THEN** η drops to 2.3 or less, CHAIN LOST shows, a falling sweep plays and a blue ring runs outward

### Requirement: Hits
After the first 19 beats (about 10 s) a hit SHALL cost one gear (η −0.4, never below 0.6) and 1.5 s of lead, break the chain, end the Headlight, freeze play for 120 ms, and make the ship flicker for 1.0 s, during which nothing else can hit it. In the first 19 beats a hit SHALL only push the ship 10° aside with a bump sound, at no cost.

#### Scenario: A hit after the soft start
- **GIVEN** 20 s into the stage at η 1.8 with a chain of 6
- **WHEN** the ship hits a knot
- **THEN** play freezes for 120 ms, the edge tints red, the screen shakes 6 px, η drops to 1.4, the lead drops 1.5 s, the chain breaks into falling red digits, a thud plays and the music tape-stops

#### Scenario: A hit during the soft start
- **GIVEN** 5 s into the stage
- **WHEN** the ship hits a knot
- **THEN** it is pushed 10° aside with a boing, and η, chain and lead do not change

### Requirement: The burst
A gamma-ray burst's light SHALL chase the ship, drawn as a white ring outside the play ring whose distance is the lead. The lead SHALL start at 8 s and fall by 0.8 × (1 − β) a second. A graze SHALL win back 0.12 s, a hairline 0.25, a thread 0.5 and a skim 0.2 a second, up to 9 s; a hit SHALL cost 1.5 s. The warning SHALL come only when the light would catch the ship within 5 s or one more hit would, and SHALL end once the danger is well past.

#### Scenario: The burst arrives
- **GIVEN** a first run
- **WHEN** beat 16.5 passes
- **THEN** a rumble rises, A GAMMA-RAY BURST IS CHASING YOU shows, and the burst's ring closes in from the screen edge to its place over 1.2 s

#### Scenario: Grazes push it back
- **WHEN** the ship grazes a knot
- **THEN** the lead grows by 0.12 s, the burst's ring moves outward, and a thin blue ring kicks out from its front

#### Scenario: The warning means danger
- **GIVEN** the ship is in the Headlight at η 2.8 with 2 s of lead
- **WHEN** 2 s pass
- **THEN** no warning plays, because the light gains less than 0.01 s a second
- **AND** at η 1.0 with 1.5 s of lead the warning starts at once: a low swell, a heartbeat that speeds up from 60 to 140 bpm, the ring pulsing and LEAD 1.5 S blinking under the ring

### Requirement: Caught and retry
At lead 0 the player SHALL be CAUGHT: white floods in over 0.5 s and a card shows THE BURST CAUGHT YOU, how far they got, their best and one hint. Input SHALL be ignored for 0.4 s; then a tap or Space SHALL restart at η 1.0 with steering back within 1.2 s. Once a run has passed beat 20, retries SHALL start at beat 9. Two catches in a row SHALL give the next try 2 s more lead.

#### Scenario: Caught and straight back in
- **GIVEN** the lead reaches 0 at 81 % of the stage
- **WHEN** the card shows "THE BURST CAUGHT YOU · AT 81 % · BEST 92 %" and EVERY GRAZE PULLS YOU AHEAD
- **THEN** input is ignored for 0.4 s, and a tap after that has the ship steerable within 1.2 s

#### Scenario: Retries skip the teaching knots
- **GIVEN** a run that got past beat 20
- **WHEN** the player retries with a tap, AGAIN, NEW SKY or R
- **THEN** the run starts at beat 9, the first hazard passes 0.5 to 2 s later, and a hit there is still a soft bump

#### Scenario: Help after two catches
- **GIVEN** the player was caught twice in a row
- **WHEN** the next try starts
- **THEN** it starts with 10 s of lead and shows "+2 S HEAD START"

### Requirement: Score and rank
Points SHALL be multiplied by γ: a graze 10 × (1 + chain / 10) with the chain counted up to 40, a hairline 3 grazes, a skim 30 a second, a thread 250, and 100 for each second of lead at the clear, all ×2 in the Headlight. The rank SHALL be a spectral class by share of par, coloured by its blackbody colour: O 100 % with no hits, B 60 %, A 35 %, F 18 %, G 8 %, K 3 %, else M. Par SHALL be a strong human bot's score on the same seed and start beat.

#### Scenario: Clear the stage
- **WHEN** the player passes beat 125
- **THEN** a card shows the rank letter in its colour, its star line, the next goal, the score counting up over 0.8 s, best, lead left, grazes, hairlines, hits, Headlight seconds and top speed
- **AND** it offers AGAIN (same seed, back in play within 1.5 s), NEW SKY and Copy log, and after 0.8 s a tap anywhere else plays again

#### Scenario: Sun class
- **WHEN** a run scores 8 % to 18 % of par
- **THEN** its rank is G with the line LIKE THE SUN

#### Scenario: The next goal
- **GIVEN** a run that ranks A
- **WHEN** the card shows
- **THEN** under the star line LIKE SIRIUS it says how many more points B needs, for example "+12,400 TO B"

#### Scenario: O needs a clean run
- **GIVEN** a run that beats par with one hit
- **WHEN** the card shows
- **THEN** its rank is B and the goal line says "O NEEDS A RUN WITH NO HITS"

### Requirement: Stage one, the web to Coma
A SHALL play one stage of 125 beats written in beats, with course speed tied to tempo, so every scripted hazard passes on its beat at any speed. In order it SHALL teach single knots and a pair, bring in the burst, then walls with gaps, bait knots, a rail from beat 50 to 54 with a wall at beat 56 whose gap lies beyond it, a breather where Coma's ring and label draw on, a seeded swarm, Coma's gate at beat 98, knots dark in the glare, and Coma passing in slow motion.

#### Scenario: Passes land on the beat
- **WHEN** any scripted hazard passes
- **THEN** its pass time is within 0.01 beats of its slot

#### Scenario: The first minute
- **GIVEN** a mid player in portrait
- **WHEN** they play for a minute
- **THEN** they hear zips from 3 to 10 s, meet the burst at about 9 s, walls and bait from 10 to 25 s and the rail at about 25 s, see Coma labelled at about 29 s, ride the swarm from about 32 s, thread the gate into HEADLIGHT at about 47 s, and clear at about 58 s

#### Scenario: The wall after the rail can be planned
- **GIVEN** the rail is beside the ship at beat 50
- **WHEN** the wall at beat 56 is 3 s out
- **THEN** its gap shows faintly on the ring, 90° beyond the rail on the far side, and the player has 2 beats after the rail ends to cross

#### Scenario: Toy mode
- **GIVEN** the URL has `?toy=1`
- **WHEN** the player plays for 5 minutes
- **THEN** hazards keep coming, the lead never runs out and the stage never ends

### Requirement: Callouts
Callouts SHALL show in bold capitals inside the ring's upper part, the current word in orange. A lower callout SHALL never replace a higher one while it shows, in this order: HEADLIGHT, THE COMA CLUSTER, the burst line, THREAD and the head start, the how-to lines, CHAIN, then HAIRLINE and CHAIN LOST. HAIRLINE SHALL show as a word only for the first two in a run, then as HAIRLINE ×N on runs of 3, 5, 8, 12, 16 and 20. The how-to lines SHALL show on the first two runs only.

#### Scenario: Big moments stay up
- **GIVEN** HEADLIGHT has just shown
- **WHEN** a hairline passes 0.3 s later
- **THEN** HEADLIGHT stays on screen for its full 1.2 s

#### Scenario: Hairline words are rare
- **GIVEN** a run with 40 hairlines
- **WHEN** they pass
- **THEN** HAIRLINE shows as a word for the first two and then only on runs of them, while every hairline still pops orange points and a ripple

#### Scenario: Coma's label stays clear
- **GIVEN** Coma's ring and label show at 390×844
- **WHEN** a callout shows
- **THEN** the label sits below its ring, flips to the left near the right edge, and does not touch the callout

### Requirement: Feedback every time
Every graze, hairline, hit, bump, gear change, thread, Headlight and its end, chain end, warning and catch SHALL play its sound and show its visual on the frame it happens. The music SHALL follow the simulation's beat clock in D minor, lifting a whole tone and adding a layer per gear. Where `navigator.vibrate` exists each of these SHALL buzz. With reduced motion there SHALL be no shake and no ring or sky punch, flashes SHALL be softer, and the fixed camera SHALL be used.

#### Scenario: Sound follows the game clock
- **WHEN** the game runs in slow motion
- **THEN** the drums drop out and a low sub holds the floor, and every note still lands on the game's beat clock

#### Scenario: Reduced motion
- **GIVEN** the system asks for reduced motion
- **WHEN** the ship hits a knot
- **THEN** the screen does not shake, the flash is softer, and the world does not roll

### Requirement: Layouts
The ring centre SHALL sit 40 % down in portrait, 46 % in phone landscape and 48 % on desktop. Speed SHALL show at the top left, score at the top right, γ under the ring with the lead beside it while the burst warns, the chain above the ship, and callouts inside the ring's upper part. The page SHALL not scroll, and HUD items SHALL stay inside the safe area.

#### Scenario: Three screens
- **GIVEN** play at 390×844, 844×390 and 1440×900
- **WHEN** a screenshot is taken mid-stage
- **THEN** the whole ring is on screen, no HUD item overlaps another or the ring, and the pause button is at least 44 px

### Requirement: Tuning, telemetry and the test hook
Every TUNE key SHALL be settable from the URL, ignoring case, along with `seed`, `debug`, `toy`, `bot`, `scheme` and `cam`. The last 20 runs SHALL be kept in `localStorage` under `lyh-lab-a-runs`, read and written inside try/catch. The page SHALL expose `window.__lab` with `id: 'a'`, `version: 2`, `tune`, `state()`, `events(n)`, `runs()`, `restart(seed)`, `advance(seconds, input)`, `bot(name, opts)`, `input(inp)`, `timing()`, `start()`, `view()`, `parReady()` and `feedback()`.

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

#### Scenario: Feedback the page really started
- **WHEN** a test calls `__lab.feedback()` after a run
- **THEN** it counts, per event type, the sounds, effects and buzzes the page actually started, not the events it received

### Requirement: Skill spread
The tuning SHALL give a real spread between bots on seeds 1 to 5: `idle` is caught before beat 90; `dodge`, which never grazes, is caught after the rail with under 25 % of par; `graze` clears with over 6 s of lead, reaches the Headlight, scores 20 times `idle` and ranks O; a novice `human` is caught or clears with under 2.5 s on at least 3 seeds; a mid `human` clears having won back at least 3 s on at least 4 and ranks F or better on 4; an expert ranks O on 3.

#### Scenario: Bots in node
- **WHEN** `node qa/light-years-home/lab-a.test.mjs` runs
- **THEN** every bot check passes, no single hazard causes more than 20 % of novice or mid hits on seeds 1 to 10, and 10,000 steps of random input and random dt give no NaN and no error
