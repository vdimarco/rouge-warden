# First Breath: design

Id `first-breath`, route `/first-breath/`, change `add-first-breath`. This is the final, buildable design. It starts
from the winning "Arcade anthology" design (8 stages in the user's order, a score per stage, one camera, one heartbeat)
and grafts the best parts of "Phone-first heartbeat" (the first 10 seconds, real heart rates as the difficulty curve,
the fair timing judge, the first-heartbeat hinge, the lull before labour, the ending) and "One continuous journey"
(one gaDay clock, felt sound before ears, the egg as an active caller, development that never fails). Section 1.2
records how each judge conflict was settled.

This change builds the **v1 form** of each stage: its minimum form plus its best one or two flourishes (section 6).
Section 19.2 lists what is deferred. The research behind the design is in this change folder:
`research/research-biology.md` and `research/research-art.md`.

Plain words and short sentences are the house style. The same rule applies to every string in the game.

## 0. Summary

- **What the player does.** You live a baby's nine months from the inside, in 8 short stages and an ending: swim as a
  sperm cell, call it in as the egg, split as the first cells, grow roots into the placenta while your body takes
  shape, grow with your new heart, answer your mother's voice, turn and practise breathing, ride the waves of birth,
  then take your first breath.
- **One verb at a time.** Each moment has one live gesture (drag, tap, hold, or drag-and-hold), and the prompt names it.
  Four feel families across the run: analog steer, beat tap, hold-release and rotate. No stage has more than two.
- **One heartbeat.** Your mother's heart keeps time from Play to the end, also between stages. Your own heart joins on
  Day 22 after fertilization (week 5) at 110 bpm, peaks at about 170 bpm in weeks 9 to 10, and eases. The tempo is the
  difficulty curve. Her heart quickens in labour.
- **Nothing fails after fertilization.** Division, implantation, the placenta, the heartbeat, growth, turning, birth and
  the first breath all happen on schedule. Skill only changes the score. Only stage 1 can end in "Almost. Try again?".
- **A score worth chasing.** Every stage scores up to 10,000 points (Goal 3,000, Skill 6,000, Flourish 1,000) with the
  grades Good, Great and Glowing. A run total, a run time, a best per stage and a Stages menu for practice.
- **About 9 minutes** for a mid player. No stage runs past 2 minutes.

## 1. Our choices

The user gave no art direction, no controls preference and no arcade row. These choices are ours.

### 1.1 Choices table

| Topic | Our choice | Why |
|---|---|---|
| Title | **First Breath** | It names the ending that the whole run climbs to. |
| Subtitle (`<small>`, switcher `sub`) | **A baby's journey to birth** (marquee: A BABY'S JOURNEY TO BIRTH) | Short for the marquee. All Games search finds "baby" and "birth". |
| Tagline (title screen) | "Nine months. Eight small stages. One first breath." | |
| Cabinet attract line | **SWIM · SPLIT · GROW · BREATHE** | Four verbs from the run. |
| Row | **Action**, the last machine, after `ahead-of-the-light` | A real-time skill game with a score chase. Primordia, the other cell game, is in this row. |
| Art direction | **"Warm Lantern"**: soft translucent membranes lit from behind, plum shadows, coral and amber bodies, cream rims. Light rises from dim red to amber to white at birth. Abstract baby figure with no face. | Light through tissue is red (d'Eon and Luebke). It reads as calm and inside. No realistic fetus portraits: Nilsson-style images now read as political (`research/research-art.md` B7). |
| Controls | One live gesture per moment: drag anywhere (relative stick), tap, hold, or drag-and-hold. Keys only on desktop. One-button mode in every stage. | One thumb on a phone in portrait. No guessing between tap, hold and drag. |
| The person carrying the baby | **"your mother"** by default. Settings offer **mother, mum, mom, parent**. No string uses a pronoun for this person. | See 1.3. |
| Week convention | **"Week N"** = N whole weeks since the first day of the last period (gestational age), as the NHS pages, midwives and doctors use. After fertilization, early stages show "Day N after fertilization (week M)". | One clock. See section 4. |
| Grades | **Good / Great / Glowing**, points out of 10,000 per stage | Rhythm Heaven style. Never Apgar: a real Apgar of 3 describes a baby in trouble. |
| Cabinet art | A hand-drawn SVG, `public/arcade/key/first-breath.svg`, under 10 KB | The cabinet does not wait on the renderer. |
| Scope | **v1**: each stage's minimum form plus its best one or two flourishes | Eight stages in one pull request, built in parallel. Section 19.2 lists what waits. |

### 1.2 Judge conflicts and how we settled them

| Conflict | Decision | Why |
|---|---|---|
| Journey's egg-first scent trail vs the user's order (sperm first) | The user's order wins: stage 1 sperm, stage 2 egg. The trail moves into stage 2: the egg's on-beat puffs widen the gold trail that your waiting sperm follows to you. | The user's order is a requirement. The idea (the egg is active, its puffs shape the meeting) survives. |
| Pause on window `blur` (fun judge) vs not on blur (feasibility judge) | Pause on `visibilitychange` (hidden) and `pagehide`, on Esc or P, and on the pause button. Not on window `blur`. | On phones every app switch and lock fires `visibilitychange`. `blur` also fires on desktop when focus moves to devtools or another window while the page is still visible, and it makes headless runs flaky. |
| Fixed step 1/120 s (heartbeat) vs 1/60 s | 60 Hz fixed step. Input carries its own time stamp with sub-step precision. | Half the node cost, and the judge never quantizes to the step. |
| Score shape: points and grades, Ten Lights 0 to 2, or "APGAR" | Points out of 10,000 per stage, Good / Great / Glowing. Apgar appears only as a sourced fact after the ending. | Real spread for a score chase. No health-score framing. |
| Breath comes by itself after 6 s (heartbeat) or 10 s (journey) | It comes by itself 3 s after the prompt. | Fidelity must-fix: no wait with a newborn who is not breathing. |
| Stage 1 can end in "Almost" vs "no lose state, assist completes at the cap" | Stage 1 ends at its cap with "Almost. Try again?" and two buttons: Try again, and Go on (the waves carry you on, no goal points). All other stages complete by themselves at their cap. | Fun judge allows a gentle retry only before fertilization. Feasibility wants a hard cap. Both hold. |
| White blood cells as obstacles (anthology) | Dropped. | The mother's body is never an obstacle. |
| Start in the cervix (anthology) | Start in the wide space of the womb, with no anatomy labels. | Fidelity must-fix. |
| Ultrasound scan fan in the first trimester (anthology) | Dropped. Reflex moves are shown from the baby's own view. | Clinical, outside-in frame. |
| Hatch by mashing (anthology) | Hatch is a hold-release. | No mash input. |
| Anthology stage 5 swipes (±70 ms, 1-beat preview) | Replaced by your-heart taps plus drag moves. Windows never get tighter. Preview is at least 2 beats. | Smooth curve. |
| Reid 2017 face-light mechanic | Dropped. | Only a press summary (S) was read, and the result is contested. |
| WHO weights (1.2 kg, "about triples") | Not shipped until the 2017 and 2021 corrections are reviewed. The fact has `checked: false`, and the facts test leaves unchecked facts out of the game. | Fidelity must-fix. |
| Mother's heart quickens in labour to 92 bpm | Kept as our artistic choice, labelled as such here. | It marks the squeeze. No fact claims it. |
| Sound "felt, not heard" before week 15 | Kept as our artistic choice. | No ears yet. The mix shows hearing growing. |
| 10 scenes (heartbeat) or 6 chapters (journey) | 8 stages, one per phase the user named, plus an unscored ending. | Matches the user's list one to one. |
| Answering hummed phrases from week 16 (review) | Phrases start at week 19, when one study saw the first response to sound (PMID 7979483). Weeks 15 to 18 are heartbeat taps only. | Fidelity. |
| "Embryo stage growing" with no growth (review) | Stage 3 is "The Embryo: first cells" (cells split, the ball keeps its size). Stage 4 ends with a 7 s grow moment, weeks 5 to 7, where your buds grow from 2 mm to 10 mm. | The user asked for the embryo growing. |
| The LH surge after the taps (review) | The gold surge plays first, on beats 1 and 2. Then the taps swell the follicle and open it. | The surge causes the release. |

### 1.3 The word for the person carrying the baby

- Default: **"your mother"**. The facts we show come from sources that use "mother": the NHS week 15 page ("the
  mother's heartbeat"), Kisilevsky 2003 (PMID 12741744, the mother's voice), DeCasper and Fifer 1980 (PMID 7375928,
  newborns prefer the mother's voice), and Gerhardt and Abrams 2000 (the mother's voice in the womb). It is one short,
  warm word.
- Setting: **mother / mum / mom / parent**, under "Word for the one who carries you". It gives "your mother", "your
  mum", "your mom" or "your parent". The setting is not on the cut list.
- Strings use `{carer}` ("your mother") and `{Carer}` ("Your mother"), and the possessive `{carer}'s`. All four words
  are singular nouns, so verbs agree with no grammar code ("Your parent hums", "Your mum hums").
- No shown string contains she, her, hers, herself, he, him, his, himself, they, them, their, theirs or themselves. A
  test scans every string with a word-boundary regex.
- The person is never shown in full, never an obstacle and never in pain. At the end the person is a soft warm shape
  with no face and no body outline.

## 2. Tone rules (hard)

- Tender, wondrous and curious. Accurate, but never clinical or graphic.
- The journey starts inside the body, with cells. No intercourse, no innuendo, no sexual anatomy, no anatomy labels.
- No miscarriage, injury, distress or death, shown or implied. Other sperm only rest. Nothing is killed.
- The mother's body is never an obstacle or an enemy. No hazards tied to the mother (no alcohol, smoke or illness).
- No medical advice. No viability or prematurity facts.
- The birth opening is drawn only as light. No blood, no people until the end, no sign of pain.
- The newborn is never blue, dusky or limp. No anatomical lungs. The first breath comes by itself.
- Failure is gentle and immediate to retry, and only before fertilization.
- One banned-word list for every shown string (section 15.4).

## 3. The run

### 3.1 Stage table

`gaDay` is days since the first day of the last period (section 4). "Ref", "mid" and "idle" are expected stage times
for the reference bot (skill 1.0), a mid bot (skill 0.7) and no input. "Cap" is the hard limit. Real scale is the
real width of the short screen axis (section 5.6).

| # | Id | Stage (the user's phase) | Verb | Live gestures (families) | gaDay | Real scale | Ref | Mid | Idle | Cap |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `swim` | The Journey (the sperm) | Swim | drag (steer) | 14 | 0.3 mm (not to scale) | 43 s | 60 s | 120 s ("Almost") | 120 s |
| 2 | `egg` | Ovulation (and fertilization) | Call | tap (beat tap) | 14 | 0.4 mm (not to scale) | 39 to 40 s | 39 to 40 s | 39 to 40 s | 60 s |
| 3 | `split` | The Embryo: first cells | Split | tap, hold (beat tap, hold-release) | 15 to 20 | 0.45 mm | 34 s | 34 s | 34 s | 50 s |
| 4 | `root` | The Placenta (and the growing embryo) | Root | drag, tap (steer, beat tap) | 20 to 49 | 0.6 to 30 mm | 45 s | 54 s | 67 s | 75 s |
| 5 | `grow` | First Trimester | Grow | tap, drag (beat tap, steer) | 49 to 97 | 30 to 150 mm | 60 s | 64 s | 69 s | 90 s |
| 6 | `answer` | Second Trimester | Answer | tap (beat tap) | 98 to 195 | 150 to 600 mm | 64 s | 64 s | 64 s | 80 s |
| 7 | `turn` | Third Trimester | Turn | hold, drag (hold-release, rotate) | 196 to 280 | 600 to 700 mm | 60 s | 66 s | 81 s | 100 s |
| 8 | `birth` | Birth | Ride | hold, drag-and-hold (hold-release) | 280 | 700 mm | 70 s | 70 s | 70 s | 80 s |
| – | `ending` | First breath and skin-to-skin (not scored) | Breathe | hold (optional) | 280 | 2 m | 33 s | 33 s | 33 s | 40 s |

Stages 2 and 3 take the same time for every input. Their length moves by less than one beat with her beat phase
(section 5.1).

Run time: stages (ref about 416 s, mid about 452 s, idle about 545 s), plus 7 stage-end overlays (2.5 s each; none
after Birth), 7 stage cards (1.0 to 3.5 s), and the ending (33 s). A mid run is about 9 minutes. The skill 0.7 bot
gate is 8 to 12 minutes of game time.

### 3.2 Flow

1. **Title.** Play (`#play`) starts the audio and stage 1 in the same tap. There is no card before stage 1.
2. **Stage.** The prompt names the live gesture by 0.5 s. Sub-goals are shown as they come and confirmed when done.
3. **Stage-end overlay** (stages 1 to 7): a short in-world overlay with the grade word, the stage points and one fact.
   It continues by itself after 2.5 s. A tap holds it ("linger") until a second tap or Next.
4. **Crossfade and card.** A 0.8 s crossfade takes the old scene to the new stage's first frame. The next stage's
   card shows over it. It can be skipped from 1.0 s and goes by itself at 3.5 s. The new stage starts when the card
   goes. (The log zoom with nested anchors is deferred, section 19.2.)
5. After stage 8 there is no overlay and no points. The ending plays, then the run result.

### 3.3 Difficulty curve

The curve follows the biology. Timing windows never get tighter than ±60 ms / ±140 ms anywhere (section 5.2).

| Stage | Tempo of the target heart | What rises |
|---|---|---|
| 1 | free (her 72 bpm in the background) | steering against a current |
| 2 | her 72 bpm: a gold surge, then a target on every beat | first taps; gold call beats |
| 3 | her 72 bpm, targets every 2nd beat | taps plus 2 hold-releases |
| 4 | her 72 bpm (pool entries), then yours 110 bpm | steering timed to her beat; the hinge |
| 5 | yours 130 → 170 → 155 bpm | **peak**: fastest pulse, mixed gaps of 2 to 4 beats, drags between phrases |
| 6 | her 78 bpm | heartbeat taps, then memory: call and response from week 19 |
| 7 | her 72 bpm | slow holds, rotate in roomy moments, then an unscored rest |
| 8 | her 76 → 92 bpm | **second peak**: long holds with direction changes on contraction waves |

## 4. One clock

- **gaDay**: days since the first day of the last period. Fertilization is gaDay 14. Full term is gaDay 280. gaDay may
  be fractional while it moves; labels use `floor(gaDay)`.
- **Week**: `week(gaDay) = floor(gaDay / 7)`, the completed weeks, as midwives and doctors count.
- **Label function** (`core/clock.js`, the only place labels are made):
  - before fertilization: `"Week " + week(gaDay)` (stage 1 and stage 2 until fusion: "Week 2");
  - after fertilization, while `gaDay < 42`: `"Day " + (gaDay − 14) + " after fertilization (week " + week(gaDay) + ")"`;
  - from gaDay 42: `"Week " + week(gaDay)`.
  - Check values: `label(14, {fertilized:false}) = "Week 2"`, `label(14, {fertilized:true}) = "Day 0 after
    fertilization (week 2)"`, `label(36) = "Day 22 after fertilization (week 5)"`, `label(70) = "Week 10"`.
- **Range function** `range(gaFrom, gaTo)` for a fact that spans days: `"Days 6 to 9 after fertilization (weeks 2 to
  3)"` for `range(20, 23)`, and `"Weeks 31 to 34"` for `range(217, 238)`. When both ends fall in one week, the bracket
  says "(week M)". A span never crosses gaDay 42 (the facts test checks this).
- Heartbeat's formula holds: for Day N after fertilization, week = floor((14 + N) / 7).
- **Fetus**: the word "fetus" appears from gaDay 70 (week 10), with the line "Sources differ, from week 8 to week 10."
- **Trimester cards** state their borders with "about": the stage 5 card says "First trimester: up to about week 13",
  the stage 6 card (gaDay 98, week 14) says "Second trimester: about weeks 14 to 27", and the stage 7 card (gaDay 196,
  week 28) says "Third trimester: about week 28 to birth".
- **Settings line**: "Weeks count from the first day of the last period. Midwives and doctors count this way."
- No "cycle day" anywhere. No fertilization-age week without its label.
- Facts store `gaDay` (and `gaEnd` for a span), never a label. No fact text starts with "Week" or "Day". Screens put
  the computed label in front of the text.
- **Scale**: `mmPerShortAxis(meta, gaDay)` log-lerps from `meta.mm.start` to `meta.mm.end` by gaDay across
  `meta.ga`. A stage whose `ga.start` equals `ga.end` uses `meta.mm.start`.

### 4.1 Moments on the clock

Each moment in `meta.moments` is `{ id, ga: [from, to], lenS }`. While a moment runs, `gaDay = from + (to − from) × p`,
with `p = clamp(seconds in the moment / lenS, 0, 1)` (`clock.gaAt`). A moment that ends early jumps gaDay to `to`. The
next moment starts at its own `from`, which is never below the last `to`. So gaDay never goes back within a run. A
Try again in stage 1 restarts stage 1, which stays at gaDay 14.

| Stage | Moment | gaDay from → to | `lenS` (what `p` follows) | Labels shown |
|---|---|---|---|---|
| `swim` | `womb`, `tube`, `pocket`, `carried` | 14 → 14 | – | Week 2 |
| `egg` | `surge`, `open`, `ride`, `meet`, `fusion`, `outro` | 14 → 14 | – | Week 2; fertilized turns true at the end of `fusion` |
| `split` | `split` | 15 → 19 | 24 of her beats | Days 1 to 4 |
| `split` | `bloom` | 19 → 20 | 6 beats | Day 5 |
| `split` | `hatch`, `outro` | 20 → 20 | – | Day 6 |
| `root` | `nestle` | 20 → 23 | 12 s | Days 6 to 9 |
| `root` | `roots` | 25 → 35 | 40 s; jumps to 35 when all 8 pools link | Days 11 to 21 |
| `root` | `heart` | 36 → 36 | – | Day 22 |
| `root` | `grow` | 36 → 49 | 7 s | Day 22 to week 7 |
| `grow` | `beatN` (N = 7 to 13) | 7N → 7N + 6 | its 16 beats of your heart | Week N |
| `grow` | `moveN` (N = 8 to 13) | 7N + 6 → min(7N + 7, 97) | 3 s; jumps to the end when done | Week N |
| `answer` | `hear` | 105 → 105 | – (the card shows gaDay 98) | Week 15 |
| `answer` | `beat` | 105 → 126 | its 8 targets | Weeks 15 to 18 |
| `answer` | `phrases` | 133 → 175 | 6 phrases of 10 beats | Weeks 19 to 24 |
| `answer` | `eyes` | 175 → 182 | 4 s | Weeks 25 to 26 |
| `answer` | `outro` | 189 → 195 | 3 s | Week 27 |
| `turn` | `breathe` | 196 → 231 | 4 breaths of 8 beats | Weeks 28 to 33 |
| `turn` | `turn` | 231 → 252 | 30 s; jumps to 252 when head-down | Weeks 33 to 36 |
| `turn` | `rest` | 259 → 280 | 16 s | Weeks 37 to 40 |
| `turn` | `outro` | 280 → 280 | – | Week 40 |
| `birth` | `waves`, `light` | 280 → 280 | – | Week 40 |
| `ending` | all | 280 → 280 | – | none shown |

`run.test.mjs` plays whole runs and checks that gaDay and `mmPerShortAxis` never decrease from one step to the next.
The only reset allowed is a stage 1 Try again.

## 5. Shared rules

### 5.1 Two hearts

- **Your mother's heart** plays from Play to the run result, also under overlays, the Almost card and stage cards.
  Only pause stops it. **One exception:** the ending's first 1.5 s are silent. Her heart then comes back soft and far under the
  breaths, and comes close and clear at skin-to-skin (section 6.9). Base 72 bpm. Seeded beat-to-beat jitter of ±3%
  in free time; 0% while a target track runs. Stage 6 uses 78 bpm. Labour rises 76 → 92 bpm. The ending is 76 bpm.
- **One continuous beat clock.** `core/run.js` owns her beat clock (section 16.8). Inside a stage, the stage's
  `state.beats.mother` is the truth. Between stages, the run keeps her beats going at the last stage's rate and glides
  to the next stage's `meta.motherBpm` over the card. It passes `opts.motherPhase` to `create`: the stage seconds from
  the stage start to her next beat (0 ≤ phase < one period). Each stage lays her beats from there. A stage's "beat 1"
  is her first beat at or after the stage's lead-in time (stage 2: 0.2 s; stages 3 and 7: 1.0 s). So the beat never
  jumps at a stage start, and sound schedules from the run clock between stages.
- **Your heart** starts on Day 22 after fertilization (gaDay 36). Its rate follows a piecewise-linear curve in gaDay:
  (36, 110), (42, 110), (63, 170), (70, 170), (98, 150), (140, 140), (196, 140), (280, 130). Sources: NHS week 28
  (110 at weeks 5 to 6, 170 at weeks 9 to 10, 140 at week 28, 130 at birth); UNSW heart (rises to about gaDay 63);
  BMJ Heart 2007 (150 at week 14). `clock.bpmYou(gaDay)` holds the curve.
- **One target heart at a time.** The other heart is 8 dB quieter, its ring is faint, and a caption names the target
  ("Tap with your heart").
- **Rings.** Her beat is a gold solid ring. Yours is a smaller pearl dashed ring with a dot. They differ by size, dash
  and dot, not by hue alone.

### 5.2 Timing judge (`core/judge.js`)

- Every timed target has a time `t` in stage seconds and a spacing `P`, which the stage computes and stores on the
  target: the seconds since the previous target, or the beat period of its heart for the first target, floored at
  0.5 s. The minimum spacing between targets is 0.5 s in every stage.
- Windows: **In time** ±min(70 ms, 0.12 P); **Close** ±min(170 ms, 0.28 P). With P ≥ 0.5 s, the windows are never
  tighter than ±60 ms and ±140 ms.
- **Assist**: windows ×1.6, with Close capped at 0.4 P.
- **Credit**: In time 1, Close 0.5, miss 0. A press inside ±0.45 P of a target but outside Close is **Off**: it shows
  only a faint dotted ring and changes nothing. The target stays open until it passes.
- **Free taps**: a press that is not near any open target does nothing.
- **Miss**: a target is missed when the stage time passes `target.t + close + 0.05 s`. The 50 ms grace is there because
  a pointer event can reach the page a frame after its time stamp.
- **Judged at touch-down** (for tap and press targets) or at release (for release targets), on the input's own
  timestamp (section 16.3), never on the step index.
- **Preview**: every target is visible at least max(2 beats of its heart, 1.2 s) before its time.
- **Accuracy** = Σ credit / the number of targets.
- **Calibration**: a Tap test in Settings (8 taps to a click and flash) sets `offsetMs` to the median error. A manual
  slider covers −150 to +150 ms in 10 ms steps. Auto-drift is deferred (section 19.2). Judge events still carry
  `rawMs`, the error before the offset, so auto-drift can use it later.
- **Sound latency**: sounds are scheduled `latencyS` early (`outputLatency`, else `baseLatency`), so the heard beat
  lands on the drawn beat. The drawn beat is the truth.
- **After resume**, targets in the first 1.2 s are free: they are left out of accuracy.

### 5.3 Gestures (`ui/input.js`, one pointer)

- Only the first pointer counts. Other pointers are ignored, in portrait and landscape. No mechanic needs two pointers.
- **State machine** for the pointer, with these numbers:

  | From | Event | To | Emits |
  |---|---|---|---|
  | idle | pointerdown at t0, p0 | pressed | `press {t: t0}`; stick origin = p0 |
  | pressed | moves > 12 px from p0 | dragging | `dragStart`; `dir` = dominant screen axis of the move |
  | pressed | 220 ms pass with < 12 px | holding | `holdStart` |
  | pressed | up before 220 ms, < 12 px | idle | `tap {t: t0}`, `release {t: t1}` |
  | holding or dragging | up at t1 | idle | `release {t: t1}` |

- Each moment declares one **live gesture**: `drag`, `tap`, `hold`, `dragHold` or `none`. The stage reads only what
  matches. Tap and press targets read `presses`. The classified `taps` are for menus only; no stage reads them, so a
  press that turns into a drag still counts at its touch-down.
  - `tap`: every `press` is the action, judged at t0. Movement afterwards is ignored. No 220 ms wait.
  - `hold`: `press` starts the hold at t0; `release` ends it at t1.
  - `drag`: the stick vector steers; lifting the finger means "not steering" (coast or rest).
  - `dragHold`: `press` starts a hold; `dir` (once past 12 px) is the direction; `release` ends it.
  - `none`: input is ignored (fusion, outros, the grow moment, cards in the world).
- **Floating stick**: origin at touch-down, anywhere on the screen. Dead zone 8 px. Full deflection at 56 px. Past
  80 px the origin trails the finger. Magnitude `m = clamp((d − 8) / 48, 0, 1)`. The stick ring is drawn at the
  origin while touching.
- **Desktop keys**: arrows or WASD steer (8-way, smoothed over 0.12 s). Space, Enter or Z is a press on keydown and a
  release on keyup. In a `dragHold` moment, an arrow or WASD keydown emits a press with its `dir`, and its keyup emits
  the release. Space alone is a press with `dir` null, which counts as a plain hold. Key repeats are ignored. Esc or P
  pauses, M mutes, C toggles captions, Tab and Enter move through menus. The mouse is optional: the left button acts as
  the pointer.
- **One-button mode**: `ui/input.js` turns any key or tap into a press and release. `core/run.js` sets `steer` and
  `dir` for every stage from that stage's `botSteer` at skill 1.0, steering only while the button is held (section
  16.4). Stages do not read the setting, except for tuning like Assist.

### 5.4 Gentle misses and sub-goals

- A miss only adds less. It never resets progress, never stops development and never silences the mother.
- Every sub-goal is shown (prompt plus a caption), confirmed when done ("Now you are ready."), or confirmed when done
  by itself ("The roots reach it anyway."). None passes silently.

### 5.5 Carry-over

Carry is one plain object passed between stages: `create(seed, carryIn, opts)` and `result().carryOut`. Stages never
import each other. Every field has a default, so any stage runs alone in node, in practice or through `goto`.

| Field | Written by | Read by | Default | Meaning |
|---|---|---|---|---|
| `sparks` | run (each Glowing) | all (rim sparks) | 0 | sparks on your membrane rim |
| `sperm` | `swim` | `egg` | `{ hue: 0.11, side: 1, glow: 0.5 }` | your sperm's tint, which wall it waits on, how bright it rested |
| `nestleX` | `root` | `grow`, `answer`, `turn` | 0 | where on the wall you nestled (−1..1); the placenta grows there |
| `treeSeed` | `root` | `grow`, `answer`, `turn` | stage seed | the placenta disc texture echoes your root tree |
| `song` | `answer` | `turn`, `ending` | `{ notes: DEFAULT_SONG, lit: 0 }` | 16 MIDI notes of your song, and which you answered |
| `turnDir` | `birth` | `birth` (Turn back) | 1 | which way you turned on the Turn wave |

`DEFAULT_SONG` is a fixed 16-note pentatonic lullaby in `core/carry.js`.

### 5.6 Camera and the scale bar

- Each stage declares `orient`:
  - `long` (stages 1 to 4): world forward (+y) maps to the long screen axis: up in portrait, right in landscape and
    desktop. In portrait the subject sits at 45% of the height from the top, so it sees ahead and stays above the
    thumb zone. In landscape it sits at 38% of the width from the left, and at 40% on desktop.
  - `fit` (stages 5 to 8 and the ending): world up is screen up ("head-down" stays down). The world fits the short
    axis. The subject sits at 42% of the height in portrait.
- World unit `u`: the short screen axis is 100 u at camera span 100.
- Each view gives `camera.mmPerU`. The scale bar picks a round value (0.1 mm, 1 mm, 1 cm, 10 cm, 1 m), and the real
  span of the short axis never shrinks over the run (`mmPerShortAxis`, section 4).
- **Stages 1 and 2 are not drawn to scale**: the womb and the tube would be centimetres wide. There the bar shows only
  the subject's own size: "You: about 0.05 mm" (the sperm cell, drawn at 15% of the short axis) and "You: about
  0.1 mm" (the egg).
- **Where the bar sits**: top left under the clock in portrait; bottom left in landscape and desktop.
- **Between stages** (v1): a 0.8 s crossfade under the card. The log zoom with nested anchors, after Eames, *Powers of
  Ten* (1977), is deferred (section 19.2). The placenta disc still stays in view through stages 5 to 7.
- **Thumb zone**: in portrait, the subject's screen position stays above 60% of the height. The bottom 40% is the
  thumb zone. During play (the stages, their overlays and the ending) nothing to read sits there. Menus and cards may
  use the whole screen.

## 6. Stages

Each stage lists what you see, the moments in order, tuning, score, misses, one-button and assist behaviour, carry,
facts (ids from section 15), look and sound, the bot's steering policy, what v1 builds and the floor left after the
cut list (section 19.1). Points: Goal 3,000 + Skill up to 6,000 + Flourish up to 1,000. One-button lines describe what
the run's one-button rule (section 16.4) gives in that stage; stages add no code for it.

### 6.1 Stage 1, The Journey (`swim`): "Drag to swim."

- **Sees.** You are a sperm cell, a gold head with a soft tail, 15% of the short screen axis. You start in a wide,
  warm, soft space (the womb, never named on screen). Slow waves of light roll forward. The space narrows into a tube
  that glows warm. Inside the tube, a gentle current flows toward you. Other sperm rest, still, on the tube walls.
- **Moments.**
  1. `womb` (0 to 1,300 u): ride the waves forward. Prompt "Drag to swim." at 0.3 s; steering live at 0.5 s; the
     first wave is in view by 2 s.
  2. `tube` (1,300 to 3,000 u): swim against the current, follow the warm lane, rest on a glowing wall to become ready.
  3. `pocket` (at 2,950 u): settle in the warm pocket on the wall. "Wait here. The egg is coming."
  4. `carried` (only after Go on, 3 s, live gesture `none`): the waves carry you to the pocket.
- **Tuning** (`swim.tune.js`):

  | Name | Value |
  |---|---|
  | Swim speed | 55 u/s at full stick; accel 120 u/s²; coast drag 1.8 /s; turn 3.0 rad/s |
  | Womb | 160 u wide, narrowing to 60 u from 1,100 to 1,300 u; the camera follows |
  | Waves | one every 3.2 s; 60 u thick; move forward at 140 u/s; each spans a lateral window 80 u wide, centre seeded within ±40 u; inside, your speed blends to 140 u/s over 0.3 s |
  | Tube | 60 u wide; current 22 u/s toward you × (0.3 + 0.7 (1 − r²)), r = distance from the centre / half-width |
  | Upstream | heading within 25° of forward: +18 u/s |
  | Warm lane | 30 u wide; drifts ±12 u at 0.1 Hz; inside: +12 u/s |
  | Walls | contact keeps 0.9 of your speed along the wall |
  | Glow walls | at 1,900, 2,300 and 2,650 u, alternating sides, radius 20 u. Rest = speed < 15 u/s inside for 4 of her beats. Then "Now you are ready.": swim ×1.4 to the end. Passing one unrested: "Rest at the next glow." |
  | Checkpoints | 1,300, 1,725, 2,150 and 2,575 u. The current never pushes you behind the last one passed; there you rest on the wall, glowing, and go on. No fade. |
  | Pocket | radius 14 u. Settle = speed < 30 u/s inside for 1.0 s. If you arrive not ready, you rest there 4 beats first. |
  | Other sperm (v1) | 12, seeded on the tube walls between 1,400 and 2,700 u, drawn as resting tails that wiggle. They never move and never touch you: you pass over them. |
  | Cap | 120 s |

- **Score.** Goal 3,000 if you settle before the cap. Skill: 2,000 × min(1, seconds riding waves / 5); 2,000 × the
  share of tube time inside the warm lane; 2,000 × the share of tube time heading upstream. Flourish: 500 if you
  became ready at the first glow wall; 500 if you settled at < 15 u/s. Speed is never scored ("It is not a race.").
- **At the cap.** `result()` is `{ done: true, goalMet: false }`. The run shows a soft card: "Almost. Try again?" and
  "Your run and points are kept." Buttons: **Try again** (focused; recreates this stage at once) and **Go on** ("The
  waves carry you on."). Go on calls `swim.jump(state, "carried")`: a 3 s carry to the pocket, then `result()` is
  `{ done: true, goalMet: false }` with Goal 0, Skill and Flourish kept, and no grade word.
- **One-button.** Hold to swim: `botSteer` rides the waves, follows the warm lane and stops on each glow wall until you
  are ready. Release to coast.
- **Assist.** Current ×0.7, warm lane ×1.5 wide, settle speed < 40 u/s.
- **Carry out.** `sperm = { hue, side, glow }`: `side` is the wall of the pocket, `glow` the share of ready time.
- **Facts.** Card: none (Play starts the stage at once); `swim.half` is the first caption. Captions `swim.waves`,
  `swim.side`, `swim.few`, `swim.flow`, `swim.warm`, `swim.walls`, `swim.rest`, `swim.ready`. Overlay `swim.race`, or
  `swim.wait` after Go on.
- **Look and sound.** Violet-plum and rose. Other sperm pale mauve. The warm lane is an amber shimmer with chevrons.
  Waves are broad soft bands. Soft swish on turns, a low "whoom" when a wave carries you, a warm two-note chime on
  "ready".
- **Bot steering.** Ride the nearest wave window in the womb; in the tube, steer to the lane centre while heading
  upstream; stop on each glow wall until ready; brake into the pocket. Noise and a 150 ms × (1 − skill) lag.
- **v1 builds.** The tube with its current, warm lane and upstream bonus; the pocket; the cap card; plus the womb waves
  and the glow walls with "ready". Deferred: the fork with the cool tube, and moving rivals.
- **Floor.** Tube only, steer to the pocket, cap card.

### 6.2 Stage 2, Ovulation (`egg`): "Tap with the heartbeat."

- **Sees.** You are the egg in a glowing follicle, in a cloud of small cells (the corona). Fringed fimbriae sway near.
  Then the tube: cilia beat in a travelling wave. Ahead on the wall, your sperm from stage 1 waits, glowing.
- **Moments** (her 72 bpm, P = 0.833 s, no jitter; beat 1 is her first beat at or after 0.2 s, so between 0.2 and
  1.03 s):
  1. `surge` (beats 1 and 2, live gesture `none`): a gold wave, the LH surge of the card's fact `egg.surge`, washes
     over the follicle.
  2. `open` (beats 3 to 8, 6 targets): the follicle swells with each beat. Tap on the beat. The 3rd tap graded Close or
     better opens it; otherwise it opens by itself on beat 8. Once open, you float out to the fimbriae; the rest of
     the open beats carry no targets.
  3. `ride` (beats 9 to 32, 24 targets): the fimbriae catch you and cilia carry you. Each beat is a cilia crest. Every
     third beat (11, 14, 17, 20, 23, 26, 29, 32) is gold: "Tap the gold beats to call." An on-beat gold tap puffs a
     signal that widens the gold trail toward your sperm.
  4. `meet` (4 s, no input): your sperm leaves the wall and follows the trail to you. A wider trail draws a straighter
     path. Caption "The half of you that swam is here."
  5. `fusion` (6 s, no input): the corona parts (0 to 1.5 s); two small lights fit, Izumo1 and Juno (1.5 to 2.5 s); a
     shimmer runs round the shell (2.5 to 4.0 s) and a few other sperm drift away; the two nuclei draw close and touch
     but stay apart (4.0 to 6.0 s). The clock turns to "Day 0 after fertilization (week 2)".
  6. `outro` (2 s).
- **Tuning.** Ride step: In time +1, Close +0.6, a missed beat +0.2 (the cilia carry you anyway). Arrival is
  scheduled; steps only move you up to 30 u ahead of the scheduled place, as a visible surf. Trail width
  = 8 + 18 × (Σ call credit) / 8 u. Length 39 to 40 s (her beat phase), the same for every input. Cap 60 s.
- **Score.** Goal 3,000 (always). Skill: 1,000 × open accuracy (targets presented until it opens, at least 3); 3,000 ×
  ride accuracy (16 plain targets); 2,000 × call accuracy (8 gold targets). Flourish: 1,000 × best In-time streak / 24.
- **Miss.** A smaller swell; a smaller surf; a thinner trail. Never a stall.
- **One-button.** Already one button.
- **Carry in.** `sperm` sets your sperm's tint, wall side and glow.
- **Facts.** Card `egg.surge`. Captions `egg.size`, `egg.fimbriae`, `egg.cilia`, `egg.signal`, `egg.day`, `egg.fuse`,
  `egg.block`, `egg.pronuclei`, `egg.place`. Overlay `egg.weeks`.
- **Look and sound.** Peach and gold on deep rose. The corona is a sunburst of small splats. Cilia are one shader
  strip. A soft low pluck per tap, pentatonic plucks that climb with the streak, a warm swell at release, a held
  fifth at fusion.
- **Bot steering.** None needed (taps only); `botSteer` returns no steer.
- **v1 builds.** The surge, `open` and `ride` with the surf, then fusion with captions; plus the gold call beats and
  the trail.
- **Floor.** The surge, `open` and `ride` without gold beats, then fusion.

### 6.3 Stage 3, The Embryo: first cells (`split`): "Split."

- **Sees.** One cell in its clear shell, carried down the tube. It pinches in two, then 4, 8, 16: the ball keeps its
  size while the cells get smaller. A hollow fills. You slip out of the shell.
- **Moments** (her 72 bpm, P_beat = 0.833 s; beat 1 is her first beat at or after 1.0 s):
  1. `split` (Days 1 to 4, 6 beats each): targets on beats 2, 4 and 6 of each day (12 targets, P = 1.67 s). An
     approach ring closes on the membrane over the 2 beats before each target: "Tap as the ring closes." The split
     plays on beat 6 by itself.
  2. `bloom` (Day 5, 6 beats): "Hold. Let go at the glow." Hold any time in beats 1 to 4; the hollow fills while you
     hold (or by itself from beat 2). One release target on beat 6.
  3. `hatch` (Day 6, 6 beats): the same, against the shell. One release target on beat 6. You slip out on beat 6 by
     itself.
  4. `outro` (3 s): you drift toward the soft lining.
- **Tuning.** Length about 1 + 24 × 0.833 + 12 × 0.833 + 3 ≈ 34 s for everyone (plus less than one beat of phase).
  Cap 50 s. Release credit: In time 1, Close 0.5, released outside Close after holding at least 1 beat 0.25, never
  pressed 0.
- **Score.** Goal 3,000. Skill: 4,000 × split accuracy (12); 2,000 × release credit (2 targets, mean). Flourish: 250
  per day with all 3 taps In time (max 1,000).
- **Miss.** No sparkle on that split. The split still happens.
- **One-button.** Already one button.
- **Facts.** Card `split.two`. Captions `split.small`, `split.carried`, `split.morula`, `split.inner`. Overlay
  `split.hatch`.
- **Look and sound.** Coral cells with pearl rims on plum. Mitosis is two splats parting while a small bridge splat
  shrinks. A glassy pling per split, one step higher each time; a soft rising tone while holding.
- **Bot steering.** None needed.
- **v1 builds.** 4 days of splits on taps, plus Bloom and Hatch as hold-release targets.
- **Floor.** 4 splits on taps; bloom and hatch play by themselves.

### 6.4 Stage 4, The Placenta (`root`): "Grow roots."

- **Sees.** The soft red lining of the womb with 3 glowing soft spots. You settle into one. The camera pulls back: you
  are a tiny bright curl inside the wall, and roots (villi) branch out from you toward milk-white pools fed by glands.
  A thin glowing layer always lies between your roots and the pools. Then the world hushes, and a quick pulse glows
  in your chest. Then your body takes shape.
- **Moments.**
  1. `nestle` (Days 6 to 9, up to 12 s): "Drag to drift." Drift at 30 u/s over the lining (it slides by at 8 u/s).
     Touch any spot (24 u wide; all are fine): you sink in over 2 s by itself. Idle for 8 s: the nearest spot draws you
     in (3 s). Confirm: "You bury yourself in the lining."
  2. `roots` (Days 11 to 21, up to 40 s): "Drag to grow roots." You steer the growing tip; the tree fills in behind
     it. 8 gland pools (radius 16 u, dotted rim) swell on her beat. Entering one links it: a glow runs back to you.
     Entering within the Close window of her beat is an on-beat link. From 12 s, the tree links one more pool by
     itself every 3.5 s ("The roots reach it anyway."), so all 8 are linked by 40 s at the latest. The phase ends when
     all 8 are linked.
  3. `heart` (Day 22): 1.5 s hush (her heart −8 dB, light −10%). Captions: `root.heart` with its label ("Day 22 after
     fertilization (week 5). Your heart beats for the first time."), then "This beat is yours. Tap with it." Your
     heart beats by itself at 110 bpm. 8 targets on your beats (P = 0.545 s). Then both hearts play together.
  4. `grow` (7 s, Day 22 to week 7, live gesture `none`): your body takes shape. The `figure.js` buds grow from 2 mm
     to 10 mm, the camera pulls back to 30 mm, and the tree thickens into a disc: "This will become your placenta."
     Captions `root.size` at the start and `root.buds` at week 6.
- **Tuning** (`root.tune.js`):

  | Name | Value |
  |---|---|
  | Tip | 40 u/s, turn 2.6 rad/s |
  | Pools | 8, radius 16 u, seeded 60 to 150 u from the root, at least 40 u apart; swell 1 + 0.12 × pulse on her beat |
  | Space colonization | N = 400 attraction points; D = 6 u; d_i = 48 u; d_k = 12 u; active points only within 60 u of the tip or of a pool being linked by itself; at most 2 iterations per step; at most 260 nodes |
  | Auto-link | from 12 s into `roots`, the nearest unlinked pool every 3.5 s |
  | Grow | 7 s; buds 2 → 10 mm; camera span 6 → 30 mm |
  | Lengths | ref 45 s, mid 54 s, idle 67 s; cap 75 s |

- **Score.** Goal 3,000. Skill: 3,000 × pools you linked / 8; 1,000 × on-beat links / 8; 2,000 × heart accuracy (8).
  Flourish: 1,000 × heart taps In time / 8.
- **Miss.** The tip slides off the firm edge and the pool waits. Nothing drains, and nothing counts nutrients.
- **One-button.** Hold to drift to the nearest spot, then hold to grow the tip toward the nearest unlinked pool
  (`botSteer`). Release and the tip rests.
- **Assist.** Pools radius ×1.3; auto-link from 8 s.
- **Carry out.** `nestleX`, `treeSeed`.
- **Facts.** Card `root.bury` (a span, labelled "Days 6 to 9 after fertilization (weeks 2 to 3)"). Captions
  `root.hcg`, `root.grows`, `root.glands`, `root.heart`, `root.tube`, `root.size`, `root.buds`. Overlay `root.w7`.
- **Look and sound.** Deep red tissue, milk-white pools with dotted rims, a pale coral tree. Vessels pulse by arc
  length. A rising tone while growing, a bloom chime per link, then your own soft quick beat under hers, and a slow
  warm swell in the grow moment.
- **Bot steering.** Seek the nearest spot, then the nearest unlinked pool; time arrival to her next beat by easing
  speed in the last 20 u.
- **v1 builds.** The heart hinge with 8 taps and the grow moment, plus the steered nestle and the steered roots with
  auto-link.
- **Floor.** Nestle by itself, roots by auto-link only, the heart hinge, the grow moment.

### 6.5 Stage 5, First Trimester (`grow`): "Grow with your heart."

- **Sees.** You, 10 mm at week 7 to 7.4 cm at week 13, float in a clear sac. The cord loops to the placenta disc (where
  you nestled). Lights travel down the cord to your heart. Your body changes shape each week: the head uncurls at week
  8, and buds become arms and legs. At week 12 the pools around your roots turn red and pulse with her heart, and the
  thin glowing layer parts the two bloods.
- **Moments.** One phrase per week, weeks 7 to 13 (gaDay 49 to 97):
  1. `beatN` (every week): 16 of your beats. "Tap when the light reaches your heart." Targets fall on your beats with
     gaps of 2 beats (weeks 7 and 8), 2 or 3 beats (weeks 9 and 10, seeded) or 2 to 4 beats (weeks 11 to 13). At
     170 bpm a 2-beat gap is 0.706 s. Lights enter the cord at least 2 targets and 1.6 s ahead.
  2. `moveN` (weeks 8 to 13, up to 3 s): "Drag to stretch." A glow appears 40 u away in one direction. Point the stick
     within 35° of it at ≥ 50% deflection for 0.5 s and the reflex move plays. At 3 s it plays by itself. Moves by
     week: 8 uncurl (up), 9 stretch an arm (left or right, seeded), 10 startle (the other side), 11 kick (down) while
     your fists open and close, 12 kick (down), 13 thumb to mouth (up). Week 7 has no move.
  - Events: week 10 (gaDay 70) `grow.fetus` with its label ("Week 10. From about now you are called a fetus. Sources
    differ, from week 8 to week 10."); week 12 (gaDay 84) the pools turn red, with wavy rims, and pulse with her
    heart, with `grow.flow` and `grow.never`.
- **Tuning.** About 45 targets. Your heart: 130 bpm at week 7, 170 at weeks 9 to 10, about 155 at week 13. Length about
  2 + 7 phrases × 6.5 s + 6 moves × up to 3 s + 3 s; moves end early when done. Cap 90 s.
- **Score.** Goal 3,000. Skill: 4,500 × heart accuracy; 1,500 × moves you did / 6. Flourish: 1,000 × min(1, best
  In-time streak / 16).
- **Miss.** The light enters dimly. The move plays anyway.
- **One-button.** Holding points the stick at the move glow (`botSteer`), so a 0.5 s hold plays the move. Taps as
  usual.
- **Assist.** Windows ×1.6; move cone 50°.
- **Carry in.** `nestleX`, `treeSeed` for the disc.
- **Facts.** Card `grow.w7` and `grow.tri`. Captions `grow.w8`, `grow.arms`, `grow.peak`, `grow.fetus`, `grow.w11`,
  `grow.w11kick`, `grow.w12`, `grow.flow`, `grow.never`. Overlay `grow.w13`.
- **Look and sound.** Rose and pearl. The baby figure is 10 to 12 splats on a 2D skeleton (section 14.4). Your heart
  is a soft click; hers is a low bed. Each In-time tap plays a soft bell from a pentatonic set (felt, very low-passed).
- **Bot steering.** Point the stick at the move glow.
- **v1 builds.** Heart taps with the cord lights, the week 10 line and the week 12 red pools, plus the drag moves.
- **Floor.** Heart taps only; the moves play by themselves.

### 6.6 Stage 6, Second Trimester (`answer`): "Listen. Then answer."

- **Sees.** A warm, roomy space of fluid. Amber-red light comes through the wall, with soft caustics. You suck a thumb.
  From week 19 your mother's voice arrives through the wall as gold ripples from a warm patch. From week 20 a soft
  warm hand glow presses on the wall when you answer well. At week 26 your eyes open and the vignette lifts.
- **Moments** (her 78 bpm, P_beat = 0.769 s):
  1. `hear` (week 15, 3 s): her heartbeat changes from felt to heard. Caption `answer.hear` with its label ("Week 15.
     You start to hear {carer}'s heartbeat.").
  2. `beat` (weeks 15 to 18, 8 targets on her beats): "Tap with {carer}'s heartbeat."
  3. `phrases` (weeks 19 to 24, 6 phrases): it opens with `answer.respond`. Each phrase: 4 beats of call (one note slot
     per beat; gold ripples show each note as it is hummed), 4 beats of answer (faint dashed ghost ripples show each
     slot to tap), 2 beats of gap. Patterns: `x...`, `x.x.`, `xx.x`, `x.xx`, `xxx.`, `xxxx` (16 notes). Notes in one
     phrase are at least one beat (0.769 s) apart. An answer with ≥ 75% of its notes Close or better is a match:
     "{Carer} feels you." and, from phrase 2, the hand glow. Under 75%, the next phrase comes on time. The voice never
     stops as a miss. Each phrase is played once in v1.
  4. `eyes` (weeks 25 to 26, 4 s, no input): caption `answer.jump`; then at week 26 the eyes open by themselves and the
     vignette lifts over 2 s.
  5. `outro` (week 27, 3 s).
- **Tuning.** Notes are a seeded walk on a 5-note pentatonic set around F0 200 to 230 Hz. Length about 3 + 7.7 + 46.1 +
  4 + 3 ≈ 64 s for everyone. Cap 80 s.
- **Score.** Goal 3,000. Skill: 1,500 × beat accuracy (8); 4,500 × answer accuracy (16 notes). Flourish: 250 per
  phrase with every note In time (max 1,000).
- **One-button.** Already one button.
- **Carry out.** `song = { notes: the 16 call notes, lit: a mask of notes answered Close or better }`.
- **Facts.** Card `answer.card` and `answer.tri`. Captions `answer.hear`, `answer.respond`, `answer.w20`,
  `answer.feel`, `answer.outside`, `answer.low`, `answer.hic`, `answer.jump`. Overlay `answer.eyes`.
- **Look and sound.** Amber and honey. Caustics at 25%. The voice is a sine hum (a sine at F0 with a soft 2nd harmonic
  and a slow vibrato), through the womb filter, so only melody passes. Your answers are soft low thumps (70 Hz with a
  150 Hz click for phone speakers). The hand glow brings a warm low chord.
- **Bot steering.** None needed.
- **v1 builds.** `hear`, `beat`, 6 phrases with ripples and ghost ripples, and the eyes; plus the hand glow with
  "{Carer} feels you.". Deferred: repeats of a missed phrase (when they return, each note keeps its best credit across
  attempts), the loud-sound jump, the hiccup animation (`answer.hic` and `answer.jump` still show as captions).
- **Floor.** `hear`, `beat`, and 4 phrases.

### 6.7 Stage 7, Third Trimester (`turn`): "Turn and breathe."

- **Sees.** Space gets snug. Amber light glows through the wall. You round out and start head-up. On her out-breath the
  wall softens and glows: a roomy moment. Then you rest, curled, while your song is hummed.
- **Moments** (her 72 bpm; your heart 140 → 130 bpm):
  1. `breathe` (weeks 28 to 33, 4 breaths × 8 beats; beat 1 is her first beat at or after 1.0 s): "Hold. Let go." A
     ring grows over beats 1 to 4 and shrinks over 5 to 8 by itself. Targets: press on beat 1, release on beat 5
     (8 targets).
  2. `turn` (weeks 33 to 36, up to 30 s): "Drag to turn. Turn when it is roomy." The stick's horizontal offset sets the
     turn speed. Roomy moments last 2.5 s and come every 6.0 s. Turn speed: 60°/s × stick x in a roomy moment, 15°/s
     outside. Head-down = within 20° of straight down, after 180° in all. At 30 s you turn by yourself over 3 s: "Most
     babies turn head-down by 36 to 37 weeks. You turn now."
  3. `rest` (weeks 37 to 40, 16 s, not scored): "Rest. Keep your thumb on the screen." Your song is hummed, muffled.
     Holding warms your heart ring a little. Nothing is judged. This is the low, warm lull before labour.
  4. `outro` (3 s): the label and "You are ready." ("Week 40. You are ready.").
- **Tuning.** Lengths: ref 60 s, mid 66 s, idle 81 s; cap 100 s.
- **Score.** Goal 3,000. Skill: 3,000 × breath accuracy (8); 3,000 × min(1, degrees turned in roomy moments / 180).
  Flourish: 1,000 if you finish the turn yourself before the 30 s limit.
- **Miss.** The ring shrinks anyway. Outside a roomy moment the turn is only slower, with no sound and no penalty.
- **One-button.** Hold: `botSteer` gives full stick toward the shorter way only in roomy moments, so a hold turns you
  in roomy moments and rests you outside them. Breaths as usual.
- **Assist.** Roomy moments 3.5 s; outside speed 25°/s.
- **Carry in.** `song` (the hum), `nestleX`, `treeSeed`.
- **Facts.** Card `turn.card` (plus `turn.weight` only once it is checked). Captions `turn.lungs`, `turn.practice`,
  `turn.focus`, `turn.voices`, `turn.curl`, `turn.head`. Overlay `turn.voice`.
- **Look and sound.** Ember orange; caustics at full; the roomy glow is the brightest thing on screen. The womb filter
  opens to about 600 Hz.
- **Bot steering.** Full stick toward the shorter way, only in roomy moments.
- **v1 builds.** Breaths, then the turn by itself, then the rest; plus the steered turn in roomy moments and the hum in
  the rest.
- **Floor.** Breaths, then the turn by itself; the rest without the hum.

### 6.8 Stage 8, Birth (`birth`): "Ride the waves."

- **Sees.** Snug walls hug you. Dim plum. Waves of pressure narrow the vignette and press the walls in. Below you, a
  soft glow spans the full width of the bottom of the screen and grows with each wave. Nothing anatomical: the
  opening is drawn only as light.
- **Moments** (her 76 → 92 bpm): 8 waves, one every 8.0 s: a warning ring 1.0 s before, a 5.0 s swell, a 3.0 s rest.
  The first warning is at 2.0 s. Each wave moves you 1/8 of the way by itself.
  - Plain waves (1, 3, 5, 7): live `hold`. "Hold through the wave."
  - Prompt waves (live `dragHold`): 2 "Tuck: drag down and hold." 4 "Turn: drag sideways and hold." (left or right) 6
    "Lift: drag up and hold." 8 "Turn back: drag the other way and hold." Directions are screen axes, in every layout.
    Desktop: hold the arrow (5.3). The move plays on its wave either way.
  - Between waves: "Rest."
  - After wave 8: `light`: the bottom glow rises to fill the screen while exposure goes 1 → 6 over 2.0 s (Reinhard
    roll-off), then white 0 → 1 over 1.0 s, hold 0.5 s. The sound opens from 300 Hz to 16 kHz over 1.5 s.
- **Tuning.** Overlap = the share of the 5.0 s swell held (in the right direction on prompt waves). Rested gap =
  released for ≥ 80% of the rest. The squeeze: vignette to 35%, walls in 6% per swell (none in reduced motion),
  filter 300 Hz, a 40 to 80 Hz rumble. Length 2 + 64 + 3.5 ≈ 70 s for everyone. Cap 80 s.
- **Score.** Goal 3,000. Skill: 3,000 × mean overlap over 8 waves (any hold counts); 600 per prompt move (overlap in
  the right direction ≥ 0.7: 600, ≥ 0.4: 300); 600 × rested gaps / 8. Flourish: 1,000 × waves with overlap ≥ 0.9 / 8.
  The score is **not shown** at the end of this stage. It appears only on the run result.
- **Miss.** "Rest. Another wave will come." You move on anyway.
- **One-button.** Hold through every wave; `botSteer` gives the prompted direction.
- **Carry.** `turnDir` from wave 4 sets the direction of wave 8.
- **Facts.** Card `birth.card`. Captions `birth.fast`, `birth.waves`, `birth.tuck`, `birth.turn`, `birth.skull`,
  `birth.overlap`.
- **Look and sound.** Plum to white. Waves are deep swells (brown noise 40 to 80 Hz) and her slow breath. Never a
  sound of pain.
- **Bot steering.** Hold from the warning; on prompt waves drag in the prompted direction; release in the rest.
- **v1 builds.** 8 waves with the light, plus the four prompt waves.
- **Floor.** 8 plain hold waves, then the light.

### 6.9 The ending (`ending`, not scored): "Breathe."

| Time | What happens |
|---|---|
| 0.0 s | White. |
| 0.0 to 1.5 s | Silence: the one gap in her heartbeat (5.1). The white starts to soften into a warm, blurred room. |
| 1.5 s | "Breathe." A slow ring. Live gesture `hold`, optional. A press starts the inhale (a warm glow fills you); a release (at least 0.4 s; it lets go by itself at 2.5 s) gives a soft first cry. Her heart comes back soft and far (−12 dB). |
| 4.5 s | If there was no press, the breath comes by itself, with the caption "It can take a few seconds. That is normal." |
| about 6 to 9 s | Two more breaths come by themselves, a little uneven. Your glow warms (warm tones only, never a skin colour change). |
| about 9 s | Skin-to-skin: a big warm shape and a small one in a circle of light. No faces, no body outline. Her heartbeat comes close and clear, 76 bpm: "[{Carer}'s heartbeat, clear now]", "You know this heartbeat." |
| about 12 s | "Rest your thumb here." A soft ring: in portrait at bottom centre, 78% of the height; in landscape low in the corner on the side of your last touch (right if none), inside the safe area. Touching it makes both rings pulse together. Desktop: "Rest here. Hold Space if you like." |
| about 16 to 28 s | Your song is hummed, clear and full band. Notes you answered shimmer a little. |
| about 29 s | "Your nine months took 9 min 48 s." (run core time from Play to the end of Birth, pauses left out) |
| about 33 s | The run result fades in (or on a tap after 29 s). |

No points, no grade and no score line appear from the end of stage 8 until the run result.

## 7. Scoring

- Per stage: **Goal** (3,000: the stage's goal; always met after fertilization), **Skill** (up to 6,000) and
  **Flourish** (up to 1,000). Total up to 10,000. Only `core/score.js` clamps and grades; only `core/run.js` adds up.
- **Grades:** Good (goal met), Great (≥ 6,500), Glowing (≥ 8,500). A stage 1 "Go on" shows points with no grade word.
- **Run total** = the sum of the 8 stages + 500 per Glowing (max 84,000). **Run time** = core time from Play to the
  end of stage 8, pauses left out. Best run = higher total; a tie goes to the faster time.
- **Retry inside a run** keeps the better attempt's score for that stage, and the latest attempt's carry.
- **Marks:** "Assist" if Assist was on, "One-button" if one-button mode was on, in any counted attempt. Both still
  count.
- Each Glowing grade adds a spark to your membrane rim for the rest of the run (`carry.sparks`).
- The stage-end overlay shows only the grade word and the stage total ("Great · 8,420"). The run result shows the
  Goal, Skill and Flourish breakdown.

## 8. Screens and HUD

| Screen | Contents |
|---|---|
| Title | FIRST BREATH, the tagline, the content note "A gentle story of growing before birth. Cells, the womb and birth are shown simply.", **Play** (`#play`, ≥ 56 px), Stages (practice), Settings, Sources, the best line, "‹ Arcade" (to `/`), "Switch game" (`data-switch`), mute. Behind: her ring pulses on plum. |
| HUD | Top left: the stage name (16 px caps) and the clock label (16 px). Top right: the pause button (48 × 48 px) and the score to its left. The scale bar: top left under the clock in portrait, bottom left in landscape and desktop. The prompt line under the HUD, top centre, names the live gesture with an icon (dot, ring, arrow). Captions in a band at 50 to 58% of the height in portrait, bottom centre in landscape and desktop. In portrait no HUD, caption or overlay text sits in the bottom 40% during play. All inside `env(safe-area-inset-*)`. |
| Stage card | Number and name, the one-word verb with its gesture icon, the clock label, the size (NHS object where NHS gives one), one fact, and on the trimester stages the border line. Shown over the crossfade. Skippable from 1.0 s (tap, Space or Enter). Gone by itself at 3.5 s. |
| Stage-end overlay | The grade word, the stage total, one fact. Continues by itself at 2.5 s. A tap lingers; a second tap or Next continues. Not after Birth. |
| Almost card (stage 1 only) | "Almost. Try again?", "Your run and points are kept.", Try again (focused), Go on. |
| Pause | Resume, Try this stage again, Settings, Sound, Switch game, ‹ Arcade. Opens on Esc, P, the pause button, `visibilitychange` (hidden) and `pagehide`. |
| Settings | Word for the one who carries you (mother, mum, mom, parent), Assist, One-button mode, Motion (Auto, Full, Reduced), Captions (on), Large text, Tap test, Timing offset (−150 to +150 ms), Sound, and the line "Weeks count from the first day of the last period. Midwives and doctors count this way." |
| Run result | "Hello.", the run total and time, 8 grade chips (Good, Great, Glowing), the breakdown per stage, best, marks, sparks, Play again, Stages, ‹ Arcade, and the line "In this game, every baby is born well. The ending is the same for every score." Below a divider, "What was real": every fact shown this run with its clock label and link, ending with the Apgar fact. |
| Stages | Each reached stage, with its best and grade, as a button. Plays that stage alone with the carry it last started with in a run (or defaults). Its score goes only to that stage's best. |
| Sources | Every fact in the game with its clock label and its source links. |

## 9. Layouts

| Layout | Input | Long axis (forward in `long`) | Subject | Captions | Notes |
|---|---|---|---|---|---|
| Phone portrait 390 × 844 | touch, one thumb | up | 45% of the height from the top in `long`, 42% in `fit`; always above 60% | band at 50 to 58% | the bottom 40% is the thumb zone; nothing to read there during play; the scale bar sits top left under the clock |
| Phone landscape 844 × 390 | touch, either thumb | right | 38% of the width from the left | bottom centre, above the safe area | HUD at the top corners; scale bar bottom left |
| Desktop 1440 × 900 | keys (mouse optional) | right | 40% of the width | bottom centre | the canvas is capped at 0.6 MP before scaling |

- Tap targets are ≥ 44 px on the shorter side. Play is 56 px tall, pause 48 px. No horizontal scroll on any screen.
- Safe areas: CSS `env(safe-area-inset-*)`, combined with the test flag `?inset=t,r,b,l` (section 16.10).

## 10. Saves and the cabinet

- **Key** `first-breath.save.v1`, JSON, every read and write in try/catch (`ui/store.js`), validated by `core/save.js`:

  ```js
  { v: 1,
    best: { score, ms, done, assist, oneButton, grades: [8] },   // best finished run
    reached: 0..8,                                               // number of stages started at least once
    stages: { swim: { best, grade }, egg: {...}, ... },          // best per stage (runs and practice)
    carryIn: { swim: {...}, egg: {...}, ... },                   // the carry each stage last started with in a run
    settings: { carer, assist, oneButton, motion, captions, largeText, offsetMs } }
  ```

- Mute uses the arcade's shared `arcade.sound`. Continue is deferred (section 19.2); a run always starts at stage 1.
- A broken or old save gives defaults and never throws.
- **Cabinet line** (in `public/index.html`, next to the Ahead of the Light block, in try/catch): if `best.done === true`
  and `best.score` is a finite number > 0: `"BEST " + score.toLocaleString("en-US")` (for example "BEST 61,240"). Else
  the plain line SWIM · SPLIT · GROW · BREATHE. `core/save.js` exports the same rule as `cabinetLine(save)` for the
  node test. (The FURTHEST line is deferred.)
- **Cabinet**: copy the `ahead-of-the-light` article in `#row` whole: the marquee, the bezel with its screen and
  `.osd`, the `.panel` with START, the `.door` with its two `.slot` buttons, and the `.kick`. Then replace the names:
  `<article class="cab first-breath" data-game="first-breath" data-url="/first-breath/" aria-label="First Breath: a
  baby's journey to birth">`; marquee `<b>FIRST BREATH</b><small>A BABY'S JOURNEY TO BIRTH</small>`; screen `<img
  src="arcade/key/first-breath.svg" alt="A glowing egg in its ring of cells on deep plum, a small gold cell beside it,
  and soft white light above" loading="lazy" decoding="async">`; `.hi` SWIM · SPLIT · GROW · BREATHE; both slots
  `aria-label="Drop a token into First Breath"`. CSS `.cab.first-breath { --c1: #3a0f24; --c2: #ffb36b; --glow:
  rgba(255, 170, 120, 0.5); }`. The article goes after the `ahead-of-the-light` article in `#row`, and
  `"first-breath"` is appended to the Action group's `games`.
- **Switcher**: `{ id: "first-breath", name: "First Breath", sub: "A baby's journey to birth", url: "/first-breath/",
  art: "/arcade/key/first-breath.svg", color: "#ff9a7a" }` (the stage 3 light tint), after the Ahead of the Light
  entry in `GAMES`.
- **Cabinet art**: `public/arcade/key/first-breath.svg`, viewBox `0 0 480 396` (the screen's 4 : 3.3), under 10 KB,
  no script, no external reference, no text. A glowing egg with its corona on plum `#2a0818`, a small gold cell
  `#ffd77a` with a short tail, a soft white breath of light `#fff8f0` at the top.

## 11. Audio (`ui/sound.js`)

- One graph, built on the Play tap (the `ahead-of-the-light/ui/sound.js` pattern), against an **injected**
  `AudioContext`, so a test can render it with `OfflineAudioContext`: `createSound(ctx, { seed, latencyS })`.
  `latencyS` overrides `outputLatency` for tests. `navigator.audioSession.type = "playback"` where it exists.
  `quiet.js` suspends it when the page is hidden.
- **Graph**: her heart (two persistent sines, S1 42 → 32 Hz, S2 58 → 48 Hz, plus quiet 2nd and 3rd harmonics at 120 to
  180 Hz so phone speakers carry it), the souffle (seeded pink noise, Kellet filter, bandpass 180 Hz, swelling on each
  of her beats), the voice (a sine hum: a sine at F0 190 to 230 Hz, a soft 2nd harmonic and a slow 5 Hz vibrato), your
  heart (a 90 to 110 Hz sine, 40 ms decay), one-shots (plucks, chimes, swells; a pool of at most 16). All of these pass
  the **womb bus**: two low-pass filters in series, then a compressor, then the master (mute). A **birth bus** (room
  tone, breath, cry) stays silent until the ending.
- **Hearing over the run** (our artistic choice before week 15; Hepper 1994 after):

  | Stage | Womb bus cutoff | Note |
  |---|---|---|
  | 1 to 5 | 150 Hz, harmonics kept | felt, not heard: low thumps and swells |
  | 6 | 250 Hz at week 15 → 450 Hz at week 27 | hearing grows; low sounds first (PMID 7979483) |
  | 7 | 450 → 600 Hz | |
  | 8 | 300 Hz in the squeeze | |
  | ending | 300 Hz → 16 kHz over 1.5 s | the world opens |

- **Timing**: the lookahead pattern from Chris Wilson's "A tale of two clocks": a timer every 25 ms schedules the next
  100 ms on `currentTime`. Her beat times come from `run.beats()` (the stage's `state.beats` inside a stage, the run's
  own clock between stages, section 5.1), so sound and picture agree, also when muted, and there is no jump at a
  stage start. Each sound is scheduled `latencyS` early.
- **Birth sounds**: a first inhale (noise bandpassed 1 to 3 kHz, rising), a soft short cry (two sines at 450 and
  900 Hz with a gentle fall, 1.2 s), then the clear room.
- **Budget**: about 10 persistent voices plus the one-shot pool. No node churn per beat. Mute and pause ramp the master
  with `setTargetAtTime`.
- Sound is never required: every cue is also visual.

## 12. Accessibility

- **Captions** on by default, in an `aria-live="polite"` region: every sound cue has a caption with a symbol and, where
  it helps, a direction: "♥ {carer}'s heartbeat", "♥ your heartbeat", "~ wave", "♪ voice, left: 3 notes", "a loud
  sound outside", "first breath", "a soft cry".
- **Visual-only play**: every beat is a ring, every hummed note is a ripple, every answer note has a ghost ripple, and
  every target has a DOM ring in `svg#rings` before its time. Stages 2, 3, 5 and 6 play fully with sound off.
- **Reduced motion** (follows `prefers-reduced-motion`; Settings can override): warp ×0.5, no scale bounce, no camera
  shake, beats change brightness only, contractions do not move the walls (the vignette only), the birth light is a
  plain 1.5 s fade. The stage crossfade is the same in both modes. Rhythm stays.
- **Flash safety** (WCAG 2.3.1): one swell per beat, never one each for "lub" and "dub"; a full-screen tint follows only
  her heart (≤ 100 bpm) and changes frame luminance by ≤ 6%; your faster heart moves only its ring and a small splat
  (< 2% of the screen); at most 3 luminance swings of ≥ 10% in any 1 s; no red flashes; the birth light rises steadily.
- **Colour**: no goal depends on hue. Cues differ by shape and brightness: rings, dotted rims (gland pools) and wavy
  rims (blood pools), dashes and dots for the two hearts, chevrons for the warm lane, words for grades. Every cue has a
  2 px dark halo. Contrast ≥ 3:1 for each cue against its stage background and against its halo, also under protan,
  deutan and tritan simulation (section 17).
- **One-button mode** in every stage, and **Assist** (section 5 and each stage).
- **Large text**: base 16 px → 20 px; captions 18 px → 22 px.
- **Keyboard**: full play and full menus with visible focus (3 px `#ffd77a` ring). No moment needs the mouse.
- **No mash input** anywhere. No input needs two pointers.
- **Haptics** are deferred (section 19.2). Every cue already has a sound and a picture.

## 13. Art direction: "Warm Lantern"

### 13.1 Direction

- Soft translucent membranes lit from behind. Plum shadows. Coral and amber bodies. Cream rims.
- Light rises over the run: dim violet-red (stages 1 to 3), deep red (4), rose (5), amber (6), ember (7), plum to
  white (8), a warm cream room (ending). The stage backgrounds below rise in luminance in that order.
- The baby figure is abstract: soft blobs on a 2D skeleton, no face, no expression (NHS week 16: faces before birth are
  random). No realistic fetus portrait. No Nilsson-style composition.
- One camera whose scale only grows, from a 0.05 mm sperm to a 2 m room, with a scale bar from stage 3 on.
- Every frame has one brightest thing: the cue the player needs now (`cue` in the draw list).

### 13.2 Colour script (hex)

Tokens live in `render/palette.js` (plain data, node-importable). `ink` `#1a0610` is the halo and scrim colour
everywhere except the ending.

| Stage | bg | tissue | body | rim | cue (main) | cue (second) | light tint |
|---|---|---|---|---|---|---|---|
| 1 The Journey | `#1e0a1c` | `#4a1f3d` | `#c7a2b8` (other sperm) | `#f4d9e6` | `#ffd77a` (you) | `#ffb36b` (warm lane, chevrons) | `#ff9a8a` |
| 2 Ovulation | `#2a0e1a` | `#6e2436` | `#ffc9a8` (corona) | `#fff4ea` | `#ffd77a` (beat ring) | `#ffe9a8` (gold beats, trail) | `#ffb08a` |
| 3 The Embryo | `#3a0f24` | `#5a1426` | `#ff8a6b` (cells) | `#fff4ea` | `#ffd77a` (approach ring) | `#fff4ea` (hold ring) | `#ff9a7a` |
| 4 The Placenta | `#4a0f1e` | `#7a1e2e` | `#ffb3a0` (tree) | `#fff4ea` | `#f3eadf` (gland pools, dotted rim) | `#fff4ea` (your heart, dashed) | `#ff8a6a` |
| 5 First Trimester | `#521626` | `#74223a` | `#ffb8a8` (you) | `#fff4ea` | `#ffd77a` (cord lights) | `#ffe0c8` (move glow); `#ffb3c0` (blood pool rim, wavy) | `#ff8a7a` |
| 6 Second Trimester | `#5e2a16` | `#8a3a20` | `#ffc0a0` | `#fff4ea` | `#ffd77a` (voice ripples) | `#fff4ea` (answer ghosts, dashed); `#ffc9a8` (hand glow) | `#ffa860` |
| 7 Third Trimester | `#6e3214` | `#9a4a20` | `#ffc8a0` | `#fff4ea` | `#fff4ea` (breath ring) | `#ffe0a0` (roomy glow) | `#ffb36b` |
| 8 Birth | `#2a0818` | `#4a1630` | `#e8a0b8` | `#fff4ea` | `#fff4ea` (wave and prompt ring) | `#ffd77a` (direction arrow) | `#ffffff` |
| Ending | `#ffe8d6` | `#ffd2b8` | `#ffc9a8` (big shape), `#ffb38a` (small shape) | `#fff8f0` | `#7a2e1e` (rings, dark on light; halo `#fff8f0`) | `#4a1e10` (text) | `#ffffff` |

UI: text `#fff4ea` on a scrim `rgba(26, 6, 16, 0.72)`; buttons `#ffb36b` with text `#2a0818`; focus ring `#ffd77a`.
If a hex fails the contrast test, the cue is lightened (or darkened in the ending), never the background, and this
table is updated. The ending hue test skips achromatic tokens such as `#ffffff`.

### 13.3 Visual checks

Each is a test, not a judgement by eye (section 17): a frozen frame per stage (non-black; a cell centre redder than the
background; the rim the brightest band within 20 px; the cue at or above the frame's 95th luminance percentile), the
stage means rising in colour-script order, the palette contrast test, the flash rule, the birth-light ramp, the
ending's warm hues, and a screenshot of every stage at the three layouts for the PR.

## 14. Rendering stack and named sources (AGENTS.md rule)

### 14.1 Passes

One WebGL2 canvas (`alpha: false`, `antialias: false`), two passes, then overlays, measured in
`research/research-art.md` A0 at 7.0 ms for 195 × 422 px in SwiftShader with 32 blobs and 1,500 points.

1. **Splat**: one quad per splat into a half-resolution RGBA8 field with additive blending. Kernel `(1 − r²)³` on the
   distance to a point (circle) or to a segment (capsule). Channels: R membrane, G nucleus, B vessel and heart, A hue ×
   weight. Then `generateMipmap`.
2. **Composite** (one full-screen triangle, `mediump`): womb background from 2 taps of a seeded 128² noise texture;
   one domain warp of the sample position; threshold to membrane, rim and cytoplasm (`1 − exp(−σ f)`); hue = A / R;
   transmittance light `exp(−σ T)` with σ = (0.6, 2.2, 3.0) and a red scatter band; a back-light rim from the field
   gradient; caustics (stages 6 and 7); glow from the field's mip lod 3; the heart tint (≤ 6%); vignette; exposure with
   Reinhard roll-off; white mix.
3. **Overlays** (additive, same target): points as `gl.POINTS`; strips (tails, cilia, tree, cord, chevrons, ripples).
4. **DOM SVG** for beat rings (sharp, moved by `transform`, assertable in Playwright). HUD text stays in the DOM.
5. **Stage crossfade**: the last frame of the old stage is copied to a texture and mixed out over 0.8 s.

### 14.2 Sources

| Technique | Source adapted |
|---|---|
| Splat-and-threshold metaballs, `(1 − r²)³` kernel | Jamie Wong, "Metaballs and Marching Squares" (2014); Lucas Bebber, "Creative Gooey Effects", Codrops (2015) |
| Capsule kernel (distance to a segment) | Inigo Quilez, "2D distance functions" (sdSegment, sdCircle) |
| Smooth union | The summed field blends shapes by itself (Bebber's goo). Quilez's polynomial smin was considered and **not** used per pixel: `research/research-art.md` A0 measured per-pixel loops over blobs as the slow path. |
| Membrane wobble: one domain warp from a seeded noise texture | Stefan Gustavson, "Simplex noise demystified" (2005); `webgl-noise` (MIT) as reference |
| Light through tissue | Simon Green, GPU Gems ch. 16 (wrap, scatter band, `exp(−σ t)`); d'Eon and Luebke, GPU Gems 3 ch. 14 (red scatters farthest); Barré-Brisebois and Bouchard, GDC 2011, via Alan Zucconi (back-light term) |
| Glow | Field mip sampling, which a mobile OpenGL ES benchmark found faster than Kawase (ETASR); Intel's blur survey |
| Vignette | The common radial falloff, `1 − 1.3 · dot(v, v)` in the composite, as in `research/research-art.md` A3. No outside source fit beyond that. |
| Current | Bridson, Hourihan and Nordenstam, "Curl-Noise for Procedural Fluid Flow" (SIGGRAPH 2007), with the wall ramp; Reynolds, "Steering Behaviors for Autonomous Characters" (GDC 1999) for the bot's steering; Shiffman, *The Nature of Code* |
| Tails (your tail and the other sperm) | **None fit; our own design**: a travelling sine on each strip, amplitude rising toward the tip, phase from the swim speed. |
| Cilia | A vertex-shader metachronal wave, after the metachronal-wave review (PMC11044847) |
| Villous tree | Runions et al., venation (SIGGRAPH 2005) and space colonization (2007); pipe-model widths |
| Vessel and cord pulse by arc length | **None fit; our own design**: one swell per beat, `exp(−((φ − s/c − 0.08)/0.06)²)` |
| Chevrons (warm lane) | **None fit; our own design**: V marks along the lane centre, scrolling forward at the lane's speed. |
| Ripples (the voice) and ghost ripples (answers) | **None fit; our own design**: ring strips that grow at a fixed speed and fade as 1 − r / rMax; the dashed ghosts follow the approach-circle idea in the beat-cue row. |
| Caustics | Zucconi, "Believable Caustics Reflections" (2019): one tileable texture sampled twice, combined with `min`; Quilez, "Voronoi edges", for the baked texture. No Shadertoy code (licence). |
| Exposure and white at birth | Reinhard et al., "Photographic Tone Reproduction for Digital Images" (2002) for the roll-off; the arc after Jenova Chen, "Designing Journey" (GDC 2013); WCAG 2.3.1 |
| The ending's blurred warm room | `research/research-art.md` A8 (after the Journey arc): 3 large soft splats seen through the field's glow at a high mip (lod 5), so the blur needs no extra pass. |
| Stage crossfade | **None fit**: a plain alpha mix of the old frame and the new one. (The log zoom after Eames, *Powers of Ten* (1977), is deferred.) |
| Beat cue rings | osu! approach circles; Rhythm Heaven's sound-plus-picture cues |
| Baby figure as blobs on a skeleton | James Blinn, "A Generalization of Algebraic Surface Drawing" (1982), as splats |
| Canvas 2D fallback (plain shapes) | MDN, "Optimizing canvas" for what to avoid. No look source: it is plain on purpose. |
| Colour-vision simulation (tests) | Machado, Oliveira and Fernandes, "A Physiologically-based Model for Simulation of Color Vision Deficiency" (IEEE TVCG 2009), severity 1.0 matrices; WCAG 2.x relative luminance and contrast |
| Audio timing and the womb | Chris Wilson, "A tale of two clocks"; Gerhardt and Abrams, J Perinatol 2000 (energy above 0.5 kHz down 40 to 50 dB); Paul Kellet's pink noise. The sine hum and the cry: **none fit**, plain sines. |

### 14.3 Budgets and adaptive resolution

- Per frame: ≤ 32 splats (the baby figure included), ≤ 600 points in a stage's draw list plus ≤ 900 decorative motes
  from render (≤ 1,500 points in all), ≤ 6 strips, ≤ 24 marks, ≤ 8 DOM rings, ≤ 12 WebGL draw calls.
- Base size: phones 1.0 × CSS px (DPR ignored); desktop capped at 0.6 MP. The **scale step** multiplies the base
  width and the base height (per axis, so 0.5 draws a quarter of the pixels): steps [1, 0.8, 0.66, 0.5, 0.4, 0.35].
  `?res=` pins the step.
- **Frame cost** (`perf.emaMs`, `perf.p95Ms`): the JS time of one frame, from the start of its fixed steps to the end
  of its draw, by `performance.now()`. Under `?probe=1` the draw ends with `gl.finish()`, so the cost includes the GPU
  work (SwiftShader runs it on the CPU). `emaMs` is an EMA with α = 0.1; `p95Ms` is the 95th percentile of the last
  120 frames.
- **Adaptive steps**: step down when `emaMs` > 14 ms, or the rAF interval average > 20 ms, for 30 frames in a row.
  Step up when `emaMs` < 8 ms and the interval average < 18 ms for 120 frames.
- `uTime` wraps at 1,000 s. `mediump` in fragment shaders.
- **Canvas 2D fallback** (v1: plain shapes) when WebGL2 is missing, a shader fails, the context is lost twice, or
  `?gl=0`. It draws the same draw list: the background as one flat fill with a CSS vignette, splats as filled circles
  and capsules with one translucent fill each, ≤ 300 points as `fillRect`, strips as plain lines, marks as plain
  circles. Never `ctx.filter`, `shadowBlur`, per-frame full-screen gradients or `arc` batches. A fallback that matches
  the Warm Lantern look is deferred.

### 14.4 The baby figure (`core/lib/figure.js`)

- `figure(pose, sizeU, gaDay) → Splat[]`, at most 14 splats: head, body, 4 limbs (2 capsules each, or 1 bud before
  week 8), a heart splat (vessel channel), the cord root. No face. Poses: curl, uncurl, stretchL, stretchR, startle,
  kick, fist, thumb, headDown, tuck, lift.
- The shape changes by gaDay: buds that grow from 2 mm to 10 mm (gaDay 36 to 49, the stage 4 grow moment, and on to
  week 8), limbs (from week 8), rounder body (from week 28).
- In the ending the small shape is 3 soft splats with a warm glow. Its warmth rises as a glow; its hue stays in the warm
  range (no blue, no grey).

## 15. Facts and sources

### 15.1 Rules

- Every shown fact is one entry in a stage's `<id>.facts.js` (`export const FACTS = [...]`): `{ id, stage, gaDay,
  gaEnd?, fertilized?, text, src: [keys], access: "R" | "A", checked: true, where: "card" | "caption" | "overlay" |
  "end" | "result" }`. `gaEnd` marks a span. `fertilized` is only needed at gaDay 14 (default: `gaDay > 14`).
- `src` keys resolve in `core/sources.js`, an allow-list built from `research/research-biology.md` section 12 and its
  inline URLs.
- `access` is R (the page was read) or A (the abstract was read). Any S fact fails the test.
- `checked: false` keeps a fact out of the game (the WHO weights until the 2017 and 2021 corrections are reviewed).
- Labels come from `clock.label(gaDay)`, or `clock.range(gaDay, gaEnd)` for a span. No fact text starts with "Week" or
  "Day". Screens, Sources and "What was real" put the label in front of the text, so each label prints once. "Day"
  labels always say "after fertilization".
- Each fact ≤ 20 words; each sentence ≤ 16 words, with every carer word substituted. The label is its own sentence and
  does not count toward the 20 words.
- Size comparisons quote the NHS object and say so ("a plum, the NHS says"). Cells get no comparison.

### 15.2 Fact table

The gaDay column gives `gaDay`, or `gaDay` to `gaEnd` for a span. "(f)" marks `fertilized: true` at gaDay 14.

| Id | gaDay | Text | Sources (access) |
|---|---|---|---|
| `swim.half` | 14 | "Half of your genes ride in this sperm cell. The other half are in an egg." | TTUHSC first week (R); PMID 33964210 (A) |
| `swim.waves` | 14 | "In one study, waves carried sperm-sized particles to a tube in about a minute." | PMID 8671281 (A) |
| `swim.side` | 14 | "The waves sent most of the particles toward the tube on the egg's side." | PMID 8671281 (A) |
| `swim.few` | 14 | "Only a few thousand sperm reach the tubes. One study found about 250 there." | PMID 16272225 (A); PMID 8150897 (A) |
| `swim.flow` | 14 | "Sperm turn to swim against a gentle flow." | PMID 23453951 (A) |
| `swim.warm` | 14 | "Ready sperm swim toward warmer places." | PMID 22848657 (A) |
| `swim.walls` | 14 | "Sperm that meet a wall tend to swim along it." | PMID 26183721 (A) |
| `swim.rest` | 14 | "In many mammals, sperm rest on the tube wall before the egg comes. Human data are less clear." | PMID 26183721 (A); PMID 8150897 (A) |
| `swim.ready` | 14 | "In lab tests, only 2 to 14 in 100 sperm are ready at one time." | PMID 7479932 (A) |
| `swim.race` | 14 | "It is not a race. A sperm must be ready at the right time and place." | PMID 16607290 (A); PMID 7479932 (A) |
| `swim.wait` | 14 | "Sperm can stay alive in the body for up to five days." | CC sperm (R) |
| `egg.surge` | 14 | "A surge of a hormone called LH releases the egg." | CC 23439 ovulation (R) |
| `egg.size` | 14 | "The egg is about 0.1 mm across, about two sperm lengths." | BioNumbers 111184 (R); PMID 22848657 (A) |
| `egg.fimbriae` | 14 | "Finger-like ends of the tube move close and catch the egg." | CC 24346 fimbriae (R) |
| `egg.cilia` | 14 | "The egg cannot swim. Tiny hairs called cilia sweep it into the tube." | embryology.ch migration (R); CC 24346 (R) |
| `egg.signal` | 14 | "Cells around the egg release a signal. It helps ready sperm find the egg." | PMID 21412339 (A) |
| `egg.day` | 14 | "The egg can meet a sperm for about a day." | CC 23439 (R) |
| `egg.place` | 14 | "This usually happens in the wide outer part of the tube." | CC 11585 conception (R); PMID 16272225 (A) |
| `egg.fuse` | 14 (f) | "A sperm protein called Izumo1 meets an egg protein called Juno." | PMID 24739963 (A) |
| `egg.block` | 14 (f) | "Then the egg's shell changes, so no other sperm can join." | TTUHSC (R); PMID 24739963 (A) |
| `egg.pronuclei` | 14 (f) | "The two nuclei touch but stay apart. The two sets join at the first split." | PMID 33964210 (A) |
| `egg.weeks` | 14 (f) | "Midwives and doctors already call this week 2. Weeks count from the first day of the last period." | NHS week 4 (R); CC 7247 (R) |
| `split.two` | 15 | "You are 2 cells." | embryology.ch migration (R) |
| `split.small` | 16 | "You divide, but you do not grow. Your cells get smaller." | UNSW Carnegie table (R) |
| `split.carried` | 16 | "Tiny hairs and gentle squeezes of the tube carry you toward the womb." | embryology.ch migration (R) |
| `split.morula` | 18 | "You are a ball of 16 to 32 cells." | embryology.ch migration (R) |
| `split.inner` | 19 | "Your inner cells become you. Your outer cells help make the placenta." | MedlinePlus 002398 (R); CC 22889 blastocyst (R) |
| `split.hatch` | 20 | "You hatch from your clear shell." | embryology.ch migration (R) |
| `root.bury` | 20 to 23 | "You bury yourself in the soft lining of the womb." | UNSW Week 2 (R); PMID 12050279 (A) |
| `root.hcg` | 23 | "You start to send a signal called hCG. Pregnancy tests look for it." | UNSW Week 2 (R); CC 22489 hCG (R) |
| `root.grows` | 25 | "The placenta grows from you. It has the same genes as you." | CC 22337 placenta (R) |
| `root.glands` | 28 | "At first, glands in the lining feed you. Oxygen is low, and that is normal." | PMID 12050279 (A); PMID 11106583 (A) |
| `root.heart` | 36 | "Your heart beats for the first time." | UNSW heart (R) |
| `root.tube` | 36 | "Your heart is a simple tube for now." | CC 7247 (R); UNSW heart (R) |
| `root.size` | 36 | "About 2 mm long. The NHS compares this to a sesame seed." | NHS week 5 (R) |
| `root.buds` | 42 | "About 6 mm long. Small buds appear that will become your arms and legs." | NHS week 6 (R) |
| `root.w7` | 49 | "About 10 mm long. Your eyelids start to form." | NHS week 7 (R) |
| `grow.w7` | 49 | "Your brain grows faster than your body." | NHS week 7 (R) |
| `grow.tri` | 49 | "First trimester: up to about week 13." | CC 9699 first trimester (R); NHS week 4 (R) |
| `grow.w8` | 56 | "About 16 mm, a raspberry, the NHS says. Your head uncurls." | NHS week 8 (R) |
| `grow.arms` | 56 | "Your arms grow faster than your legs." | NHS week 8 (R) |
| `grow.peak` | 63 | "Your heart now beats about 170 times a minute." | NHS week 28 (R) |
| `grow.fetus` | 70 | "From about now you are called a fetus. Sources differ, from week 8 to week 10." | NHS week 8 (R); MedlinePlus 002398 (R); UNSW Carnegie table (R) |
| `grow.w11` | 77 | "You open and close your fists." | CC 7247 (R) |
| `grow.w11kick` | 77 | "You kick, but {carer} cannot feel it yet." | NHS week 11 (R) |
| `grow.w12` | 84 | "About 5.4 cm, a plum, the NHS says. Your bones start to harden." | NHS week 12 (R) |
| `grow.flow` | 84 | "Near week 12, more of {carer}'s blood flows into the placenta." | PMID 11106583 (A); PMID 12050279 (A) |
| `grow.never` | 84 | "Your blood and {carer}'s blood never touch." | embryology.ch villi (R); CC 22337 (R) |
| `grow.w13` | 91 | "Some babies start to suck a thumb." | NHS week 13 (R) |
| `answer.card` | 98 | "About 8.5 cm, a kiwi fruit, the NHS says." | NHS week 14 (R) |
| `answer.tri` | 98 | "Second trimester: about weeks 14 to 27." | CC 9699 (R); NHS week 28 (R) |
| `answer.hear` | 105 | "You start to hear {carer}'s heartbeat." | NHS week 15 (R) |
| `answer.respond` | 133 | "In one study, the first response to sound was to a low tone." | PMID 7979483 (A) |
| `answer.w20` | 140 | "About 25.6 cm, a banana, the NHS says. From now, length is head to heel." | NHS week 20 (R) |
| `answer.feel` | 140 | "{Carer} may first feel you move between about week 16 and week 24." | CC 22829 quickening (R); NHS week 17 (R) |
| `answer.outside` | 147 | "By week 21, you can hear voices outside the womb." | NHS week 21 (R) |
| `answer.low` | 154 | "Low sounds reach you first. High sounds come later." | PMID 7979483 (A) |
| `answer.hic` | 161 | "You can get hiccups by about week 19." | CC 7247 (R) |
| `answer.jump` | 175 | "A loud noise can make you jump." | NHS week 25 (R) |
| `answer.eyes` | 182 | "Your eyes open for the first time." | NHS week 26 (R) |
| `turn.card` | 196 | "Third trimester: about week 28 to birth. About 37.6 cm long." | NHS week 28 (R) |
| `turn.lungs` | 203 | "Your lungs are full of fluid. Oxygen still comes through the cord." | MedlinePlus 002395 (R) |
| `turn.focus` | 210 | "Your eyes can focus." | NHS week 30 (R) |
| `turn.voices` | 217 | "You start to know voices from outside." | NHS week 31 (R) |
| `turn.practice` | 217 to 238 | "You make breathing movements for practice." | MedlinePlus 002398 (R) |
| `turn.curl` | 238 | "You curl up with your legs bent to your chest." | NHS week 34 (R) |
| `turn.head` | 252 | "Most babies turn head-down by 36 to 37 weeks." | RCOG breech (R) |
| `turn.voice` | 266 | "Near birth, your heart beats faster when you hear {carer}'s voice." | PMID 12741744 (A) |
| `turn.weight` | 280 | "From week 28 to week 40, your weight about triples." (`checked: false`) | WHO fetal growth charts (R), corrections not yet reviewed |
| `birth.card` | 280 | "Most labours start within a week either side of the due date." | NHS week 39 (R) |
| `birth.fast` | 280 | "Time is sped up. Real waves come minutes apart." | CC 22640 stages of labor (R) |
| `birth.waves` | 280 | "Waves called contractions help you move down." | CC 22640 (R) |
| `birth.tuck` | 280 | "You tuck your chin. The smallest part of your head leads." | OB-GYN 101 mechanism (R); GLOWM (R) |
| `birth.turn` | 280 | "You turn as you move down, to fit the way out." | GLOWM (R); OpenStax 15.2 (R) |
| `birth.skull` | 280 | "Your skull bones are soft. Your head can change shape a little." | NHS week 33 (R) |
| `birth.overlap` | 280 | "These moves overlap. Each one blends into the next." | PMID 34214716 (A) |
| `end.seconds` | 280 | "It can take a few seconds. That is normal." | NHS week 39 (R) |
| `end.breath` | 280 | "Babies take a first breath within about 10 seconds." | MedlinePlus 002395 (R) |
| `end.fluid` | 280 | "Air fills your lungs. The fluid in your lungs clears." | MedlinePlus 002395 (R) |
| `end.skin` | 280 | "Skin-to-skin contact helps your breathing and your heart rate." | NHS skin-to-skin (R) |
| `end.voice` | 280 | "In one study, newborns preferred {carer}'s voice to a stranger's." | PMID 7375928 (A) |
| `end.apgar` (result only) | 280 | "One minute after birth, a midwife or doctor checks five things. This is the Apgar score." | MedlinePlus 003402 (R) |

### 15.3 Source key (`core/sources.js`)

NHS week N: `https://www.nhs.uk/best-start-in-life/pregnancy/week-by-week-guide-to-pregnancy/<1st|2nd|3rd>-trimester/week-N/`
· NHS skin-to-skin: `https://www.nhs.uk/best-start-in-life/baby/baby-basics/caring-for-your-baby/skin-to-skin-contact-with-your-newborn/`
· CC sperm `https://my.clevelandclinic.org/health/body/sperm` · CC 23439 `https://my.clevelandclinic.org/health/body/23439-ovulation`
· CC 24346 `https://my.clevelandclinic.org/health/body/24346-fimbriae` · CC 11585 `https://my.clevelandclinic.org/health/articles/11585-conception`
· CC 22889 `https://my.clevelandclinic.org/health/body/22889-blastocyst` · CC 22489 `https://my.clevelandclinic.org/health/articles/22489-human-chorionic-gonadotropin`
· CC 22337 `https://my.clevelandclinic.org/health/body/22337-placenta` · CC 7247 `https://my.clevelandclinic.org/health/articles/7247-fetal-development-stages-of-growth`
· CC 9699 `https://my.clevelandclinic.org/health/articles/9699-first-trimester` · CC 22829 `https://my.clevelandclinic.org/health/body/22829-quickening-in-pregnancy`
· CC 22640 `https://my.clevelandclinic.org/health/body/22640-stages-of-labor`
· MedlinePlus 002398, 002395, 003402: `https://medlineplus.gov/ency/article/<n>.htm`
· UNSW Carnegie `https://embryology.med.unsw.edu.au/embryology/index.php/Carnegie_stage_table` · UNSW Week 2 `…/index.php/Week_2` · UNSW heart `…/index.php/Cardiovascular_System_-_Heart_Development`
· embryology.ch migration `https://embryology.ch/en/embryogenese/preimplantation/segmentation-migration/migration-embryon.html` · embryology.ch villi `https://embryology.ch/en/embryogenese/fetal-membranes-and-placenta/development-of-the-placental-villi/the-three-villus-types/`
· TTUHSC `https://anatomy.ttuhscep.edu/embryo/03firstweek.htm` · BioNumbers 111184 `https://bionumbers.hms.harvard.edu/bionumber.aspx?id=111184`
· RCOG `https://www.rcog.org.uk/for-the-public/browse-our-patient-information/breech-baby-at-the-end-of-pregnancy/`
· GLOWM `https://www.glowm.com/article/heading/vol-11--labor-and-delivery--presentation-and-mechanism-of-labor/id/414323`
· OB-GYN 101 `https://oacapps.med.jhmi.edu/OBGYN-101/Text/Labor%20and%20Delivery/mechanism_of_normal_labor.htm`
· OpenStax 15.2 `https://openstax.org/books/maternal-newborn-nursing/pages/15-2-stages-of-labor`
· WHO `https://journals.plos.org/plosmedicine/article?id=10.1371/journal.pmed.1002220`
· PubMed `https://pubmed.ncbi.nlm.nih.gov/<PMID>/`.

Full notes, with every fact's access tag: `research/research-biology.md` and `research/research-art.md` in this change
folder. The benchmark pages named in `research/research-art.md` A0 stayed in the design session's scratchpad; A0 records their
numbers.

### 15.4 Words

- **Banned** in every shown string (case-insensitive, word start): die, dies, died, dying, dead, death, kill…, lose,
  loses, losing, lost, loser, fail…, miscarr…, abort…, sex…, pain…, hurt…, danger…, sick…, viab…, prematur…, NICU.
- **Pronouns banned** in every shown string: she, her, hers, herself, he, him, his, himself, they, them, their, theirs,
  themselves.
- No shown string names or frames the score as Apgar. "Apgar" appears only in `end.apgar` and the Sources screen.
- Sentences ≤ 16 words. One idea per sentence.

## 16. Build contract

This section is frozen before the stage agents start. A stage agent edits only its own files (16.12). If the contract
is missing something, the stage uses what exists and notes the gap in its task list; the contract owner updates this
section.

### 16.1 File layout

```
public/first-breath/
  index.html          quiet.js first in <head>; switch.js; canvas#view; svg#rings; DOM HUD and screens; analytics.js last
  style.css
  main.js             boot, URL flags, the 60 Hz fixed-step loop, input time mapping, run ↔ render ↔ ui, sound
                      scheduling, pause on visibilitychange and pagehide, window.__fb (wired in wave 0)
  core/               pure: no DOM, no window, no Date, no performance, no Math.random, no timers, no storage
    rng.js            stream(seed, name), gauss(r), pick(r, list)          (wraps ../../lab/kit/rng.js)
    clock.js          DT, week(), label(), range(), gaAt(), mmPerShortAxis(), bpmYou()
    beat.js           makeBeats()
    judge.js          WIN, GRACE_S, CREDIT, windows(), grade(), median()
    intent.js         EMPTY_INTENTS, makeIntents(), the Intents shape
    draw.js           LIMITS, emptyDraw(), validate(list)
    events.js         EVENTS (names), emit(state, name, data)
    carry.js          DEFAULT_CARRY, DEFAULT_SONG, mergeCarry()
    score.js          PARTS, clampScore(), grade(), runTotal()
    text.js           CARERS, say(id, vars, settings), allStrings()
    facts.js          FACTS (aggregated), byId(), label(fact), shown(settings)
    sources.js        SOURCES allow-list
    save.js           SAVE_KEY, defaults(), parse(), recordStage(), recordRun(), recordCarryIn(), cabinetLine()
    run.js            createRun(), the sequencer (16.8)
    bots.js           createBot(skill, seed): timing and the run-level choices
    ending.js         the ending, a stage-shaped module with meta.scored = false
    lib/
      track.js        createTrack(), feed(), upcoming(), accuracy(), streak()
      goals.js        subgoal(), doneBy(), reach(), holdOverlap(), turnToward()
      steer.js        steerBody()
      flow.js         curl(), tubeFlow(), wallRamp()
      colonize.js     createTree(), growTree()                (caps built in)
      figure.js       figure(pose, sizeU, gaDay)
    stages/
      index.js        STAGES = [swim, egg, split, root, grow, answer, turn, birth]   (static imports, written in wave 0)
      swim.js   swim.tune.js   swim.facts.js   swim.text.js
      egg.js    egg.tune.js    egg.facts.js    egg.text.js
      split.js  split.tune.js  split.facts.js  split.text.js
      root.js   root.tune.js   root.facts.js   root.text.js
      grow.js   grow.tune.js   grow.facts.js   grow.text.js
      answer.js answer.tune.js answer.facts.js answer.text.js
      turn.js   turn.tune.js   turn.facts.js   turn.text.js
      birth.js  birth.tune.js  birth.facts.js  birth.text.js
  render/
    renderer.js       createRenderer(canvas, opts)            (a wave-0 stub that draws with debug.js; wave 1 fills it)
    gl.js  field.js  composite.js  overlay.js  flat.js  camera.js  perf.js  palette.js  rings.js  debug.js
    strips/  tails.js  cilia.js  tree.js  cord.js  chevrons.js  ripples.js
  ui/
    input.js  hud.js  captions.js  screens.js  sound.js  store.js   (hud, captions, screens, sound: wave-0 stubs)
public/arcade/key/first-breath.svg

qa/first-breath/
  purity.test.mjs  clock.test.mjs  beat.test.mjs  judge.test.mjs  track.test.mjs  draw.test.mjs  run.test.mjs
  save.test.mjs  facts.test.mjs  text.test.mjs  palette.test.mjs  perf.test.mjs  sim.test.mjs
  stage-swim.test.mjs  stage-egg.test.mjs  stage-split.test.mjs  stage-root.test.mjs
  stage-grow.test.mjs  stage-answer.test.mjs  stage-turn.test.mjs  stage-birth.test.mjs  ending.test.mjs
  bot.mjs
  smoke.e2e.mjs  layout.e2e.mjs  input.e2e.mjs  perf.e2e.mjs  visual.e2e.mjs  sound.e2e.mjs  shots.mjs
```

### 16.2 Shared modules (wave 0) and their signatures

```js
// core/rng.js
export function stream(seed, name)        // → () => float in [0,1): mulberry(fnv1a(String(seed) + ":" + name))
export function gauss(r)                  // → standard normal from stream r (Box–Muller, no caching)
export function pick(r, list)             // → one item

// core/clock.js
export const DT = 1 / 60
export function week(gaDay)                               // floor(gaDay / 7)
export function label(gaDay, { fertilized = true } = {})  // section 4; uses floor(gaDay)
export function range(gaFrom, gaTo)                       // section 4, for a span
export function gaAt(moment /* { ga: [from, to], lenS } */, secondsInMoment)   // section 4.1
export function mmPerShortAxis(meta, gaDay)               // section 4; log-lerp over meta.ga
export function bpmYou(gaDay)                             // section 5.1 curve; NaN before gaDay 36

// core/beat.js
export function makeBeats(seed, segments)
//   segments: [{ heart: "mother"|"you", from, to, bpm?, gaFrom?, gaTo?, jitter: 0..0.03, first? }]
//   first: the time of the first beat (for her: opts.motherPhase)
//   → { mother: Float64Array, you: Float64Array|null,           // beat times in stage seconds
//       bpm(heart, t), phase(heart, t) /* 0..1 */, next(heart, t), between(heart, t0, t1) /* times */ }

// core/judge.js
export const WIN = { inMs: 70, closeMs: 170, inK: 0.12, closeK: 0.28, offK: 0.45, assist: 1.6, closeCapK: 0.4, minP: 0.5 }
export const GRACE_S = 0.05                // a miss waits this long past the Close window
export const CREDIT = { in: 1, close: 0.5, off: 0, miss: 0 }
export function windows(P, assist)       // → { in, close, off } in seconds
export function grade(errS, P, assist)   // → "in" | "close" | "off" | null (free)
export function median(list)             // the Tap test's offset

// core/lib/track.js
export function createTrack(targets, { assist = false } = {})
//   targets: [{ id, t, P, kind: "tap"|"press"|"release", heart, group }]  stage seconds, sorted by t, spacing ≥ 0.5 s
export function feed(track, intents, tEnd)  // → [{ target, grade, errMs, rawMs }]; a miss when tEnd > t + close + GRACE_S
export function upcoming(track, t, horizonS)
export function accuracy(track, group?)
export function streak(track, group?)       // → { current, best } (In time only)

// core/lib/goals.js
export function subgoal(state, id, textId)            // sets state.subgoals[id] = "shown"; emits subgoal
export function doneBy(state, id, how /* "you"|"auto" */, textId)   // sets "done" or "auto"
export function reach(p, c, r)                        // boolean
export function holdOverlap(heldIntervals, t0, t1)    // 0..1
export function turnToward(angle, target, rateRadS, dt)

// core/score.js
export const PARTS = { goal: 3000, skill: 6000, flourish: 1000 }
export function clampScore({ goal, skill, flourish })  // → { goal, skill, flourish, total } (integers)
export function grade(total, goalMet)                  // → "Good" | "Great" | "Glowing" | null
export function runTotal(stageScores)                  // + 500 per Glowing

// core/text.js
export const CARERS = { mother: "your mother", mum: "your mum", mom: "your mom", parent: "your parent" }
export function say(id, vars = {}, settings = {})      // {carer} {Carer} and named vars
export function allStrings()                           // every registered string, for tests

// core/stages/<id>.facts.js, <id>.text.js, <id>.tune.js
export const FACTS = [ /* section 15.1 */ ]
export const TEXT = { /* stringId: "text" */ }
export const TUNE = { /* the stage's numbers */ }

// core/save.js
export const SAVE_KEY = "first-breath.save.v1"
export function defaults(); export function parse(raw)     // never throws
export function recordStage(save, id, result, marks); export function recordRun(save, run)
export function recordCarryIn(save, id, carry); export function cabinetLine(save)

// core/bots.js
export function createBot(skill, seed)
//   → { intents(mod, state) /* stage-time intents for one step */, choose(screen) /* "goOn", "skip", … */ }

// ui/store.js   (the only module that touches localStorage)
export function get(key, fallback); export function set(key, value)
export function soundOn(); export function setSoundOn(on)   // "arcade.sound"

// ui/input.js
export function createInput(el, { coreTime /* wallMs → core s */, camera /* () => Camera */, settings })
//   → { setLive(gesture), intents(tStepEnd) /* drains events up to tStepEnd, in core seconds */,
//       stick /* {on, ox, oy, x, y} */, inject(events) /* tests */, dispose() }

// render/renderer.js
export function createRenderer(canvas, { gl = true, res = null, probe = false, motion })
//   → { draw(drawList), resize(cssW, cssH),
//       perf /* {emaMs, p95Ms, scale, w, h, px, draws, splats, points, fallback} */,
//       lum() /* mean luminance 0..1, with probe */, crossfade(seconds), dispose() }
// render/camera.js
export function makeCamera(viewW, viewH, cam /* draw.camera */)
//   → { toScreen(x, y), toWorld(px, py), stickToWorld(vx, vy), orient, pxPerU }
// render/rings.js
export function createRings(svg) // → { draw(rings, camera, motion) }
// render/debug.js
export function drawDebug(ctx2d, drawList)   // plain shapes; for stage agents' own checks

// ui/hud.js
export function createHud(root)  // → { set({ stageName, clock, score, prompt, scale }), dispose() }
// ui/captions.js
export function createCaptions(root, { on }) // → { say(id, text, { dir, ms = 4000 }), clear() }
// ui/screens.js
export function createScreens(root, { act }) // → { show(name, data), hide(), current }
//   names: title, card, overlay, almost, pause, settings, tapTest, stages, sources, result
// ui/sound.js
export function createSound(ctx /* AudioContext or OfflineAudioContext */, { seed, latencyS })
//   → { start(), setMuted(b), setScene({ stage, cutoffHz, hearing, motherDb, youDb, voice }),
//       schedule(heart, times /* core s */, toCtxTime), sfx(id, at, opts), hum(notes, at, { clear }), breath(kind, at),
//       open(seconds), suspend(), resume(), stats() /* {state, cutoffHz, scheduled:{mother,you}, muted, voices, latencyS} */ }
```

### 16.3 Intents and the time base

```js
// core/intent.js — one per fixed step, built by ui/input.js (or a bot, or a test)
{
  steer: { x, y },          // world space, |steer| ≤ 1; camera.stickToWorld maps the screen stick, so core never knows orientation
  touching: false,          // a pointer, an arrow, WASD or an action key is down
  presses:  [{ t, raw }],   // each touch-down, action keydown, or (in dragHold) arrow keydown in this step
  releases: [{ t, raw }],   // each release in this step
  taps:     [{ t }],        // classified taps (touch-down time), for menus only; no stage reads them
  dir: null                 // "up"|"down"|"left"|"right" (screen axes) once a drag passes 12 px, or from the arrow key
}
```

- **Core time** (`main.js`): `raw = (wallMs − wallStart − pausedMs) / 1000`, where `wallMs` is
  `PointerEvent.timeStamp` or `KeyboardEvent.timeStamp` (the `performance.now()` clock). `t = raw − offsetMs / 1000`.
  An event goes into the step whose range holds its `t` and keeps its exact times.
- **Stage time.** `run.step` converts every time in the intents to stage time (`t − stageStartCore`,
  `raw − stageStartCore`) before it calls `stage.step`. A Stage only ever sees stage seconds, the same clock as
  `state.t`, `makeBeats`, `targets()` and the bots. `__fb.tap`, `press` and `release` inject in stage time, and the
  bot in 16.11 presses at `target.t` in stage time.
- **Errors.** `errMs = (t − target.t) × 1000` grades the press. `rawMs = (raw − target.t) × 1000` is the error before
  the offset; judge events carry both.
- **Classification.** Tap and press targets read `presses`. `taps` is for menus only. In a `dragHold` moment, an arrow
  or WASD keydown emits a press plus its `dir`, and its keyup emits a release. Space, Enter or Z alone emits a press
  with `dir` null, which counts as a plain hold. Key repeats are ignored.

### 16.4 The Stage interface

Every module in `core/stages/` (and `core/ending.js`) exports exactly this:

```js
export const meta = {
  id, index, name, verb,              // "swim", 0, "The Journey", "Swim"
  orient,                             // "long" | "fit"
  families,                           // e.g. ["steer"]; at most 2
  ga: { start, end }, fertilized,     // gaDay span; fertilized at the start?
  mm: { start, end },                 // real mm across the short axis (section 3.1)
  motherBpm,                          // her rate at the stage start; the run glides to it over the card
  parS, capS, canFail,                // canFail is true only for swim
  scored,                             // false only for ending
  moments,                            // ordered [{ id, ga: [from, to], lenS }] (section 4.1), for gaAt() and jump()
};
export function create(seed, carryIn, opts)  // opts: { assist, oneButton, motherPhase }  → state (plain object)
export function step(state, intents)         // advances DT; intents in stage seconds; pushes events; never throws
export function view(state)                  // → DrawList (16.5); pure; no allocation of more than the limits
export function prompt(state)                // → { gesture: "drag"|"tap"|"hold"|"dragHold"|"none", text: stringId }
export function targets(state, horizonS)     // → upcoming timed targets [{ id, t, P, kind, heart, group }]
export function botSteer(state, skill, r)    // → { steer: {x, y}, dir, hold: bool }; every stage exports it
                                             //   (a tap-only stage returns { steer: {x: 0, y: 0}, dir: null, hold: false })
export function result(state)                // → { done, goalMet, score: {goal, skill, flourish, total} | null,
                                             //     parts: [{ id, label, value, max }], metrics: {…}, carryOut }
export function jump(state, moment)          // skip to a named moment; for tests, and for swim's "carried"
```

State must carry: `t` (stage seconds), `gaDay` (from `gaAt`), `fertilized`, `events` (array; the host drains it after
each step), `beats` (from `makeBeats`, her beats starting at `opts.motherPhase`), `subgoals` (`{ [id]: "shown" | "done"
| "auto" }`), and `moment` (the current moment name). State may hold rng closures; nothing mid-stage is saved. Stage
files never import each other, `render/`, `ui/` or `main.js`.

**`opts.motherPhase`** is the stage seconds from the stage start to her next beat (default 0). The stage lays her beats
from it at `meta.motherBpm` (5.1).

**`opts.oneButton`** is for tuning only. `core/run.js` applies one-button mode for every stage, before `stage.step`:

```js
if (settings.oneButton) {
  const a = mod.botSteer(state, 1, rOne);              // rOne = stream(stageSeed, "oneButton")
  intents.steer = intents.touching ? a.steer : { x: 0, y: 0 };
  intents.dir = a.dir;
}
```

At its cap a stage ends: `swim` with `goalMet: false`; every other stage completes its goal by itself and ends with
`goalMet: true`. After Go on, the run calls `swim.jump(state, "carried")`: 3 s with input `none`, then `result()` is
`{ done: true, goalMet: false }` with `score.goal` 0.

### 16.5 Draw list

```js
{
  stage: "swim",                                   // palette key (render/palette.js)
  camera: { x, y, span /* u across the short axis */, rot, orient, mmPerU },
  scale: { mm } | { you: "0.05 mm" },              // the bar's round length, or the subject's size in stages 1 and 2
  light: { level, warm, exposure /* 1..6 */, white /* 0..1 */, vignette, tint },
  warp: 0..1, caustics: 0..1,
  splats: [{ k: "c"|"s", x, y, r, x2, y2, m, n, v, hue }],          // ≤ 32 (k "s" = capsule from (x,y) to (x2,y2))
  points: { n, xy: Float32Array /* 2n */, a: Float32Array /* n */, hue } | null,   // ≤ 600 (render adds ≤ 900 motes)
  strips: [ { kind: "tails",    items: [{ x, y, ang, len, phase, hue }] }            // ≤ 25 items
          | { kind: "cilia",    a: [x, y], b: [x, y], count, phase, amp }
          | { kind: "tree",     nodes: Float32Array /* x, y, parent, width */, version, pulse }
          | { kind: "cord",     pts: [x, y, …] /* ≤ 16 points */, lights: [s0, …] /* 0..1 along it */ }
          | { kind: "chevrons", pts: [x, y, …], w, phase }
          | { kind: "ripples",  items: [{ x, y, r, a, dashed }] } ],                 // ≤ 6 strips
  marks: [{ kind: "pool"|"lake"|"pocket"|"glowwall"|"spot"|"glow"|"hand"|"arrow"|"light", x, y, r,
            rim: "solid"|"dotted"|"wavy", on, pulse, ang }],                         // ≤ 24
  rings: [{ id, kind: "mother"|"you"|"approach"|"hold"|"breath"|"wave"|"prompt"|"rest",
            x, y, r, progress, dashed, dotted, grade }],                             // ≤ 8, drawn in DOM SVG
  anchor: { x, y },                                // the subject (thumb-zone check)
  cue: { x, y } | null                             // the thing the player needs now (the brightness check)
}
```

`core/draw.js` exports `LIMITS` and `validate(list)`. `draw.test.mjs` validates every 30th view of each stage's ref and
idle runs. Both the WebGL path and the 2D fallback draw only this list. (A `zoomAnchor` comes back with the deferred
zoom.)

### 16.6 Events

Each event is `{ name, t, ...data }` pushed by `emit(state, name, data)`; `t` is in stage seconds.

| Name | Data | Host use |
|---|---|---|
| `moment` | `{ id }` | test hook, captions |
| `prompt` | `{ gesture, text }` | `input.setLive`, HUD prompt line |
| `subgoal` | `{ id, text, state: "shown"|"done"|"auto" }` | caption and confirm chime |
| `judge` | `{ target, grade: "in"|"close"|"off"|"miss", errMs, rawMs, heart }` | ring feedback, the Tap test |
| `points` | `{ part, add }` | HUD score tick |
| `fact` | `{ id }` | card, caption or overlay line; the "What was real" list |
| `caption` | `{ id, dir }` | captions |
| `sfx` | `{ id, at, pitch, gain }` | sound |
| `milestone` | `{ id: "ready"|"fertilized"|"implanted"|"heart"|"fetus"|"hearing"|"eyes"|"headDown"|"born"|"breath" }` | sound scene changes, tests |
| `song` | `{ notes, lit }` | sound (the hum) |
| `done` | `{}` | run |

### 16.7 Carry

`core/carry.js` exports `DEFAULT_CARRY = { sparks: 0, sperm: { hue: 0.11, side: 1, glow: 0.5 }, nestleX: 0, treeSeed:
null, song: { notes: DEFAULT_SONG, lit: 0 }, turnDir: 1 }`. `treeSeed: null` means "use the stage seed".
`mergeCarry(prev, out)` returns a new object; unknown fields are dropped.

### 16.8 Run sequencer (`core/run.js`)

```js
export function createRun({ seed, settings, save /* parsed */, start /* "new" | { practice: id } */ })
//   → run
run.step(intents)      // one DT of whatever is on screen; intents in core seconds, converted to stage time (16.3)
run.act(name, arg)     // "play" | "retry" | "goOn" | "next" | "linger" | "skip" | "pause" | "resume"
run.view()             // the current DrawList (stage or ending)
run.screen             // "title" | "stage" | "overlay" | "almost" | "card" | "ending" | "result"
run.stageStart         // core seconds at which the current stage started
run.beats(t0, t1)      // her beat times (core s) in the range, from the stage or from the run's own clock
run.events             // drained by the host each step
run.summary()          // { total, ms, stages: [{ id, score, grade, parts }], marks, sparks, facts: [ids] }
```

- **Time base.** `run.t` is core seconds. Each stage has `stageStartCore`. `run.step` subtracts it from every time in
  the intents before `stage.step`, and adds it back to event times it passes on.
- **Her beat clock.** Inside a stage, her beats are the stage's `state.beats.mother` plus `stageStartCore`. When a
  stage ends, the run keeps her beats going at the stage's last rate, with ±3% jitter, through the overlay, the Almost
  card and the card. Over the card it glides the rate to the next stage's `meta.motherBpm`. It
  creates the next stage with `opts.motherPhase = nextBeatCore − stageStartCore`. In the ending, her beats stop for the
  first 1.5 s (the one exception, 5.1).
- **One-button** (16.4) for every stage.
- **Seeds.** Stage seed = `fnv1a(runSeed + ":" + stageId) >>> 0`. "Try again" recreates the stage with the same seed
  and the same carry-in. Earlier stages' scores and carry are unchanged.
- **Go on** calls `swim.jump(state, "carried")` and plays its 3 s before the overlay.
- **Timers**: overlay 2.5 s (linger holds it); card skippable from 1.0 s, gone at 3.5 s; crossfade 0.8 s under the
  card.
- `run.ms` counts core time in stages, overlays and cards, not in pause or the ending.
- At each card the run emits the next stage's carry-in, which the host stores with `recordCarryIn` (for practice).

### 16.9 Test hook `window.__fb`

Every time the hook takes or returns is in stage seconds.

| Member | Does |
|---|---|
| `state()` | `{ screen, stage, stageId, moment, t, gaDay, label, fertilized, score, runScore, grade, prompt, subgoals, paused, seed, settings, anchor /* screen px */, cue /* screen px */, ms }` |
| `goto(stage, { seed, carry, assist, oneButton })` | jump into stage 1 to 8 (index or id) or `"ending"`, skipping the card |
| `jump(moment)` | jump to a named moment of the current stage |
| `realtime(on)` | stop or restart the rAF clock |
| `step(n, intents?)` | advance n fixed steps, with optional intents in stage seconds (else the held ones) |
| `input(partialIntents)` | set held intents (`steer`, `touching`, `dir`) |
| `tap({ errMs = 0 })`, `press()`, `release()` | inject a timed event at the next target's `t` ± errMs (stage time), or now |
| `nextTarget()` | `{ t, P, kind, heart, id }` or null |
| `bot(skill \| false)` | let the shared bot drive (also the attract mode) |
| `finish()` | end the current stage with its points so far |
| `retry()`, `skip()`, `act(name)` | the run's actions |
| `result()` | the current stage result, or the run summary |
| `targets()` | bounding boxes of every interactive DOM element, and the subject's and the cue's screen positions |
| `facts()` | fact ids shown this run |
| `perf` | `{ emaMs, p95Ms, scale, w, h, px, draws, splats, points, fallback }` |
| `sound` | `{ state, cutoffHz, hearing, beats: { mother, you }, scheduled, muted, voices, latencyS }` |
| `motion` | `{ reduced, warpAmp, bounce }` |
| `lum()` | mean frame luminance (needs `?probe=1`) |
| `save()` | the parsed save |

### 16.10 URL flags

`?seed=N` · `?stage=1..8|id|ending` · `?moment=name` · `?gl=0` · `?res=0.5` (pins the scale step) · `?freeze=1` (draw
one frame and stop, for screenshots) · `?test=1` (realtime off; steps only through the hook) · `?assist=1` · `?one=1` ·
`?rm=1` (reduced motion) · `?mute=1` · `?probe=1` (luminance probe and `gl.finish()` in the frame cost) ·
`?inset=t,r,b,l` (px, added to the safe-area insets) · `?carer=mother|mum|mom|parent`.

### 16.11 A stage played by a bot in node, with no DOM

```js
import * as swim from "../../public/first-breath/core/stages/swim.js";
import { DEFAULT_CARRY } from "../../public/first-breath/core/carry.js";
import { createBot } from "../../public/first-breath/core/bots.js";

const st = swim.create(7, DEFAULT_CARRY, { assist: false, oneButton: false, motherPhase: 0 });
const bot = createBot(0.7, 7);                      // σ = 15 + 135 (1 − skill) ms; skip = 0.4 (1 − skill); skill 0 = idle
while (!swim.result(st).done) {
  swim.step(st, bot.intents(swim, st));            // presses at target.t + gauss·σ (stage s); steer from swim.botSteer
  st.events.length = 0;
}
console.log(swim.result(st).score);
```

`qa/first-breath/bot.mjs <runs> <skill> <seed>` plays whole runs through `createRun` the same way and prints, per stage,
the time, total, grade, accuracy and goal. At a stage 1 cap the bot's `choose("almost")` picks Go on.

### 16.12 Ownership (who may edit what)

| Wave | Owner | Files |
|---|---|---|
| 0 | contract | everything in `core/` except the stage bodies; `core/stages/index.js` with 8 stub stages (each a timer that completes with `goalMet: true`, except the `swim` stub, which ends at its cap); `main.js`, **fully wired** to every module through the frozen signatures; no-op stubs of `render/renderer.js` (drawing with `debug.js`), `ui/hud.js`, `ui/captions.js`, `ui/screens.js` and `ui/sound.js`; `ui/input.js`; `ui/store.js`; `render/debug.js`, `render/camera.js`, `render/palette.js`; skeletons of `index.html` and `style.css`; the wave-0 tests |
| 1 | one agent per stage | `core/stages/<id>.js`, `<id>.tune.js`, `<id>.facts.js`, `<id>.text.js`, `qa/first-breath/stage-<id>.test.mjs`. Nothing else. |
| 1 | ending | `core/ending.js`, `qa/first-breath/ending.test.mjs` |
| 1 | renderer | `render/*` except camera and palette tokens; strips. It fills the `renderer.js` stub behind its signature. |
| 1 | ui and sound | `ui/hud.js`, `captions.js`, `screens.js`, `sound.js` (filling the stubs), `index.html` and `style.css` (on the skeletons) |
| 1 | arcade | `public/index.html`, `public/arcade/switch.js`, `public/arcade/key/first-breath.svg`, `qa/arcade/*` |
| 2 | QA and docs | e2e checks, bot gates, screenshots, README, AGENTS.md, `game-dates.json` |

`main.js` stays with the contract owner. A wave-1 agent who needs a change there asks the contract owner, who notes it
in tasks.md.

## 17. How each visual and performance requirement is checked

| Requirement | Check | File |
|---|---|---|
| Frame cost | SwiftShader (`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`), `?probe=1`, `?res=0.5` at 390 × 844 and 844 × 390, `?res=0.35` at 1440 × 900 (its base is already capped at 0.6 MP; `research/research-art.md` A0 measured 11.6 ms at 504 × 315), every stage via `goto`, after 3 s, over the next 120 frames: `perf.p95Ms ≤ 12` | `perf.e2e.mjs` |
| Adaptive scale | `?probe=1`, no `?res`, after 6 s: settled step ≥ 0.5 in portrait and landscape, ≥ 0.35 on desktop (per axis) | `perf.e2e.mjs` |
| Draw budget | `perf.draws ≤ 12`, `perf.splats ≤ 32`, `perf.points ≤ 1,500`; node: every 30th view validates against `LIMITS` (≤ 600 points from the stage) | `perf.e2e.mjs`, `draw.test.mjs` |
| Core CPU | node, each stage's ref run: p99 of `step` ≤ 1 ms; the full bot suite (20 seeds × 4 skills) ≤ 120 s wall time | `perf.test.mjs`, `sim.test.mjs` |
| 2D fallback | `?gl=0` in **every** stage: mean luminance > 0.04, the centre brighter than the 4 corners | `smoke.e2e.mjs` |
| Membrane look | `?seed=1&freeze=1&stage=3`: the pixel at a cell centre has a higher R / (G + B) than the background; the rim ring is the brightest band within 20 px of it | `visual.e2e.mjs` |
| Non-black stages | `?freeze=1` per stage: mean luminance > 0.04 | `visual.e2e.mjs` |
| The brightest cue | `?freeze=1` per stage, a page screenshot (DOM rings included): the luminance at `targets().cue` is at or above the frame's 95th percentile | `visual.e2e.mjs` |
| Light rises | frozen frames of stages 1 to 7 at 390 × 844: each mean luminance ≥ 0.9 × the one before, and stage 7 ≥ 2 × stage 1 | `visual.e2e.mjs` |
| Flash rule | `?probe=1`, `lum()` every frame for 5 s in stages 4, 5, 6 and 8: at most 3 swings of ≥ 10% in any 1 s window | `visual.e2e.mjs` |
| Birth light | luminance non-decreasing (1% tolerance) through the 3.5 s light and ≥ 0.95 at its end | `visual.e2e.mjs` |
| Ending warmth | a frozen ending frame: mean R > G > B; palette test: every chromatic ending token has a hue of 0° to 50° (achromatic tokens skipped) | `visual.e2e.mjs`, `palette.test.mjs` |
| Reduced motion | `?rm=1` (and emulated media): `motion.warpAmp ≤ 0.5 ×` the full value; `bounce = 0`; the stage change is the same 0.8 s crossfade | `visual.e2e.mjs` |
| Colour contrast | each cue token ≥ 3:1 against its stage bg and against `ink`, normal and protan, deutan and tritan (Machado 2009) | `palette.test.mjs` |
| Thumb reach | at 390 × 844, `targets().anchor.y ≤ 0.60 × 844` in every stage | `layout.e2e.mjs` |
| Layout | no horizontal scroll; HUD, prompt and captions inside the safe area with `?inset=47,0,34,0`; no overlap between HUD, prompt, captions and pause; captions inside 50 to 58% of the height in portrait; during play, no HUD, caption or overlay text below 60% of the height in portrait; the scale bar top left under the clock in portrait; every target ≥ 44 px on the shorter side; every screen fits | `layout.e2e.mjs` |
| Muted cues | sound muted with M, stages 2 and 6: every target has a DOM ring in `svg#rings` at least its preview time (max(2 beats, 1.2 s)) before its `t` | `input.e2e.mjs` |
| Sound | OfflineAudioContext, 6 s per scene: ≥ 90% of energy below 500 Hz before birth; > 20 dB more energy above 2 kHz after the opening than before; envelope peaks match the beat times within 5 ms; a second peak train from the stage 4 hinge; with `latencyS: 0.04`, each beat scheduled 40 ms early; across a card and a stage start, her peaks keep an even spacing with no extra or missing beat | `sound.e2e.mjs` |
| First 10 seconds | Play → `prompt` by 0.5 s and steering live by 0.5 s (stage 1); `goto(2)` → first target by 2.7 s | `smoke.e2e.mjs` |
| Screenshots | every stage at the three layouts; the homepage at 390 × 844, 320 × 568 and 1280 × 720 for the PR | `shots.mjs`; `qa/arcade/machines.mjs` part `firstbreath` with `SHOTS` |
| The homepage machine | at 390 × 844, 320 × 568 and 1280 × 720: the last cabinet in `#action` is First Breath, inside the window and not under the sign or the tray; `.slot`, `.start`, `#prevBtn`, `#nextBtn`, `.section-nav button` and `.all-games` ≥ 44 px on the shorter side; START goes to `/first-breath/`; the other groups' members unchanged | `qa/arcade/machines.mjs` part `firstbreath` |

## 18. QA files

| File | Asserts |
|---|---|
| `purity.test.mjs` | `core/` has no `document`, `window`, `Date`, `performance`, `Math.random`, `setTimeout`, `requestAnimationFrame`, `localStorage`; stage files import no other stage, nor `render/`, `ui/` or `main.js` |
| `clock.test.mjs` | the label and range check values (section 4); `week = floor((14 + N) / 7)` for N = 0..30; every label that starts with "Day" says "after fertilization"; "fetus" strings only from gaDay 70; cards at 98 and 196; no "cycle day" in any string; `gaAt` and `mmPerShortAxis` against the 4.1 table |
| `beat.test.mjs` | `clock.bpmYou`: 110 at 36 and 42, 170 at 63 and 70, 150 at 98, 140 at 140 to 196, 130 at 280; `makeBeats`: `first` places her first beat; jitter seeded and 0 in tracks |
| `judge.test.mjs` | windows at P = 0.5, 0.706, 0.833 s; Assist and the 0.4 P cap; free taps; Off changes nothing; a press 160 ms late that arrives a step late is Close, not a miss (the 50 ms grace); two targets 0.5 s apart judged on their own sub-step times; `median` |
| `track.test.mjs` | spacing ≥ 0.5 s; every target carries `P`; preview ≥ max(2 beats, 1.2 s); `errMs` and `rawMs` differ by the offset |
| `draw.test.mjs` | every view within `LIMITS` |
| `stage-<id>.test.mjs` | same seed and intents give the same result; the scripted ideal input reaches Glowing; idle ends by the cap (`swim` with `goalMet: false`, others `true`); one live gesture per moment; at most 2 families; every subgoal ends `done` or `auto`; meta.moments match the 4.1 table; stage-specific checks (other sperm never move and none sits past 2,800 u; pools turn red only from gaDay 84; no phrase before gaDay 133; the turn happens by itself at 30 s; the rest is not judged) |
| `ending.test.mjs` | the breath comes by itself 3.0 s after the prompt; no `points` event; results only after skin-to-skin; her beats are silent only in the first 1.5 s |
| `run.test.mjs` | the stage order; Try again recreates the stage at once and leaves earlier scores and carry unchanged; better attempt kept; Go on (`jump("carried")`) gives no Goal and no grade word; `goto` of every stage works with `DEFAULT_CARRY`; no overlay after Birth; a press at `stageStart + target.t` (core time) is graded In time; gaDay and `mmPerShortAxis` never decrease across a whole run (only a stage 1 retry restarts stage 1); her beats run on across overlays and cards with no gap and no jump; one-button sets steer and dir from `botSteer` in every stage; families per stage |
| `save.test.mjs` | broken JSON, old versions, blocked storage; best only improves; tie → faster; `carryIn` per stage; `cabinetLine` cases (BEST, plain) |
| `facts.test.mjs` | every fact has a gaDay, a computed label, allow-listed sources, access R or A; no S; `checked: false` facts are not shown; no text starts with "Week" or "Day"; spans never cross gaDay 42; size comparisons say "the NHS says" or "The NHS compares this to"; trimester cards say "about" |
| `text.test.mjs` | the banned words and pronouns (section 15.4) across all strings × all 4 carer words; sentence length; no "Apgar" outside `end.apgar` and Sources |
| `palette.test.mjs` | contrast rules; chromatic ending hues 0° to 50°; stage backgrounds rise in luminance from stage 1 to 7 |
| `perf.test.mjs` | p99 step ≤ 1 ms per stage |
| `sim.test.mjs` | 20 seeds × skills 1.0, 0.7, 0.5 and 0: skill 1.0 mean ≥ 8,500 per stage; skill 0.5 reaches the goal in ≥ 90% of runs; skill 0.7 runs take 8 to 12 min of game time; skill 0 never throws and every stage ends by its cap; under 120 s wall |
| `bot.mjs` | CLI report |
| `smoke.e2e.mjs` | no console errors; Play to prompt by 0.5 s; every stage via `goto` steps 120 frames and draws; `?gl=0` per stage; the bot reaches the run result |
| `layout.e2e.mjs` | section 17 layout rows at 390 × 844 and 844 × 390 (touch) and 1440 × 900; the thumb reach; the ending's thumb ring at bottom centre in portrait and in the corner of the last touch in landscape; a screenshot per stage and screen |
| `input.e2e.mjs` | touch stick steers in portrait and landscape; a second pointer is ignored; keys only on desktop; in a tap moment a press that drags is judged at touch-down; in a `dragHold` moment an arrow keydown is a press with its dir and Space alone is a plain hold; landscape touch in stages 4 (drag right grows forward), 5 (a move drag), 7 (the turn) and 8 (directions on screen axes); one-button mode clears stages 1, 4, 5, 7 and 8; hidden page pauses; M writes `arcade.sound`; muted rings |
| `perf.e2e.mjs`, `visual.e2e.mjs`, `sound.e2e.mjs` | section 17 |
| `qa/arcade/machines.mjs`, `groups.e2e.mjs`, `quiet.mjs` | the machine, the row of eight, the switcher, the cabinet line, the homepage part `firstbreath` (section 17), the hidden-page silence |

The PR states plainly which checks did not run: real phones, real touch latency, phone speakers, and the iPhone
silent switch.

## 19. Risks, the cut list and what is deferred

| Risk | Mitigation |
|---|---|
| A tone slip (harm, sex, blame, advice, health-score framing) | The tone rules, the banned-word and pronoun tests, an abstract baby with no face, no Apgar framing, no hazards tied to the mother, and a human read of every string before merge. |
| Wrong facts or mixed clocks | One label function; facts store gaDay; allow-listed sources; R or A only; WHO gated; the moment table (4.1). |
| Eight stages feel stitched (the Spore problem) | One camera scale, one look, one continuous heartbeat, carry-over (your sperm, the nestle spot, your song), a birth that remixes hold and drag. |
| Timing feels wrong on phones | The drawn beat is the truth; touch-down timestamps; output latency; the Tap test and the manual offset; wide Close windows; the 50 ms miss grace. |
| Frame time on phones and in SwiftShader | The measured two-pass stack, adaptive scale, the plain 2D fallback, hard budgets, perf checks per stage and layout. |
| Scope: 8 stages in one PR | v1 is each stage's minimum form plus one or two flourishes; the heavy extras are deferred (19.2). The frozen contract, a fully wired wave-0 `main.js` with stubs, per-stage files, one shared judge and bot, and the cut list. |

### 19.1 Cut list

Cut from the top when late. Each stage keeps its floor (section 6).

1. Attract mode behind the title.
2. Caustics (stages 6 and 7).
3. The hum in the stage 7 rest.
4. The stage 5 drag moves (the moves play by themselves).
5. The stage 8 direction prompts (plain hold waves).
6. Gold call beats in stage 2 (plain ride).
7. The Tap test (keep the manual offset).

**Never cut:** the carer-word setting, captions, one-button mode, reduced motion, the flash rule, the facts gate, the
ending, the per-stage 2D fallback check, and the arcade machine.

### 19.2 Deferred from v1

These are not built in this change, and the specs do not ask for them. Each can come back as its own change.

- Continue (a saved run that resumes at the last stage card).
- Density assist.
- Auto-drift of the timing offset (judge events keep `rawMs` for it).
- The log zoom with nested anchors between stages (v1 crossfades).
- A 2D fallback that matches the Warm Lantern look (v1 draws plain shapes).
- The formant voice and the formant cry (v1 hums sine tones).
- Haptics.
- "Play your song" on the run result.
- The FURTHEST cabinet line.
- Stage 6: repeats of a missed phrase, the loud-sound jump, the hiccup animation.
- Stage 1: the fork with the cool tube, and moving rivals (v1 shows still sperm resting on the walls).
