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

## Arcade cabinet

`attract.js` runs `Game(128, 128)` in demo mode and paints it to the cabinet canvas while the cabinet is selected. `Game` scales bloom limits and creature counts by dish area so the small dish stays clean; the 256x128 game is unchanged.

## Cut (summary)

Organelle auto-attacks and spit streams (continuous chip drains make arcs regrow or bloom), Asteroids splits (outcomes too chaotic), Helicium turrets (volatile), Pyroscutium (dies under motion), size tiers, prey torpedoes (reverse coupling starts red tides), a third button, and a portrait camera zoom.
