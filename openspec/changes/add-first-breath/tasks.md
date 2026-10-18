# Tasks

Tick a task only when its work is done and its checks pass. Group 1 goes first, checks the race numbers with the race sim, and freezes the build contract
(design.md section 16). After it, the stage sub-groups in group 2 run in parallel, one agent each, and groups 3 and 4
run beside them. Each stage agent edits only its own files (design.md 16.12). Groups 5 to 7 come last. Every stage is
built to its v1 form (design.md section 6); the items in design.md 19.2 are not built in this change.

## 1. Shared core and the build contract (wave 0)

- [ ] 1.1 Create `public/first-breath/` with skeletons of `index.html` (`/arcade/quiet.js` first in `<head>`, then `/arcade/switch.js`; `canvas#view`, `svg#rings`, DOM HUD and screen roots; the title's Play button `#play`; `/arcade/analytics.js` with `data-game="first-breath"` at the end of `<body>`; `viewport-fit=cover`; `touch-action: none` on the play area) and `style.css`, and the folders of design.md 16.1.
- [ ] 1.2 Write `core/rng.js` (wrapping `../../lab/kit/rng.js`), `core/clock.js` (`DT`, `week`, `label`, `range`, `gaAt`, `mmPerShortAxis`, `bpmYou`) and `core/beat.js` (`makeBeats`, with `first` for her phase).
- [ ] 1.3 Write `core/judge.js` (windows, credit, `GRACE_S`, `median`) and `core/lib/track.js` (targets with `P`, `feed` with `errMs` and `rawMs` and the miss grace, `upcoming`, `accuracy`, `streak`).
- [ ] 1.4 Write `core/intent.js` (times with `t` and `raw`), `core/draw.js` (`LIMITS`, `validate`, with `scale` and `cue`), `core/events.js`, `core/carry.js` (`DEFAULT_CARRY` with `sperm: { hue: 0.11, place: 3, glow: 0.5 }`, `DEFAULT_SONG`), `core/score.js`.
- [ ] 1.5 Write `core/text.js` (carer words, `say`, `allStrings`), `core/sources.js` (the allow-list from `research/research-biology.md` section 12 and its inline URLs), `core/facts.js` (the aggregator, labels from `clock.label` and `clock.range`) and `core/save.js` (schema, `parse`, records, `recordCarryIn`, `cabinetLine`).
- [ ] 1.6 Write the shared lib: `core/lib/goals.js` (`subgoals` as `{ id: "shown" | "done" | "auto" }`), `steer.js`, `flow.js`, `colonize.js` (caps built in) and `figure.js` (at most 14 splats, no face, buds that grow from 2 to 10 mm).
- [ ] 1.7 Write `core/stages/index.js` with 8 stub stages that follow the Stage interface, with `meta.moments` from the design.md 4.1 table and `meta.motherBpm` (each a timer that completes with `goalMet: true`; the `swim` stub ends at its cap with `goalMet: false` and has the `carried` moment; every stub exports `probe`, which returns null), and a stub `core/ending.js`, each with `.tune.js`, `.facts.js` and `.text.js` files that export empty `TUNE`, `FACTS` and `TEXT`.
- [ ] 1.8 Write `core/run.js` (the sequencer: stages, overlay, Almost card (on a stage 1 result with `goalMet: false`: a finish outside the top 3, or the cap), cards over the crossfade, ending, result, retry, Go on through `jump("carried")`, practice, run time; the stage time base; her continuous beat clock with `motherPhase`; the one-button rule of design.md 16.4) and `core/bots.js` (`createBot(skill, seed)` → `{ intents, choose }`, with the Gaussian timing model).
- [ ] 1.9 Write `ui/input.js` (the one-pointer state machine with the 220 ms and 12 px numbers, the floating stick, keys with the drag-and-hold key rule, `setLive(gesture, keys)` with the `keys: "turn"` mode of design.md 5.3, `turn` from the left and right arrows or A and D, `aim` from a mouse with no button down only after a 4 px move and cleared by any steer or turn key, a hold that needs a fresh press, one-button presses, event timestamps mapped to core time with `raw` and the offset), `ui/store.js`, `render/camera.js` (`long` and `fit`; in `long` the subject at 45% of the height in portrait, at 38% of the width and 55% of the height in phone landscape, and at 40% of the width on desktop; a rotation with no mirror, so `turn` +1 decreases the world angle), `render/palette.js` (the hex colour script) and `render/debug.js`.
- [ ] 1.10 Write no-op stubs with the frozen signatures of design.md 16.2: `render/renderer.js` (drawing with `debug.js`, with `perf` and `crossfade`), `ui/hud.js` (with `place`), `ui/captions.js`, `ui/screens.js` and `ui/sound.js`.
- [ ] 1.11 Write `main.js`, fully wired to every module through those signatures: boot, URL flags (design.md 16.10), the 60 Hz fixed step, run ↔ render ↔ ui, sound scheduling from `run.beats()`, captions, screens, pause on Esc, P, the pause button, `visibilitychange` and `pagehide` (not `blur`), `place` events to the HUD, and `window.__fb` with every member of design.md 16.9, including `race()` and `guard()`, which map the current stage's `probe(state)` from world units to screen px (stage time throughout).
- [ ] 1.12 Pass `purity.test.mjs`, `clock.test.mjs`, `beat.test.mjs`, `judge.test.mjs`, `track.test.mjs`, `draw.test.mjs`, `save.test.mjs` and `run.test.mjs` against the stubs (including the stage time base, the clock that never runs back, and her beats across cards), and check that the page boots through all 8 stub stages to the result with the stub renderer.
- [ ] 1.13 Write `qa/first-breath/race-sim.mjs`, a stand-alone numeric model of the design.md 6.1 race with bumps, the gate squeeze, shared wave thresholds, glow rests, catch-up and the rival policy. Print the place distribution and arrival times over 20 seeds for the ref, mid and idle players and every rival. Freeze the 6.1 numbers only when the ref is 1st and the mid bot in the top 3 in at least 18 of 20 seeds, with the mid's mean arrival at 55 to 65 s; if not, tune in the order 6.1 gives and record the new numbers there.
- [ ] 1.14 Freeze design.md section 16. Any later change to it is made by the contract owner and noted in this file.

## 2. Stage modules (wave 1, in parallel)

Each stage agent owns `core/stages/<id>.js`, `<id>.tune.js`, `<id>.facts.js`, `<id>.text.js` and
`qa/first-breath/stage-<id>.test.mjs`, and builds the stage's v1 form from its design section with the numbers in its
tune file. Every stage test asserts determinism, the scripted ideal input reaching Glowing, idle ending by the cap, one
live gesture per moment, at most two families (three for `egg`), every sub-goal ending `done` or `auto`, targets that carry `P`, and
moments that match the design.md 4.1 table. Every stage exports `botSteer`; the run uses it for one-button mode.

### 2a. The Race (`swim`, design 6.1): one builder

- [ ] 2.1 Build the course of design.md 6.1: the womb with waves that lift only a swimming sperm (shared thresholds from `stream(seed, "wave:" + k)`), the gate, the fork with the seeded warm side and the 160 u cool loop with its 40 u/s flow that rejoins at 1,300 u, and the tube with its current profile, upstream bonus (tube only), warm lane (tube only, current halved), wall slide, checkpoints and the meeting place at 4,600 u; the camera spans (170 u, then 150 u) with sideways follow; the `course` strips and wave `band` marks of design.md 16.5.
- [ ] 2.2 Build the 19 rivals: the skill ladder (0.80 and 0.76; 0.42 to 0.27; 0.24 to 0.04) seeded onto the start grid, one steering function shared with `botSteer` (stick magnitude 0.4 + 0.6 × skill, memory in `r.mem`), the cool-tube choice, glow rests and ready for the two front-runners only, resting when in the tube and 500 u or more behind you, the mild catch-up on the stick term, and soft bumps (circle against circle, the push apart every step, the speed loss at most once per 0.4 s) between every pair of swimming sperm.
- [ ] 2.3 Build the glow walls with the attach rule and "ready" (×1.6 on the stick term, on her 4th beat attached), the checkpoint rests by the same rule, the place (`placeNow` by progress, arrivals by time, the shown place after a 0.25 s hold, `place` and `arrive` events), the `meet` moment, the result outside the top 3 and at the 117 s cap for the Almost card, the `carried` moment for Go on after the cap, `probe`, and Assist.
- [ ] 2.4 Write the score (place, wave riding, warm lane, ready; 1st place as the Flourish), the carry out (`sperm` with `place`), `botSteer`, the facts (with `swim.hyper` and `swim.frame`, without `swim.race`) and the strings.
- [ ] 2.5 Pass `stage-swim.test.mjs` with the race checks of design.md 18: rival determinism over 20 seeds, the place at every step and its 0.25 s hold, bumps, the cool loop back within 6 s, the lane faster than the wall, the attach rule and ready, ready rivals only among the front-runners, resting rivals, the ref bot 1st arriving at 44 to 54 s, the mid bot in the top 3 with a mean arrival of 55 to 65 s, idle never past the gate and ending at the 117 s cap, no stage time past 120 s, and no harm in any event or string. If a time gate misses, tune in the order of design.md 6.1 and record the numbers there.

### 2b. The Egg (`egg`, design 6.2): one builder

- [ ] 2.6 Build the opening, laid from `motherPhase`: `surge` (beats 1 and 2, no input), `open` (beats 3 to 8; the third good tap or beat 8, "It opens anyway.") and the 2 s `sweep`; "Now you are the egg." as the first caption when there is no card.
- [ ] 2.7 Build `guard` at a 140 u span with keys `turn`: the 8 waves with their counts, speeds and angles; the arc (stick angle, `aim`, `turn` at 540°/s, Assist width) and the rule for the arc over a sperm (angle within the half-width, head within 22 u, checked every step, by sperm state); bounces; sticking with burrow rings; popping loose; held rivals in the cloud; and your gold sperm (`goldIn` at 27 + 0.3 × (place − 1) s, its angle from the 72 seeded candidates of design.md 6.2, "Let it in.", up to 3 nudges, entry by 52 s at the latest).
- [ ] 2.8 Build `enter` (Izumo1 meets Juno), `seal` (her beats counted from 0.6 s after the prompt, the release target on the 3rd, only a press after the prompt counting, the wave both ways round the shell from the entry point, the others drifting off, the seal by itself on the 6th counted beat or with a hold still down), the 5 s `fusion` with input `none`, and the clock turning to "Day 0 after fertilization (week 2)" when the nuclei touch.
- [ ] 2.9 Write the score (follicle taps; the guard credit, leaving out rivals still swimming in or burrowing at entry; a clean entry, paid only when the guard credit is above 0; the seal Flourish of 1,000 In time and 500 Close), `botSteer` for the arc (the nearest rival that is not gold, turning the way that avoids the gold zone, memory in `r.mem`), `probe`, the facts (with `egg.zona`, `egg.corona`, `egg.choice` as a general fact in the guard, `egg.stick` on the gold's stick, `egg.wave`, `egg.seal` and `egg.frame`, and (f) only from `egg.pronuclei` on) and the strings.
- [ ] 2.10 Pass `stage-egg.test.mjs` with the guard checks of design.md 18: the surge before any target, the first payoff by 4.5 s, the opening by 8.9 s, the arc over each kind of sperm (bounce, pop loose, nudge, ignored), held rivals never entering, exactly one `enter` for every input (including the arc held on your sperm), the gold's time for places 1, 3 and 20, a gold angle always found, at most 3 nudges, the seal's fresh press, grades, Flourish and auto seal, the guard credit rules, the ref bot with 0 nudges, and the turn-keys bot reaching Great.

### 2c. The Embryo: first cells (`split`, design 6.3)

- [ ] 2.11 Build 4 days of splits on schedule with approach rings and 12 targets.
- [ ] 2.12 Build Bloom and Hatch as hold-release targets released at the glow, with the 0.25 credit for a held Off release and no mash.
- [ ] 2.13 Write the score, the facts and the strings.
- [ ] 2.14 Pass `stage-split.test.mjs`, including "Off taps never reset a count".

### 2d. The Placenta (`root`, design 6.4)

- [ ] 2.15 Build `nestle` (3 spots, sink in 2 s, the nearest spot after 8 s idle) and the carry out `nestleX`.
- [ ] 2.16 Build `roots`: the steered tip, space colonization within its caps, 8 gland pools that swell on the mother's beat, on-beat links, and the auto-link every 3.5 s from 12 s.
- [ ] 2.17 Build the `heart` hinge (the hush, the two captions, 8 targets at 110 bpm, then both hearts) and the 7 s `grow` moment (buds from 2 to 10 mm, the camera to 30 mm, the tree into a disc, `root.size` and `root.buds`); carry out `treeSeed`.
- [ ] 2.18 Write the score, `botSteer`, the facts and the strings, and pass `stage-root.test.mjs` (no red pools; all 8 linked by 40 s idle; the clock at week 7 at the end).

### 2e. First Trimester (`grow`, design 6.5)

- [ ] 2.19 Build 7 weekly phrases on the player's heart with the gap patterns, the cord lights and the preview rule.
- [ ] 2.20 Build the 6 move moments (weeks 8 to 13) with the drag cone and the 3 s self-play, the week 10 fetus line, and the week 12 red pools with `grow.flow` and `grow.never`.
- [ ] 2.21 Write the score, `botSteer`, the facts and the strings.
- [ ] 2.22 Pass `stage-grow.test.mjs`, including spacing ≥ 0.5 s at 170 bpm and the tempo curve.

### 2f. Second Trimester (`answer`, design 6.6)

- [ ] 2.23 Build `hear`, the 8 heartbeat targets (weeks 15 to 18), and the 6 call-and-response phrases from week 19, one note slot per beat, with ripples and ghost ripples.
- [ ] 2.24 Build the match rule, "{Carer} feels you." and the hand glow from phrase 2, the eyes opening by themselves, and the carry out `song`.
- [ ] 2.25 Write the score, the facts and the strings.
- [ ] 2.26 Pass `stage-answer.test.mjs`, including "the voice never stops" and no phrase before gaDay 133.

### 2g. Third Trimester (`turn`, design 6.7)

- [ ] 2.27 Build the 4 practice breaths as press and release targets, with the ring that shrinks anyway.
- [ ] 2.28 Build the turn with roomy moments and the turn by itself at 30 s; then the unscored rest with the hummed song and the outro.
- [ ] 2.29 Write the score (Flourish: the turn done yourself before 30 s), `botSteer`, the facts and the strings.
- [ ] 2.30 Pass `stage-turn.test.mjs`, including "nothing is judged in the rest".

### 2h. Birth (`birth`, design 6.8)

- [ ] 2.31 Build 8 waves on schedule with warning rings, plain hold waves and the four drag-and-hold prompt waves on screen axes, `turnDir`, and rested gaps.
- [ ] 2.32 Build the squeeze values and the light (the full-width bottom glow, exposure, white, the sound opening) and the `born` milestone.
- [ ] 2.33 Write the score (never shown at the stage end), `botSteer`, the facts and the strings.
- [ ] 2.34 Pass `stage-birth.test.mjs`, including "every wave moves you on with no input".

### 2i. The ending (`ending`, design 6.9)

- [ ] 2.35 Build the timeline: the 1.5 s silence, "Breathe.", the optional hold, the breath by itself at 3.0 s with its caption, two more breaths, skin-to-skin with her heart close and clear, "Rest your thumb here." with its ring placed by layout, the clear song and the run time line.
- [ ] 2.36 Pass `ending.test.mjs`: no `points` event, the breath by itself at 3.0 s, results only after skin-to-skin, her beats silent only in the first 1.5 s.

## 3. Presentation (wave 1, beside group 2)

- [ ] 3.1 Write `render/gl.js`, `field.js` (the splat pass with circle and capsule kernels, mips), `composite.js` (warp, threshold, transmittance, back-light rim, glow from mips, caustics, tint, vignette, exposure, white), `overlay.js`, the crossfade, and `perf.js` (the frame cost with `gl.finish()` under `?probe`, `emaMs`, `p95Ms`, per-axis scale steps and the step rules), filling the `renderer.js` stub and naming each source in a comment as in design.md 14.2.
- [ ] 3.2 Write the strips (`tails` with the halo and dashed rings, `cilia`, `tree` with the arc-length pulse and a cached texture, `cord`, `chevrons`, `ripples` with the contact rings, `arc` for the guard arc and the seal wave, after Quilez's `sdArc`, and `course` for the stage 1 path, tubes and loop), the `band` mark for the waves and the meeting place, and `render/rings.js` (DOM SVG rings with halos, and the dotted and dashed burrow rings, at most 8 in all).
- [ ] 3.3 Write `render/flat.js`, the plain-shape Canvas 2D fallback of design.md 14.3, and the fallback triggers.
- [ ] 3.4 Fill `ui/hud.js` (16 px text; the place slot under the score in stage 1; the scale bar top left in portrait, bottom left elsewhere; the subject's size in stages 1 and 2), `ui/captions.js` and `ui/screens.js` (title with the content note and `#play`, card, overlay, Almost card with the place, pause, settings with the carer word, the Tap test, the offset and the weeks line, Stages, Sources, run result with "What was real"), and `style.css` for the three layouts (captions at 50 to 58% in portrait, one line for 2.5 s in stage 1, at 18 to 26% in stage 2, one line in stage 2 landscape, nothing to read below 60%), safe areas, Large text and focus rings.
- [ ] 3.5 Fill `ui/sound.js` against an injected AudioContext and `latencyS` (her heart with harmonics, souffle, the sine-hum voice, your heart, one-shots, the womb bus with the cutoff table, the birth bus, the race and guard cues of design.md 11 for bump (softer for rivals near you, from its `x, y`), place, ready, bounce (a step higher per `wave`), stick, loose, `goldIn`, enter and seal, the lookahead scheduler fed by `run.beats()`).
- [ ] 3.6 Wire reduced motion, the flash rule, the stage crossfade and the scale bar; tune every stage's look against its colour-script row by frozen frames, so the cue is the brightest thing and the stage means rise.
- [ ] 3.7 Draw `public/arcade/key/first-breath.svg` by hand (viewBox `0 0 480 396`, under 10 KB, no script, no external reference, no text).

## 4. Arcade integration

- [ ] 4.1 Copy the `ahead-of-the-light` article in `#row` of `public/index.html` whole and place the copy after it, with the names replaced (class, `data-game`, `data-url`, `aria-label`, marquee, `.hi`, the `.hi` attract line RACE · GUARD · GROW · BREATHE, both slot labels "Drop a token into First Breath", and the SVG `<img>` with its alt and `loading="lazy" decoding="async"`); add the `.cab.first-breath` colours; append `"first-breath"` to the Action group's `games`.
- [ ] 4.2 Add the cabinet best-line block after the Ahead of the Light block in `public/index.html` (BEST, else the plain line RACE · GUARD · GROW · BREATHE, inside try/catch).
- [ ] 4.3 Add the `GAMES` entry in `public/arcade/switch.js` after Ahead of the Light, with `color: "#ff9a7a"`.
- [ ] 4.4 Update `qa/arcade/groups.e2e.mjs` (Action shows eight games), `qa/arcade/machines.mjs` (the key `first-breath.save.v1`, the wanted line "BEST 61,240", the plain line RACE · GUARD · GROW · BREATHE for the junk cases, the SVG size check) and `qa/arcade/quiet.mjs` (a page entry for `/first-breath/` that presses `#play`).
- [ ] 4.4b Add a part `firstbreath` to `qa/arcade/machines.mjs` (`PARTS=firstbreath`) at 390 × 844, 320 × 568 and 1280 × 720. It opens `#action` and asserts that the last visible cabinet is `first-breath`, inside the window and not under the sign or the tray; that `.slot`, `.start`, `#prevBtn` and `#nextBtn`, every `.section-nav button` and `.all-games` are each at least 44 px on the shorter side; that START goes to `/first-breath/`; that the `.hi` line stays inside the cabinet's `.screen`; and that the other groups' members are unchanged. With `SHOTS` set it saves `home-390.png`, `home-320.png` and `home-1280.png`.
- [ ] 4.5 After the first commit of `public/first-breath/`, regenerate `public/arcade/game-dates.json` with `node qa/arcade/game-dates.mjs` and pass `node qa/arcade/game-dates.mjs --check`.

## 5. QA

- [ ] 5.1 Pass `facts.test.mjs` (including no text that starts with Week or Day, spans on one side of gaDay 42, and `swim.frame` and `egg.frame` on the run result), `text.test.mjs` (banned words, including invad…, invas…, attack…, destroy…, defeat…, conquer…, enem…, fight… and battle…, and pronouns with all four carer words; no "fastest", "winner", whole-word win, wins or won, "beat the" or "beats the" in stages 1 and 2; sentence length; Apgar only in `end.apgar`) and `palette.test.mjs` (3:1 in normal, protan, deutan and tritan views; warm chromatic ending hues; stage backgrounds rising).
- [ ] 5.2 Pass `perf.test.mjs` (p99 step ≤ 1 ms per stage) and `sim.test.mjs` (the bot gates of design.md 18, with the stage 1 race gate, 20 seeds × 4 skills, under 120 s wall time), and write `bot.mjs`.
- [ ] 5.3 Pass `smoke.e2e.mjs` (first 10 seconds, every stage via `goto`, `?gl=0` per stage, the bot to the result, no console errors).
- [ ] 5.4 Pass `layout.e2e.mjs` at 390 × 844 and 844 × 390 with touch and at 1440 × 900, with `?inset=47,0,34,0`, including the thumb reach (`anchor.y ≤ 0.60 × H`), the caption band, the scale bar's place, the stage 1 place slot, the fork in view 1.5 s before the split, the stage 2 egg, arc and gold sperm in the free part of the screen (140 u span; 55% of the height in landscape), the gold's path in portrait never under a caption or below 60%, and the ending's thumb ring in portrait and landscape.
- [ ] 5.5 Pass `input.e2e.mjs` (stick, second pointer ignored, keys only, a dragging press judged at touch-down, an arrow keydown in drag-and-hold as a press with its dir, Space alone as a plain hold, landscape touch in stages 1, 2 (the arc and the seal), 4, 5, 7 and 8, a stage 1 mouse drag on desktop, the stage 2 arc by touch drag (portrait and landscape), mouse aim after a 4 px move, the turn keys at 540°/s, W, S, up and down doing nothing in the guard, a parked cursor that never pulls the arc back, a fresh press for the seal with the thumb or one-button Space held from the guard, one-button through stages 1, 2, 4, 5, 7 and 8, hidden page pauses, M writes `arcade.sound`, muted rings in `svg#rings` in stages 2 and 6).
- [ ] 5.6 Pass `perf.e2e.mjs` (`p95Ms ≤ 12` at the pinned steps), `visual.e2e.mjs` (including the brightest cue and the light rising) and `sound.e2e.mjs` (including `latencyS` 0.04 and no beat jump across a card) with the SwiftShader flags.
- [ ] 5.7 Run `node qa/arcade/machines.mjs` (all parts, then `PARTS=firstbreath` with `SHOTS` set for the three homepage screenshots), `node qa/arcade/groups.e2e.mjs` and `node qa/arcade/quiet.mjs` with the site served.
- [ ] 5.8 Run `shots.mjs` for every stage at the three layouts and review them by eye against the colour script and the tone rules.
- [ ] 5.9 Read every string in the game against the tone rules (a human read), and check every fact against its source and its entry in `research/research-biology.md`.
- [ ] 5.10 Review the WHO weight corrections (2017 and 2021), starting from `research/research-biology.md` section 7. Set `turn.weight` to `checked: true` only if the numbers hold; else leave it out.

## 6. Docs

- [ ] 6.1 Add a README section for First Breath (what it is, the eight stages, the controls), rows in the file table for `public/first-breath/`, `public/arcade/key/first-breath.svg` and `qa/first-breath/`, and the test commands.
- [ ] 6.2 Add one line to AGENTS.md under the Cursor Cloud instructions: "- First Breath (`public/first-breath/`): `for f in qa/first-breath/*.test.mjs; do node $f || echo FAIL $f; done`. Bot runs: `node qa/first-breath/bot.mjs 20 0.7 1`. Browser checks need the server: `NODE_PATH=qa/browser/node_modules node qa/first-breath/smoke.e2e.mjs`, and `layout.e2e.mjs`, `input.e2e.mjs`, `perf.e2e.mjs`, `visual.e2e.mjs` and `sound.e2e.mjs` the same way."
- [ ] 6.3 Write the pull request description: what changed, the screenshots `home-390.png`, `home-320.png` and `home-1280.png`, the checks that ran, what was deferred (design.md 19.2), and plainly the checks that did not run (real phones, touch latency, phone speakers, the iPhone silent switch).

## 7. Validation and archive

- [ ] 7.1 Run `npx -y @fission-ai/openspec@1.14.3 validate add-first-breath --strict` and fix every error.
- [ ] 7.2 Test the code against every scenario in the six capability specs and tick each task only when its checks pass.
- [ ] 7.3 Keep design.md and the specs current with what was built, including any item taken from the cut list.
- [ ] 7.4 Archive the change with the OpenSpec CLI once every task is done, and review the canonical specs it writes to `openspec/specs/`.
