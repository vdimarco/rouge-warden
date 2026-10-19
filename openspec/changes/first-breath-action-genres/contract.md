# First Breath: the action layer contract

The shared layer for every action stage of `first-breath-action-genres`. Where `design.md` and this file disagree on
an API name or a default, this file wins. Stage 5 (`core/stages/grow.js`) is the worked example: read it beside this.

Files: `core/lib/action.js` (the world), `core/lib/actionbot.js` (the bot), `core/lib/rest.js` (a knock-out's rest
until the captions are read), `core/draw.js` (`action` in the draw list),
`render/action.js` (the paper items; `render/items.js` re-exports them), `ui/input.js` (the `move` gesture),
`ui/hud.js` (hp pips and the boss bar), `ui/pops.js` (number pops), `ui/sound.js` (`act.*` sounds), `core/run.js`
(the Almost card, Try again, Go on). Tests: `qa/first-breath/action.test.mjs`, `stage-grow.test.mjs`.

## 1. The world: `core/lib/action.js`

Pure and seeded (`stream(seed, "action")` as `A.rnd`). World units, seconds, radians (counterclockwise, y up).
`import * as X from "../lib/action.js"`.

### Make and step

| Call | Does |
|---|---|
| `createWorld(seed, opts)` → `A` | `opts`: `arena` `{ x, y, r }` or `null` (default `{0, 0, 46}`); `player` (override of `ACT.player`, plus `x`, `y`, `fixed`, `shield`); `dash` (override of `ACT.dash`, or `null` for none); `fire` (override of `ACT.fire`, or `null` for no auto-fire); `pickup`, `combo`, `foe`, `juice` (overrides); `bulletK` (foe bullet speed factor); `bulletCap` (foe bullets at once); `keepOut` `[{ ang, half }]` (arcs of the wall where no foe spawns); `wallCull` (u past the arena's wall at which a bullet is removed: default 6, stage 7 uses 0). |
| `stepWorld(A, intents)` → `moved` | One fixed step. Returns `false` under a hit-stop: the world holds still and `A.t` does not move; run your own step-counted timers only when it returns `true`. Fills `A.out` (below). |
| `emitOut(A, st)` | Turns `A.out` into `sfx` events `act.<type>` on the stage state, thinned in time. Call once after each step. |
| `actionView(A, { player = true })` → the draw list's `action` part | Fresh arrays; `A` is unchanged (view stays pure). Add `arena` yourself: `d.action = { ...X.actionView(A), arena: { ...A.arena } }`. |

`A.out`, in order, each `{ type, x, y, ... }`: `dash`, `shot` (your sparks), `fire` (a foe pattern: `kind`, `n`),
`tell`, `strike` (your hit on a foe: `id`, `boss`), `clear` (a foe cleared: `id`, `kind`, `value`, `gain`, `combo`,
`boss`), `ouch` (you were hit: `hp`, `shield`, `from`), `ko`, `pick` (`kind`, `v`).

Read-only state a stage may use: `A.t`, `A.p` (`x, y, vx, vy, r, body, hp, hpMax, inv, dashCd, shield, face, mx,
my`), `A.foes`, `A.b` and `A.k` (pools: `n`, typed arrays), `A.tells`, `A.score`, `A.combo`, `A.bestCombo`,
`A.kills`, `A.hits`, `A.dashes`, `A.food`, `A.spawned`, `A.value` (sum of spawned values), `A.cleared` (sum cleared),
`A.ko`, `A.fire` (writable: grow your sparks by setting `rate`, `spread`, `arc`, `pierce`, `dmg`, `range`).
Writable by a stage: `A.bossBar` (unset: the boss bar follows the first foe with `boss: true`; `{ hp 0..1, phase }`:
your own bar, such as stage 2's swarm; `null`: no bar), a foe's `phase` (its core colour and the bar's colour) and a
`still` foe's `vx, vy`.

### Defaults (`ACT`)

- **You** `ACT.player`: hitbox `r` 1.7, `body` 4 (pickups, drawing, the wall), `speed` 36 u/s, `accel` 18/s,
  `hp` 5, i-frames `invS` 1.0 s, `mercyR` 9 (foe bullets cleared on a hit), `push` 6 u, `safeR` 14 (no foe bullet
  made this close), `clearR` 24 (no foe spawns this close), `shield` 0.
- **Dash** `ACT.dash`: `speed` 110, `s` 0.15, i-frames `invS` 0.26, cooldown `cdS` 0.85, input buffer `bufferS`
  0.12. Along the move, else the way you last faced.
- **Auto-fire** `ACT.fire`: `rate` 5/s, `dmg` 1, `speed` 95, `spread` 1, `arc` 0.2, `pierce` 0, `range` 60, `r`
  1.1, `life` 0.9, knock-back `kb` 6. Aims at the nearest active foe in range, leading it a little.
- `ACT.pickup` (magnet 15, pull 80, life 9 s), `ACT.combo` (window 1.3 s, +0.1 a link, at most 2.5×),
  `ACT.foe` (spawn tell 0.6 s, steer 4, separation), `ACT.juice` (shake, flash, hit-stop frames: 5 on a hit, 6 on a
  big clear, 8 for a boss phase), `ACT.bulletCap` 400, caps: 640 bullets, 48 foes, 96 pickups, 16 tells, 12 pops,
  16 bursts.

### Foes, patterns, tells

- `spawnFoe(A, spec)` → foe or `null`. `spec`: `kind` (`germ blob spore ring boss rival cell drop guard`: its look),
  `ai` (`chase orbit wander shooter still`), `x, y, r, hp, speed, value, touch` (contact damage), `drops`
  `{ food: n, heal: chance, up: chance }`, `gun` `{ pattern, every, tellS, first, jitter, burst, gap, spin }`,
  `keep` (shooter range), `orbit` `{ r, w }`, `mass`, `boss`, `spawnS` (spawn tell; cannot move, shoot or be hit),
  `steer`, `anywhere` (skip the keep-out). A spawn within `clearR` of you, or in a `keepOut` arc, moves along the
  wall to the nearest good place. `still` foes are yours to move: set `f.vx, f.vy` (a still boss keeps them).
- `shoot(A, x, y, pattern, ang)` → bullets made, or **−1 when a foe pattern must wait** (it would start within
  `safeR` of you or pass `bulletCap`). A gun waits and fires as soon as it can; your own calls may skip. `pattern`:
  `{ kind: aimed | fan | ring | spiral | wave, n, arc, arms, speed, r, tone: foe | hot | soft, life, dmg, w, wf,
  turn, acc, side }`. Aimed is a stack of `n` at rising speeds; spiral fires `arms` per call (advance `ang` by
  `spin` between calls, or use a gun `burst`).
- A gun telegraphs by itself: its tell (`line` for aimed and wave, `fan`, `ring` for ring and spiral) shows for
  `tellS` before each shot, and the foe's `charge` (0 to 1) swells its core. Your own scripted patterns must call
  `addTell(A, { kind, x, y, ang, r, len, w, dur, foe })` at least 0.35 s before (design.md 4.3). `foe: id` makes a
  tell follow that foe.
- `damageFoe(A, f, dmg, kx, ky)` (your own hits), `removeFoe(A, id)` (drift away, no score), `nearestFoe(A, x, y,
  range)`, `rimPoint(A, ang, inset)`, `foeBullets(A)`, `clearBullets(A, side, x, y, r)` (side 2 foe, 1 yours, 0 both).
- Waves: `W = makeWaves(rows)` (each row a `spawnFoe` spec plus `at` in world time `A.t`, `ang` on the wall or `x, y`,
  `n` and `spread` for a group), `spawnDue(A, W)` each step, `wavesDone(W)`, `foesLeft(A)`.

Foe bullet speed caps (design.md 3.2), after `bulletK`: stage 2 at most 24 u/s, 3 at most 34, 4 at most 24, 5 at
most 36 (the run's fastest: an aimed stack at 30 and 34), 7 at most 30. A spawn tell is at least 0.6 s, a pattern's
tell at least 0.35 s; the foe bullet cap is the stage's (`bulletCap`).

### You, pickups, zone, juice, score

- `hitPlayer(A, dmg, from, fx, fy)`: a shield pip goes first, else hp; i-frames, a push away from `(fx, fy)`, the
  combo lost, mercy clear, flash, shake, hit-stop. `heal(A, n)`.
- `drop(A, kind, x, y, n, v)` (`food heal up`), `vacuum(A, s)` (pull every pickup in, e.g. at a wave's end). Food
  adds to `A.food`; heal heals; `up` is only reported (`pick`), the stage applies it.
- `setZone(A, { x, y, r, to: { x, y, r }, t0, t1, tickS, dmg })` or `setZone(A, null)`; `inZone(A, x, y, pad)`.
  Outside it you lose `dmg` every `tickS` (no stage uses it now; it stays).
- `pop(A, x, y, value, combo)`: a number pop (DOM). The layer never pops by itself: pop what you add to the HUD.
- `burst(A, x, y, r, kind)`: paper flecks (0 a clear, 1 a hit, 2 a pickup); clears and hits make their own.
- `hitStop(A, frames)`, `comboMult(A)`. Score: each clear adds `value × comboMult` to `A.score`.
- **Knock-out:** hp 0 sets `A.ko` and emits `ko` once. The layer never ends anything: the stage does (section 4).

## 2. The bot: `core/lib/actionbot.js`

`actionSteer(A, skill, r, { keep, picks })` → `{ steer: { x, y }, dash }` with `|steer| < 1`. `keep: false` drops
the range it keeps from the nearest foe, `picks: false` the pickups it fetches (for a stage whose goal is elsewhere).
A potential field: each foe bullet's closest pass within a look-ahead, the tells it has seen (out of a `charge` or
`line` strip, round a `fan`, back from a `ring`), foe bodies, the range from the nearest foe (inside
`A.fire.range`), pickups when calm, the wall and the safe zone. It dashes when a bullet is about to land or the
field is crowded. Lower skill sees bullets later (`BOT.react0`), looks less ahead, keeps a thinner margin, turns
slowly and wobbles. Memory only in `r.mem`; at skill 1 no memory and no draws (one-button mode calls it every step).

`goalSteer(A, a, goal, skill, r, { weight, slowR })` → `{ steer, dash }` blends a stage goal `{ x, y }` (world) into
`a` (actionSteer's answer), as design.md 4.11 sets: a unit pull of `BOT.goalCalm` 0.6, or `BOT.goalBusy` 0.25 with a
foe bullet within 20 u, times `weight`, easing off within `slowR` (6 u); below skill 1 the goal is sampled every
0.6 s × (1 − skill) (in `r.mem`), so the bot reacts late. `goal: null` returns `a`.

A stage's `botSteer(st, skill, r)` returns `{ steer, dir: null, hold: false, dash }`:

```js
export function botSteer(st, skill, r) {
  if (!st || st.done || st.A.ko) return { steer: { x: 0, y: 0 }, dir: null, hold: false, dash: false };
  const a = goalSteer(st.A, actionSteer(st.A, skill, r, { keep: false }), st.goal /* or null */, skill, r);
  return { steer: a.steer, dir: null, hold: false, dash: a.dash };
}
```

Stage 5 uses `actionSteer` alone (its goal is the nearest germ, which the range keeping already gives).
`core/bots.js` turns `dash: true` into a tap (a press, lifted 80 ms later). In one-button mode `core/run.js` drops
the button's own presses in a stage with `meta.action` and presses for `botSteer`'s dash while the button is held.

## 3. Input: the `move` gesture (`ui/input.js`)

A prompt `{ gesture: "move", text, keys: "steer" }` makes it live. Drag anywhere: the floating stick (dead zone 8 px,
full at 56 px, origin trails past 80 px) is `intents.steer` (world, `|v| <= 1`); the touch-down is **not** a press.
**A press is a dash** (or the stage's special): a second finger's touch-down while the first steers, a quick second
tap (down within 0.3 s and 60 px of a tap's end), or Space, Enter or Z. WASD and the arrows steer. Read it with
`X.moveOf(intents)` and `X.wantsDash(intents)`; `stepWorld` does both. The other gestures are unchanged. The HUD
stick ring shows for `move`; main.js uses a prompt's `.one` text in one-button mode for `move` too.

## 4. A stage on the layer (stage 5 as the example)

- `meta.action: true`, `meta.canFail: true`, `families` from `steer, tap, hold, rotate`. No timed targets:
  `targets()` returns `[]`.
- `create`: `st.A = X.createWorld(seed, { ...overrides, player: { ..., shield: Math.min(2, carry.sparks) } })`.
  Assist (design.md 4.2): hp +3, `bulletK` 0.75, dash `cdS` × 0.7, foe counts × 0.75 rounded up.
- `step`: `const moved = X.stepWorld(st.A, intents)`, read `A.out` (score, pops, growth, sub-goals), `X.emitOut(A,
  st)`, then your phase logic (only when `moved`), then the clock.
- **Hits:** the layer does them. A stage adds only its own (contact with its own actors: `hitPlayer(A, 1, "why", x,
  y)`).
- **Knock-out** (`A.ko`): clear foes and bullets (bursts), settle the sub-goals (the rest line "You need a rest."),
  prompt `none`, and **hold the stage until the captions already sent are read** (`core/lib/rest.js`: call
  `noteCaptions(st, FACTS, TEXT)` after every step with your own tables; end once `st.t >= readBy(st, st.koAt +
  1.5)`), so `pacing.test.mjs` holds. Then end it: `done`,
  `goalMet: false`, gaDay at the stage's end, its milestones fired if they had not yet, its carry written, Goal 0,
  the Skill and Flourish it had. `result().metrics` carries `ko: true`, `koAt` and `almost: "almost.ko"` (the
  Almost card's line, "Your body keeps growing."). `core/run.js` shows the Almost card (Try again or Go on); Try
  again recreates the stage with the same seed and carry; Go on closes the attempt with no grade word.
- **Go on with a moment** (stages 2, 3, 4 and 7, design.md 4.4): set `meta.goOn` to a moment id. After Go on,
  `core/run.js` calls `jump(st, meta.goOn)` when the result has `metrics.ko`, and the stage plays on: `jump` clears
  `done`, keeps `st.koAt` and `metrics.ko`, starts that moment with prompt `none` (input ignored), and the stage ends
  again with `done`, `goalMet: false`, its milestones and carry. The run closes it with no grade word (the attempt
  `wentOn`). Without `meta.goOn` (stage 5) the knocked-out result closes at once. Stage 1's `metrics.capped` keeps
  `jump(st, "carried")`.
- `view`: draw yourself as splats as before; add `d.action = { ...X.actionView(A), arena }`, put `anchor` and
  `cue` on `A.p` (the cue sticker becomes the hitbox's glint), and a soft `glow` mark under you.
- `resume(st)`: `A.p.inv = max(A.p.inv, 1.2)`.
- `jump(st, id)`: clear foes, bullets and tells, start that moment now.
- Score: Goal 3,000; stage 5 ticks its Skill to the HUD at each clear (`points` events; the pop shows the same
  number) and adds the rest at the end, so the `points` events always add up to the total.
- A boss: `spawnFoe(A, { kind: "boss", ai: "still", boss: true, ... })`, move it by its `vx, vy`, script its
  patterns with `addTell` then `shoot`, set `f.phase` at each phase (clear the foe shots, `hitStop(A, 8)`, an
  `act.phase` sound). The HUD's boss bar follows it. When it is cleared, play a short victory beat before `done`
  (stage 5: 1.4 s; the shots turn to sparkles, `act.win`).

## 5. Draw items (`core/draw.js`, `render/action.js`)

`d.action` (optional, `null` in `emptyDraw`); `validate` checks it. LIMITS: `bullets` 640, `foes` 48, `pickups` 96,
`tells` 16, `pops` 12, `bursts` 16, `hp` 12, `gifts` 4.

| Field | Shape | Drawn as |
|---|---|---|
| `arena` | `{ x, y, r }` | the wall: one cut sheet with a scalloped inner edge, over the floor |
| `zone` | `{ x, y, r, next }` | ink at 30% outside, a cut cream edge, dots where it shrinks to |
| `tells` | `[{ kind, x, y, ang, r, len, w, p }]` | dashed ink and cream: a strip filling (`line`, `charge`), a cone (`fan`), a ring closing in (`ring`), a dotted spot (`spot`) |
| `pickups` | `{ n, xy, kind, a }` | food beads, heal hearts, up stars; one path per kind |
| `foes` | `[{ kind, x, y, r, ang, hp, flash, born, charge, boss, phase, look? }]` | a cut-out per kind, one union shadow, a white flash on a hit, the core swelling with `charge`, a cream hp arc round a boss; `look: "clump"` (set by a stage on its view's copy) draws stacked sage and brown discs instead (stage 3's Knot) |
| `bursts` | `[{ x, y, r, age, kind, rot }]` | paper flecks flying out |
| `bullets` | `{ n, xy, r, tone, ang }` | **batched**: per tone one path for each sheet (shadow, ink keyline, colour, cream core), so 640 bullets cost a fixed 16 fills; your sparks are marigold streaks along `ang` |
| `player` | `{ x, y, r, body, ang, inv, dash, ready }` | the hitbox: a white bead on an ink keyline, on top; a blinking cream ring in i-frames; a dash trail; a thin arc while the dash comes back |
| `pops` | `[{ x, y, v, a, combo }]` | DOM tags (`ui/pops.js`), never canvas text |
| `hp` | `{ n, max, shield }` | HUD pips under the score (`ui/hud.js`): shields cream, hp marigold |
| `boss` | `null` or `{ hp, phase, label? }` | the HUD's boss bar under the pips (`ui/hud.js`), its fill by phase (teal, violet, rose); `label` a text id for its aria-label (default `hud.boss`) |
| `gifts` | `[{ x, y, r, icon, a?, on?, lv? }]`, at most 4 | gift bubbles (design.md 4.6, stages 3 and 7): a cream paper disc on an ink keyline with a cut ink icon by name (`quick spread bounce sticky shell dash orbit chain magnet`; any other name a star), `lv` ink dots for the levels you have, `on` an ink arc filling round the one that picks itself. The one-word name is a DOM tag: a pop with a `word` (a text id) and `v` 0, put up and back of the bubble in world terms (`x − r − 1, y + r + 1`) so it sits above it on screen in every layout |
| `shake`, `flash` | 0 to 1 | the shake rides on the renderer's sway by depth (none with reduced motion); the flash is one tint sheet at most 20% |

Colours: `ROLES[stage].action` in `render/palette.js` names a stage's tokens (`foe foe2 boss bossCore mine b1 b2 b3
core food heal up tell wall zone`); anything missing comes from `ACTION_TONES` in `render/action.js`. The low tier
cuts bullets with 6 points and drops their shadow.

## 6. Sound and words

`emitOut` sends `act.shot` (0.09 s apart), `act.strike`, `act.clear` (pitch: the combo), `act.fire`, `act.tell`,
`act.dash`, `act.ouch`, `act.ko`, `act.pick`; a stage may send `act.up` (a growth step), `act.heal`, `act.phase` (a
boss phase) and `act.win` (a boss or swarm cleared) itself with `emit(st, "sfx", { id, x, y })`. `ui/sound.js`
plays them softly through the womb bus. Captions once per stage: `act.sfx.shot` "· sparks fly", `act.sfx.clear` "· germs pop",
`act.sfx.dash` "~ you dash" (core/text.js). Shared strings: `almost.ko`, `hud.hp`, `hud.boss`. The move prompt
reads "Drag to move. Tap to dash." (desktop: "WASD to move. Space to dash."; one-button: "Hold to move. You dash by
yourself."); a stage may name its own special in place of the dash. A desktop form names Space or the arrows, a
one-button form says to hold (`prompts.test.mjs`). Stage strings follow v1 15.4:
no em dash, no pronoun for the carer, and none of the banned words (no "enemy", "attack", "fight", "kill", "hurt").

## 7. Perf rules

- `stepWorld` with 600 bullets, 48 foes and 96 pickups: p99 about 0.2 to 0.4 ms in node (`action.test.mjs`); a whole
  stage's p99 step stays under 1 ms (`perf.test.mjs`; stage 5: about 0.1 ms).
- No allocation in the bullet and pickup loops (structure-of-arrays pools, swap-remove; a mercy clear inside the
  bullet loop waits until the loop ends). Foes are a plain array of up to 48.
- `actionView` allocates fresh typed arrays (view must not touch the state). The renderer culls off-screen bullets
  and batches by tone; the foes share one shadow.

## 8. Stage 5, First Trimester (`grow`), as built

- Weeks 7 to 12: a wave a week (moments `wave7` to `wave12`, gaDay 7N to 7N + 7), each ending when cleared or at
  11 s, then a 2.2 s rest (the food is drawn in; the cord brings a heal; germs left drift away). Week 13: `boss`, the
  big germ (r 11, hp 440) in three phases by its hp: a spiral with buds, then hops with aimed fans and rings, then a
  rush along a charge tell with a ring as it stops and a wave fan. Each phase change clears the foe shots, holds the
  world for 8 frames, shakes and swells (`act.phase`); its core and the boss bar change colour. Clearing it plays a
  1.4 s victory beat (the shots turn to sparkles, the germs left pop, more bursts, `act.win`, the thumb pose; you can
  still move), then the stage ends.
- Foes: chasers (`germ`), wanderers (`spore`), shooters (`blob` aimed stack of 3 from 32 u/s, fan of 4, fan of 6; `drop`
  wave), orbiters (`ring`). Spawns never come through the placenta (`keepOut`). Bullet cap 150. The fastest foe
  shots of the run (the aimed stack's third shot 41 u/s; the big germ's fan 33 u/s).
- Food grows your sparks (from rate 4: rate 5, spread 2, pierce 1, rate 6, spread 3, strength 1.5, rate 7, pierce 2) and your
  heart powers them: the fire rate is that rate × your heart's bpm / 150.
- Sac to scale (meta.mm 30 to 150); you are drawn 9.5 to 15 u long, smaller than true.
- Score (the difficulty pass): Goal 3,000; Skill 1,200 for germs cleared (combo score over the value × 1.6) and 4,800
  for dodges, less 1,600 a hit; Flourish 1,000 × best combo / 25. No hit is Glowing, 1 or 2 Great, 3 or more Good.
  Bots (100 seeds): about 0.8 hits at skill 1 and 0.7, about 3 at 0.5, no knock-out; skill 1 Great or better in about
  93, 0.7 mostly Great, 0.5 Good in about 65; idle is knocked out in week 7 or 8 (about 13 s); one-button held
  completes. About 92 s; cap 120 s. The shots are faster and come sooner than first built (the aimed stack of 3 at 32
  to 41 u/s; week 7's gentler blob0), and a hit gives 1.4 s of i-frames and clears shots within 12 u.
- No `meta.goOn`: after a knock-out, Go on closes the stage at once (the clock and carry at the stage's end).
- The facts are v1's; `grow.frame` ("In the game you clear germs. ...") is a result fact, `checked: false` until its
  page is re-read (research-biology.md 5.13 supports it).
