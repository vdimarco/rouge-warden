# Light Years Home lab v2 design

## Source and scope

The lead designer's final for v2 (2026-10-13) is the contract. It came from five pitches and three judges (fun, fit and
build risk), with numbers from the pitches' own sims. All numbers here are starting values: the bots and the playtest
replace them. Where the design is unclear, the builder picks what makes the game more fun and notes it below.

Two pitches won clearly, and each judge picked the same pair:

| | A. LIGHT YEARS AHEAD (steer and skim) | B. SLINGSHOT HOME (grab, whip, let go) |
|---|---|---|
| Verb | Continuous steering round a ring | Hold to grab a mass, lift to fling |
| Camera | Forward down a tube, as in the video | North-up chase over a course, never turns |
| Speed comes from | Near misses (grazes) | Deep, well-aimed releases |
| Speed does to you | Makes it harder: the ring shrinks, the beat speeds up | Makes it faster and your clock slower |
| Failure | The burst's light catches you | A burn or getting lost; a rewind costs time |
| Score | Points × γ, a spectral-class rank | Your own clock: years aged |
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
  input while the game switcher is open.
- **Tuning and logs.** Every `TUNE` key can be set from the URL, plus `seed`, `debug`, `toy` and `bot`. The last 20 runs
  stay in `localStorage` (`lyh-lab-a-runs`, `lyh-lab-b-runs`) and the result card has Copy log, so testers can paste
  their runs back. Nothing is sent anywhere.
- **Reduced motion** turns off shake and FOV kicks and softens flashes. In A it also picks the fixed camera.
- **Haptics** use `navigator.vibrate` where it exists. iPhones get sound only.

## Decisions for A

- **Tube geometry.** Hazards sit on a tube wall at a bearing. The camera looks down the tube from the ship's depth, and
  Penrose's aberration puts everything beside the ship on one circle of radius f / sinh φ: the ring. The future is
  inside it and the past outside, so collisions happen on the ring.
- **Two rapidities.** The sky uses the true speed, capped at φ 3.0 (4.0 for 1 s in the Headlight punch). Hazards and
  the ring use a rapidity that eases from 1.0 to the floor's, so the ring shrinks only from 42 % to 30 % of the short
  side, never under 112 px. The risk judge found that at the pitch's speeds a hazard was readable for only 0.27 to
  0.35 s; at 1.6 to 2.25 R/s it is past 30 % of the ring for 0.81 s at cruise and 0.60 s at top speed.
- **Reading aids.** Ticks on the ring 1.3 s out, true-width outlines from 1.2 s, an orange tick on a graze line, and a
  red chevron plus a lane alarm 0.9 s before a hit. Two senses, at least 0.3 s ahead.
- **The script is in beats.** Course speed is tied to tempo (0.86 R per beat), so every hazard passes on its beat at any
  speed, and the music can follow the simulation's beat clock. No input is judged by ear, so audio lag cannot make it
  unfair.
- **Speed is risk.** Grazes, hairlines, rail skims and gate threads add speed. Faster shrinks the ring and lifts the
  tempo by up to 40 %. Slow is dangerous too: the burst's light gains at (1 − β)c.
- **Soft failure first.** For the first 10 s a hit is a bump. A hit costs one gear, not half the speed. After two
  catches in a row the next try gets 2 s more lead.
- **Rank by par.** Par is the graze bot's score on the same seed, run headless at stage start (about 8,000 steps). The
  spectral classes O to M are coloured by `blackbodyRGB`.

## Decisions for B

- **One camera that never turns.** North-up chase, pitched lower in flight and higher during a hold so the orbit and the
  next ring are in view. The world never spins while you orbit; the squeezed sky swings round like a lighthouse, which
  is real. `?cam=chart` is the fallback.
- **A physical grab.** The grab locks at your current distance, and its cost depends on how much you were heading at
  the mass. So the press has its own skill: press as the mass comes alongside.
- **Depth is time.** Holding reels you in; deeper orbits sweep the release line faster and slow the world to as little
  as 40 %. Each mass gives one or two windows toward any target, so "one more lap?" is a real choice.
- **Plain preview line.** It is not coloured by grade; the bullseye is the orange band you can see on the next ring.
  `?cue=1` colours it for comparison.
- **Physical focusing** bends every line toward a nearby mass the same way, whatever its grade.
- **Your clock is the score.** Going faster keeps you young: the twin paradox, which anyone gets. Lower is better.
- **Rewind, not game over.** A burn or a lost rewinds 0.9 s to just before your last grab. The clock never rewinds, so
  a mistake costs time, not a life.
- **Instant sound.** Nothing is quantised to a beat, so every grab and release answers at once.

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
- **B's swing.** Sling Drift (Ketchapp) and Tiny Wings (Andreas Illiger, 2011): hold for tension, let go on the line.
  The Lab's Threadwake taught that a tether must keep its length.
- **B's camera.** The north-up chase of top-down orbit games. No single source fit, so the risk judge's rule decides
  it: one camera that never turns.
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

- Node tests: `qa/light-years-home/lab-a.test.mjs` and `lab-b.test.mjs` cover determinism, the bot spread, warnings
  before every hit or burn, the first input timing, retry timing and 10,000 random steps.
- Browser checks drive `window.__lab` and take screenshots at 390×844, 844×390 and 1440×900. SwiftShader is slow, so
  feel is judged from the simulation and event timings, and screenshots judge look and layout.
- The chooser was checked in Chromium at all three sizes: no sideways scroll, every target at least 44 px, no
  AudioContext, `noindex`, quiet.js first, the keys, the switcher and blocked storage.
- **Not checked in this sandbox:** real touch latency, phone audio and the silent switch, haptics, and real-phone frame
  rates. The playtest covers them.

## Tuning log

Each build records its bot numbers here before and after tuning.

| Build | Check | Before | After |
|---|---|---|---|
| A | | | |
| B | | | |
