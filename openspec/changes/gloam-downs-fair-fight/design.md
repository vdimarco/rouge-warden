# Design: a fair fight

## The request
After playing the preview of PR #852, the player said: "game is quite hard... can we mnake the dificult scale in a more natural way... enemies are ruthless, my attacks should interrupt like in deadcells".

Three asks, in the player's words:
1. "my attacks should interrupt": a hit on a foe that is winding up should stop its attack.
2. "enemies are ruthless": fewer blows at once, a breath after each hit, no blows out of nowhere.
3. "difficult scale in a more natural way": the later places should feel like a step, not a wall.

The art direction, the names and the inputs stay as they are. No new input is added: an interrupt is a plain Attack, so keys, mouse, pad and touch all have it.

## What is there now
All numbers come from the code at 9e243098 and two Node sims run on flat test ground at Ember 0 and depth 0 (the study before this change). The bot runs are `node qa/lab/gloam-downs-bot.mjs 30 <skill> 1` on the code as committed.

**One blade hit** (cut1 deals 10, cut2 11, the finisher 22). `foes.js` `hitFoe()` says "A plain hit never stops a wind-up."
- A light foe that chases flinches 0.4 s, at most once every 1.5 s, and is pushed 0.4 m.
- In its wind-up a cut gives no flinch, no push and no cancel. The hook landed in 12 of 12 measured cases.
- In its active time or recovery a cut sets `flinch`, but `flinch` is read only in `mind()`, which does not run in a move. It does nothing.
- Only the finisher, the plunge, a Rising cut or the Ember parry stop the move. The finisher's hit comes at step 46 of a string; a Snuffer's hook winds up for 33 steps. So the string cannot stop a hook started near it.
- The Ironback never flinches, has 60 poise and breaks on the fifth hit (about 1.2 strings). Elites have 50, the Bellwether 90. The Reeve has no poise.
- The lamplighter is the other way round: any hit stops any of its moves, its own wind-up too.

**Tokens and timing.**
- Two melee tokens and one coal. A token comes back when the active time ends, and a waiting foe takes it on the next step.
- Standing still, 17 to 51 blows in 30 s land inside the 0.9 s safe time after a hit. A new blow is always on its way.
- A foe off screen waits only 0.4 s longer for its token. With every foe counted off screen, 3 Snuffers landed 12 hits in 30 s against 9 on screen.

**The curve.** Damage = base × 1.3 × (1 + 0.35 d^1.5); health = base × 1.15 × (1 + 0.4 d^1.5).

| Depth | Damage × | Health × | Hook | Coal | Charge | Snuffer health |
|---|---|---|---|---|---|---|
| 0 | 1.30 | 1.15 | 21 | 23 | 31 | 57 |
| 1 | 1.76 | 1.61 | 28 | 32 | 42 | 80 |
| 2 | 2.59 | 2.45 | 41 | 47 | 62 | 123 |
| 3 | 3.66 | 3.54 | 59 | 66 | 88 | 177 |
| 4 | 4.94 | 4.83 | 79 | 89 | 119 | 241 |

Damage times health grows about 16 times from the Gaol to Barrow Crown.

**Bot runs.** At 0.3: 7 of 30 bots won within 40 runs (median first win run 29), 50% of first runs reach The Crow Wall, and 45% of deaths are at The Crow Wall. At 0.5: 30 of 30 won (median run 9). The bot never interrupts: it reads the wind-up and rolls.

## Sources
- Dead Cells wiki, "Mechanics" (https://deadcells.wiki.gg/wiki/Mechanics). Only search summaries were read: the site is outside this session's network, so the page was not fetched. The summary says a hit during an enemy's attack adds stagger, which delays its hit frame but does not cancel it, the delay depends on the weapon, bigger enemies resist it, and bosses are immune. **Adapted:** small foes are interrupted, bigger ones resist, the boss is nearly immune. **Changed:** a light or medium foe's wind-up is cancelled outright, because the player asked for an interrupt and a delay they cannot see reads as no interrupt.
- Hades armor (Hades wiki, "Unblockable"; Prima Games and Game8 on Hades II armor; search summaries): armored foes show an outline and an armor bar, cannot be stunned until it breaks, and a break stuns them. **Adapted** as the cold rim that thins with poise, and the stagger at a break.
- Attack tokens (strayspark, "Attack token system"; an itch.io devlog on fair AI; search summaries): a pool limits how many foes attack at once, and waiting foes strafe. **Adapted** as fewer tokens early, the token held to the end of recovery, the spacing between blows, and circling. A claim that Doom (2016) uses tokens is second-hand and not used.
- Dead Cells scaling by scrolls (a Steam thread, an unverified claim of 7 to 8% a scroll). **Adapted** as foe growth with the run's sparks, smaller per spark because a run picks up 4 to 10 sparks.
- From memory, not checked: Hollow Knight's safe time after a hit is about 1.3 s; Dark Souls poise and Elden Ring stance (already cited in `feel.js`).

No source fit the armor colour: it is chosen from this game's 48-colour palette below.

## Decisions

### 1. Weights and hit stun
| Foe | Weight | Hit stun | Knock back | Why |
|---|---|---|---|---|
| Mirelight | light | 0.5 s (30 steps) | 0.8 m | 14 health, floats |
| Pitchrook | light | 0.45 s (27) | 0.6 m | a thrower that keeps away |
| Snuffer | medium | 0.35 s (21) | 0.4 m | the common melee foe: a shorter stun keeps it a threat |
| Ironback | heavy | none, poise 40 | none | |
| every elite | heavy | none, poise 40 (Bellwether 70) | none | an elite is a boss of its zone |
| Barrow Reeve | own rule | 1.0 s at a poise break of 150 | none | |

The game had only light and heavy. "Medium" is new and means a shorter stun, nothing else.

### 2. What a hit does, by state (light and medium)
- **Chase, circle or idle:** stop for the hit stun, take the knock back.
- **Wind-up:** cancel. No blow, no ring, no coal. The token goes back at once. The foe flinches for its stun, then waits 0.6 s more before any new wind-up. The 0.6 s keeps the player's string safe: a string takes 0.77 s to the finisher.
- **Active time:** committed. The blow goes on and may land. The hit adds 0.2 s to the recovery. This keeps the roll worth having and matches the genre: a blow that has started finishes.
- **Recovery:** each hit adds 0.2 s, at most 0.4 s a move. A foe cannot be held in recovery for ever.
- **Brace:** three flinches in 3 s (a cancel and a knock-down count) brace the foe for 1.5 s: damage and knock back, but no flinch, no knock-down and no cancel. (Second pass: it was 1.0 s, and the finisher still knocked a braced foe down.) The brace replaces the old "once every 1.5 s" flinch gap.
- **Steeled** (second pass): a foe cut out of its attack comes back steeled. Its next wind-up begun within 4 s is armored, and its rim shows 2 dabs until then. So a hit stops one attack of a foe, and the next must be dodged or outlasted.
- **What interrupts:** each cut, the finisher, the plunge, and the hits of Lantern bomb, Moth wisp, Crook line and Ember snare (`how.interrupt` on the hit). Burn and pitch ticks do not. Flare's and Rime's states keep their own rules (`status.js`).

### 3. Poise and armor
- Poise numbers drop (Ironback 60 to 40, elite 50 to 40, Bellwether 90 to 70), so one string breaks an Ironback outside a wind-up (43 against 40).
- A hit in a wind-up takes twice its damage off the poise. Two cuts in an Ironback's charge wind-up break it (20 + 22). This rewards the read, as an interrupt does on a small foe.
- The stagger keeps its 1.2 s, its 25% more damage, the 3 s refill and the 4 s gap. In the gap the poise holds full (second pass), so the rim does not drain to nothing while the foe cannot break.
- **Armored attacks:** every wind-up of a heavy foe: the Ironback's charge and slam, and every elite's plain moves and special move (second pass: at first only the charge, the bent charge, the sweep and the Wardmother's second hook). In them a hit does not cancel, but poise still wears and a break still cancels. A braced or steeled foe's wind-up is armored too.
- **The rim:** a heavy foe shows a ring of dabs round its body in slot 39, one for each 10 poise left, rounded up. In an armored wind-up the ring doubles and brightens over the wind-up, so the player sees "this one will not stop" before the blow. A braced foe shows the same ring (4 dabs) for its brace.
- **Why slot 39:** it is the Mirelight's pale cold pulse. Fire (34 to 37) is the warning colour of every tell and must stay the brightest; 33 is the stagger crack; 46 and 47 are the lamp; 38 is Rime's frost. Slot 39 also marks Gloam sparks on the ground, but those lie flat on the floor and the rim stands round a body at chest height, so they do not meet. The e2e checks the slot in every layout.
- With reduced motion the rim does not pulse or grow; it holds its count and size.

### 4. The Barrow Reeve
- 150 poise, worn by every hit. At 0 a 1.0 s flinch: a wind-up is cancelled; a move in its active time ends with that time.
- At most once every 8 s, never in a stumble (hits do no damage there) or the intro. It fills 4 s after the last hit.
- The boss bar gets a poise line, 4 px tall (second pass: it was 2 px), under the health. It needs a layout check in the six layouts.
- No rim on the Reeve: its moves read by their own markers, and a rim on every move would say nothing.

### 5. Interrupt feel
- A cancel or a poise break: a hit stop of 5 steps (as the finisher), inside the existing cap of 9 in any 30; a burst of sparks in slot 35 at the chest and a ring of sparks in slot 36 on the ground round the foe; 0.06 camera kick (`FEEL.add.snap`), none with reduced motion; the knock back; and the cue `snap`. The stop, the kick and the cue come once a step however many foes one hit stops; the sparks come for each.
- **The hook's ground tell** (second pass): in a hook's wind-up, a Snuffer's or the Wardmother's, an arc of 7 fire dabs (slot 35) lies on the ground in front of the foe at 1.3 m, growing over the wind-up. The other attacks already had a ring or a lane; the hook had only the body's glow, so in a group nothing said which Snuffer would hook.
- `snap` is new in `sound.js`: a dry wooden knock (a short filtered noise burst, 40 ms) with a crackle tail (sparse clicks over 120 ms), panned to the foe. Rank 2, a hit cue, at most once a step. It goes in the sample bank and the music demo's `cues` group.
- A plain flinch outside a wind-up keeps the cut's own 3-step hit stop and sound, so the snap means "you stopped it".

### 6. Fair foes
- **Tokens by depth:** 1 melee token at depth 0 and 1, 2 from depth 2. Ember levels do not change it. One coal, as now.
- **The token is held to the end of recovery.** A cancelled attack gives it back at once, so an interrupt opens the way for the next foe, which is fair: that foe still needs its full wind-up.
- **Blow spacing:** the hit steps of any two blows (a melee blow's first active step, a coal's landing) are at least 0.6 s apart. A foe checks, before its wind-up, when its blow would land, and waits if another lands within 0.6 s of it. With the 0.55 s hook wind-up this means the player never faces two hits inside one roll.
- **After a hurt:** no foe starts a wind-up for 1.0 s, the length of the safe time. The foe that hit steps back 1.0 m over 0.4 s and waits at least 1.2 s.
- **Circling:** waiting foes hold 3.2 to 3.8 m and walk round at 0.8 m/s, keeping the 50° spread. They used to stand.
- **Off screen:** a foe whose chest is out of view starts a wind-up only with its tell cue played at its first step, panned to its side, and never dropped by the cue limit (`sound.js` gives off-screen tells a reserved voice). Its wind-up is 0.25 s longer and its notch shows. If no voice is free, it waits. With the sound off the notch and the longer wind-up stay; the sound switch is the player's choice.
- **Safe time** goes from 0.9 s to 1.0 s. The 0.25 s lock and the 1.2 m push stay.
- **Kept:** a hit still stops the lamplighter's own move. With the spacing and the safe time, it no longer chains, so there is no need to change it.

### 7. A natural curve
(The numbers below are the first pass. The second pass changed them: see "Second pass" near the end.)

The curve now has four parts, and raw damage comes last:
1. **New kinds** from the baked pools, as now: the Gaol has Snuffers only, The Crow Wall adds the Pitchrook, The Fen the Mirelight, The Bell Knoll the Ironback.
2. **More foes and mixed zones:** from depth 2, each zone the mix may change gets one foe more when the pool and the cap allow, and a zone of 3 or more foes holds two kinds when the pool has them (`mix.js` takes `depth`). Ember 3's extra foe applies from depth 0, still at most one extra a zone.
3. **A second token** from depth 2.
4. **A gentle line** on damage and health: ×(1 + 0.1 d) and ×(1 + 0.2 d), with Ember 0's base at ×1.1 damage (was 1.3) and ×1.15 health.

And the curve follows the player: each foe's health ×(1 + 0.03 s) and damage ×(1 + 0.015 s) for s sparks held at load, up to 12. A Flame spark gives 10% damage and a Ward spark 10 health, so a spark always gives more than the foes gain from it. The Reeve keeps its 5% a spark.

The new numbers at Ember 0, no spark (damage rounded; health about):

| Depth | Damage × | Health × | Hook | Coal or pulse | Slam | Charge | Hooks to down 100 / 160 | Snuffer health | Strings a Snuffer | Ironback health |
|---|---|---|---|---|---|---|---|---|---|---|
| 0 | 1.10 | 1.15 | 18 | 20 | 22 | 26 | 6 / 9 | 58 | 1.3 | 138 |
| 1 | 1.21 | 1.38 | 19 | 22 | 24 | 29 | 6 / 9 | 69 | 1.6 | 166 |
| 2 | 1.32 | 1.61 | 21 | 24 | 26 | 32 | 5 / 8 | 81 | 1.9 | 193 |
| 3 | 1.43 | 1.84 | 23 | 26 | 29 | 34 | 5 / 7 | 92 | 2.1 | 221 |
| 4 | 1.54 | 2.07 | 25 | 28 | 31 | 37 | 4 / 7 | 104 | 2.4 | 248 |

With 8 sparks, damage is ×1.12 more and health ×1.24 more: a Barrow Crown hook deals 28 and a Snuffer has about 128 health. Damage times health now grows about 2.5 times from the Gaol to Barrow Crown with no spark (was 16), and about 3.5 times with 8 sparks.

The levers are in `run.js` `PACE`: `depthDmg 0.1`, `depthHp 0.2`, `depthPow 1`, `sparkDmg 0.015`, `sparkHp 0.03`, `sparkCap 12`, `bossSpark 0.05`, and the token counts `tokens: [1, 1, 2, 2, 2]`. `FOE_HARD` in `foes.js` becomes `{ dmg: 1.1, hp: 1.15 }`.

### 8. Pacing and the bot
**The bot uses the real rules.** It already steps `foes.js` and `elites.js`, so interrupts, braces, armor, tokens and spacing come from the game's own code. What changes is the bot's own play:
- On a wind-up it has read, of a foe in reach (1.8 m plus the foe's radius) that is not armored or braced, with at least 0.23 s left before the hit (cut1's 0.18 s to land and a margin), it cuts in with a chance of 0.3 + 0.6 × skill. Otherwise it rolls as now.
- It rolls from every armored wind-up it reads, unless the foe is heavy and its next cut breaks it (poise left 20 or less, and not in the 4 s after a stagger); then it cuts, at the same chance. (Second pass: the first rule cut whenever the poise left was under two cuts' wear, 42, which is every heavy foe's full poise, so it cut into the Wardmother and never rolled.)
- It prints `interrupts a run`, `cancels taken by foes a run` and `hooks from braced foes a run`.

**What it prints for the targets:**
- First runs: the share that reach place 2 and place 3.
- Median first win and how many bots won within 40 runs.
- Per place: runs that reached it, deaths there, the **death rate** (deaths over runs that reached it), and the median **damage taken per foe put out**.
- The factor table above, from `foeScale` and the foe numbers, at start.

**How a spike is measured.** For each skill: no place before Barrow Crown has a death rate above 1.5 times the mean rate of those four places; Barrow Crown's is under 2 times that mean (the Reeve is a final test); and each place's damage per foe is 0.9 to 1.6 times the place's before it. Death rate, not a share of deaths, is used, because few runs reach the late places and a share hides that.

**Targets** (60 bots a skill, seed 1): at 0.3, place 2 in 80% or more of first runs and place 3 in 40% or more, median first win in run 8 to 20; at 0.5 in run 3 to 8; at 0.9 in run 1 to 2.

**Tuning order.** First the fight rules alone with the old curve, to see what the interrupts give. Then the curve. If a target misses, the levers in order: the bot's cut-in chance is not a lever (it models a player); `depthHp`, then `depthDmg`, then `sparkHp`, then the token counts, then `FOE_HARD.dmg` within 1.0 to 1.2. New levers for the bot: `TOKENS`, `GAP`, `HURT_WAIT`, `HARD_DMG`, `DEPTH_DMG`, `DEPTH_HP`, `SPARK_DMG`, `SPARK_HP` and `CUT_IN` (for a what-if run only). Each run that tunes is written in "Pacing results" below, as the growth change did.

**The 0.9 bot's winning run time** (15 to 25 minutes) is not a target here. The growth change found it needs more ground, not tuning.

## Files
| File | Change |
|---|---|
| `foes.js` | `TYPES[*].weight`, `stun`, `knock`; `FOE_HARD`; `hitFoe` by state; the brace; recovery adds; tokens by depth and held to the end of recovery; the spacing schedule; the hurt wait; back off; circling; the off-screen tell gate; `snap` events; the view's new fields |
| `elites.js` | elites are heavy; the armored specials; elite poise 40 and 70 |
| `feel.js` | `STAGGER.poise.I 40`, `elite 40`, `eliteI 70`, `wind 2`; `FEEL.add.snap 0.06` |
| `boss.js` | the Reeve's poise, its break, its flinch, the view |
| `run.js` | `PACE` levers, `foeScale` with sparks, the token count by depth, safe time 1.0 s |
| `moves.js` | safe time 1.0 s if it lives there; the hit's `interrupt` flag |
| `abilities.js`, `status.js` | `interrupt` on the hits of Lantern bomb, Moth wisp, Crook line and Ember snare |
| `mix.js` | `depth` in `mixZones`: the extra foe and two kinds |
| `fight.js` | the rim (`ARMOR_DABS`), the flinch pose for every light and medium foe, the snap's sparks |
| `main.js`, `index.html` | the boss bar's poise line; the `?test` fields |
| `sound.js`, `run-sound.js` | `snap`; the reserved voice and pan for off-screen tells |
| `qa/lab/gloam-downs-bot.mjs` | the cut-in, the prints, the levers |

`play.js` does not change.

## Earlier requirements this changes
In the unarchived changes, these requirements are replaced by the MODIFIED ones here: "Hits on foes", "Fair crowds" and "Health and hits" (add-gloam-downs), "Poise and stagger" (gloam-downs-real-game), "Harder Ember 0", "Harder later places" and "Pacing" (gloam-downs-growth). Scenarios elsewhere that quote the old numbers (the hook's 21, the coal's 23, "84" health after a hook, the Crow Wall's 28 and 80) are updated in their tests, and the archive of these changes must apply this change last.

## Risks
- **Too easy for the skilled.** Interrupts plus spacing may make the 0.9 bot win at once. That meets its target (run 1 to 2). The Reeve keeps most of its threat, since it flinches only at a break.
- **Stunlock on groups.** Mashing a group could hold every foe. The brace and the 1-token rule cap it; the "No endless flinch" scenario checks it.
- **Slot 39 on a Fen map.** The Fen's palette may put 39 near its water. The e2e checks the armor dabs read on every place's palette with the colour distance test of "Colour distance".
- **Sound limit.** A reserved voice for off-screen tells could cut a hit cue. The sound test checks a crowded step.

## What was built, and where it differs from the plan
Built on `ccr-43aa269a-y8yo7l` from the design commit `c2914bb8`, on 2026-11-26.
- **Weights, stun and knock back** are in `foes.js` `TYPES` (`weight`, `stun`, `knock`). The Snuffer keeps `light: true` (its shove and its down clip), and `weight: 'medium'` gives its shorter stun.
- **Hits by state** (`foes.js` `hitFoe`): as planned. A hit in the active time or the recovery holds the recovery where it is for 0.2 s (`recLeft`), at most 0.4 s a move; the pose holds too. The old "once every 1.5 s" flinch gap is gone.
- **The brace counts only while the foe stands.** As planned, the third flinch is nearly always the finisher, whose knock-down lasts 0.6 s: a 1.0 s brace that counted through the knock-down left 0.4 s, under the 0.8 s cooldown after a knock-down, so a braced foe never answered and the "No endless flinch" check found one hook in 10 s. Now the brace starts counting when the foe gets up, and a wind-up begun braced stays armored to its end (`armorMove`).
- **A Snuffer steps in from the circle.** Waiting foes circle 3.2 to 3.8 m away, and the hook's range is 3.2 m, so a Snuffer given the token at the circle's edge started its hook out of reach and missed. It now starts within 2.9 m, or after 20 steps in range when it cannot come nearer.
- **Circling** turns the way that keeps the 50° spread (the sign of the spread's push) and turns back at the leash.
- **The off-screen tell's voice.** In place of a separate reserved voice, an off-screen tell (`off: true` on the cue) plays at rank 4 (`sound.js` `TELL_RANK`), over every other cue, so the 24-voice limit drops a hit cue first. `makeFoes` takes `tellFree(f)`; the page leaves it true, as a rank-4 voice is always free.
- **The off-screen check in the browser narrows the view.** In the open, a phone held upright shows everything within 15 m of the lamplighter, so no foe in hook range is ever off screen; the e2e narrows the view (fov 0.3) to put a Snuffer 2.4 m to the side outside it.
- **The snap** is synthesized in `sound.js` like the other cues. The sample bank (`qa/lab/gloam-downs-bank.mjs`) holds only the score's instruments, so it does not change; the music demo renders `snap` with the hit cues and checks it sits between cut 1 and the boss slam.
- **The Reeve's flinch** poses the first lurch of its stumble clip; its poise line is `#bossPoise` under the health in the boss bar.
- **The bot**: the cut-in and the roll from armor as planned; a read wind-up it does not cut into, it stops swinging at and waits for the roll. It counts a place where it was stuck for 12 minutes (a keeper it cannot reach, mostly at the Fen's mill) apart from the deaths, and `WORKERS=4` plays the bots on four threads with the same results.

## Pacing results
Each line is `WORKERS=4 node qa/lab/gloam-downs-bot.mjs 60 <skill> 1` with only the named levers changed from the game as built. "Reach 2/3" is the share of first runs at 0.3 that reach place 2 and place 3; "won" the median first-win run; the death rates are by place, 1 to 5, deaths there over the runs that reached it, with the bot's stuck runs left out (from step "final" on; before it they count as deaths, about 3% at place 3).

| Step | Levers | 0.3 reach 2/3 | 0.3 won | 0.5 won | 0.9 won | Death rates at 0.5 (places 1 to 5) |
|---|---|---|---|---|---|---|
| rules | the fight rules with the old curve: ×1.3 damage, depth 0.35/0.4 at power 1.5, 2 tokens, no foe more at depth, no spark growth | 93% / 92% | 10 | 2 | 1 | 0.9, 0.4, 4.1, 6.8, 52.8% |
| curve | the game as designed: ×1.1, depth 0.1/0.2 linear, sparks 1.5%/3%, tokens 1,1,2,2,2, a foe more from depth 2 | 97% / 97% | 1 | 1 | 1 | 0, 0, 2.8, 0, 0% |
| A | depth 0.25/0.4 | | | 1 | | 0, 0, 3.3, 0.3, 1.1% |
| B | depth 0.35/0.6 | | | 1 | | 0.3, 0, 4.0, 1.4, 5.4% |
| C | depth 0.35/0.6, ×1.2 | | | 1 | | 0, 0.3, 4.7, 1.4, 10.5% |
| D | depth 0.5/0.8, ×1.2 | | | 1 | | 0.2, 0.2, 6.7, 4.5, 31.3% |
| E | tokens 2 everywhere | | | 1 | | 0.6, 0, 3.1, 0, 0% |
| F | tokens 2,2,3,3,3, depth 0.35/0.6, ×1.2 | | | 1 | | 1.3, 0, 3.3, 0.6, 8.2% |
| G | depth 0.6/1.0 at power 1.5, ×1.2, tokens 2 | 98% / 85% | 34 (40 of 60) | 17 | | 0, 0.2, 12.8, 38.9, 77.7% |
| H | depth 0.4/0.6 at power 1.5, ×1.2 | 97% / 90% | 17 | 6 | | 0.1, 0, 4.5, 15.3, 69.3% |
| I | depth 0.2/0.35 at power 1.5 | 97% / 95% | 3 | 1 | | 0, 0.3, 0.8, 1.7, 11.1% |
| **final** | the game as designed (as "curve"), measured again on the finished code (the bot's back-off from a read it does not cut into; stuck runs apart) | **97% / 97%** | **1** | **1** | **1** | 0, 0, 0, 0, 0% |

The "rules" row ran while the brace, the circle and the Snuffer's step-in were being fixed (its 0.5 run on the code before them, its 0.9 and 0.3 runs after), so it is a guide, not an exact figure.

**The game as committed** (the "final" row), 60 bots a skill:

| Skill | First run reaches place 2 / 3 | Median first win | Runs (won) | Death rate by place, 1 to 5 | Damage per foe by place (median) | Interrupts a run | The Reeve's poise breaks a fight | Winning run |
|---|---|---|---|---|---|---|---|---|
| 0.3 | 58 / 58 of 60 (97%, 97%) | run 1 (60 of 60) | 370 (334) | 3.5, 0.3, 0.8, 0.6, 1.5% | 9.8, 2.5, 2.6, 2.7, 15.1 | 44.1 | 3.8 | 5.0 min |
| 0.5 | 60 / 60 | run 1 (60 of 60) | 361 (351) | 0, 0, 0, 0, 0% | 6.0, 1.3, 1.4, 0.0, 10.0 | 45.7 | 3.8 | 5.2 min |
| 0.9 | 60 / 60 | run 1 (60 of 60) | 364 (339) | 0, 0, 0.8, 0, 0.3% | 1.3, 0, 0, 0, 4.4 | 46.9 | 4.1 | 9.0 min |

Stuck runs (the bot cannot reach a keeper, almost all at the Fen's mill; counted apart): 12 at 0.3, 10 at 0.5, 21 at 0.9. Hooks from braced foes a run: 0.19, 0.08 and 0.01. The catalogue at 0.5 (`MAXRUNS=30 AFTER=30 WORKERS=4 node qa/lab/gloam-downs-bot.mjs 10 0.5 1`): 25% bought by run 8, 50% by run 15, 75% by run 22, all of it by run 28; 267 of 300 runs had a buy.

Against the targets:
- At 0.3, place 2 in 80% of first runs: **met** (97%). Place 3 in 40%: **met** (97%).
- At 0.3, the median first win in run 8 to 20: **missed**, run 1. Too easy for the bot.
- At 0.5, run 3 to 8: **missed**, run 1. Too easy for the bot.
- At 0.9, run 1 to 2: **met**, run 1.
- No death spike: **missed by the ratio test** at 0.3 (the Gaol's 3.5% is 2.7 times the mean of places 1 to 4, 1.3%) and 0.9 (the Fen's 0.8% is 4 times a mean of 0.2%); at 0.5 no bot dies, so there is nothing to compare. No place kills more than 3.5% of the runs that reach it, at any skill, and Barrow Crown is under 2 times the mean at every skill.
- Damage per foe rising 0.9 to 1.6 times a place: **missed**. It falls after the Gaol (the run's first fights, before any growth) and jumps at Barrow Crown (the Reeve counts as one foe).
- The 0.5 bot interrupts more than 3 times a run: **met** (45.7).
- A buy in two of three runs: **met** (267 of 300).

**Why the gentle curve stays.** The run-count targets were set before the interrupts were measured. With them, the bot stops nearly every wind-up of a Snuffer, a Pitchrook or a Mirelight that comes near it, so only the Ironback's armored charge, the coals, the elites' specials and the Barrow Reeve can hurt it. Every setting that met the run counts (H, and G past them) did it by putting a wall at The Bell Knoll and Barrow Crown (69% of the 0.5 runs that reach Barrow Crown die there in H), which is the "unnatural" scaling the player asked to remove, and G and H hit harder at Barrow Crown than the game before this change. The curve as designed keeps every place fair and lets the player's interrupts carry them, as asked. A bot is not a person: it swings on every other step and never hesitates, so a person will take more hits than these numbers show. The next step is a playtest by the player: if it now feels too easy, H's shape at a lower damage (depth damage 0.25 to 0.3 at power 1.5) is the lever to try first, and the bot will show where its deaths fall.

What the steps showed:
- **The interrupts change everything.** With the old curve and the fight rules alone (step "rules"), a 0.5 bot first wins in run 2 (it was run 9 before this change), and the slow bot in run 10 (it was run 30, 11 of 60 within 40 runs). The bot stops 40 to 55 wind-ups a run. It swings at every foe in reach, and a cut lands in about 0.12 s, well inside a hook's 0.55 s wind-up, so a Snuffer that winds up beside it is cut off whatever the bot's skill; the cut-in chance only matters for a wind-up it reads before it is in reach.
- **A linear curve cannot bring deaths back.** Steps A to F raise the depth line up to ×3.0 damage and ×4.2 health at Barrow Crown, and two or three tokens: the 0.5 bot still wins its first run. The early places never kill (their foes are cut off), so all the deaths that come back come at Barrow Crown.
- **The run-count targets need the old shape.** Only a curve as steep as the one the player found too hard (H: power 1.5, ×4.2 damage at Barrow Crown) brings the 0.5 bot to run 6 and the 0.3 bot to run 17, and then 70% of the runs that reach Barrow Crown die there: the wall the player asked to remove.
- **The "no death spike" target and the run counts cannot both hold** with these levers: places 1 and 2 kill almost no bot at any setting, so any setting with enough deaths for the run counts puts them in the last two places.

## Second pass (after the checker)
A checker played the first build and reran the bots. What it found, and what changed:

**The fight was too easy, and mashing won it.** Every bot won its first run, and nearly all of the 44 interrupts a run came from swinging at whatever stood near, not from a chosen cut-in. So reading a wind-up hardly mattered until the Ironback, the elites and the Reeve.

Measured before tuning (0.5 bot, the first build's curve, 60 bots), each lever alone:

| Lever | 0.5 first win | Death rates, places 1 to 5 | Note |
|---|---|---|---|
| none (first build, with the token fixes) | run 1 | 0, 0, 0, 0, 0% | damage taken a run 257 |
| steeled, 4 s | run 1 | 0, 0, 0, 0, 0% | 1.8 steeled hooks a run |
| health ×1.6, tokens 2,2,2,3,3 | run 1 | 0, 0, 0.3, 0, 0% | |
| a Snuffer's wind-up only delayed by hits, never cancelled | run 1 | 0, 0.5, 0.8, 0, 0.3% | Snuffers die before the delayed hook |
| brace at 2 flinches, 2.5 s | run 1 | 0, 0, 0, 0, 0% | |
| blow gap 0.3 s, hurt wait 0.5 s, tokens 2,2,2,3,3 | run 1 | 0, 0, 0.6, 0, 0.3% | |
| damage ×2.0, health ×1.5 | run 1 | 10.2, 2.6, 2.9, 1.2, 3.8% | the Gaol spikes |

What the bot's source lines showed: Snuffers deal most of the damage in every place, the Gaol's Snuffers more for each foe than any later place's (the first fights of a run, before any ability or spark), and the Bell Knoll little (few fights). No rule alone made the bot lose; only damage did, and damage alone put the deaths in the Gaol.

**What changed in the rules:**
- **Steeled:** a foe cut out of its attack has its next wind-up within 4 s armored, with a 2-dab rim until then.
- **The brace holds:** a braced foe is not knocked down by the finisher or the plunge, and the brace lasts 1.5 s. Mashing one Snuffer now ends in a hook that lands unless the player rolls: the third flinch braces it, it stands, and its next wind-up is armored.
- **Every heavy wind-up is armored** and doubles its rim, so the bigger Snuffer (the Wardmother) reads as one that will not stop.
- **The rules for the token, the blows and the feel** are fixed (below).

**The curve** (the levers in `run.js` `PACE` and `foes.js` `FOE_HARD`): damage ×1.25 and health ×1.3 at Ember 0; damage by depth from a table, `dmgAt: [1, 1.45, 1.72, 2.3, 2.05]`, in place of the line; health ×(1 + 0.35 d). The table is the plain way to say "each place a step, none a wall": the steps are 1.45, 1.19, 1.34, and Barrow Crown steps back a little, as the Reeve is its test. The spark growth is unchanged. At Ember 0 with no spark (the bot's factor table):

| Depth | Hook | Coal | Slam | Charge | Hooks to down 100 / 160 | Snuffer health (strings) | Ironback health |
|---|---|---|---|---|---|---|---|
| 0 The Sunken Gaol | 20 | 23 | 25 | 30 | 5 / 8 | 65 (1.5) | 156 |
| 1 The Crow Wall | 29 | 33 | 36 | 44 | 4 / 6 | 88 (2.0) | 211 |
| 2 The Fen | 34 | 39 | 43 | 52 | 3 / 5 | 111 (2.6) | 265 |
| 3 The Bell Knoll | 46 | 52 | 57 | 69 | 3 / 4 | 133 (3.1) | 320 |
| 4 Barrow Crown | 41 | 46 | 51 | 61 | 3 / 4 | 156 (3.6) | 374 |

Before this change (at 9e243098) a hook dealt 21, 28, 41, 59 and 79.

**Tuning runs** (60 bots, seed 1; the rules of the second pass; "B" is the brace at 3 flinches, 1.5 s, holding). Death rates by place, 1 to 5:

| Step | Levers | 0.3 first win | 0.3 reach 2 / 3 | 0.3 death rates | 0.5 first win | 0.5 death rates |
|---|---|---|---|---|---|---|
| k | brace at 2 flinches; ×2.0, line 0.25 | | | | 4 | 19.7, 10.9, 9.8, 6.7, 21.8 |
| l | brace at 2; ×1.5, line 0.45 | 22 | 43% / 20% | 52.6, 38.7, 31.9, 14.4, 57.8 | 2 | 4.9, 6.3, 11.0, 8.1, 25.2 |
| m | B; ×1.7, line 0.4 | 12 | 50% / 35% | 43.0, 17.7, 24.3, 17.7, 58.8 | 2 | 2.8, 2.4, 7.8, 8.5, 28.9 |
| n | B; ×1.3, 0.54 d^0.68 | 2 | 78% / 67% | 20.5, 12.2, 13.8, 5.6, 16.9 | 1 | 0.8, 1.1, 3.2, 2.0, 5.2 |
| q | B; ×1.25, table 1, 1.3, 2.0, 2.4, 2.6 | 7 | 85% / 70% | 14.0, 9.3, 32.2, 16.9, 41.6 | 1 | 0.8, 0, 8.9, 4.5, 11.6 |
| t | B; ×1.25, table 1, 1.45, 1.72, 2.3, 2.3 | 5 | 85% / 60% | 17.3, 15.3, 18.3, 12.3, 35.5 | 1 | 1.0, 0.8, 4.1, 5.5, 7.8 |
| **final** | B; ×1.25, table 1, 1.45, 1.72, 2.3, 2.05 | **4** | **85% / 60%** | **18.0, 16.3, 20.3, 14.4, 28.4** | **1** | **1.0, 1.0, 4.5, 5.4, 5.4** |

**The game as committed** (`WORKERS=4 node qa/lab/gloam-downs-bot.mjs 60 <skill> 1`):

| Skill | First run reaches place 2 / 3 | Median first win | Runs (won) | Death rate by place, 1 to 5 | Damage per foe by place (median, zones only) | Interrupts a run (chosen) | Damage taken a run |
|---|---|---|---|---|---|---|---|
| 0.3 | 85% / 60% | run 4 (60 of 60) | 649 (209) | 18.0, 16.3, 20.3, 14.4, 28.4% | 13.3, 7.5, 9.8, 16.3, 28.8 | 32.6 (0.1) | 541 |
| 0.5 | 95% / 92% | run 1 (60 of 60) | 388 (318) | 1.0, 1.0, 4.5, 5.4, 5.4% | 7.3, 3.9, 5.3, 7.0, 15.5 | 44.9 (0.8) | 461 |
| 0.9 | 100% / 100% | run 1 (60 of 60) | 370 (338) | 0, 0, 3.0, 1.1, 1.7% | 1.4, 2.0, 2.1, 0, 9.3 | 48.6 (28.4) | 209 |

Hooks from braced foes a run: 3.24, 1.64 and 0.12; from steeled foes: 2.83, 2.16 and 0.15. The 0.9 bot cuts into an armored wind-up 2.9 times a run, each a heavy foe its next cut breaks. The catalogue at 0.5 (`MAXRUNS=30 AFTER=30 WORKERS=4 node qa/lab/gloam-downs-bot.mjs 10 0.5 1`): 25% bought by run 8, 50% by run 15, 75% by run 22, all of it by run 28; 265 of 300 runs had a buy.

Against the targets:
- At 0.3, place 2 in 80% of first runs and place 3 in 40%: **met** (85%, 60%).
- At 0.3, the median first win in run 8 to 20: **missed**, run 4 (it was run 1).
- At 0.5, run 3 to 8: **missed**, run 1.
- At 0.9, run 1 to 2: **met**.
- No death spike at 0.3: **met** (places 1 to 4 at 1.05, 0.94, 1.18, 0.83 times their mean, Barrow Crown 1.65). At 0.5 **missed** at the Bell Knoll (1.80 times a mean of 3.0%); at 0.9 **missed** at the Fen (2.89 times a mean of 1.0%). Both are a few deaths in a few hundred visits.
- Damage per foe rising 0.9 to 1.6 times a place: **missed** at 0.3 (0.56, 1.31, 1.66, 1.77) and 0.5 (0.53, 1.38, 1.31, 2.22). It falls after the Gaol at every setting tried: the Gaol's fights come first in a run, before any ability or spark.
- The 0.5 bot interrupts more than 3 times a run: **met** (44.9). A buy in two of three runs: **met** (265 of 300).

**Why the 0.5 target still misses.** The 0.3 bot reads a wind-up 0.57 s after it starts on average (±0.1 s), mostly later than a hook's 0.55 s, so it seldom rolls from a hook; the 0.5 bot reads it at 0.48 s and rolls in time. That gap makes the two bots far apart. Every setting that brought the 0.5 bot to run 3 or later (k) put the 0.3 bot's first-run deaths in the Gaol over 50% (l, at a lower damage, was already at 53%), against the target of 20% or less. The two targets cannot both hold with this bot, and the 0.3 targets were kept: they are the closest to a player who found the game hard. The next step is still a playtest.

**The fixes the checker asked for** (each has a check in `qa/lab/gloam-downs-fair-checks.test.mjs` that failed before):
- An elite's special move cut off (put out, a poise break, a parry, a stun or a hold, or its zone sunk for a guard) ends at once, and its token comes back: `cancelMove` ends the special too (`elites.js` `K.end`). Before, a Wardmother put out in her double hook kept the one melee token of the Gaol for the rest of the place, and a Rookchief the coal token.
- The blows on their way count every active phase of a special (the second hook, the second pulse), a lob until its coal leaves the hand, and nothing from a foe put out or held (`F.due`).
- The snap's hit stop, cue and kick come once a step.
- A stun or a hold lets the flinch and the brace count on, and a knock-down in a wind-up counts as a cancel.
- The poise holds full in the 4 s after a stagger, so the rim does not empty while the foe cannot break.
- The bot rolls from armored wind-ups (above).

**Not changed:**
- `tellFree` is still left to the page's default (always true), and the bot passes neither `onScreen` nor `tellFree`, so its foes are always on screen: it never sees the 0.25 s longer off-screen wind-up. Its numbers are for a player who keeps the fight in view.
- A sideways roll started 12 steps before a Snuffer's hook lands can still be hit as the roll ends (the hook's step and its tracking reach past the roll's safe time). Rolling earlier, later, back or in place is safe.
- A press in the last 0.1 s of a wind-up trades badly: the cut lands after the blow. That is the timing of the genre.
- The cancel picture: the ground ring of sparks and the hook's tell help, but on the step of the cancel a Snuffer behind the lamplighter is still hidden by it.

## Checks
**Second pass**, run on the finished code: every `qa/lab/gloam-downs*.test.mjs` passes (fair-checks 17, new; fair 18, foes 32, foes-ai 44, feel 12, run 70, boss 29, sound 31, seed 10, growth 29, builds 34, abilities 28, camera 49, keys 9, lattice 16, life 13, mouse 11, screens 11, stairs 1, uniform-blocks 10, the explorer's 33); `qa/lab/gloam-downs-zones.mjs` 177 ok; the boss sim as before (38 of 40 bots at 0.3 first win, 40 of 40 at 0.5 to 0.9); browser (software WebGL): run.interrupt 7, run.fight 8, run.boss 24, run.feel 5, run.abilities 9, run.growth 4, run.cards 12, run.sound 19, run.builds 7, run.input 17, run.swing 2; `qa/arcade/quiet.mjs --only=lab/gloam-downs` 35 of 35; `openspec validate --strict` valid. Not rerun in the second pass: run.lineup, camera, mouse, clicks, cutaway, screens, the explorer's e2e, life and the music demo (none of their code changed; the `snap` cue is the same). Not run at all: a real phone, a real pad, listening on speakers, and a run played by hand.

**First pass**, run on 2026-11-26. The e2e checks ran on software WebGL (SwiftShader) in Chromium, with the site served by `python3 -m http.server`.
- Node: every `qa/lab/gloam-downs*.test.mjs` passes: fair 18 (new), foes 32, foes-ai 44, feel 12, run 70, boss 29, sound 31, seed 10, growth 29, builds 34, abilities 28, camera 49, keys 9, lattice 16, life 13, mouse 11, screens 11, stairs 1, uniform-blocks 10, and the explorer's 33. `qa/lab/gloam-downs-zones.mjs`: 177 ok, no failure.
- The boss sim (`node qa/lab/gloam-downs-boss.sim.mjs`, the Reeve with its poise): first win for 38 of 40 bots at 0.3 (median 2 tries) and 40 of 40 at 0.5, 0.7 and 0.9.
- The music demo, `cues` group: 134 files, every target met; `snap` at -18.9 LUFS momentary, between cut 1 (-21.1) and the boss slam (-13.3), its three bands within 15 dB. Its first recipe (a 40 ms knock) measured -25.8, under cut 1, so the knock and the crackle were made longer and louder.
- `node qa/arcade/quiet.mjs --only=lab/gloam-downs`: 35 of 35.
- `openspec validate gloam-downs-fair-fight --strict` and `gloam-downs-growth --strict`: valid (each notes that an archive would refuse its MODIFIED requirements until `gloam-downs-run` has a canonical spec; this change must be archived after the earlier ones).
- Browser: `gloam-downs-run.interrupt.e2e.mjs` (new) 7 checks; run.fight 8, run.boss 24 (the poise line at 390x844, 320x640, 360x640, 800x600 and 844x390 on touch, 1280x720 and 800x600 with a mouse), run.abilities 9, run.growth 4, run.cards 12, run.input 17, run.builds 7, run.feel 5, run.sound 19, run.lineup 15, run.swing 2, camera 8, mouse 8, clicks 46, cutaway 1, screens 18, and the explorer's `gloam-downs.e2e.mjs` 17. `gloam-downs-life.e2e.mjs`: its four parts that show life (seen, crows, hush, reduced motion) pass; its frame-time part was measured for 10 views with `WARM=2 DRAWS=20 BLOCK=5` (life against none from 0.986 to 1.034 times) and then stopped by the session's 30-minute limit for a background job, as software WebGL draws about one frame in 10 s. `life.js` and `beds.js` do not change here.
- Pictures (390x844 and 1280x720): a flinch, an armored wind-up (the Ironback's rim of 8 cold dabs round its body, clear of its lane) and a cancelled hook (the snap's sparks at the Snuffer).
- Not run: a real phone, a real pad (the pad was mocked), listening on speakers (the snap was measured, not heard), and a run played by hand. The run-count targets were measured only with the bot, and a person plays less evenly than it does.
