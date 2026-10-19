# First Breath: the action layer contract

The shared layer for every action stage of `first-breath-action-genres`. Where `design.md` and this file disagree on
an API name or a default, this file wins. Stage 5 (`core/stages/grow.js`) is the worked example: read it beside this.

Files: `core/lib/action.js` (the world), `core/lib/actionbot.js` (the bot), `core/lib/rest.js` (a knock-out's rest
until the captions are read), `core/draw.js` (`action` in the draw list),
`render/action.js` (the paper items), `ui/input.js` (the `move` gesture), `ui/hud.js` (hp pips), `ui/pops.js`
(number pops), `ui/sound.js` (`act.*` sounds). Tests: `qa/first-breath/action.test.mjs`, `stage-grow.test.mjs`.

## 1. The world: `core/lib/action.js`

Pure and seeded (`stream(seed, "action")` as `A.rnd`). World units, seconds, radians (counterclockwise, y up).
`import * as X from "../lib/action.js"`.

### Make and step

| Call | Does |
|---|---|
| `createWorld(seed, opts)` → `A` | `opts`: `arena` `{ x, y, r }` or `null` (default `{0, 0, 46}`); `player` (override of `ACT.player`, plus `x`, `y`, `fixed`, `shield`); `dash` (override of `ACT.dash`, or `null` for none); `fire` (override of `ACT.fire`, or `null` for no auto-fire); `pickup`, `combo`, `foe`, `juice` (overrides); `bulletK` (foe bullet speed factor); `bulletCap` (foe bullets at once); `keepOut` `[{ ang, half }]` (arcs of the wall where no foe spawns). |
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

`actionSteer(A, skill, r)` → `{ steer: { x, y }, dash }` with `|steer| < 1`. A potential field: each foe bullet's
closest pass within a look-ahead, the tells it has seen (out of a `charge` or `line` strip, round a `fan`, back from a
`ring`), foe bodies, the range from the nearest foe (inside `A.fire.range`), pickups when calm, the wall and the safe
zone. It dashes when a bullet is about to land or the field is crowded. Lower skill sees bullets later (`BOT.react0`),
looks less ahead, keeps a thinner margin, turns slowly and wobbles. Memory only in `r.mem`; at skill 1 no memory and
no draws (one-button mode calls it every step).

A stage's `botSteer(st, skill, r)` returns `{ steer, dir: null, hold: false, dash }`, starting from `actionSteer`
and blending in its own goal (design.md 4.11). `core/bots.js` turns `dash: true` into a tap (a press, lifted 80 ms
later). In one-button mode `core/run.js` drops the button's own presses in a stage with `meta.action` and presses for
`botSteer`'s dash while the button is held.

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
- **Knock-out** (`A.ko`): clear foes and bullets (bursts), settle the sub-goals (the rest line "You need a rest."),
  prompt `none`, and **hold the stage until the captions already sent are read** (`core/lib/rest.js`: call
  `noteCaptions(st, FACTS, TEXT)` after every step with your own tables; end once `st.t >= readBy(st, st.koAt +
  1.5)`), so `pacing.test.mjs` holds. Then end it: `done`,
  `goalMet: false`, gaDay at the stage's end, its milestones fired if they had not yet, its carry written, Goal 0,
  the Skill and Flourish it had. `result().metrics` carries `ko: true`, `koAt` and `almost: "almost.ko"` (the
  Almost card's line, "Your body keeps growing."). `core/run.js` shows the Almost card (Try again or Go on); Go on
  closes the attempt with no grade word. A stage that plays out a `meta.goOn` moment after Go on (design.md 4.4) uses
  `metrics.capped` with `jump(st, "carried")` as stage 1 does.
- `view`: draw yourself as splats as before; add `d.action = { ...X.actionView(A), arena }`, put `anchor` and
  `cue` on `A.p` (the cue sticker becomes the hitbox's glint), and a soft `glow` mark under you.
- `resume(st)`: `A.p.inv = max(A.p.inv, 1.2)`.
- `jump(st, id)`: clear foes, bullets and tells, start that moment now.
- Score: Goal 3,000; stage 5 ticks its Skill to the HUD at each clear (`points` events; the pop shows the same
  number) and adds the rest at the end, so the `points` events always add up to the total.

## 5. Draw items (`core/draw.js`, `render/action.js`)

`d.action` (optional, `null` in `emptyDraw`); `validate` checks it. LIMITS: `bullets` 640, `foes` 48, `pickups` 96,
`tells` 16, `pops` 12, `bursts` 16, `hp` 12.

| Field | Shape | Drawn as |
|---|---|---|
| `arena` | `{ x, y, r }` | the wall: one cut sheet with a scalloped inner edge, over the floor |
| `zone` | `{ x, y, r, next }` | ink at 30% outside, a cut cream edge, dots where it shrinks to |
| `tells` | `[{ kind, x, y, ang, r, len, w, p }]` | dashed ink and cream: a strip filling (`line`, `charge`), a cone (`fan`), a ring closing in (`ring`), a dotted spot (`spot`) |
| `pickups` | `{ n, xy, kind, a }` | food beads, heal hearts, up stars; one path per kind |
| `foes` | `[{ kind, x, y, r, ang, hp, flash, born, charge, boss, phase }]` | a cut-out per kind, one union shadow, a white flash on a hit, the core swelling with `charge`, a cream hp arc round a boss |
| `bursts` | `[{ x, y, r, age, kind, rot }]` | paper flecks flying out |
| `bullets` | `{ n, xy, r, tone, ang }` | **batched**: per tone one path for each sheet (shadow, ink keyline, colour, cream core), so 640 bullets cost a fixed 16 fills; your sparks are marigold streaks along `ang` |
| `player` | `{ x, y, r, body, ang, inv, dash, ready }` | the hitbox: a white bead on an ink keyline, on top; a blinking cream ring in i-frames; a dash trail; a thin arc while the dash comes back |
| `pops` | `[{ x, y, v, a, combo }]` | DOM tags (`ui/pops.js`), never canvas text |
| `hp` | `{ n, max, shield }` | HUD pips under the score (`ui/hud.js`): shields cream, hp marigold |
| `shake`, `flash` | 0 to 1 | the shake rides on the renderer's sway by depth (none with reduced motion); the flash is one tint sheet at most 20% |

Colours: `ROLES[stage].action` in `render/palette.js` names a stage's tokens (`foe foe2 boss bossCore mine b1 b2 b3
core food heal up tell wall zone`); anything missing comes from `ACTION_TONES` in `render/action.js`. The low tier
cuts bullets with 6 points and drops their shadow.

## 6. Sound and words

`emitOut` sends `act.shot` (0.09 s apart), `act.strike`, `act.clear` (pitch: the combo), `act.fire`, `act.tell`,
`act.dash`, `act.ouch`, `act.ko`, `act.pick`; stage 5 adds `act.up`, `act.heal`, `act.phase`. `ui/sound.js` plays them
softly through the womb bus. Captions once per stage: `act.sfx.shot` "· sparks fly", `act.sfx.clear` "· germs pop",
`act.sfx.dash` "~ you dash" (core/text.js). Shared strings: `almost.ko`, `hud.hp`. Stage strings follow v1 15.4:
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
  rush along a charge tell with a ring as it stops and a wave fan. Each phase change clears the foe shots.
- Foes: chasers (`germ`), wanderers (`spore`), shooters (`blob` aimed, fan of 3, fan of 5; `drop` wave), orbiters
  (`ring`). Spawns never come through the placenta (`keepOut`). Bullet cap 150.
- Food grows your sparks (rate 6, spread 2, pierce 1, rate 7, spread 3, strength 1.5, rate 8, pierce 2) and your
  heart powers them: the fire rate is that rate × your heart's bpm / 150.
- Sac to scale (meta.mm 30 to 150); you are drawn 9.5 to 15 u long, smaller than true.
- Score: Goal 3,000; Skill 3,500 for germs cleared (combo score over the value × 1.75) and 2,500 for dodges (1 − hits
  / 5); Flourish 1,000 × best combo / 25. Bots (10 seeds): skill 1 about 9,900, 0.7 about 9,700, 0.5 about 9,200 with
  no knock-out; idle is knocked out in waves 7 or 8; one-button held completes 20 of 20. About 84 s; cap 120 s.
- The facts are v1's; `grow.frame` ("In the game you clear germs. ...") is a result fact, `checked: false` until its
  page is re-read (research-biology.md 5.13 supports it).
