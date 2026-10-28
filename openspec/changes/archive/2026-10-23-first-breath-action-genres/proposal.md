# First Breath: a different action genre in every stage

## Why

The user played First Breath and said:

> "game is pretty boring tbh. make it more action improve the mechanics. borrow for conventional games that make it
> fun. like bullet he'll shooters. rouge likes. action adventjre shooters. battle royals. make it actually fun. not
> just a tapping nonsense. maybe there could be a rhythm mechanism in one part but not all of it. each stage could be
> a different style of mechanic or genre"

Today most stages ask for taps on a beat, holds and gentle steering. Nothing pushes back, so there is little to
master. The user wants real action, with each stage in its own genre, and rhythm in one stage only.

The user chose this plan, and then changed stages 1 and 2 after seeing the first draft: "stage one should be a racing
game. like Mario cart or forza perhaps with battle royale elements". They then corrected themselves: "sorry I meant to
say stage one was fun stage 2 had potential just make it more like a bullet hell", and added "or like a brick breaker
kinda thing maybe". So the current race stays with kart parts on top, and stage 2 becomes a radial brick breaker with
bullet-hell patterns, built on its arc.

| # | Stage | Genre |
|---|---|---|
| 1 | The Race | The current race, kept, with kart racing (Mario Kart, Forza) and battle royale knockouts on top: drifts, items, slipstream, gates that close behind the pack; 20 sperm, only the first 3 reach the egg |
| 2 | The Egg | A radial brick breaker (Arkanoid, Breakout, Circle Pong) with bullet-hell patterns (Touhou, DoDonPachi): the arc is the paddle, rival sperm in formations are the bricks, their enzyme sparks are the bullets, a seal charge is the bomb; a swarm in phases, then a rush where you let in only your own sperm |
| 3 | The Embryo: first cells | Roguelike: pick a gift at each split |
| 4 | The Placenta | Action-adventure: grapple and tunnel to find food pools |
| 5 | First Trimester | Twin-stick style shooter against germs, with a boss |
| 6 | Second Trimester | Rhythm: your mother's heartbeat and songs (the only rhythm stage) |
| 7 | Third Trimester | Survivor-style auto-shooter: waves while you grow |
| 8 | Birth | Endless-runner escape: contractions push you on |
| | The ending | Stays calm: the first breath |

The user also chose the controls: drag anywhere to move, and firing is automatic at the nearest foe, so one thumb
plays. A second tap dashes (or uses a special). On desktop, WASD or the arrows move and Space dashes. The paper-cut
look stays. Each stage keeps its real biology facts and its calm, caring words. Foes are framed in biology (germs,
acid, white cells, rival sperm, enzyme sparks). Nothing is ever gory, and nothing is killed: germs pop into
sparkles, and sperm bounce off, drift away or rest.

## What changes

- **A shared action layer** (`core/lib/action.js` and `core/lib/actionbot.js`, written by the foundation builder
  and described in `contract.md`): move by drag or keys, a dash on a second tap or Space, auto-fire at the nearest
  foe, pooled bullets, foes with chase, orbit, wander, shooter and still behaviours, bullet patterns with
  telegraphs, pickups, waves, a safe zone, hp with a knock-out, and juice. Stage 5 is rebuilt on it first.
- **Stage 1 keeps its race and becomes a kart race.** The pack, the steering, the waves, the fork and cool loop,
  the tube's current and warm lane, the glow walls, the place slot and the catch-up stay as built. On top: a winding
  tube with bends, Mario Kart drift boosts, item boxes weighted by place, slipstream, white cells and a cool tide,
  and three knockout gates that let only the first 14, 8 and 5 go on.
- **Stage 2 becomes a radial brick breaker with bullet-hell patterns, on its arc.** The arc and its controls,
  sticking and popping loose, held rivals and your gold sperm stay. A glow bounces off the arc into formations of
  rival sperm that take 1 to 3 hits; broken ones drop power-ups for the arc to catch (Multi, Wide, Pierce, Slow,
  Mend). The formations fire enzyme sparks in patterns that build over the waves (aimed streams, fans, curtains,
  rings, a turning stream); the arc blocks them, and a blocked spark flies back into the bricks. A seal charge is the
  bomb. Shell pips go for sparks on the shell, a lost glow and a held rival. The climax is a swarm in three phases,
  then a rush where you let in only your own sperm. The follicle taps and the beat-timed seal go, so stage 6 is the
  only rhythm stage.
- **Five stages rebuilt in their genres** on that layer, as `design.md` sets out with numbers: the roguelike splits
  with gifts, the tunnel and grapple map, the shooter of stage 5, the survivor waves with your mother's antibodies as
  your weapons, and the runner of birth. Stage 6 becomes the one rhythm stage: three lanes, call and response, and a
  sing-along climax.
- **A knock-out.** In stages 2, 3, 4, 5 and 7 you have hp. At 0 you rest, and the gentle Almost card offers Try
  again or Go on. Go on lets the stage's development play out by itself, with no Goal points and no grade word, so
  the run always goes on. Stage 1 keeps its Almost card by place, now also when a gate closes behind you. Stages 6
  and 8 have no knock-out.
- **Bosses and climaxes**: the last gate and the final straight (1), the swarm and the rush (2), the Knot (3), the
  first heartbeat that clears the map (4), the Big Germ (5), the sing-along (6), the Big Germ wave and the turn (7),
  and the last wave into the light (8).
- **Tone rules revised for action.** Germs, acid, white cells and enzyme sparks may be hazards. Shown words stay
  gentle (pop, clear, shoo, bounce, rest, dodge), and the banned word list stays. From stage 2 on, {carer}'s body
  only helps you: the heartbeat, the songs, the antibodies, the waves of birth.
- **New facts** from sources already on the allow-list: the acid start and the white cells (stage 1), the enzyme
  cap (stage 2), the antibodies that cross the placenta (stage 7), and short "In the game ..." frame lines.
- **Controls.** The move gesture with auto-fire and dash replaces the drag-and-hold moves and most beat taps. The
  stage 2 arc keeps its v1 controls, and a press releases its seal charge. In stage 1 the press drifts or uses an
  item. Timed taps stay only in stage 6. One-button mode moves you by the stage bot while held. Assist gives more hp,
  slower foe bullets and fewer foes.

## Capabilities

- Modify `first-breath-stages`: the eight stage requirements, the knock-out and the bosses.
- Modify `first-breath-input`: the move gesture, dash, auto-fire, drift and items, the stage 2 seal press, lanes,
  one-button mode and Assist; remove the drag-and-hold rule. The stage 2 arc rules stay.
- Modify `first-breath-journey`: the knock-out and Go on, the score gates, carry, the run length.
- Modify `first-breath-presentation`: the action draw items, the HUD (hp, the race tags, the boss bar), shape-coded bullets,
  flash safety in busy fights, and frame budgets at the busiest moments.
- `first-breath-facts-and-tone` and `first-breath-arcade-machine` keep their requirements. The tone revision is in
  `design.md` section 2; the banned word list is unchanged.

## Impact

- Code: `public/first-breath/core/stages/*` (every stage but the ending), `core/lib/action.js`,
  `core/lib/actionbot.js`, `core/draw.js`, `core/run.js` (the knock-out card), `core/bots.js` (the dash press),
  `core/carry.js` (sparks as a shield), `ui/input.js` (the move gesture and dash), `ui/hud.js` (hp pips, the race
  and item tags, the boss bar), `render/items.js` and `render/palette.js` (bullets, foes, pickups, the track, gates,
  the tide, lanes, folds).
- Checks: every `qa/first-breath/stage-<id>.test.mjs`, `sim.test.mjs`, `run.test.mjs`, `draw.test.mjs`,
  `pacing.test.mjs`, `text.test.mjs`, `facts.test.mjs`, and the browser checks `input`, `layout`, `visual`, `perf`
  and `smoke`.
- The cabinet attract line RACE · GUARD · CRY still fits. The run stays about 10 minutes (8 to 12).
