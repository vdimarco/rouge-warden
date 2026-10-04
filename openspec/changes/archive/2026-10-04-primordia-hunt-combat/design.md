# Design: The Hunt

The full working design (about 1,100 lines, with lab tables, wave tables and the cut list) came out of a multi-agent workflow: one diagnosis, two Lenia lab technicians running experiments on the real engine, five designers each mining a different family of combat games, three judges (fun, feasibility, coherence) and a synthesizer. This file records the decisions that shape the code and the places where the build departed from that document.

## Diagnosis that drove it

- Hunters moved 8-9 cells/s against the player's 31 and only stung on contact. Reference bots lost 0.5-2.5% of their light to hunters and the rest to hunger.
- 67-71% of hunters dissolved on their own (toxin purges and merges).
- No attack outside Frenzy; Frenzy ran 23-31% of the time, and firing it at once always beat waiting.
- A costly decision came every 15-19 s. A blind bot that never fought scored as well as a skilled one.

## Shared damage model

Lenia damage is a burst threshold, not hit points: 30-35% torn at the core in one step kills, the same amount spread over 10 steps heals. So the game keeps its own `tear` value per hunter (mass torn / species mass, x1.5 while Exposed or staggered), decaying 0.15/s after 1.2 s without a hit. Tear 0.20 staggers. Lenia drains are the visual and can still kill outright; a hunter that dies within 6 s of the player's last cut is credited as a bleed-out. One dash tears at most 22% of a hunter, because the lab showed lengthwise cuts of 28% or more kill outright and some cuts make a body grow.

## Motion rules (lab gates)

- Arcs move by semi-Lagrangian advection, at most one move per hunter per sim step (kicks fold into that move). Lunges run 1.6-2.0 cells/step for 10-12 steps.
- Discutium and brood under 200 mass move by whole-cell `World.roll` (exact copy, no blur): fractional advection killed small bodies in the lab.
- Circium eggs never move.
- Prey are never advected; the Gut Pull Duo rolls a Remains prey and its agar together by whole cells.

## Telegraph and tokens

Stalk, windup (crouch, hold the glide, aim, lock the lane at 50%, glint for the last 0.2 s, 0.45 s real-time floor), lunge, recover (Exposed), cooldown. Attack tokens (1 in epochs I-II, 2 in III-V, 3 from VI) space out lunges; the Leviathan holds its own. A lane that would run into another body is cancelled, and a lunge that meets one ends early, so lunges never fuse hunters.

## Timing

Real-time clocks for the player, charges, combo, Burst, Stasis, Remains and eggs. Sim-step clocks for windups, lunges and staggers, so Stasis (sim at 0.3x) slows them. Hit-stop lives in core: `update()` returns early while frozen, so no burst of sim steps follows; freezes are capped at 0.25 s per second and skipped while another nearby hunter winds up (parry and Glory Bite freezes shrink to 0.04 s instead).

## Departures from the workflow design (found while building)

- **Separation is a hard rule.** The design's soft push (k 0.30) lost to the chase and to each creature's own glide (Lenia gliders drift 0.3-0.36 cells/step). Inside the gap, a hunter's closing velocity, counting its measured natural glide, is removed, then the push is added. The chase is clamped at 0.30 before separation; separation may raise the total to 0.6 cells/step.
- **No spawn on top of a body.** When no clear spot exists, the unit stays queued instead of spawning at the least bad spot. Clearance uses both bodies' real reach.
- **Fused bodies burst locally.** A named hunter that swells past 1.8x its species mass is wiped on its own. The global quorum toxin for hunters stays only as a backstop (limit = 1.6 x the tracked-hunter budget + 300), so one merge no longer purges every hunter in the dish.
- **Discutium heading measured.** Discutium glides about 90 degrees clockwise from its stamp angle, the same as the arcs, so every glider spawns aimed at the player the same way.
- **Proc chains.** A kill made by a proc only sets off another Spore Burst with the Chain Bloom Duo, three links deep at most, four proc drains per second at most.
- Result in a 100 s stress run where the player never fights: 0-2 hunters dissolve on their own per run and no red tide starts (was about 70% of hunters).

## Feedback

Shader marks for up to 8 hunters (windup heat, glint, stagger gold, Exposed, collapse, egg crack), 70 ms tissue flashes on cuts, an expanding Burst ring, and a Stasis grade (60% desaturation, violet tint; staggered bodies keep color). The fx canvas draws lanes (true footprint from `blobExtent`), glint stars, stagger rings and motes, egg timers, Remains blinking, dash pips, the Burst reach ring, boss phase pips and Nerve Net arcs. Web Audio cues for every event; Stasis sweeps a master low-pass to 700 Hz. Reduced motion: no shake or shards, freezes halved, the Stasis slowdown kept.

## Review fixes

An adversarial review (four lenses, a skeptic per finding) and the QA suite found these, now fixed:

- **A Glory Bite needs a new move.** The mouth could bite a hunter in the same dash that staggered or parried it, so one press killed. Now the bite waits until that dash ends and the hunter has reeled for 0.25 s. The dash that collapses the Leviathan cannot bite it either.
- **The Leviathan has no shortcut.** A Burst no longer eats it whole; hunt bites tear its wings at half weight. A swollen boss is trimmed at its densest cell. Phase 3 lays its eggs just outside its own clearance.
- **Moves carry only their own tissue.** `advect` and `roll` skip cells labelled as another body, so a lunge beside a Discutium no longer drags part of it along. Separation also measures the real tissue gap along the line between two bodies and pushes hard inside 16 cells, because hunter kernels reach 10 cells and Lenia pulls closer bodies together. A kick never drags an egg. An unnamed body over 520 mass (two fused hunters) bursts at once.
- **Splits are not kills.** A bleed needs three low steps in a row, brood that merges back into its parent is removed without credit, and brood regrowth is not a rupture.
- **Burst economy.** The hunt clock starts before the blast, so the blast cannot refill the meter. Caught Discutium and small brood are devoured at once (the lab's 2-step kill holds only for a centred blast). Eggs eaten in the hunt count as eggs. A Burst that clears the dish starts a relax beat.
- **Director.** Caps and wave clears count stamped bodies that tracking has not picked up yet. Queued units wait out relax beats and the boss; waves held by a boss keep an 8 s gap; a queued Leviathan carries over to the next epoch. An empty mutation offer starts the next epoch.
- **Shell.** Freezes run in real time and slow motion follows them. Field edits made during a freeze reach the screen. Game over follows the run state, so a pause right after death cannot lose it. Space and early taps cannot skip the results or pick a card. Windup sounds stop when the attack ends. Reduced motion also turns off shards, shader pulses and blinking rings.

## Balance check

The reference bot (`qa/primordia/bot.mjs 160 <seed> ref`, 0.15 s reactions) after the fixes, seed 7 landscape and seed 11 portrait:

| Target | Result |
|---|---|
| Ref survives 160 s | yes, epoch IV, scores 235k-240k |
| Hunters that die without the player under 15% | 0-6.5% |
| Decision gap 3 s or less | 1.55-1.74 s |
| Burst uptime 12% or less | 7.0-9.8% |
| Stasis 3-8 per minute | 2.6-3.4 |
| Red tides, cap violations, same-dash bites | 0, 0, 0 |
| Ref minimum light 30-50% | missed: 74-76% |
| Stings and lunges 30-50% of light lost | missed: 0.3%; 0 lunge hits in 18-21 windups |

The bot reads every lane and dodges with spare dash charges, so lunges never land. The two damage targets stay missed on purpose: after this build the user said the game was hard to understand, so the tuning keeps its current difficulty and the intro teaches the moves instead. A human-tested pass can raise pressure later through `TUNE` (lunge speed, windup steps, dash i-frames).

## Fun pass

After the review fixes the user still called the game boring (most likely about the build on main, which predates this change). The acceptance table showed why a run feels flat:

- Epoch I was mostly empty: 54-85% of it with no hunter within 25 cells. It sent one Paraptera, then nothing for 13 seconds.
- Many attacks were fake. 20-60% of all windups were cancelled at lane lock, because a swarm near the player sat in the lancer's path. Anti-merge separation also kept swarms hovering 10-20 cells off the player, so they rarely stung.
- With one attack token in epochs I-II and 3 s cooldowns, the dash sat at full charges 60-68% of the time.

Changes:
- **No fake windups.** Before a windup, a hunter checks the lane it would lock. When a body blocks it, the hunter circles around (orbit x3 for 1 s) and attacks once the path is clear. The lock-time check stays as a backstop.
- **Hit and run swarms.** A Discutium rushes for up to 3 s (or until it touches you), then peels away for 1.6 s. Its chase rose from 0.20 to 0.30 cells/step and its speed limit to 0.40, so it can beat its own glide. While another hunter's lane is locked, a swarm in or beside it swims sideways out of it: in the first acceptance run after the pace change, a swarm rushed into a lunge, the two fused and a red tide started.
- **Pace.** Epoch I waves: PD at 2 s, PDD at 12 s, PEE at 24 s. Epoch II: PPD (pincer), DDDEE, QPD. Tokens per epoch: 1, 2, 2, 3, 3, 3. Cooldown 50 steps (min 32). Lancer chase 0.13 (+0.012 per epoch, max 0.22). Lanes lead the player from epoch III.
- **Rule leaks closed.** A Glory Bite cannot land on the last frame of the staggering dash. A Leviathan torn under 35% of its mass collapses at once instead of bleeding out; a husk that dies in its collapse, or a boss that falls apart under recent cuts, counts as devoured.

Result in the acceptance table (3 seeds, landscape and portrait, after these changes): the emptiest full epoch has 45-51% idle time (was up to 85%), the reference bot's lowest light is 38-68% (was 54-76%), 0 red tides, 0 Glory Bites in a staggering dash, and the Leviathan dies by Glory Bite (one boss per run in two runs fell apart in phase 2 under cuts and counts as devoured). Small misses remain: one cap overrun episode on 3 of 6 seeds, one blind bot that lived into epoch IV, Burst uptime 10-17% (target 12%), and 2-4 Stasis per minute (target 3-8).

Tried and dropped: swarms at 0.45 cells/step with a smaller separation room (more swarms died on their own: 3-14% of named deaths) and a later lane lock with shorter i-frames (the reference bot reads every lane exactly, so it still took no lunge hits; the change would only punish people). The bot dodges every telegraph with 0.15 s reactions, so its damage share stays far under the 30-50% target; human play is the real check.

## How to play intro

`intro.js` holds eight scenes and no DOM code: title, eat, dodge, cut, bite, parry, Burst, and an end card. Each scene builds a small situation on a seeded 256x128 `Game` (stamped prey and hunters, director and prey spawner off, the player kept at full light) and then steers the player with the same input object a person makes. So every lane, cut, Glory Bite, parry and Burst in the intro is the game's own rule at work. Two small helps keep the lesson readable: the dodge and parry windups run at half speed, and a cut that tears less than 20% still shows the gold state. The reel is held while the caption changes.

A scene ends a set time after its move happens (never before its reading time, never after its limit). `qa/primordia/intro.test.mjs` plays every scene in Node and checks each move. The browser draws callouts over the dish (a ring that draws itself around YOU, FOOD, HUNTER, GOLD and so on, with a leader line and label), and animates the captions word by word. The camera frames a 124 x 70 cell window (96 x 56 on portrait) above the captions and pushes in 6% per scene; on short landscape phones the captions move to a side panel. PLAY runs the intro the first time; the HOW TO PLAY button and the H key replay it; Skip, Escape or gamepad B leave it. Reduced motion keeps the dish but drops the word motion and the camera push.

## Arcade cabinet

`attract.js` runs `Game(128, 128)` in demo mode and paints it to the cabinet canvas while the cabinet is selected. `Game` scales bloom limits and creature counts by dish area so the small dish stays clean; the 256x128 game is unchanged.

## Cut (summary)

Organelle auto-attacks and spit streams (continuous chip drains make arcs regrow or bloom), Asteroids splits (outcomes too chaotic), Helicium turrets (volatile), Pyroscutium (dies under motion), size tiers, prey torpedoes (reverse coupling starts red tides), a third button, and a portrait camera zoom.
