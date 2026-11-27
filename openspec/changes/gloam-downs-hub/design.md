# Design: Gloam Downs, the walk-through Lamp-room, and more to gain

## The request
The player said: "the lamp room looks ugly make it a walk thru environmewnt" and "with more types of buffs and abilities thatr can be gained", and then "like different categoies like deadcells". So there are three parts. Part H turns the Lamp-room into a place you walk through. Part C sorts everything the player can gain into clear categories, with slots, colours, quality tiers and traits. Part B adds abilities and buffs of kinds the game lacks, each in its category. This design fits the code on `9e243098`. The fair-fight change (`gloam-downs-fair-fight`, in progress) changes `foes.js`, `run.js`, `moves.js`, `feel.js`, `boss.js`, `mix.js` and the bot; the build starts after it merges (section "Who builds what").

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
3. One blade. No weapon to swap, and no second hand.
4. No shield on the lamplighter: only Lead glass and Bell guard.
5. One summon (Moth wisp).
6. Few traps (Ember snare, Pitch pour).
7. Little on a kill (Thick glass, Hot glass) and nothing at low health but Last ember.
8. The combo counter scales nothing.
9. No trade-off picks.
10. Colours scale numbers but give no set bonus.
11. No clear categories. Abilities have slots and a bright form, but panes, wicks, relics, wares and unlocks share one long card, and nothing found has a quality beyond bright.

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

### The categories
- [M] Dead Cells sorts what you find into main weapons, a second weapon or a shield, two skills, mutations picked at stations, an amulet, scrolls that raise one of three colour stats, and blueprints that open items for later runs. Each find has a colour and a quality, and may roll extra affixes. We took: fixed slots by kind, one colour on every find that grows with its colour level, quality tiers that rise with depth, rolled traits, and plans that open items for later runs. We did not take its names, numbers, item lists, or its split of stats by colour.
- [M] Hades: each weapon has its own move set and feel. We took: each blade has its own string, speed, reach and damage.
- No name, item, number, art or layout is copied. Every name here is our own and on the lamp theme. "Category", "slot" and "tier" are plain words; no item, tier or trait name of another game is used.

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
- **As built:** 162,900 splats (151,482 scenery, 4,334 in 205 growth ranges), 0.397 MB gzip with the walk map and JSON, a 1.8 KB walk file, about 5 s to bake, and a start view of mean luminance 0.114 with 0.76% bright pixels. A flagstone terrace with two braziers lies before the open front, because the follow camera stands 9 m behind the lamplighter, outside the hall, and without it the lower third of the view was the unlit moor. The five downs places and the three Lattice places still bake byte for byte as before.
- **Fallback, if the bake fails on a later Ink Studio:** build the hall at load from the props the bake already has, appended after the place's splats as `pool.js` appends slots. It costs more code and looks weaker, so it is only the fallback.

### Decision 3: the budget and the load on phones
| Part | Budget |
|---|---|
| The hall's scenery | at most 160,000 splats |
| Growth objects, all baked | at most 46,000 splats |
| Life | at most 1,200 dabs (`life.js` `MAX`) |
| Whole place | at most 210,000 splats, under the 250,000 of a place |
| Download | at most 0.40 MB gzip, walk file at most 4 KB |
| Bake | at most 20 s on a 4-core machine |
| Load | first frame within 4.0 s cold on the phone profile, 1.5 s warm |

- The phone profile: Chromium with network at 1.6 Mbit/s down and 150 ms latency, and the CPU slowed 4 times. 0.40 MB takes about 2 s on that link; the rest is the gzip decode and the upload. A test measures it (`gloam-downs-hub.e2e.mjs`). No real phone runs here; the report says so.
- While the hall shows, `main.js` fetches the bytes of the run's first place (not its GPU upload), so Begin the run is quick. The hall is dropped when the run's first place loads, so only one place is on the GPU at a time.

### Decision 4: the plan of the hall
A stone hall 14 m wide (x from -7 to 7) and 14 m deep (z from -7 to 7) on flat ground. The front (z = 7, the camera's side) is open with a 0.6 m parapet and two pillars. The back wall holds the run door. Torches and the stations' own lamps light it.

"Where" is the station's point: the spot the lamplighter stands on to use it. The object stands just behind it, along the station's face; the lamp shelf and the pane window stand against the side walls, 1.5 m behind their points.

| Station | Where (x, z) | The object | What it does |
|---|---|---|---|
| Spawn | (0, 5) | a worn mat | where the lamplighter stands at first, facing the door |
| Well | (-2.5, 2.5) | a stone well with water | the bank, and the last run's recap |
| Wick rack | (-5.5, 4.5) | a rack of 9 hooks | the unlocks |
| Blade rack | (5.5, 4.5) | a rack of 4 hooks | the blades: pick the start blade |
| Off-hand stand | (-5.5, 1) | a stand with 6 pegs | the off-hands: pick the start one |
| Ability post | (2.5, 1.5) | a post on a sand ring, a rack of ability lamps | the abilities: try any two |
| Lamp shelf | (-5.5, -2.5) | 3 bays of 4 glass lamps, on the left wall | the lasting wares |
| Pane window | (5.5, -0.5) | a leaded window, 3 slots, a sill, in the right wall | the panes |
| Kiln | (5.5, -4) | a kiln with a hood of 5 rows of 8 hooks | kindle patterns of every category |
| Trophy wall | (-3.5, -6.7) | 3 key plaques, 5 elite plaques | keys and elites put out |
| Ember bell | (3.2, -6.6) | a bell on a frame | the Ember level |
| Map table | (0, -3.6) | a table with the route as five lamps | the seed's route, Wander, Explore |
| Run door | (0, -7) | a tall door | begin the run |

- The path from the spawn to the door is 12 m: 2 s at a run (6.4 m/s), 4 s at a walk.
- 12 stations in all, one a category or a lasting family (Part C "Hall stations by category").
- Every station's point is at most 5.5 m from the spawn-to-door path (x = 0, z from -7 to 5), inside the 6 m rule with 0.5 m to spare. The first plan put the lamp shelf at x = -8.5, the pane window at x = 9.3 and both racks at x = 6.5, which broke that rule; the hall is narrower now so they stand closer.
- Any two station points are at least 3.2 m apart, so two use radii (1.6 m) never overlap and one prompt shows at a time.
- One run door and a map table, not five place doors. A run's route is fixed by the seed (`routeFor`), so five doors would offer a choice that does not exist. The map table shows the route, and the explorer's Map stays in Wander.
- The stations' marks go in the biome as `ctx.mark('station', { id, at, face })`. `meta.stations` gives each one's point, its face and its use radius (1.6 m).

### Decision 5: the hall grows
Every growth object is baked, each as one contiguous range of splats, listed in `meta.grow` as `{ id, first, n }`. At load and after each buy, `hub.js` sets the density of a range not owned to 0 and puts the baked density back for one owned, as `main.js` puts splats out. Only the changed 512-splat rows upload.

| Station | Growth ranges | Shown when |
|---|---|---|
| Lamp shelf | for each ware, 8 glass rings, unlit and lit | ring k lit when the level is at least k |
| Kiln | for each pattern, an unlit lamp on the ledge and a lit lamp on the hood (5 rows of 8 hooks) | the unlit one when found and not kindled, the lit one when kindled |
| Pane window | for each pane, coloured glass in each of 3 slots; a shutter for each slot | the glass of the pane set in that slot; the shutter on a slot not bought |
| Wick rack | for each unlock, a lit wick | bought |
| Blade rack | for each blade, the blade on its hook | kindled; the start blade glows |
| Off-hand stand | for each off-hand, the item on its peg | kindled; the start one glows |
| Trophy wall | for each key, its trophy; for each elite, a plaque | key held; elite put out once |
| Ember bell | 6 rings of light round the bell | levels open |

- The first estimate was about 1,600 splats a ware, 250 a lamp and 400 a glass or an item, about 43,000 in all. As baked, the rings, lamps, glasses and items are small and the 205 ranges hold 4,334 splats, far inside the 46,000 budget.
- A new light is lit with a 0.4 s glow and the `kindle` or `buy` cue. With reduced motion it is lit at once.
- The glass rings are a shape, not a colour ramp, so the level reads on a grey screen too.

### Decision 6: station cards
- Within 1.6 m of a station, facing it within 70 degrees, a prompt shows its name and the key: "E Use" on keys, "A Use" on a pad, a Use button on touch. Use opens that station's card.
- The card holds only that station's rows, built from the same row makers as today (`upgradeRows`, the pattern and pane rows, the unlock rows) and the new blade and off-hand rows, so the rules of Buy, Kindle, Set and Pick stay one. Every row shows its category as Part C "The cards by category" says.
- **Where it shows** (`cards.js` `anchor(card, x, y)`), from the station's screen point:
  - 800 by 600 and 1280 by 720: beside the station, at most 360 px wide, kept 16 px inside the screen, never over the station itself.
  - 320 by 640, 360 by 640 and 390 by 844: a bottom sheet at most 55% of the height, with the station showing above it. While the sheet is open, `main.js` gives the camera a layout that aims 1.7 m lower on the lamplighter and looks 0.2 rad further down, through `play.js`'s own `layout()`, so no code in `play.js` changes; the window's layout comes back when the card closes. `gloam-downs-hub-layout.e2e.mjs` checks that the station stands above the sheet.
  - In a side sheet the tools (Look, List) hide while it is open; its own close button is there.
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

The ability post: Attack, Roll, the off-hand and both abilities work in the hall. Ability cooldowns are a quarter of their length there, and damage numbers float over the post. Nothing spent there costs anything.
- A cooldown that starts in the hall starts at a quarter of its length (`hub.js` `quarterCool`), so the HUD counts the short time down.
- The post's target stands on the near face of the baked post, 0.5 m in front of its middle, on the floor. The baked post is solid on the walk map, so a target in its middle would be out of the blade's line of sight.
- In the hall E is Use, so it does not turn the view there; Q still does. Escape, M and P open the quick list, since the hall has no pause.
- A pad's prompt reads "A Use" once the pad has been pressed; until then the keys' "E Use" shows, as the other labels do.

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
- **States together** on one foe deal at most 8 a second from ticks; a tick over that is lost. The cap is a rolling second of the foe's own play steps. It counts Char, Soot, a burn and the moths of Moth swarm. The ground fires (Pitch pour's pool and a lit Oil slick, 5 every 0.5 s) tick too, so they never flinch or wear poise, but they stay outside the cap, as the pitch is today.
- **As built (B):** a tick goes to the foe as `hit(n, { tick: true })`, which takes the damage and a short flash and nothing else. A blind foe's next attack is marked at its start (`blindMiss`); an elite's special move is read as its first blow comes. A Mark bursts after the hit that finds it. The Lantern bomb's own burn is a tick now, so it no longer wears an Ironback's poise. Ember tongue stays a relic hit.

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
- **As built (B):** the steady dabs of a draw are capped at 80, up from 64. At 64, an Oil slick of 28 dabs, a ledge's lamps and a ring of tacks went over the cap and two tacks were not drawn (`gloam-downs-run.kit.e2e.mjs` caught it). The slick is now 23 slightly larger dabs, and the cap leaves room for a slick, the tacks and the lamps together.

### New buffs
Each sits in its category (Part C). Here: 6 panes, 4 wicks, 4 relics and their 4 kindlings, 2 wares, 2 unlocks, 1 key and 3 colour sets. The 3 blades, 6 off-hands, 3 tiers and 10 traits are in Part C.

**Panes** (patterns, set at the pane window):
| id | Name | Colour | Cost | Rule |
|---|---|---|---|---|
| cinder | Cinder glass | Flame | 140 | below 30% health, +30% damage |
| spill | Spill glass | Flame | 120 | a foe put out bursts: 8 in 2 m and 2 s of burn; a chain stops after 3 |
| rush | Rush glass | Gloam | 110 | a foe put out gives 1.5 s of haste: walk and run 25% faster, and the next roll starts at once |
| thirst | Thirst glass | Ward | 150 | below 50% health, blade hits heal 4% of their damage (the first draft's 15% failed the budget) |
| shard | Shard glass | Gloam | 130 | a sure cut adds 2 Char |
| cracked | Cracked glass | Flame | 60 | +30% damage; after 3 hits taken in a place it cracks and gives nothing until the next beacon (the first draft's +35% failed the budget) |

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
| rack | Blade rack | | 150 | the Hook blade, Twin knives and Bell maul join the pattern drops (was Temper rack) |
| crate | Wick crate | | 180 | Count wick and Shell wick join the wick pool |

**The key** (`keys.js`): **Gloam dash** (Gloam), from the Fen-wick's first fall. Roll in the air dashes 3.5 m level, safe 0.15 s, once until you land. It reaches the existing ledge caches another way. No new caches without a rebake.

**Blades** are now their own category, Part C "Blades". The three tempers of the first draft are the Hook blade, Twin knives and Bell maul there.

**Colour sets** (`build.js`): count the run's colours over the held blade, the held off-hand, the slotted abilities, the set panes and the held relics (by `MOVE_COLOUR` of their move). Three of one colour turns its set on:
| Set | Rule |
|---|---|
| Flame | a burning foe put out passes 2 s of burn to the nearest foe within 2 m |
| Ward | a 10 shell at each zone cleared, and the shell may hold 50% |
| Gloam | each ability use cools the other by 1 s |

The HUD's colour row rings a colour whose set is on. As built (B): `build.js` `setsOf(R)` and `R.build.view().sets` give the sets on; the merge pass drew the ring in the HUD's colour row (`cards.js` `updateGrowth`, a rounded edge in the colour's hue, and "set on" in the row's label).

### Gaining them
| Way | What |
|---|---|
| Pattern drops, kindled at the kiln | the 10 abilities, the 6 panes, the 3 blades (after Blade rack), the 5 off-hands |
| Gear drops in a run | kindled blades, off-hands and abilities, with a tier and traits (Part C "Drop tables") |
| Relic drops from elites | the 4 relics |
| Wick offers | the 4 wicks (2 after Wick crate) |
| Wares and unlocks | Whetstone, Horn lamp, Blade rack, Wick crate |
| An elite's first fall | Gloam dash |
| Caches | a `pattern` cache may give any new pattern; an `ability` cache any kindled ability |
| Sparks | the colour sets, by the colours held |

- The pattern pool grows from 13 to 37. To keep a new pattern within reach, a pattern drop picks a kind first (Part C "Drop tables"), then one of that kind from the seed's `pattern` stream.
- Whetstone's chance draws from its own seed stream, `sure`, so the same seed gives the same sure cuts.
- Seeded tests that pin a wick, relic or pattern draw are updated with the new tables.

### Synergies
| With | New | What happens |
|---|---|---|
| Lantern bomb, Pitch pour, Ember tongue, Ember trail | Oil slick | burn lights the slick |
| Ember tongue, Ember glass, Pitch pour | Moth swarm | moths go to burning foes, and Ember glass adds 20% to their hits |
| Flare, Ember snare, Bell toll, Shutter | Sure hand | stunned, held or blind foes take sure cuts |
| Sure hand, Whetstone | Shard glass | each sure cut adds 2 Char |
| Char edge, Char wick, Twin knives, Sling, Charring, Shard fan, Tack scatter | Char | stacks come from many moves and burst sooner |
| Lead glass, Bell guard | Ember shell, Shell wick, Glass drink | a Ward build that takes blows on a shell |
| Ember glass, Ember tongue | Spill glass, Flame set | burn passes from foe to foe |
| Quick heels, Ember trail | Rush glass | a kill gives a free roll, so more trail |
| Last ember | Cinder glass | you stand again at 25%, under Cinder's 30% |
| Cinder glass | Thirst glass | a low-health build that heals as it hits |
| Hot glass, Clear glass | Count wick | the free bomb counts as an ability use |
| Smoke step, Clear glass | Gloam blink | two safe steps, and the Mark adds 22 |
| Hooked cut | Hook blade | the pull is 1 m longer |
| Bell guard, Bell toll, Iron cuff | Bell maul | poise breaks fast |
| Sure hand, Shard glass | Buckler | a parry readies a sure cut, and the sure cut adds 2 Char |
| Shade lamp | Sure hand | blind foes take sure cuts |
| Lamp chain | Gloam blink, Mark | the chain's Mark adds 22 to the next hit |
| Oil slick, Pitch pour | Fire pot | the pot's burn lights the slick |
| Crow step | Gloam dash | jump, jump again, then dash |

### Balance
The fair-fight change is changing the foe curve, the interrupts, the poise and the attack tokens right now. These rules keep the new pool inside a budget until both are measured together:
- **One buff:** at most +20% damage a second on the bot's reference string against a Snuffer, or at most +25% effective health, when held alone. Node test `gloam-downs-kit.test.mjs` measures each one.
- **Adding up:** damage bonuses add within one sum (the held blade's colour, Edge, Keen edge, Cinder, Cracked, Ember glass), then the tier's power multiplies, and a sure cut multiplies after. The gear has its own budget (Part C "Gear budget"). Ticks are capped at 8 a second a foe, a Spill chain at 3, a shell at 40% (50%).
- **Pacing SHALL be rechecked after both changes land.** Run `node qa/lab/gloam-downs-bot.mjs` with 60 bots a skill on the merged code. The fair-fight targets must still hold (skill 0.3: place 2 in 80% of first runs, first win in run 8 to 20; 0.5: run 3 to 8; 0.9: run 1 to 2). No build family may clear a place more than 15% faster than the mean of all families. A build family is the run's main colour with its blade and off-hand. If one does, its numbers here move, and this file says so.
- **The reference duel** (`gloam-downs-kit.test.mjs`, B): the lamplighter holds Attack against a Snuffer that hooks back, for 30 s of play on flat ground. When a blow would put it out it stands again at full health, so the low-health panes come and go as in a fight. Damage a second is the Snuffer's health lost; effective health is the blows' damage over the health lost, where shell points and heals are health not lost. Measured on the B branch, before the gear: Whetstone 3 +11.2%, Cinder glass +5.3%, Cracked glass +16.5%, Char wick +12.9%, Count wick +4.8%, Char edge +7.3% damage a second; Thirst glass +19.0% and Shell wick +17.6% effective health. The rest add nothing alone in the duel (they need a kill, a roll, a drink, a plunge or a sure cut from another buff). Cracked glass at +35% measured +20.3% and Thirst glass at 15% measured +58.7% (at 5%, +26.6%), so both moved, as the table says.
- **Pacing on the B branch** (the kit, no gear yet; 60 bots a skill, first seed 1, `node qa/lab/gloam-downs-bot.mjs 60 <skill> 1`), against the shared start commit before it, as the base:

| Skill | First run reaches place 2 (B / base) | Place 3 | Median first win run | Runs won | Families, minutes to clear a place against the mean |
|---|---|---|---|---|---|
| 0.3 | 75% / 75% | 45% / 47% | 4 / 6 | 246 of 567 / 178 of 739 | Flame 3.4% faster, Ward 3.1% slower, Gloam 0.0% |
| 0.5 | 97% / 97% | 90% / 90% | 1 / 2 | 339 of 379 / 293 of 403 | Flame 3.9% faster, Ward 5.1% slower, Gloam 1.4% faster |
| 0.9 | 100% / 100% | 100% / 100% | 1 / 1 | 336 of 369 / 327 of 373 | Flame 3.0% faster, Ward 3.7% slower, Gloam 0.7% faster |

  The kit makes no run harder and wins come sooner; no family clears a place more than 15% faster than the mean. The base already misses two fair-fight targets at 0.3 (place 2 in 80% of first runs, the first win from run 8), so the merge pass reads them again with the gear. The bot plays one family a bot (Flame, Ward, Gloam by its number; `FAMILY=` plays one for all): its panes, Belt's start ability, its wicks and its sparks by that colour, with Thick glass first or second in every family as before.
- **The whole catalogue** (every ware level, every unlock and every pattern) costs 16,315 glim, up from 11,725: wares 10,165, unlocks 1,320, patterns 4,830. `gloam-downs-growth.test.mjs` pins these and keeps the total between 15,000 and 18,000.

### Sound
New cues in `run-sound.js`, built from the recipes there now: `lash`, `slick`, `tacks`, `toll`, `shell`, `post`, `shutter`, `blink`, `sure`, `char` (the burst), `soot`, `crack` (Cracked glass), `dash`. `shards` and `wisp` are reused. Each keys on its event with the ability or buff id.
- **As built (B):** the runner logs each cue where its event happens, as it logs an ability's cue today (the use, a sure cut, a Char or Mark burst, Soot passed on, a shell that breaks, Cracked glass that cracks, a Gloam dash). `run-sound.js` `KIT_CUES` names the recipe there now that each one plays (`lash` the charge, `slick` and `soot` the pulse, `tacks` the cracks, `toll` the clang, `shell` and `post` the light, `shutter`, `blink` and `dash` the roll, `sure` a shard, `char` the snap, `crack` the shards), and keeps the kit's name in `kit`. None plays as a foe's tell. So no new bus event and no new recipe in `sound.js` is needed.
The gear's cues (Part C): `buckler` and `parry`, `cuff`, `sling`, `pot`, `chain`, `shade`, `swap` (a blade or off-hand taken from the ground), and `slam` (Bell maul). A bright or blazing drop rings `bright` or `blazing` as it lands. Each keys on a bus event with the item id and its tier.

## Part C: what you gain, in categories
The player asked for "different categoies like deadcells". Everything the player can gain now sits in one category, each with its own slot or rule, its own station in the hall and its own mark on the HUD and the cards.

### The categories
| Category | Slots | Gained from | Set where | Colour | Tier and traits |
|---|---|---|---|---|---|
| Blade | 1 | gear drops; the start blade | swapped on the ground; the blade rack picks the start blade | yes | yes |
| Off-hand | 1 | gear drops; the start off-hand | swapped on the ground; the off-hand stand picks the start one | yes | yes |
| Abilities | 2 | gear drops (today's ability lamps); Belt's start offer | swapped on the ground, as today; tried at the ability post | yes | yes |
| Panes | 1, up to 3 with Lantern panes | patterns kindled at the kiln | the pane window; a beacon shrine | yes | no |
| Wicks | one pick a beacon, at most 5 a run | the start pick (Wick shelf) and beacon offers | kept for the run | no | no |
| Relics | at most 5 a run | elites | taken on touch, kept for the run | by its move | no |
| Sparks | Flame, Ward and Gloam levels | spark picks, caches, First spark | in the run | they are the colours | no |
| Patterns | none (plans) | pattern lamps | kindled at the kiln, then in the drops | the item's | no |
| Lasting | wares, unlocks, keys, Ember | the Lamp-room, an elite's first fall | the hall's stations | some | no |

Refinements of the proposal:
- **A wick stays one pick a beacon**, up to 5 a run, as today (`run-save.js` keeps 5). One wick a run would take power the player has now.
- **The top tier is "blazing", not "kindled".** "Kindled" already means a pattern bought at the kiln and a relic with its wick.
- **Tiers and traits are only on the gear**: the blade, the off-hand and the two abilities. Panes, wicks and relics stay fixed picks, so a build is planned, not only rolled.
- **The ability post is the training post.** It shows the abilities and lets the player try any two. The run's start abilities stay as today (the seed, then Belt's offer).

### Colour growth
Every blade, off-hand and ability has one colour, and its numbers grow with that colour's level by `colourPower(run, colour)`, as abilities do today. The blade's colour share moves from Flame alone (`flameBonus` in `bladeBonus`) to the held blade's colour, so the Lamp blade (Flame) keeps today's numbers. All three colours give 10% power a level (`SPARK`), so no colour of blade is behind. Sparks stay the only way to raise a colour.

### Blades (`gear.js` `BLADES`)
The tempers of the first draft become blades. A blade is the main weapon: one is held, and a found one is swapped on the ground. Each has its own string, speed, reach, damage and colour. All use today's cut poses at other speeds with the blade bone scaled; no new poses are baked.

| id | Name | Colour | Pattern cost | String | Rule |
|---|---|---|---|---|---|
| lamp | Lamp blade | Flame | from the first run | 2 cuts and a finisher | today's string (`moves.js` `HITS`) |
| hook | Hook blade | Flame | 160 | 2 cuts and a finisher, 15% slower | reach +0.6 m, damage x1.1; the finisher sweeps 180 degrees and pulls light foes 1 m in; the bone 1.4 long |
| twin | Twin knives | Gloam | 160 | 4 cuts, each 25% faster | each cut at 90% damage; the 4th reuses the first cut and adds 1 Char; the bone 0.7 long |
| bell | Bell maul | Ward | 200 | 2 cuts, 30% slower | damage x1.5, poise worn twice as fast; hold Attack 0.5 s to slam: 30 in 2.5 m, with the plunge's landing pose; the bone 1.2 long and wider |

- **Blade rack** (the unlock, 150, was Temper rack) puts the Hook blade, Twin knives and Bell maul in the pattern drops. The rack stands in the hall from the first visit, with the Lamp blade on it.
- **In a run** a blade drop lies stuck in the ground with a glow in its colour. Standing on it shows the compare toast. Holding Attack 0.4 s takes it; a tap still cuts. The old blade lies where the new one was, with its tier and traits. While a blade lies underfoot, Bell maul's slam waits.
- **At the start** the run holds the blade picked at the blade rack, plain, with no traits.

### Off-hands (`gear.js` `OFFHANDS`)
The new slot: one held, with its own button and cooldown.

| id | Name | Colour | Pattern cost | Cool s | Rule | Cue |
|---|---|---|---|---|---|---|
| buckler | Buckler | Ward | from the first run | 1.2 | raised for 0.6 s; a blow in the first 0.2 s is parried: 0 damage, a light foe staggers 0.6 s, a heavy foe loses 30 poise, and the next cut is sure; a blow later in the raise deals 40% | `buckler`, `parry` |
| cuff | Iron cuff | Ward | 120 | 3 | a bash 1.5 m ahead: 6, 30 poise, light foes pushed 1.5 m | `cuff` |
| sling | Sling | Flame | 100 | 1.5 | a stone at the nearest foe ahead within 9 m: 8; a burning foe also gets 1 Char | `sling` |
| pot | Fire pot | Flame | 130 | 5 | a pot thrown 5 m ahead bursts in 1.5 m: 10 and 3 s of burn | `pot` |
| chain | Lamp chain | Gloam | 150 | 6 | a chain to the nearest foe within 7 m pulls you to it in 0.2 s, safe on the way: 6 and a Mark | `chain` |
| shade | Shade lamp | Gloam | 140 | 8 | a hooded lamp raised 0.4 s: foes in a 4 m, 60 degree cone are Blind | `shade` |

- **Input:** V or O on keys, the middle mouse button, RB on a pad, and an Off-hand touch button of at least 44 px beside the two ability buttons. RB faces the foe today; facing moves to R3, the right stick's press. If the player wants RB kept for facing, the off-hand takes R3 instead; the tests read the map from `input.js`.
- An off-hand's hit is not blade damage (Edge and Keen edge do not raise it), takes 2 steps of hit stop inside the cap, and follows the fair-fight rules. The Buckler's parry follows the fair-fight interrupts.
- A tell comes before every off-hand effect. The item shows as a small group of dabs at the left hand, drawn with the dabs `sparks.js` draws; no new pose is baked.
- **At the start** the run holds the off-hand picked at the off-hand stand, plain, or none. A new save has the Buckler picked.
- **A found off-hand** swaps as a blade does: hold Off-hand 0.4 s on it; a tap still uses the one held.

### Quality tiers (`gear.js` `TIERS`)
| Tier | Mark | Power | Traits |
|---|---|---|---|
| plain | none | x1.0 | 0 |
| bright | one pip and a gold rim | x1.25 (today's bright) | 1 |
| blazing | two pips and a double rim | x1.35 | 2 |

- Power multiplies the item's damage, heals and shell points, after its colour. It never changes a cooldown, a time or a reach.
- Today's bright ability is the bright tier. An old save's `bright: true` reads as bright with no trait.
- The marks are shapes, so a tier reads on a grey screen too.

### Drop tables by place depth (`gear.js` `DEPTH_TIERS`)
Depth is the place's index in the run's route (`depthOf`): 0 for the first place, 4 for Barrow Crown.

| Depth | plain | bright | blazing |
|---|---|---|---|
| 0 | 90 | 10 | 0 |
| 1 | 75 | 22 | 3 |
| 2 | 60 | 32 | 8 |
| 3 | 45 | 40 | 15 |
| 4 | 35 | 42 | 23 |
| 5 (an elite or cache at depth 4) | 25 | 45 | 30 |

- An elite's drop and a cache use the next row down.
- Each Keen eye level moves 4 points from plain to bright (today's `BRIGHT.perKeen`); each Ember level moves 2 points from plain to blazing. Plain never goes under 10.
- **Gear drops:** each foe put out rolls once, with a 3% chance and 1% more a Keen eye level (today's ability lamp rate), and 60% for an elite. At most 3 gear drops a place (today's `abilityMax`). The kind is ability 50, blade 25, off-hand 25 (ability 65, off-hand 35 before Blade rack). The item is one kindled item of that kind; the item held may drop again at a better tier.
- **Pattern drops** keep today's chance (`DROPS.pattern`). A pattern drop picks a kind with odds ability 40, pane 30, blade 15, off-hand 15 (45:35:0:20 before Blade rack), then one of that kind; a kind with none left passes to the next in that order. The pool grows from 13 to 37 (17 abilities, 12 panes, 3 blades, 5 off-hands).
- **Seed streams:** the kind and item from the seed's `gear` stream, the tier from `tier`, the traits from `trait`. Each has its own counter in the run, so no other draw moves. Ability lamps move from the `ability` stream to `gear`, so seeded tests that pin an ability lamp are updated.

### Traits (`gear.js` `TRAITS`)
A bright item rolls 1 trait and a blazing item 2 different ones, from those that fit its kind.

| id | Name | Fits | Rule |
|---|---|---|---|
| smoulder | Smouldering | blade, off-hand, ability | its hits burn: a blade's 2 s, an off-hand's or ability's 1 s; a burn under way is not renewed by it |
| steady | Steady | blade, off-hand, ability | 6% of its hits are sure cuts, from the seed's `sure` stream |
| glean | Gleaning | blade, off-hand, ability | a foe it puts out heals 2% of max health |
| char | Charring | blade, off-hand, ability | each 4th hit adds 1 Char |
| quick | Quick | blade, off-hand, ability | a blade's string 6% faster; an off-hand's or ability's cooldown 6% shorter |
| wide | Wide | blade, off-hand, ability | a blade's reach +0.3 m; an off-hand's or ability's radius or range +15% |
| weight | Weighted | blade, off-hand | poise worn 30% faster |
| hoard | Hoarding | blade, off-hand, ability | a foe it puts out gives 1 more glim |
| shelling | Shelling | blade, off-hand, ability | a foe it puts out gives a 6 shell for 4 s |
| dim | Dimming | blade, off-hand | each 4th hit blinds the foe 1.5 s; never the Barrow Reeve |

- Traits on two items add. Their ticks count in the 8-a-second cap, their shells in the shell cap, and Steady's chance adds to Whetstone's.
- An ability's hits are the ones it deals itself, so Smouldering on Moth swarm burns with each moth's hit.
- An item with traits reads "Hook blade, Smouldering, Wide" on the HUD label, the cards and the recap.

### Patterns for every category
A pattern is the plan of any category item that is not there from the first run: abilities, panes, blades and off-hands. Kindled at the kiln, it joins that category's gear drops, and a blade or off-hand also joins the rack or stand. Wicks still open by unlocks, relics stay in every elite's pool, and sparks are not plans.

### Gear budget
- One trait alone keeps the one-buff rule of "Balance": at most +20% damage a second or +25% effective health.
- Each off-hand held alone keeps the one-buff rule.
- Each plain blade deals within 10% of the Lamp blade's damage a second on the bot's reference string against a Snuffer.
- A bright item with its trait adds at most 40%, and a blazing item with its two traits at most 60%, to the damage a second of the same item plain.
- Node test `gloam-downs-gear.test.mjs` measures each one. The bot's pacing check (merge pass) includes the gear.

#### Measured (gear builder, on `gloam-hub-g-2`)
The test plays the string on a training post with Attack pressed as fast as it takes it, for 10 s, and an ability on its cooldown for 60 s. Char's damage is the buffs builder's: it is counted as 6.5 a stack (1 a second while the stacks climb, and the burst's 20 shared by 5 stacks). A burn here is 1 a second, a tick that never flinches and never wears poise.

| Item | Damage a second | Against the Lamp blade |
|---|---|---|
| Lamp blade | 36.5 | |
| Hook blade | 37.6 | +3% |
| Twin knives (with the fourth cut's Char) | 40.0 | +9.6% |
| Bell maul | 38.4 | +5% |

Worst cases: one trait alone +11.4%; bright with a trait +38.6%; blazing with two traits +56.2% (blades), +47.5% (abilities). Off-hands beside the string: Sling +13.2%, Fire pot +6.8%, Lamp chain +3.3%, Iron cuff +2.2%, Buckler and Shade lamp 0 (they guard and blind).

Numbers moved to fit the budget, from the first draft:
- Twin knives: each cut 90% (was 65%, which dealt 25.9 a second, 29% under the Lamp blade).
- Bell maul: damage x1.5 (was x1.6, 12% over).
- Blazing: x1.35 (was x1.4). Quick: 6% faster and 6% shorter (was 8% and 10%). Charring: each 4th hit (was each 3rd). Smouldering: an off-hand's or ability's hit burns 1 s, and a burn under way is not renewed by the same trait (a moth's many hits passed +20% alone).
- Left for the merge pass: the Moth wisp deals 5 a hit, which rounds to 7 at blazing (x1.35 is 6.75), +40% before any trait; with two traits it passes +60%. Its hit (growth.js, the buffs builder's) could rise to 6 with a slower beat, or the pairs on it could be capped.

### The HUD by category (`hud-gear.js`, `gear.css`)
- **The gear row** (`#gear`, in the HUD, in place of `#abilities`): four slot tiles in order, Blade, Off-hand, Ability 1, Ability 2; then one small tile for each open pane slot; then the wick count. The relic row stays as it is.
- **Each tile** shows the category glyph (a blade, a round shield, a lamp flame, a leaded square, a wick), the colour edge (a 3 px rim in the colour's hue, and the colour's shape in a corner: Flame a triangle, Ward a square, Gloam a diamond), and the tier mark (none, one pip, two pips). The off-hand and ability tiles show the cooldown as a dark sweep and the seconds left. An empty slot is a dashed outline with its glyph.
- **The label** names every slot for a screen reader: "Blade: Hook blade, bright, Smouldering. Off-hand: Buckler, plain. Ability 1: ...". It changes on a swap, and at most once a second.
- **Layouts:** at 1280x720 and 800x600 the gear row sits at the bottom left, tiles 40 px, pane tiles 24 px. At 390x844, 360x640 and 320x640 it sits under the life row in one line of at most 300 px, tiles 32 px, pane tiles 20 px. At 844x390 it sits under the life row, tiles 28 px. It never covers the Lab bar, the boss bar, the stick or a touch button.
- The tiles are not buttons. The touch buttons Off-hand, Ability 1 and Ability 2 show the same glyph, colour edge and tier mark, at 44 px or more.
- **The pause card** gains a Gear list: each category with its items, tier, traits and main numbers, reachable with keys and a pad.

### The cards by category
- Every choice card (`cards.js` `lcard`) and every station row starts with the category glyph and word (Blade, Off-hand, Ability, Pane, Wick, Relic, Spark, Ware, Unlock, Key), has the colour edge, the tier mark when it has a tier, and one line a trait: "+ Smouldering: its hits burn 2 s".
- **The compare toast** (`#compare`): on a ground blade, off-hand or ability lamp, it shows the held item over the found one, each with its tier, traits and main number, and how to swap: "Hold Attack to swap", "Hold Off-hand to swap", "Press an ability to swap". At 320x640 it is two lines with no numbers. It never covers the touch buttons.
- **The quick list** (the restyled `#lamp`) groups its rows under headings in this order: Blades, Off-hands, Abilities, Panes, Patterns, Wares, Unlocks, Keys, Ember.
- **The well's recap** lists the run's last gear by category, with tiers and traits.

### Hall stations by category
| Station | Category | Its card |
|---|---|---|
| Blade rack | Blade | the kindled blades with their strings and numbers; Pick sets the start blade |
| Off-hand stand | Off-hand | the kindled off-hands and None; Pick sets the start one |
| Ability post | Abilities | the kindled abilities by colour; put any two in the slots to try at the post, in the hall only |
| Pane window | Panes | set panes in the open slots |
| Kiln | Patterns | kindle a found pattern of any category |
| Wick rack | Unlocks | the unlocks, Blade rack and Wick crate among them |
| Lamp shelf | Wares | the lasting wares |
| Trophy wall | Keys | the keys and elites put out |

The ability post is the training post with a rack of ability lamps. Attack, Roll, the off-hand and both abilities work at it, with cooldowns at a quarter of their length.

### Save fields (`run-save.js`, v4)
- **Lasting:** `blade` (the start blade id, kindled, default `lamp`); `offhand` (the start off-hand id, kindled, or null; `buckler` on a new save); blade and off-hand ids in `kindled` and `patterns`. `lamp` and `buckler` are starters.
- **In a run:** `blade: { id, tier, traits }`; `offhand: { id, tier, traits }` or null; `abilities: [{ id, tier, traits } or null, the same]`, in place of `bright`; `abilityLamps` gain `tier` and `traits`; `gearLamps: [{ kind, id, tier, traits, place, x, y, z }]`, at most 6, in this place; `offCool`; and the counters `gearRolls`, `tierRolls` and `traitRolls`. The entry keeps copies, as it does for the abilities.
- **The recap:** `ended` gains `gear`: the run's last blade, off-hand and abilities with tiers and traits.
- **`clean()`:** an unknown tier is plain; traits are known, different, fit the kind, and at most the tier's count; an unknown blade is the Lamp blade, plain; an unknown off-hand is none.
- **A v3 save** becomes v4 with its numbers kept: the Lamp blade picked, the Buckler kindled and picked, a run in progress holding the Lamp blade plain and no off-hand, and each `bright: true` as the bright tier with no trait.

## Tests
| Test | Covers |
|---|---|
| `node games/gloam-downs/bake.mjs lamproom --check` | the hub bake, its budget and its checks |
| `qa/lab/gloam-downs-hub.test.mjs` | stations, growth ranges by the save, station rows by category, the shrine, the quick list's headings, the budget numbers |
| `qa/lab/gloam-downs-hub.e2e.mjs` | walk to each station, open its card with keys, pad, mouse and touch, buy and see the hall change, pick a start blade and off-hand, begin the run at the door, the phone load |
| `qa/lab/gloam-downs-hub-layout.e2e.mjs` | station cards and the quick list at 320x640, 390x844, 360x640, 844x390, 800x600 and 1280x720, reduced motion |
| `qa/lab/gloam-downs-life.test.mjs` and `node qa/lab/gloam-downs-music-demo.mjs beds` | the hall's life and bed |
| `qa/lab/gloam-downs-states.test.mjs` | Char, Soot, Blind, Mark, ticks that never interrupt, the tick cap |
| `qa/lab/gloam-downs-kit.test.mjs` | each new ability, pane, wick, relic, ware, unlock, the key, sets, sure cuts, the shell, the power budget |
| `qa/lab/gloam-downs-run.kit.e2e.mjs` | each new ability's tell and effect in a place, Gloam dash |
| `qa/lab/gloam-downs-gear.test.mjs` | the blades' strings, each off-hand, tiers, the depth tables, traits, the gear and pattern kind odds, the seed streams, colour growth, the save fields and the v3 to v4 move, the gear budget |
| `qa/lab/gloam-downs-run.gear.e2e.mjs` | a blade and an off-hand swapped on the ground with keys, a pad, a mouse and touch, the Buckler's parry, the Twin string, the Bell slam, the compare toast |
| `qa/lab/gloam-downs-gear-hud.e2e.mjs` | the gear row, the touch buttons' marks, the compare toast and the cards by category at the six layouts, on a grey screen, and the screen reader label; screenshots under `SHOTS` |
| `qa/lab/gloam-downs-sound.test.mjs` | the new cues, the gear's among them |
| `qa/lab/gloam-downs-bot.mjs` | pacing after all three builders, with the gear |

## Who builds what
Three builders in parallel worktrees, after the fair-fight change merges into the work branch. All three start from one commit that adds the new tables (task 0.1). Each runs its own checks before it hands over. The merge pass runs every check. A builder may import and call another builder's exports, and stubs them until that builder lands; it writes another builder's file only with the hook lines below.

### Hub builder (H)
Owns: `games/gloam-downs/biomes/lamproom.mjs`, the `hub` set in `bake.mjs` and `lib/check.mjs`, `public/lab/gloam-downs/worlds/lamproom.*`, `hub.js` (new), `places.js`, `save.js`, `cards.js`, `input.js`, `index.html`, `screens.js`, `main.js`, `life.js`, `beds.js`, `qa/lab/gloam-downs-hub*.mjs`. Reads the tables in `growth.js`, `run.js` and `gear.js`, never writes them. Also builds every input: Use, the quick list, and the Off-hand input (`input.off`: V or O, the middle mouse button, RB, facing moved to R3, and the touch button `#bOff`).

### Buffs builder (B)
Owns: `growth.js` (after 0.1), `run.js`, `status.js`, `abilities.js`, `relics.js`, `keys.js`, `build.js` (new), `foes.js`, `fight.js`, `sparks.js`, `moves.js`, `run-sound.js`, `qa/lab/gloam-downs-bot.mjs`, `qa/lab/gloam-downs-states.test.mjs`, `gloam-downs-kit.test.mjs`, `gloam-downs-run.kit.e2e.mjs`. Exports for G: `markSure(R)` and `addShell(R, n, steps, from)` in `build.js`; `statusHit` in `status.js` takes `char`, `soot`, `blind` and `mark`.

### Gear builder (G)
Owns: `gear.js` (after 0.1: `BLADES`, `OFFHANDS`, `TIERS`, `DEPTH_TIERS`, `TRAITS`, `rollGear`, `tierPower`, `traitCool`, `traitWide`, `bladeHit`, `bladeHold`, `patternKind`, `startGear`, `chooseBlade`, `chooseOffhand`, `cleanGear`), `gear-play.js` (new: `makeGear(R)`, the held blade and off-hand, the off-hand moves and tells, gear drops and the swap, traits on hits, the compare toast's data, `R.gear.view()`), `hud-gear.js` (new: `gearRow`, `gearMark`, `compareToast`), `gear.css` (new), `run-save.js` (v4), and the tests `gloam-downs-gear.test.mjs`, `gloam-downs-run.gear.e2e.mjs` and `gloam-downs-gear-hud.e2e.mjs`. The off-hand's cues go in `run-sound.js` through B's hook rule: one handler a cue.

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
<!-- index.html, inside the health bar (B also adds one style rule beside .hpbar for its pale band, .hud .hpbar i.shell) -->
<i id="shell" class="shell" aria-hidden="true"></i>
```
- `input.js`: none. Gloam dash reads Roll in the air in `moves.js`.

G may add only these lines to H's files, at the place named:
```js
// main.js, with the imports
import { gearRow, compareToast } from './hud-gear.js';
// main.js, in the HUD update, in place of the line that fills #abilities
gearRow($('gear'), R);
// main.js, where the growth toasts are shown
compareToast($('compare'), R);
```
```html
<!-- index.html, in the head, after the page's own style -->
<link rel="stylesheet" href="./gear.css">
<!-- index.html, inside #hud, in place of #abilities -->
<div class="gear" id="gear" role="img" aria-label="Gear"></div>
<!-- index.html, after #hud -->
<div class="compare" id="compare" hidden aria-live="polite"></div>
```

G may add only these lines to B's files, at the place named:
```js
// run.js, with the imports
import { makeGear } from './gear-play.js';
import { startGear, patternKind } from './gear.js';
// run.js, startRun, on the line after the run object is made
Object.assign(run, startGear(rs));
// run.js, makeRunner, on the line after R.abilities is made
R.gear = makeGear(R);
// run.js, makeRunner's step, on the line after R.abilities?.step(a, camYaw, ev)
R.gear.step(a, ev);
// run.js, bladeBonus: a colour argument in place of Flame alone
export const bladeBonus = (up, wicks, sparks = null, colour = 'flame') => PACE.blade - 1 + 0.12 * (up.edge || 0) + (has(wicks, 'keen') ? 0.15 : 0) + SPARK[colour].power * levelGain(sparks?.[colour] | 0);
// run.js, in stats() and in R.bonus, the fourth argument of bladeBonus
R.gear?.colour()
// run.js, in stats(), the held blade
blade: R.gear?.blade(),
// run.js, drawPattern, before an id is picked: the kind first
const kind = patternKind(rs, r);
```
```js
// moves.js, with the imports
import { bladeHit, bladeHold } from './gear.js';
// moves.js, makeFighter, where a cut of the string starts: the held blade's row, or today's
const hit = bladeHit(stats().blade, i) || hitOf(i);
// moves.js, makeFighter, where a held Attack is read
if (bladeHold(stats().blade, held, f)) return;
```
```js
// abilities.js, with the imports
import { tierPower, traitCool, traitWide, rollGear } from './gear.js';
// abilities.js, powerOf, in place of (slot.bright ? BRIGHT.power : 1)
tierPower(slot)
// abilities.js, coolOf, a factor at the end
* traitCool(slot)
// abilities.js, where an effect's radius or range is read
* traitWide(slot)
// abilities.js, drawAbility, in place of bright: r() < brightChance(rs)
...rollGear(rs, 'ability')
```
What the gear builder added beyond the lines above, and why (each is one line or a small block at the place named):
- `run.js`: `GROWN` takes `...GEAR_GROWN` (a reload restores the held gear and its draw counters as they were at the entry); `goTo` clears `gearLamps` and `gearDrops`; `pend` and the press list take `off`; `hurt` asks `R.gear.block` (the Buckler) after the Ember parry; `foeOut` asks `R.gear.foeOut` in place of the ability lamp roll (gear drops took its place), and an elite's fall rolls at 60%; `stats()` also gives `underfoot`; `startAbilities` and `chooseStartAbility` make `{ id, tier, traits }`; `patternOf` and `groundPatterns` know the blade and off-hand patterns; `recapFields` adds `gear`.
- `moves.js`: `hitOf` becomes `hitAt` inside the fighter (the held blade's row, or today's), `nextAfter` asks `bladeNext` (the Twin knives' 4 cuts, the Bell maul's 2), a held Attack is no press when `bladeHold(st)` (the Bell maul's slam, a blade underfoot), and the fighter has `land()` for the slam's pose. The design's two lines could not carry a string of 4 or 2.
- `abilities.js`: `coolOf(rs, id, slot)` takes the slot for Quick; Wide widens a copy of the ability's row; the swaps and the lamps copy `{ id, tier, traits }` (`gearCopy`); a cache's lamp rolls its tier on the next row down; the view gives `tier` and `traits`.
- `main.js`: the gear row also replaces the line that set `#abilities`' text and label (the touch buttons stay); `bossScreen.rects` reads `#gear`; `groundAbilities` for the fight adds `groundGear` (a found blade or off-hand glows as an ability lamp does); `__gloam.set` keeps tiers and traits; `__gloam.gear` (`gearTest`) is the test hook.
- `bus.js`: `EVENTS` gains `gear-cue`; `run-sound.js` has one handler for it, which plays each gear cue with a recipe there now (`GEAR_CUES` in `gear-play.js`: the Buckler whiff, the parry clang, the cuff snap, the sling whiff, the pot coal, the chain charge, the shade light, the swap choice, a bright drop glim and a blazing drop light; the slam has its own recipe).
- The merge pass replaced the gear builder's stubs: `gear-play.js` imports `markSure` and `addShell` from `build.js` (a parry readies the build's sure cut, so it is one rule with Shutter's), and `putState` is `status.js` `statusHit` (Char's burst now gives its hit and cue).
- Not done by the gear builder: the blade bone scaled for each blade (the pose code in `play.js` and the figure), the pause card's Gear list, and the off-hand's inputs (`input.off`, the hub builder's).

B may add one line to G's `run-save.js`, in `cleanRun`: `cracked: intIn(r.cracked, 0, 3, 0),` (Cracked glass's hits taken in the place).

H reads the tables and calls these functions, with no line in B's or G's files:
- `hub.js` reads `ABILITIES`, `PANES`, `LAMP_KEYS` and `PATTERNS` from `growth.js`, `UPGRADES` and `UNLOCKS` from `run.js`, and `BLADES` and `OFFHANDS` from `gear.js`. New rows show up at their stations with no hook.
- `hub.js`, at the blade rack: `pick: id => chooseBlade(rs, id),` and at the off-hand stand: `pick: id => chooseOffhand(rs, id),` from `gear.js`.
- `screens.js`, in every row maker: `gearMark(item)` from `hud-gear.js` gives the glyph, the colour edge and the tier mark.
- The merge pass replaced H's stubs: `hub.js` re-exports `chooseBlade` and `chooseOffhand` from `gear.js`, and reads the start picks from `startGear`. `hub.js` `gearMark` stays as the row's mark data (the word, the shape and the pips); `cards.js` `markHtml` draws its glyph with `hud-gear.js` `gearMark`, the same glyph as the HUD's gear row.

Lines in files no builder owns:
- `foes.js` (B, after the fair-fight merge), one line at each of three places:
```js
// in the foe step, before its mind runs
statusTick(f, ctx);
// where a foe is put out
statusOut(f, ctx.foes);
// where a foe starts an attack
if (blindMiss(f)) attack.miss = true;
```
- `run-sound.js` (B): one handler a new cue, keyed on its bus event; G's cues the same way.

### The merge pass
Merge H, then B, then G. Run every check in "Tests", the Gloam Downs checks in AGENTS.md, and the bot's pacing. Update this file with the measured numbers.
