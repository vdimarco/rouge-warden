# First Breath: action genres, design

Change `first-breath-action-genres`. It rebuilds the eight stages of First Breath as eight action genres on one
shared action layer. The plan this builds on is archived at `openspec/changes/archive/2026-10-19-add-first-breath/`
(its `design.md` is called "the v1 design" here). What this file does not change, the v1 design still sets: the one
clock (v1 section 4), the two hearts (5.1), the timing judge (5.2), the camera rules (5.6), the paper renderer (14),
the facts rules (15), the stage interface (16.4) and the run sequencer (16.8).

`contract.md` in this folder is written by the foundation builder. It defines the shared action layer
(`core/lib/action.js`, `core/lib/actionbot.js`), its draw items and the knock-out plumbing, and it specifies stage 5.
This file gives every other stage a design a builder can build in one go. **Where this file and `contract.md`
disagree on an API name or a default, `contract.md` wins. Where they disagree on a stage's numbers, this file wins**,
and the stage builder records the change in its tune file header.

Plain words and short sentences, as in v1. Every string a player sees follows v1 section 15.4.

## 0. Summary

| # | Stage | Genre | The loop in one line | Mid length | Boss or climax |
|---|---|---|---|---|---|
| 1 | The Race | Kart racing with battle royale knockouts, on the v1 race | The v1 pack, steering and waves, plus drift boosts through the bends, items, the slipstream, and gates that close behind the pack | 65 s | Gate 3 and the final straight: only the first 3 reach the egg |
| 2 | The Egg | Radial brick breaker with bullet-hell patterns | Turn your arc round your shell to bounce a glow into rings of rival sperm, catch falling power-ups, and block the enzyme sparks they fire; a seal charge clears the screen | 63 s | The swarm in three phases, then the rush: let in only your own sperm |
| 3 | The Embryo: first cells | Roguelike | Clear a room of germs each day, split, pick 1 of 3 gifts, stack them, clear the boss room | 72 s | The Knot, a big clump at the end of the tube |
| 4 | The Placenta | Action-adventure | Tunnel the lining and grapple from knot to knot to find 8 hidden food pools; each pool grows your roots | 62 s | The first heartbeat: your heart pulses down the roots and clears every germ |
| 5 | First Trimester | Twin-stick shooter | Waves of germs each week; cleared germs drop food that grows your sparks; a rest and a heal after each wave | 76 s | The big germ at week 13, in three phases |
| 6 | Second Trimester | Rhythm | Slide between 3 lanes and kick on the beat: {carer}'s heartbeat, call and response, then the whole song | 74 s | The sing-along with a fever streak |
| 7 | Third Trimester | Survivor auto-shooter | {Carer}'s antibodies fire for you; dodge hordes, collect sparkles, level up, pick antibody gifts | 78 s | The Big Germ wave, then the turn head-down |
| 8 | Birth | Endless runner | Contractions push you down a 3-lane channel; dodge soft folds, tuck through tight gaps, hit the turn gates | 65 s | The last wave into the light |
| | The ending | Calm | Unchanged from v1 | 33 s | The first breath |

The run takes about 10 minutes for a mid player (8 to 12, v1 3.1 counts it the same way).

## 1. What stays and what goes

**Stays:** the stage order and ids (`swim`, `egg`, `split`, `root`, `grow`, `answer`, `turn`, `birth`, then
`ending`); one heartbeat from Play to the result; the gaDay clock and its labels; the paper-cut look; captions and
facts with their pacing rules; Good, Great and Glowing on the 10,000 point scale (Goal 3,000, Skill 6,000, Flourish
1,000); the stage-end overlay, cards and crossfade; the Almost card in stage 1; practice from the Stages menu;
saves; one-button mode and Assist; the ending.

**Goes:** the stage 1 straight course (the v1 race stays and gains bends, drifts, items and knockout gates); the
stage 2 follicle taps, its 8 swim-in waves and the beat-timed seal (the arc stays as the paddle of a brick breaker);
the beat taps of stages 3, 4 and 5; the stage 7 breaths; the stage 8 drag-and-hold waves. Timed targets stay only in
stage 6.

**New:** the action layer; drifts, items, the slipstream and knockout gates in stage 1; the glow, formations of
rivals, enzyme spark patterns, power-ups, the seal charge, the swarm and the rush in stage 2; hp and a knock-out in stages 2, 3, 4, 5 and 7; bosses; gifts; lanes in stage 6; a runner in
stage 8.

## 2. Tone rules for action (revised by the user's request)

The v1 tone rules (v1 section 2) still hold, with these changes. The user asked for action with foes, so:

- **Foes are biology, framed gently.** Germs, clumps, acid, white cells, enzyme sparks and rival sperm may push
  back. Germs pop into sparkles. Sperm bounce off, drift away or rest. White cells turn away and drift off. Nothing
  is killed, and nothing bleeds, breaks or cries.
- **Shown words stay gentle.** Use pop, clear, shoo, bounce, push, dodge, rest, drift off, "You need a rest."
  The v1 banned list (15.4) is unchanged, so no shown string says kill, enemy, attack, fight, battle, hurt, danger,
  lose or sick. Design words such as "battle royale", "boss", "brick" or "break" are never shown.
- **{Carer}'s body is never blamed.** In stage 1 the acid tide and the white cells are hazards, and a fact says
  plainly that this is normal (`swim.cells`). From stage 2 on, {carer}'s body only helps: the heartbeat and songs
  (6), the antibodies that cross the placenta (7), the waves of birth (8). Germs are never said to come from
  {carer}. No illness, no infection word, no medical advice.
- **Hits are soft.** A hit is a dim pip, a short brightness blink on you (never a red flash), a soft low sound and a
  small push back. The flash rule of v1 12 holds in every fight (section 4.8).
- **Your own sperm is never a target.** In stage 2 the arc only nudges it (v1), and sparks never touch it.
- **The race words stay.** No stage 1 or 2 string says fastest, winner, win, wins or won, or that one sperm beats the
  others (v1 15.4). Stage 1 says "The way closes." and "14 racing", never "eliminated".
- **Game framing is named.** Each stage whose play is invented has a "What was real" frame line on the run result
  (`swim.frame`, `egg.frame`, and new ones in section 4.10).

## 3. The run

### 3.1 Stage table

"Ref", "mid" and "idle" are stage times for the skill 1.0, 0.7 and 0 bots, as in v1 3.1. These are targets for the
builders. Each builder measures its stage and records the result here and in its tune file. "KO" says whether the
stage has hp and a knock-out.

| # | Id | Genre | Families | gaDay | Real scale | Ref | Mid | Idle | Cap | KO |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `swim` | kart racing, knockout gates | steer, tap | 14 | 0.3 mm (not to scale) | 52 s (measured: arrival 49 s + `meet`) | 66 s (measured: arrival 63 s + `meet`) | out at about 14 s (measured 13.7 s), then the Almost card | 117 s (+3 s carried) | by place, gate or tide |
| 2 | `egg` | radial brick breaker, bullet-hell patterns | rotate, tap | 14 | 0.4 mm (not to scale) | 60 s (measured; 55 to 64) | 61 s (measured) | out at about 23 s (18 s into the guard), then the Almost card; Go on about 13 s more | 80 s | yes |
| 3 | `split` | roguelike | steer, tap | 15 to 20 | 0.45 mm | 56 s (built) | 57 s (built) | knocked out in 14 of 20 seeds (19 to 72 s), else 75 s | 100 s | yes |
| 4 | `root` | action-adventure | steer, tap | 20 to 49 | 0.6 to 30 mm | 52 s (measured: 41 s, the roots 25 s) | 62 s (measured: 43 s, the roots 27 s) | 79 s, or a KO first (measured: 79 s, no KO in 20 seeds) | 90 s | yes |
| 5 | `grow` | twin-stick shooter | steer, tap | 49 to 97 | 30 to 150 mm (sac across) | 85 s | 85 s | a KO at about 12 s, then the Almost card | 120 s | yes (contract.md) |
| 6 | `answer` | rhythm | tap, steer | 98 to 195 | 150 to 600 mm | 74 s | 74 s | 74 s | 90 s | no |
| 7 | `turn` | survivor auto-shooter | steer, tap | 196 to 280 | 600 to 700 mm | 79 s (measured) | 80 s (measured) | about 30 s (measured 28 to 30 s), then the Almost card | 100 s | yes |
| 8 | `birth` | endless runner | steer, tap | 280 | 700 mm | 65.5 s | 65.5 s | 65.5 s | 80 s | no |
| | `ending` | calm | hold (optional) | 280 | 2 m | 33 s | 33 s | 33 s | 40 s | no |

`meta.families` keeps the v1 names. An action stage declares `["steer", "tap"]`: the move is steer, and the dash is
a tap (as `contract.md` and stage 5 do); in stage 1 the tap is the drift and the item. Stage 2 declares
`["rotate", "tap"]` (the arc, and the seal). Stage 6 declares `["tap", "steer"]` (kicks and lanes). No stage declares
more than two families. The ending keeps its optional hold. The v1 rule that the run uses at least three families is
dropped: the variety now comes from the genres.

**Run length.** Mid: stages about 556 s, 7 overlays of 2.5 s, 7 cards (the bot skips each at 1.0 s), the ending
33 s: about 10.2 min of game time. The skill 0.7 gate stays 8 to 12 minutes in every run (`sim.test.mjs`). An idle
run is shorter (knock-outs end stages early) and has no gate.

### 3.2 The difficulty curve

| Stage | What rises |
|---|---|
| 1 | learn to steer, drift and use items; the gates and the tide press on the back of the pack |
| 2 | the arc as a paddle: one glow and plain rings first, then shooters from W2, patterns that build to the swarm, then the rush |
| 3 | rooms and builds: more foe types, a boss with phases |
| 4 | a breather in exploration; few germs; the map is the challenge |
| 5 | **peak 1**: the fastest bullets of the run and the hardest boss |
| 6 | a breather in rhythm; timing only, no hp |
| 7 | **peak 2**: the most foes at once, but your build carries you |
| 8 | speed: the runner gets faster with each wave; no hp, so it ends on a high, never on a knock-out |

Foe bullet speed caps, at each stage's camera span: stage 2 at most 24 u/s (sparks fly at the shell, and the arc must reach them), stage 3 at most 34 u/s, stage 4 at
most 24 u/s, stage 5 as `contract.md` sets (the run's fastest), stage 7 at most 30 u/s.

## 4. Shared rules

### 4.1 The action layer

`core/lib/action.js` (the names below are the ones it exports; `contract.md` is the source of truth) gives each
stage one world `A = createWorld(seed, opts)`, stepped once per fixed step with `stepWorld(A, intents)`. A stage
owns its world, sets its own overrides, and turns `A.out` into its events and score. It gives:

- **You:** a small hitbox inside a larger body (Touhou), moved by the move vector, with short i-frames after a
  hit. Defaults (`ACT.player`): hitbox 1.7 u, body 4 u, speed 36 u/s, accel 18 /s, hp 5, i-frames 1.0 s, and a
  mercy clear of foe bullets within 9 u when you are hit.
- **Dash** (`ACT.dash`): 110 u/s for 0.15 s, i-frames 0.26 s, cooldown 0.85 s, a 0.12 s input buffer.
- **Auto-fire** (`ACT.fire`): at the nearest foe in range: 5 shots a second, 95 u/s, range 60 u.
- **Pooled bullets** for both sides (up to 640), with tones `you`, `foe`, `hot` and `soft`.
- **Foes** (up to 48) of kinds `germ`, `blob`, `spore`, `ring`, `boss`, `rival`, `cell`, `drop` and `guard`, with
  behaviours `chase`, `orbit`, `wander`, `shooter` and `still`, an optional gun, drops and a spawn tell.
- **Patterns** `aimed`, `fan`, `ring`, `spiral` and `wave`, each with a telegraph (`line`, `fan`, `ring`, `spot`,
  `charge`).
- **Pickups** `food`, `heal` and `up`, a magnet and `vacuum`.
- **A safe zone** (`setZone`): a circle that shrinks from one circle to the next over a time span; outside it you
  lose 1 hp every tick. (No stage uses it now: stage 1 became a race. It stays in the layer.)
- **Waves** (`makeWaves`, `spawnDue`), a **combo**, and **juice** (a hit flash, a small shake, hit-stop).
- **A knock-out:** hp 0 sets `A.ko`.
- **A bot** (`actionSteer(A, skill, r)` in `actionbot.js`): a potential-field dodger that returns `{ steer, dash }`.
  Each stage's `botSteer` builds on it and adds its own goals (a pickup, a pool, a lane, a gift).

Each stage section lists its overrides of these defaults. Stages 1 and 2 keep their own v1 code for their core (the
race model and the guard arc) and may use the layer only for parts of it (stage 2's enzyme sparks, tells, power-ups
and pops; stage 1's item sparks and goo). A stage may own extra actors (stage 1's rivals, stage 2's gold sperm, stage 4's map, stage 8's
folds) and draw them with its own draw items.

### 4.2 Controls

- **Move:** drag anywhere. The floating stick of v1 5.3 (dead zone 8 px, full at 56 px, the origin trails past
  80 px) sets the move vector. Lifting the finger stops your input; you ease to a stop. Desktop: WASD or the arrows,
  8 ways, smoothed over 0.12 s.
- **Fire:** automatic, at the nearest foe in range. The player never aims.
- **Dash (or the stage's special):** a quick second tap, a tap with another finger, Space, Enter or Z. It goes the
  way you move, or the way you last moved. A dash never needs two fingers at once. The exact gesture is in
  `contract.md` and `ui/input.js`.
- **The prompt line** in an action moment shows the move icon and reads "Drag to move. Tap to dash." (stage text
  may replace "dash" with its special, such as "Tap to tuck." in stage 8). On desktop: "WASD to move. Space to dash."
- **Stage 1** has no auto-fire: the press drifts while you turn and uses your item while you swim straight; on
  desktop Space held while turning drifts, and E or Shift uses the item (section 5.1).
- **Stage 2** keeps the v1 guard controls: the arc follows the drag's angle, the turn keys or the mouse. A press (a
  second finger, a quick second tap, Space, Enter or Z) releases the seal charge, and after your sperm enters a
  fresh press seals the shell (section 5.2). No auto-fire: the glow bounces off the arc.
- **Stage 6** uses lanes and timed presses (section 5.6). **Stage 8** uses lanes and the dash (section 5.8).
- **One-button mode:** hold the button (any key or touch) and the stage's `botSteer` at skill 1.0 moves you (or
  turns the arc in stage 2), and dashes, drifts or uses items when it wants to. Let go and you stand still. Auto-fire keeps firing. In stage 6 the run puts you in the
  next note's lane, so you only press on the beat. Every stage is completable this way; each stage section says how.
- **Assist** (each stage lists its own numbers): hp +3, foe bullets ×0.75 speed
  (`bulletK`), foe counts ×0.75 (rounded up), dash cooldown ×0.7; in stage 6 windows ×1.6 and any lane counts.

### 4.3 Fairness rules (every action stage)

- **Small hitbox.** Your hitbox is about 40% of your drawn body. Bullets hit only the hitbox. Pickups use the body.
- **Telegraphs.** Every foe shows a spawn tell for 0.6 s before it can move, shoot or be hit. Every pattern shows its
  tell (a line, fan, ring or spot) for at least 0.35 s before the first bullet. Every aimed shot has a 0.25 s
  wind-up glow on its foe.
- **No spawn on you.** No foe spawns within 24 u of you, and no foe bullet is made within 14 u of you. In stage 2
  "you" is the egg: distances count from its centre.
- **Mercy.** A hit clears foe bullets within 9 u of you (in stage 2, of the shell: 20 u from the centre) and gives
  1.0 s of i-frames, so one mistake costs one pip.
- **Readable density.** Each stage section gives a cap of foe bullets on screen. A pattern that would pass the cap
  waits.
- **After Resume,** you cannot be hit for 1.2 s, and foes and bullets fade in from 50% for 0.3 s (as v1 frees the
  targets of the first 1.2 s).
- **The thumb.** In portrait no foe spawns in the bottom 40% of the screen, and arenas keep you above 60% of the
  height (v1 5.6). Stage 2's formations sit all round the egg, as v1's waves came, inside the safe area (your own
  sperm never comes from below).

### 4.4 Hp, hits and the knock-out

- **Hp** is a row of pips (stage 2 calls them shell pips). A hit costs 1 pip unless a stage says more. A hit blinks you by
  brightness for the i-frames, plays a soft low "oof" (no cry, no pain sound), pushes you 6 u, and drops the combo.
- **Shield sparks.** Each Glowing grade so far in the run (`carry.sparks`, v1 5.5) is also a shield pip, up to 2 per
  stage. A shield pip takes the first hits of a stage and comes back next stage. In practice the stage uses the
  carry it last started with.
- **A knock-out** comes at 0 hp in stages 2, 3, 4, 5 and 7. Stage 1 has no hp: a sperm is out at a closed gate or by
  the tide, and you get the stage 1 Almost card (5.1). You curl up and rest. Foes and
  bullets drift off over 1.2 s, with the stage's rest line ("Your shell needs a rest." in stage 2, "Your cells need
  a rest." in stage 3, "You need a rest." in stages 4, 5 and 7). Then the run shows the Almost card:
  "Almost. Try again?", the line "Your body keeps growing. Your run and points are kept.", a focused **Try again**
  and **Go on**. Stage 1 keeps its own card text with your place (section 5.1).
- **Try again** recreates the stage at once with the same seed and carry. The run keeps the better attempt.
- **Go on** lets development finish. In stages 2, 3, 4 and 7 the stage jumps to its `meta.goOn` moment and plays
  out by itself with input `none`: your sperm enters (2), you hatch (3), the roots link and your heart starts (4),
  you turn and rest (7). Stage 5 does as `contract.md` sets: it may end at once, with the clock and carry set to the
  stage's end. Either way the stage's milestones still fire (`fertilized`, `implanted`, `heart`, `fetus`,
  `headDown`), its carry is written, and it ends with Goal 0, the Skill and Flourish it had, and no grade word. The
  overlay shows only points. Stage 1's Go on is the v1 3 s carry.
- `meta.canFail` is true for stages 1, 2, 3, 4, 5 and 7, and false for 6 and 8.
- **Stages 6 and 8 have no hp.** A miss in stage 6 only earns less. A bump in stage 8 only slows you.
- `result().metrics` carries `ko` (true after a knock-out) and `koAt` (stage seconds).

### 4.5 Scoring and grades

The scale is unchanged: Goal 3,000 (the stage's goal: always met unless a knock-out, and in stage 1 the top 3),
Skill up to 6,000, Flourish up to 1,000. Good with the goal met, Great at 6,500, Glowing at 8,500. The run total
adds 500 per Glowing. Each stage section lists its parts. The combo from `action.js` adds to the HUD score feel
(number pops) but the graded parts below are what count, so the score stays fair across seeds.

**Bot gates** (`sim.test.mjs`, 20 seeds each, Assist off):

| Bot | Gate |
|---|---|
| skill 1.0 | Great or better in at least 18 of 20 seeds in every stage; knocked out in at most 1 of 20; the mean of each stage at least 7,500 |
| skill 0.7 | stage 1: in the top 3 in at least 18 of 20; stages 2 to 5 and 7: no knock-out in at least 18 of 20; every run 8 to 12 min of game time |
| skill 0.5 | stages 2 to 5 and 7: no knock-out in at least 16 of 20; stages 6 and 8: goal met in every seed; stage 1 may get the Almost card and Go on |
| skill 0 (idle) | every stage ends by its cap or by a knock-out; after a knock-out the bot picks Go on, and the run reaches the ending; nothing throws |
| one-button (held) | every stage completes with no knock-out in at least 18 of 20; stage 1 in the top 3 in at least 18 of 20 |

Mean totals rise with skill. Glowing is meant for strong human play; the ref bot reaches it in some seeds.

### 4.6 Gift bubbles (stages 3 and 7)

A pick is part of the world, not a menu. Three gift bubbles appear round you, 22 u away (up-left, up, up-right in
world terms). Each is a cream paper disc with a cut icon and a one-word DOM tag beside it ("Spread", "Bounce").
Swim into one to take it. Time slows to 0.25× while the bubbles show (the world, not the clock: her heartbeat and
the stage clock run on). After 3.0 s of real stage time the middle one is taken by itself ("It picks itself."). The
three offered are distinct, seeded from the stage seed, and never one already at its top level. The bot takes the
first in its preference list (section 4.11).

### 4.7 Carry

The v1 carry (v1 5.5, 16.7) stays: `sperm` (1 to 2), `nestleX` and `treeSeed` (4 to 5, 6 and 7), `song` (6 to 7 and
the ending), `turnDir` (8: written at the wave 4 turn gate, read at the wave 8 gate). Changes:

- `sparks` now also gives shield pips (4.4).
- `sperm.glow` is 1 if you became ready in stage 1 (on a glow wall, v1, or with a Warm glow item), else 0.5. It sets your gold sperm's brightness in stage 2.
- **No gift or upgrade carries between stages.** Each stage is its own genre and starts fresh, so a stage plays the
  same in practice and in a run. Only the sparks carry power, and only a little.

### 4.8 The paper-cut look of new things

Every new thing is cut paper, drawn by `render/items.js` from the draw list's action part (`actionView`, 4.1) or
the stage's own items, with the v1 sticker rule (a 2 px ink keyline, a cream margin when the cue is not cream).

| Thing | Paper treatment | Shape code (never hue alone) |
|---|---|---|
| Your shots | small cream `#fff4e2` paper dots with an ink keyline, from the dot atlas | round |
| Foe sparks (`foe`) | small paper diamonds, pale core `#ffe0c8` on a 2 px ink keyline | diamond |
| Hot sparks (`hot`, bosses) | larger diamonds with a cut notch, core `#ffd0a0` | notched diamond |
| Soft drops (`soft`, slow puffs) | soft paper discs, dotted rim | dotted disc |
| Germs | cut paper blobs in muted sage `#9fae7e` and teal `#6f9a8e`, with zigzag cut edges | spikes or zigzag rim |
| Clumps (stage 3), the Knot | stacked sage and brown paper discs | several overlapping discs |
| White cells (stage 1) | large pale lilac `#d8c8e0` blobs with a dotted rim, slow wobble | dotted rim, big |
| Item boxes (stage 1) | small cream paper cubes with a cut swirl and a keyline, bobbing | cube |
| Item sparks, goo, shield (stage 1) | keylined diamond; dotted soft disc; a cream bubble ring | diamond, dotted disc, ring |
| Drift sparks (stage 1) | paper confetti at your tail: 1, 2 or 3 pieces a puff for blue, orange and pink | count |
| Knockout gates (stage 1) | a pale rose band across the tube with cut cream dashes, solid cream once closed | dashes, then solid |
| The glow, bricks, power-ups (stage 2) | a cream disc with a gold halo and trail; v1 rivals with 1 to 3 cream dots for hits left, a cream cap on capped ones; cream discs with a cut icon and a DOM tag | disc; dots; icon |
| Rival sperm | v1 mauve `#967088`, as in v1 | v1 tails |
| Your gold sperm | v1 marigold on cream, cut cream dashes | dashed ring |
| Pickups | sugar: small cream squares; heal: a cream paper glow with a plus cut; up (sparkles): tiny cream stars | square, plus, star |
| Gift bubbles | cream discs with a cut icon and a DOM tag | disc with icon |
| The cool tide (stage 1) | a cool lilac `#4e3a5e` sheet over the course behind the pack, with a cut wavy front edge (stable cuts by world position, v1 14.1) | wavy edge, cool sheet |
| Tunnels (stage 4) | holes cut in the front lining sheet that show the deeper sheet; baked per grid tile | cut-out |
| Lanes (stage 6) | three paper strips with cut cream dashes | dashes |
| Folds (stage 8) | plum paper flaps from the straight side flats, never closing a ring round the light | flaps from the side |
| Telegraphs | cream dotted lines, fans and rings at 60% | dotted |
| A pop | 6 to 8 paper confetti dots that fall 6 u with a shadow and fade over 0.5 s | confetti |
| Number pops, hp, boss bar | DOM tags only; the canvas still draws no text | words and pips |

- **Brightest cue.** In an action moment the cue is you (your sticker is the brightest thing); in stage 2's guard it
  is the arc (v1), and while your gold sperm is coming, it is your sperm; in stage 6 it is the next note's ring.
- **Marigold stays "you".** Your sperm, your heart, the stage 8 arrow. No foe, bullet or pickup is marigold.
- **Juice without flashes.** A hit flash on a foe brightens that foe only. Your hit is a brightness blink on you.
  Screen shake is at most 3 px, and off with reduced motion. Hit-stop is at most 8 frames. Every fight keeps v1's
  rule: at most 3 luminance swings of 10% or more in any 1 s, and no red flashes.
- **Budgets.** Each stage gives its peak counts. The frame budget (v1 14.3: full tier p95 16 ms, low tier 10 ms)
  holds at each stage's busiest moment. Bullets and dots are atlas `drawImage` calls; foes are cached paper sprites
  by kind and size; no grain on shapes under 12 px.

### 4.9 Sound for new things

All through the womb bus (v1 11) until birth. Your shots: a very soft tick, throttled (`emitOut`, 0.09 s). A pop: a
soft pluck that rises with the combo (5 steps, then holds). Foe sparks firing: a low soft puff. A hit on you: a soft
low "oof" thump. A dash: a whoosh. A pickup: a small chime. A gift: a warm two-note chime. A boss phase: a low swell.
A knock-out: a soft settling chord, never a sad sting. Each has a caption once per stage (v1 12): "· sparks fly",
"· germs pop", "~ you dash".

### 4.10 Captions, facts and new facts

v1's pacing rule holds: every caption fact a stage sends shows whole before the stage ends. Action stages have fewer
quiet moments, so each stage lists its captions **in priority order**. The builder sends them in that order where
they fit; any that `pacing.test.mjs` shows has no room becomes a `result` fact ("What was real"). Facts are sent at
calm points: wave gaps, room clears, gift picks, the straights between bends.

**New facts** (sources already on the allow-list in `core/sources.js`; v1 15.1 rules). Each ships with `checked:
false` until its builder re-reads the source line in `research/research-biology.md` (named here) and the page or
abstract, then sets `checked: true`.

| Id | gaDay | Text | Where | Sources (access); research line |
|---|---|---|---|---|
| `swim.acid` | 14 | "Sperm first land in an acid place. They quickly swim into mucus." | caption | PMID 16272225 (A); research 2.5 |
| `swim.cells` | 14 | "After sperm arrive, white blood cells gather. They may clear sperm away. This is normal." | caption | PMID 3979580 (A); research 2.8 |
| `swim.mucus` | 14 | "Near ovulation, mucus turns clear and slippery. It makes swimming easy." | result | CC 21957 (R); research 2.6 |
| `egg.caps` | 14 | "A cap on each sperm's head holds enzymes." | caption | CC sperm (R); research 2.2 |
| `split.frame` | 15 | "In the game you clear germs from the tube. In life, tiny hairs and squeezes carry you." | result | embryology.ch migration (R) |
| `root.frame` | 20 | "In the game you tunnel and grapple. In life, your roots branch into the soft lining." | result | UNSW Week 2 (R); embryology.ch villi (R) |
| `grow.frame` | 49 | "In the game you clear germs. In life, the placenta brings you food and oxygen." | result | CC 22337 (R); research 5.13 |
| `turn.antibody` | 196 | "Antibodies from {carer} cross the placenta to you. Most pass near the end." | caption | CC 22337 (R), PMID 22235228 (A); research 5.14, 5.15 |
| `turn.months` | 217 | "This protection lasts for several months after you are born." | caption | CC 22337 (R); research 5.15 |
| `turn.frame` | 196 | "In the game antibodies fly at germs. In life, they travel quietly in your blood." | result | PMID 22235228 (A); research 5.14 |

The research lines are in `openspec/changes/archive/2026-10-19-add-first-breath/research/research-biology.md`,
written as section.item: section 2 ("The sperm journey") items 2, 5, 6 and 8, and section 5 ("Embryo and placenta",
under "What the placenta does, and what crosses") items 13 to 15. `turn.weight` stays `checked: false` as in v1.

### 4.11 Bots

Every action stage's `botSteer(state, skill, r)` returns `{ steer, dash, dir, hold }` (contract.md fixes the shape;
`core/bots.js` presses for the dash). It starts from `actionSteer(A, skill, r)` (dodging) and blends in the stage
goal with a weight that rises with safety:

- **Goal pull:** a unit vector toward the stage goal (section 5), weight 0.6 when no foe bullet is within 20 u, else
  0.25.
- **Skill:** below 1, the bot sees bullets late, looks less far ahead, wobbles and turns slowly (`BOT` in
  `actionbot.js`). It also reacts to the stage goal with a lag of 0.6 s × (1 − skill), kept in `r.mem`.
- **Gifts:** the bot takes the first gift in its stage's preference list; below skill 0.5, the middle bubble.
- **Idle (skill 0):** no input at all.
- **One-button:** `botSteer` at skill 1.0, applied only while the button is held (v1 16.4, `contract.md`).

## 5. Stages

Each stage lists: the fantasy, what it borrows, the loop, controls, moments on the clock, tuning, foes and hazards,
waves and pacing, the boss or climax, upgrades, score, the knock-out, Assist, one-button, length, facts, carry, the
look, sound, the bot and its checks. Numbers are starting values: the builder tunes them to the gates in 4.5 and
records the final values in the tune file and in section 3.1.

### 5.1 Stage 1, The Race (`swim`): kart racing with battle royale knockouts. "Drag to swim."

The user found the current race fun and asked for "a racing game. like Mario cart or forza perhaps with battle
royale elements". So the race as built in `core/stages/swim.js` stays, and the kart parts go on top of it. This
replaces the first plan for this stage (a shrinking zone in an open arena).

**Fantasy.** Twenty sperm race through the womb and up a winding warm tube to the egg. Ride the waves, drift through
the bends for boosts, grab items, draft behind rivals, and stay ahead of the gates that close behind the pack. Only
the first three reach the egg.

**What stays as it is** (`swim.js`, `swim.tune.js` and `race-sim.mjs` as built; these are what make it fun):
- **The pack.** You and 19 rivals on the v1 start grid (5 rows of 4, 12 u apart, you in row 3), the v1 skill ladder
  (0.80 down to 0.04, with two front-runners), each rival with its own seeded stream, lag, aim error and heading noise
  by skill, and Reynolds separation within 12 u. Soft bumps as v1: heads of radius 3 u, each keeps 0.7 of its speed,
  back to full top speed over 0.6 s, at most once per 0.4 s, with a contact ring.
- **The feel of steering.** The v1 floating stick: its direction is the heading you swim toward, its length is your
  effort. `steerBody` with the v1 numbers: own speed 55 u/s × stick, accel 120 u/s², drag 1.8 /s above the target,
  turn rate 3.0 rad/s. A wall contact keeps 0.9 of your speed. No grip limit: the kart parts never change how you
  steer.
- **The waves.** From 1.2 s, one every 3.2 s, 60 u thick at 140 u/s, each in a window ±40 u about its seeded centre.
  A sperm that swims with one (stick 0.3 or more, within 45° of forward) is lifted to 140 u/s; an idle one is never
  lifted. They are the womb's boost pads.
- **The gate, the fork and the cool loop.** The funnel to 40 u; at the split the side of your head picks the tube;
  the cool loop is its own 160 u track with a 40 u/s flow that brings you back to the fork.
- **The warm tube.** Its current against you (22 u/s × (0.3 + 0.7 (1 − r²))), the upstream bonus (+18 u/s within
  25° of upstream), the warm lane (30 u wide, drifting ±12 u at 0.1 Hz, +12 u/s and the current halved inside it),
  and the checkpoints at 1,400, 2,200, 3,000 and 3,800 u that the current never pushes you behind.
- **The glow walls.** Let go inside a glow on the tube wall at 1,700, 2,600 or 3,500 u, hold there, and on her 4th
  beat you are ready: your own swim is ×1.6 to the finish ("Now you are ready."). It still costs about 3.3 s, so it
  stays a real choice.
- **The place slot.** "3rd of 20" under the score, by arrival first and then by progress, changing only after a new
  place has held for 0.25 s.
- **The catch-up.** v1: rivals ahead of you ease by up to 10%, rivals behind gain up to 6%, over 400 u. Assist as
  v1.
- **The end.** The meeting place, `meet` (2.5 s, "Wait here. The egg is coming."), the Almost card, Try again, Go on
  with `carried` (3 s), the 117 s cap. The camera's span of 170 u in the womb and 150 u from the gate, its 0.4 s
  sideways ease, and the fork's two mouths on screen 1.5 s before the split. The facts and captions in their v1
  order.

**What changes.** The tube now bends (below). The v1 rules are measured along its centre line, so progress, the
current, the lane and the checkpoints work as before. The camera also turns with the track, so forward stays up in
portrait and right in landscape and desktop. The v1 rule that a rival rests once 500 u behind you goes: the gates
and the tide do that job now.

**What is added on top.**
- **Drift boosts** (Mario Kart): drift through a bend to charge a mini-turbo (blue, orange, then pink sparks),
  released as a boost.
- **Items** (Mario Kart): item boxes in rows, and items weighted by place, so the back of the pack gets the strong
  ones. Five items: a homing spark, a shield, a rush, a warm glow and dropped goo.
- **Slipstream:** tuck in behind a rival to draft, then pull out to slingshot past.
- **Knockout gates** (Mario Kart World's Knockout Tour, F-Zero 99): only the first 14, then 8, then 5 go on, with a
  live "14 racing" count. A cool tide sweeps up the stragglers.
- **White cells** drifting across the womb.
- **A racing line** (Forza Motorsport): the warm lane, with chevrons, sits on the inside of each bend.

**Controls.**
- **Steer:** drag anywhere, as v1. Desktop: the arrows or WASD.
- **Drift:** a press while you turn (the stick at least 25° off your heading) starts a drift toward that side. Keep
  turning to charge it; straighten the stick (within 10° of your heading), lift, or press again to let the boost go.
  Desktop: hold Space while you turn to drift, and let go of Space to boost.
- **Item:** a press while you swim straight uses the item you hold. Desktop: E or Shift (or Space while straight).
- One live gesture: `move`. Families: steer and tap. No auto-fire in this stage.
- Prompts: "Drag to swim." by 0.3 s, steering live by 0.5 s (v1). At 1.0 s: "Race to the egg. Get there in the first
  three." At the first bend: "Tap while you turn to drift." (desktop: "Hold Space while you turn to drift."). At the
  first item: "Tap to use it." (desktop: "Press E to use it.").

**Moments** (all gaDay 14, "Week 2"): `womb`, `gate`, `fork`, `tube`, `meet` and `carried`, as v1.

**The track** (progress is the distance along the centre line, as v1; the v1 length of 4,600 u is kept):

| Progress | Piece |
|---|---|
| 0 to 1,100 u | the womb, as v1: 160 u across, with the waves; white cells drift across it from 300 u; an item row at 500 u |
| 1,100 to 1,300 u | the gate: the v1 funnel to 40 u; **Gate 1** at 1,300 u |
| 1,300 to 1,400 u | the fork and the cool loop, as v1 |
| 1,400 to 4,600 u | the warm tube, 60 u wide, with the v1 current, lane, checkpoints and glow walls. **B1** a right bend of 90°, radius 120 u, from 1,450 u; glow wall 1 at 1,700 u; **B2** a left bend of 120°, radius 90 u, from 1,780 u; an item row at 2,050 u; **B3** a right hairpin of 180°, radius 55 u, from 2,250 u; glow wall 2 at 2,600 u; **Gate 2** at 2,800 u; **B4** a left bend of 90°, radius 100 u, from 2,880 u, then **B5** a right bend of 90°, radius 100 u, from 3,060 u (a chicane); an item row at 3,330 u; glow wall 3 at 3,500 u; **B6** a left bend of 150°, radius 70 u, from 3,620 u; **Gate 3** at 4,000 u; the final straight to the meeting place at 4,600 u |

Straights join the bends, and the bends turn back to the start's heading by the end. The glow walls sit on
straights. The builder lays the centre line as arcs and lines, and checks that it never comes within 120 u of itself
except where two pieces meet.

**Tuning** (`swim.tune.js`; every v1 number above stays; these are the new ones).

| Name | Value |
|---|---|
| Drift | a press while turning at 30 u/s or more starts it. The turn rate stays v1's 3.0 rad/s; while you drift your path slides (your velocity follows your heading at 5 /s, not at once). Charge counts while the stick stays at least 20° to the drift side: **blue** at 0.6 s, **orange** at 1.2 s, **pink** at 2.0 s. Release: blue +25 u/s for 0.5 s, orange +30 u/s for 0.9 s, pink +35 u/s for 1.3 s. Releasing before blue gives nothing. A boost adds to your speed like a wave does and eases off over its time. |
| Slipstream | within 30 u behind another swimming sperm and within 15° of its heading, both at 40 u/s or more: after 0.5 s, +10 u/s; pulling out after at least 1.0 s in the stream gives a slingshot of +20 u/s for 0.6 s |
| Item boxes | rows of 4 across the track at 500, 2,050 and 3,330 u; a taken box comes back after 2 s; touching one rolls an item for 0.8 s; you hold one item at a time |
| Items by place at the roll | places 1 to 3: Shield 40%, Goo 35%, Spark 25%; places 4 to 10: Spark 35%, Rush 30%, Shield 25%, Goo 10%; places 11 to 20: Rush 40%, Warm glow 30%, Spark 30% |
| Spark | an enzyme spark flies ahead at 160 u/s and homes on the nearest sperm ahead within 150 u along the track; a hit spins it out for 0.8 s (speed ×0.3); it fades after 2 s |
| Shield | a cream bubble for 8 s that takes one spark, goo, white cell or bump |
| Rush | +40 u/s for 1.2 s |
| Warm glow | you are ready at once, as on a glow wall ("Now you are ready."), and `sperm.glow` is 1; if you are ready already, it is a Rush |
| Goo | a soft mucus blob dropped behind you (radius 5 u, 10 s); a sperm that swims into it slips (speed ×0.4 for 0.6 s) |
| White cells | 4 in the womb from 300 u, drifting across the track at 12 u/s; touching one spins you out for 0.8 s (a shield takes it) |
| Knockout gates | Gate 1 at 1,300 u closes when 14 sperm have passed it, or at 30 s; Gate 2 at 2,800 u after 8, or at 60 s; Gate 3 at 4,000 u after 5, or at 85 s. 3 s before a gate can close, a tag shows "Gate 2: first 8". When it closes ("The way closes."), the cool tide floods the course up to it at 120 u/s, and every sperm behind it rests. |
| The cool tide | from 12 s, an acid tide creeps along the course from the start, at 25 u/s rising to 50 u/s at 40 s; a sperm it reaches rests. A cool lilac sheet with a cut wavy front. |
| Resting | a sperm that is out slows over 1 s (v1's slow-down), curls its tail, dims to `#84607a` and rests by the wall, drawn faintly. "Some sperm rest here." the first time (v1). Nothing is harmed. |
| Place | v1, with sperm that are out ranked behind every racer, the later out ahead of the earlier; a small tag under the slot reads "14 racing", and the item you hold shows beside it |
| Finish | the meeting place at 4,600 u; the first 3 to reach it wait for the egg; when the 3rd arrives, every sperm still racing rests. A finish 4th or 5th is outside the goal. |
| Camera | v1 spans and sideways ease; it also turns with the track's direction with a 0.5 s ease, and looks 20% further ahead in a bend |
| Peaks | 20 sperm, 4 white cells, 12 item boxes, 8 sparks and 6 goo blobs on the track |
| Target pacing | mid bot: Gate 1 closes at about 18 s, Gate 2 about 38 s, Gate 3 about 50 s, the 3rd arrival about 60 s; ref 1st at about 46 to 54 s (v1 par 52 s). Tune in this order: the gate quotas, the tide's speed, the rival ladder. |

**Goal.** Reach the meeting place in the top 3 before the 117 s cap: "Wait here. The egg is coming."

**Score.** Goal 3,000 (top 3). Skill: 2,000 × (20 − place) / 19; 1,500 × min(1, boosts / 6), counting a womb wave
ridden 0.5, a blue drift 0.5, an orange 1 and a pink 1.5; 1,000 × the share of your tube time in the warm lane (v1);
750 for being ready by a glow wall (v1's part, now smaller); 750 × min(1, (your sparks that hit + slingshots + rivals
that slipped on your goo) / 4). Flourish: 1,000 for 1st (v1).

**The Almost card** (journey rule). You are out at a gate or by the tide, you finish outside the top 3, or the cap
comes: "Almost. Try again?", "You were 9th of 20." (out or at the cap) or "You came 4th of 20." (a finish), "Your run
and points are kept.", **Try again** and **Go on** ("The waves carry you on.", the 3 s `carried`). Goal 0 and no grade
word after Go on.

**Assist.** v1 (your current ×0.7, your lane ×1.5 wide, your bumps keep 0.85 with top ×0.9, rivals ahead ease by up
to 20%, rivals behind get no push), plus spin-outs of 0.5 s, gate quotas of 16, 10 and 6, the tide 20% slower, and
your item rolls count you 3 places lower.

**One-button.** Hold: the bot steers, rides the waves, drifts at the bends, uses items and drafts; release: coast.
Top 3 in at least 18 of 20 seeds.

**Length.** Ref about 53 s (arrival plus `meet`), mid about 65 s, idle out by the tide at about 14 s, then the Almost
card and `carried`.

**Facts** (priority; no card). Captions: `swim.half` (first), `swim.waves` (the first wave ridden, or 8 s),
`swim.cells` (the first white cell), `swim.acid` (as the cool tide first rises), `swim.side` (the fork), `swim.flow`
(the tube), `swim.hyper` (when you are first ready), `swim.few` (when Gate 2 closes). Overlay `swim.wait`. Result:
`swim.frame` and the rest. In portrait every caption is one line for 2.5 s (v1).

**Carry out.** `sperm = { hue, place, glow }` (v1; `glow` is 1 when you were ready by a glow wall or a Warm glow).

**Look.** v1 row 1 paper: plum walls, the rose womb floor, the coral warm tube with its amber lane and cream chevrons,
the glow walls, the dim cool loop. The bends are cut as tube sheets in world tiles (v1 14.1), so a bend's cut edge
stays put. Item boxes are small cream paper cubes with a cut swirl and an ink keyline that bob. Gates are pale rose
bands across the tube with cut cream dashes, turning solid cream as they close. The tide is the cool lilac sheet.
Drift sparks are tiny paper confetti at your tail: 1, 2 or 3 pieces a puff for blue, orange and pink, in cream, amber
and rose, so the level reads by count as well as colour. The slipstream is three thin cream streaks behind the sperm
ahead. You are the marigold sticker, the brightest thing.

**Sound.** v1 swim sounds; a drift whistle that steps up at blue, orange and pink; a boost whoosh; an item box chime
and a roll tick; a soft boop when a spark hits; a soft wobble on a spin; a low soft chord when a gate closes; a cool
hiss for the tide.

**Bot steering.** v1 `botSteer` (wave riding by threshold, aim error, noise and lag by skill, separation, the glow
walls at skill 0.75 and 0.4) plus: follow the warm lane through each bend; at skill 0.5 or more start a drift at a
bend's entry and release at orange (skill 0.9 or more: pink at B3 and B6); use a Spark when a sperm is within 100 u
ahead, a Shield at once, a Rush on a straight, Goo when a sperm is within 40 u behind; draft the nearest sperm ahead
on straights at skill 0.4 or more. Every rival uses the same bot at its skill, with its own stream and `r.mem`.

**As built** (the stage builder's notes; numbers in `swim.tune.js`). The ladder's middle is raised (rungs 3 to 10 from
0.42 to 0.30 now 0.55 to 0.34) so the pack stays near a mid player and the gates bite: over 40 seeds the mid bot's
race closed Gate 1 at about 28 s, Gate 2 at about 53 s and Gate 3 at about 65 s with the quotas 14, 8 and 5. The
difficulty pass lowered the quotas to 8, 5 and 4 (Assist 10, 7 and 5): the gates now close at about 22, 48 and 62 s.
The 18, 38 and 50 s targets need a faster pack than the mid bot's top 3 allows: the mid bot passes the gates near
the front at about 17, 43 and 56 s, so a gate that closed at 38 or 50 s would shut it out in about half the seeds
(quotas 8, 4 and 4 already drop it to 35 of 40). The ref arrives 1st at about 49 s, the mid bot is in the top 3 in
39 of 40 and one-button in 40 of 40. The tube is cut live (`render/race.js`), since the baked course tiles cannot turn with
the camera. Captions: only four fit a strong race in portrait (`pacing.test.mjs`): `swim.half`, `swim.waves`,
`swim.cells` and `swim.acid`; `swim.side`, `swim.flow`, `swim.hyper` and `swim.few` are result facts. The new facts'
"They" became "sperm" and "These cells" (no shown fact may use that pronoun). When the third arrives every sperm still
racing rests, you too, so a finish 4th or 5th only comes from arrivals in the same step; out (gate, tide or the end)
ends the stage with `metrics.capped`, so the card reads "You were 9th of 20." and Go on plays `carried`. "The way
closes." shows when the cut is within 500 u of you; the chord, the gate's band and the "racing" tag mark every gate.
The desktop item line reads "Press E or Space to use it." (`prompts.test.mjs` asks a desktop line to name a key it
knows). E and Shift press with `item: true` in the `move` gesture (`ui/input.js`, `core/intent.js`).

**Checks** (`stage-swim.test.mjs`, rewritten; `race-sim.mjs` updated first). Kept from v1: the swim, wave, current,
lane, checkpoint, glow wall, bump and place rules, with their numbers; same seed and input give the same race. New:
the track's bends and its 4,600 u length; progress never jumps along the bends; the turn rate is v1's with and
without a drift; the drift levels at 0.6, 1.2 and 2.0 s with their boosts; the item table by place, seeded; a spark
homes on the sperm ahead; the shield takes one hit; a Warm glow makes you ready; the slipstream and slingshot; each
gate closes at its quota or its time and everyone behind rests; the tide reaches an idle sperm by about 14 s; the top
3 at the finish; never past 120 s; Try again keeps the grid; Go on gives Goal 0; ref 1st in at least 16 of 20 and
Great or better in at least 18; mid top 3 in at least 18; one-button top 3 in at least 18; no string names harm, and
no stage 1 string says win, fastest or winner. Browser: `input.e2e.mjs` (drag swims forward in portrait and
landscape; a tap while turning drifts; on desktop Space held while turning drifts and its keyup boosts, and E uses
the item), `layout.e2e.mjs` (the place slot, the "racing" tag and the item slot under the score inside the safe
area; the next bend and the next gate on screen at least 1.5 s ahead with the turning camera; the fork in view;
captions one line in portrait), `visual.e2e.mjs` (you are the brightest cue; drift levels differ by confetti count
in greyscale), `perf.e2e.mjs` (at Gate 2 with the pack bunched).

### 5.2 Stage 2, The Egg (`egg`): a radial brick breaker with bullet-hell patterns. "Guard your shell."

The user said stage 2 "had potential", asked to make it "more like a bullet hell", then added "or like a brick
breaker kinda thing maybe". The lead chose a hybrid built on the existing arc: the arc round the egg is the paddle,
rival sperm in formations are the bricks, and the formations fire readable patterns that the arc blocks.

**Fantasy.** You are the egg. You turn your glowing arc round your shell, and a glow bounces off it out into rings of
rival sperm, which bounce off and drift away. The rings spray enzyme sparks back at your shell, and the arc blocks
them too. A big swarm comes last. Then your own sperm arrives in a final rush, and you let in only yours.

**Borrows.**
- **Arkanoid** and **Breakout:** a ball off a paddle into bricks, with the return angle set by where it meets the
  paddle; bricks that take 2 or 3 hits; capsules that fall from broken bricks for the paddle to catch (more balls, a
  wider paddle, a slower ball, a piercing ball); getting the ball behind a wall so it bounces there.
- **Radial Pong games** such as Circle Pong (the paddle on a ring round a centre), and **Super Hexagon** (turning
  round a centre under pressure from every side).
- **Touhou Project** and **DoDonPachi:** bullet patterns (aimed streams, fans, curtains, rings, a turning spiral) with
  telegraphs that build over the waves; a bomb that turns every bullet on screen into points.
- **Galaga:** formation members that break off and dive at you.

**What stays** (v1 6.2 and `egg.js` as built):
- The moments `surge`, `open`, `sweep`, `guard`, `enter`, `seal`, `fusion` and `outro`, in that order.
- The egg at the layout's subject point, the 140 u camera, the sizes (egg 9 u, shell 11 u, corona 11 to 20 u).
- **The arc and all its controls:** radius 16 u, 3 u wide, half-width 35° (Assist 50°); it follows the drag's angle
  at up to 720°/s, the turn keys at 540°/s (Assist 720°/s), the mouse aim after a 4 px move; it takes `turn`, then
  `aim`, then `steer`; it wakes on the first guard input and is drawn dim until then. Every v1 desktop arc rule (the
  parked cursor, W and S doing nothing) stays.
- **"The arc over a sperm"** (within 22 u of the centre and within the half-width): a swimming rival bounces, a stuck
  one pops loose, your gold sperm is nudged, held and drifting sperm ignore it.
- **Sticking and burrowing:** a rival that reaches an open part of the shell (11.5 u) sticks and burrows for 4.0 s
  (Assist 5.0 s) with its dotted ring; the arc pops it loose; one that finishes is held, still, in the cloud, and
  never enters.
- **Your gold sperm:** its seeded angle rule (clear of the arc, the thumb side and the portrait caption band), at
  most 3 nudges, then it slips under the arc, burrows for 3.0 s and enters; exactly one sperm enters, yours.
- Fusion (5 s, no input), the clock turning at its end, the outro, the facts and their real order.
- One-button: hold to let the arc track; the bot's gold-zone rule that never nudges your sperm.

**What goes.** The follicle taps (the follicle opens by itself on her 3rd beat, "It opens."; stage 6 is now the only
stage with timed targets; the opening ends by about 4.7 s). The 8 swim-in waves of v1 (the formations replace them;
divers keep their sticking). The seal timed to her beat.

**The field.** The shell at 11.5 u, the arc at 16 u, the formations between 26 and 48 u, and the rim at 54 u (the
corona's edge, a dotted pale ring). Nothing of the field is ever drawn under the HUD, the prompt or a caption box.

**The glow** (the ball; `TUNE.ball`).
- A cream disc of radius 1.2 u with a soft gold halo and a short trail. It serves at 34 u/s (Assist 28) and gains
  1 u/s each time it leaves the arc, up to 50 u/s (Assist 40).
- **Off the arc** (it crosses 16 u inward within the arc's span): it leaves outward along the radius at the hit
  point, turned by k × 55°, where k is the hit's offset from the arc's centre over the half-width, from −1 to 1. The
  middle sends it straight out; the ends send it off to the side (Arkanoid).
- **Off the rim** (54 u): the mirror bounce, turned if needed so the glow heads within 14° of the egg's centre
  (Assist 10°). So it always comes back to the arc's radius: its closest pass is at most 54 × sin 14° = 13 u.
- **Off a brick:** it bounces off the sperm's head (a circle of 2.5 u) and takes one hit off it.
- **Through:** your gold sperm, held and drifting sperm, and enzyme sparks.
- **Lost:** a glow that crosses 16 u inward where the arc is not (or while it sleeps) fades into the shell, harmless
  by itself. When the last glow is lost, the shell loses one pip, the combo ends, and a new glow serves 1.0 s later
  from the arc's centre, straight out, after a 0.6 s glow on the arc.
- A glow that has not met the arc for 10 s fades and serves again, with no pip lost.
- The first glow serves when the arc wakes, or 3 s into the guard. At most 6 glows at once.

**The bricks** are rival sperm in formations (the v1 mauve paper sperm). Hits left show as 1 to 3 cream dots by the
head, so they read by shape:
- **Plain:** 1 hit. **Tough:** 2 hits. **Capped:** 3 hits, with a cream cap on the head (the acrosome) that shows a
  cut crack after its first hit.
- **Shooters** (any kind): a pale rose ring round the head that glows during their wind-up.
- **Re-forming rings:** when a member drifts off, the others spread out over 2 s to close the gap. Rings that do not
  re-form keep their gaps, so a glow that slips behind them bounces between the ring and the rim.
- **Divers** (from wave 2): a member leaves its formation with a 0.6 s tell and swims in at 12 u/s. The v1 rules
  apply: the arc bounces it, the glow bounces it, or it sticks, burrows and is popped loose or held.
- A brick with no hits left bounces off and drifts away (v1's bounce: 14 u/s outward, gone by 80 u). Nothing is
  killed, and no shown word says "break" or "brick".

**The waves** (seconds into the guard). A wave comes at its time, or sooner once 3 or fewer bricks are left (but
never within 4 s of the last). Bricks left over stay, up to 36 on screen; members past the cap join as room frees.

| Wave | At | Formation | Bricks (hits) | Fire |
|---|---|---|---|---|
| W1 | 0 s | a ring of 10 at 30 u, turning 0.2 rad/s | 10 plain (10) | none |
| W2 | 7 s | two arcs of 5 at 42 u, opposite, turning −0.15 rad/s | 6 plain, 4 tough (14) | 1 shooter: aimed streams; a diver every 6 s |
| W3 | 14 s | a double ring: 8 at 30 u turning +0.25 rad/s, 10 at 44 u turning −0.2 rad/s | 11 plain, 4 tough, 3 capped (28) | 2 shooters: fans; a diver every 5 s |
| W4 | 21 s | a re-forming ring of 10 at 38 u, and a spinner orbiting at 46 u | 6 plain, 4 tough, the spinner tough (16) | the spinner: rings; 1 shooter: curtains; a diver every 5 s |
| The swarm | 28 s | a dense ring of 20 at 42 u, turning 0.3 rad/s | 12 tough, 8 capped (48) | by phase (below) |

**Enzyme sparks** (the bullet hell; `TUNE.fire`). Keylined paper diamonds of radius 1.4 u, at 16 to 22 u/s (never over
24 u/s), all aimed at or across the shell. Each shooter shows a 0.35 s line telegraph toward the shell before it
fires, and a fan, ring or curtain shows its own tell first.
- **Aimed stream:** 3 in a line, 0.15 s apart, at 20 u/s, every 3.0 s.
- **Fan:** 3, 12° apart, at 18 u/s, every 2.6 s.
- **Curtain:** 5 sparks across one sector, 12° apart, closing in from 50 u at 16 u/s, every 4.0 s. A well-placed arc
  covers the whole curtain.
- **Ring:** the spinner sends a ring of 10 from its spot at 16 u/s, every 3.5 s; 1 or 2 of them cross the shell.
- **Turning stream** (the swarm's phase 3): the members fire in turn, so the point where the sparks arrive turns round
  the shell at 50°/s for 3 s, then rests 1.5 s. The arc follows it round.
- **Blocked:** a spark that meets the arc (crossing 16 u within its span) turns back outward at 1.3 times its speed
  as one of yours (cream and round) and takes one hit off the first brick it meets; it fades at the rim. So blocking
  feeds the brick breaker.
- **On the shell:** a spark that reaches 11.5 u where the arc is not costs one pip. The shell then has 1.0 s of
  i-frames, and every enzyme spark within 20 u of the centre is cleared (mercy, 4.3).
- At most 50 sparks on screen (Assist 38); a pattern that would pass the cap waits.

**Power-ups** (falling capsules). A brick that drifts off drops one: plain 8%, tough 15%, capped 30%, swarm members
12%, and one is sure after 10 drift-offs with none; at most 2 fall at once. A power-up falls inward at 12 u/s, and the
arc catches it when it reaches 16 u within the arc's span (or 3° past either end). A missed one fades at the shell,
harmless.
- **Multi** (30%): every glow splits into 3, ±20° apart (6 at most).
- **Wide** (25%): the arc's half-width is 55° for 10 s (Assist 65°).
- **Pierce** (15%): for 6 s every glow passes through the bricks it meets, taking a hit off each.
- **Slow** (15%): for 5 s everything but the arc moves at 0.6 of its speed.
- **Mend** (15%): +1 pip (at full pips, 200 points).

**The seal charge** (the bomb). A DOM ring round the egg fills by 1 for each brick that drifts off and 0.5 for each
spark blocked; it is full at 12 and keeps up to 2 charges. A press (a second finger, a quick second tap, Space, Enter
or Z, the dash press of `contract.md`) releases one: a seal wave runs from 11 u to 70 u in 0.5 s, every enzyme spark
on screen turns into a gold sparkle (10 points each), every brick inside loses one hit, every diver inside bounces,
and the shell has 1.0 s of i-frames. Your gold sperm is never touched. The first time a charge is full: "Tap to seal.
It clears the sparks." (desktop: "Press Space to seal. It clears the sparks.").

**The swarm** (the boss formation). A DOM bar shows its hits left. Each phase change brings a 0.8 s pause with a ring
tell and no new sparks (the layer's phase hit-stop).
1. **Phase 1** (until a third of its hits are gone): the ring turns at 0.3 rad/s, and 4 shooters round it fire aimed
   streams in turn, one every 1.2 s.
2. **Phase 2** (to two thirds): the members left split into two rings at 36 u and 48 u, turning opposite ways at
   0.35 rad/s. Curtains come from alternating sides every 2.5 s, 2 spinners in the outer ring send rings every 3.5 s,
   and a diver comes every 5 s.
3. **Phase 3:** the members left draw in to one ring at 32 u, turning at 0.45 rad/s, and fire the turning stream,
   with an aimed stream every 2 s and a diver every 5 s.

When 4 or fewer members are left, or 14 s after it came, the swarm drifts off ("The swarm drifts off."). Every brick
still on screen drifts off with it, and no new spark is fired after that.

**The rush** (the climax). 1.0 s after the swarm drifts off, plus 0.3 s for each place below 1st in stage 1, your
gold sperm comes in ("Let it in.") from the 75 u ring at 14 u/s, at its v1 seeded angle. With it come 4 rivals, at
least 60° from it and from each other, reaching the shell within 1.5 s of it. "Only one may enter. Let yours in."
Open the arc for yours and block the rest: the v1 arc rules bounce a swimming rival, pop a stuck one and nudge your
sperm. The glow is still in play and bounces rivals too. Your sperm always enters, by 60 s into the guard at the
latest. A **clean pick** is no rival held in the rush and no nudge of your sperm.

**The seal.** After `enter` (1.2 s, v1): "Tap to seal your shell." Only a press made after the prompt counts (the v1
fresh-press rule). The press, or 2.0 s with none ("Your shell seals itself."), sends the v1 wave round the shell from
the entry point and then out to the screen edge: every enzyme spark becomes a gold sparkle, every glow fades into
gold, and every other sperm drifts off. "Your shell seals." Each seal charge still kept adds 250 Flourish points. The
seal is not timed to a beat.

**Shell pips and the knock-out.** 6 pips (Assist 9), plus shield sparks (4.7). A pip goes for an enzyme spark on the
shell, for losing the last glow, and for a held rival. A crack blinks the shell by brightness only, with no red. At 0
pips: "Your shell needs a rest." Then the Almost card. Go on jumps to the rush with no rivals: everything else drifts
off, your sperm swims in within 2 s, enters, and the shell seals by itself. Exactly one `enter` still.

**Combo.** Each hit on a brick by a glow or a blocked spark within 1.5 s of the last adds 1 (the action layer's
multiplier, ×1 to ×2.5), shown as DOM number pops. A lost glow or a lost pip ends it.

**Score.** Goal 3,000 (unless a knock-out). Skill: 2,500 × min(1, hits taken off bricks / (0.75 × all the hits of the
bricks that came)); 1,500 × the share of pips left at `enter`; 1,000 × min(1, best combo / 15); 1,000 × the rush
credit (v1's guard credit over the 4 rush rivals: bounced 1, popped loose 0.5, held 0). Flourish: 500 for a clean
pick, and 250 for each charge kept to the seal (500 at most).

**Assist.** v1 (arc 50°, turn keys 720°/s, burrow 5.0 s), plus 9 pips, the glow at 28 to 40 u/s, the rim turning it
within 10°, enzyme sparks ×0.75 speed, shooters firing ×0.75 as often, a spark cap of 38, and Wide at 65°.

**One-button.** v1: hold and the arc tracks by itself (the bot at skill 1); let go and it holds still. While held,
the bot also releases the seal charge. The seal after `enter` is a fresh press of the button.

**Families.** Rotate (the arc) and tap (the seal). The guard's gesture is `drag`, as v1, and it takes a press as the
seal, the way `move` takes a press as the dash.

**Length.** Opening about 4.7 s; the waves to the swarm by 28 s at the latest (sooner when cleared); the swarm up to
14 s; the rush about 6 s; `enter` 1.2 s; the seal up to 2.0 s plus its 1.2 s wave; fusion 5 s; outro 2 s. Ref about
55 s, mid about 63 s; idle loses its glows and sparks reach the shell, so it is out at about 20 s into the guard,
then Go on. Cap 80 s.

**Facts** (priority; v1 order kept). Card `egg.surge` after "Now you are the egg.". Captions: `egg.fimbriae` (sweep),
`egg.zona` (W1), `egg.caps` (W2, as the first enzyme sparks fly), `egg.corona` (W3), `egg.choice` (W4; as built a
`result` fact: `pacing.test.mjs` found no room for it among the guard's lines), `egg.fuse`
(with "Let it in.", done by `enter`), `egg.block` (after "Your shell seals."). Overlay `egg.weeks`. Result:
`egg.frame` and the v1 result facts. The facts' pacing is checked by `pacing.test.mjs` as v1.

**Carry in.** v1: `sperm.hue`, `sperm.glow` and `sperm.place`.

**Look.** v1 row 2 (the peach and cream rings on the wine board, the corona dots, the cilia, the cream arc as the
brightest band). New: the glow as above; the rim as a dotted pale ring; blocked sparks cream and round; cracks as
short cut lines on the shell that fade when mended; power-ups as cream paper discs with a cut icon (three dots, a wide
fan, an arrow through a dot, an hourglass, a plus) and a DOM tag; the seal charge as a DOM ring; the rush's rivals
with the v1 dotted burrow ring and your sperm with the dashed ring. The arc stays the brightest band, and your gold
sperm the brightest cue while it comes.

**Sound.** v1 guard sounds; a soft pluck when the glow meets the arc, pitched by where it hits; a paper tick for each
hit on a brick and a soft pop when one drifts off; a low puff per enzyme volley; a bright tick when the arc blocks a
spark; a soft crack (never harsh) for a lost pip; a falling chime for a power-up and a catch chime; a rising shimmer
as the seal charge fills and a soft whoosh when it goes; a low soft chord at each swarm phase.

**Bot steering** (`botSteer`). The arc's target, in order: (1) the glow that will reach 16 u soonest within 1.2 s;
at skill 0.7 or more the bot sets the hit offset to send it toward the most brick hits within 20°, else it meets it
centred; (2) an enzyme spark that will reach the shell within 0.8 s, when no glow is due first (or both fit under the
arc); (3) a falling power-up within 40°, when nothing is due within 0.8 s; (4) the v1 target (divers and stuck
rivals). It never turns into the gold zone (v1). Noise σ = 25° × (1 − skill) and lag 0.15 s × (1 − skill), as v1. At
skill 0.5 or more it releases a seal charge when 6 or more sparks are within 30 u of the shell, or when a spark will
reach an open part of the shell within 0.5 s and the arc cannot cover it; at skill 1 it keeps one charge for the seal
once the swarm is in phase 3. At the seal it presses at once (skill 0.5 or more), else at 1.0 s ± 0.5 s × (1 − skill).

**Checks** (`stage-egg.test.mjs`, kept and extended). Kept: the arc controls and the arc-over-a-sperm rule both ways;
sticking, popping loose and held rivals that never enter; exactly one `enter`, yours, for every input, now including
a knock-out with Go on; the gold angle always found; at most 3 nudges and entry by 60 s into the guard; the
fresh-press rule at the seal; the ref bot makes 0 nudges; the turn-keys bot within 0.15 of the ref's score share.
New: no target in the stage, and the opening ends by 4.7 s; the glow leaves the arc at k × 55° for k = −1, 0 and 1;
the rim always sends it back to the arc's radius (no glow goes 10 s without crossing 16 u, over 20 seeds); a lost
last glow costs one pip and serves again after 1.0 s; bricks take 1, 2 and 3 hits and drift off; a re-forming ring
closes its gap within 2 s; waves come on time or sooner when cleared; sparks start at W2; each pattern shows its tell
at least 0.35 s before its first spark; a blocked spark turns back and takes a hit off a brick; a spark on the shell
costs one pip and clears the sparks within 20 u; the cap is never passed; each power-up is caught only by the arc and
does what it says for its time; the seal charge fills at 12, keeps 2, and clears every spark on screen; the swarm's
phases at a third and two thirds, and it drifts off at 4 members or 14 s; the rush's 4 rivals reach the shell within
1.5 s of your sperm, at least 60° apart; the seal by itself at 2.0 s; the gates of 4.5. Browser: the v1 layout and
input checks of the guard stay; `input.e2e.mjs` (a second-finger tap and Space release the seal charge, and the arc
does not move); `layout.e2e.mjs` (the rim, every brick, the boss bar and the charge ring inside the safe area and
under no HUD, prompt or caption box, in all three layouts); `visual.e2e.mjs` (sparks keylined; hits left read by dots
in greyscale; the arc still the brightest band; no red flash on a crack); `perf.e2e.mjs` (the swarm's phase 3 with 6
glows and 50 sparks).

### 5.3 Stage 3, The Embryo: first cells (`split`): roguelike. "Split."

**Fantasy.** You are a ball of new cells carried down the tube. Each day you clear a room, split, and pick a gift.
Your build grows; your ball keeps its size.

**Borrows.**
- **Hades:** after each room, pick 1 of 3 boons; boons stack into a build; a short, replayable run.
- **The Binding of Isaac:** one-screen rooms whose exit opens when the room is clear; items that stack; a boss room
  at the end.
- **Spelunky:** seeded runs that are the same for the same seed, so a run can be learned.

**Loop.** A room of germs, about 10 s. Your cells fire by themselves. Clear the room (or the tube carries you on at
the room timer). You split: 2, 4, 8, 16 cells. Each split adds a shot. Pick a gift. Next room. On Day 5 the boss room,
while your hollow fills. Then you hatch.

**Controls.** Move; dash; auto-fire. Gifts: swim into a bubble (4.6). Prompt "Drag to move. Tap to dash." and at a
pick "Swim into a gift."

**Moments and the clock.**

| Moment | gaDay | Length | What happens |
|---|---|---|---|
| `day1` | 15 → 16 | room ≤ 10 s, split 1 s, pick ≤ 3 s | 2 cells; room 1 |
| `day2` | 16 → 17 | the same | 4 cells; room 2 |
| `day3` | 17 → 18 | the same | 8 cells; room 3 |
| `day4` | 18 → 19 | the same | 16 cells (a morula); room 4 |
| `bloom` | 19 → 20 | ≤ 18 s | the boss room; the hollow fills as you play |
| `hatch` | 20 | 3 s | you slip out of your shell; input `none`; `meta.goOn` |
| `outro` | 20 | 2 s | you drift toward the soft lining |

gaDay follows each moment's progress (v1 4.1), so the clock reads Days 1 to 6 after fertilization.

**Tuning** (`split.tune.js`).

| Name | Value |
|---|---|
| Camera | span 120 u, fixed per room; orient `long` (the tube runs toward +y, the womb) |
| Room | x ±48 u, y from −40 to +60 u of the subject point (keeps you above 60% in portrait); soft walls; the exit at +y, a ring of cilia that opens when the room clears |
| You | the ball in its shell: body 7 u (it never grows), hitbox 2.5 u, speed 34 u/s; hp 4 pips (Assist 7) |
| Dash | 100 u/s for 0.18 s, cooldown 1.0 s |
| Cell shots | cream dots at the nearest germ within 50 u (built; design 70), 110 u/s, damage 1; shots in a fan 10° apart: 1 shot at 2 cells, 2 at 4, 3 at 8, 4 at 16; 3.3 volleys a second (built; design 3) |
| Room timer | 10 s; at the timer the germs left drift off ("The tube carries you on.") and the exit opens; a clear before the timer: "Clear!" and +300 points |
| Foes | germ kinds: drifter (`wander`, 10 u/s, 3 hp, contact 1 pip); chaser (`chase`, 24 u/s, 2 hp, wobbles 0.3 s before it lunges; built: 3 hp, walks at 18 u/s, wobbles 0.35 s with a line tell when within 36 u, then lunges at 55 u/s along it); puffer (`shooter` near a wall, 5 hp, fan of 3 sticky spores, `soft` tone, 22 u/s, every 2.0 s; built: 24 u/s every 1.5 s, the spores slow down and linger); splitter (Day 3 on: `wander`, 4 hp, pops into 2 small chasers of 1 hp) |
| Rooms | Day 1: 6 drifters, 2 chasers. Day 2: 4 drifters, 4 chasers, 2 puffers. Day 3: 4 chasers, 3 puffers, 2 splitters. Day 4: in two waves at 0 and 4 s, 6 chasers, 4 puffers, 3 splitters. Spawns use 0.6 s tells. Assist ×0.75. |
| Spore cap | at most 60 foe spores on screen |
| Split | at a room's end, 1 s, input `none`: the cells pinch in two with a paper bridge that shrinks; +1 shot |

**Gifts** (4.6; each stacks up to the level shown):

| Gift | Tag | Effect per level | Max |
|---|---|---|---|
| Quick | "Quick" | volleys +30% a second | 2 |
| Spread | "Spread" | +2 shots in the fan | 2 |
| Bounce | "Bounce" | shots bounce once off a wall (twice at level 2) | 2 |
| Sticky | "Sticky" | a hit slows a germ to ×0.6 for 1 s | 1 |
| Shell | "Shell" | +1 pip and heal 1 | 3 |
| Long dash | "Dash" | dash +40% far, cooldown −0.25 s | 2 |
| Orbit | "Orbit" | 2 cells orbit you at 12 u and pop what they touch (1 damage per 0.4 s); +2 cells at level 2 | 2 |
| Chain | "Chain" | a popped germ bursts into 4 small sparks that hit others for 1 | 2 |
| Magnet | "Magnet" | sparkles drift to you from 30 u (60 u at level 2) | 2 |

The bot's preference: Spread, Quick, Orbit, Chain, Shell, Bounce, Long dash, Sticky, Magnet.

**Boss: the Knot** (`bloom`). A big clump of old cells and germs blocks the tube's end, at +y 40 u. Foe kind `boss`,
body 14 u, 50 hp (Assist 38); the HUD shows a DOM boss bar. Built: 200 hp (Assist 152), its phases at the same shares (60% and 24%), since
the ref bot pops 50 hp in under 3 s; it is drawn as a clump of stacked sage and brown discs (render/action.js `look: "clump"`).
- Phase 1 (50 to 30 hp): a ring of 12 every 2.5 s at 24 u/s; 2 drifters every 5 s. Built: a ring every 2.0 s.
- Phase 2 (30 to 12 hp): a 2-arm spiral, 3 s on and 2 s off, 26 u/s; an aimed fan of 5 every 3 s.
- Phase 3 (12 hp and less): it rolls toward you at 8 u/s and puffs a fan of 3 every 1.2 s. Built: every 1.0 s.
- Each phase change: a 0.6 s pause with a charge tell, a low swell and 8 frames of hit-stop.
- At 18 s the Knot loosens by itself and drifts off ("The tube carries you past.").
- While you play, the hollow fills inside your ball (the blastocyst, Day 5), drawn as a growing pale disc.

**Hatch** (input `none`): your shell cracks into paper pieces that fall away, and you slip out: "You hatch."

**Score.** Goal 3,000. Skill: 3,000 × germs popped / germs that came (the Knot counts as 10); 1,500 × rooms cleared
before their timer / 5 (the boss room counts); 1,500 × pips left at `hatch` / 4. Flourish: 1,000 if the Knot pops
before 12 s. Built: the popped share's floor is the whole schedule (so a knock-out keeps only what it popped), the
Flourish within 13 s of the Knot's room start (its spawn tell is 1.2 s). Germs pop into sparkles; every 8 sparkles
mend a pip (built, so Magnet draws in something that matters). Bots over 20 seeds: skill 1 mean 9,810 (no knock-out),
0.7 9,570 and 0.5 9,480 (no knock-out), idle 4,130 (knocked out in 14).

**Knock-out.** "Your cells need a rest." The Almost card. Go on: the rooms left clear by themselves, each split
plays, and the stage jumps to `hatch`.

**Assist.** Hp 7; foes ×0.75; spores ×0.75 speed; the Knot 38 hp (built: 152 of its 200); dash cooldown ×0.7.

**One-button.** Hold: the bot moves you; it takes gifts by swimming into its first preference. Release: still.

**Length.** Ref: 4 × (about 6.5 s room + 1 s split + 1 s pick) + about 11 s boss + 5 s = about 50 to 58 s. Mid
about 72 s. Cap 100 s.

**Facts** (priority). Card `split.two`. Captions: `split.small` (Day 2 pick), `split.carried` (Day 3 pick),
`split.morula` (Day 4 pick), `split.inner` (the Knot's first phase change, if it fits; built: as the Knot's room starts, since
the ref bot pops the Knot about 5 s after its first change). Overlay `split.hatch`.
Result: `split.frame` and any that did not fit.

**Carry.** None in or out, except the shield sparks.

**Look.** v1 row 3: coral paper cells with pale cut edges inside the cream shell ring, on the violet-red tube. Inside
the ball, the cells are drawn as 2, 4, 8 and then 16 paper discs that get smaller; the ball keeps its size. Germs and
the Knot as 4.8. Gift bubbles cream. The room's exit is a ring of short paper cilia.

**Sound.** The v1 glassy pling per split, one step higher each day; soft plucks for pops with the combo; a warm chime
per gift; the Knot's phase swell; a soft crack and a rising tone at the hatch.

**Bot steering.** `actionSteer` with goal pull: toward the room's centre line, keeping 30 u from the nearest germ; in
a pick, toward its preferred bubble; at the boss, circle-strafe at 35 u.

**Checks** (`stage-split.test.mjs`, rewritten): the splits happen at each room's end for any input, and the ball's
drawn size never changes; shots per volley follow the cell count; 3 distinct gifts per pick, never one at its max,
seeded; a gift's effect applies (a test per gift); the room timer always opens the exit; the Knot's phases at 30 and
12 hp; it drifts off at 18 s; the hatch and the clock to Day 6; a knock-out with Go on reaches the hatch; the gates.
Browser: `layout.e2e.mjs` (the room and the bubbles inside the safe area; gift tags readable), `perf.e2e.mjs` (the
Knot's phase 2 with 16 cells and Orbit).

### 5.4 Stage 4, The Placenta (`root`): action-adventure. "Grow roots."

**Fantasy.** You burrow into the soft lining and explore it. You grapple from knot to knot, dig tunnels, and find 8
hidden food pools. Each pool makes your roots stronger.

**Borrows.**
- **The Legend of Zelda:** the hookshot (fire at an anchor and be pulled to it); a dungeon compass that pings the
  next secret; a payoff that changes the map.
- **Metroid:** a map that opens as you grow: longer reach after 3 pools, strong roots that dig firm tissue after 5.
- **Dig Dug** and **SteamWorld Dig:** tunnelling through soft ground, leaving a path you can use again.

**Loop.** Nestle in a soft spot. Then the lining: tunnel slowly through soft tissue, swim fast through your tunnels
and open fluid, grapple to knots and pool rims. Follow the compass ping to each pool. Link it: a glow runs back along
your roots. Pop the few germs that wander in. At 3 and 5 pools you gain reach and strength. When all 8 link, your
heart beats for the first time.

**Controls.** Move; the dash is the **grapple** ("Tap to grapple."): it fires a root tendril the way you move, snaps
to the nearest knot or pool rim within a 30° cone and its reach, and pulls you there. Auto-fire: root sparks.

**Moments.**

| Moment | gaDay | Length | What happens |
|---|---|---|---|
| `nestle` | 20 → 23 | ≤ 8 s | "Drag to drift." 3 soft spots; swim into one; idle 5 s and the nearest draws you in (3 s) |
| `roots` | 25 → 35 | ≤ 58 s; jumps to 35 when all 8 link | the lining map |
| `heart` | 36 | 6 s | the first heartbeat (the climax); input `none` |
| `grow` | 36 → 49 | 7 s | v1, unchanged; input `none` |

`meta.goOn` is `heart` (the pools left link at once first: "The roots reach them anyway.").

**Tuning** (`root.tune.js`).

| Name | Value |
|---|---|
| Camera | span 100 u in `nestle`; 160 u in `roots`, following you with a 0.3 s ease; 160 u in `heart`; 320 u in `grow` (v1) |
| Map | 300 × 300 u round your nestle point, a seeded grid of 12 × 12 tiles of 25 u: soft (60%), open fluid (25%), firm (15%, in clusters that wall off 2 pools) |
| You | body 4 u, hitbox 1.7 u; speed 40 u/s in open fluid and your tunnels, 16 u/s in soft tissue (you cut a tunnel 8 u wide as you go), firm tissue blocks you until strong roots; hp 5 pips (Assist 8) |
| Grapple | range 60 u (90 u after 3 pools); snaps within a 30° cone to the nearest knot or pool rim; pulls you at 140 u/s with i-frames; into firm tissue it sticks and pulls you to the wall; into open fluid with nothing to snap to it retracts in 0.3 s; cooldown 0.8 s |
| Knots | 14 small paper anchors, seeded, at least 30 u apart, on tile edges |
| Pools | 8 gland pools, radius 12 u (Assist 16), seeded 50 to 140 u from your start, at least 40 u apart: 3 in open fluid near the start, 3 behind soft tissue, 2 behind firm walls. Milk-white with dotted rims (v1); they swell on her beat |
| Linking | enter a pool: it links, a glow runs back along your tunnel and roots over 0.8 s, "+1 root" |
| Reach | 3 pools: "Your roots reach further." (grapple 90 u). 5 pools: "Your roots grow strong." (you dig firm tissue at 12 u/s) |
| Compass | every 4 of her beats, a soft ripple runs out from the nearest unlinked pool; when it is off screen, a cream arrow sticker at the screen edge points to it (the stage 1 widget) |
| Germs | 2 wanderers at the start, +1 every 8 s up to 5 on the map: `wander` 12 u/s, `chase` 20 u/s within 30 u, 2 hp, contact 1 pip. A guard germ (`shooter`, 6 hp, a fan of 3 at 20 u/s every 2.2 s) sits by each firm-walled pool |
| Root sparks (auto-fire) | 3 a second at the nearest germ within 50 u, 90 u/s, damage 1 |
| Auto-link | from 30 s into `roots` (Assist 22 s), the nearest unlinked pool links by itself every 4 s ("The roots reach it anyway."), so all 8 link by 58 s at the latest |
| Tree | the v1 space-colonization tree grows along your tunnels and to each linked pool (v1 caps: 260 nodes) |
| Peaks | 5 germs, 2 guard germs, at most 24 foe sparks, 14 knots, 8 pools |

**Climax: the first heartbeat** (`heart`, Day 22). The world hushes for 1.5 s: germs freeze, her heart drops 8 dB,
the light dims 10% (v1). Then your own heart beats by itself at 110 bpm. Each of your first 8 beats sends a bright
pulse down the root tree, and each pulse pops every germ within 40 u of the tree into confetti. "Your heart beats for
the first time." then "This beat is yours." No taps: the beat is felt and seen. Both hearts then play together.

**Score.** Goal 3,000. Skill: 3,000 × pools you linked yourself / 8; 1,500 × hidden pools you linked yourself / 5
(the 3 behind soft tissue and the 2 behind firm walls); 1,500 × pips left at `heart` / 5. Flourish: 1,000 if you link
all 8 yourself before 40 s into `roots`.

**Knock-out.** "You need a rest." The Almost card. Go on: the pools left link, and `heart` and `grow` play.

**Assist.** Hp 8; pools radius 16 u; auto-link from 22 s; germs ×0.75; guard sparks ×0.75 speed.

**One-button.** Hold: the bot paths to the nearest reachable unlinked pool (A* over the tiles, soft tissue costs
2.5×) and grapples when a knot lies on the path. Release: you rest.

**Length.** Nestle 3 to 8 s; roots ref about 30 s, mid about 40 s, idle 58 s (unless knocked out first); heart 6 s;
grow 7 s. Ref about 52 s, mid about 62 s, idle about 79 s. Cap 90 s.

**Facts** (priority). Card `root.bury`. Captions: `root.hcg` (as `roots` starts), `root.glands` (the first link),
`root.heart` (the hush). Overlay `root.w7`. Result: `root.frame`, `root.grows`, `root.tube`, `root.size`, `root.buds`.

**Carry out.** `nestleX` (the spot you chose), `treeSeed`.

**Look.** v1 row 4: deep red lining sheets. Soft tissue is the front sheet `#7a1e34`; your tunnels are cut out of it
and show the deep lining `#5c1428` (baked per tile; a tile is re-baked only when a tunnel crosses it). Firm tissue is
a darker sheet `#44101e` with rows of cut dots. Knots are small cream paper discs with an ink keyline. The tendril is
a pale coral strip. Pools and the tree as v1. The heart pulses are cream beads that run down the tree.

**Sound.** A soft crunch while you tunnel; a springy pluck as the grapple snaps and a whoosh as it pulls; the v1 bloom
chime per link; a soft ping for the compass; your first heartbeat, then both hearts.

**Bot steering.** Goal: the nearest reachable unlinked pool by A*; grapple when a knot within reach is on the path
and the cooldown is ready; `actionSteer` for germs and sparks.

**Checks** (`stage-root.test.mjs`, rewritten): the map is the same for the same seed; every pool is reachable (by
tunnel, or after strong roots, or by auto-link); soft tissue slows you and leaves a tunnel; firm tissue blocks you
until 5 pools; the grapple snaps only within its cone and range; auto-link links all 8 by 58 s with no input; the
`heart` moment pops every germ near the tree and asks for no input; the pools are never red (v1); the clock reads
"Day 22 after fertilization (week 5)" at the hinge; a knock-out with Go on reaches `grow`; the gates. Browser:
`layout.e2e.mjs` (v1 thumb rule: you stay above 60% in portrait; the compass arrow in the safe area; the scale bar
under the clock), `input.e2e.mjs` (landscape drag right moves forward; Space grapples), `perf.e2e.mjs` (a frame
that re-bakes a tunnel tile is left out of the cost, as v1 bake frames are).

### 5.5 Stage 5, First Trimester (`grow`): twin-stick style shooter. "Grow with your heart."

The foundation builder builds this stage with the action layer, and `contract.md` specifies it. In short, to match
the user's plan:

- **Fantasy.** Weeks 7 to 13 in the clear sac. Germs drift in from outside. Your new heart powers your shots.
- **Borrows.** Geometry Wars and Robotron 2084 (arena waves from the edges, spawn warnings); Enter the Gungeon (a
  dodge dash with i-frames, a boss with readable phases).
- **Loop.** Weeks 7 to 12 bring one wave of germs and blobs each through the sac's wall: chasers, wandering
  spores, blobs that aim a shot or a fan, rings that circle you and send out a ring. Your sparks fire by themselves
  at the nearest germ. Cleared germs drop food, and food grows your sparks (rate, spread, pierce, strength), a
  shooter's power-up curve. Each wave ends with a short rest: the food is drawn in and the cord brings a heal.
- **Boss.** The big germ at week 13, in three phases: a spiral with buds, aimed fans and rings, a rush with a ring
  as it stops.
- **Kept.** The cord and placenta disc where you nestled (`nestleX`, `treeSeed`); "Week 10. From about now you are
  called a fetus. ..." at gaDay 70; the pools turn red with wavy rims from gaDay 84 (the v1 requirement stands).
- **Knock-out** with the Almost card; Go on as `contract.md` sets.
- **A design idea for the builder** (optional, not a gate): let the fire rate follow your own heart's curve (130 bpm
  at week 7, 170 at weeks 9 to 10, about 155 at week 13), so the peak heart is the peak firepower.
- **Facts.** v1 6.5's list in priority order, plus `grow.frame` on the run result.
- **Length.** Six waves of about 9.7 s with their rests, then the boss and a 1.4 s victory beat: about 92 s for
  the ref and mid bots (as built). Cap 120 s.
- **Difficulty pass (as built).** The bots maxed the old score in every seed, so the waves press harder and the hits
  set the grade. Shooters fire sooner and faster (the aimed stack of 3 at 32 to 41 u/s every 1.1 s; week 7 keeps a
  gentler blob of 2 at 28 u/s), they have a little more hp, week 11 adds a toxin waver, and your sparks start slower
  and grow later, so the shooters live long enough to press you. A hit gives 1.4 s of i-frames and clears shots
  within 12 u. Score: Goal 3,000; Skill 1,200 for germs cleared (combo score over the value × 1.6) and 4,800 for
  dodging, less 1,600 a hit; Flourish 1,000 × best combo / 25. So no hit is Glowing, 1 or 2 hits Great, 3 or more
  Good. Over 100 seeds the shared bot takes about 0.8 hits at skill 1 and at 0.7 (it dodges about as well at both
  here) and about 3 at 0.5, with no knock-out: skill 1 Great or better in about 93, 0.7 mostly Great, 0.5 Good in
  about 65. Check: `sim.test.mjs` (the grade spread) and `stage-grow.test.mjs`.

### 5.6 Stage 6, Second Trimester (`answer`): rhythm. "Listen. Then answer."

The one rhythm stage. No hp, no foes: a breather between the two peaks.

**Fantasy.** {Carer}'s heartbeat, then {carer}'s voice, reach you through the wall. You kick back in time, in the
lane the sound comes from.

**Borrows.**
- **Rhythm Heaven:** call and response; a simple cue, then your echo; a last remix that strings it all together.
- **Crypt of the NecroDancer:** moving on the beat is the action; an arrow press moves you a lane and counts as the
  hit.
- **Guitar Hero** and **osu!mania:** a note highway in lanes; a streak that lights a bonus (star power).

**Loop.** Notes ripple down three lanes from the wall to your ring. Be in the note's lane and press on its beat:
a kick. First her heartbeat in the middle lane; then six hummed phrases you echo in their lanes; then the whole song
straight through, with a fever streak.

**Controls.** Families `tap` and `steer`.
- **Lanes:** drag left or right; past 24 px from the touch-down point (or the stick's x past ±0.4) you slide one lane
  and stay there when you lift. Desktop: the left and right arrows or A and D move one lane on keydown.
- **The kick:** a press (touch-down, Space, Enter or Z), judged at touch-down by the v1 judge. An arrow keydown both
  moves the lane and counts as the press, in the new lane (NecroDancer). For touch, the lane is checked at the press
  and again 0.12 s after it, so a flick into the lane counts.
- **Keys alone** play everything. The mouse is optional.

**Moments** (her 78 bpm, P_beat 0.769 s, no jitter; the v1 judge: In time ±min(70 ms, 0.12 P), Close ±min(170 ms,
0.28 P)).

| Moment | gaDay | Length | What happens |
|---|---|---|---|
| `hear` | 105 | 3 s | Her heartbeat turns from felt to heard (v1). |
| `beat` | 105 → 126 | 6 notes, every 2nd beat (P 1.54 s), about 9.2 s | "Kick with {carer}'s heartbeat." All in the middle lane. |
| `phrases` | 133 → 168 | 6 phrases of 9 beats, about 41.5 s | Call: 4 beats; her notes show as gold ripples in their lanes. Answer: 4 beats; ghost ripples show each slot and lane. Then 1 beat of gap. |
| `song` | 168 → 175 | 17 beats, about 13 s | The sing-along: the 16 call notes back to back in their lanes, then a jump note. |
| `eyes` | 175 → 182 | 4 s | v1: your eyes open by themselves. Input `none`. |
| `outro` | 189 → 195 | 3 s | Input `none`. |

**Phrases** (notes per beat: L, M, R a lane, `.` a rest): P1 `M...`, P2 `L.R.`, P3 `LM.R`, P4 `R.LM`, P5 `LMR.`,
P6 `RMLM`: 16 notes. Notes in a phrase are at least one beat apart (0.769 s ≥ 0.5 s). Each note's pitch is the v1
seeded pentatonic walk; its lane is fixed by the pattern. A phrase answered with at least 75% of its notes Close or
better brings "{Carer} feels you." and, from phrase 2, the warm hand glow (v1).

**The sing-along** (`song`). The 16 notes of the phrases, in order, one per beat, in their lanes. The 17th is the
**jump note**: a big ring across all three lanes ("A loud noise can make you jump."), and a press in any lane counts.
**Fever:** 8 In time notes in a row light the hand glow round your ring; while it is lit, each note's credit counts
×1.5 toward the song part (capped at the part's max). A miss ends the fever. A streak meter of 8 cut paper pips
under your ring (filled gold discs against hollow dotted ones) counts the In time streak in the phrases and the
sing-along, so a streak carried out of the phrases starts the sing-along lit; "Singing together" pops as it lights.
The jump note gives a small shake (at most 3 px, none with reduced motion).

**Targets and preview.** Every note is a target of kind `tap` with its P and a lane. Each is visible at least
max(2 beats, 1.2 s) ahead (v1). A press away from any open target is free. Each target has a DOM ring in `svg#rings`.

**Score.** Goal 3,000. Skill: 1,000 × beat accuracy (6); 3,000 × answer accuracy (16 notes, lane and time); 2,000 ×
song accuracy (17, with the fever). Flourish: 1,000 × min(1, best In-time streak / 24). A note in time but in the
wrong lane is "Close" at best.

**Misses.** A miss only adds less. The voice never stops. No hp.

**Assist.** Windows ×1.6 (Close capped at 0.4 P); any lane counts.

**One-button.** The run sets your lane to the next note's lane (`botSteer` returns `dir`), so you only press on the
beat.

**Length.** 3 + 9.2 + 41.5 + 13.1 + 4 + 3 = about 74 s for everyone. Cap 90 s.

**Facts** (priority). Card `answer.card` and `answer.tri`. Captions: `answer.hear` (hear), `answer.feel` (beat, as
the clock reaches week 16), `answer.respond` (phrase 1), `answer.w20` (phrase 2), `answer.low` (phrase 4),
`answer.jump` (the jump note). Overlay `answer.eyes`. Result: `answer.outside`, `answer.hic`. Hum lines ("♪ voice,
left: 3 notes") name the lanes.

**Carry out.** `song = { notes: the 16 call notes, lit: a mask of notes answered Close or better in the phrases or
the song }`.

**Look.** v1 row 6: amber and honey sheets, the dapple at 25%. The three lanes are paper strips with cut cream dashes
running from the warm patch on the wall down to you. Notes are the v1 gold voice ripples riding the lanes; answer
slots are ghost ripples with cut dashes. Your ring sits at the lanes' foot. The jump note is a wide ring.

**Sound.** v1: the sine hum through the womb filter, opening from 250 to 450 Hz over the stage; your kicks are soft
low thumps, and each kick on a hummed note plays that note back an octave up as a soft pluck (`answer.echo`, Rhythm
Heaven: your answer makes the sound); the fever adds a soft chord under the hum; the jump note a soft "boom" from outside.

**Bot steering.** `dir` toward the next note's lane; the shared bot timing presses at `target.t` + gauss·σ (v1
16.11).

**Checks** (`stage-answer.test.mjs`, rewritten): no phrase before gaDay 133 (v1); patterns and lanes as listed;
spacing ≥ 0.5 s and preview ≥ max(2 beats, 1.2 s) (`track.test.mjs`); a press in the wrong lane is at best Close; an
arrow keydown moves and presses; a touch flick into the lane within 0.12 s counts; the fever multiplies only the song
part and never passes its max; the jump note counts in any lane; `song.lit` reflects the answers; the voice never
stops on a miss; ref Great or better, one-button reaches Great. Browser: `input.e2e.mjs` (lanes by drag in portrait
and landscape; arrows on desktop; muted rings at their preview time), `layout.e2e.mjs` (lanes and your ring above
60% in portrait; captions name the lane).

### 5.7 Stage 7, Third Trimester (`turn`): survivor auto-shooter. "Turn and breathe."

**Fantasy.** {Carer}'s antibodies cross the placenta and guard you. Germs come in hordes; the antibodies fire for
you. You grow stronger, the space gets snug, and then you turn head-down.

This is true biology: most of {carer}'s antibodies cross the placenta in the third trimester (`turn.antibody`).

**Borrows.**
- **Vampire Survivors:** weapons fire by themselves; foes pop into gems (here, sparkles) that you collect to level
  up; at each level, pick 1 of 3 upgrades; the horde ramps with time; a big wave and an elite near the end.
- **Brotato:** short, timed waves; a clear moment at the end of each that pulls every pickup to you.
- **20 Minutes Till Dawn:** a few strong weapon picks rather than many small ones.

**Loop.** Move to dodge the horde and sweep up sparkles. The antibodies (Y darts) fire at the nearest germ. Fill the
grow meter, pick an antibody gift, grow stronger. The arena slowly gets snug. A big wave with the Big Germ. Then all
germs clear, you turn head-down, and you rest while your song is hummed.

**Controls.** Move; the dash is a **kick** ("Tap to kick.") that knocks germs back. Gifts by swimming into bubbles
(4.6).

**Moments.**

| Moment | gaDay | Length | What happens |
|---|---|---|---|
| `waves` | 196 → 245 | 60 s | the survivor waves |
| `turn` | 245 → 252 | ≤ 6 s | "Drag down to turn head-down." Input `move`; at 6 s you turn by yourself; `meta.goOn` |
| `rest` | 259 → 280 | 10 s | "Rest. Keep your thumb on the screen." v1, unscored; the song hummed |
| `outro` | 280 | 3 s | "Week 40. You are ready." |

**Tuning** (`turn.tune.js`).

| Name | Value |
|---|---|
| Camera | span 140 u, fixed; orient `fit`; the arena's centre at 38% of the height in portrait (its bottom stays above 60%) |
| Arena | round, radius 54 u at the start, easing to 38 u from 20 to 55 s ("It gets snug in here."); its wall is the soft womb |
| You | the fetus figure (v1 14.4): body 6 u, hitbox 2.4 u, speed 30 u/s; hp 6 pips (Assist 9) |
| Kick (dash) | 80 u/s for 0.2 s, cooldown 1.4 s; germs within 14 u are knocked back 20 u and take 1 damage |
| Starting weapon | Y darts level 1: 1 dart every 0.6 s at the nearest germ within 60 u, 90 u/s, damage 2, passes through 1 |
| Sparkles (`up`) | every popped germ drops 1 (the Big Germ 12); magnet 18 u |
| Levels | the grow meter levels up at 5, 14, 27, 44, 66 and 92 sparkles (6 levels; built: the first gift at about 8 s); each level offers 3 gifts. The meter is a cream sweep round you that fills toward the next level |
| Foes | drifter (`wander` then `chase` within 40 u, 14 u/s, 3 hp); swarmer (`chase` 22 u/s, 1 hp; comes as a ring of 12 round you at 50 u that closes in); puffer (`shooter`, 6 hp, a fan of 3 at 22 u/s every 2.5 s); the Big Germ (elite: `boss`, body 10 u, 72 hp (built; 40 popped too soon), `chase` 8 u/s, a ring of 12 at 24 u/s every 3 s, 2 swarmers every 4 s; at half hp two rings 0.3 s apart every 2.2 s). Contact 1 pip. A puffer leaves a heal 30% of the time (built). |
| Foe cap | 40 on screen; at most 50 foe sparks |

**Antibody gifts** (each up to level 3):

| Gift | Tag | Level 1 | Each level after |
|---|---|---|---|
| Y darts | "Darts" | (the start weapon) | +1 dart a volley, volleys 15% faster |
| Tag ring | "Ring" | 2 antibodies orbit at 16 u; 1 damage per touch, once per germ per 0.4 s | +1 antibody, +2 u |
| Clump | "Clump" | every 3 s the densest group within 50 u is pulled together and pops for 3 damage in 12 u (antibodies clump germs together) | every 2.5 s, then 2 s |
| {Carer}'s beat | "Beat" | every 4 of her beats, a warm ring pulse of 30 u pushes germs back 15 u and does 1 damage | radius 40, then 50 u |
| Snug | "Snug" | +1 pip and heal to full | the same |
| Big kick | "Kick" | kick knock-back ×2, cooldown −0.3 s | the same |
| Grow | "Grow" | sparkle magnet +50% | the same |

The bot's preference: Y darts, Tag ring, Clump, Beat, Snug, Big kick, Grow. Built: while one of Y darts, Tag ring,
Clump and Beat can still grow, each offer holds at least one of them (a few strong antibody picks, as 20 Minutes Till
Dawn), so no level offers only Snug, Kick and Grow.

**Waves** (seconds into `waves`; Assist ×0.75 counts):

| Time | Spawns |
|---|---|
| 0 to 12 s | a drifter every 1.0 s from the arena edge |
| 12 to 24 s | a drifter every 0.75 s; a puffer every 6 s |
| 24 to 36 s | a pair of drifters every 0.7 s (built: they come in side by side, 6 u apart); a puffer every 6 s; a swarmer ring at 26, 31 and 35 s |
| 36 to 48 s | a pair of drifters every 0.6 s (built; was one every 0.5 s); a puffer every 4 s; a swarmer ring at 40 and 45 s |
| 48 to 60 s | the Big Germ at 48 s from the far edge, with a pair of drifters every 0.8 s (built) |
| 60 s | every germ left pops at once ("{Carer}'s antibodies clear them all."), and every sparkle is pulled to you (`vacuum`) |

Each wave start (at 12, 24, 36 and 48 s) has a 1 s calm with a soft swell, where a fact may show.

**Climax.** The Big Germ wave, then the clear at 60 s, then **the turn**: "Drag down to turn head-down." Drag (or
hold S or the down arrow) down past half deflection for 1.0 s in all and you turn head-down; or at 6 s you turn by
yourself: "Most babies turn head-down by 36 to 37 weeks. You turn now."

**Score.** Goal 3,000. Skill: 2,500 × germs popped / germs that came; 1,500 × levels reached / 6; 1,000 × pips left
at 60 s / your max pips; 1,000 if you turn yourself. Flourish: 1,000 if the Big Germ pops before 60 s.

**Knock-out.** "You need a rest." The Almost card. Go on: "{Carer}'s antibodies clear them all.", then `turn` (by
itself) and `rest`.

**Assist.** Hp 9; foes ×0.75; sparks ×0.75 speed; the Big Germ 54 hp (built); levels at ×0.8 the sparkles.

**One-button.** Hold: the bot kites the horde in a wide circle and sweeps sparkles; it takes gifts in its order, and
it drags down at the turn. Release: still (the antibodies keep firing).

**Length.** 60 + about 2 (turn) + 10 + 3 = about 75 to 78 s. Cap 100 s.

**Facts** (priority). Card `turn.card`. Captions: `turn.antibody` (at 1.0 s, as the first darts fly), `turn.lungs`
(12 s calm), `turn.months` (24 s calm), `turn.focus` (36 s calm), `turn.practice` and `turn.curl` (in the rest),
`turn.head` (the turn line). `turn.voices` in the rest if it fits. Overlay `turn.voice`. Result: `turn.frame` and any
that did not fit.

**Carry in.** `song` (hummed in the rest), `nestleX`, `treeSeed` (the placenta disc sits at the arena's edge, and the
antibodies stream from it toward you as small paper Ys).

**Look.** v1 row 7: ember orange sheets, the dapple at full. Antibodies are small cream paper Ys with an ink keyline.
Sparkles are tiny cream stars. Germs as 4.8. The arena's wall is the snug wall sheet `#e8925a`, cut, closing in. The
Big Germ is a large stacked paper construct. Darts and germ sparks end at the wall (as built: the action layer's
`wallCull` 0 here; they flew up to 6 u past it before). In portrait the caption band follows your body as in stages
1, 3 and 4: it moves to the top band when you go low in the womb, and back to its own band once your body has been
clear of that band for 0.8 s; a caption too tall for the low band rises in it, so it still ends above 60%.

**Sound.** The womb filter at about 600 Hz (v1). Soft plucks for pops; the level-up chime; her heartbeat louder when
you take the Beat gift (as built: the stage sends `turn.beat` with the gift's level, and her heart bus rises 2.5 dB at
level 1 up to 4.5 dB at level 3, with a warm thump, until the next stage); the clear at 60 s is a warm swell; the turn a slow whoosh; the rest is v1's muffled hum.

**Bot steering.** `actionSteer` with goal pull: kite in a circle at 60% of the arena radius, keep 20 u from the
nearest germ, sweep toward sparkle clusters when safe; kick when 3 or more germs are within 14 u; at the turn, steer
down.

**Checks** (`stage-turn.test.mjs`, rewritten): the wave table; the arena eases from 54 to 38 u; level thresholds and
3 distinct gifts each; each gift's effect; the clear at 60 s pops every germ; the turn by itself at 6 s with its line;
the rest is not judged and the score does not change in it; a knock-out with Go on reaches the rest; the clock reads
weeks 28 to 40; the gates. Browser: `perf.e2e.mjs` (48 to 55 s, the Big Germ wave with 40 foes and the Tag ring at
level 3), `layout.e2e.mjs` (the arena and you above 60% in portrait).

### 5.8 Stage 8, Birth (`birth`): endless-runner escape. "Ride the waves."

**Fantasy.** The waves of birth push you on. You slip down the soft channel toward the light, faster with each wave.

**Borrows.**
- **Subway Surfers:** three lanes; slide between them; a move to slip under a gap (here, the tuck).
- **Canabalt:** you never stop; the speed ramps; obstacles come from a seeded generator that is always passable.
- **Alto's Adventure:** a calm runner: flowing, gentle, no fail screen.

**Loop.** Each contraction is a surge of speed; between them you slow and rest. Slide between lanes to pass the soft
folds. Tuck to slip through the tight gaps. Hit the four gates of the birth moves: Tuck, Turn, Lift and Turn back.
Collect calm bubbles. After the 8th wave, the light.

**Controls.** Families `steer` and `tap` (move and tuck; no auto-fire).
- **Lanes:** drag left or right; you move sideways at 70 u/s × the stick's x and settle on the nearest lane when the
  stick is near 0. Desktop: A and D or the arrows move one lane per keydown.
- **Tuck (the dash):** a quick tap, another finger's tap, Space, Enter or Z: for 0.5 s you curl small (hitbox from
  3 u to 1.5 u) and pass tight gaps. Cooldown 0.9 s.
- No auto-fire, no foes, no hp.

**Moments.** `waves` (input `move`), then `light` (input `none`, v1). gaDay 280. Her 76 → 92 bpm over the waves (v1).

**Tuning** (`birth.tune.js`).

| Name | Value |
|---|---|
| Camera | span 120 u; orient `fit` (world up is screen up; head-down stays down); you at 25% of the height in portrait and 30% in landscape and desktop, so the way ahead (down, toward the light) fills the screen below you |
| Channel | 60 u wide between the straight plum side flats; lanes at x = −18, 0 and +18 u |
| You | the baby figure, body 5 u, hitbox 3 u |
| Waves | 8 waves from 2.0 s, one every 7.5 s: a 1.0 s warning ring, a 5.0 s surge, a 1.5 s rest. The last surge ends at 62.0 s |
| Speed | rest 22 u/s; surge 50 u/s (wave 1) rising by 4 u/s a wave to 78 u/s (wave 8); ramps over 0.6 s |
| Folds | soft plum flaps from a side flat that block 1 or 2 lanes; during surges, one every 1.1 s (wave 1) down to 0.7 s (wave 4's end of that ramp), then denser in waves 5 to 8: one every 0.7 s down to 0.58 s; never closer than 0.7 s of travel to the last (0.55 s in waves 5 to 8); at least one lane always open, or a tight gap |
| Tight gaps | from wave 3, one in five folds leaves only a tight gap in one lane (one in three or so from wave 5): pass it tucked, or bump. The tuck is shorter late: 0.5 s to wave 4, then 0.44 s (wave 5) down to 0.34 s (wave 8), a narrower window |
| Bump | touching a fold untucked (or a tight gap untucked): your speed drops to 22 u/s for 0.6 s, the flow streak ends, a soft boop. No hp. The next surge carries you on. |
| Calm bubbles | 3 per wave in the open lanes, +100 points each, a small chime |
| Gates | wave 2 **Tuck**: a tight gate across all three lanes, tuck through it. Wave 4 **Turn**: a turn gate in the left or right lane (seeded), marked by the marigold arrow; steer into it and you turn that way; it writes `turnDir`. Wave 6 **Lift**: a lift gate in the middle lane; tuck through it (you lift your head as you pass). Wave 8 **Turn back**: a turn gate on the other side from wave 4 (from `turnDir`). Each move plays on its wave either way ("The wave moves you on anyway."). |
| Peaks | 6 folds and 6 bubbles on screen at most; no foe bullets |

**Climax.** Wave 8 is the fastest, with Turn back, then the v1 light: the bottom glow rises to fill the screen,
exposure 1 to 6 over 2.0 s, white 0 to 1 over 1.0 s, hold 0.5 s, the sound opens to 16 kHz. Folds stop at the end
of wave 8, so the light is never framed by flaps.

**Score** (not shown at the end of this stage, v1; the HUD counts it live as you ride, with tags beside you). Goal 3,000. Skill: 3,500 for
the folds, less 400 a bump (none left from 9 bumps); 400 a gate you hit (1,600); bubbles 100 each up to 900. Flourish:
1,000 × min(1, best flow streak / 30). Retuned so the grade follows your bumps (it was 2,500 × clean folds / folds,
500 a gate, bubbles to 1,500 and a flow of 20, and even skill 0.5 glowed): no bump is Glowing, about 4 to 7 Great,
8 or more Good. Over 40 seeds the shared bot bumps about 0.4 times at skill 1 (Glowing every seed), about 5 at 0.7
(Great in 28 of 40) and about 8 at 0.5 (Good in 29 of 40); idle about 18 (Good). While you ride the HUD counts each
clean fold against the folds planned less 400 a bump so far, so it dips at a bump; the end's share is never less.

**No knock-out.** A bump only slows you. Birth always happens on schedule.

**Assist.** Surge speeds ×0.8; folds every ×1.4 longer; gates and tight gaps 30% wider; bumps cost 0.3 s.

**One-button.** Hold: the bot takes the open lane and tucks at tight gaps and gates. Release: you keep your lane.

**Length.** 65.5 s for everyone (the waves end at 62.0 s, then the 3.5 s light). Cap 80 s.

**Facts.** Card `birth.card`. Captions (one line in portrait): `birth.fast` (wave 1 rest), `birth.waves` (wave 1
surge), `birth.tuck` (the Tuck gate), `birth.turn` (the Turn gate), `birth.skull` (wave 6 rest), `birth.overlap`
(wave 7 rest). Those that do not fit go to the result.

**Look.** v1 row 8: straight plum side flats, darker toward the viewer, press in a little on each surge (not with
reduced motion); the folds are plum paper flaps cut from the side flats, each touching only one side, so no closed
ring of sheet edges ever forms (v1 13.1); the lanes are faint cut dashes; the opening is only light at the bottom.
The marigold arrow stickers mark the turn gates.

**Sound.** v1: deep swells per wave (brown noise 40 to 80 Hz) and her slow breath; a soft whoosh as the surge
starts; a soft boop on a bump; small chimes for bubbles; a warm chord at each gate. Never a sound of pain.

**Bot steering.** Goal: the open lane of the next fold within 1.2 s of travel; tuck 0.15 s before a tight gap or a
tuck gate; at a turn gate, its lane. Below skill 1, a reaction lag of 0.4 s × (1 − skill) and a wrong lane with
chance 0.3 × (1 − skill).

**Checks** (`stage-birth.test.mjs`, rewritten): 8 waves at their times; the stage ends at 65.5 s for every input;
every fold pattern leaves an open lane or a tight gap; a bump only slows you and never changes hp or the end time;
the four gates and `turnDir`; the light ramp (v1); no foe or bullet in the stage. Browser: `visual.e2e.mjs` (v1: the
light touches the bottom edge across 90% of the width and no closed ring of sheet edges; no flap at the light),
`input.e2e.mjs` (lanes by drag in portrait and landscape; arrows on desktop; tuck by tap and Space).

### 5.9 The ending

Unchanged (v1 6.9). A thumb still down from the stage 8 drag must lift and press again to start the breath (the
fresh-press rule).

## 6. Sources for new techniques (AGENTS.md rule)

| Technique | Source adapted |
|---|---|
| Bullet patterns as small parametric emitters | Kenta Cho, BulletML (ABA Games, 2003); Touhou Project's danmaku forms (rings, spirals, aimed fans) and its small hitbox inside a bigger body |
| A bomb that cancels bullets | Touhou Project's and DoDonPachi's bomb (every bullet on screen becomes points), filled here by play as a seal charge |
| Telegraphs before every attack | the wind-up convention of action games, as `action.js` cites |
| Juice: hit flash, shake, hit-stop | Jan Willem Nijman, "The Art of Screenshake" (INDIGO 2013); Martin Jonasson and Petri Purho, "Juice it or lose it" (2012); Masahiro Sakurai on hit-stop, "Masahiro Sakurai on Creating Games" (2022) |
| Drift and mini-turbo, items by place | Mario Kart (drift sparks blue, orange, pink; item boxes; an item table weighted by place as fair catch-up) |
| Knockout racing | Mario Kart World's Knockout Tour and F-Zero 99 (only the first N go on at each checkpoint; a live count) |
| A racing line and a turning chase camera | Forza Motorsport's drawn racing line; the camera turns with the track's direction, after top-down racers such as Micro Machines |
| Slipstream and slingshot | the drafting rule of racing games (Mario Kart, Forza): speed in a rival's wake, a burst on pulling out |
| A radial brick breaker | Arkanoid (Taito, 1986) and Breakout (Atari, 1976): the return angle by where the ball meets the paddle, multi-hit bricks, falling capsules; radial Pong games such as Circle Pong (the paddle on a ring); Super Hexagon (turning round a centre under pressure) |
| Divers that leave a formation | Galaga (Namco, 1981) |
| Picks as bubbles in the world | Hades (pick 1 of 3); Vampire Survivors (level up, pick 1 of 3) |
| Rooms, stacking items, a boss room | The Binding of Isaac |
| Hookshot and gated exploration | The Legend of Zelda (hookshot, dungeon compass); Metroid (ability gates) |
| Tunnels cut in a sheet, baked per tile | the destructible-terrain bitmap of Worms (Team17) and Dig Dug's tunnels; here a cut mask per 25 u tile, re-baked only when a tunnel crosses it |
| A note highway with lanes and a streak bonus | Guitar Hero (star power) and osu!mania; move-on-beat from Crypt of the NecroDancer; call and response from Rhythm Heaven |
| A survivor wave table and an elite | Vampire Survivors (spawns by time, a foe cap, gems, an elite near the end); Brotato (short waves, a vacuum at the end) |
| A seeded runner that is always passable | Adam Saltsman, "Tuning Canabalt" (Gamasutra, 2010); Subway Surfers' three lanes |
| The bot's dodging | Oussama Khatib, artificial potential fields (1986), as `actionbot.js` cites |
| Paper confetti, stickers, atlas dots | the v1 paper kit and dot atlas (v1 14.1, 14.2); no new source needed |

## 7. Checks

**Node.** Every `stage-<id>.test.mjs` is rewritten for its genre (each stage section lists its checks). Shared:

| File | Asserts |
|---|---|
| `purity.test.mjs` | `core/` stays pure, `action.js` and `actionbot.js` included: no DOM, no clock, no `Math.random` |
| `draw.test.mjs` | every 30th view of each stage's ref and idle runs fits `LIMITS`, with the action part inside the caps of `contract.md` |
| `run.test.mjs` | a knock-out shows the Almost card; Try again recreates the stage; Go on lets development finish (the `goOn` moment, or as `contract.md` sets for stage 5) and ends with Goal 0 and no grade word, with the stage's milestones and carry; the better attempt is kept; families per stage (no stage over two); one-button sets steer from `botSteer` while held; exactly one `enter` in a whole run; shield sparks from Glowing grades |
| `sim.test.mjs` | the gates of 4.5 over 20 seeds; skill 0.7 runs take 8 to 12 min; the suite stays under 120 s of wall time |
| `perf.test.mjs` | p99 of a stage step ≤ 1 ms at each stage's busiest moment |
| `pacing.test.mjs` | every caption fact a stage sends shows whole (v1 12), with the action stages' new lines |
| `facts.test.mjs` | the new facts follow v1 15.1; `checked: false` facts are not shown |
| `text.test.mjs` | the v1 banned words and pronouns across every new string (rest lines, gift tags, prompts, gate names); no "fastest", "winner", win, wins or won, and no "beat the" or "beats the" in stages 1 and 2 |

**Browser** (Chromium with `--disable-gpu`, v1 17):

| File | Looks for |
|---|---|
| `input.e2e.mjs` | in stages 3, 4, 5, 7 and 8 at 390 × 844 and 844 × 390 with touch: a drag moves you toward the drag and a quick tap dashes (or grapples, kicks or tucks); at 1440 × 900 with keys only: WASD moves, Space dashes; stage 1: drag steers, a tap while turning drifts, Space held while turning drifts, E uses the item; stage 2: every v1 arc check (drag, turn keys, mouse aim, the parked cursor), a second-finger tap or Space releases the seal charge without moving the arc, and the fresh press at the seal; a second finger never steers; stage 6 lanes by drag and arrows; stage 8 lanes and tuck; one-button mode completes every stage with Space held |
| `layout.e2e.mjs` | in every stage and layout with `?inset=47,0,34,0`: you stay above 60% of the height in portrait; hp pips, the place slot with its "racing" and item tags, the boss bar, gift tags and the compass arrow sit inside the safe area and overlap no HUD, prompt or caption box; no foe spawns in the bottom 40% in portrait (stage 2's formations sit all round the egg as v1's waves came, inside the safe area, with your sperm never from below); stage 1's next bend and gate are on screen 1.5 s ahead |
| `visual.e2e.mjs` | no canvas text; you are the brightest cue in every action stage; foe sparks are keylined diamonds; the flash rule holds through stage 2's swarm, stage 3's Knot, stage 5's boss and stage 7's Big Germ wave (300 frames each, `__fb.step(1)` and `lum()`); no red flash on a hit; the stage 8 light rule |
| `perf.e2e.mjs` | at each stage's busiest moment (listed in each section), the v1 budgets: full tier p95 ≤ 16 ms, low tier ≤ 10 ms, at the pinned steps |
| `smoke.e2e.mjs` | every stage via `goto` steps and draws; the bot reaches the run result; a knock-out, then Go on, reaches the next stage |

The pull request says plainly which checks could not run: real phones, real touch latency, phone speakers.

## 8. Risks and the cut list

| Risk | Mitigation |
|---|---|
| Action reads as violent | Gentle words, the banned list, pops into sparkles, sperm that bounce and rest, no red flashes, frame lines on the result, a human read of every string |
| Too hard for a casual player | Small hitboxes, telegraphs, mercy clears, Assist, one-button mode, shield sparks, the Almost card with Go on, and gates on the 0.5 bot |
| Frame time with many bullets | Atlas dots, cached foe sprites, caps per stage, the low tier, perf checks at the busiest moments |
| Eight genres feel stitched | One look, one heartbeat, one control scheme, carry (your sperm, your nestle spot, your song, your sparks), and the facts |
| Facts lose room in busy stages | Captions in priority order at calm points; the rest go to "What was real" by the v1 rule |
| Builders drift from the contract | `contract.md` wins on API names; this file wins on stage numbers; each tune file header records changes |

**Cut list** (cut from the top when late; each stage keeps its floor):

1. The fever in stage 6 (the song still plays).
2. Gifts Chain and Magnet in stage 3; Clump and Grow in stage 7.
3. The tight gaps in stage 8 (the gates stay).
4. Stage 2's Pierce and Slow power-ups and the swarm's phase 3; stage 1's Goo item.
5. The Knot's phase 3 and the Big Germ's swarmers.

**Floors:** 1, the v1 race on the bending track with drifts, the three knockout gates, the place and the Almost card
(items and the slipstream may wait). 2, the arc as the paddle, the glow, W1 to W4 with plain and tough bricks,
aimed streams and fans the arc blocks, Multi, Wide and Mend, the seal charge, the swarm's phases 1 and 2, the rush
and the seal. 3, four
rooms with splits, 6 gifts and the Knot's phases 1 and 2. 4, the map with tunnels, the grapple, 8 pools and
auto-link, and the heart pulse. 5, as `contract.md`. 6, beat, phrases and the song. 7, waves, 4 gifts, the clear and
the turn. 8, lanes, folds, tuck and the four gates.
