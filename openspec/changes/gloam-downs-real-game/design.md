# Design: Gloam Downs, a real game

## The request
The player (laptop, 120 Hz, mouse) asked for "better music and gameplay" so it "feels like a real game", and chose all four parts: A adaptive music, B relics and builds, C lasting upgrades and harder levels, D game feel and variety. The design below fits the code as it is on `049d82fc`.

## What is there now
- **Music** (`music.js`, `run-sound.js`). A conductor, `makeScore`, lays notes ahead on the context clock. Each place has a theme with `amb`, `explore`, `combat` and `guard` layers. `setCombat(want, guard)` brings `combat` in on the next beat, full on the next bar line, and out 2 s after the fight, over one bar. The boss theme (`reeve`, `reeve3`) changes by phase. There are stingers for beacon, death and win. The bank is six FluidR3_GM instruments (404 KB). Voices made in code (`CODE`) cover wind, drips, chains, toms, bells and fills. `main.js` calls `audio.combat()` in `soundTick()`, `audio.boss()` in `bossEvent()`, and `audio.sting()` in `runEvent()`.
- **The run** (`run.js`, `run-save.js`). `startRun`, `lightBeacon`, `die` and `win` act on `rs`. `WICKS` has 6 wicks and `UPGRADES` has 5 upgrades. `drawOffer(seed, k, chosen)` draws the beacon offer from its own stream. `stream(seed, name)` gives named streams. The save key is `gloam-downs.run.v1`.
- **Foes** (`foes.js`). `makeFoes({ meta, slots, seed })` reads `meta.zones` (baked `{ id, c, leash, foes }`) and the place's pool. Pools are baked per place: gaol `SSSSS`, ramparts `SSSSP`, fen `SSSSMMMP`, bells `SSSMPI`, barrows `SSSIPMBCL`. Zone rules (`fits`, `makeRoom`, the cap of 6) are shared with `qa/lab/gloam-downs-zones.mjs`.
- **Feel** (`feel.js`, `fight.js`). Hit stop is in `run.js` (`hitStop`, cap 9 in 30 steps). The camera kick is the square of a trauma value times smooth noise (`F.kick`). `main.js` puts it on `world.anim.kick`, so `play.js` never sees it. Reduced motion turns off kick and zoom. Light foes flinch, and the finisher knocks them down.
- **Cards** (`cards.js`, `screens.js`). The Lamp-room (`#lamp`, `#ups`), the beacon card (`#beaconCard`, `#wicks`), the pause panel and the summary.
- **Pacing** has targets in the spec, but `qa/lab/gloam-downs-bot.mjs` is not built yet (tasks 454 to 457 of `add-gloam-downs` are open).

## A. Adaptive music
### Layers and their changes
Each place theme gets these layers. The names are the keys in `THEMES[id].layers`.

| Layer | What plays | Comes in | Goes out |
|---|---|---|---|
| `amb` | sounds in code, as now | arrival card | as now |
| `explore` | as now, with the cello taking the strings motif | first bar after the arrival card | never in a place |
| `drums` | low drum on 1, frame drum in the place's metre; the old `tom` and `timpani` parts move here | `foes-alert`: next bar line | `fight-calm`: from the first bar line 2 s or more after, over one bar |
| `strings` | the old combat strings, with a cello an octave down | the first tell or hit of the fight (from the cue log): next bar line | with `drums` |
| `guard` | third percussion part, as now | next bar line after a guard zone wakes | with `drums` |
| `elite` | hurdy-gurdy drone on the tonic and fifth, a buzz on each beat | `elite-alert`: next bar line | `elite-fall` or `fight-calm`: next bar line, over one bar |

- Every change of a layer starts on a bar line of the playing theme. This drops today's one-beat pickup, because the player asked for "on the bar". The tom fill stays as the last beat before the bar line when that line is more than one beat away. Then it is a pickup into the bar, not a change.
- The old `combat` layer is split into `drums` and `strings`. `__gloam.music().layers` lists them by those names. `setCombat` stays as a wrapper for one release, so the old e2e keeps working until builder A moves it.
- The theme bars stay 1.9 to 3.0 s, so a change waits less than one bar.
- **Place themes with the new instruments.** Gaol: the cello plays the four-note motif. Crow Wall: a hurdy-gurdy melody over the wind, a frame drum gallop in 3/4. Lantern Fen: the cello answers the reed, and a low drum plays every other bar. Bell Knoll: bells lead, and the cello plays a pad under them. Barrow Crown: a hurdy-gurdy drone with the choir. Lamp-room: harp and cello, quiet. Every motif is our own.

### The boss builds with its health
The boss theme has six levels. Each adds on the next bar line after the boss's health share crosses its line. A level never goes back.

| Level | Health share | Adds |
|---|---|---|
| 1 | fight starts | drone and timpani pulse, as phase 1 now |
| 2 | 85% or less | low drum on 1 and 3 |
| 3 | 61.5% or less (phase 2) | phase 2 layers, as now |
| 4 | 45% or less | cello ostinato an octave under the strings |
| 5 | 26.9% or less (phase 3; 40% at Ember 5) | `reeve3`, faster, as now |
| 6 | 12% or less | hurdy-gurdy buzz and the high choir |

- `boss-health` carries `{ share, phase }` and is emitted on each change of the boss bar (`fillBossBar()` in `main.js`).
- **The fall sting** (`STINGS.fall`, 2.2 s): one low drum hit, a cello fall of an octave, and an open fifth in the choir, in B. It starts at the fall, with the score's stop. The `light` theme starts at 2.5 s as now.

### The new instruments, made offline
- `qa/lab/gloam-downs-synth.mjs` (new, builder A) renders four instruments to 44.1 kHz mono WAV, and encodes them with `/usr/bin/ffmpeg` to mp3 at 48 kbps in `games/gloam-downs/audio-src/<inst>/<midi>.mp3`, with a `manifest.json`. 48 kbps is what First Breath's FluidR3_GM notes use, and it keeps each instrument under 100 KB. It renders one note every 4 semitones of each range (cello 36 to 68, gurdy 50 to 74). `qa/lab/gloam-downs-bank.mjs` then copies the notes in use from two sources: First Breath's FluidR3_GM folder and `audio-src/`.
- **cello** (C2 to A4): a bowed string. A sawtooth-like pulse train from a bow friction curve drives a waveguide string. A body made of five fixed resonant band-pass filters (about 200, 400, 560, 1000 and 2600 Hz) shapes it, with bow noise at 3% under it. Vibrato of 5.5 Hz and 12 cents starts after 0.25 s. Samples are 2.0 s (as the FluidR3_GM strings) with a loop region, for sustained parts. A bowed string can take a second to settle, or waver, with the wrong bow weight. So for each note the script picks the bow's speed and the friction's slope from a small grid (6 by 7): the pair whose held tone is steadiest from 0.3 s on. The friction table and the bridge loss follow the STK's Bowed class.
- **gurdy** (D3 to D5): a hurdy-gurdy. A bowed tone with less body and a nasal 1.2 kHz peak. The drone is not baked into the samples: the score plays it as gurdy notes on the tonic and the fifth, so the drone stays on the tonic while a tune moves. A buzz (the "dog" bridge) is a 40 ms burst of a noisy rectangle pulse at each wheel turn, which the score triggers on its beats as its own code voice `gurdy-buzz`. Samples are 2.0 s with a loop region.
- **drum-lo** (one note, re-pitched ±7 semitones): a large low drum. A sine starts at 2.2 times the note and falls to it in 60 ms. The membrane modes are at 1.0, 1.59, 2.14 and 2.30 times the base, each with its own decay, and a low-passed noise slap covers the first 15 ms. Length 1.6 s.
- **drum-mid** (one note, re-pitched ±7): a frame drum, with the same build at a higher pitch, more slap and 0.6 s of length. drum-lo is C2 (36) and drum-mid D3 (50).
- **What was made** (builder A, `node qa/lab/gloam-downs-synth.mjs`): every bowed note is within 0.2 cents of its pitch, and its held level moves 1.9 dB or less in 50 ms windows (the cello's lowest note; most move 0.1 to 0.6 dB). The spectral centroid of the cello is about 800 Hz at C2 and 1.2 kHz at E4, close to the FluidR3_GM strings (800 Hz at C3); the gurdy's is 2.2 to 2.8 kHz, which gives its nasal edge. In the bank: cello 7 notes, 85.1 KB; gurdy 5 notes, 60.8 KB; drum-lo 9.9 KB; drum-mid 3.9 KB. The whole bank is 45 files and 482 KB, so it is still under the old 500 KB line.
- **Listening.** No one listened in this session: it has no speakers or headphones. Each line below comes from the numbers and the demo's renders (`inst-<name>.mp3` in the demo folder), and a person must still listen:
  - cello: in tune, a steady bowed tone with a soft attack (90 ms) and a slow vibrato; darker than a real cello, by choice, for the dusk mood.
  - gurdy: in tune, steady, brighter and more nasal than the cello; with the code buzz on each beat it should read as a drone instrument.
  - drum-lo: a deep thud with a short pitch drop and a soft slap; its tail rings about 0.6 s.
  - drum-mid: a short dry frame drum, quieter than the low drum (-38.5 against -33.2 LUFS over its range).
- The bank stays loaded after the first press only. Its limit goes from 500 KB to 800 KB, with each new instrument at 100 KB or less. Code voices stay as the fallback for each new instrument while the bank loads or when it fails.
- The demo (`gloam-downs-music-demo.mjs`) gets a `layers` group. It renders each place for 4 bars of explore, then 4 bars with `foes-alert`, then 4 with the strings, and then the calm. It also renders the boss's six levels and the fall sting, and each new instrument over its range. Loudness targets stay as the add-gloam-downs design has them (themes at -29 ±3 LUFS with every layer on, now drums, strings, guard and elite together). The boss had no target before; it was -25.7 LUFS in phase 3. Its top level must now be no more than 0.5 LU over that, so the new layers add parts and not much loudness.
- **What the demo measured** (builder A, all groups, every target met): with every layer on, the Gaol -28.2, The Crow Wall -29.9, Lantern Fen -28.9, The Bell Knoll -28.4 and Barrow Crown -27.5 LUFS. The boss at level 4 -26.2 and at level 6 -25.7 LUFS. The fall sting -29.8 LUFS. The fight -20.8 LUFS on desktop and -20.9 in the phone mix, true peak -1.7 dBTP; the music alone -29.1 LUFS, 9.9 LU under the effects (it was 10.9 before the drums and the cello). The limiter takes 2.15 dB at most.

### How builder A wired it
- `music.js`: `makeScore` keeps a `fight` state `{ awake, guard, strings, elite }`, set with `setFight(o)`. Its rule in `tick()` brings each layer in on the next bar line at least 20 ms ahead, and logs `drums in`, `strings in`, `guard in`, `elite in` and their `out`. `setCombat(want, guard)` stays as a wrapper for one release. `bossHealth(share)` and `bossPhase(ph)` both go through one level rule, so a level never comes twice and never goes back; `levelOf(share, ember)` and `BOSS_LEVELS` hold the lines. The score's `setEmber` takes the Ember level from `place-enter`. `M.note(n, t)` plays one note outside the score, for the demo.
- `run-sound.js`: one handler for each of the 15 events. `relic-take` and `combo-tier` are heard and change nothing yet. The strings start on the first cue of the log, after `foes-alert`, that is a tell or one of `hit`, `land` and `hurt`. A hit on a training post with no foe awake does not count. `A.off()` stops listening. `__gloam.music()` adds `level`, `ember`, `fight` and `events` (the last 8 heard).
- `main.js`: the old `audio.combat()` call each frame is gone. `soundTick()` keeps what it saw last frame (`alertWas`) and emits `foes-alert` when foes wake or a guard zone wakes, and `fight-calm` when none is awake. The `audio.sting()`, `audio.boss()` and `audio.setScene('lamp', ...)` lines are now emits. `audio.setScene('arrive')` stays and `place-enter` is emitted beside it. `fillBossBar()` emits `boss-health` only while the bar shows, so the bar's last fill at the fall does not jump the music to level 6.
- BC's `elites.js` should emit `foes-alert` with `elite: true` or `elite-alert` when the elite's zone wakes; either brings the drone in.

## B. Elites, relics and builds
### Elites
One elite in each place. It is the place's baked foe type at 1.25 times the size, with an ember crown of 6 spark dabs (slot 34, below fire 37) that circle its head. When its zone wakes it sends `elite-alert`, and a toast names it. It drops 15 glim and a relic. Its special move has a warning move of at least 0.5 s, as every attack has.

| Place | Elite | Type | Health | Special move (its warning) |
|---|---|---|---|---|
| The Sunken Gaol | The Wardmother | Snuffer | 120 | double hook: a second hook 0.35 s after the first lands (a second cup glow, 0.35 s) |
| The Crow Wall | The Rookchief | Pitchrook | 70 | a fan of three coals, rings 1.2 m, 2.5 m apart (wind-up 1.0 s, three ring markers) |
| Lantern Fen | The Fen-wick | Mirelight | 40 | at half health it splits into two Mirelights of 14 health when two Mirelight slots are free, or else pulses twice (a white core flash, 0.5 s) |
| The Bell Knoll | The Bellwether | Ironback | 220 | a charge that bends once, by up to 40°, at its middle (the lane shows the bend for 0.4 s before the run) |
| Barrow Crown | The Cairnwarden | Snuffer | 140 | a full-turn sweep, ring 2.6 m (wind-up 0.8 s, the ring marker) |

- Each elite stands in a zone that the seed picks (see D). It takes one pool slot of its type. Ironback and elites have poise (see D).
- An elite's special move counts as one of its moves for the attack tokens and the wind-up rule.

### Relics
An elite that is put out drops its relic: a small lamp of spark dabs, in lamp slots 46 and 47, where it fell. A touch takes it, with a toast "<name> · <what it does>". The seed's `relic` stream draws it from the relics that the run does not hold. A run holds up to 5. Relics last until the run ends.

| Relic | The move it changes | Effect |
|---|---|---|
| Ember trail | roll | the roll leaves a 4 m line of fire for 1.5 s; a foe in it takes 4 each 0.25 s, at most 12 a roll |
| Spark third | finisher | the finisher throws a spark 6 m ahead; it deals 12 to the first foe it touches |
| Coal heel | plunge | the landing leaves a burning ring of 2 m for 2 s; 5 each 0.5 s |
| Hooked cut | first cut | it pulls a light foe within 4 m to 1.2 m in front of the lamplighter |
| Bellows cut | second cut | it pushes foes 2.5 m back, and it stops a light foe's wind-up |
| Moth lamp | flask | a drink sends a 3 m pulse: 10 damage and a 2 m push |
| Tinder guard | near miss | the next attack within 1 s starts at the finisher |
| Echo blade | finisher | the finisher hits again 0.3 s later, in the same arc, for half damage |

- Relic damage counts as blade damage for Edge and Keen edge, but not for Close shave. It rounds once at the end, as all damage does.
- A relic hit adds to the combo (see D) and takes hit stop of 2 steps, inside the cap.

### Kindlings: a relic and a wick together
When the run holds both, the relic's toast and the beacon card show "Kindled".

| Wick | Relic | Kindled effect |
|---|---|---|
| Quick heels | Ember trail | the trail lasts 2.5 s |
| Heavy fall | Coal heel | the ring is 2.5 m and lasts 3 s |
| Keen edge | Spark third | the spark passes through the first foe and hits a second |
| Spare oil | Moth lamp | the pulse is 4.5 m |

So a run with Quick heels and Ember trail plays as a roll-and-burn run, and a run with Heavy fall and Coal heel plays from the air.

## C. Lasting upgrades and harder levels
### Cinders: death always keeps some
A death banks 25% of the glim carried, rounded down. With Ash pocket it banks 55%. Before, a death in the Gaol could bank nothing, and the player had nothing to show for a run.

### Unlocks in the Lamp-room
The Lamp-room shows a second list, Unlocks, under the upgrades. Each unlock is bought once.

| Unlock | What it gives | Glim |
|---|---|---|
| Ember tongue | a new wick in the offers: each blade hit burns for 6 more over 2 s | 90 |
| Glim heart | a new wick in the offers: each glim mote taken heals 1, up to 20 a place | 100 |
| Last ember | a new wick in the offers: once a run, at 0 health, stand again with 25% | 220 |
| Wick shelf | each run starts with a choice of two wicks, drawn by the seed | 160 |
| Kindled flask | an elite's fall fills one flask | 80 |
| Rising cut | a new move: Attack in the last 0.12 s of a roll, or 0.1 s after it, is an upward cut: 14 damage, it knocks a light foe down for 0.6 s | 140 |
| Ember parry | a new move: a melee hit that lands in the first 0.1 s of the first cut's wind-up, with the foe within 60° in front, is turned aside; no damage, and the foe staggers for 1 s | 200 |

- The Flask upgrade gets a third level at 260 glim (2 flasks to 5).
- Unlocks cost 990 glim, and the upgrades 1,325 with the new Flask level. With Cinders, elites and the second waves, a run at Ember 0 holds about 360 glim. So all of it takes about 6 winning runs, or 10 to 14 runs of a player who dies often.
- The new moves use the Attack input on every device, so mouse, keys, touch and pad need no new button. The help card and the run's help add one line each once a move is bought.

### Ember levels
A win at Ember n opens Ember n + 1, up to 5. The Lamp-room shows an Ember row with a button for each open level, before Begin the run. Each level keeps the rules of the levels under it, and it adds 15% to the glim of every foe and wisp at that level, rounded down.

| Ember | Adds |
|---|---|
| 1 | the seed orders places II to IV; elites have 30% more health |
| 2 | foe cooldowns are 15% shorter (the warning moves keep their length); a run starts with one flask fewer, at least 1 |
| 3 | each zone that is not a guard zone has one foe more, of a type from its place's pool, when the pool and the cap allow; flasks heal 10 points less |
| 4 | elites use their special move twice as often; foes deal 20% more damage |
| 5 | the Barrow Reeve has 25% more health, and phase 3 starts at 40%; a lit beacon fills one flask, not every flask |

- With a seeded order, the boss files start to load in the fourth place, whatever it is.
- The save keeps `ember` (the level picked) and `emberTop` (the highest open). The win card shows the level, and the best time is kept for each level.

## D. Feel and variety
### Hit stop and shake
- Hit stop stays as it is: 3 steps for a cut, 5 for the finisher, the plunge and a hurt lamplighter, 6 for the boss slam, 9 for a phase change and death, and no more than 9 steps in any 30. A relic hit takes 2.
- The shake goes gentle. It is the same trauma model, but a cut adds no trauma. The finisher adds 0.05, the plunge 0.06, a hit taken 0.10, a stagger 0.08 and the boss slam 0.22. `FEEL.kick` falls from 4 to 2.4, and the offset is clamped to 0.15 m. Trauma falls by 0.6 a second, as now.
- The Shake switch in the pause panel reads "Shake on" or "Shake off". The save's `shake` is `null` until the player presses it. While it is `null`, Shake is off under reduced motion and on otherwise. The switch sets `fx.kick` only. Zoom and grade keep their reduced-motion rules.
- The kick still goes through `world.anim.kick`. `play.js` does not change, so `qa/lab/gloam-downs-camera.test.mjs` sees no difference.

### Poise and stagger
- The Ironback has 60 poise, and an elite 50, or 90 for the Bellwether. Each hit takes its damage from the poise too. At 0 the foe staggers for 1.2 s: it stops, its crack glows (slot 33), and it takes 25% more damage. Its wind-up stops. Poise fills again 3 s after the last hit. A stagger cannot start again within 4 s of its end.
- The boss keeps its slam weakness and has no poise.

### The combo
- A hit that lands on a foe or the boss adds 1. A swing that hits several foes adds 1 for each, at most 3. Relic hits add 1 each, at most 1 for each 0.25 s.
- The combo ends when the lamplighter takes damage (a near miss does not end it), when 3.0 s pass with no hit, or when the place ends.
- Tiers: 0 to 4 hits is tier 0; 5 to 9 is tier I (glim ×1.2); 10 to 19 is tier II (×1.5); 20 or more is tier III (×2). A foe put out drops `floor(glim × factor)`. Wisps and the boss's 30 do not change.
- The lamp brightens: the lantern's halo of spark dabs in lamp slots 46 and 47 has 0, 6, 12 or 18 dabs, and `fx.lamp` is 1, 1.15, 1.3 or 1.5. The halo uses lamp colours, never fire 37, so fire stays the brightest.
- The HUD shows the meter at 2 hits or more: "×12" in a 12 px number, a tier pip, and a thin bar for the 3 s left. It fades 0.4 s after the combo ends. At 320 px it sits on the glim row, and it never overlaps the HUD's other rows.
- A new tier sends `combo-tier`. The summary and the win card show the best combo of the run.

### Seeded runs
- A run's seed is a 32-bit number. The pause panel and the summary show it as a 6-letter code in Crockford base 32. `?seed=` takes the code or the number.
- Each choice uses its own stream (`stream(seed, name)` in `run.js`): `mix/<place>` for the foe mix, `elite/<place>` for the elite's zone, `relic` for the relics, `route` for the order of places, `start` for the Wick shelf, and the existing offer hash for the beacon offers. So one choice never moves another.
- **The foe mix.** For each zone that is not a guard zone or the arena, the stream redraws the zone's foe string. It keeps the zone's baked count (plus one at Ember 3). It draws types from the place's pool with these weights: the place's newest type 3, the others 1. The draw is kept only when the zone fits the pool alone, when every pair of zones within 20 m fits together, and when the place's newest type is in at least one zone. Otherwise it draws again, at most 20 times, and then keeps the baked string. The Gaol's first zone (G1) keeps its single Snuffer, because it teaches.
- **The elite's zone.** The stream picks one zone that is not the first zone or a guard zone, and that can take a foe of the elite's type. The elite takes the place of one foe of its type there, or it is added when the zone has room under the cap.
- **The route.** From Ember 1 the stream orders places II to IV. The Gaol is always first and Barrow Crown always last.
- **The guard's second wave.** When every foe of a guard zone is put out, a second wave rises 1.5 s later at the same spots. It has the guard's baked foes less its first one, at least one. The beacon lights only after the second wave too. This is the first pacing lever (see Pacing).
- The same seed, Ember level and unlocks give the same mix, elite zones, relics, route and offers. A Node test checks it for seeds 1 to 200.

## The event bus
`public/lab/gloam-downs/bus.js` is new. Any builder that needs it first creates it with exactly this text, so two branches that add it merge with no conflict.

```js
// Gloam Downs: the run's small event bus. The page and the fight emit; the run's sound listens. No DOM, so Node tests use it.
const subs = new Map();
export const EVENTS = ['place-enter', 'foes-alert', 'fight-calm', 'elite-alert', 'elite-fall', 'relic-take', 'boss-intro', 'boss-health', 'boss-phase', 'boss-fall', 'beacon-lit', 'run-death', 'run-win', 'lamp-room', 'combo-tier'];
export function on(name, fn) { if (!subs.has(name)) subs.set(name, new Set()); subs.get(name).add(fn); return () => subs.get(name).delete(fn); }
export function emit(name, detail = {}) { for (const fn of [...(subs.get(name) || [])]) { try { fn(detail); } catch (e) { console.error(e); } } }
```

| Event | Detail | Emitted by | Where |
|---|---|---|---|
| `place-enter` | `{ id, index, ember }` | A | `go()` in `main.js`, the line `audio?.setScene('arrive', { id })` |
| `foes-alert` | `{ zone, guard, elite }` | A | `soundTick()` in `main.js`, when the awake count goes from 0 to more, or a guard zone wakes |
| `fight-calm` | `{}` | A | `soundTick()`, when no foe is awake or every awake foe is out |
| `elite-alert` | `{ place, type, name }` | BC | `elites.js`, when the elite's zone wakes |
| `elite-fall` | `{ place, relic }` | BC | `elites.js`, on the elite's `foeOut` |
| `relic-take` | `{ id, kindled }` | BC | `relics.js`, on the touch |
| `boss-intro` | `{}` | A | `bossEvent()`, `case 'intro'` |
| `boss-health` | `{ share, phase }` | A | `fillBossBar()` |
| `boss-phase` | `{ phase }` | A | `bossEvent()`, `case 'start'` (phase 1) and `case 'phase'` |
| `boss-fall` | `{}` | A | `bossEvent()`, `case 'fall'` |
| `beacon-lit` | `{ place }` | A | `runEvent()`, `case 'beacon'` |
| `run-death` | `{}` | A | `runEvent()`, `case 'dead'` |
| `run-win` | `{ ember }` | A | `runEvent()`, `case 'win'` |
| `lamp-room` | `{ wait }` | A | each `audio?.setScene('lamp', ...)` line |
| `combo-tier` | `{ tier, n }` | D | `combo.js`, on a tier change |

`run-sound.js` subscribes to all of them in `makeRunSound`. The first tell or hit of a fight comes from the cue log that run-sound already reads, so it needs no event.

## Who builds what
Three builders work in parallel. Each owns files, and each may add only the named small hooks in shared files. A builder that needs a change in a file it does not own asks its owner.

### Builder A, music
- Owns: `music.js`, `run-sound.js`, `sound.js`, `audio/`, `games/gloam-downs/audio-src/`, `qa/lab/gloam-downs-synth.mjs` (new), `qa/lab/gloam-downs-bank.mjs`, `qa/lab/gloam-downs-music-demo.mjs`, `qa/lab/gloam-downs-sound.test.mjs`, `qa/lab/gloam-downs-run.sound.e2e.mjs`, and the `lab/gloam-downs` entry of `qa/arcade/quiet.mjs`.
- `main.js` hooks: the existing lines that call `audio.*` or `audio?.*` (in `sceneOfPlace()`, `runEvent()`, `bossEvent()`, `soundTick()`, `go()`, `openBeacon()`, `openLamp()`, `openSummary()`, `openWin()`), and one added `emit('boss-health', ...)` line in `fillBossBar()`. A may turn each call into an `emit` and leave the call, or replace it. A adds one import line, `import { emit } from './bus.js';`, after the `run-sound.js` import.
- `index.html`: none.

### Builder BC, relics, builds, lasting upgrades, Ember
- Owns: `run.js`, `run-save.js`, `moves.js`, `cards.js`, `screens.js`, `elites.js` (new), `relics.js` (new), `qa/lab/gloam-downs-run.test.mjs`, `qa/lab/gloam-downs-builds.test.mjs` (new), `qa/lab/gloam-downs-run.builds.e2e.mjs` (new), and `qa/lab/gloam-downs-bot.mjs` (new, the pacing bot from add-gloam-downs tasks 454 to 457).
- `foes.js` hooks: one import line for `elites.js`; in `makeFoes`, the one line in the zone setup that makes the foe at `Z.elite` an elite (`makeElite(f, Z, rs)`); in the foe's attack choice, one branch that calls `eliteMove(f, ...)` before the plain move choice. BC does not edit the zone rules, the hit function or `putOut`.
- `main.js` hooks: the body of `beginRun()` (route, Ember, Wick shelf), `openBeacon()` but its `audio` line, `fillLamp()`, `buyUp()`, `bossBar()` (the Ember 5 tick), one line `relicEvent(e, page);` right after `fight?.event(e);` in `runEvent()`, one line `updateRelics();` at the start of `updateRunHud()`, and one spread `...buildsView(),` in the object that `__gloam.run()` returns.
- `index.html`: in `#lamp`, `<ul class="ups" id="unlocks"></ul>` after `#ups` and `<div class="row" id="emberRow"></div>` before `#lampRow`; in `#hud`, `<div class="relics" id="relics"></div>` as its last child; the CSS rules for these three, in the run's style block, after the `.ups` rules.

### Builder D, feel and variety
- Owns: `feel.js`, `sparks.js`, `fight.js`, `mix.js` (new: the foe mix, the elite's zone, the route and the second wave's foes), `combo.js` (new), `qa/lab/gloam-downs-feel.test.mjs` (new), `qa/lab/gloam-downs-seed.test.mjs` (new), `qa/lab/gloam-downs-run.feel.e2e.mjs` (new), and `qa/lab/gloam-downs-foes.test.mjs`.
- `fight.js` reads what BC gives: `elites.js` exports `dressOf(f)` → `{ size, crown }`, and `relics.js` exports `groundRelics(run)` → `[{ id, x, y, z }]`. D draws the crown, the relic lamps, the fire lines and rings, and the lamp halo with `sparks.js`.
- `foes.js` hooks: one import line for `mix.js`; in the hit function, the poise and stagger lines; in `putOut`, the glim factor on the `F.runner?.foeOut(...)` line; in the zone's all-out check, one call `mixWave(Z, ...)` for the second wave.
- `main.js` hooks: the `seed()` line; the `makeFight({...})` call in `newRunner()` (add `mix`); one line `updateCombo();` at the end of `updateRunHud()`; the Shake listener, one line after the `bMusic` listener; the seed line and the Shake label in `openPause()`; and one spread `...feelView(),` in the object that `__gloam.run()` returns.
- `index.html`: in `#hud`, `<div class="combo" id="combo" hidden aria-live="off"><b id="comboN"></b><i id="comboPip"></i><i class="cbar"><i id="comboFill"></i></i></div>` after the glim row; in the pause panel's row, `<button type="button" id="bShake">Shake on</button>` after `#bMusic`; `<p class="seed" id="seedLine"></p>` after the pause panel's time line; and the CSS for these, after the `.hud` rules.
- `play.js`: no change. If the shake ever needs a hook there, D stops and asks first.

### Shared
- `bus.js`, as above.
- `__gloam.fx(flags)` gains `combo` and `lamp` flags (D). `__gloam.set(fields)` gains `relics`, `unlocks`, `ember` (BC) and `combo` (D). Each builder adds its fields in its own spread function, as for `__gloam.run()`.
- The last task is a merge pass in the order A, BC, D. It runs every Gloam Downs check, the bot, and the pacing tune.

## Pacing
- Targets: a first run at skill 0.3 reaches The Crow Wall in at least half the bots. A skilled run (skill 0.9) wins at Ember 0 in 20 to 30 minutes of game time when it takes every wisp, fights every zone and the elite, and buys the Lamp-room's wares between runs.
- Today's spec aims a 0.5 bot's winning run at 6 to 12 minutes. That is too short for "a real game". The levers, in this order: (1) the guard's second wave; (2) the elites; (3) Ember 3's extra foe moved to Ember 0 for the zones that are not first. The baked places do not change, so wisps and zones stay where they are. Foe health goes up only after these, and then by 15% at most, so fights do not turn to a slog.
- If the bot shows that a 0.9 run cannot reach 20 minutes with these levers, the builders report it to the user and do not pad the run.
- The bot runs the page's own rules with `mix.js`, `elites.js` and `relics.js` on the real walk maps. It writes its results here.

## Builder BC: what was built
This is what builder BC built on branch `gloam-real-bc`, and where it differs from the plan above.

### Hooks in shared files
- `foes.js` has three lines: the `elites.js` import, one line after `freeOf` that makes the elite kit (`eliteKit(F, { ... })`), and one line at the top of `mind()`: `const em = EK.think(f, ev); if (em) return em.want;`. The kit picks the elite's zone, makes the elite, runs its special move, and puts the Ember rules on every foe on its first think (the cooldowns at Ember 2, the elite's health at Ember 1). An elite's special move runs with the foe in `chase`, so the hit rules of `hitFoe` and the knock-down still apply. `elites.js` exports `eliteClip(f)`, so `fight.js` can pose a special move with the base move's clips.
- `main.js`: the bodies of `beginRun`, `fillLamp` and `openBeacon`, the `relicEvent(e, buildPage)` line in `runEvent`, `updateRelics()` in `updateRunHud`, `...buildsView()` in `runState`, and `setBuilds(o)` in `__gloam.set`. It also needed four small lines outside the plan: the imports (put after the `cards.js` import, away from builder A's line), `routeOf(place, route)` in `openPause`, the boss files loading in the fourth place of the route in `go()`, and `hitOf(f.hit).id` in `runState` (the Rising cut is hit 3). `showControls` adds the help lines of the moves bought, and the win card builds its rows from `winOf`.
- `index.html`: `#unlocks` (with an "Unlocks" heading), `#emberLine` and `#emberRow` in the Lamp-room, `#relics` as the last child of `#hud`, `#winOpened` on the win card, and their CSS after the `.ups` rules.
- `cards.js`: a button that takes the focus by Tab or the pad is scrolled into view inside its card.

### Where it differs from the plan
- **The Bellwether stands in B1.** The Bell Knoll's pool has one Ironback slot, and only B1, the first zone, holds an Ironback. A second Ironback added to B2 or B3 waits for that slot while B1 is awake, so the zone it joined could stay asleep (`gloam-downs-foes-ai.test.mjs` found it). `eliteZone` now uses the first zone when it is the only zone that holds the elite's type. Every other elite stands in a zone that is not the first.
- **The Cairnwarden's sweep** starts from 3.2 m, as the hook does, and the Cairnwarden steps in at 1.2 m/s during the wind-up until it is 1.6 m away. From 2.4 m, as first planned, the sweep never started: the Snuffer's mind holds 2.8 m away.
- **The Fen-wick's split is its fall.** The Fen-wick goes out at the split, so its relic and its 15 glim drop then. The two Mirelights of 14 are plain foes.
- **The Lamp-room scrolls inside its card.** Five upgrade rows, seven unlocks and the Ember row do not fit 640 px. The lists scroll, and the card's own buttons (Begin the run and the rest) stand at its foot. The cards and clicks e2e now check that each button comes into view clear of that foot, and that the page never scrolls.
- **Sounds.** The builds use cues that already have a recipe: a relic taken is `wisp`, an Echo blade hit is `hit`, a parry is `clang`, Last ember is `heal`, and each elite's tell is its base move's cue (`scrape`, `whistle`, `hum`, `paw`, `rear`). Each carries a field (`relic`, `parry`, `last`, `elite`) so builder A can give them their own sound.
- **Ember 4's damage** is applied in `run.js`'s `hurt`, so the boss's hits are 20% stronger at Ember 4 too.
- **Not built:** Ember 5's boss health (+25%) and its phase 3 at 40%. They need `boss.js`, which no builder owns, so `bossBar()` has no Ember 5 tick yet. The arrival card's numeral and the summary's "Reached" line still number the places in the downs' order on a seeded route. The relic lamps, the fire lines and rings and the crown are not drawn: `fight.js` is builder D's, and it reads `groundRelics(R)`, `R.relics.view()` and `dressOf(f)`.

### The pacing bot, first results
`qa/lab/gloam-downs-bot.mjs` plays whole runs on the real walk maps with the run, the moves, the foes, the elites, the relics and the Lamp-room. It walks each place's route from `games/gloam-downs/lib/zones.mjs`. A bot that makes no progress for 3 s is put at its next point (a nudge, with 3 s added). The Barrow Reeve's fight is not stepped: it is drawn from the boss bot's results in add-gloam-downs. `mix.js` and the second waves are builder D's and are not in this branch, so the bot plays the baked zones.

`node qa/lab/gloam-downs-bot.mjs 30 <skill> 1`, Ember 0, about 15 s a run of 30 bots:

| Skill | First run reaches The Crow Wall | First win: median run | Winning run (game time) | Nudges a run |
|---|---|---|---|---|
| 0.3 | 30 of 30 | 2 | 4.1 min | 16 |
| 0.5 | 30 of 30 | 1 | 4.2 min | 16 |
| 0.9 | 30 of 30 | 1 | 6.6 min | 33 |

Every target but the first misses. Runs are 4 to 7 minutes, not 20 to 30, and bots seldom die before Barrow Crown. Two things make these numbers too kind. The bot's walk is crude, so it is often nudged ahead of where a player would walk. And without the second waves, the bot has fewer foes than the design plans. Task 4.4 should tune with the levers in "Pacing" once `mix.js` is merged, and teach the bot to walk without nudges first. If the targets still miss, the user should be told.

## Sources
Each source is named with how it was used. None was fetched in this session: the network rules of this session were not tried, so all are cited from memory. A builder that fetches one adds "fetched" and the date.
- **Dead Cells** (Motion Twin, 2018), game, from memory: elite foes that guard an item, the Boss Cell levels that open after a win and add rules, and runs whose biome order changes. We took the shape: elites that drop a change to your moves, and levels of heat after a win. No name, item or rule is copied.
- **Hades** (Supergiant Games, 2020), game, from memory: boons that pair into a "duo" boon, and the Pact of Punishment's heat rules. We took the pairing for kindlings, and one rule a level for Ember.
- **Slay the Spire** (Mega Crit, 2019), game, from memory: elites that drop relics, Ascension levels that each add one rule, and a seed code you can share. Our relics change moves, not cards.
- **Rogue Legacy** (Cellar Door Games, 2013), game, from memory: lasting upgrades bought with what a death keeps.
- **Darren Korb on the music of Hades**, interviews and talks, from memory: stems that come in and out as the fight changes. Together with Winifred Phillips's vertical layering (cited and read through search extracts in add-gloam-downs), it gives the layers.
- **FMOD Studio documentation, "quantization" of transitions**, from memory: a change waits for the next bar or beat. Our rule is "next bar line".
- **Jan Willem Nijman, "The art of screenshake"** (INDIGO 2013), talk, from memory: hit stop, a small shake and a kick on heavy hits. **Martin Jonasson and Petri Purho, "Juice it or lose it"** (GDC Europe 2012), talk, from memory. **Squirrel Eiserloh, "Juicing Your Cameras With Math"** (GDC 2016), talk, as `feel.js` already cites: the trauma squared model we keep.
- **Masahiro Sakurai, "Masahiro Sakurai on Creating Games"**, his video series on hit stop, from memory: a heavier hit holds longer.
- **Poise in Dark Souls and stance in Elden Ring** (FromSoftware), games, from memory: a hidden meter that a string of hits breaks, which opens a stagger.
- **Devil May Cry's style meter** (Capcom), game, from memory: a combo meter that rewards a string with no hit taken. We keep it to one number and a tier.
- **Julius O. Smith III, "Physical Audio Signal Processing"** (online book, CCRMA), from memory: the bowed string as a waveguide with a friction curve, for the cello and the hurdy-gurdy.
- **Perry R. Cook, "Real Sound Synthesis for Interactive Applications"** (A K Peters, 2002), book, from memory: membrane modes at Bessel-function ratios, for the drums. Chris Lowis's pitch-drop kick (cited in add-gloam-downs) gives the attack.
- **The hurdy-gurdy's buzzing bridge**: no published synthesis source fit. The burst at each wheel turn is our own model of how the instrument works.
- **Crockford base 32**, Douglas Crockford's encoding note, from memory: a code with no I, L, O or U, so it reads aloud.

## Checks
- Node: `gloam-downs-sound.test.mjs` (layers on bar lines, the boss's six levels, the fall sting, the bus), `gloam-downs-builds.test.mjs` (relics, kindlings, unlocks, Ember, Cinders, the v2 save), `gloam-downs-run.test.mjs`, `gloam-downs-feel.test.mjs` (shake cap, Shake switch, poise, combo), `gloam-downs-seed.test.mjs` (streams apart, the mix fits for seeds 1 to 200, same seed same run), `gloam-downs-foes.test.mjs`, `gloam-downs-camera.test.mjs` (must still pass), `node qa/lab/gloam-downs-zones.mjs`.
- Browser, with the site served: `gloam-downs-run.sound.e2e.mjs`, `gloam-downs-run.builds.e2e.mjs`, `gloam-downs-run.feel.e2e.mjs`, and the existing run e2e files. Each new HUD and card part is checked at 320 by 640, 390 by 844, 360 by 640, 800 by 600 and 1280 by 720.
- Sound: `gloam-downs-music-demo.mjs` with the `layers` group, `gloam-downs-bank.mjs` (800 KB), and `CHROMIUM_PATH=/opt/pw-browsers/chromium node qa/arcade/quiet.mjs --only=lab/gloam-downs`.
- Pacing: `gloam-downs-bot.mjs` at skills 0.3, 0.5 and 0.9.
- What cannot run here must be said: a real phone, a real gamepad, and listening on speakers.

## The save
The key moves to `gloam-downs.run.v2`. A cached old page writes v1, and v1's `clean()` drops unknown fields. So a v2 page reads v1 once when no v2 exists, and from then on writes v2 only. v2 adds `unlocks` (a list of known ids), `ember` (0 to 5, at most `emberTop`), `emberTop`, `bestByEmber` (a best time for each level), `bestCombo`, `shake` (`null`, `true` or `false`), and in `run`: `route` (the five ids, the Gaol first and Barrow Crown last), `ember`, `relics` (up to 5 known ids), `elitesDown` (place ids) and `combo` (the run's best). Each field is checked on the way in, as today.
