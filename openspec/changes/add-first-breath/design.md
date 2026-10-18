# First Breath: design

Id `first-breath`, route `/first-breath/`, change `add-first-breath`. This is the final, buildable design. It starts
from the winning "Arcade anthology" design (8 stages in the user's order, a score per stage, one camera, one heartbeat)
and grafts the best parts of "Phone-first heartbeat" (the first 10 seconds, real heart rates as the difficulty curve,
the fair timing judge, the first-heartbeat hinge, the lull before labour, the ending) and "One continuous journey"
(one gaDay clock, felt sound before ears, the egg as an active player, development that never fails). Section 1.2
records how each judge conflict was settled.

The user reviewed the plan and asked for two changes: stage 1 is "A race with other sperm", and stage 2 is "a switch
to the egg defending against the sperms invasion". The user kept the Action row. Sections 1.2, 6.1 and 6.2 record
the new stages. In the game the words stay gentle: the egg guards its shell.

This change builds the **v1 form** of each stage: its minimum form plus its best one or two flourishes (section 6).
Section 19.2 lists what is deferred. The research behind the design is in this change folder:
`research/research-biology.md`, `research/research-art.md` (written for the earlier WebGL look; its game and audio
sources still hold) and `research/paper-cut/` (the paper-cut reference art, its palettes and its measured
cost, sections 13 and 14).

After eleven art boards and a side-by-side of paper cut, watercolour wash and oil, the look changed from the plan's
WebGL "Warm Lantern" to **paper cut**, drawn with Canvas 2D (sections 1.2, 13 and 14).

Plain words and short sentences are the house style. The same rule applies to every string in the game.

## 0. Summary

- **What the player does.** You live a baby's nine months from the inside, in 8 short stages and an ending: race as
  one sperm cell in a pack, then switch to the egg and guard your shell until your own sperm comes in, split as the
  first cells, grow roots into the placenta while your body takes shape, grow with your new heart, answer your
  mother's voice, turn and practise breathing, ride the waves of birth, then take your first breath.
- **One verb at a time.** Each moment has one live gesture (drag, tap, hold, or drag-and-hold), and the prompt names it.
  Four feel families across the run: analog steer, beat tap, hold-release and rotate. No stage has more than two,
  except stage 2, which has three: a few beat taps in its short opening, then the arc (rotate) and the seal
  (hold-release).
- **One heartbeat.** Your mother's heart keeps time from Play to the end, also between stages. Your own heart joins on
  Day 22 after fertilization (week 5) at 110 bpm, peaks at about 170 bpm in weeks 9 to 10, and eases. The tempo is the
  difficulty curve. Her heart quickens in labour.
- **Nothing fails after fertilization.** Division, implantation, the placenta, the heartbeat, growth, turning, birth and
  the first breath all happen on schedule. Skill only changes the score. Only stage 1 can end in "Almost. Try again?".
- **A score worth chasing.** Every stage scores up to 10,000 points (Goal 3,000, Skill 6,000, Flourish 1,000) with the
  grades Good, Great and Glowing. A run total, a run time, a best per stage and a Stages menu for practice.
- **About 9 minutes** for a mid player. No stage runs past 2 minutes.

## 1. Our choices

The user gave no art direction, no controls preference and no arcade row at first. These choices are ours. After
reviewing the plan, the user chose the play of stages 1 and 2 and kept the Action row; those choices are the user's
(1.2). After the art boards, the paper-cut look was chosen over Warm Lantern, watercolour wash and oil; 1.2 records
what is known of that choice.

### 1.1 Choices table

| Topic | Our choice | Why |
|---|---|---|
| Title | **First Breath** | It names the ending that the whole run climbs to. |
| Subtitle (`<small>`, switcher `sub`) | **A baby's journey to birth** (marquee: A BABY'S JOURNEY TO BIRTH) | Short for the marquee. All Games search finds "baby" and "birth". |
| Tagline (title screen) | "Nine months. Eight small stages. One first breath." | |
| Cabinet attract line | **RACE · GUARD · GROW · BREATHE** | Four verbs from the run. 29 characters, within the 31 of "EXPLORE · DRIVE · SAVE THE PARK" on the same homepage. |
| Stages 1 and 2 (the user's choice after review) | **Stage 1, The Race**: one sperm in a pack of 20. **Stage 2, The Egg**: the view switches to the egg, which guards its shell with an arc until your own sperm comes in, then seals. | The user asked for "A race with other sperm" and for stage 2 as "a switch to the egg defending against the sperms invasion". See 1.2. |
| Row | **Action**, the last machine, after `ahead-of-the-light` | A real-time skill game with a score chase. Primordia, the other cell game, is in this row. |
| Art direction (chosen after the art boards, 1.2) | **Paper cut**: flat sheets of coloured paper stacked like a shadow box or tunnel book, each one flat colour with a fine grain, hand-cut edges, depth only from soft drop shadows (light from above and a little left), one marigold accent for "you", small cream tags for labels. The light still rises over the run, from dim violet-red sheets to a cream-white glow at birth and a warm cream room. Abstract baby figure in a few rounded pieces, with no face. Drawn with Canvas 2D (section 14). | It won the side-by-side against Warm Lantern, watercolour wash and oil. Flat cut shapes read as calm, made by hand and clearly not a picture of a real body, which suits the tone rules. No realistic fetus portraits: Nilsson-style images now read as political (`research/research-art.md` B7). Sources in 14.2. |
| Controls | One live gesture per moment: drag anywhere (relative stick), tap, hold, or drag-and-hold. Keys only on desktop. One-button mode in every stage. | One thumb on a phone in portrait. No guessing between tap, hold and drag. |
| The person carrying the baby | **"your mother"** by default. Settings offer **mother, mum, mom, parent**. No string uses a pronoun for this person. | See 1.3. |
| Week convention | **"Week N"** = N whole weeks since the first day of the last period (gestational age), as the NHS pages, midwives and doctors use. After fertilization, early stages show "Day N after fertilization (week M)". | One clock. See section 4. |
| Grades | **Good / Great / Glowing**, points out of 10,000 per stage | Rhythm Heaven style. Never Apgar: a real Apgar of 3 describes a baby in trouble. |
| Cabinet art | A hand-drawn SVG in cut paper, `public/arcade/key/first-breath.svg`, under 10 KB | The cabinet does not wait on the renderer. |
| Scope | **v1**: each stage's minimum form plus its best one or two flourishes | Eight stages in one pull request, built in parallel. Section 19.2 lists what waits. |

### 1.2 Judge conflicts and how we settled them

| Conflict | Decision | Why |
|---|---|---|
| Journey's egg-first scent trail vs the user's order (sperm first) | The user's order wins: stage 1 sperm, stage 2 egg. The trail first moved into stage 2 as gold call beats; after review, the guard below replaced it. | The user's order is a requirement. The idea (the egg is active) survives in the guard and the seal. |
| **User review:** stage 1 "It is not a race" (our earlier decision, after the myth table in `research/research-biology.md` 10) vs the user's "A race with other sperm" | **The user wins.** Stage 1 is a race against 19 moving rivals to the meeting place, with a top-3 goal, a fork, bumps and a place in the HUD. Every shown fact stays true: `swim.race` ("It is not a race.") is removed; no line says the fastest sperm wins; being ready (hyperactivation) is a real speed burst and is scored; `swim.frame` on the run result says that in life a sperm must be ready at the right time and place. | The user chose it after reading the plan. The race is game framing (section 2). |
| **User review:** stage 2 as the egg's call (gold beats and a trail) vs the user's "add section 2 as a switch to the egg defending against the sperms invasion" | **The user wins.** Stage 2 switches to the egg: a short ovulation opening, then the egg guards its shell with a glowing arc while sperm come from all sides, lets in only your own gold sperm, and seals its shell. The words stay gentle: "Guard your shell", "bounce", "Only one may enter", "Let it in". | The user asked for it. The guard is game framing; the seal is real (section 6.2). |
| **User review: art direction.** The plan's WebGL "Warm Lantern" vs eleven art boards, then a side-by-side the user asked for: "show me watercolor wash vs paper vs oil" (`research/paper-cut/compare-*.webp`) | **Paper cut** (sections 13 and 14), drawn with Canvas 2D. | The user's words: after the first boards, "I like paper cuf but I'd like to see a few more styles"; after the next ones, "paper cut is still the nicest but let's try something more abstract like oil paint or water color"; after the side-by-side, the user picked "Paper cut" from paper cut, watercolour wash, oil impasto and oil haze. |
| At most two feel families per stage vs stage 2's taps, arc and seal | Stage 2 has three: beat taps (the follicle, under 10 s), rotate (the arc) and hold-release (the seal). Each moment still has one live gesture, and the prompt names it. Every other stage keeps at most two. | The user's stage 2 needs all three; the opening is short. |
| The fork and moving rivals deferred (earlier v1 scope) vs the user's race | Both are in v1. The deferred list no longer holds them (19.2). | A race needs moving rivals. |
| The seal before fusion (the user's order of play) vs biology (the shell block follows fusion) | As your sperm enters, its membrane meets yours (Izumo1 meets Juno, `egg.fuse`). The seal then shows the block, and fusion shows the nuclei drawing close. Every caption keeps the real order. | Fidelity. |
| Pause on window `blur` (fun judge) vs not on blur (feasibility judge) | Pause on `visibilitychange` (hidden) and `pagehide`, on Esc or P, and on the pause button. Not on window `blur`. | On phones every app switch and lock fires `visibilitychange`. `blur` also fires on desktop when focus moves to devtools or another window while the page is still visible, and it makes headless runs flaky. |
| Fixed step 1/120 s (heartbeat) vs 1/60 s | 60 Hz fixed step. Input carries its own time stamp with sub-step precision. | Half the node cost, and the judge never quantizes to the step. |
| Score shape: points and grades, Ten Lights 0 to 2, or "APGAR" | Points out of 10,000 per stage, Good / Great / Glowing. Apgar appears only as a sourced fact after the ending. | Real spread for a score chase. No health-score framing. |
| Breath comes by itself after 6 s (heartbeat) or 10 s (journey) | It comes by itself 3 s after the prompt. | Fidelity must-fix: no wait with a newborn who is not breathing. |
| Stage 1 can end in "Almost" vs "no lose state, assist completes at the cap" | Stage 1 ends with "Almost. Try again?" when you reach the meeting place outside the top 3, or at its 117 s cap, with two buttons: Try again, and Go on (after the cap, the waves carry you on for 3 s; no goal points). With the wait at the meeting place or the 3 s carry, stage 1 never runs past 120 s. All other stages complete by themselves at their cap. | Fun judge allows a gentle retry only before fertilization. Feasibility wants a hard cap. Both hold. |
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
- The person is never shown in full, never an obstacle and never in pain. At the end the person is a plain warm paper
  oval with no face, no limbs and no head-and-shoulders outline (cut paper always has an edge, so the rule is about
  the shape, not the edge).

## 2. Tone rules (hard)

- Tender, wondrous and curious. Accurate, but never clinical or graphic.
- The journey starts inside the body, with cells. No intercourse, no innuendo, no sexual anatomy, no anatomy labels.
- No miscarriage, injury, distress or death, shown or implied. Nothing is killed.
- The race (stage 1) and the guard (stage 2) are game framing. Nobody is ever harmed: rivals bump, fall behind,
  bounce away, drift off and rest. A rival that is not let in rests, still, in the egg's soft cloud.
- In-game words are gentle: "race", "guard your shell", "bounce", "Only one may enter", "Let it in". Never kill,
  invade, invasion, attack, destroy, defeat, conquer, enemy, fight or battle (section 15.4). No string says the
  fastest sperm wins, and no stage 1 or 2 string says win, wins, won, or that one sperm beats the others.
- The mother's body is never an obstacle or an enemy. No hazards tied to the mother (no alcohol, smoke or illness).
  The race course is the path: stage 1 has no immune cells and no hazards, and the egg guards only its own shell.
- No medical advice. No viability or prematurity facts.
- The birth opening is drawn only as light. No blood, no people until the end, no sign of pain. In stage 8 the
  renderer's own frames are straight side flats with no closed aperture, so no ring of paper edges frames the light
  (13.1). No drop or drip shapes anywhere; the stage 5 pools are rose, never crimson.
- The newborn is never blue, dusky or limp. No anatomical lungs. The first breath comes by itself.
- Failure is gentle and immediate to retry, and only before fertilization.
- One banned-word list for every shown string (section 15.4).

## 3. The run

### 3.1 Stage table

`gaDay` is days since the first day of the last period (section 4). "Ref", "mid" and "idle" are stage times for the
reference bot (skill 1.0), a mid bot (skill 0.7) and no input (skill 0), measured: the means of 20 whole runs (run
seeds 1 to 20) played by `qa/first-breath/bot.mjs` through `core/run.js`, from each stage's start to its end. "Cap" is
the hard limit. Real scale is the real width of the short screen axis (section 5.6).

| # | Id | Stage (the user's phase) | Verb | Live gestures (families) | gaDay | Real scale | Ref | Mid | Idle | Cap |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `swim` | The Race (the sperm) | Race | drag (steer) | 14 | 0.3 mm (not to scale) | 51 s | 65 s | 120 s ("Almost" at 117 s, then Go on) | 117 s (+3 s after Go on) |
| 2 | `egg` | The Egg (ovulation and fertilization) | Guard | tap, drag, hold (beat tap, rotate, hold-release) | 14 | 0.4 mm (not to scale) | 52 s | 52 s | 62 s | 80 s |
| 3 | `split` | The Embryo: first cells | Split | tap, hold (beat tap, hold-release) | 15 to 20 | 0.45 mm | 34 s | 34 s | 34 s | 50 s |
| 4 | `root` | The Placenta (and the growing embryo) | Root | drag, tap (steer, beat tap) | 20 to 49 | 0.6 to 30 mm | 35 s | 36 s | 66 s | 75 s |
| 5 | `grow` | First Trimester | Grow | tap, drag (beat tap, steer) | 49 to 97 | 30 to 150 mm | 54 s | 58 s | 63 s | 90 s |
| 6 | `answer` | Second Trimester | Answer | tap (beat tap) | 98 to 195 | 150 to 600 mm | 64 s | 64 s | 64 s | 80 s |
| 7 | `turn` | Third Trimester | Turn | hold, drag (hold-release, rotate) | 196 to 280 | 600 to 700 mm | 58 s | 58 s | 80 s | 100 s |
| 8 | `birth` | Birth | Ride | hold, drag-and-hold (hold-release) | 280 | 700 mm | 70.5 s | 70.5 s | 70.5 s | 80 s |
| – | `ending` | First breath and skin-to-skin (not scored) | Breathe | hold (optional) | 280 | 2 m | 33 s | 33 s | 33 s | 40 s |

Stage 3 takes the same time for every input; its length moves by less than one beat with her beat phase (section
5.1). Stage 1 times are stage times: the arrival at the meeting place plus its 2.5 s wait (ref arrives at about 49 s,
mid at about 62 s, 6.1); idle reaches the 117 s cap, the Almost card, and with Go on the carried 3 s. Stage 2 times
use the place each bot gets in stage 1: ref 1st, mid 3rd (every one of the 20 runs in the top 3), idle 20th. Your
sperm comes 0.3 s later for each place lower, up to 5.7 s later after 20th. Nudging it with the arc adds up to about
3.2 s, and the seal up to about 2.5 s. In stage 1, "mid" is the skill 0.7 bot, which finishes in the top 3 (6.1).
Stage 4 is shorter than first planned (45 / 54 s) because a bot that steers links all 8 pools and reaches the heart
hinge about 16 s into the stage; stage 5 because its phrases are fixed in beats and every bot that drags ends its moves early (6.5's "+3 s"
has no moment); and stage 7 at mid because the skill 0.7 bot turns head-down in about 10 s.

Run time, measured the same way (the bot skips each card at 1.0 s, as a player may; a card left alone adds 2.5 s
each): stages (ref about 418 s, mid about 438 s, idle about 559 s), plus 7 stage-end overlays (2.5 s each; none
after Birth), 7 stage cards (1.0 to 3.5 s), and the ending (33 s). `run.ms` (Play to the end of Birth): ref 7 min
22 s, mid 7 min 42 s, idle 9 min 44 s. Game time (Play to the run result, the ending included): ref 7.9 min, mid
8.25 min (8.16 to 8.35 over 20 seeds), skill 0.5 8.55 min, idle 10.3 min. The skill 0.7 bot gate is 8 to 12 minutes
of game time, every run (`sim.test.mjs`); the mid run clears it by about 10 s, so a stage that gets shorter needs
this gate rechecked.

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
| 1 | free (her 72 bpm in the background) | steering in a pack: waves, the gate, the fork, a current, soft bumps; when to rest |
| 2 | her 72 bpm: a gold surge, then a few follicle taps | first taps; then turning the arc to more sperm from more sides as the waves build; one hold-release |
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
| `swim` | `womb`, `gate`, `fork`, `tube`, `meet`, `carried` | 14 → 14 | – | Week 2 |
| `egg` | `surge`, `open`, `sweep`, `guard`, `enter`, `seal`, `fusion`, `outro` | 14 → 14 | – | Week 2; fertilized turns true at the end of `fusion` |
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
  - **A hold needs a fresh press.** When the live gesture becomes `hold` (or `dragHold`), a pointer, key or one-button
    press that is already down does not start a hold, and its release is dropped. The next touch-down or keydown is
    the press. So a thumb still down from the stage 2 guard drag cannot seal the shell by lifting.
- **Floating stick**: origin at touch-down, anywhere on the screen. Dead zone 8 px. Full deflection at 56 px. Past
  80 px the origin trails the finger. Magnitude `m = clamp((d − 8) / 48, 0, 1)`. The stick ring is drawn at the
  origin while touching.
- **Desktop keys**: arrows or WASD steer (8-way, smoothed over 0.12 s). Space, Enter or Z is a press on keydown and a
  release on keyup. In a `dragHold` moment, an arrow or WASD keydown emits a press with its `dir`, and its keyup emits
  the release. Space alone is a press with `dir` null, which counts as a plain hold. Key repeats are ignored. Esc or P
  pauses, M mutes, C toggles captions, Tab and Enter move through menus. The mouse is optional: the left button acts as
  the pointer.
- **Turn and aim** (used only by the stage 2 arc): the left and right arrows, or A and D, also set `turn` (−1 turns
  anticlockwise as seen, +1 clockwise). In a moment whose prompt has `keys: "turn"` (the guard), the arrows and WASD
  set only `turn`: W, S and the up and down arrows do nothing, and keys never set `steer`; only a pointer drag sets
  `steer`. A mouse over the page with no button down sets `aim`, its world point, but only after it has moved more
  than 4 px; any steer or turn key clears `aim`, and it stays null until the mouse moves more than 4 px again. So a
  cursor left resting over the page after clicking Play never pulls the arc back. Touch and pen never set `aim`.
  World angles are in radians, counterclockwise from world +x, as in a y-up plane. The camera maps world to screen
  by rotation and scale only, never a mirror, so a clockwise turn on screen is a clockwise turn in the world in every
  layout, and `turn` +1 decreases the world angle.
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
| `sperm` | `swim` | `egg` | `{ hue: 0.11, place: 3, glow: 0.5 }` | your sperm's tint (gold); your place in the race, 1 to 20, which sets when it comes to the egg; how bright it is (1 if it became ready, else 0.5) |
| `nestleX` | `root` | `grow`, `answer`, `turn` | 0 | where on the wall you nestled (−1..1); the placenta grows there |
| `treeSeed` | `root` | `grow`, `answer`, `turn` | stage seed | the placenta disc texture echoes your root tree |
| `song` | `answer` | `turn`, `ending` | `{ notes: DEFAULT_SONG, lit: 0 }` | 16 MIDI notes of your song, and which you answered |
| `turnDir` | `birth` | `birth` (Turn back) | 1 | which way you turned on the Turn wave |

`DEFAULT_SONG` is a fixed 16-note pentatonic lullaby in `core/carry.js`.

### 5.6 Camera and the scale bar

- Each stage declares `orient`:
  - `long` (stages 1 to 4): world forward (+y) maps to the long screen axis: up in portrait, right in landscape and
    desktop (a −90° rotation, so world +x is screen down there). In portrait the subject sits at 45% of the height
    from the top, so it sees ahead and stays above the thumb zone. In phone landscape it sits at 38% of the width from
    the left and 55% of the height from the top, below the top HUD and the prompt line. On desktop it sits at 40% of
    the width and half the height.
  - `fit` (stages 5 to 8 and the ending): world up is screen up ("head-down" stays down). The world fits the short
    axis. The subject sits at 42% of the height in portrait.
- World unit `u`: the short screen axis is 100 u at camera span 100.
- Each view gives `camera.mmPerU`. The scale bar picks a round value (0.1 mm, 1 mm, 1 cm, 10 cm, 1 m), and the real
  span of the short axis never shrinks over the run (`mmPerShortAxis`, section 4).
- **Stages 1 and 2 are not drawn to scale**: the womb and the tube would be centimetres wide. There the bar shows only
  the subject's own size: "You: about 0.05 mm" (the sperm cell) and "You: about 0.1 mm" (the egg). Sizes are fixed in
  u. In stage 1 every sperm is 22 u long with a head of radius 3 u (13 to 15% of the short axis at the stage's span of
  170 u in the womb and 150 u from the gate on, 6.1). In stage 2 the egg cell is 18 u across and each sperm is 10 u
  long with a head of radius 1.5 u, so the egg is about two sperm lengths, as `egg.size` says. The stage 2 camera
  span is 140 u, so the egg, its arc, every stuck sperm and your incoming gold sperm fit the free part of the screen
  in all three layouts (section 9).
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

### 6.1 Stage 1, The Race (`swim`): "Drag to swim."

The user asked for "A race with other sperm". The race is game framing (section 2): nobody is harmed, and every
shown fact stays true.

- **Sees.** You are one sperm cell in a pack of 20: you and 19 rivals, who stand for many more. You are a gold head
  with a soft tail, 22 u long like every sperm, and the brightest sperm, on a cream card. You start in a wide, warm,
  soft space (the womb, never named on screen) where slow waves of light roll forward. It narrows to a gate, then
  splits in two: one tube glows warm (the egg's side), the other is cool and dim and curls back. In the warm tube a
  gentle current flows toward you, a warm lane shimmers, and three walls glow. Far ahead, a soft warm band marks the
  meeting place, where sperm wait for the egg. The HUD shows your place ("3rd of 20").
- **Camera.** Span 170 u in the womb, easing to 150 u between 1,100 and 1,250 u, then 150 u to the finish. It follows
  your progress along the course, and follows you sideways with a 0.4 s ease. At 150 u both branch mouths are on
  screen, under no HUD or prompt, at least 1.5 s before your head reaches the split in all three layouts: portrait
  sees about 98 u ahead below the prompt line (at about 56 u/s there, 1.75 s), landscape about 200 u, desktop about
  144 u (section 17 checks it).
- **Moments.**
  1. `womb` (0 to 1,100 u): ride the waves forward. Prompt "Drag to swim." at 0.3 s; steering live at 0.5 s; the
     pack starts at once; the first wave reaches the back row by 2 s. At 1.0 s: "Race to the meeting place. Get there
     in the first three." (`swim.goal`, a sub-goal line; the goal itself is scored, section 7).
  2. `gate` (1,100 to 1,300 u): the space narrows to a 40 u gate, and the pack squeezes and jostles.
  3. `fork` (1,300 to 1,400 u, and all the time inside the cool loop): two tubes. Sub-goal "Take the warm way." The
     cool tube loops back to the fork: "This way is cool. It leads back." Back at the fork: "The warm way is the egg's
     side."
  4. `tube` (1,400 to 4,600 u): swim against the current, follow the warm lane, and rest on a glow wall to become
     ready. Sub-goal "Rest on a glow to get ready." at the first glow wall.
  5. `meet` (from crossing 4,600 u; 2.5 s, live gesture `none`): your place is fixed as your head crosses the band.
     You glide to the wall: "Wait here. The egg is coming." If you are not yet ready, you rest there and get ready
     ("You rest here and get ready.", the `ready` sub-goal `auto`). In the top 3, the stage ends with its overlay;
     otherwise the run shows the Almost card.
  6. `carried` (only after Go on at the cap; 3 s, live gesture `none`): the waves carry you to the meeting place.
     After a finish outside the top 3 you are already there, so Go on goes straight to the overlay.
- **Tuning** (`swim.tune.js`). Units are u; the short screen axis is 100 u at span 100. "Progress" is the distance
  along the course's centre line. Every rule is the same for you and for every rival.

  | Name | Value |
  |---|---|
  | Racers | you and 19 rivals (20). Start grid: 5 rows of 4, rows 12 u apart, 30 u across, from 0 to 48 u; you in row 3. Everyone starts at 0.5 s. |
  | Swim | own speed target = 55 u/s × m, where m is the stick magnitude (0 to 1, section 5.3); accel 120 u/s² up to the target; above the target the speed eases down with drag 1.8 /s; turn 3.0 rad/s. "Ready" multiplies only this stick term (×1.6), never the bonuses below. |
  | Womb | 160 u wide to 1,100 u; no current |
  | Waves | wave k (k = 0, 1, 2, …) starts at t = 1.2 + 3.2 k s at −20 u, is 60 u thick, and moves forward at 140 u/s inside a lateral window 80 u wide. `stream(seed, "wave:" + k)` gives, in order, its threshold (0 to 1) and its window centre (within ±40 u); every sperm uses the same two values. A wave lifts a sperm that swims with it (stick ≥ 0.3, heading within 45° of forward, head inside the band and the window): its own speed blends to 140 u/s over 0.3 s and stays there while it stays inside. Waves fade out at 1,100 u, so an idle sperm is never carried. A wave that lifts you at about 2 s carries you to 1,100 u by about 9.4 s; each wave you miss costs about 3.2 s. |
  | Gate | narrows from 160 u to 40 u between 1,100 and 1,250 u; 40 u wide to 1,300 u, where it opens into the fork |
  | Fork | from 1,300 u it widens to hold two mouths side by side, each 60 u wide; it splits at 1,330 u; the warm side (left or right) is seeded |
  | Cool loop | the cool tube narrows to 40 u, curls round on its own side in three quarters of a circle of radius 30 u (its centre line), and rejoins the path from that side at 1,300 u, where the gate opens into the fork: 160 u in all. A 40 u/s flow along it carries any sperm round, also with no input: back at the fork after 4.0 s idle, about 1.7 s at full stick. It has no current against you, no lane and no upstream bonus. A sperm in the loop counts as at 1,300 u for the place, and its moment stays `fork`. A trip round costs about 2 to 4 s. |
  | Tube | 60 u wide, from 1,400 to 4,600 u; current toward you 22 u/s × (0.3 + 0.7 (1 − r²)), r = distance from the centre / half-width: 22 u/s at the centre, 9.5 u/s at r = 0.9 |
  | Upstream (tube only) | heading within 25° of forward: +18 u/s |
  | Warm lane (tube only) | 30 u wide; its centre drifts ±12 u at 0.1 Hz; inside: +12 u/s, and the current is halved. At full stick that is about 75 u/s in the lane (55 + 18 + 12 − about 10) against about 63 u/s hugging a wall (55 + 18 − 9.5), so the lane is clearly faster. |
  | Walls | contact keeps 0.9 of your speed along the wall |
  | Glow walls | at 1,700, 2,600 and 3,500 u, alternating sides; each a glow of radius 20 u centred on the wall. **Attach:** a sperm whose head is inside a glow with stick < 0.25 attaches to the wall: its velocity is 0 and the current no longer moves it (sperm do bind the tube wall). It counts her beats while attached and becomes ready on the 4th (2.5 to 3.3 s at 72 bpm): "Now you are ready.", and ×1.6 on its stick term to the finish (hyperactivated). Stick ≥ 0.25 detaches it. A rest costs about 4 s in all (the turn to the wall, the beats, the speed-up). At full stick in the lane, resting gains about 8 s by the finish at the first wall, about 4 s at the second and about 0.5 s at the third: a real trade. Passing one unrested: "Rest at the next glow." |
  | Checkpoints | 1,400, 2,200, 3,000 and 3,800 u. The current never pushes a sperm behind the last one it passed: a sperm that drifts back there with stick < 0.25 attaches to the wall by the same rule, glowing, until it swims again. No fade. |
  | Bumps | heads are circles of radius 3 u. A sperm is swimming when its stick is ≥ 0.25 or its speed is ≥ 15 u/s; an attached sperm never is. Two swimming sperm that overlap are pushed apart along the line between them, every step. Each also keeps 0.7 of its speed, and its top speed eases back from ×0.8 to ×1 over 0.6 s; this speed loss happens at most once per sperm per 0.4 s, while the push apart is never skipped. Sperm that are not swimming are passed over, never bumped. |
  | Rival skill | 19 skills, seeded onto the start grid (`stream(seed, "grid")`): two front-runners 0.80 and 0.76; a middle pack 0.42, 0.39, 0.36, 0.33, 0.30 and 0.27; a tail 0.24, 0.22, 0.20, 0.18, 0.16, 0.14, 0.12, 0.10, 0.08, 0.06 and 0.04 |
  | Rival policy | the same steering function as `botSteer` (below) at the rival's skill, with its own stream `rival:<i>` and its own `mem` in the state. Three rival choices replace the bot's: the cool tube with chance 0.5 × (1 − skill); a rest at the first glow wall for the two front-runners only (only they become ready; no other rival rests on a glow); and a rival in the tube that is 500 u or more behind you by progress slows over 2 s, attaches to the nearest wall and rests there for the rest of the stage, glowing softly, never ready. A resting rival still counts in the place, behind you. |
  | Catch-up (mild, never shown) | a rival g u ahead of you by progress multiplies its stick term by 1 − 0.10 × clamp(g / 400, 0, 1); a rival behind you that still swims, by 1 + 0.06 × clamp(−g / 400, 0, 1), never above full stick. It never changes the waves, the current, the bonuses, the bumps or the walls. |
  | Place | 1 + the number of sperm with more progress; sperm that arrived rank by arrival time, ahead of all others. `state.placeNow` holds this value every step. The shown place (`state.place`, the `place` event, the HUD and `probe`) changes only after a new value has held for 0.25 s, so jostling never spams plucks. |
  | Finish | the meeting place, a soft band across the tube at 4,600 u; the times below are arrival times there |
  | Cap | 117 s. With the 2.5 s `meet` or the 3 s `carried`, the stage never runs past 120 s. |

- **Expected times.** Hand estimates from the numbers above, with the first wave caught, no bumps and no catch-up.
  The wave-0 race sim (`qa/first-breath/race-sim.mjs`) measures them with bumps and the gate squeeze, and
  `stage-swim.test.mjs` gates the built stage (section 18).

  | Sperm | Skill (m) | Tube speed, unready / ready | Rest | Arrival |
  |---|---|---|---|---|
  | You, ref bot | 1.0 (1.00) | 74.6 / 107.6 u/s | wall 1 | about 49 s, 1st |
  | You, mid bot | 0.7 (0.82) | 64.0 / 90.8 u/s | wall 2 | about 60 s; 3.2 s later when it misses the first wave (21% of seeds); mean about 61 s; 3rd, sometimes 2nd |
  | You, idle | 0 | – | – | never moves and never passes the gate; 20th at the cap |
  | Front-runners | 0.80, 0.76 (0.88, 0.86) | about 68 / 96 u/s | wall 1 | about 53 and 54 s; about 52 s just behind a ref player, about 55 s ahead of a mid player |
  | Middle pack | 0.42 to 0.27 (0.65 to 0.56) | about 50 to 40 u/s | none | about 81 to 97 s if still swimming; most fall 500 u behind a mid or ref player and rest |
  | Tail | 0.24 to 0.04 (0.54 to 0.42) | about 39 to 27 u/s | none | from about 101 s, or resting |

  So the ref leads the nearest front-runner by about 3 to 4 s, and the mid bot leads the best of the middle pack by
  about 18 s. The race sim must show the ref 1st and the mid bot in the top 3 in at least 18 of 20 seeds before these
  numbers are frozen (task 1.13). If a gate misses, tune in this order and record the result in these tables: the tube
  length (±300 u), the wave gap (2.8 to 3.6 s), the rival skill ladder.
- **Score.** Goal 3,000 if you cross the meeting place in the top 3 before the cap. Skill: 2,500 × (20 − place) / 19
  (1st 2,500, 3rd 2,237); 1,500 × min(1, seconds riding waves / 5); 1,000 × the share of your swimming tube time
  inside the warm lane (time attached to a wall is left out); 1,000 if you became ready on a glow wall. Flourish:
  1,000 for 1st place. Top speed is never scored on its own.
- **Misses and the cap.** A bump only slows you for a moment. The cool loop only costs time. If you cross outside the
  top 3, or the 117 s cap comes first, `result()` is `{ done: true, goalMet: false }` and every open sub-goal ends
  `auto`. The run shows the soft card: "Almost. Try again?", your place ("You came 5th of 20." after a finish, "You
  were 5th of 20." at the cap) and "Your run and points are kept." Buttons: **Try again** (focused; recreates this
  stage at once with the same seed, so the rivals race the same way) and **Go on** ("The waves carry you on."). After
  the cap, Go on calls `swim.jump(state, "carried")` for a 3 s carry; after a finish it goes straight on. Either way
  `result()` is `{ done: true, goalMet: false }` with Goal 0, Skill and Flourish kept, and no grade word. At the cap
  your place is your place by progress at that moment.
- **One-button.** Hold to swim: `botSteer` at skill 1.0 rides the waves, takes the warm tube, follows the warm lane
  and rests on the first glow wall until ready. It finishes in the top 3 (usually 1st). Release to coast.
- **Assist.** Current ×0.7; warm lane ×1.5 wide; your bumps keep 0.85 of your speed (top speed ×0.9); rivals ahead
  of you ease by up to 20%, and rivals behind you get no push.
- **Carry out.** `sperm = { hue, place, glow }`: your gold tint, your place (at the finish, or by progress at the cap),
  and 1 if you became ready, else 0.5.
- **Facts.** Card: none (Play starts the stage at once); `swim.half` is the first caption. Captions `swim.waves`
  (womb), `swim.few` (gate), `swim.side` (fork), `swim.warm` (warm tube), `swim.flow` (tube), `swim.walls` (first wall
  contact), `swim.rest` (first glow wall), `swim.ready` and `swim.hyper` (on your ready; at most 3 of the 20 sperm are
  ever ready, you and the two front-runners, so the scene agrees with `swim.ready`). When the first rival rests far
  behind: "Some sperm rest on the walls." Overlay `swim.wait`, also after Go on. Run result: `swim.frame`. In
  portrait, stage 1 captions are one line and show for 2.5 s, so the band at 50 to 58% covers your tail and the pack
  just behind you only briefly.
- **Look and sound.** Plum wall sheets over a rose floor, a tunnel book (colour script row 1,
  `research/paper-cut/scenes/paper-race.js`). Rivals mauve `#967088`, each cut from one strip, with tails that beat by
  their own speed. You marigold `#ffc53d` on a cream card with an ink keyline, on the highest sheet with the deepest
  shadow: the brightest sperm. The course is drawn as `course` strips (tube sheets baked into world tiles, 14.1) and
  the waves as `band` marks (16.5): crescents of paler rose that slide forward. The warm tube coral `#e8834f`, its lane
  amber `#f6ab48` with cream chevrons; the cool tube dim lilac `#4e3a5e` with no chevrons. Glow walls are paper glows
  on the wall; the meeting place a pale rose band `#f3c9d6`. A bump shows a small cut ring at the contact. Sounds, all through the womb bus (section 11): a soft
  swish on turns; a low "whoom" when a wave lifts you; a soft low bump; a faint rising pluck when you gain a place; a
  warm two-note chime on "ready"; a soft settling swell at the meeting place.
- **Bot steering** (`botSteer(state, skill, r)`, also the rivals' policy). In the womb, ride the nearest wave window:
  wave k is ridden when its shared threshold < 0.3 + 0.7 × skill. At the fork, take the warm tube. In the tube, steer
  to the lane centre (aim error σ = 15 u × (1 − skill)) while heading upstream. Rest on the first glow wall if skill ≥
  0.75, else the second if skill ≥ 0.4, else none: steer the head to the glow's centre, let go (stick 0) once within
  10 u of it, so it attaches, and swim on after the 4th beat. Steer round a sperm within 12 u ahead (Reynolds
  separation). Stick magnitude m = 0.4 + 0.6 × skill; heading noise σ = 30° × (1 − skill), new every 0.5 s; a
  150 ms × (1 − skill) lag. The noise and the lag need memory: `botSteer` keeps it only in `r.mem`, a plain object
  that each caller attaches to its own stream (`r.mem = {}`). So the bot, the one-button rule and each rival keep
  their own, and the same inputs always give the same state.
- **v1 builds.** The whole course (the womb with waves, the gate, the fork with the cool loop, the tube with its
  current, warm lane, upstream bonus and glow walls with "ready"), 19 moving rivals with their skill spread, soft
  bumps with their contact rings, mild catch-up and resting, the place in the HUD, the meeting place, the Almost card
  and Go on. The fork and the moving rivals, deferred before, are in v1 for the user's race.
- **Floor.** The course with the fork, moving rivals with bumps and contact rings, the place and the Almost card.

### 6.2 Stage 2, The Egg (`egg`): "Guard your shell."

The user asked for stage 2 as "a switch to the egg defending against the sperms invasion". The view switches: now
you are the egg. The stage card leads with "Now you are the egg."; with no card (practice or `goto`), that line is the
first caption.

- **Sees.** You are the egg in a glowing follicle, inside a soft cloud of small cells (the corona). A gold surge washes
  over you. The follicle bursts, and fringed fimbriae sweep you into the tube, where cilia beat. Then sperm come from
  all sides toward your clear shell. A glowing arc follows your drag round the shell. Sperm that meet the arc bounce
  away. Your own sperm from stage 1 comes in gold, with a dashed ring.
- **Moments** (her 72 bpm, P = 0.833 s, no jitter; beat 1 is her first beat at or after 0.2 s, so between 0.2 and
  1.03 s). The opening (`surge`, `open`, `sweep`) ends by 8.9 s for every input.
  1. `surge` (beats 1 and 2, live gesture `none`): a gold wave, the LH surge of the card's fact `egg.surge`, washes
     over the follicle.
  2. `open` (beats 3 to 8, up to 6 targets, live gesture `tap`): "Tap with the heartbeat." The follicle swells with
     each beat. The 3rd tap graded Close or better bursts it; otherwise it bursts by itself on beat 8 ("It opens
     anyway."). Once it bursts, the rest of the open beats carry no targets.
  3. `sweep` (2.0 s, live gesture `none`): the fimbriae catch you and sweep you into the tube; the cilia beat.
  4. `guard` (about 34 to 40 s, live gesture `drag` with keys `turn`, 5.3): "Drag to guard your shell." Caption
     "Guard your shell. Only one may enter." Waves of sperm swim in from all sides. Each swimming one that the arc is
     over bounces away and drifts off. One that reaches an open part of the shell sticks and starts to burrow, with a
     small dotted progress ring; the arc over a stuck sperm pops it loose, and it drifts off. A rival that finishes
     burrowing never gets in: it moves out to the cloud and is held there, still, and rests. Your gold sperm comes in
     at a seeded angle, earlier if you placed higher: "Let it in." The arc over it only nudges it back, and it always
     returns. It burrows and enters.
  5. `enter` (1.2 s, live gesture `none`): your sperm passes the shell, and two small lights fit where it meets your
     membrane: Izumo1 meets Juno (`egg.fuse`).
  6. `seal` (up to her 6th counted beat, live gesture `hold`): "Seal your shell. Hold, then let go." Only a press made
     after this prompt counts: a thumb or a button still down from the guard must lift and press again (5.3). A ring
     grows while you hold; the glow comes on the target beat. The release sends a shimmering wave round the shell
     from where your sperm entered, both ways, until it meets on the far side. The shell hardens, and every other
     sperm, held or swimming, drifts off. With no release by her 6th counted beat, or a hold still down then, it seals
     by itself ("Your shell seals itself.").
  7. `fusion` (5 s, live gesture `none`): the egg takes your sperm's contents inside (0 to 1.5 s); it finishes its
     last division, and a tiny bead buds at its rim (1.5 to 2.5 s); the two nuclei draw close and touch but stay apart
     (2.5 to 5.0 s). When they touch, at the end of fusion, the clock turns to "Day 0 after fertilization (week 2)".
  8. `outro` (2 s).
- **Tuning** (`egg.tune.js`).

  | Name | Value |
  |---|---|
  | Opening | surge on beats 1 and 2; open targets on beats 3 to 8; it bursts on the 3rd tap graded Close or better, else on beat 8; sweep 2.0 s. It ends between about 6.0 s (three good taps) and 8.9 s (none). |
  | Camera | span 140 u across the short axis; the egg at the layout's subject point (5.6, 9) |
  | Sizes | egg cell radius 9 u (18 u across); shell (the zona) radius 11 u; the corona cloud from 11 to 20 u (220 points); every sperm 10 u long, head radius 1.5 u |
  | Angles | radians in world space, counterclockwise from world +x; `turn` +1 (clockwise as seen) decreases the angle (5.3). The `arc` strip's `a0` and `a1` use the same units. |
  | Arc | radius 16 u, drawn 3 u wide; half-width 35° (70° in all). It starts at a seeded angle. It turns toward its target at up to 720°/s: the stick angle on touch (a stick under 0.25 deflection leaves it still), or the mouse `aim` on desktop (set only after the mouse moves more than 4 px, 5.3). The `turn` keys turn it at 540°/s. It takes `turn`, then `aim`, then `steer` (16.3). Lifting the finger leaves it where it is. |
  | The arc over a sperm | the arc is over a sperm when the angle between the arc's centre and the sperm's head is at most the half-width and the head is within 22 u of the egg's centre. It is checked every step, both when a sperm swims under the arc and when the arc sweeps onto a sperm. What happens depends on the sperm's state: a swimming rival bounces; a stuck rival pops loose; your gold sperm is nudged; held and drifting sperm ignore the arc. |
  | Waves | 8 waves, at 2, 8, 14, 20, 26, 32, 38 and 44 s into `guard`, only while your sperm has not yet entered; counts 3, 4, 5, 6, 6, 7, 8, 8; inward speeds 9, 10, 11, 12, 13, 14, 15, 15 u/s. Wave 1 comes from one 90° sector; wave 2 from two opposite 60° sectors; waves 3 to 8 from all round, at least 25° apart within a wave, with ±10° jitter. Arrivals in a wave are 0.3 s apart. They fade in on a ring at 75 u over 0.5 s and swim straight in with a slight wiggle. |
  | Bounce | a swimming rival the arc is over turns outward at 14 u/s, with up to ±20° of spread, and drifts off; it is removed past 80 u |
  | Stick | a swimming rival that reaches the shell (head at 11.5 u) while the arc is not over it sticks there, head in, and burrows for 4.0 s with a dotted progress ring. The arc over it pops it loose: it drifts off at 10 u/s. |
  | Held | a rival that finishes burrowing moves out to the cloud at 18 u over 0.6 s and is held there, still, drawn as a dim point. It never enters. At the seal it drifts off with the rest. |
  | Your gold sperm | comes in at 27 + 0.3 × (place − 1) s into `guard` (27.0 s after 1st, 27.6 s after 3rd, 32.7 s after 20th), with a `goldIn` event. **Its angle:** of 72 candidates, one every 5°, in a seeded order (`stream(seed, "gold")`), it drops those within 45° of world −y (under the thumb in portrait), those within 40° of world +y (under the portrait caption band), and those closer than (half-width + 30°) to the arc's centre at that moment (65°, or 80° with Assist). Of the rest it takes the one farthest from every stuck sperm (held sperm ignored), the first in seeded order on a tie. Two side sectors of 95° are left, and the arc rule can empty at most one of them, so a candidate always remains. It swims in at 14 u/s (4.5 s from 75 u to the shell) and burrows for 3.0 s, with a dashed ring. **Nudge:** the arc over it pushes it 6 u outward over 0.3 s; its burrow pauses (it is not reset); it returns at 8 u/s and ignores the arc until it is back, so each nudge costs about 1.05 s. After 3 nudges it slips under the arc. It enters by itself at 52 s into `guard` at the latest. Exactly one sperm enters: yours. |
  | Guard length | your sperm enters about 7.5 s after it comes in: at about 34.5 s after 1st place, 35.1 s after 3rd and 40.2 s after 20th, plus up to about 3.2 s of nudges |
  | Seal | the prompt shows at the end of `enter`. Her beats are counted from the first one at least 0.6 s after the prompt; the release target is the 3rd counted beat; kind `release`, P = 0.833 s. Only a press made after the prompt counts, and a release with no such press is ignored. The press may come any time before the target. With no release by the 6th counted beat, or a hold still down then, the shell seals by itself with no credit. The wave runs round the shell in 1.2 s. Then the others drift off at 12 u/s. |
  | Lengths | ref about 53 s (place 1), mid about 54 s (place 3), idle about 64 s (place 20, as after an idle stage 1; about 59 s at the default place 3); cap 80 s |

- **Score.** Goal 3,000 (always; nothing fails after the race). Skill: 1,500 × open accuracy (targets presented until
  it bursts, at least 3); 3,500 × the guard credit; 1,000 × (1 − nudges / 3) for letting your sperm in cleanly, paid
  only when the guard credit is above 0, so an idle guard earns none of it. The guard credit is the mean over every
  rival that came within 22 u of the centre before your sperm entered and was then settled: bounced before it stuck
  1, popped loose 0.5, held 0. Rivals still swimming in or burrowing when your sperm enters are left out of the mean;
  with none counted, the credit is 0. Flourish: the seal release, 1,000 In time, 500 Close, else 0.
- **Misses.** A smaller swell. A sperm that sticks and burrows. A held rival rests, still, in the cloud. Nothing stalls:
  the follicle bursts, your sperm always enters, and the shell always seals.
- **One-button.** Hold to let the arc track by itself (`botSteer` at skill 1.0); release to hold it still. The follicle
  taps and the seal are already one button; a button still held from the guard must be released and pressed again
  for the seal (5.3). In one-button mode `aim` and `turn` are cleared (16.4).
- **Assist.** Arc half-width 50° (100° in all); `turn` keys 720°/s; rivals burrow for 5.0 s; windows ×1.6 for the
  taps and the seal.
- **Carry in.** `sperm`: `hue` tints your gold sperm, `glow` sets its brightness, and `place` sets when it comes.
- **Facts.** Card `egg.surge` after "Now you are the egg.". Captions: `egg.fimbriae` and `egg.cilia` (sweep); in the
  guard, one general fact per wave before your sperm comes: `egg.zona` (wave 1), `egg.corona` (wave 2), `egg.choice`
  (wave 3), `egg.signal` (wave 4) and `egg.size` (wave 5); `egg.day` when your sperm comes in; `egg.stick` when your
  sperm sticks to the shell (the `stick` event with `gold: true`), since only it works its way through; `egg.fuse`
  (enter); `egg.wave` and `egg.seal` (seal); `egg.block` (fusion start); `egg.pronuclei` (when the nuclei touch, as
  the clock turns); `egg.place` (outro). Overlay `egg.weeks`. Run result: `egg.frame`. Up to `egg.block` the labels
  read "Week 2", like the HUD; from `egg.pronuclei` on they read "Day 0 after fertilization (week 2)" (15.2).
- **Game framing.** The guard is a game. Before fertilization the egg does not push sperm away, and many sperm can
  reach its cloud. The real block comes after one sperm fuses: cortical granules release their contents, and the
  shell changes so that other sperm cannot stick to it or get through (TTUHSC; `research/research-biology.md` 3.8).
  The seal shows that block. `egg.choice` shows in the guard as a general fact about the fluid around eggs
  (Fitzpatrick et al. 2020 compared different women's fluid on different men's sperm); no string says or implies that
  the egg picks your sperm over the others. `egg.frame` on the run result says the guard is the game's.
- **Look and sound.** Peach and cream paper rings like a target on a wine board (colour script row 2,
  `research/paper-cut/scenes/paper-guard.js`). The corona is a cloud of small paper dots, darker along your sperm's
  path. Cilia are a fringe of short paper strips. Rivals mauve `#967088`, as in stage 1. The arc is cream `#fff4e2`
  with an ink keyline, the highest sheet in the box and the brightest thing in the guard. Your sperm is marigold
  `#ffc53d` on a cream card, circled by cut cream dashes. The seal wave is a pale gold paper band `#ffe9a8` running
  round the shell. A bounce shows a small cut cream ring where it meets the arc. Sounds, through the womb bus: a soft low pluck per follicle tap and
  a warm swell at the burst; a soft low "boop" per bounce; a faint low tick when a sperm sticks; a small up-glide when
  one pops loose; a warm two-note swell when your sperm enters; at the seal, a soft shimmer swell that follows the
  wave round the shell; a held fifth at fusion.
- **Bot steering** (the arc). The target is the nearest rival that is not gold: the swimming rival that will reach
  22 u soonest; if none will in the next 1.5 s, the stuck rival with the most burrow progress. While your gold sperm
  comes in or burrows, the gold zone is every arc angle within (half-width + 10°) of it. The bot skips any target in
  the zone and turns toward its target the way that does not pass through the zone; if the arc is inside the zone, it
  first turns away from the gold. If both ways would cross the zone, it holds still or takes the next target on the
  gold's free side. So the ref bot never nudges your sperm. Angle error σ = 25° × (1 − skill), lag 150 ms × (1 −
  skill), memory in `r.mem` (6.1). `botSteer` returns a unit `steer` at the chosen angle. The taps and the seal come
  from the shared bot timing (16.11); the bot presses for the seal only after its prompt.
- **v1 builds.** The surge, the follicle taps and the sweep; the guard with its 8 waves, bounces, sticking, popping
  loose and held rivals; your gold sperm with nudges; `enter`; the seal with its wave; fusion with captions.
- **Floor.** The surge and the taps (the follicle bursts by itself on beat 8); the guard with the arc, sticking, held
  rivals and your gold sperm; the seal by itself at its cap; fusion.

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
- **Look and sound.** Coral paper cells with pale cut edges inside a cream shell ring, on a violet-red sheet.
  Mitosis is two paper discs parting while a small bridge capsule shrinks. A glassy pling per split, one step higher each time; a soft rising tone while holding.
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
- **Look and sound.** Deep red lining sheets, milk-white paper pools with rims of cut dots, a pale coral paper tree.
  Vessels pulse by arc length as cream beads riding the branches. A rising tone while growing, a bloom chime per link, then your own soft quick beat under hers, and a slow
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
- **Look and sound.** Rose sheets in a tunnel book (`research/paper-cut/scenes/paper-grow.js`, with the sac darkened
  to rose, 13.2). The baby figure is 10 to 12 splats on a 2D skeleton (section 14.4), drawn as a few rounded paper
  pieces. The cord lights are gold beads on a darker cord. From week 12 the pools are rose paper with a wavy pale rim,
  never crimson, and never drops or drips. Your heart
  is a soft click; hers is a low bed. Each In-time tap plays a soft bell from a pentatonic set (felt, very low-passed).
- **Bot steering.** Point the stick at the move glow.
- **v1 builds.** Heart taps with the cord lights, the week 10 line and the week 12 red pools, plus the drag moves.
- **Floor.** Heart taps only; the moves play by themselves.

### 6.6 Stage 6, Second Trimester (`answer`): "Listen. Then answer."

- **Sees.** A warm, roomy space of fluid. Amber-red light comes through the wall, with a soft dapple of light. You suck a thumb.
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
- **Look and sound.** Amber and honey sheets. The dapple sheet (the `caustics` field, 14.1) at 25%. The voice is a sine hum (a sine at F0 with a soft 2nd harmonic
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
- **Look and sound.** Ember orange sheets; the dapple sheet at full; the roomy paper glow is the brightest thing on
  screen. The womb filter
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
  - After wave 8: `light`: the bottom glow rises to fill the screen while exposure goes 1 → 6 over 2.0 s (the
    cream glow sheet, 14.1), then white 0 → 1 over 1.0 s (a full-screen `#ffffff` sheet, grain fading out), hold
    0.5 s. The sound opens from 300 Hz to 16 kHz over 1.5 s.
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
- **Look and sound.** Plum to white: straight plum side flats, darker toward the viewer, press in on each wave; the
  opening is only a cream-white paper glow along the whole bottom edge, growing. Waves are deep swells (brown noise 40 to 80 Hz) and her slow breath. Never a
  sound of pain.
- **Bot steering.** Hold from the warning; on prompt waves drag in the prompted direction; release in the rest.
- **v1 builds.** 8 waves with the light, plus the four prompt waves.
- **Floor.** 8 plain hold waves, then the light.

### 6.9 The ending (`ending`, not scored): "Breathe."

| Time | What happens |
|---|---|
| 0.0 s | White. |
| 0.0 to 1.5 s | Silence: the one gap in her heartbeat (5.1). Large cream and peach paper sheets fade in from the white: a warm room with no detail. |
| 1.5 s | "Breathe." A slow ring. Live gesture `hold`, optional. A press starts the inhale (a warm glow fills you); a release (at least 0.4 s; it lets go by itself at 2.5 s) gives a soft first cry. Her heart comes back soft and far (−12 dB). |
| 4.5 s | If there was no press, the breath comes by itself, with the caption "It can take a few seconds. That is normal." |
| about 6 to 9 s | Two more breaths come by themselves, a little uneven. Your glow warms (warm tones only, never a skin colour change). |
| about 9 s | Skin-to-skin: two plain paper ovals, a big warm one and a small one, in a circle of cream light. No faces, no limbs, no head-and-shoulders outline. Her heartbeat comes close and clear, 76 bpm: "[{Carer}'s heartbeat, clear now]", "You know this heartbeat." |
| about 12 s | "Rest your thumb here." A soft ring: in portrait at bottom centre, 78% of the height; in landscape low in the corner on the side of your last touch (right if none), inside the safe area. Touching it makes both rings pulse together. Desktop: "Rest here. Hold Space if you like." |
| about 16 to 28 s | Your song is hummed, clear and full band. Notes you answered shimmer a little. |
| about 29 s | "Your nine months took 9 min 48 s." (run core time from Play to the end of Birth, pauses left out) |
| about 33 s | The run result fades in (or on a tap after 29 s). |

No points, no grade and no score line appear from the end of stage 8 until the run result.

## 7. Scoring

- Per stage: **Goal** (3,000: the stage's goal; in stage 1, the top 3 at the meeting place; always met from stage 2
  on), **Skill** (up to 6,000) and
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
| HUD | Top left: the stage name (16 px caps) and the clock label (16 px). Top right: the pause button (48 × 48 px) and the score to its left. In stage 1, the place slot sits under the score, right-aligned, left of the pause button: "3rd of 20" (16 px; 20 px with Large text), inside the HUD block and above the prompt line, so it is never in the thumb zone. The scale bar: top left under the clock in portrait, bottom left in landscape and desktop. The prompt line under the HUD, top centre, names the live gesture with an icon (dot, ring, arrow). Captions in a band at 50 to 58% of the height in portrait (18 to 26% in stage 2, above the egg; one line for 2.5 s in stage 1), bottom centre in landscape and desktop (one line in stage 2 landscape). In portrait no HUD, caption or overlay text sits in the bottom 40% during play. All inside `env(safe-area-inset-*)`. |
| Stage card | Number and name, the one-word verb with its gesture icon, the clock label, the size (NHS object where NHS gives one), one fact, and on the trimester stages the border line. The stage 2 card leads with "Now you are the egg.". Shown over the crossfade. Skippable from 1.0 s (tap, Space or Enter). Gone by itself at 3.5 s. |
| Stage-end overlay | The grade word, the stage total, one fact. Continues by itself at 2.5 s. A tap lingers; a second tap or Next continues. Not after Birth. |
| Almost card (stage 1 only) | "Almost. Try again?", your place ("You came 5th of 20." after a finish, "You were 5th of 20." at the cap), "Your run and points are kept.", Try again (focused), Go on. It shows when you reach the meeting place outside the top 3, or at the 117 s cap. |
| Pause | Resume, Try this stage again, Settings, Sound, Switch game, ‹ Arcade. Opens on Esc, P, the pause button, `visibilitychange` (hidden) and `pagehide`. |
| Settings | Word for the one who carries you (mother, mum, mom, parent), Assist, One-button mode, Motion (Auto, Full, Reduced), Captions (on), Large text, Tap test, Timing offset (−150 to +150 ms), Sound, and the line "Weeks count from the first day of the last period. Midwives and doctors count this way." |
| Run result | "Hello.", the run total and time, 8 grade chips (Good, Great, Glowing), the breakdown per stage, best, marks, sparks, Play again, Stages, ‹ Arcade, and the line "In this game, every baby is born well. The ending is the same for every score." Below a divider, "What was real": every fact shown this run with its clock label and link, with the two game-framing lines `swim.frame` and `egg.frame` after the stage 2 facts, ending with the Apgar fact. |
| Stages | Each reached stage, with its best and grade, as a button. Plays that stage alone with the carry it last started with in a run (or defaults). Its score goes only to that stage's best. |
| Sources | Every fact in the game with its clock label and its source links. |

## 9. Layouts

| Layout | Input | Long axis (forward in `long`) | Subject | Captions | Notes |
|---|---|---|---|---|---|
| Phone portrait 390 × 844 | touch, one thumb | up | 45% of the height from the top in `long`, 42% in `fit`; always above 60% | band at 50 to 58% | the bottom 40% is the thumb zone; nothing to read there during play; the scale bar sits top left under the clock |
| Phone landscape 844 × 390 | touch, either thumb | right | 38% of the width from the left, 55% of the height from the top in `long` | bottom centre, above the safe area | HUD at the top corners; scale bar bottom left |
| Desktop 1440 × 900 | keys (mouse optional) | right | 40% of the width, half the height | bottom centre | the canvas is capped at 0.6 MP before scaling |

- Tap targets are ≥ 44 px on the shorter side. Play is 56 px tall, pause 48 px. No horizontal scroll on any screen.
- Safe areas: CSS `env(safe-area-inset-*)`, combined with the test flag `?inset=t,r,b,l` (section 16.10).
- **Stage 1, the place slot**: under the score at the top right, left of the pause button, in every layout. In
  portrait with `?inset=47,0,34,0` it sits at about 100 to 124 px (12 to 15% of the height).
- **Stage 1, the fork in view**: at the stage's 150 u span from the gate on, both branch mouths are on screen, under
  no HUD or prompt, at least 1.5 s before your head reaches the split in all three layouts (6.1). In portrait the
  stage 1 captions are one line and show for 2.5 s.
- **Stage 2, the egg and its arc** sit in the free part of the screen: the camera span is 140 u, and the egg's centre
  is the layout's subject point. Everything that matters stays within 28 u of the centre: the shell (11 u), the arc
  and its reach (22 u), every stuck sperm (head at 11.5 u, tail to 21.5 u) and held sperm (head at 18 u, tail to
  28 u), and your gold sperm from 28 u in. With `?inset=47,0,34,0`, the HUD and the prompt line end by about 125 px
  from the top in every layout.
  - Portrait 390 × 844 (2.79 px/u): the centre at 45% of the height (380 px); the 28 u zone spans 302 to 458 px (36 to
    54%), all above the thumb zone. Captions move up to a band at 18 to 26% (152 to 219 px), so they never cover the
    egg. Sperm from below cross 60% of the height at 45 u from the centre, 1.5 to 2.6 s before they reach the arc's
    reach. The band hides sperm 58 to 82 u above the centre, so the gold never comes from within 40° of straight up
    or 45° of straight down (6.2), and its path is never under a caption or below 60%.
  - Landscape 844 × 390 (2.79 px/u): the centre at 38% of the width (321 px) and 55% of the height (215 px); the 28 u
    zone spans 137 to 293 px from the top and 243 to 399 px from the left, below the prompt line (which ends by about
    125 px) and above the one-line captions (from about 311 px down, also with Large text).
  - Desktop 1440 × 900 (6.43 px/u): the centre at 40% of the width (576 px) and half the height (450 px); the 28 u
    zone spans 270 to 630 px from the top.
  - Sperm fade in on a ring at 75 u (209 px in portrait and landscape, 482 px on desktop). Where that ring leaves the
    screen they come in from off screen: left and right in portrait, the bottom in landscape (the top sits at the
    screen's edge, under the HUD), the top and bottom on desktop. Everywhere else they fade in on screen.

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
  the plain line RACE · GUARD · GROW · BREATHE. `core/save.js` exports the same rule as `cabinetLine(save)` for the
  node test. (The FURTHEST line is deferred.)
- **Cabinet**: copy the `ahead-of-the-light` article in `#row` whole: the marquee, the bezel with its screen and
  `.osd`, the `.panel` with START, the `.door` with its two `.slot` buttons, and the `.kick`. Then replace the names:
  `<article class="cab first-breath" data-game="first-breath" data-url="/first-breath/" aria-label="First Breath: a
  baby's journey to birth">`; marquee `<b>FIRST BREATH</b><small>A BABY'S JOURNEY TO BIRTH</small>`; screen `<img
  src="arcade/key/first-breath.svg" alt="A cut-paper egg in cream rings and a cloud of paper dots on wine red, with a
  cream arc round it and a small marigold sperm coming in" loading="lazy" decoding="async">`; `.hi` RACE · GUARD · GROW · BREATHE (it wraps like its neighbours with `text-wrap: balance`); both slots
  `aria-label="Drop a token into First Breath"`. CSS `.cab.first-breath { --c1: #5e1c34; --c2: #ffc53d; --glow:
  rgba(255, 197, 61, 0.45); }` (the stage 2 board and the marigold accent). The article goes after the `ahead-of-the-light` article in `#row`, and
  `"first-breath"` is appended to the Action group's `games`.
- **Switcher**: `{ id: "first-breath", name: "First Breath", sub: "A baby's journey to birth", url: "/first-breath/",
  art: "/arcade/key/first-breath.svg", color: "#ffc53d" }` (the marigold "you" accent), after the Ahead of the
  Light entry in `GAMES`.
- **Cabinet art**: `public/arcade/key/first-breath.svg`, viewBox `0 0 480 396` (the screen's 4 : 3.3), under 10 KB,
  no script, no external reference, no text, drawn as cut paper after `research/paper-cut/board-paper.webp`: a wine
  board `#5e1c34`, the egg as stacked rings (peach `#ffc49c`, a cream `#fff0dc` shell), a few paper dots of the
  corona, a cream `#fff0dc` arc, and a small marigold `#ffc53d` sperm on a cream card. Depth is offset shadow shapes
  in ink `#1a0610` at low opacity (no filters, no blur), straight snipped edges, no grain.

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
- **Race and guard cues** (stages 1 and 2, one-shots through the womb bus, so they stay low and soft). Each plays
  from its event (16.6). Bumps, bounces and sticks share a limit of 6 a second.

  | Cue | Event | Sound |
  |---|---|---|
  | Bump | `bump` | a soft low thump: a 90 Hz sine with a 180 Hz click, 80 ms, when you are in it; a bump between two rivals within 40 u of you (from its `x, y`) plays 10 dB softer; others are silent |
  | Place | `place`, when you gain one | a faint rising pluck, 110 → 147 Hz |
  | Ready | milestone `ready` | a warm two-note chime, 98 and 147 Hz with soft harmonics |
  | Bounce | `bounce` | a soft low "boop": a sine gliding 110 → 140 Hz, 70 ms, one pentatonic step higher per wave (its `wave`) |
  | Stick | `stick` | a faint low tick: low-passed noise, 30 ms, 12 dB under the bounce |
  | Loose | `loose` | a small up-glide, 120 → 160 Hz, 90 ms |
  | Your sperm comes in | `goldIn` | a soft warm pluck at 147 Hz, panned toward its `angle`, with the caption "♪ your sperm comes in" |
  | Enter | `enter` | a warm two-note swell, 98 and 147 Hz, 1.0 s |
  | Seal | `seal` | a soft shimmer swell, three detuned sines at 110, 165 and 220 Hz whose slow tremolo follows the wave round the shell, 1.2 s, then a low bloom |

- **Birth sounds**: a first inhale (noise bandpassed 1 to 3 kHz, rising), a soft short cry (two sines at 450 and
  900 Hz with a gentle fall, 1.2 s), then the clear room.
- **Budget**: about 10 persistent voices plus the one-shot pool. No node churn per beat. Mute and pause ramp the master
  with `setTargetAtTime`.
- Sound is never required: every cue is also visual.

## 12. Accessibility

- **Captions** on by default, in an `aria-live="polite"` region: every sound cue has a caption with a symbol and, where
  it helps, a direction: "♥ {carer}'s heartbeat", "♥ your heartbeat", "~ wave", "♪ voice, left: 3 notes", "a loud
  sound outside", "first breath", "a soft cry". The frequent contact sounds (bump, bounce, stick, loose) are named
  once per stage ("~ the pack swims around you", "· sperm bounce off the arc"); each contact also shows a small soft
  ring. Your sperm entering and the seal have their own captions ("♪ your sperm comes in", "♪ a shimmer runs round
  your shell").
- **Visual-only play**: every beat is a ring, every hummed note is a ripple, every answer note has a ghost ripple, and
  every target has a DOM ring in `svg#rings` before its time. Stages 2, 3, 5 and 6 play fully with sound off.
- **Reduced motion** (follows `prefers-reduced-motion`; Settings can override): warp ×0.5 (the paper sheets sway half
  as far, 14.1), no scale bounce, no camera
  shake, beats change brightness only, contractions do not move the walls (the vignette only), the birth light is a
  plain 1.5 s fade. Bumps never shake the camera, and the seal wave is a brightness sweep round the shell with no
  ripple warp. The stage crossfade is the same in both modes. Rhythm stays.
- **Flash safety** (WCAG 2.3.1): one swell per beat, never one each for "lub" and "dub"; a full-screen tint follows only
  her heart (≤ 100 bpm) and changes frame luminance by ≤ 6%; your faster heart moves only its ring and a small splat
  (< 2% of the screen); at most 3 luminance swings of ≥ 10% in any 1 s; no red flashes; the birth light rises steadily.
- **Colour**: no goal depends on hue. Cues differ by shape and brightness: rings, dotted rims (gland pools) and wavy
  rims (blood pools), dashes and dots for the two hearts, chevrons for the warm lane, words for grades. In stage 1
  you are the brightest sperm, at least 2.25:1 above the rivals, on your cream card, and the warm tube has chevrons
  while the cool tube has none. In stage 2 the arc is the brightest band, your sperm has cut cream dashes round it,
  and stuck sperm show a dotted ring. **Every cue is a sticker**: from the outside in, a 2 px ink keyline `#1a0610`
  (the halo; cream `#fff8f0` in the ending), a cream margin `#fff0cf` when the cue itself is not cream, then the cue.
  Each cue token has a contrast ≥ 3:1 against its keyline, and the sticker reads against every sheet it can sit on
  (its `under` tokens, 13.2), in normal vision and under protan, deutan and tritan simulation (section 17). A plain cue
  with no keyline (the stage 5 cord lights) needs ≥ 3:1 against its `under` sheet itself.
- **One-button mode** in every stage, and **Assist** (section 5 and each stage).
- **Large text**: base 16 px → 20 px; captions 18 px → 22 px.
- **Keyboard**: full play and full menus with visible focus (a 3 px marigold `#ffc53d` ring with a 1 px ink
  `#1a0610` line outside it, so it shows on cream paper and on dark sheets). No moment needs the mouse.
- **No mash input** anywhere. No input needs two pointers.
- **Haptics** are deferred (section 19.2). Every cue already has a sound and a picture.

## 13. Art direction: paper cut

The reference art is `research/paper-cut/`: the shared helpers (`kit.src.js`), three scenes (`paper-race.js`,
`paper-guard.js`, `paper-grow.js`, each with its palette in its header), the board (`board-paper.webp`) and the
side-by-side with watercolour wash and oil (`compare-*.webp`). Section 14 says how the game draws it.

### 13.1 Direction

- **Flat sheets of coloured paper stacked like a shadow box or tunnel book.** Each sheet is one flat colour with a
  fine grain that moves and turns with its sheet. No gradients inside a sheet, no gloss, no outlines except the cue
  keylines.
- **Hand-cut edges** from short straight snips: a slow wobble along the edge plus a small jitter per snip, stable from
  frame to frame (14.1).
- **Depth only from soft drop shadows** between sheets. The light is above and a little left in every layout, so a
  sheet's shadow falls down and a little right, offset by its height. A sheet's cut edge toward the light is a hair
  paler.
- **Frame sheets get darker toward the viewer**, like the front flats of a tunnel book. The subject sits on the
  highest sheet, with the deepest shadow.
- **One marigold accent for "you"** (`#ffc53d`): your sperm in stages 1 and 2, your heart in stage 5, the direction
  arrow in stage 8. Nothing else on screen is marigold.
- **Labels are small cream tags**: the place slot, the prompt line, captions, the stage name and the clock are DOM
  elements styled as paper tags (background `#fff0dc`, ink `#3a1029`, rounded, a CSS `box-shadow` down and a little
  right). **The canvas draws no text.** The tags sit at the positions sections 8 and 9 give, so the layout checks read
  their DOM boxes. The no-`shadowBlur` rule covers the canvas only; CSS shadows on DOM tags are fine.
- **Motion**: sheets sway a few px in parallax (the deeper the sheet, the less it moves; shadows stay put), tails beat,
  waves and dots slide. No sheet ever flashes.
- **The light rises over the run**, now in paper: dim violet-red sheets in stages 1 to 3, deep red in 4, rose in 5,
  amber in 6, ember in 7, plum toward a bright opening in 8, and a warm cream room for the ending. The stage frame
  means rise in that order (13.3); single tokens may not.
- **The birth opening is drawn only as light**: a cream-white paper glow along the whole bottom edge that grows, never
  anatomy. In stage 8 the renderer's frames are straight side flats with no closed aperture: no round or scalloped
  window, and no ring of sheet edges round the light.
- **Tone rules stay hard** (section 2): no face, no anatomy, no blood. Pools are rose with a pale wavy rim, never
  crimson, never drops or drips. The baby is a few rounded paper pieces (a round head, a curled bean of a body, buds
  or short folded limbs) with no face and no expression (NHS week 16: faces before birth are random). No realistic
  fetus portrait. No Nilsson-style composition. In the ending the two shapes are plain ovals with no limbs and no
  head-and-shoulders outline.
- One camera whose scale only grows, from a 0.05 mm sperm to a 2 m room, with a scale bar from stage 3 on.
- Every frame has one brightest thing: the cue the player needs now (`cue` in the draw list). Every cue is a sticker
  (section 12): a 2 px ink keyline outside, a cream margin when the cue is not cream, then the cue.

### 13.2 Colour script (hex)

Tokens live in `render/palette.js` (plain data, node-importable); the contract owner lands this table there (task
3.1). Stages 1, 2 and 5 start from the reference scenes' hex values (`research/paper-cut/README.md`), changed where
the checks needed it; stages 3, 4, 6, 7, 8 and the ending have no reference art yet, and their rows are a first cut
for task 3.8 to tune.

Shared tokens: `ink` `#1a0610` is the keyline (the halo), the colour of every drop shadow (the reference's shadow
`#1c0612` is merged into it) and the scrim base; `margin` `#fff0cf` is a sticker's cream card; `glow` `#fff4e2` is the
paper glow; `you` `#ffc53d` (back of a twisted ribbon `#ee951c`); `tag` `#fff0dc` with `tagInk` `#3a1029`; `white`
`#ffffff`. Shadows are `ink` at alpha 0.28 to 0.42.

In the table, sheets run from the front of the box (the darkest frame) to the back. `back` is the lit back sheet.
Each cue lists its `under` tokens: every sheet it can sit on. A cue marked **sticker** has the keyline and the cream
margin; **keyline** has the keyline only (the cue is cream already); **plain** has neither.

| Stage | back | frames and sheets (front → back) | bodies | cue (main) → under | cue (second) → under | tint |
|---|---|---|---|---|---|---|
| 1 The Race | floor `#86355a`; floor dots `#9b4a6c`, `#702b4c`; wave bands `#a3536f` | walls `#36102a` / `#4c1839` / `#64224a`; warm tube `#e8834f` with lane `#f6ab48`; cool tube `#4e3a5e`; meeting band `#f3c9d6` | rivals `#967088` (back `#7c5872`, resting `#84607a`) | you `#ffc53d`, sticker → floor, dots, wave bands, walls, warm tube, lane, cool tube | chevrons `#fde7c6`, keyline → lane, warm tube | `#ff9a8a` |
| 2 The Egg | board `#5e1c34`; ripples `#6c2440` | follicle `#f4a88a` (opening); cilia `#e8a090` | corona `#f2a07e` / `#f8c3a2` / `#e07f66`, and `#9a4a44` along your sperm's path; cell `#ffc49c`, shell `#fbe3d0`, inner disc `#ffd8b8`, nucleus `#f08c6c`; rivals as stage 1 | arc `#fff4e2`, keyline → board, ripples, corona (all four), rivals | your sperm `#ffc53d`, sticker, with cut dashes `#fff0cf` → board, ripples, path dots; seal wave `#ffe9a8`, keyline → shell, cell | `#ffb08a` |
| 3 The Embryo | `#7a2c50` | frames `#3a1030` / `#52183e` / `#6a2448`; tube walls `#64224a` | cells `#f07860` (cut-edge core `#fff0dc`); shell `#fbe3d0`; hollow `#ffd8b8` | approach ring (DOM) `#ffc53d`, keyline → back, cells, shell | hold ring (DOM) `#fff4e2`, keyline → back, cells, hollow | `#ff9a7a` |
| 4 The Placenta | lining `#7a1e34`; deep lining `#5c1428` | frames `#2e0814` / `#44101e` / `#5a1628`; the thin layer `#ffd8c8` | tree `#f4a890` (beads `#fff0dc`); you `#ffb8a0`; soft spots as paper glows | gland pools `#f3eadf` with a rim of cut dots `#fff8ee`, keyline → lining, deep lining | your heart ring (DOM) `#fff4e2`, dashed, keyline → lining, tree | `#ff8a6a` |
| 5 First Trimester | sac `#d4788a` (rose; the reference's pearl `#f6d6cc` outshone the cue); motes `#ebb5b2` | frames `#4e1430` / `#8e2c4b` / `#c25470` | placenta `#b04058` and `#c25470`; pools `#d9667c` (L ≥ 0.25, from week 12) with a wavy rim `#ffc8d0`; cord `#a8405a` (back `#8a3048`); body `#f39477`, head `#f6a585`, limbs `#e57a62` | your heart `#ffc53d`, sticker → body, head, sac | cord lights `#ffd25a`, plain → cord, cord back; pool rim `#ffc8d0`, plain → placenta `#b04058`; move glow, a paper glow | `#ff8a7a` |
| 6 Second Trimester | wall `#c8703c` | frames `#5e2a16` / `#8a3a20` / `#b4542c`; fluid `#e89a5a`; dapple `#f6c890` (alpha ≤ 0.12) | you `#ffc0a0`; the warm patch and the hand glow as paper glows `#ffd8b0` | voice ripples `#fff0b8`, keyline → wall, fluid, back frame | answer ghosts `#fff4e2`, cut dashes, keyline → wall, fluid, back frame | `#ffa860` |
| 7 Third Trimester | `#d97a40` | frames `#6e3214` / `#9a4a20` / `#c4602a`; snug walls `#e8925a`; dapple `#ffd8a0` | you `#ffc8a0` | breath ring (DOM) `#fff4e2`, keyline → back, walls, you, back frame | roomy glow, a paper glow `#ffe0a0` | `#ffb36b` |
| 8 Birth | `#6a2a4a` | straight side flats `#2a0818` / `#3e1028` / `#521a38`, no aperture | you `#e8a0b8`; the opening glow `#fff4e2` rising to `#ffffff` | wave and prompt ring (DOM) `#fff4e2`, keyline → back, flats, you | direction arrow `#ffc53d`, sticker → back, you, glow, back flat | `#ffffff` |
| Ending | `#ffe8d6` | room sheets `#ffd2b8`, `#fff4ea` | big oval `#ffc9a8`, small oval `#ffb38a` | rings `#7a2e1e`, dark on light, cream keyline `#fff8f0` → back, room sheets, ovals | text `#4a1e10`, cream keyline → back, room sheets | `#ffffff` |

DOM rings (`render/rings.js`): her ring `#ffc53d` solid; your heart ring `#fff4e2` dashed with a dot; target rings
(approach, hold, breath, wave, prompt) `#fff4e2`; burrow rings `#fff0cf`, dotted for rivals and dashed for your sperm;
each stroked over a 2 px wider `ink` keyline (cream `#fff8f0` in the ending).

UI (DOM): tags and cream buttons `#fff0dc` with ink `#3a1029`; Play `#ffc53d` with ink `#3a1029`; menus on a scrim
`rgba(26, 6, 16, 0.72)` with text `#fff4ea`; the focus ring of section 12.

Rules (`palette.test.mjs`, in normal, protan, deutan and tritan views, Machado 2009):

- each cue ≥ 3:1 against its keyline;
- each **sticker** or **keyline** cue: for each `under` token, the keyline or the cue's light layer (the margin, or
  the cue itself when cream), whichever contrasts more, ≥ 3:1;
- each **plain** cue ≥ 3:1 against each `under` token;
- stages 1 and 2: you ≥ 2.25:1 above the rivals; stage 1: warm tube ≥ 3:1 against the cool tube; stage 2: your sperm
  ≥ 3:1 against the path dots; stage 3: cells ≥ 3:1 against the back, and redder (R / (G + B)) than it;
- every chromatic ending token has a hue of 0° to 50° (achromatic tokens such as `#ffffff` are skipped);
- no rule asks the `back` tokens to rise from stage to stage: the frame means do that (13.3).

The rows above pass these rules in a scratch run of the same maths before wave 1 (the worst cases: stage 1 you over
the rivals 2.45:1, stage 5 cord lights 3.83:1 on the cord, stage 5 pool rim 3.56:1 on the placenta). If a hex fails,
the cue or its under sheet changes and this table is updated.

### 13.3 Visual checks

Each is a test, not a judgement by eye (section 17):

- a frozen frame per stage: non-black, and the cue at or above the frame's 95th luminance percentile (DOM rings
  included);
- stage 3, a paper cell: the palette rule above, plus in the frame the cell's pale cut edge (its `core`) is the
  brightest ring within 8 px of the cell's edge, and the shadow just below and right of the cell is darker than the
  back sheet;
- the stage frame means rising in colour-script order (stages 1 to 7);
- the palette rules, the flash rule, the birth-light ramp, the ending's warm hues;
- stage 8: when the light starts, its brightest region touches the bottom edge across ≥ 90% of the width, and no
  closed ring of sheet edges surrounds it;
- the low tier in every stage (14.3);
- a screenshot of every stage at the three layouts, in both tiers, for the PR.

## 14. Rendering stack and named sources (AGENTS.md rule)

### 14.1 The paper renderer

One Canvas 2D context on `canvas#view` (`{ alpha: false }`). Never `willReadFrequently`, `ctx.filter`, `shadowBlur`
or a per-frame full-screen gradient. It draws the frozen draw list of 16.5 and nothing else: no stage knows that the
frame is paper. DOM SVG draws the beat rings (sharp, moved by `transform`, assertable in Playwright), and the DOM draws
every label as a paper tag (13.1). The `render/` files (14.5 says how this reads against 16.1):

- `paper.js`: `cut`, `sheet`, `shadow`, `grain`, `bake`, `blit`. A port of `research/paper-cut/kit.src.js` as an ES
  module, with cut jitter from world position, one shadow colour (`ink`) and sub-pixel blits below step 1.
- `bake.js`: the bake cache (renderer frames, world-space course tiles, the tree per version, the dot atlas, the
  dapple tiles).
- `items.js`: draws each draw-list item as paper (the table below), live or from the cache.
- `low.js`: the low tier's forms (14.3).
- `perf.js`: the frame cost, the probe readback, the tier switch, the scale steps and the `perf` fields (14.3).
- `renderer.js` (behind the frozen `createRenderer` signature), `camera.js`, `palette.js`, `rings.js`, `debug.js`, and
  `strips/` (`tails`, `cilia`, `tree`, `cord`, `chevrons`, `ripples`, `arc`, `course`).

**Draw order** (back to front): the back sheet and its light; baked course tiles and still sheets; ground details
(dots, waves, pools); bodies with their shadows; strips; marks; the subject; the cue stickers; the renderer's frames
(the front flats, darkest); the dapple sheet; the tint sheet; the exposure and white sheets; the crossfade copy. DOM
rings and tags sit above the canvas.

**Sheet heights** (px at step 1 on a phone, times `hs = √(short side / 390)` as in the reference): the back 0; ground
details 1 to 2; course sides and the lane 1.6 to 2.2; bodies 3 to 5; rivals 4; the subject 6 to 8, plus its margin;
the stage 2 arc 10, the highest sheet; frames 5 to 9, the front frame highest. A shadow falls (0.42 h, h) px from its
sheet and is 0.8 + 0.85 h px soft.

**Cut edges.** Each edge point moves along its normal by `amp · noise(x / λ, y / λ) + jitter · hash(⌊x / s⌋, ⌊y / s⌋)`,
where (x, y) is the point's **world** position. Never the point's index or the arc length from the window's start: a
course window that slides cuts the same edge as before, so edges never flicker. Moving items (splats, tails, ripples,
points, marks) get no per-index jitter: their wobble comes from shape-local coordinates only (along a tail, round a
disc), the same for every item of a kind, so items that change order in the list keep their shape. Defaults: snip
s = 7 px, amp 1.4 px, jitter 0.45 px, λ = 60 px, times `hs`.

**Shadows** are laid in screen space after the camera's orientation, so the light stays above and a little left in
every layout, also in `long` landscape and desktop, where the world turns −90°. Still sheets get the reference's soft
shadow (one offset fill, then up to 8 widening strokes clipped to the outside), baked. Moving sheets get a cheap
shadow: one offset silhouette fill at low alpha plus at most 2 widening strokes. The splats of one body (overlapping
discs and capsules in one hue band, such as stage 3's cells or the egg) share one union outline and one shadow; this
replaces the summed-field merge of the WebGL plan.

**Grain.** One 256² tiling value-noise tile (mottle, streaks, specks, fibres), made once at boot and filled over each
sheet as a `CanvasPattern` whose `setTransform` follows the sheet, so the grain moves and turns with it. No grain on
moving shapes under about 12 px across (most sperm heads, dots, beads), and none in the low tier. As `light.white`
rises, the grain fades to 0.

**Bakes.**

- *Renderer frames* (tunnel-book flats, the stage 8 side flats, the ending's room sheets): baked once per stage, size
  and scale step, with a margin for the sway, during the stage card or the crossfade, never in a measured frame. In
  stage 8 the flats press in 6% per swell: they are blitted scaled about the screen centre (or drawn live if the
  scaled blit looks soft), and they stay still in reduced motion.
- *Course tiles* (stage 1). The stage sends only the visible part of each `course` strip (≤ 32 points), and the window
  moves every frame, so the renderer never has the whole course at once. It keeps the course's points in world space as
  the windows reveal them (the course never moves in the world) and bakes **world-space tiles** of 64 u, keyed by
  (stage, scale step, orient, tile x, tile y). Each tile holds the floor, the three wall sheets, the warm and cool
  sides and the lane. A tile is baked once the points that cross it and its neighbours have arrived; until then that
  part is drawn live. While the span eases from 170 to 150 u, tiles are blitted scaled, and they re-bake once the span
  settles. A `camera.rot` change of more than 1° re-bakes. Tiles more than 2 tiles behind you leave the cache.
- *The tree* (stage 4, and the placenta disc after it): baked per `tree.version`; its `pulse` is drawn live as cream
  beads riding the branches.
- *The dot atlas*: one sheet of paper dots in 8 sizes and each stage's dot tones, with the cheap shadow baked in, for
  `points` and the motes: one `drawImage` per dot.
- *The dapple tiles* (`caustics`) and the grain tile.
- A frame that bakes is flagged, and it is left out of `emaMs`, `p95Ms` and the adaptive counters (14.3).

**Sway.** One slow sway vector (about 0.12 Hz), of length `motion.warpAmp` = 3 px × `warp` × `hs` (half in reduced
motion), moves each sheet by its depth factor: frames 1.4, items 0.5 to 1, the back 0. Shadows stay put. At step 1 a
blit snaps to whole device pixels; below step 1 a device pixel is 2 to 3 CSS px, so blits use sub-pixel offsets (with
image smoothing on) and the sway moves smoothly. The step-0.5 strip in `shots.mjs` checks it (task 5.8).

**The draw list as paper.** Every 16.5 item, its paper form, and its low-tier form (14.3). Heights are px at step 1.

| 16.5 item | Paper form | Height | Shadow | Grain | Baked or live | Low tier |
|---|---|---|---|---|---|---|
| `stage` | the palette row (13.2) | | | | | same |
| `camera` | world to screen (`camera.js`); sway per sheet depth | | | | | same |
| `scale` | the DOM scale bar in the HUD | | | | DOM | same |
| `light.level`, `light.warm` | the back sheet lit: a `glow` sheet over it at alpha 0.25 × level, its colour mixed from `glow` toward the stage tint by `warm` | 0 | none | no | live, one fill | same |
| `light.vignette` | the front frame closing in: its window shrinks by vignette × 20% of the short side | frame | baked | baked | blitted scaled | same, flat shadow |
| `light.tint` | a full-screen sheet of the stage tint at alpha ≤ 0.06 (the flash rule) | top | none | no | live | same |
| `light.exposure` (1..6) | the cream glow sheet: `glow` at alpha 0.85 × (exposure − 1) / 5 over the frame | top | none | fades out | live | same |
| `light.white` (0..1) | a full-screen `#ffffff` sheet at alpha `white`; grain × (1 − white) | top | none | fades out | live | same |
| `warp` (0..1) | the sway amplitude, `motion.warpAmp` | | | | | same |
| `caustics` (0..1) | the dapple sheet: two baked tiles of cut cream spots sliding against each other at alpha 0.12 × caustics (cut list 2) | 0.5 | none | no | baked, slid | none |
| `splats` | `k: "c"` a paper disc, `k: "s"` a capsule; colour from `hue` through the stage's body ramp in `palette.js`; `m` sets the height (m × 5 px); `n` > 0 adds a nucleus disc on top; `v` > 0 is the heart sheet (a `you` sticker from stage 4 on); one body's splats share one union outline and shadow | 3 to 5 | cheap, one per body | only ≥ 12 px | live | flat fill, one flat shadow per body |
| `points` (≤ 600) | atlas dots; `hue` picks the tone row, `a` the alpha | 1 to 2 | baked in the atlas | no | atlas | atlas dots with no shadow |
| render motes | ≤ 150 atlas dots drifting at the back | 1 | baked in the atlas | no | atlas | none |
| strip `tails` | paper ribbons, each cut from one strip: a teardrop head (when no splat draws it) and a tail that twists to show its back colour, beating by `phase`; `ring: "halo"` the sticker (cream card and ink keyline); `"dashed"` cut cream dashes round the head | 4 (you 7.5) | cheap | no | live | a plain ribbon, no twist, flat shadow |
| strip `cilia` | a fringe of short cut strips along a→b, bending by `phase` and `amp` | 2 | cheap | no | live | half the strips |
| strip `tree` | cut ribbons by node width; `pulse` as cream beads by arc length | 2 to 3 | soft, baked | baked | baked per `version`, beads live | the same bake with flat shadows, beads kept |
| strip `cord` | a twisted paper ribbon (its back colour where it turns); `lights` are plain gold beads on it | 3 | cheap | no | live | no twist |
| strip `chevrons` | cut cream V shapes with the keyline, sliding with `phase` | 1.3 | cheap | no | live | flat shadow |
| strip `ripples` | cut paper rings (an even-odd annulus) at alpha `a`; `dashed` as cut dashes; the contact rings are small and short-lived | 1.5 | cheap | no | live | no shadow |
| strip `arc` | a cut cream arc with round ends and the keyline, the highest sheet; `glow` adds a paper glow behind it | 10 | soft, live (fill plus 2 strokes) | yes | live | flat shadow, no grain |
| strip `course` | layered tube sheets: the floor, three wall sheets darker toward the viewer, the warm or cool side and the lane, by `tone` | 0 to 9 | soft, baked | baked | world tiles | tiles with flat shadows and no grain |
| marks `pool`, `lake` | a cut disc or a big scalloped sheet; rim `dotted` a ring of cut cream dots, `wavy` a wavy-cut pale rim (never drops); `pulse` scales it by 1 + 0.12 pulse; `on` gives the linked colour | 1.2 to 3 | cheap | only ≥ 12 px | live | flat shadow |
| marks `band`, `meet` | cut ribbons across the course: a wave is a crescent of paler rose; the meeting band | 1.8 | cheap | yes | live | flat shadow |
| marks `warm`, `cool` | the fork mouths as cut sheets in their tone | 2.2 | in the tiles | baked | in the course tiles | same |
| marks `glowwall`, `glow`, `light`, `spot`, `hand` | a **paper glow**: 3 stacked translucent `glow` discs (radius r, 0.72 r, 0.45 r; alpha 0.10, 0.12, 0.16, times `on`), no shadow; `glowwall` sits on a wall; `light` (stage 8) is a wide glow along the whole bottom edge; `hand` is a soft cream oval pressed into the wall, never a hand shape | 0 | none | no | live | 2 discs |
| mark `arrow` | a cut marigold arrow sticker | 6 | cheap | no | live | same |
| `rings` | DOM SVG (`rings.js`), each over an ink keyline | | | | DOM | same |
| `anchor`, `cue` | tests only (the thumb zone, the brightest cue) | | | | | |
| the crossfade | an offscreen copy of the old stage's last frame, blitted with `globalAlpha` over the new stage for 0.8 s | | | | live | same |

The ending's warm room is its renderer frames: large cream and peach sheets that fade in from the white (no blur).

### 14.2 Sources

The WebGL plan's rendering sources (metaballs after Wong and Bebber, Quilez's distance functions, Gustavson's noise
warp, the GPU Gems transmittance light, d'Eon and Luebke, Barré-Brisebois, mip glow, Reinhard tone mapping, the
radial vignette, Blinn's blobs) are no longer used and are left out. The art reference is `research/paper-cut/`.

| Technique | Source adapted |
|---|---|
| The look: flat cut shapes with a few strong colours floating on fields of colour | Henri Matisse's cut-outs: "The Snail" (1953) and "Polynesia, the Sky" (1946) |
| A body told in a few cut shapes (the baby figure, 14.4) | Henri Matisse, "Blue Nude II" (1952). The skeleton of splats is our own (`core/lib/figure.js`). |
| Reduced round forms, rows of dots, concentric targets (the egg and its cloud) | Charley Harper's flat geometric prints |
| Paper that is cut, not modelled; the twisted paper ribbon; cut-card bursts | Tearaway (Media Molecule); Rex Crowle, "Building the Touchy-Feely World of Tearaway" (GDC 2013) |
| Layered silhouettes that darken toward the viewer | Gris (Nomada Studio) |
| A stack of frames with windows, lit from behind | Tunnel books and shadow boxes (paper engineering) |
| A drop shadow per layer plus a noise grain layer | Abduzeedo, "Learn How to Create Paper Cut Effect with this Photoshop Tutorial"; Red Shark Digital, "How to create layered cut out paper in Adobe Illustrator" |
| Still sheets pre-rendered offscreen; whole-pixel `drawImage`; no `shadowBlur` | MDN, "Optimizing canvas" (pre-render similar or repeating objects on an offscreen canvas, avoid floating-point coordinates, avoid `shadowBlur`). Below step 1 we take sub-pixel offsets on purpose (14.1). |
| Grain that moves and turns with its sheet | MDN, `CanvasPattern.setTransform()` |
| The soft shadow from widening clipped strokes | **None fit; our own** (`research/paper-cut/kit.src.js`): the offset silhouette filled once, then stroked with widening lines clipped to its outside, each pass weak enough that the stack sums to the shadow's alpha at the edge. |
| Hand-cut snip edges, jittered by world position | **None fit; our own** (14.1). |
| The grain tile | **None fit; our own**: a tiling value-noise tile with mottle, streaks, specks and fibres. |
| The paper glow | **None fit; our own**: three stacked translucent cream discs, with no gradient, blur or filter. |
| One union outline and shadow per body | **None fit; our own**: the splats of one body filled as one `Path2D` (nonzero rule), so the WebGL summed field is not needed. |
| World-space course tiles | **None fit; our own** (14.1). |
| The low tier | **None fit; our own**: the same sheets with no grain and one flat shadow (14.3). |
| The vignette as the front frame closing in | **None fit; our own**, after the tunnel book's front flat. |
| Current | Bridson, Hourihan and Nordenstam, "Curl-Noise for Procedural Fluid Flow" (SIGGRAPH 2007), with the wall ramp; Reynolds, "Steering Behaviors for Autonomous Characters" (GDC 1999) for the bot's steering; Shiffman, *The Nature of Code* |
| Tails (you, the rivals and the sperm at the egg) | **None fit; our own design**: a travelling sine on each strip, amplitude rising toward the tip, phase from each sperm's own swim speed. The ribbon that twists to show its back follows Tearaway's paper strips. |
| Rival steering in the race | Reynolds, "Steering Behaviors for Autonomous Characters" (GDC 1999): seek the lane, separation, flow following. The rivals share the player bot's steering at their own skill. |
| Catch-up in the race | Adapted against Iain Gilfeather's warning in "Advanced racing game AI in Pure", GDC Europe 2009 (reported by MCV): he argued against rubber-banding, because players should feel the AI follows the same rules, and proposed race scripting instead. Ours keeps every rule the same for every sperm; the catch-up only scales how hard a rival swims, is capped at 10% (ahead of you) and 6% (behind you), and is never shown. |
| Soft bumps | **None needed**: the plain overlap test of two circles, with an equal push apart along the line between their centres; Reynolds' separation keeps the pack from piling up. |
| The fork, the warm tube and the cool loop | **None fit; our own design**, built from the tube flow (the curl-noise row) and the chevrons. |
| Course strips and wave bands | **None fit; our own design**: each `course` strip is a band of varying width along a centre line of at most 32 points, drawn as layered tube sheets in world tiles (14.1); a wave is a `band` mark, a crescent of paler rose paper. |
| The guard arc (the mechanic) | Atari, *Warlords* (1980): a shield that slides round a base and turns incoming balls away. Ours turns sperm away gently and harms nothing. |
| The guard arc (the drawing) | **None needed**: a cut cream sheet whose outline is two concentric Canvas `arc()` calls joined by round ends, with the keyline and the deepest shadow (Tearaway's cut card for the feel). |
| Burrow rings | The DOM beat rings (the osu! row below), dotted for rivals and dashed for your sperm, with their progress as the ring's sweep. |
| The seal wave | **None fit; our own design**: two pale gold paper bands that spread both ways round the shell from the entry point and meet on the far side, after the wave that spreads through the egg from where the sperm entered (TTUHSC, `egg.wave`). |
| Contact rings (bumps and bounces) | **None fit; our own design**: small, short-lived cut rings from the ripple strip. |
| Cilia | A fringe of cut strips bending in a metachronal wave, after the metachronal-wave review (PMC11044847) |
| Villous tree | Runions et al., venation (SIGGRAPH 2005) and space colonization (2007); pipe-model widths; drawn as cut ribbons and baked per version |
| Vessel and cord pulse by arc length | **None fit; our own design**: one swell per beat, `exp(−((φ − s/c − 0.08)/0.06)²)`, drawn as cream beads riding the branch or the cord |
| Chevrons (warm lane) | **None fit; our own design**: V marks along the lane centre, scrolling forward at the lane's speed. |
| Ripples (the voice) and ghost ripples (answers) | **None fit; our own design**: ring strips that grow at a fixed speed and fade as 1 − r / rMax; the dashed ghosts follow the approach-circle idea in the beat-cue row. |
| The dapple sheet (the `caustics` field) | Adapted from Zucconi, "Believable Caustics Reflections" (2019), the idea of one tileable texture moved twice against itself: here two baked tiles of cut cream spots at low alpha. No Shadertoy code (licence). |
| Exposure and white at birth | The arc after Jenova Chen, "Designing Journey" (GDC 2013); WCAG 2.3.1 for the steady rise. The cream glow sheet and the white sheet are **our own** (no tone mapping). |
| The ending's warm room | **None fit; our own**: large cream and peach sheets fading in from the white, after the Journey arc for the warmth. No blur. |
| Stage crossfade | **None fit**: a plain alpha mix of the old frame's copy and the new one. (The log zoom after Eames, *Powers of Ten* (1977), is deferred.) |
| Beat cue rings | osu! approach circles; Rhythm Heaven's sound-plus-picture cues |
| Cue stickers (keyline, cream margin, cue) | **None fit; our own**, after the cream card under "you" in the reference art. |
| Colour-vision simulation (tests) | Machado, Oliveira and Fernandes, "A Physiologically-based Model for Simulation of Color Vision Deficiency" (IEEE TVCG 2009), severity 1.0 matrices; WCAG 2.x relative luminance and contrast |
| Audio timing and the womb | Chris Wilson, "A tale of two clocks"; Gerhardt and Abrams, J Perinatol 2000 (energy above 0.5 kHz down 40 to 50 dB); Paul Kellet's pink noise. The sine hum and the cry: **none fit**, plain sines. |

### 14.3 Budgets, tiers and frame cost

- Per frame (the draw-list limits of 16.5, `core/draw.js` `LIMITS`, unchanged): ≤ 32 splats (the baby figure
  included), ≤ 600 points in a stage's draw list, ≤ 6 strips, ≤ 24 marks, ≤ 8 DOM rings. Render adds ≤ 150 motes in
  the full tier and none in the low tier (the 900 that 16.5 allows is an upper bound this renderer never uses). There
  is no WebGL draw-call rule; `perf.draws` is redefined below.
  - Stage 1: 20 heads as splats and 20 tails in one `tails` strip (≤ 25 items), plus the `chevrons` and contact
    `ripples` strips and at most 3 `course` strips (the path, the warm tube, the cool loop): 6 strips. Marks: the 3
    glow walls, at most 2 wave bands, the meeting place, and the warm and cool mouths.
  - Stage 2: at most 24 sperm swimming or stuck at once (the wave sizes keep it there), plus your gold sperm: 25 tails
    and 25 head splats, with the egg in at most 4 splats. Held rivals are dim points in the corona's 220 points.
    Strips: `cilia` (opening), `tails`, two `arc` strips (the guard arc, the seal wave) and `ripples`. DOM rings: her
    ring, plus up to 7 burrow rings (the stuck sperm with the most progress), or up to 6 while a target ring shows
    (the follicle taps and the seal): at most 8.
- Base size: phones 1.0 × CSS px (DPR ignored); desktop capped at 0.6 MP. The **scale step** multiplies the base
  width and the base height (per axis, so 0.5 draws a quarter of the pixels): steps [1, 0.8, 0.66, 0.5, 0.4, 0.35].
  `?res=` pins the step.
- **Two tiers.** The *full* tier draws 14.1 as written. The *low* tier draws the same sheets and the same draw list
  with no grain, one flat shadow per sheet (one offset fill, no strokes), no motes, no dapple sheet, 2-disc paper glows
  and plain tails. The low tier replaces the WebGL plan's 2D fallback, and it must still look like paper cut. `?q=low`
  pins the low tier and `?q=full` the full tier; `?gl=0` stays as an alias for `?q=low` (14.5).
- **Frame cost** (`perf.emaMs`, `perf.p95Ms`): the JS time of one frame, from the start of its fixed steps to the end
  of its draw calls, by `performance.now()`. A 2D canvas records its commands and rasterizes them later, so without
  `?probe` this covers the steps and the recording only (1.4 to 3.6 ms in the reference scenes, whatever the raster
  cost). Under `?probe=1` each frame ends with a 1 px `getImageData` of the main canvas, which waits for the raster, so
  the cost includes it. `emaMs` is an EMA with α = 0.1; `p95Ms` is the 95th percentile of the last 120 frames. Frames
  that bake are left out. **Never `willReadFrequently`**: on the main canvas, with GPU-backed bake canvases, it cost
  289 to 335 ms a frame in the reference measure.
- **Where it is measured**: headless Chromium with `--disable-gpu` (software raster, a stand-in for a phone that is
  short of GPU time), never the SwiftShader flags. With those flags a 2D canvas ran at 3 to 4 fps (rAF gaps of 257 to
  405 ms, also at 195 × 422) while its JS took 1.4 to 2.3 ms, so every real-time check broke, and a 1 px readback cost
  94 ms (`research/paper-cut/README.md`).
- **Budgets** (`perf.e2e.mjs`): under `?probe=1` at the pinned step (`?res=0.5` at 390 × 844 and 844 × 390,
  `?res=0.35` at 1440 × 900), over 120 frames after 3 s, in every stage: full tier `p95Ms` ≤ 16 ms, low tier
  (`?q=low`) `p95Ms` ≤ 10 ms. Taken in a run of its own, apart from the luminance checks.
- **What it takes.** The reference scenes, measured that way at 390 × 844: p95 32, 36 and 23 ms (race, guard, grow) at
  full size; 17.4, 16.9 and 8.6 ms at step 0.5; still 13.4 to 13.8 ms at step 0.35; 4 to 10 ms with grain off and flat
  shadows. The cost follows the number of shapes, not the pixels, so the scale step alone cannot bring stages 1 and 2
  under 16 ms. Baking can: the course tiles and the frames (14.1), plus two bakes the reference did not have, the
  race's warm, cool and lane sheets (inside the course tiles) and the guard's corona (its 220 points as atlas dots, one
  `drawImage` each, or one baked ring bitmap only if the stage moves them as one rigid ring, so the frame still shows
  the list's points); no grain on moving shapes under about 12 px; cheap shadows on every moving shape. Task 3.7 measures every stage in both tiers before tuning, and writes the numbers here.
- **The tier switch is the main lever.** A run starts in the full tier (unless `?q` pins it). If the rAF interval
  average stays above 20 ms for 60 frames while the step is 0.5 or lower, the renderer switches to the low tier for
  the rest of the run. It never switches back mid-run.
- **Adaptive steps** use the rAF interval only (the JS cost alone measures almost nothing): step down when the
  interval average is above 20 ms for 30 frames in a row; step up when it is below 18 ms for 120 frames. The order:
  step down to 0.5 (phones) or 0.35 (desktop); then the tier switch; then the lower steps. Bake frames and the first
  frame after a resize are left out of the counters.
- **The `perf` fields** (16.9; the names stay): `emaMs` and `p95Ms` as above; `scale` the step; `w`, `h`, `px` the
  backing store; `draws` the canvas `fill`, `stroke` and `drawImage` calls in the frame, counted in `perf.js` (its cap
  is measured in task 3.7 and written into section 17); `splats` the splats drawn; `points` the points drawn (atlas
  dots and motes); `fallback` true while the low tier is active.
- **`lum()`** (needs `?probe=1`): the frame's mean luminance, from the canvas drawn down to 32 × 32 on a small canvas
  and read back. Each call is a readback, so the flash and birth-light checks take it under `?test=1&probe=1`, one
  frame at a time through `__fb.step(1)` (under `?test=1` each step ends with one draw, 14.5), never every real-time
  frame.
- Never `ctx.filter`, `shadowBlur` or a per-frame full-screen gradient. A glow is stacked translucent discs.

### 14.4 The baby figure (`core/lib/figure.js`)

- `figure(pose, sizeU, gaDay) → Splat[]`, at most 14 splats: head, body, 4 limbs (2 capsules each, or 1 bud before
  week 8), a heart splat (vessel channel), the cord root. No face. Poses: curl, uncurl, stretchL, stretchR, startle,
  kick, fist, thumb, headDown, tuck, lift.
- The shape changes by gaDay: buds that grow from 2 mm to 10 mm (gaDay 36 to 49, the stage 4 grow moment, and on to
  week 8), limbs (from week 8), rounder body (from week 28).
- The renderer draws the splats of one figure as a few rounded paper pieces with one union outline and shadow (14.1).
  With no face the pieces read as a round head, a curled bean of a body and buds or short folded limbs.
- In the ending the small shape is a plain paper oval: one capsule splat, or overlapping splats whose union is a plain
  oval, with no limbs and no head-and-shoulders outline, beside a bigger plain oval. Its warmth rises as a paper glow;
  its hue stays in the warm range (no blue, no grey).

### 14.5 How section 16 reads for the paper renderer

Section 16 is frozen and wave 0 is building against it, so this change does not edit it. Until the contract owner
updates its wording (task 3.1), these lines of section 16 read as follows. The draw list of 16.5 itself does not
change.

- **16.1** `render/`: `gl.js`, `field.js`, `composite.js`, `overlay.js` and `flat.js` are not written. In their place:
  `paper.js`, `bake.js`, `items.js` and `low.js` (14.1), beside `renderer.js`, `camera.js`, `perf.js`, `palette.js`,
  `rings.js`, `debug.js` and `strips/` (with `strips/course.js` added). The QA list gains `paper.test.mjs` (18).
- **16.2** `createRenderer(canvas, { gl = true, res, probe, motion })`: the option keeps its name. `gl: true` means the
  full paper tier and `gl: false` the low tier. `perf` keeps its fields, with the meanings of 14.3. `lum()` is as 14.3.
- **16.5** "Both the WebGL path and the 2D fallback draw only this list" reads "both tiers draw only this list".
- **16.9** `perf` as 14.3; `motion.warpAmp` is the sway in px (14.1); `lum()` needs `?probe=1`.
- **16.10** `?gl=0` is an alias for `?q=low`; `?q=low|full` pins the tier; `?probe=1` ends each frame with a 1 px
  readback and turns on `lum()` (no `gl.finish()`). Under `?test=1`, every `__fb.step(n)` ends with one draw.
- **16.12** `render/palette.js`: the contract owner lands the paper table of 13.2 now, in place of the Warm Lantern
  table. The renderer agent still does not edit the tokens; it asks the contract owner for any change it finds while
  tuning (task 3.8).

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

The gaDay column gives `gaDay`, or `gaDay` to `gaEnd` for a span. "(f)" marks `fertilized: true` at gaDay 14. In stage 2
only the facts shown once the nuclei touch (`egg.pronuclei`, `egg.place`, `egg.weeks`) are (f), so every caption's label
matches the HUD, which reads "Week 2" until then.

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
| `swim.hyper` | 14 | "Ready sperm swim harder. It helps a sperm push through to the egg." | PMID 16272225 (A) |
| `swim.wait` | 14 | "Sperm can stay alive in the body for up to five days." | CC sperm (R) |
| `swim.frame` (result only) | 14 | "In the game you race. In life, a sperm must be ready at the right time and place." | PMID 16607290 (A); PMID 7479932 (A) |
| `egg.surge` | 14 | "A surge of a hormone called LH releases the egg." | CC 23439 ovulation (R) |
| `egg.fimbriae` | 14 | "Finger-like ends of the tube move close and catch the egg." | CC 24346 fimbriae (R) |
| `egg.cilia` | 14 | "The egg cannot swim. Tiny hairs called cilia sweep it into the tube." | embryology.ch migration (R); CC 24346 (R) |
| `egg.zona` | 14 | "A clear shell called the zona pellucida protects the egg." | CC 22889 blastocyst (R); TTUHSC (R) |
| `egg.corona` | 14 | "A cloud of cells surrounds the egg. Sperm pass through the corona to reach the shell." | PMID 21412339 (A); TTUHSC (R) |
| `egg.size` | 14 | "The egg is about 0.1 mm across, about two sperm lengths." | BioNumbers 111184 (R); PMID 22848657 (A) |
| `egg.signal` | 14 | "Cells around the egg release a signal. It helps ready sperm find the egg." | PMID 21412339 (A) |
| `egg.stick` | 14 | "A sperm passes the corona and sticks to the shell. Then it works its way through." | TTUHSC (R) |
| `egg.choice` | 14 | "In one study, the fluid around eggs drew some men's sperm more than others." | PMID 32517615 (A) |
| `egg.day` | 14 | "The egg can meet a sperm for about a day." | CC 23439 (R) |
| `egg.fuse` | 14 | "A sperm protein called Izumo1 meets an egg protein called Juno." | PMID 24739963 (A) |
| `egg.wave` | 14 | "A wave spreads through the egg from where the sperm entered." | TTUHSC (R) |
| `egg.seal` | 14 | "Tiny granules in the egg release enzymes. These change the shell and harden it." | TTUHSC (R) |
| `egg.block` | 14 | "Now no other sperm can stick to the shell or get through." | TTUHSC (R); PMID 24739963 (A) |
| `egg.pronuclei` | 14 (f) | "The two nuclei touch but stay apart. The two sets join at the first split." | PMID 33964210 (A) |
| `egg.place` | 14 (f) | "This usually happens in the wide outer part of the tube." | CC 11585 conception (R); PMID 16272225 (A) |
| `egg.weeks` | 14 (f) | "Midwives and doctors already call this week 2. Weeks count from the first day of the last period." | NHS week 4 (R); CC 7247 (R) |
| `egg.frame` (result only) | 14 | "In the game you guard your shell. In life, the shell changes only after one sperm joins." | TTUHSC (R); PMID 24739963 (A) |
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

New for the race and the guard (checked 2026-10-18): `egg.choice` is PMID 32517615, Fitzpatrick et al. 2020,
"Chemical signals from eggs facilitate cryptic female choice in humans", *Proc. R. Soc. B* 287: 20200805
(`https://doi.org/10.1098/rspb.2020.0805`; the abstract was re-read through Europe PMC, so access A). It tested
follicular fluid from different women on sperm from different men and found that each fluid drew some men's sperm
more than others. It says nothing about choosing among one man's sperm, so the game shows it only as a general fact
in the guard (6.2). `egg.zona` uses CC 22889, which says "A clear outer protective layer called the zona pellucida"
(R). `egg.corona` uses PMID 21412339 (Lishko et al. 2011, "Progesterone activates the principal Ca2+ channel of
human sperm"), whose abstract names "the cumulus cells that encircle the egg" (A), and the TTUHSC page, where the
sperm penetrates "the egg's corona radiata" and, once inside it, binds to the egg's coat (R). `egg.stick`,
`egg.wave`, `egg.seal` and `egg.block` use the TTUHSC page, re-read for the corona, the sperm binding to the egg's
coat, the wave of Ca++ that "spreads through the egg" from the point of sperm entry, the cortical granules, whose
enzymes "break down the ZP3 receptors in the zona pellucida and also further harden the coat", and the granule
polysaccharides that "form a physical barrier to sperm penetration" (R). `swim.hyper` uses PMID 16272225, whose
abstract says hyperactivated motility helps sperm push through mucus, the cumulus and the zona (A). All of these are
already in `research/research-biology.md` section 12, so the allow-list holds them.

Full notes, with every fact's access tag: `research/research-biology.md` and `research/research-art.md` in this change
folder. The benchmark pages named in `research/research-art.md` A0 stayed in the design session's scratchpad; A0 records their
numbers.

### 15.4 Words

- **Banned** in every shown string (case-insensitive, word start): die, dies, died, dying, dead, death, kill…, lose,
  loses, losing, lost, loser, fail…, miscarr…, abort…, sex…, pain…, hurt…, danger…, sick…, viab…, prematur…, NICU,
  invad…, invas…, attack…, destroy…, defeat…, conquer…, enem…, fight…, battle….
- **The race and the guard** use gentle words: race, place, bump, rest, bounce, drift off, guard your shell, "Only one
  may enter", "Let it in". No stage 1 or stage 2 string contains "fastest" or "winner", the whole words win, wins or
  won, or the phrases "beat the" or "beats the" (one sperm beating others). The phrases match only at a word start,
  so heartbeat lines such as "Tap with the heartbeat." pass.
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
    strips/  tails.js  cilia.js  tree.js  cord.js  chevrons.js  ripples.js  arc.js
  ui/
    input.js  hud.js  captions.js  screens.js  sound.js  store.js   (hud, captions, screens, sound: wave-0 stubs)
public/arcade/key/first-breath.svg

qa/first-breath/
  purity.test.mjs  clock.test.mjs  beat.test.mjs  judge.test.mjs  track.test.mjs  draw.test.mjs  run.test.mjs
  save.test.mjs  facts.test.mjs  text.test.mjs  palette.test.mjs  perf.test.mjs  sim.test.mjs
  stage-swim.test.mjs  stage-egg.test.mjs  stage-split.test.mjs  stage-root.test.mjs
  stage-grow.test.mjs  stage-answer.test.mjs  stage-turn.test.mjs  stage-birth.test.mjs  ending.test.mjs
  bot.mjs  race-sim.mjs
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
//   → { setLive(gesture, keys = "steer") /* keys: "steer" | "turn"; a new hold needs a fresh press (5.3) */,
//       intents(tStepEnd) /* drains events up to tStepEnd, in core seconds */,
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
export function createHud(root)  // → { set({ stageName, clock, score, prompt, scale, place /* "3rd of 20" | null */ }), dispose() }
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
  dir: null,                // "up"|"down"|"left"|"right" (screen axes) once a drag passes 12 px, or from the arrow key
  turn: 0,                  // −1 | 0 | 1 from the left/right arrows or A/D (anticlockwise | none | clockwise, as seen);
                            //   +1 decreases the world angle (radians, counterclockwise from world +x)
  aim: null                 // { x, y } world point of a mouse over the page with no button down, set only after it
                            //   moves > 4 px and cleared by any steer or turn key (5.3); null for touch and pen
}
```

- **Turn and aim** are read only by the stage 2 guard (6.2). Its arc takes, in order: `turn` when it is not 0; else
  `aim` when it is set; else the angle of `steer` when |steer| ≥ 0.25; else it stays still. A mouse drag with the left
  button is a stick, as everywhere, so `aim` is null while a button is down. In the guard the prompt carries
  `keys: "turn"`, so the keys set only `turn` (W, S and the up and down arrows do nothing) and `steer` comes only from
  a pointer drag.

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
  id, index, name, verb,              // "swim", 0, "The Race", "Race"
  orient,                             // "long" | "fit"
  families,                           // from "steer" | "tap" | "hold" | "rotate"; at most 2 (egg: ["tap", "rotate", "hold"], 1.2)
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
export function prompt(state)                // → { gesture: "drag"|"tap"|"hold"|"dragHold"|"none", text: stringId,
                                             //     keys: "steer"|"turn" }  (keys defaults to "steer"; "turn" only in the guard)
export function targets(state, horizonS)     // → upcoming timed targets [{ id, t, P, kind, heart, group }]
export function botSteer(state, skill, r)    // → { steer: {x, y}, dir, hold: bool }; every stage exports it
                                             //   (a tap-only stage returns { steer: {x: 0, y: 0}, dir: null, hold: false });
                                             //   r is the caller's stream with a plain `r.mem = {}` attached: any lag or
                                             //   noise memory lives there (the stage keeps each rival's own r in its state)
export function probe(state)                 // → swim: the race shape; egg: the guard shape; every other stage: null
                                             //   (16.9), plain data in world units; pure, like view()
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
  const a = mod.botSteer(state, 1, rOne);              // rOne = stream(stageSeed, "oneButton"); rOne.mem = {}
  intents.steer = intents.touching ? a.steer : { x: 0, y: 0 };
  intents.dir = a.dir;
  intents.turn = 0;                                    // the stage 2 arc tracks only through steer
  intents.aim = null;
}
```

At its cap a stage ends: `swim` with `goalMet: false`; every other stage completes its goal by itself and ends with
`goalMet: true`. `swim` also ends with `goalMet: false` when you reach the meeting place outside the top 3. Its
`result().metrics` carries `place` and `of` (20), and `capped` (true when the 117 s cap ended it). After Go on at the
cap, the run calls `swim.jump(state, "carried")`: 3 s with input `none`; after a finish outside the top 3 it goes
straight on. Then `result()` is `{ done: true, goalMet: false }` with `score.goal` 0.

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
  strips: [ { kind: "tails",    items: [{ x, y, ang, len, phase, hue, ring }] }      // ≤ 25 items; ring: null|"halo"|"dashed"
          | { kind: "cilia",    a: [x, y], b: [x, y], count, phase, amp }
          | { kind: "tree",     nodes: Float32Array /* x, y, parent, width */, version, pulse }
          | { kind: "cord",     pts: [x, y, …] /* ≤ 16 points */, lights: [s0, …] /* 0..1 along it */ }
          | { kind: "chevrons", pts: [x, y, …], w, phase }
          | { kind: "ripples",  items: [{ x, y, r, a, dashed }] }                   // also the contact rings
          | { kind: "arc",      x, y, r, a0, a1, w, glow }                         // the guard arc, the seal wave;
                                                                                   //   a0, a1 in radians, world space
          | { kind: "course",   pts: [x, y, …] /* ≤ 32 points, centre line */, w: [w0, …] /* width per point */,
              tone: "womb"|"warm"|"cool" } ],                                      // stage 1 path, tubes, loop; ≤ 6 strips
  marks: [{ kind: "pool"|"lake"|"meet"|"band"|"warm"|"cool"|"glowwall"|"spot"|"glow"|"hand"|"arrow"|"light", x, y, r,
            w /* band and meet only: thickness along ang */, rim: "solid"|"dotted"|"wavy", on, pulse, ang }],  // ≤ 24
            // band: a soft bar centred at (x, y), r = half its length across, w = its thickness (stage 1 waves);
            // meet: the meeting place, drawn the same way
  rings: [{ id, kind: "mother"|"you"|"approach"|"hold"|"breath"|"wave"|"prompt"|"rest"|"burrow",
            x, y, r, progress, dashed, dotted, grade }],                             // ≤ 8, drawn in DOM SVG
  anchor: { x, y },                                // the subject (thumb-zone check): you in stage 1, the egg's centre in stage 2
  cue: { x, y } | null                             // the thing the player needs now (the brightness check)
}
```

`core/draw.js` exports `LIMITS` and `validate(list)`. `draw.test.mjs` validates every 30th view of each stage's ref and
idle runs. Both the WebGL path and the 2D fallback draw only this list. (A `zoomAnchor` comes back with the deferred
zoom.) A stage sends only the visible part of its course, at most 32 points per `course` strip. The stage 1 camera
span is 170 u in the womb and 150 u from the gate on; the stage 2 span is 140 u (6.1, 6.2).

### 16.6 Events

Each event is `{ name, t, ...data }` pushed by `emit(state, name, data)`; `t` is in stage seconds.

| Name | Data | Host use |
|---|---|---|
| `moment` | `{ id }` | test hook, captions |
| `prompt` | `{ gesture, text, keys }` | `input.setLive(gesture, keys)`, HUD prompt line |
| `subgoal` | `{ id, text, state: "shown"|"done"|"auto" }` | caption and confirm chime |
| `judge` | `{ target, grade: "in"|"close"|"off"|"miss", errMs, rawMs, heart }` | ring feedback, the Tap test |
| `points` | `{ part, add }` | HUD score tick |
| `fact` | `{ id }` | card, caption or overlay line; the "What was real" list |
| `caption` | `{ id, dir }` | captions |
| `sfx` | `{ id, at, pitch, gain }` | sound |
| `milestone` | `{ id: "ready"|"fertilized"|"implanted"|"heart"|"fetus"|"hearing"|"eyes"|"headDown"|"born"|"breath" }` | sound scene changes, tests |
| `song` | `{ notes, lit }` | sound (the hum) |
| `place` | `{ place, of }` | HUD place slot (stage 1); the place pluck. Emitted only after a new place has held for 0.25 s (6.1). |
| `bump` | `{ a, b, x, y }` (sperm ids, `"you"` for you; the contact point in world u) | sound (softer when it is not you), contact ring, tests |
| `fork` | `{ tube: "warm"|"cool" }` | captions, tests |
| `arrive` | `{ id, place }` | tests (each sperm that reaches the meeting place) |
| `bounce` | `{ id, angle, wave }` (`wave`: 1 to 8) | sound (a step higher per wave), contact ring, guard credit, tests |
| `stick` | `{ id, angle, gold, wave }` (`wave`: 1 to 8, null for the gold) | sound, burrow ring, `egg.stick` on the gold's, tests |
| `loose` | `{ id }` | sound, tests |
| `held` | `{ id }` | tests (a rival held in the cloud; it never enters) |
| `goldIn` | `{ angle }` | sound, caption, tests (your gold sperm comes in, once per stage 2) |
| `nudge` | `{ n }` | tests (the arc nudged your sperm) |
| `enter` | `{ angle }` | sound, the seal wave's start, tests (once per stage 2) |
| `seal` | `{ grade, auto }` | sound, tests |
| `done` | `{}` | run |

### 16.7 Carry

`core/carry.js` exports `DEFAULT_CARRY = { sparks: 0, sperm: { hue: 0.11, place: 3, glow: 0.5 }, nestleX: 0, treeSeed:
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
- **Go on** after the cap calls `swim.jump(state, "carried")` and plays its 3 s before the overlay; after a finish
  outside the top 3 it goes straight to the overlay.
- **Timers**: overlay 2.5 s (linger holds it); card skippable from 1.0 s, gone at 3.5 s; crossfade 0.8 s under the
  card.
- `run.ms` counts core time in stages, overlays and cards, not in pause or the ending.
- At each card the run emits the next stage's carry-in, which the host stores with `recordCarryIn` (for practice).

### 16.9 Test hook `window.__fb`

Every time the hook takes or returns is in stage seconds.

| Member | Does |
|---|---|
| `state()` | `{ screen, stage, stageId, moment, t, gaDay, label, fertilized, score, runScore, grade, prompt, subgoals, paused, seed, settings, anchor /* screen px */, cue /* screen px */, ms, place /* stage 1: "3rd of 20", else null */ }` |
| `goto(stage, { seed, carry, assist, oneButton })` | jump into stage 1 to 8 (index or id) or `"ending"`, skipping the card |
| `jump(moment)` | jump to a named moment of the current stage |
| `realtime(on)` | stop or restart the rAF clock |
| `step(n, intents?)` | advance n fixed steps, with optional intents in stage seconds (else the held ones) |
| `input(partialIntents)` | set held intents (`steer`, `touching`, `dir`, `turn`, `aim`) |
| `tap({ errMs = 0 })`, `press()`, `release()` | inject a timed event at the next target's `t` ± errMs (stage time), or now |
| `nextTarget()` | `{ t, P, kind, heart, id }` or null |
| `bot(skill \| false)` | let the shared bot drive (also the attract mode) |
| `finish()` | end the current stage with its points so far |
| `retry()`, `skip()`, `act(name)` | the run's actions |
| `result()` | the current stage result, or the run summary |
| `targets()` | bounding boxes of every interactive DOM element, and the subject's and the cue's screen positions |
| `facts()` | fact ids shown this run |
| `race()` | stage 1: `swim.probe(state)`, `{ place, placeNow, of, you: { progress, x, y, ready }, rivals: [{ id, skill, progress, x, y, state: "swim"|"rest"|"arrived", tube: "warm"|"cool"|null, ready }] }`, with `main.js` adding a `screen` point in px beside each world point; else null |
| `guard()` | stage 2: `egg.probe(state)`, `{ arc: { angle, half }, egg: { x, y, r }, sperm: [{ id, state: "in"|"stuck"|"bounce"|"loose"|"held", angle, r, progress, x, y }], gold: { state, angle, r, nudges, x, y } | null, entered }` (angles in radians, world space), with `main.js` adding `screen` points in px and the arc's screen angle; else null |
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
the time, total, grade, accuracy and goal, and in stage 1 the place. When the Almost card shows (a finish outside the
top 3, or the cap), the bot's `choose("almost")` picks Go on. In stage 2 the bot steers the arc with `egg.botSteer`,
presses for the seal after its prompt (a fresh press, 5.3) and releases at the target's `t` + gauss·σ.

### 16.12 Ownership (who may edit what)

| Wave | Owner | Files |
|---|---|---|
| 0 | contract | everything in `core/` except the stage bodies; `core/stages/index.js` with 8 stub stages (each a timer that completes with `goalMet: true`, except the `swim` stub, which ends at its cap; each exports `probe`, which returns null); `main.js`, **fully wired** to every module through the frozen signatures; no-op stubs of `render/renderer.js` (drawing with `debug.js`), `ui/hud.js`, `ui/captions.js`, `ui/screens.js` and `ui/sound.js`; `ui/input.js`; `ui/store.js`; `render/debug.js`, `render/camera.js`, `render/palette.js`; skeletons of `index.html` and `style.css`; the wave-0 tests; `qa/first-breath/race-sim.mjs` (the numeric race sim of 6.1, before the `swim` builder starts) |
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
| Where browser checks run | every Canvas 2D browser check below runs headless Chromium with `--disable-gpu` and no SwiftShader flags (14.3) | all `*.e2e.mjs`, `shots.mjs` |
| Frame cost | `?probe=1`, `?res=0.5` at 390 × 844 and 844 × 390, `?res=0.35` at 1440 × 900 (its base is already capped at 0.6 MP), every stage via `goto`, after 3 s, over the next 120 frames, in a run with no `lum()` calls: full tier `perf.p95Ms ≤ 16`; with `?q=low`, `perf.p95Ms ≤ 10` | `perf.e2e.mjs` |
| Adaptive scale and the tier switch | no `?res`, no `?q`, after 6 s: settled step ≥ 0.5 in portrait and landscape, ≥ 0.35 on desktop (per axis); the step and the tier move only on the rAF interval (14.3); once `perf.fallback` is true it stays true for the run | `perf.e2e.mjs` |
| Draw budget | `perf.splats ≤ 32`, `perf.points ≤ 750` (600 from the stage, 150 motes), `perf.draws` ≤ the cap that task 3.7 measures and writes here; node: every 30th view validates against `LIMITS` (≤ 600 points from the stage) | `perf.e2e.mjs`, `draw.test.mjs` |
| Core CPU | node, each stage's ref run: p99 of `step` ≤ 1 ms; the full bot suite (20 seeds × 4 skills) ≤ 120 s wall time | `perf.test.mjs`, `sim.test.mjs` |
| The low tier | `?q=low` (and `?gl=0`, its alias) in **every** stage: mean luminance > 0.04, and the subject's sheet (the luminance at `targets().anchor`) brighter than the frame's median | `smoke.e2e.mjs` |
| A paper cell | palette: stage 3's cells ≥ 3:1 against its back and redder (R / (G + B)); frame `?seed=1&freeze=1&stage=3`: the brightest ring within 8 px of a cell's edge is its pale cut edge, and the pixels just below and right of the cell (its shadow) are darker than the back sheet | `palette.test.mjs`, `visual.e2e.mjs` |
| Stable cuts | node: a `course` edge cut from two overlapping windows gives the same offsets where they overlap; a list of tails or splats in another order gives the same outlines; no cut takes an index | `paper.test.mjs` |
| The canvas draws no text | an init script spies on `CanvasRenderingContext2D.prototype.fillText` and `strokeText`: no call in any stage, screen or tier; the place slot, prompt, captions and tags are DOM boxes | `visual.e2e.mjs` |
| Non-black stages | `?freeze=1` per stage: mean luminance > 0.04 | `visual.e2e.mjs` |
| The brightest cue | `?freeze=1` per stage, a page screenshot (DOM rings included): the luminance at `targets().cue` is at or above the frame's 95th percentile | `visual.e2e.mjs` |
| Light rises | frozen frames of stages 1 to 7 at 390 × 844: each mean luminance ≥ 0.9 × the one before, and stage 7 ≥ 2 × stage 1 | `visual.e2e.mjs` |
| Flash rule | `?test=1&probe=1`, 300 frames (5 s) in stages 4, 5, 6 and 8, each `__fb.step(1)` then `lum()`: at most 3 swings of ≥ 10% in any 60-frame window | `visual.e2e.mjs` |
| Birth light | `?test=1&probe=1`, stepped one frame at a time through the 3.5 s light: luminance non-decreasing (1% tolerance), and ≥ 0.95 at its end, where the white sheet is `#ffffff` at alpha 1 with the grain faded to 0 | `visual.e2e.mjs` |
| The birth opening | stage 8, the first frame of `light` and a frame 1 s in, both tiers: the brightest region (the top 5% of luminance) touches the bottom edge across ≥ 90% of the width, and no closed ring of sheet edges surrounds it: a flood fill over the top 10% of luminance, from the brightest pixel, reaches the bottom row, and the renderer's stage 8 frames are side flats that touch only the left or the right screen edge | `visual.e2e.mjs` |
| Ending warmth | a frozen ending frame: mean R > G > B; palette test: every chromatic ending token has a hue of 0° to 50° (achromatic tokens skipped) | `visual.e2e.mjs`, `palette.test.mjs` |
| Reduced motion | `?rm=1` (and emulated media): `motion.warpAmp ≤ 0.5 ×` the full value; `bounce = 0`; the stage change is the same 0.8 s crossfade | `visual.e2e.mjs` |
| Colour contrast | the rules of 13.2, normal and protan, deutan and tritan (Machado 2009): each cue against its keyline; each sticker or keyline cue's outer layers, and each plain cue, against every `under` token; you over the rivals ≥ 2.25:1; the pair rules | `palette.test.mjs` |
| Thumb reach | at 390 × 844, `targets().anchor.y ≤ 0.60 × 844` in every stage | `layout.e2e.mjs` |
| The race HUD | stage 1 at 390 × 844 and 844 × 390 (touch) and 1440 × 900, with `?inset=47,0,34,0`: the place slot reads "Nth of 20" and matches `__fb.race().place` once a change has held for 0.25 s after a bump changes the order; it sits under the score at the top right, inside the safe area, above 60% of the height in portrait, and overlaps no HUD, prompt or caption box | `layout.e2e.mjs` |
| The fork in view | stage 1 at the three layouts with `?inset=47,0,34,0`, the ref bot driving: both branch mouths are on screen and under no HUD or prompt box at least 1.5 s before your head reaches the split (1,330 u); in portrait every stage 1 caption is one line and gone within 2.5 s | `layout.e2e.mjs` |
| The egg and its arc | stage 2 at the same three layouts: the egg's centre is the layout's subject point (45% of the height in portrait; 38% of the width and 55% of the height in landscape; 40% of the width and half the height on desktop); at a span of 140 u; in a guard frame with stuck sperm and your sperm coming in (`?seed=1&moment=guard`, stepped to 33 s, when your sperm burrows at the shell), every stuck or held sperm and your sperm within 28 u are inside the safe area and under no HUD, prompt or caption box; in portrait the captions sit at 18 to 26% of the height, and in landscape they are one line; the arc is the brightest band (the brightest-cue row) | `layout.e2e.mjs`, `visual.e2e.mjs` |
| The gold's path in portrait | stage 2 at 390 × 844 over 20 seeds and places 1, 3 and 20, idle and with the ref bot: from `goldIn` to `enter`, your sperm's screen point is never inside a caption box and never below 60% of the height | `layout.e2e.mjs` |
| The arc follows the input | a touch drag turns the arc to the drag's screen angle within 10° in portrait and landscape; on desktop the arc faces the mouse within 10° once it moves more than 4 px, the right arrow turns it clockwise as seen at 540°/s, W, S and the up and down arrows leave it still, and with the cursor parked over the page a turn with D and its release leave the arc where D left it | `input.e2e.mjs` |
| A hold needs a fresh press | stage 2 at 390 × 844 with the thumb held down from the guard drag through `enter`, and at 1440 × 900 in one-button mode with Space held from the guard: lifting after the seal prompt seals nothing; a new press and release does | `input.e2e.mjs` |
| Layout | no horizontal scroll; HUD, prompt and captions inside the safe area with `?inset=47,0,34,0`; no overlap between HUD, prompt, captions and pause; captions inside 50 to 58% of the height in portrait (18 to 26% in stage 2); during play, no HUD, caption or overlay text below 60% of the height in portrait; the scale bar top left under the clock in portrait; every target ≥ 44 px on the shorter side; every screen fits | `layout.e2e.mjs` |
| Muted cues | sound muted with M, stages 2 and 6: every target has a DOM ring in `svg#rings` at least its preview time (max(2 beats, 1.2 s)) before its `t` | `input.e2e.mjs` |
| Sound | OfflineAudioContext, 6 s per scene: ≥ 90% of energy below 500 Hz before birth; > 20 dB more energy above 2 kHz after the opening than before; envelope peaks match the beat times within 5 ms; a second peak train from the stage 4 hinge; with `latencyS: 0.04`, each beat scheduled 40 ms early; across a card and a stage start, her peaks keep an even spacing with no extra or missing beat | `sound.e2e.mjs` |
| First 10 seconds | Play → `prompt` by 0.5 s and steering live by 0.5 s (stage 1); `goto(2)` → first target by 2.7 s, and the guard's prompt by 9.0 s | `smoke.e2e.mjs` |
| Screenshots | every stage at the three layouts, in both tiers; a 1 s strip of stage 1 at `?res=0.5` (10 frames) to review the sway for stepping by eye; the homepage at 390 × 844, 320 × 568 and 1280 × 720 for the PR | `shots.mjs`; `qa/arcade/machines.mjs` part `firstbreath` with `SHOTS` |
| The homepage machine | at 390 × 844, 320 × 568 and 1280 × 720: the last cabinet in `#action` is First Breath, inside the window and not under the sign or the tray; `.slot`, `.start`, `#prevBtn`, `#nextBtn`, `.section-nav button` and `.all-games` ≥ 44 px on the shorter side; START goes to `/first-breath/`; the other groups' members unchanged | `qa/arcade/machines.mjs` part `firstbreath` |

## 18. QA files

| File | Asserts |
|---|---|
| `purity.test.mjs` | `core/` has no `document`, `window`, `Date`, `performance`, `Math.random`, `setTimeout`, `requestAnimationFrame`, `localStorage`; stage files import no other stage, nor `render/`, `ui/` or `main.js`; every stage and stub exports `probe`, and calling `view` or `probe` twice gives equal results and leaves the state unchanged |
| `clock.test.mjs` | the label and range check values (section 4); `week = floor((14 + N) / 7)` for N = 0..30; every label that starts with "Day" says "after fertilization"; "fetus" strings only from gaDay 70; cards at 98 and 196; no "cycle day" in any string; `gaAt` and `mmPerShortAxis` against the 4.1 table |
| `beat.test.mjs` | `clock.bpmYou`: 110 at 36 and 42, 170 at 63 and 70, 150 at 98, 140 at 140 to 196, 130 at 280; `makeBeats`: `first` places her first beat; jitter seeded and 0 in tracks |
| `judge.test.mjs` | windows at P = 0.5, 0.706, 0.833 s; Assist and the 0.4 P cap; free taps; Off changes nothing; a press 160 ms late that arrives a step late is Close, not a miss (the 50 ms grace); two targets 0.5 s apart judged on their own sub-step times; `median` |
| `track.test.mjs` | spacing ≥ 0.5 s; every target carries `P`; preview ≥ max(2 beats, 1.2 s); `errMs` and `rawMs` differ by the offset |
| `draw.test.mjs` | every view within `LIMITS` |
| `stage-<id>.test.mjs` | same seed and intents give the same result; the scripted ideal input reaches Glowing; idle ends by the cap (`swim` with `goalMet: false`, others `true`); one live gesture per moment; at most 2 families (3 for `egg`); every subgoal ends `done` or `auto`; meta.moments match the 4.1 table; stage-specific checks (pools turn red only from gaDay 84; no phrase before gaDay 133; the turn happens by itself at 30 s; the rest is not judged) |
| `stage-swim.test.mjs` (race checks) | over 20 seeds: the same seed and input give the same rival positions at every step; `placeNow` is 1 + the number of sperm ahead at every step, arrivals rank by time, and the shown place and `place` events change only after a new place has held for 0.25 s; two swimming sperm that overlap are pushed apart every step, each keeps 0.7 of its speed at most once per 0.4 s, and the top speed is back to ×1 after 0.6 s; sperm that are not swimming (stick < 0.25 and speed < 15 u/s, or attached) are never bumped; the cool loop brings any sperm back to the fork at 1,300 u within 6 s, also with no input, with `moment` `fork` all the while; the waves never lift an idle sperm, and every bot uses each wave's shared threshold; at full stick the lane centre gives ≥ 70 u/s and a wall ≤ 65 u/s; letting go inside a glow attaches the sperm (speed 0, no drift) and makes it ready on her 4th beat, and stick ≥ 0.25 detaches it; ready multiplies only the stick term, by 1.6; among the rivals only the two front-runners become ready; a rival in the tube 500 u or more behind you rests; the ref bot is 1st in ≥ 18 seeds and arrives at 44 to 54 s; the mid bot (0.7) is in the top 3 in ≥ 18 seeds with a mean arrival of 55 to 65 s; idle never passes the gate, and the stage ends at 117 s with `goalMet: false` and place 20; a finish outside the top 3 ends with `goalMet: false`; with `meet` or `carried` the stage never runs past 120 s; `botSteer` keeps its memory only in `r.mem`; `probe` returns the race shape of 16.9 in world units; no event or string names harm |
| `stage-egg.test.mjs` (guard checks) | the surge before any target; the first payoff by 4.5 s; the opening ends by 8.9 s for any input; the arc is over a sperm when the angle is within its half-width and the head within 22 u, checked every step, also when the arc sweeps onto a sperm: a swimming rival bounces, a stuck rival pops loose, the gold is nudged, and held and drifting sperm are left alone; a rival that finishes burrowing is held and never enters; exactly one `enter` event, for your sperm, for every input: none, the ref bot, random drags, and the arc held on your sperm the whole time; `goldIn` at 27.0, 27.6 and 32.7 s into `guard` for places 1, 3 and 20; over 20 seeds with no input, and with the arc parked at every 5°, a gold angle is always found, never within 45° of world −y or 40° of world +y; at most 3 nudges; it enters by 52 s into `guard`; the seal counts only a press after its prompt (a release with no such press is ignored), gives a Flourish of 1,000 for In time, 500 for Close and 0 otherwise, and seals by itself on her 6th counted beat, also with a hold still down; every other sperm drifts off after the seal; the guard credit leaves out rivals still swimming in or burrowing at entry, and an idle guard earns no clean-entry bonus; the ref bot makes 0 nudges over 20 seeds; a bot that aims only through `turn` ±1 at 540°/s reaches Great in ≥ 18 of 20 seeds, with a mean guard credit within 0.15 of the ref bot's; `botSteer` keeps its memory only in `r.mem`; `probe` returns the guard shape of 16.9 in world units |
| `ending.test.mjs` | the breath comes by itself 3.0 s after the prompt; no `points` event; results only after skin-to-skin; her beats are silent only in the first 1.5 s |
| `run.test.mjs` | the stage order; Try again recreates the stage at once and leaves earlier scores and carry unchanged; better attempt kept; Go on (`jump("carried")`) gives no Goal and no grade word; `goto` of every stage works with `DEFAULT_CARRY`; no overlay after Birth; a press at `stageStart + target.t` (core time) is graded In time; gaDay and `mmPerShortAxis` never decrease across a whole run (only a stage 1 retry restarts stage 1); her beats run on across overlays and cards with no gap and no jump; one-button sets steer and dir from `botSteer` in every stage, and clears `turn` and `aim`; families per stage; stage 1's `sperm.place` reaches stage 2 and sets when your sperm comes in; exactly one sperm enters in a whole run |
| `save.test.mjs` | broken JSON, old versions, blocked storage; best only improves; tie → faster; `carryIn` per stage; `cabinetLine` cases (BEST, plain) |
| `facts.test.mjs` | every fact has a gaDay, a computed label, allow-listed sources, access R or A; no S; `checked: false` facts are not shown; no text starts with "Week" or "Day"; spans never cross gaDay 42; size comparisons say "the NHS says" or "The NHS compares this to"; trimester cards say "about" |
| `text.test.mjs` | the banned words and pronouns (section 15.4, including invad…, invas…, attack…, destroy…, defeat…, conquer…, enem…, fight… and battle…) across all strings × all 4 carer words; no "fastest" or "winner", no whole word win, wins or won, and no "beat the" or "beats the" in stage 1 and 2 strings; sentence length; no "Apgar" outside `end.apgar` and Sources |
| `palette.test.mjs` | the contrast rules of 13.2 (keyline, `under`, you over the rivals, the pairs); chromatic ending hues 0° to 50°; stage 5 pools at L ≥ 0.25; no rule on the back tokens rising (the frame means do that, in `visual.e2e.mjs`) |
| `paper.test.mjs` | `render/paper.js` in node with a stub context: cut offsets come from world position only (two overlapping course windows give the same edge where they overlap); moving items' outlines do not depend on their order; the shadow offset is (0.42 h, h) in screen space for both orients |
| `perf.test.mjs` | p99 step ≤ 1 ms per stage |
| `sim.test.mjs` | 20 seeds × skills 1.0, 0.7, 0.5 and 0: skill 1.0 mean ≥ 8,500 per stage; skill 0.5 reaches the goal in ≥ 90% of runs in stages 2 to 8 (stage 1 is a race: skill 0.7 is in the top 3 in ≥ 90% of runs, and skill 0.5 may get the Almost card and Go on); skill 0.7 runs take 8 to 12 min of game time; skill 0 never throws and every stage ends by its cap; under 120 s wall |
| `bot.mjs` | CLI report |
| `race-sim.mjs` (wave 0) | a stand-alone numeric model of the 6.1 race (the course, waves with shared thresholds, the current, lane, upstream bonus, glow rests, bumps, catch-up and the rival policy) that prints, over 20 seeds, the place distribution and arrival times of the ref, mid and idle players and every rival. The 6.1 numbers are frozen only when the ref is 1st and the mid bot in the top 3 in ≥ 18 of 20 seeds, with the mid's mean arrival at 55 to 65 s. |
| `smoke.e2e.mjs` | no console errors; Play to prompt by 0.5 s; every stage via `goto` steps 120 frames and draws; `?q=low` (and `?gl=0`) per stage; the bot reaches the run result |
| `layout.e2e.mjs` | section 17 layout rows at 390 × 844 and 844 × 390 (touch) and 1440 × 900; the thumb reach; the race HUD; the fork in view; the egg and its arc; the gold's path in portrait; the ending's thumb ring at bottom centre in portrait and in the corner of the last touch in landscape; a screenshot per stage and screen |
| `input.e2e.mjs` | touch stick steers in portrait and landscape; a second pointer is ignored; keys only on desktop; in a tap moment a press that drags is judged at touch-down; in a `dragHold` moment an arrow keydown is a press with its dir and Space alone is a plain hold; landscape touch in stages 1 (drag right swims forward), 2 (the arc follows the drag, and the seal by hold and release), 4 (drag right grows forward), 5 (a move drag), 7 (the turn) and 8 (directions on screen axes); stage 1 on desktop with a left-button mouse drag; the stage 2 arc on desktop (the mouse aims it after a 4 px move; the arrows and A/D turn it at 540°/s; W, S, up and down do nothing; a parked cursor never pulls it back after a turn key); a hold needs a fresh press at the seal (the thumb held from the guard, and one-button Space held from the guard); one-button mode clears stages 1 (top 3), 2 (the arc tracks while held), 4, 5, 7 and 8; hidden page pauses; M writes `arcade.sound`; muted rings |
| `perf.e2e.mjs`, `visual.e2e.mjs`, `sound.e2e.mjs` | section 17 (Chromium with `--disable-gpu`) |
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
| Frame time on phones and in headless checks | The paper renderer bakes every still sheet (frames, world-space course tiles, the tree, the dot atlas), gives moving shapes cheap shadows and no small grain, and switches to the low tier when the rAF interval stays slow; adaptive scale; budgets measured with a 1 px readback under `--disable-gpu`, never SwiftShader (14.3); perf checks per stage, tier and layout. |
| The look reads as anatomy | Cut shapes stay plain and abstract (13.1); stage 8 frames are straight side flats with no aperture, checked by a frame test; rose pools with no drops; no face and no limbs in the ending. |
| The race reads as the "fastest sperm wins" myth (`research/research-biology.md` 10) | No string says the fastest wins; the text test bans "fastest", "winner", win, wins, won and "beat the" in stages 1 and 2. Being ready is the race's best move and is scored. `swim.few` shows how few sperm reach the tubes, and `swim.frame` on the run result says what is real. |
| The guard reads as hostile | Gentle words only (15.4); rivals bounce, drift off and rest, and nobody is harmed; held rivals rest, still, in the cloud; the seal is the real biology; `egg.frame` says the guard is the game's; a human read of every string. |
| Scope: 8 stages in one PR | v1 is each stage's minimum form plus one or two flourishes; the heavy extras are deferred (19.2). The frozen contract, a fully wired wave-0 `main.js` with stubs, per-stage files, one shared judge and bot, and the cut list. |

### 19.1 Cut list

Cut from the top when late. Each stage keeps its floor (section 6).

1. Attract mode behind the title.
2. The dapple sheet (the `caustics` field, stages 6 and 7).
3. The hum in the stage 7 rest.
4. The stage 5 drag moves (the moves play by themselves).
5. The stage 8 direction prompts (plain hold waves).
6. The Tap test (keep the manual offset).

**Never cut:** the carer-word setting, captions, one-button mode, reduced motion, the flash rule, the facts gate, the
ending, the low tier and its per-stage check, the contact rings for bumps and bounces (the picture for those sounds,
section 12), and the arcade machine.

### 19.2 Deferred from v1

These are not built in this change, and the specs do not ask for them. Each can come back as its own change.

- Continue (a saved run that resumes at the last stage card).
- Density assist.
- Auto-drift of the timing offset (judge events keep `rawMs` for it).
- The log zoom with nested anchors between stages (v1 crossfades).
- The formant voice and the formant cry (v1 hums sine tones).
- Haptics.
- "Play your song" on the run result.
- The FURTHEST cabinet line.
- Stage 6: repeats of a missed phrase, the loud-sound jump, the hiccup animation.

The stage 1 fork with the cool tube, and the moving rivals, were on this list before. The user's race brings both
into v1 (section 6.1). "A 2D fallback that matches the Warm Lantern look" was on this list too; with paper cut there is
no WebGL path, and the low tier (14.3) is in v1. The Warm Lantern WebGL renderer is not deferred: paper cut replaced
it (1.2).
