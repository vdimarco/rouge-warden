# Light Years Home lab v2 design

## Source and scope

The lead designer's final for v2 (2026-10-13) is the contract. It came from five pitches and three judges (fun, fit and
build risk), with numbers from the pitches' own sims. All numbers here are starting values: the bots and the playtest
replace them. Where the design is unclear, the builder picks what makes the game more fun and notes it below.

Both builds then had an adversarial playtest: bots and player models on 20 seeds, real touch through CDP at 390×844
and 844×390, and keys and mouse at 1440×900. The builders fixed what it found. The decisions below describe the builds
as they are now. The tuning log keeps the numbers from before and after each round.

Two pitches won clearly, and each judge picked the same pair:

| | A. LIGHT YEARS AHEAD (steer and skim) | B. SLINGSHOT HOME (grab, whip, let go) |
|---|---|---|
| Verb | Continuous steering round a ring | Hold to grab a mass, lift to fling |
| Camera | Forward down a tube, as in the video | North-up chase over a course; turns only for a moment at LIGHT SPEED |
| Speed comes from | Near misses (grazes) | Deep, well-aimed releases |
| Speed does to you | Makes it harder: the ring shrinks, the beat speeds up | Makes it faster and your clock slower |
| Failure | The burst's light catches you; grazes push it back | A burn or getting lost; a rewind costs time |
| Score | Points × γ, a spectral-class rank against a strong human's par | Your own clock: years aged, on a stylised clock |
| Top-speed moment | HEADLIGHT at 0.989c | LIGHT SPEED at 0.9999c |

## Decisions for both builds

- **Kept apart.** A and B share no new code, so two people can build them at once. A gets no hold-and-fling and B gets
  no steering, so the playtest can tell which verb is fun. The loser's best idea is grafted into the winner later.
- **Borrowed ideas.** A takes the Rhythm pitch's Doppler music bus, the risk judge's readability fixes (a ring floor in
  px, a slower approach, ticks on the ring, hazards that take only part of the squeeze) and the fit judge's softer hit
  (one gear, not half your speed). B takes the risk judge's camera, the Slingshot pitch's plain preview line and fork
  marks, a physical grab, physical focusing for every line, the Rhythm pitch's nine-up key changes and the Wild
  pitch's vista at Coma.
- **Parked until a winner is picked:** the ring catch, judged notes, clubs and mirages, moving masses and braking, the
  burst ending over Earth, daily seeds and ghosts, stages II to VII, and an arcade cabinet.
- **Imports.** Only existing pure or render-only modules: `render/points.js`, `core/physics.js`, `core/rng.js`,
  `core/gen/web.js`, `core/captions.js` and `CHAPTER_KEYS` from `ui/audio.js`. `render/view.js`, `ui/overlay.js` and
  `ui/hud.js` pull in v1's engine, so each build copies the overlay's drawing style instead: rings 1 CSS px at 80 %
  white, a diagonal leader with a 10 px flat run, labels in 11 px system-ui, orange `#f08a2c`.
- **Page shell.** `/arcade/quiet.js` is the first script. The import map is `{"three":"/vr/lib/three.module.min.js"}`.
  WebGL canvas below, 2D overlay above, `touch-action: none`, no page scroll.
- **Start.** The title tap starts play with the ship already moving and creates the AudioContext. On iPhones
  `navigator.audioSession.type = 'playback'` keeps the silent switch from muting the game.
- **Loop.** A fixed 120 Hz simulation, rendering on `requestAnimationFrame`, a pause when the page is hidden, and no
  input while the game switcher is open. A draws the course between two steps, so a 144 Hz screen does not judder.
- **Quick retries.** A retry must not replay what the player already knows. A starts retries at beat 9 once a run has
  passed beat 20. B drops the mass-1 tutorial once this device has a run with 3 or more releases, or this session has
  3 clean releases. Both let a tap skip the closing vista after
  the first time home, and take a tap anywhere on the result card as "again".
- **Tuning and logs.** Every `TUNE` key can be set from the URL, plus `seed`, `debug`, `toy` and `bot`. The last 20 runs
  stay in `localStorage` (`lyh-lab-a-runs`, `lyh-lab-b-runs`) and the result card has Copy log, so testers can paste
  their runs back. Nothing is sent anywhere.
- **Reduced motion** turns off shake and FOV kicks and softens flashes. In A it also drops the ring and sky punch and
  picks the fixed camera on every device. In B it also drops the LIGHT SPEED camera turn.
- **Haptics** use `navigator.vibrate` where it exists. iPhones get sound only.

## Decisions for A

- **Tube geometry.** Hazards sit on a tube wall at a bearing. The camera looks down the tube from the ship's depth, and
  Penrose's aberration puts everything beside the ship on one circle of radius f / sinh φ: the ring. The future is
  inside it and the past outside, so collisions happen on the ring.
- **Two rapidities.** The sky uses the true speed, capped at φ 3.0 (4.0 for 1 s in the Headlight punch). Hazards and
  the ring use a rapidity that eases from 1.0 to the floor's, so the ring shrinks only from 42 % to 30 % of the short
  side, never under 112 px. The risk judge found that at the pitch's speeds a hazard was readable for only 0.27 to
  0.35 s; at 1.6 to 2.25 R/s it is past 30 % of the ring for 0.81 s at cruise and 0.60 s at top speed.
- **Light speed you can see.** The sky and the dust keep a brightness floor as they redshift, so the red behind you
  shows instead of fading to black. The dust beside the ship sees most of the true speed, so it empties and reddens as
  you go faster. A red rim glows from gear 3. From beat 56 a dark disc behind the hazards dims Coma's glare, where the
  swarm's knots appear.
- **Reading aids.** Ticks on the ring 1.3 s out, outlines from 1.2 s over a dark edge, orange ticks on a graze line,
  gold and thicker ticks in the hairline band, and red ticks, a red mark inside the ring and a red chevron 0.9 s
  before a hit. A wall's gap shows faintly from 3 s out. The lane alarm tone sounded on lines that 96 % of the time
  never hit, so it became a whine. The whine holds only while both the bearing and the line you steer to would hit
  within 0.6 s, and it cuts the moment you are clear.
- **The script is in beats.** Course speed is tied to tempo (0.86 R per beat), so every hazard passes on its beat at any
  speed, and the music can follow the simulation's beat clock. No input is judged by ear, so audio lag cannot make it
  unfair. The stage is 125 beats.
- **Speed is risk.** Grazes, hairlines, rail skims and gate threads add speed. Faster shrinks the ring and lifts the
  tempo by up to 40 %. Slow is dangerous too: the burst's light gains at 0.8 × (1 − β) light-seconds a second.
- **The burst is a tug of war you can see.** Grazes win lead back (0.12 s, a hairline 0.25, a thread 0.5, a skim 0.2 a
  second, up to 9 s) and a hit costs 1.5 s, so the lead moves all the time and greed pays twice. The burst is a white
  ring outside the play ring, at a distance set by the lead. It warns when it would catch you within 5 s or one more
  hit would, not on lead under 3 s, so a lead frozen at top speed never blinks.
- **Soft failure first.** For the first 19 beats (about 10 s) a hit is a bump and a graze counts out to 12°. A hit costs
  one gear and 1.5 s of lead, not half the speed. After two catches in a row the next try gets 2 s more lead.
- **Only hits stop time.** A 60 ms freeze on each hairline made the music limp for the best players, because the music
  follows the beat clock. Only a hit freezes play (120 ms), where the tape stop breaks the music on purpose.
- **Coma always peaks.** Threading Coma's gate sets η to at least 2.7 in the same step, so drag cannot undo it, and lights
  the Headlight. If the Headlight is already on, the peak fires again as THROUGH COMA.
- **Rank by a human par.** Par is a strong human bot (150 ms reactions, 1.5° error, greed 0.9) on the same seed and start
  beat. The graze bot hairlined everything and made every mid run read as a failure. O needs 100 % of par and no hits,
  then B 60 %, A 35 %, F 18 %, G 8 % and K 3 %. Each class has a star (G LIKE THE SUN, M LIKE BETELGEUSE), so a
  letter reads as a star and not a school grade. The card names the next goal. Par is worked out in idle time while
  the title or a card shows (about 43 ms a seed in node), and cached per seed and start beat.
- **Steering.** The drag gain rises with thumb speed, from 0.6° per px under 150 px/s to 1.4° per px at 1,200 px/s,
  so the first knots need no pixel precision and a flick still crosses the ring. Only the newest finger steers. The
  first deliberate input picks the scheme and camera for the run. Mouse aim needs a 120 px sweep in 0.5 s and never
  takes over near a key press or over a button. In the fixed camera a drag moves the bearing directly, so it never
  stalls at 3 or 9 o'clock. The camera rolls at most 280°/s.
- **Callouts.** Callouts have a priority, so HAIRLINE never covers HEADLIGHT or Coma. HAIRLINE shows as a word only for
  the first two in a run, then on runs of them. Coma's label sits below its ring.
- **The wall after the rail.** It passes at beat 56, two beats after the rail ends, with its gap 90° beyond the rail.
  At beat 54.5 it caused half of all novice hits and could only be passed from memory.
- **Resume.** Play goes on with 0.6 s of slow motion, so a hazard 0.2 s away is not an instant hit.
- **Cheap full-screen effects.** The flashes, the rim and the caught flood are CSS layers that change only opacity and
  scale. Full-screen 2D gradients drawn each frame doubled the frame time when the pressure was on.

## Decisions for B

- **One camera that keeps north up.** North-up chase, pitched lower in flight and higher during a hold so the orbit and
  the next ring are in view. In flight it looks 10 u ahead along the heading, so a line back down the course still
  sees what is ahead. The world never spins while you orbit; the squeezed sky swings round like a lighthouse, which is
  real. The one exception is LIGHT SPEED: for 1.6 s the camera turns to face the heading and dips, so the fold lands
  mid-screen, then eases back. `?cam=chart` is the fallback.
- **A physical grab.** The grab locks at your current distance, but never deeper than depth 0.6, so every hold has at
  least a second before its burn warning. Its cost depends on how much you were heading at the mass, so the press has
  its own skill: press as the mass comes alongside. An orange tick and a double tick mark that moment, 0.12 s before
  closest approach. EARLY shows only when a press really cost speed, and the result card shows what early presses cost
  in years, from a shadow clock that ran without them.
- **Depth is time.** Holding reels you in at 0.24 a second (faster while wide). Deeper orbits sweep the release line
  faster and slow the world to as little as 40 %. Each mass gives one or two windows toward any target, so "one more
  lap?" is a real choice. Each core shows its burn zone as a thin red circle at 0.3 R, and its glow stays inside it.
- **Honest grades.** The grade is the worse of the angle and how far the line misses the band, so a far target is a
  smaller target. A line inside 0.45 R of a centre is WIDE at best, and one into any core is MISS, so a grade never
  praises a line that burns you.
- **Plain preview line, approach ring and LET GO.** The line is 2 px and not coloured by grade; `?cue=1` colours it for
  comparison. An approach ring closes on the band over 0.75 s and meets it at the window's best moment. LET GO shows
  0.25 s before that moment, so a lift a reaction later lands on it. When LET GO showed as the window opened,
  first-timers lifted into a MISS and looped at mass 1. The first swing runs at half speed and the first two clean
  releases get 1.5× windows.
- **Physical focusing** bends every line toward a nearby mass the same way, whatever its grade. It acts only outside the
  latch ring, at 0.06, so an aimed line is not pulled into the core.
- **Your clock is the score.** Going faster keeps you young, and lower is better. True dilation (1/γ) settled 66 to 79 %
  of an expert's score in the first 10 s, so the clock is stylised: 0.162 / η^1.75 years a second, from the first
  fling. The fork, the avenue and Coma still count.
- **Rewind, not game over.** A burn or a lost rewinds 0.9 s to just before your last grab, on a line nudged off any core
  so it does not replay the same burn. The clock never rewinds, so a mistake costs time, not a life. A line that can
  reach nothing is lost after 0.6 s; a long line toward a mass is never lost early. After 2 fails on one mass its
  swings get a ghost line, wider windows and a slower reel.
- **Nines.** The fanfare is for a new best in the run. Climbing back to a nine you had is a small tick, and a press that
  costs a nine flashes the speed red and steps the key down.
- **Skips.** A skip (SKIP +2) counts two chain links. Its gain multiplier stays 1.0, because at 1.25 the expert line
  skipped every other mass.
- **Pausing keeps the swing.** P and the pause button keep a held thumb or key. A blur, a hidden page or a touch the
  system takes pauses instead of letting go, and a swing waits under HOLD TO GO ON for a fresh press. Any finger holds,
  so rolling from one thumb to the other keeps the swing. The sound suspends while paused or hidden.
- **Callouts stay off the aim.** Callouts sit 74 % down in portrait and high in the middle on wide screens, and a grab
  clears them, so nothing covers the ring you aim at. Nine-up digits sit under the HUD speed.
- **Instant sound.** Nothing is quantised to a beat, so every grab and release answers at once.
- **`?toy` stays light.** Masses far behind are dropped, so a ten-minute session runs as fast as the first minute.

## The chooser

- A black page with a slice of seeded cosmic web drawn once as white dots on a 2D canvas, and the small grey box "every
  dot is a galaxy". No WebGL and no sound. Dots fade out behind text so it stays readable. The Coma Cluster sits in the
  first clear spot with a thin ring, leader and label; where no spot is clear (phone landscape) it is left out.
- Each button is a landmark: a thin ring with a small sketch of its verb, a diagonal leader with a 10 px flat run, the
  label, and one plain line from the note to the user. The tag turns orange on hover and focus, like the caption's
  current word.
- **Note: absolute links.** The buttons link to `/light-years-home/lab/a/` and `/b/`, not `./a/`. A host may serve
  `/light-years-home/lab` without the trailing slash, and `./a/` would then point at `/light-years-home/a/`.
- **Note: additions.** Keys A or 1 and B or 2 open the prototypes. Under each button, the number of runs played on
  this device shows once there is one, so a tester can see which one they have played. One small line asks for about
  3 minutes each with sound on.

## Sources

- **Relativistic sky.** Penrose, "The apparent shape of a relativistically moving sphere", Proc. Cambridge Phil. Soc.
  55 (1959): the stereographic form of aberration, already in `render/points.js` with Doppler colour from a blackbody
  table. A uses it as the collision geometry too.
- **Cosmic web.** van de Weygaert's Voronoi kinematic model ("Voronoi Tessellations and the Cosmic Web",
  arXiv:0707.2877), already in `core/gen/web.js`. Both builds and the chooser use it for the backdrop.
- **A's tube view.** Tempest (Atari, 1981), Gyruss (Konami, 1983) and Super Hexagon (Terry Cavanagh, 2012): lanes read
  by angle round a ring, with a rim readout. The `?scheme=halves` option is Super Hexagon's left and right halves.
- **A's music.** The Rhythm pitch's Doppler music bus, and the Lab's Heartship, where the audio follows the game clock.
- **A's playtest look.** The burst's ring, the red floor for light behind you and the dark disc behind the hazards had
  no outside source that fit. They answer the playtest's readability findings.
- **B's swing.** Sling Drift (Ketchapp) and Tiny Wings (Andreas Illiger, 2011): hold for tension, let go on the line.
  The Lab's Threadwake taught that a tether must keep its length.
- **B's approach ring.** The approach circles of osu! (Dean Herbert, 2007): a ring that closes on its mark at the moment
  to act. B's LIGHT SPEED rush lines follow the jump-to-hyperspace streaks of film; no single source.
- **B's camera.** The north-up chase of top-down orbit games. No single source fit, so the risk judge's rule decides
  it: one camera that never turns. The brief turn at LIGHT SPEED came from the playtest, because the fold was often off
  a portrait screen.
- **Juice.** "Juice it or lose it" (Martin Jonasson and Petri Purho, 2012) and "The Art of Screenshake" (Jan Willem
  Nijman, 2013): hit-stop, shake, flashes and callouts on every event.

## How the pick is made

- Five testers: three on phones in portrait and two on desktop. Each plays both, alternating which comes first, with no
  explanation beyond the chooser's one line.
- 3 minutes of each, then "play either one for 3 more minutes". Ask "When did you feel fastest?" and "What would you
  do differently next time?".
- The main signal is the free choice in the last 3 minutes, plus unprompted requests for another go. On a tie, take the
  one whose logs show more deliberate skill by run 3: A's grazes per pass, or B's PERFECT rate and grab cost.
- Testers paste their Copy log output. The real-phone check of touch lag, sound and frame rate happens here.
- **A passes** if 4 of 5 keep playing past 2 minutes, grazes per pass at least double by run 3, 3 of 5 say the view
  tightens when you go faster, run 5 scores 3 times run 1, 3 of 5 ask for another go, and a retry takes under 1.5 s.
  If nobody grazes on purpose, make the speed gain louder first. **Kill A** if two tuning passes later testers still
  call it "just dodging".
- **B passes** if 4 of 5 play `?toy` past 60 s, 4 of 5 replay at least twice, median release error falls 30 % by
  the third try, the best clock is a third of the worst or less, 3 of 5 name a nine-up, LIGHT SPEED or Coma as the
  fastest moment, and nobody asks "what do I do?" after 10 s. If it feels like "just timing a button", add `?drag=1`.
  **Kill B** if two tuning passes later nobody retries unprompted.

## Checks

- Node tests: `qa/light-years-home/lab-a.test.mjs` (18 tests) and `lab-b.test.mjs` (28 tests) cover determinism, the
  bot spread, warnings before every hit or burn, the first input timing, retry timing and 10,000 random steps. They
  also cover each playtest fix. For A: Coma's Headlight, hairlines that keep the beat, the tug of war, the retry skip,
  no trap hazard, the soft start and the human par. For B: the catch depth, core grades, the lost rule, the nine
  fanfare, the tutorial, LET GO timing, a first-timer who follows the cues, skips, retry lines and `?toy` pruning.
- Browser checks drive `window.__lab` and take screenshots at 390×844, 844×390 and 1440×900. SwiftShader is slow, so
  feel is judged from the simulation and event timings, and screenshots judge look and layout.
- The adversarial playtest also played real CDP touch, keys and mouse at all three sizes, and logged each event's sound,
  buzz and callout per frame. It found no page errors and no NaN in either build.
- The chooser was checked in Chromium at all three sizes: no sideways scroll, every target at least 44 px, no
  AudioContext, `noindex`, quiet.js first, the keys, the switcher and blocked storage.
- **Not checked in this sandbox:** real touch latency, phone audio and the silent switch, haptics, real-phone frame
  rates, hidden-tab audio, and lifting one of two touches. The five-tester playtest covers them.

## Tuning log

Each build records its bot numbers here before and after tuning. A uses seeds 1 to 5. B's build round used 6 seeds and
its playtest round seeds 1 to 5.

### Build round (the builders' first tuning)

| Build | Check | Before | After |
|---|---|---|---|
| A | idle | caught at 43 % (beat 55) on all seeds | caught at 36 % (beat 46) |
| A | dodge | clears, lead 2.5 s, 0.1 to 0.2 % of par | clears, lead 0.8 s, 0.0 to 0.1 % of par |
| A | graze | clears, lead 8.2 s, Headlight at beat 43, 249k to 264k | lead 8.0 s, 260k to 275k (par) |
| A | novice (300 ms, 7°, greed 0.2) | clears 5 of 5, lead 2.1 to 3.8 s; pushed on 2 of 5 | lead 0.8 to 2.8 s; pushed on 4 of 5 |
| A | mid (200 ms, 3°, greed 0.6) | clears 5 of 5, lead 3.6 to 6.7 s | lead 2.8 to 6.3 s; 2 to 6 s on 4 of 5 |
| A | `BLEED` | 0.4 | 0.5 |
| A | rank shares of par: O, B, A, F, G, K | 75, 40, 20, 8, 3, 1 % | 60, 25, 12, 5, 1.5, 0.5 % |
| A | human bot | ignores the alarm: mid caught on 2 of 5, 6 to 7 hits a run | looks again a reaction time after an alarm and corrects 60 % of its error |
| B | exact | 37 to 50 s, 1.33 to 2.19 yr, up to 3 rewinds, LIGHT SPEED at mass 9 | 48 to 63 s, 0.84 to 1.18 yr, 0 rewinds, LIGHT SPEED at mass 7 |
| B | greedy 60 ms | median 3.90 yr (2.76 to 5.09), up to 5 rewinds | median 1.89 yr (1.26 to 3.42), up to 4 rewinds |
| B | greedy pressing at reach entry | 27 yr | 8.9 yr; net η 0.6, against 4.5 pressing at closest approach |
| B | first 110 ms | one seed never clears in 200 s; 18 to 65 yr; up to 41 rewinds | 38 to 61 s, 4.04 to 6.65 yr, up to 8 rewinds, no LIGHT SPEED |
| B | exact ÷ first clock | 0.05 | 0.24 |
| B | band | 0.33 to 0.55 R | 0.62 to 0.86 R |
| B | grading | angle only | the worse of angle (8, 16, 30°) and lateral miss (0.6, 1.0, 1.4 R) |
| B | `FOCUS` | 0.25 everywhere in reach | 0.06, outside the latch ring only |
| B | `SKIP_X` | 1.25 | 1.0 |
| B | `ETA_MIN`, `ETA_MAX` | none | 1.0, 5.25 |
| B | reel | 0.20, plus 0.40 per unit of negative depth | 0.24, plus 0.6 and 0.6 per unit while wide |
| B | burn warning | at depth 0.9 | 0.5 s before any burn, held or in flight |
| B | `CLOCK_K` | 0.38 | 0.175 |
| B | `HOLD_PITCH` portrait / wide | 55° / 45° | 48° / 34° |
| B | clock start | the title tap | the first grab |
| B | mercy | windows × 1.5 | also reel × 0.6 |

### Playtest round (the code now)

| Build | Check | Before | After |
|---|---|---|---|
| A | par | the graze bot | a strong human bot (150 ms, 1.5°, greed 0.9) |
| A | rank shares of par: O, B, A, F, G, K | 60, 25, 12, 5, 1.5, 0.5 % of the graze bot | 100 (and no hits), 60, 35, 18, 8, 3 % of the human par |
| A | burst | `BLEED` 0.5, 9 s of lead, a hit −0.8 s, no way to win lead back | `BLEED` 0.8, 8 s of lead, a hit −1.5 s; a graze +0.12 s, a hairline +0.25, a thread +0.5, a skim +0.2 a second, up to 9 s |
| A | burst warning | lead under 3 s | caught within 5 s, or lead under 1.75 s |
| A | hairline hit-stop | 60 ms | none |
| A | Coma's thread | η set to 2.6, then drag undid the Headlight | η at least 2.7 and the Headlight in the same step |
| A | drag gain | 0.9° per px | 0.6° per px, rising to 1.4° at 1,200 px/s |
| A | wall after the rail | beat 54.5 | beat 56, gap 90° beyond the rail, shown from 3 s out |
| A | stage and retries | 128 beats, retries from beat 0 | 125 beats, retries from beat 9 |
| A | soft start | 10 s, 7° graze band | 19 beats, 12° graze band |
| A | camera roll | up to 600°/s | up to 280°/s |
| A | idle | caught at 36 % | caught at 22 to 26 % |
| A | dodge | clears with 0.8 s | caught at 63 % |
| A | graze | lead 8.0 s, 100 % of par | clears at the 9 s cap, 265k to 280k, rank O |
| A | novice | lead 0.8 to 2.8 s | caught on 3 of 5 (at 68 to 75 %), clears with 7.7 and 1.9 s on the others |
| A | mid | lead 2.8 to 6.3 s | clears 5 of 5 with 7.5 to 9.0 s, rank A or F (33 to 46 % of par) |
| A | expert (140 ms, 1.2°, greed 0.95) | not run | O on 4 of 5, B with one hit on the other |
| B | clock | 0.175 years a second ÷ γ, from the first grab | 0.162 / η^1.75 years a second, from the first fling |
| B | catch depth | no limit: a grab at depth 0.92 to 0.98 burned 0.09 to 0.40 s later | never deeper than 0.6 |
| B | lines near a core | could grade GOOD or PERFECT | inside 0.45 R WIDE at best; into a core MISS |
| B | LET GO | when the line first crosses a band | 0.25 s before the window's best moment, never in the first 0.4 s; an approach ring from 0.75 s |
| B | first swing | full speed | half speed until the first clean release; 1.5× windows for the first two |
| B | lost | 2.2 s with nothing in reach | 0.6 s after the line can reach nothing; 5 s with nothing in reach |
| B | mercy | after 3 fails | after 2 |
| B | nine-up fanfare | on every crossing (0.9c up to 4 times a run) | on a new best only |
| B | skip | a +2 mark with no reward | SKIP +2 counts two chain links (`SKIP_X` still 1.0) |
| B | callouts | 38 % down in portrait, the centre in landscape | 74 % down in portrait, high in the middle on wide screens |
| B | exact | 48 to 63 s, 0.84 to 1.18 yr | 51 to 60 s, 0.88 to 0.96 yr, 0 rewinds, LIGHT SPEED at mass 7 or 8 |
| B | greedy 60 ms | median 1.89 yr, up to 4 rewinds | median 1.91 yr (1.26 to 3.77), up to 3 rewinds |
| B | first 110 ms | 38 to 61 s, 4.04 to 6.65 yr, up to 8 rewinds | 29 to 36 s, 4.05 to 5.17 yr, up to 2 rewinds, no LIGHT SPEED |
| B | exact ÷ first clock | 0.24 | 0.19 |
| B | first-timer following the cues 200 to 300 ms late | reaches mass 1 to 3 in 60 s, with 10 to 12 losts | first fling GOOD or PERFECT, past the fork in 35 to 44 s, home in 56 to 84 s |
