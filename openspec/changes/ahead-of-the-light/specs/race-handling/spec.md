## ADDED Requirements

### Requirement: The ring and the camera
The game SHALL show one forward view down a tube, with your ship at 6 o'clock on a ring that reads like a clock face: the centre is far ahead, inside the ring is ahead, the ring is now, and outside it is the light behind. The ring SHALL shrink as you speed up, from its launch size to 30 % of the short side. The world SHALL roll to keep the ship at 6 o'clock, 0.12 s behind and at most 240° a second, and the camera SHALL never change or zoom mid-leg.

#### Scenario: Portrait
- **WHEN** a leg launches on a phone held upright at 390 × 844 and the player climbs from η 1.0 to 0.999c
- **THEN** the ring's centre stays at (195, 338), its radius shrinks from 164 px to 117 px, and the ship moves from (195, 502) to (195, 455)
- **CHECK** `qa/ahead-of-the-light/layout.e2e.mjs`

#### Scenario: Landscape and desktop
- **WHEN** the same leg launches at 844 × 390 and at 1440 × 900
- **THEN** the ring is centred at (422, 179) with a radius of 164 to 117 px, and at (720, 432) with 378 to 270 px, and the ship starts at (422, 343) and (720, 810)
- **CHECK** `layout.e2e.mjs`

#### Scenario: A fast swing along the ring
- **WHEN** a fast sideways drag swings the ship 90° round the ring in 0.2 s
- **THEN** the ship leads along the ring and the world rolls after it at no more than 240° a second until the ship is back at 6 o'clock
- **CHECK** `input.e2e.mjs`

### Requirement: The fixed camera
`?cam=fixed`, the fixed camera setting and reduced motion SHALL stop the world rolling. The ship SHALL travel round the ring, a sideways drag SHALL map to the bearing so right always goes the same way round, and the wings SHALL travel with the ship. Reduced motion SHALL also remove shake and FOV kicks and soften flashes.

#### Scenario: Reduced motion on a phone
- **WHEN** a player whose phone asks for reduced motion drags right at 390 × 844
- **THEN** the world stays still, the ship moves clockwise round the ring with its wings and shield, and a hit flickers the ship without shaking the view
- **CHECK** `input.e2e.mjs`

#### Scenario: Fixed camera on desktop
- **WHEN** a desktop player at 1440 × 900 turns on the fixed camera from the pause menu mid-leg, then holds → in the next leg
- **THEN** the world keeps rolling until that leg ends, and from the next leg it stays still while → moves the ship round the ring the same way every time
- **CHECK** `input.e2e.mjs`

### Requirement: Steering on every device
A sideways drag SHALL steer relative to where it starts, at 0.6° per px at 150 px/s or slower, rising to 1.4° per px at 1,200 px/s or faster, and the ship SHALL chase its target at up to 600° a second. The newest moving pointer SHALL steer and a re-grip SHALL keep the target. Keys SHALL turn at 330° a second with a 60 ms ramp. The mouse SHALL steer only with the left button held. The pad's left stick SHALL turn at 330° a second × |x|^1.6 past a 0.15 dead zone.

#### Scenario: A thumb in portrait
- **WHEN** a player at 390 × 844 drags 40 px sideways slowly, anywhere in the lower half
- **THEN** the ship turns about 24°, and the same 40 px dragged fast turns it further
- **CHECK** `input.e2e.mjs`

#### Scenario: Re-grip and two thumbs
- **WHEN** a player lifts the thumb and puts it down again, or drags with both thumbs at 844 × 390
- **THEN** the steering target stays where it was, and two thumbs never double the gain
- **CHECK** `input.e2e.mjs`

#### Scenario: Keys, mouse and pad
- **WHEN** a player at 1440 × 900 holds → (or D), moves the mouse with no button down, then holds the left button and drags sideways
- **THEN** the key turns the ship at 330° a second after a 60 ms ramp, the bare mouse move does nothing, and the held drag steers
- **AND** pushing the pad's stick past 0.5 hands steering to the pad
- **CHECK** `input.e2e.mjs`

### Requirement: Skim for speed
Each pass SHALL be judged when a hazard's beat crosses the ship, by its edge gap: under 0° a hit, 0 to 2.5° a HAIRLINE (+0.10 η), 2.5 to 7° a graze (+0.04 η; 12° in leg 1 until beat 19), and riding 0 to 6° off a rail's edge a skim (+0.03 η a second). Grazes and hairlines SHALL add 1 to the chain, which SHALL break on a hit or after 3.0 s with no graze. A hazard's tick SHALL turn orange when your line would graze it, and brighter and thicker when it would hairline.

#### Scenario: The first graze on a phone
- **WHEN** a first-time player at 390 × 844 drags a little toward the first knot, which passes about 2.4 s after TAP TO FLY
- **THEN** on the frame of the pass a falling Doppler zip plays panned to that side, a white streak runs along the ring, the chain shows 1 and the light's ring springs outward
- **CHECK** `feedback.e2e.mjs`; the 8 ms buzz on a real phone in the user's playtest

#### Scenario: A hairline
- **WHEN** the ship passes a knot with an edge gap of 1°
- **THEN** the event is `hair`, η rises by 0.10, and an octave sparkle and a ring ripple play with no hit-stop, and the word HAIRLINE never takes the caption slot
- **CHECK** `handle.test.mjs` and `feedback.e2e.mjs`

#### Scenario: The tick warns first
- **WHEN** the ship's current line would pass a knot 5° from its edge
- **THEN** the knot's tick on the ring is orange at least 1.3 s before the pass
- **CHECK** `layout.e2e.mjs`

#### Scenario: The chain runs out
- **WHEN** 3.0 s pass with no graze
- **THEN** `chainEnd` fires with a falling two-note pluck, and the thin arc under the chain number had shown the time left
- **CHECK** `handle.test.mjs`

### Requirement: Burn a fuel cell
A flick up (48 px up within 150 ms at 700 px/s or more, from any pointer, mid-drag too) SHALL burn on touch, and ↑, W, Shift, the right mouse button, pad RB or RT on desktop. A burn SHALL cost one whole cell and add 0.4 η over 0.3 s, never above η 2.6 in open space. Past 150° in a whip it SHALL be an OBERTH burn: +0.8 η with no cap. With no whole cell a burn SHALL give a dry click and flash the empty diamonds, and nothing else.

#### Scenario: A flick mid-drag
- **WHEN** a player at 390 × 844 flicks up while steering with 2 cells
- **THEN** one cell empties, a whoosh over a sub thump plays, the ring cinches and the light's ring falls back and reddens, and the flick's sideways part does not move the ship
- **CHECK** `input.e2e.mjs`; within 0.2 s of the flick's start on a real phone in the user's playtest

#### Scenario: Burns alone never reach HEADLIGHT
- **WHEN** a ship at η 2.4 burns in open space
- **THEN** η stops at 2.6 and HEADLIGHT (η 2.647) does not light
- **CHECK** `handle.test.mjs`

#### Scenario: OBERTH
- **WHEN** a player burns while whipping 160° round a well
- **THEN** η rises by 0.8, which can light HEADLIGHT, and the first time BURN AT THE BOTTOM · OBERTH × 2 shows
- **CHECK** `handle.test.mjs`

#### Scenario: Empty tanks
- **WHEN** a player with 0.5 of a cell flicks up, or a desktop player presses ↑
- **THEN** the event is `dry`, a dry click plays, the empty diamonds flash, and η, fuel and the bearing do not change
- **CHECK** `handle.test.mjs` and `feedback.e2e.mjs`

### Requirement: Grab a well in its window
A well's reach arc SHALL light 1.5 s before it is abreast. From 0.35 s before abreast to 0.15 s after, with the ship in reach and outside the core, a new press SHALL grab on the press, and your ring SHALL flash white where the well's latch ring touches it. A pointer already down SHALL not grab, a held well SHALL give a later press a dull click, and a drag of 20 px or more in the first 0.12 s SHALL cancel the grab at no cost.

#### Scenario: One thumb in portrait
- **WHEN** a player at 390 × 844 lifts the thumb and presses again as the latch ring touches theirs
- **THEN** a pluck plays, the tether draws as a chord across the ring, and the sweep starts
- **CHECK** `input.e2e.mjs`

#### Scenario: Second thumb in landscape, Space on desktop
- **WHEN** at 844 × 390 one thumb steers and the other presses in the window, or at 1440 × 900 the player holds Space, the left button with no drag, or pad A
- **THEN** the grab fires at once, and lifting releases
- **CHECK** `input.e2e.mjs`

#### Scenario: A re-grip is not a grab
- **WHEN** in portrait one thumb lifts, presses again inside an open window and drags 30 px within 150 ms
- **THEN** it ends as a free `latchCancel`, never a whip, and in the toy no more than 1 grab in 10 is accidental
- **CHECK** `input.e2e.mjs`

### Requirement: The whip and LET GO
While held, the ship SHALL sweep round the ring away from the well at 120° a second, rising to 200° a second at 300° round, while the world slows to 1 − 0.5 × (angle ÷ 300°). One or two orange 60° exit bands SHALL show. LET GO SHALL show 0.25 s before a band's centre, never within 0.4 s of the grab. A lift within 10° of a band's centre SHALL be PERFECT, inside a band GOOD and elsewhere WIDE, and SHALL gain (0.10 + 0.50 × d²) × mass × 1.5, 1.0 or 0.5 η.

#### Scenario: The first whip of a run
- **WHEN** a first-time player grabs the first well of leg 1 at about 15 s
- **THEN** it sweeps at half speed with 1.5 × windows, LET GO shows before the band, and the GOOD window is at least ±150 ms
- **CHECK** `handle.test.mjs`

#### Scenario: A GOOD release at 180°
- **WHEN** a player lifts inside a band 180° round a medium well
- **THEN** GOOD shows, η rises by 0.28, a soft chime plays, and the light is pushed back 0.4 × (0.5 + 0.6) × the leg's M seconds
- **CHECK** `handle.test.mjs`

#### Scenario: PERFECT climbs
- **WHEN** a player lands two clean PERFECT releases in a row
- **THEN** each plays a chime one step higher, and after the first two whips the grade shows as a small word at the ship, not a caption
- **CHECK** `feedback.e2e.mjs`

### Requirement: The red zone and the scorch
The last 75° before a well's core SHALL be drawn red from the grab. Entering it SHALL pop the shield, or cost 1 hull with the shield down, once a whip; a release from it SHALL pay × 1.3 and may lift the light's gap 1.5 s past the leg's cap. With 1 hull and no shield the red arc SHALL flash from the grab. Sweeping to the core SHALL SCORCH the ship (a hit, no gain, a WIDE release), after the core glows red and crackles from 0.6 s before. Every grab SHALL leave at least 2.0 s from press to scorch.

#### Scenario: Greedy and paid for it
- **WHEN** a player with the shield up holds a whip into the red zone and lets go there on a band
- **THEN** the shield pops with a glass sound, the whip hum growls, THE RED ZONE COSTS YOUR SHIELD shows the first time, and the release pays × 1.3
- **CHECK** `handle.test.mjs` and `survival.test.mjs`

#### Scenario: A scorch is always warned
- **WHEN** any whip on any seed reaches the core
- **THEN** a `scorchWarn` came at least 0.6 s before the `scorch`, and the press came at least 2.0 s before it
- **CHECK** `handle.test.mjs`

#### Scenario: Last hull
- **WHEN** a player with 1 hull and no shield grabs a well
- **THEN** the red arc flashes from the grab, and entering it wrecks the ship
- **CHECK** `handle.test.mjs`

### Requirement: Gears and the light-speed feel
Speed SHALL climb the nines: 0.9c (η 1.472), HEADLIGHT 0.99c (2.647), 0.999c (3.800) and LIGHT SPEED 0.9999c (4.952). A gear up SHALL lift the music a whole tone on the next downbeat and turn the new 9 orange in the speed digits; big digits and a chord SHALL play only for a new best gear this run. The full HEADLIGHT, 0.4 s at half speed with its caption, SHALL play only on the run's first HEADLIGHT and on a gate thread. A gear down SHALL tape-stop for 0.3 s and grey the 9.

#### Scenario: The first 0.9c
- **WHEN** a first-time player flicks up at about 10 s of leg 1 and crosses 0.9c
- **THEN** the digits top left read 0.9 with the 9 orange, the key lifts on the next downbeat, and big digits play once this run
- **CHECK** `handle.test.mjs` (`gearUp { best: true }` once per gear per run)

#### Scenario: LIGHT SPEED
- **WHEN** a player reaches 0.9999c
- **THEN** a 0.15 s freeze and a 0.2 s white-out play, the sky folds to one point, the ring punches to 26 % for 1 s, LIGHT SPEED shows and course speed rises × 1.08
- **AND** a hit, a scorch, a WIDE release or η under 4.95 ends it with a falling whoosh at η 3.8
- **CHECK** `handle.test.mjs` and `layout.e2e.mjs`

#### Scenario: Speed digits per layout
- **WHEN** a leg is in flight
- **THEN** speed shows top left as "0.9916c" with the newest 9 orange, 22 px at 390 × 844 and 844 × 390 and 28 px at 1440 × 900, and it is one of only two HUD numbers
- **CHECK** `layout.e2e.mjs`

### Requirement: Every action answers on its own frame
Every event that has a sound, an effect or a haptic SHALL start it on the frame of the event. A hit SHALL give a 120 ms hit-stop, a tape-stop on the music, 6 px of shake and a 60 ms buzz; grazes and hairlines SHALL never hit-stop. Phones with `navigator.vibrate` SHALL buzz for a graze (8 ms), hairline (15), burn (30), hit (60), shield pop (20), SLAM taken (30) and takedown made (40). The music SHALL keep its own clock through slow motion and hit-stop and re-lock at the next bar.

#### Scenario: The feedback audit
- **WHEN** the test hook steps through every event type in the event list
- **THEN** `feedback()` counts a sound, effect or haptic started on the same frame for each type that has one
- **CHECK** `feedback.e2e.mjs`

#### Scenario: A hit
- **WHEN** the ship hits a knot
- **THEN** play stops for 120 ms, the music tape-stops, the view shakes 6 px and the chain breaks
- **CHECK** `feedback.e2e.mjs`

#### Scenario: On a real phone
- **WHEN** the user plays on their own phones with sound on
- **THEN** audio starts on the first tap, buzzes are felt on Android, and iPhones get the sound
- **CHECK** the user's playtest

### Requirement: The HUD and captions per layout
During a leg the HUD SHALL show only speed (top left) and place (top right, with the next named ship and its gap under it, left of the pause button). One caption at most SHALL show, in bold capitals with the current word orange, by the priority listed in `design.md`. Captions SHALL sit at y 248 in portrait (22 to 28 px), y 89 in landscape (22 px) and y 224 on desktop (28 to 34 px). Every tap target SHALL be 44 px or more.

#### Scenario: Portrait
- **WHEN** a leg is in flight at 390 × 844
- **THEN** "2ND" and "HOUND +0.8 S" (11 px) sit top right left of the 44 px pause button, nothing sits outside the safe area, and a thumb resting at y 650 to 780 never covers the ring
- **CHECK** `layout.e2e.mjs`

#### Scenario: Landscape thumbs
- **WHEN** a leg is in flight at 844 × 390
- **THEN** thumbs left of x 258 or right of x 586 never cover the ring, and the caption at y 89 never covers the gate's lines
- **CHECK** `layout.e2e.mjs`

#### Scenario: A higher caption holds
- **WHEN** SHIELD DOWN is due 0.3 s after THE LIGHT TOOK HOUND starts
- **THEN** THE LIGHT TOOK HOUND stays for at least 0.6 s, and a bark due then is dropped if it cannot show within 1.0 s
- **CHECK** `feedback.e2e.mjs`

### Requirement: Captions keep clear of the gate and the bands
A caption SHALL never sit over the next gate's lines or labels, an exit band or LET GO. While one is in the way the caption SHALL move by the least step that clears it (down toward the centre first, where the ring is wider) or shrink its words, and come back once the way is clear.

#### Scenario: THREAD OR DOCK in portrait
- **WHEN** the gate call shows THREAD OR DOCK at 390 × 844 with the ring at its floor and the THREAD label at 10 o'clock
- **THEN** the caption moves down or shrinks until no word touches the THREAD or DOCK lines or labels, in every frame of the mid bot's legs
- **CHECK** `layout.e2e.mjs`

### Requirement: Pause and resume keep a whip
The input state SHALL freeze with the game. Pause, blur and a hidden page SHALL keep a held whip held, and play SHALL resume with HOLD TO GO ON and then 0.6 s of slow motion. Touches in the top 64 px SHALL never count as play. Esc or P SHALL pause on desktop, M SHALL mute and pad Start SHALL pause. The state SHALL be drawn between 120 Hz steps so faster screens do not judder.

#### Scenario: Pause mid-whip on a phone
- **WHEN** a player at 390 × 844 taps the pause button mid-whip, then resumes
- **THEN** the whip is still held, HOLD TO GO ON shows, and pressing resumes the sweep with 0.6 s of slow motion
- **CHECK** `input.e2e.mjs`

#### Scenario: The page goes into the background
- **WHEN** the page is hidden or loses focus mid-leg
- **THEN** the game pauses, its audio suspends and nothing advances until the player resumes
- **CHECK** `input.e2e.mjs` and `qa/arcade/quiet.mjs`

### Requirement: Other control schemes
`?button=1` and the action-button setting SHALL add a 72 px action button at the bottom right while a drag anywhere else steers. `?scheme=halves` SHALL turn at 330° a second while the left or right half is held. `?burn=tap` SHALL burn on a press and lift within 220 ms and 14 px outside a grab window. Tilt SHALL not be offered.

#### Scenario: The action button
- **WHEN** a player at 390 × 844 with `?button=1` presses the button in a grab window
- **THEN** it grabs, and a drag elsewhere keeps steering
- **CHECK** `input.e2e.mjs`

#### Scenario: Tap to burn
- **WHEN** a player with `?burn=tap` taps outside a window
- **THEN** one cell burns, and a lone tap without the option does nothing
- **CHECK** `handle.test.mjs` and `input.e2e.mjs`

### Requirement: The 30-second toy
`?toy=30` SHALL play one fixed 30 s stretch with knots, Coma as a landmark well, REMORA, the light, 3 hull, the shield and 2 fuel, captioning each thing the first time it happens, and SHALL end on a card with top speed, grazes, the whip grade, slingshot yes or no and takedown yes or no, then AGAIN.

#### Scenario: The toy's bot pass
- **WHEN** the bots play the toy on seeds 1 to 20
- **THEN** `novice` grazes by 3.5 s on every seed, whips GOOD or better on 40 % and slingshots on 30 %; `mid` whips GOOD or better on 75 %, slingshots on 70 % and takes REMORA down on 30 %; `dodge` ends under TTC 4 s; `idle` is caught before 30 s
- **CHECK** `toy.test.mjs`

#### Scenario: The light shows at 9 s
- **WHEN** the toy's script drops the gap to TTC 4 s at 9 s
- **THEN** the light's arc rises up the screen, white, with THE LIGHT IS BEHIND YOU · FLICK UP TO BURN
- **CHECK** `toy.test.mjs`

#### Scenario: Testers on phones
- **WHEN** 5 testers play the toy on their phones with no instructions
- **THEN** 5 of 5 graze within 4 s on try 1, 4 of 5 land a GOOD whip by try 2, 4 of 5 slingshot by try 3, 3 of 5 burn again without a caption, 4 of 5 ask for another try, and a retry steers within 1.2 s
- **CHECK** the user's playtest

### Requirement: Handling at every skill
Across 200 bot runs, a mid player SHALL reach 0.9c early in every leg and HEADLIGHT in most, grab most wells and rarely scorch, and a novice SHALL land half their whips GOOD or better.

#### Scenario: Mid
- **WHEN** the `mid` bot plays seeds 1 to 200
- **THEN** it reaches 0.9c by 30 % of every leg and HEADLIGHT by 60 %, grabs 80 % of wells, releases GOOD or better on 75 %, and scorches 0.5 times a leg or fewer
- **CHECK** `sim.test.mjs`

#### Scenario: Novice and expert
- **WHEN** the `novice` and `expert` bots play seeds 1 to 200
- **THEN** the novice releases GOOD or better on 50 % and scorches once a leg or fewer, and the expert reaches LIGHT SPEED in most legs from leg 3
- **CHECK** `sim.test.mjs`
