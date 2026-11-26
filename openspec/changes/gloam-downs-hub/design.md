# Design: Gloam Downs, the walk-through Lamp-room, and more to gain

## The request
The player said: "the lamp room looks ugly make it a walk thru environmewnt" and "with more types of buffs and abilities thatr can be gained". So there are two parts. Part H turns the Lamp-room into a place you walk through. Part B adds abilities and buffs of kinds the game lacks. This design fits the code on `9e243098`. The fair-fight change (`gloam-downs-fair-fight`, in progress) changes `foes.js`, `run.js`, `moves.js`, `feel.js`, `boss.js`, `mix.js` and the bot; the build starts after it merges (section "Who builds what").

## What is there now
- **The Lamp-room** is `#lamp` in `index.html`: a card over the last frame of the place. `screens.js` (`upgradeRows`, `lampButtons`, `LAMP_LABELS`) and `main.js` (`openLamp`, `fillLamp`) fill it. `cards.js` keeps the focus in the card and scrolls it. It holds the wares (`run.js` `UPGRADES`, 9 wares), the patterns to kindle (`growth.js` `PATTERNS`), the panes, the unlocks (`UNLOCKS`, 7) and the Ember row. It opens from the title (`bTitleLamp`), after a run's end (`afterEnd = 'lamp'`) and at a beacon (`bSpend`, then `openLamp('beacon')`).
- **Places** load through `world.js` `loadPlace(base, id)` from `<id>.json`, `<id>.bin.gz` and `<id>.walk.bin.gz`. `main.js` `go(id)` loads any id. In a run, `go` also builds the foe pool (`poolFor`). `bake.mjs` has `ORDER` (the downs) and `LATTICE` (explorer places with `run: false` and `set: 'lattice'`). `scenery()` throws unless a place has a spawn, a beacon and five wisps.
- **Putting splats out.** `main.js` sets a splat's density (float 3 of its 16) to 0 and back, and the renderer uploads only the changed 512-splat rows. `pool.js` parks foe slots the same way.
- **Life and sound.** `life.js` (`LIFE` per place, at most 1,200 dabs, lamps that brighten near the lamplighter) and `beds.js` (`BEDS` per place).
- **The training post.** `moves.js` `makePost(walk, x, z)` is a target that takes hits and shows them.
- **Growth** (`gloam-downs-growth`). Three colours (Flame, Ward, Gloam), 9 abilities, 8 panes, 8 relics with 4 kindlings, 9 wicks, 9 wares, 7 unlocks, 2 keys, Ember levels 0 to 5. Foe states in `status.js`: stun, hold, slow, burn.

### What the build lacks today
From a read of the tables above:
1. Only one state deals damage over time (burn). Nothing stacks, and nothing spreads.
2. No sure hits (crits), so a stun or a hold has no payoff beyond safety.
3. One blade. No weapon to swap.
4. No shield on the lamplighter: only Lead glass and Bell guard.
5. One summon (Moth wisp).
6. Few traps (Ember snare, Pitch pour).
7. Little on a kill (Thick glass, Hot glass) and nothing at low health but Last ember.
8. The combo counter scales nothing.
9. No trade-off picks.
10. Colours scale numbers but give no set bonus.

## Sources
Page fetches failed in this session: `deadcells.wiki.gg`, `hades.wiki.fextralife.com`, `blog.unity.com`, `enterthegungeon.wiki.gg`, `childrenofmorta.fandom.com` and `www.touchtapplay.com` did not resolve. Web search worked. [S] marks a claim read in search result extracts on 2026-11-26. [M] marks a claim from memory, to check when the network allows.

### The hall
- **Dead Cells, the Prisoners' Quarters** (Motion Twin, 2018). [S] Blueprints handed to the Collector unlock items for later runs, and his screen shows how many unlocks are left before the next tier. [M] It is a short room walked left to right from the waking cell past the stations to the exit door; spending at a station is a menu. We took: stations in a line on the way to the door, so a visit costs no extra walking.
- **Hades, the House** (Supergiant Games, 2020). [S] The House Contractor sells renovations, and the Mirror of Night sells lasting upgrades in the bedroom. [M] A renovation is bought in a menu and then shows in the room; weapons rest on racks and you pick one by walking to it; the rooms are seen from a fixed high view with no fourth wall. We took: buy in a card, see the result in the room, one object a station, and the cut-away view.
- **Rogue Legacy 2** (Cellar Door Games, 2022). [S] Gold buys manor upgrades for every later heir; new buildings open new classes. [M] The castle is drawn as a tree that grows. We took: the hall grows in steps you can see.
- **Enter the Gungeon, the Breach** (Dodge Roll, 2016). [S] People rescued in a run move into the Breach and open shops. We took: what you win in a run (a key, an elite's first fall) adds an object to the hall.
- **Children of Morta** (Dead Mage, 2019). [S] The family home holds the upgrade workshop. [M] One room an upgrade family. We took: one station an upgrade family.
- **Death's Door, the Hall of Doors** (Acid Nerve, 2021). [S] A hub of floating offices that heals you on return. [M] The world doors stand in the hall. We weighed five place doors and took one run door with a map table instead (decision 4).
- **Walkable hub against a menu.** [S] Players of ARC Raiders found a walkable hub can become a chore; the Sixth Street postmortem (Zenless Zone Zero) keeps travel between functions short; a Bugnet guide warns against "a menu with geography". We took: a short walk, every station within 6 m of the path, and a quick list for speed and access.

### Rendering
No new rendering technique. The hall is baked with the same Ink Studio splat pipeline (`games/gloam-downs/README.md`) and the same painted look as the five places. The camera is the cut-away diorama room with an open front, as in Hades and Children of Morta [M], which also suits `play.js`'s camera that rises over walls. Growth objects are put out and back by density, the way `main.js` and `pool.js` already do. None of this is adapted from an outside shader or paper.

### The build
- [M] Dead Cells: bleed and poison that stack or tick, and crits on a stunned or frozen foe. We took: a stacking state (Char), a ticking state that spreads (Soot), and sure cuts on a stunned, held or blind foe.
- [M] Hades: boons of one god that pair into a stronger "duo" boon. We took: colour sets and kindlings, with our own rules.
- [M] Risk of Rain 2 (Hopoo Games, 2020): kill effects that chain, capped so they end. We took: Spill glass with a chain cap.
- No name, item, number, art or layout is copied. Every name here is our own and on the lamp theme.

## Part H: the walk-through Lamp-room

### Decision 1: a hall between runs, a shrine at a beacon
- **Between runs**, the Lamp-room is a place, `lamproom`. The title's Lamp-room button, the end of a run and a win all go there.
- **At a beacon**, nothing loads. The lit beacon becomes a shrine: walk up to it and one station card opens beside it, with three tabs (Wares, Patterns, Panes). The beacon card's Spend glim becomes "Go to the shrine", which closes the card and leaves the lamplighter at the beacon with the card open.
- Why: loading a second place in a run would drop the place from memory on a phone and cost 1 to 4 s each way. The glim at risk is a choice at the beacon, so it stays fast and on the spot. The hall is where the build is planned and shown.

### Decision 2: bake the hall
The research bake (gloam-hub-research at `9e243098`, outside the repo) made a 22 by 22 m hall with a throwaway biome and baked it with `bake.mjs hub --check --preview`:

| Version | splats | gz download | walk file | bake time | start view |
|---|---|---|---|---|---|
| Closed hall | 153,018 | 0.24 MB | about 1 KB | 4.8 s | the camera outside the south wall, mean luminance 0.095, 0% bright pixels |
| South wall open | 138,802 | 0.236 MB | about 1 KB | 4.2 s | a warm torch-lit room, mean luminance 0.091, 0.69% bright pixels |

A downs place is 232,607 to 245,198 splats and 1.22 to 1.36 MB. So the hall is baked, with an open front.
- **Biome:** `games/gloam-downs/biomes/lamproom.mjs`, with `run: false` and `set: 'hub'`.
- **bake.mjs:** `HUB = ['lamproom']`, next to `ORDER` and `LATTICE`; `node bake.mjs lamproom` and `node bake.mjs all` bake it. For `set: 'hub'`, `scenery()` needs a spawn and a `door` mark, and no beacon or wisps. It writes the stations' marks (`meta.stations`) and the growth ranges (`meta.grow`).
- **lib/check.mjs:** for a hub, it skips the beacon-above-start rule, the wisp count and the lattice colour rules, and adds: every station reachable from the spawn on the walk map, every station within 6 m of the spawn-to-door path, and the start view's mean luminance between 0.07 and 0.16 with at least 0.3% bright pixels.
- **save.js and places.js:** `HUB` beside `ORDER` and `LATTICE`; `placeName('lamproom')` is "The Lamp-room". The hub is never in the Map.
- **main.js:** `go('lamproom')` loads it with no foe pool.
- **Fallback, if the bake fails on a later Ink Studio:** build the hall at load from the props the bake already has, appended after the place's splats as `pool.js` appends slots. It costs more code and looks weaker, so it is only the fallback.

### Decision 3: the budget and the load on phones
| Part | Budget |
|---|---|
| The hall's scenery | at most 160,000 splats |
| Growth objects, all baked | at most 40,000 splats |
| Life | at most 1,200 dabs (`life.js` `MAX`) |
| Whole place | at most 210,000 splats, under the 250,000 of a place |
| Download | at most 0.40 MB gzip, walk file at most 4 KB |
| Bake | at most 20 s on a 4-core machine |
| Load | first frame within 4.0 s cold on the phone profile, 1.5 s warm |

- The phone profile: Chromium with network at 1.6 Mbit/s down and 150 ms latency, and the CPU slowed 4 times. 0.40 MB takes about 2 s on that link; the rest is the gzip decode and the upload. A test measures it (`gloam-downs-hub.e2e.mjs`). No real phone runs here; the report says so.
- While the hall shows, `main.js` fetches the bytes of the run's first place (not its GPU upload), so Begin the run is quick. The hall is dropped when the run's first place loads, so only one place is on the GPU at a time.

### Decision 4: the plan of the hall
A stone hall 20 m wide (x from -10 to 10) and 14 m deep (z from -7 to 7) on flat ground. The front (z = 7, the camera's side) is open with a 0.6 m parapet and two pillars. The back wall holds the run door. Torches and the stations' own lamps light it.

| Station | Where (x, z) | The object | What it does |
|---|---|---|---|
| Spawn | (0, 5) | a worn mat | where the lamplighter stands at first, facing the door |
| Well | (-3, 2) | a stone well with water | the bank, and the last run's recap |
| Wick rack | (-6.5, 3.5) | a rack of 9 hooks | the unlocks |
| Temper rack | (6.5, 3.5) | a rack of 4 blades | the blade tempers |
| Training post | (3.5, 1) | a post on a sand ring | try the build |
| Lamp shelf | (-8.5, -2) | 3 bays of 4 glass lamps | the lasting wares |
| Pane window | (9.3, -2) | a leaded window, 3 slots, a sill | the panes |
| Kiln | (6, -4.5) | a kiln with a hood of 4 rows of 8 hooks | kindle patterns |
| Trophy wall | (-4, -6.7) | 3 key plaques, 5 elite plaques | keys and elites put out |
| Ember bell | (3, -5.8) | a bell on a frame | the Ember level |
| Map table | (0, -4.5) | a table with the route as five lamps | the seed's route, Wander, Explore |
| Run door | (0, -7) | a tall door | begin the run |

- The path from the spawn to the door is 12 m: 2 s at a run (6.4 m/s), 4 s at a walk.
- One run door and a map table, not five place doors. A run's route is fixed by the seed (`routeFor`), so five doors would offer a choice that does not exist. The map table shows the route, and the explorer's Map stays in Wander.
- The stations' marks go in the biome as `ctx.mark('station', { id, at, face })`. `meta.stations` gives each one's point, its face and its use radius (1.6 m).

### Decision 5: the hall grows
Every growth object is baked, each as one contiguous range of splats, listed in `meta.grow` as `{ id, first, n }`. At load and after each buy, `hub.js` sets the density of a range not owned to 0 and puts the baked density back for one owned, as `main.js` puts splats out. Only the changed 512-splat rows upload.

| Station | Growth ranges | Shown when |
|---|---|---|
| Lamp shelf | for each ware, 8 glass rings, unlit and lit | ring k lit when the level is at least k |
| Kiln | for each pattern, an unlit lamp on the ledge and a lit lamp on the hood | the unlit one when found and not kindled, the lit one when kindled |
| Pane window | for each pane, coloured glass in each of 3 slots; a shutter for each slot | the glass of the pane set in that slot; the shutter on a slot not bought |
| Wick rack | for each unlock, a lit wick | bought |
| Temper rack | for each temper, a blade | kindled |
| Trophy wall | for each key, its trophy; for each elite, a plaque | key held; elite put out once |
| Ember bell | 6 rings of light round the bell | levels open |

- About 1,600 splats a ware (8 rings of 200), 250 a lamp, 400 a pane glass. In all about 38,000 splats, inside the 40,000 budget.
- A new light is lit with a 0.4 s glow and the `kindle` or `buy` cue. With reduced motion it is lit at once.
- The glass rings are a shape, not a colour ramp, so the level reads on a grey screen too.

### Decision 6: station cards
- Within 1.6 m of a station, facing it within 70 degrees, a prompt shows its name and the key: "E Use" on keys, "A Use" on a pad, a Use button on touch. Use opens that station's card.
- The card holds only that station's rows, built from the same row makers as today (`upgradeRows`, the pattern and pane rows, the unlock rows), so the rules of Buy, Kindle and Set stay one.
- **Where it shows** (`cards.js` `anchor(card, x, y)`), from the station's screen point:
  - 800 by 600 and 1280 by 720: beside the station, at most 360 px wide, kept 16 px inside the screen, never over the station itself.
  - 320 by 640, 360 by 640 and 390 by 844: a bottom sheet at most 55% of the height; the camera lifts so the station shows above it.
  - 844 by 390: a side sheet on the right, at most 45% of the width.
  - It never covers the Lab bar. Long cards scroll inside themselves, as today.
- While a card is open, the lamplighter stands still and input moves the focus in the card. Walking away (a stick or key held 0.3 s) or Esc, B or the close button shuts it. Moving more than 2.5 m away shuts it.
- **The quick list:** Tab, the pad's View button, or the touch List button (top right, at least 44 px) opens every station's rows in one card, the restyled `#lamp`. It works anywhere in the hall. It is also the screen reader's way through.
- **The Ember bell** card picks the level; the map table card has Begin the run, Wander and Explore; the run door begins the run when walked through, or with Use.

### Decision 7: input
| Input | Use | Close | Quick list | Move in a card |
|---|---|---|---|---|
| Keys | E or Enter | Esc | Tab | arrows, W S, then Enter |
| Mouse | click the prompt, or click a station within 3 m | click outside the card | the List button | click |
| Pad | A | B | View | d-pad or left stick |
| Touch | the Use button | the close button, or walk away | the List button | tap |

The training post: Attack, Roll and both abilities work in the hall. Ability cooldowns are a quarter of their length there, and damage numbers float over the post. Nothing spent there costs anything.

### Decision 8: life, sound and reduced motion
- `life.js` `LIFE.lamproom`: dust that twinkles in the torch light, the kiln's fire on the fire slots 34 to 37, a slow bob on the well's water, and the shelf lamps that brighten within `RULES.near` of the lamplighter. No crows, no gusts.
- `beds.js` `BEDS.lamproom`: a low room tone (wind f 160, q 0.5, db -10), a drip from the well every 10 to 25 s, and the kiln's crackle near the kiln. The music is the Lamp-room's scene as today.
- With reduced motion: the camera does not glide to frame a station, a card shows at once, lights come on at once, and life follows its own reduced rules.

## Part B: more to gain

### New foe states (`status.js`)
| State | Rule | Heavy foe | The Barrow Reeve |
|---|---|---|---|
| Char | stacks to 5; each stack deals 1 a second; stacks last 4 s from the last added; the 5th stack bursts for 20 and clears them | the same | takes the burst only, at 5 stacks |
| Soot | 2 a second for 6 s, a new Soot renews it; a sooted foe put out passes 4 s of Soot to each foe within 2.5 m, once | the same | none |
| Blind | 3 s; the next attack started in it misses: it plays and deals 0 | 1.5 s | none |
| Mark | 4 s; the lamplighter's next hit bursts it for 22 | the same | none |

- **Ticks never interrupt.** A tick of Char, Soot or burn never makes a foe flinch, never wears its poise, never stops a wind-up, adds nothing to the combo and gives no glim on its own. A burst of Char or Mark is a hit and follows the fair-fight rules.
- **States together** on one foe deal at most 8 a second from ticks; a tick over that is lost.

### Sure cuts and the ward shell (`build.js`)
- **A sure cut** deals 1.5 times. It comes from Sure hand, Shutter and Whetstone. It multiplies after the added bonuses (Flame, Edge, Keen edge, Cinder glass, Cracked glass, Ember glass). It shows a brighter spark, a 1-step longer hit stop and the `sure` cue.
- **The ward shell** is a pool of points on the lamplighter that takes damage first. All sources together hold at most 40% of the max health (50% with the Ward set). Each source has its own time. The HUD shows it as a pale band over the health bar (`#shell`).

### New abilities (`growth.js` `ABILITIES`)
All are patterns kindled at the kiln. Cooldown in s, and the cost in glim.

| id | Name | Colour | Cool | Cost | What it does | Cue |
|---|---|---|---|---|---|---|
| lash | Wick lash | Flame | 9 | 110 | a 5 m line, 0.5 m wide: 14 to each foe on it, and 3 s of burn | `lash` |
| fan | Shard fan | Flame | 8 | 120 | 5 shards in a 50 degree fan, 6 m: 6 each, and 1 Char each | `shards` |
| slick | Oil slick | Flame | 11 | 100 | a 3 m pool for 6 s: 40% slow; burn that touches it lights it for 4 s, 5 every 0.5 s | `slick` |
| tacks | Tack scatter | Gloam | 10 | 90 | 8 tacks in a 2.5 m ring for 8 s; a foe on one takes 4, 1 Char and a 30% slow for 1 s; each tack works once | `tacks` |
| toll | Bell toll | Ward | 13 | 140 | a 3.5 m ring: light foes stunned 0.8 s; heavy foes lose 40 poise | `toll` |
| shell | Ember shell | Ward | 15 | 130 | a 20 shell for 6 s; when it breaks or ends, 15 in 2.5 m and 2 s of burn | `shell` |
| post | Post lamp | Ward | 20 | 170 | plants a lamp for 10 s: within 3 m, heal 1.5% of the max health a second; Use again while it stands blinks you to it, safe 0.15 s, and ends it | `post` |
| shutter | Shutter | Gloam | 14 | 150 | 2 s unseen: foes not yet winding up do not start at you and give back their tokens; the next blade hit within 3 s is a sure cut | `shutter` |
| swarm | Moth swarm | Gloam | 20 | 180 | 6 moths for 10 s; each goes to the nearest burning foe within 8 m, else the nearest foe, and deals 3 a second | `wisp` |
| blink | Gloam blink | Gloam | 8 | 150 | a 5 m blink through foes, safe 0.2 s; each foe passed gets a Mark | `blink` |

- Power by colour, bright lamps, Gloam cooldowns and Smoked glass apply as for the nine abilities there now.
- Wick lash, Shard fan, Bell toll and the bursts are damaging hits, so they interrupt by the fair-fight rules. Oil slick's fire, Moth swarm and Post lamp's heal tick.
- Drawn with the spark dabs, rings and lines `fight.js` and `sparks.js` already draw. A tell comes before every effect.

### New buffs
29 in all.

**Panes** (patterns, set at the pane window):
| id | Name | Colour | Cost | Rule |
|---|---|---|---|---|
| cinder | Cinder glass | Flame | 140 | below 30% health, +30% damage |
| spill | Spill glass | Flame | 120 | a foe put out bursts: 8 in 2 m and 2 s of burn; a chain stops after 3 |
| rush | Rush glass | Gloam | 110 | a foe put out gives 1.5 s of haste: walk and run 25% faster, and the next roll starts at once |
| thirst | Thirst glass | Ward | 150 | below 50% health, blade hits heal 15% of their damage |
| shard | Shard glass | Gloam | 130 | a sure cut adds 2 Char |
| cracked | Cracked glass | Flame | 60 | +35% damage; after 3 hits taken in a place it cracks and gives nothing until the next beacon |

**Wicks** (the start pick and beacon offers):
| id | Name | Colour | Rule | In the pool |
|---|---|---|---|---|
| sure | Sure hand | Flame | a hit on a stunned, held or blind foe is a sure cut | from the first run |
| charw | Char wick | Flame | the finisher adds 2 Char | from the first run |
| count | Count wick | Gloam | each 12th hit of one combo throws a free Lantern bomb at 75% power at the nearest foe within 6 m; it counts as an ability use | Wick crate |
| shellw | Shell wick | Ward | a 15 shell at each place's start and each zone cleared, until it breaks | Wick crate |

**Relics** (elite drops, `relics.js`), with their kindlings:
| id | Name | Move | Rule | Kindled with | Kindled rule |
|---|---|---|---|---|---|
| charedge | Char edge | first cut | adds 1 Char | Char wick | adds 2 |
| soot | Soot heel | plunge | a 2.5 m Soot cloud for 3 s | Heavy fall | 3.5 m |
| glass | Glass drink | flask | a drink gives a 20 shell for 5 s | Spare oil | 30 |
| thorn | Thorn roll | near miss | 12 to the foe that swung, with no flinch | Quick heels | 20 |

**Wares and unlocks** (the lamp shelf and the wick rack):
| id | Name | Colour | Costs | Rule |
|---|---|---|---|---|
| whet | Whetstone | Flame | 90, 200, 360 | 4% chance a level that any blade hit is a sure cut |
| horn | Horn lamp | Ward | 120, 280 | shells 20% bigger a level |
| rack | Temper rack | | 150 | opens the temper rack; tempers join the pattern drops |
| crate | Wick crate | | 180 | Count wick and Shell wick join the wick pool |

**The key** (`keys.js`): **Gloam dash** (Gloam), from the Fen-wick's first fall. Roll in the air dashes 3.5 m level, safe 0.15 s, once until you land. It reaches the existing ledge caches another way. No new caches without a rebake.

**Blade tempers** (patterns of kind `temper`, once Temper rack is bought; picked at the temper rack and kept until changed; the Lamp blade is the default):
| id | Name | Colour | Cost | Rule |
|---|---|---|---|---|
| hook | Hook temper | Flame | 160 | reach +0.6 m, the string 15% slower, damage x1.1, the finisher sweeps 180 degrees and pulls light foes 1 m in |
| twin | Twin temper | Gloam | 160 | a 4-cut string, each cut 25% faster and at 65% damage; the 4th cut adds 1 Char |
| bell | Bell temper | Ward | 200 | a 2-cut string, 30% slower, damage x1.6, poise worn twice as fast; hold Attack 0.5 s to slam: 30 in 2.5 m |

Tempers are drawn with the cut poses there now at other speeds and the blade bone scaled (Hook 1.4 long, Twin 0.7, Bell 1.2 and wider). The 4th twin cut reuses the first cut; the slam reuses the plunge's landing. No new poses are baked.

**Colour sets** (`build.js`): count the run's colours over the slotted abilities, the set panes, the held relics (by `MOVE_COLOUR` of their move) and the temper. Three of one colour turns its set on:
| Set | Rule |
|---|---|
| Flame | a burning foe put out passes 2 s of burn to the nearest foe within 2 m |
| Ward | a 10 shell at each zone cleared, and the shell may hold 50% |
| Gloam | each ability use cools the other by 1 s |

The HUD's colour row rings a colour whose set is on.

### Gaining them
| Way | What |
|---|---|
| Pattern drops, kindled at the kiln | the 10 abilities, the 6 panes, the 3 tempers (after Temper rack) |
| Relic drops from elites | the 4 relics |
| Wick offers | the 4 wicks (2 after Wick crate) |
| Wares and unlocks | Whetstone, Horn lamp, Temper rack, Wick crate |
| An elite's first fall | Gloam dash |
| Caches | a `pattern` cache may give any new pattern; an `ability` cache any kindled ability |
| Sparks | the colour sets, by the colours held |

- The pattern pool grows from 13 to 32. To keep a new pattern within reach, a pattern drop picks an ability, pane or temper with odds 50:35:15 (50:50:0 before Temper rack), then one of that kind from the seed's `pattern` stream.
- Whetstone's chance draws from its own seed stream, `sure`, so the same seed gives the same sure cuts.
- Seeded tests that pin a wick, relic or pattern draw are updated with the new tables.

### Synergies
| With | New | What happens |
|---|---|---|
| Lantern bomb, Pitch pour, Ember tongue, Ember trail | Oil slick | burn lights the slick |
| Ember tongue, Ember glass, Pitch pour | Moth swarm | moths go to burning foes, and Ember glass adds 20% to their hits |
| Flare, Ember snare, Bell toll, Shutter | Sure hand | stunned, held or blind foes take sure cuts |
| Sure hand, Whetstone | Shard glass | each sure cut adds 2 Char |
| Char edge, Char wick, Twin temper, Shard fan, Tack scatter | Char | stacks come from many moves and burst sooner |
| Lead glass, Bell guard | Ember shell, Shell wick, Glass drink | a Ward build that takes blows on a shell |
| Ember glass, Ember tongue | Spill glass, Flame set | burn passes from foe to foe |
| Quick heels, Ember trail | Rush glass | a kill gives a free roll, so more trail |
| Last ember | Cinder glass | you stand again at 25%, under Cinder's 30% |
| Cinder glass | Thirst glass | a low-health build that heals as it hits |
| Hot glass, Clear glass | Count wick | the free bomb counts as an ability use |
| Smoke step, Clear glass | Gloam blink | two safe steps, and the Mark adds 22 |
| Hooked cut | Hook temper | the pull is 1 m longer |
| Bell guard, Bell toll | Bell temper | poise breaks fast |
| Crow step | Gloam dash | jump, jump again, then dash |

### Balance
The fair-fight change is changing the foe curve, the interrupts, the poise and the attack tokens right now. These rules keep the new pool inside a budget until both are measured together:
- **One buff:** at most +20% damage a second on the bot's reference string against a Snuffer, or at most +25% effective health, when held alone. Node test `gloam-downs-kit.test.mjs` measures each one.
- **Adding up:** damage bonuses add within one sum (Flame, Edge, Keen edge, Cinder, Cracked, Ember glass), and a sure cut multiplies after. Ticks are capped at 8 a second a foe, a Spill chain at 3, a shell at 40% (50%).
- **Pacing SHALL be rechecked after both changes land.** Run `node qa/lab/gloam-downs-bot.mjs` with 60 bots a skill on the merged code. The fair-fight targets must still hold (skill 0.3: place 2 in 80% of first runs, first win in run 8 to 20; 0.5: run 3 to 8; 0.9: run 1 to 2). No build family may clear a place more than 15% faster than the mean of all families. If one does, its numbers here move, and this file says so.

### Sound
New cues in `run-sound.js`, built from the recipes there now: `lash`, `slick`, `tacks`, `toll`, `shell`, `post`, `shutter`, `blink`, `sure`, `char` (the burst), `soot`, `crack` (Cracked glass), `dash`. `shards` and `wisp` are reused. Each keys on a bus event with the ability or buff id.

## Tests
| Test | Covers |
|---|---|
| `node games/gloam-downs/bake.mjs lamproom --check` | the hub bake, its budget and its checks |
| `qa/lab/gloam-downs-hub.test.mjs` | stations, growth ranges by the save, station rows, the shrine, the quick list, the budget numbers |
| `qa/lab/gloam-downs-hub.e2e.mjs` | walk to each station, open its card with keys, pad, mouse and touch, buy and see the hall change, begin the run at the door, the phone load |
| `qa/lab/gloam-downs-hub-layout.e2e.mjs` | station cards and the quick list at 320x640, 390x844, 360x640, 844x390, 800x600 and 1280x720, reduced motion |
| `qa/lab/gloam-downs-life.test.mjs` and `node qa/lab/gloam-downs-music-demo.mjs beds` | the hall's life and bed |
| `qa/lab/gloam-downs-states.test.mjs` | Char, Soot, Blind, Mark, ticks that never interrupt, the tick cap |
| `qa/lab/gloam-downs-kit.test.mjs` | each new ability, pane, wick, relic, ware, unlock, the key, tempers, sets, sure cuts, the shell, the power budget |
| `qa/lab/gloam-downs-run.kit.e2e.mjs` | each new ability's tell and effect in a place, a temper's string, Gloam dash |
| `qa/lab/gloam-downs-sound.test.mjs` | the new cues |
| `qa/lab/gloam-downs-bot.mjs` | pacing after both changes |

## Who builds what
Two builders in parallel worktrees, after the fair-fight change merges into the work branch. Both start from one commit that adds the new tables (task 0.1). Each runs its own checks before it hands over. The merge pass runs every check.

### Hub builder (H)
Owns: `games/gloam-downs/biomes/lamproom.mjs`, the `hub` set in `bake.mjs` and `lib/check.mjs`, `public/lab/gloam-downs/worlds/lamproom.*`, `hub.js` (new), `places.js`, `save.js`, `cards.js`, `input.js`, `index.html`, `screens.js`, `main.js`, `life.js`, `beds.js`, `qa/lab/gloam-downs-hub*.mjs`. Reads the tables in `growth.js` and `run.js`, never writes them.

### Buffs builder (B)
Owns: `growth.js` (after 0.1), `run.js`, `status.js`, `abilities.js`, `relics.js`, `keys.js`, `build.js` (new), `foes.js`, `fight.js`, `sparks.js`, `moves.js`, `run-sound.js`, `qa/lab/gloam-downs-bot.mjs`, `qa/lab/gloam-downs-states.test.mjs`, `gloam-downs-kit.test.mjs`, `gloam-downs-run.kit.e2e.mjs`.

### The hooks
B may add only these lines to H's files, one line each, at the place named:
```js
// main.js, with the imports
import { makeBuild, shellShare } from './build.js';
// main.js, in go(), on the line after the runner is made
build = makeBuild(R);
// main.js, in the play step, on the line after the runner's step
build?.step();
// main.js, in the HUD update
$('shell').style.width = (100 * shellShare(build)).toFixed(1) + '%';
```
```html
<!-- index.html, inside the health bar -->
<i id="shell" class="shell" aria-hidden="true"></i>
```
- `input.js`: none. Gloam dash reads Roll in the air in `moves.js`.

H reads B's tables and calls one function, with no line in B's files:
- `hub.js` reads `ABILITIES`, `PANES`, `TEMPERS`, `LAMP_KEYS` and `PATTERNS` from `growth.js`, and `UPGRADES` and `UNLOCKS` from `run.js`. New rows show up at their stations with no hook.
- `hub.js`, at the temper rack: `rack: id => chooseTemper(rs, id),` with `chooseTemper` written by B in `run.js`. Until B lands, H stubs it in `hub.js`.

Lines in files neither owns:
- `foes.js` (B, after the fair-fight merge), one line at each of three places:
```js
// in the foe step, before its mind runs
statusTick(f, ctx);
// where a foe is put out
statusOut(f, ctx.foes);
// where a foe starts an attack
if (blindMiss(f)) attack.miss = true;
```
- `run-sound.js` (B): one handler a new cue, keyed on its bus event.

### The merge pass
Merge H, then B. Run every check in "Tests", the Gloam Downs checks in AGENTS.md, and the bot's pacing. Update this file with the measured numbers.
