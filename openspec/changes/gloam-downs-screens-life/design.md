# Design: Gloam Downs, screens with life, and places that live

## The request
The player asked: "make tbe selection screen more engaging perhaps and enviromwnt itself". Read as two asks: the screens where the player chooses (the start, the beacon's picks, the Lamp-room, and the end of a run) should feel alive and tied to the world; and the five places should move and answer the lamplighter. This design fits the code on `720edbba`.

## What is dull today
Screenshots taken on `720edbba` with `?run&test&fresh&seed=7`, at 390x844 (touch) and 1280x720 (mouse), in the session's scratchpad folder `screens-life/` (start, play, beacon, beacon-sparks, lamp, pause, summary).

1. **The first load** (`start-*`) is the help card: a title in the body font's serif, a paragraph, five or seven bullets and two buttons. The panel veil (`.panel`, `rgba(2, 2, 6, 0.6)`) dims the whole place. At 390x844 the card covers the middle 60% and the world above it is near black. Nothing moves. Its text says the run starts with "two flasks", but since the pacing pass a run starts with one (gloam-downs-growth, "Pacing results").
2. **A later load** with no run opens straight on the Lamp-room (`screens.js` `cardOnLoad`): the first thing a returning player sees is a list.
3. **The beacon card** (`beacon-*`) sits in the middle of the screen, which is where the follow camera puts the beacon, so the moment the beacon catches is hidden under the card. The wicks are two full-width text buttons. The spark pick is three rows told apart only by a 3 px stripe of colour.
4. **The Lamp-room** (`lamp-*`) is nine rows of the same shape (name, gift, cost, a row of dots, Buy), then patterns, unlocks, panes and Ember. It covers the place completely. A buy changes the text and plays `buy`, and nothing else happens.
5. **The summary** (`summary-*`) is five lines over the fade to ink. It does not show the path, what was found, or what put the lamp out. The win card is the same shape.
6. **The places.** Decoding the baked splat files (kind in field 11 of each row): of about 240,000 splats a place, the moving ones are 45 to 98 rising embers (kind 3), 150 to 341 bobbing motes (kind 6) and 15 to 44 glowing splats (kind 7). Everything else is still: grass, rags, banners, lamps. No bird, moth or leaf moves, and nothing answers the lamplighter.

## Sources
Web search worked; page fetches did not (`blog.unity.com` and `developer.nvidia.com` do not resolve in this session's network). So each source says whether its search extract was read on 2026-11-25, or whether it is from memory.

### Pick screens
- **Hades** (Supergiant Games, 2020). Search extracts read (a Game UI Database based breakdown on `saschb2b.github.io/game-mechanics/games/hades/boons-and-gods`; Nat Rowley, "How Hades Creates a Responsive Underworld", medium.com; `benjaminglover.substack.com`): the boon pick is one of three with rarity shown by colour, and each menu is themed to what it shows, with care for its animation and sound. From memory: each boon is a framed card with the god's colour, the cards slide in one after another, a hover brightens the frame, and a pick plays the god's own sound. We took: one card per choice, colour as light, a staggered deal-in, a brighter frame on hover, a sound on the pick.
- **Slay the Spire** (Mega Crit, 2019). Search extracts read (`slay-the-spire.fandom.com/wiki/Card_Rewards`): a reward is one of three cards, or a skip, with the rarity by the encounter. From memory: the hovered card grows so its text is easy to read, and the rarity shows on the card's frame. We took: a lift on hover and focus, and rarity (a bright ability) shown by the frame's light, not by more text.
- **Inscryption** (Daniel Mullins Games, 2021). Search extracts read (Edge via pressreader.com; `archania.org`; GameSpot review): the game has almost no usual interface; things on the table (candles, scales) carry the state. We took: the Lamp-room as a room of lamps on shelves, where a ware's level is the height of its light, and the panes as windows.
- **Darkest Dungeon** (Red Hook, 2016). From memory (the search returned nothing on its hamlet): the hamlet is a painted town where each building is a place to spend, and the torch level is shown as light. We took: the Lamp-room as a place, and light as the measure.
- **Dead Cells** (Motion Twin, 2018). From memory: the Collector's shop shows each blueprint with its cost and a short flash when a buy goes through, and the cells count down. We took: the number roll on a buy.
- **Martin Jonasson and Petri Purho, "Juice It or Lose It"**, GDC Europe 2012. Search extracts read (`gdcvault.com/play/1016789`, `gamedeveloper.com`, `roblog.co.uk`): a plain game made lively by layers of motion, sound and response, with no new rules. Lisa Brown, "The Nuance of Juice" (2016), search extract read: juice should serve the moment it marks. We took: small, quick, layered responses (lift, glow, sound, flare) only where the player acts, and none that slow a pick.

### Ambient life
- **NVIDIA GPU Gems, chapter 7, "Rendering Countless Blades of Waving Grass"**, and **GPU Gems 3, chapter 6 (Zioma), "GPU-Generated Procedural Wind Animations for Trees"**, and chapter 16 (Sousa, Crytek's vegetation). Search extracts read (`developer.nvidia.com/gpugems/...`): wind moves only the upper vertices; the bend grows with height above the foot; the CPU can set a wind value per cluster and the shader does the rest. We took: a tuft sways from its foot by its height (the splat shader's kind 14 already does exactly this), and a gust is one CPU value per tuft block.
- **Knowles, "Increasing realism of animated grass in real time game environments"**, SIGGRAPH 2015 poster. Search extract read (`history.siggraph.org`): directional wind and ambient wind are separate; displacement fades in up the blade. We took: a steady ambient sway on the GPU, and a gust as a separate, rarer push from the CPU.
- **TUNIC** (Andrew Shouldice, 2022). Search extracts read (Unity blog "Smoke, mirrors and scrolling textures"; `gamedeveloper.com` IGF interview): lighting came first; detail was added slowly, and too much detail lost the low-resolution appeal. We took: life in small numbers of small dabs, so the painted, low-resolution look stays.
- **Death's Door** (Acid Nerve, 2021). Search extracts read (`blog.unity.com` environments post title; `byteside.com`; a review): naturally lit areas where fire and spells light dark rooms make the look. From memory: crows, dust and moths gather at the lamps. We took: life gathers where the light is.
- **Mobile particle budgets.** Search extracts read (`gamedev.net` "512 portable particle vfx in threejs"; `webglfundamentals.org` particle Q&A; `cznull.com/tests/particle`): on phones, overdraw of large see-through sprites is the first limit, not the count; small dabs that overlap little are cheap; step the count up while measuring. We took: small dabs only, no large mist sheets, a fixed cap, and a measured frame-time check rather than a guessed count.
- **Ink Studio's own splat shader** (`public/lab/gloam-downs/ink/webgl/shaders.mjs`, read in this repo): per-splat motion kinds driven by `u_time` and each splat's own phase, speed and range: 1 twinkle, 2 fall, 3 rise, 6 bob, 7 glow, 8 flap about a pivot, 11 wander, 14 sway from the foot, 15 flutter down. This is the technique we use. No outside shader was adapted.

## Part S: the selection screens

### Shared look
- **The veil.** `.panel`'s flat veil gives way to a vignette per card: the title and the beacon card keep a clear window on the world (the veil at 0.15 in the window, rising to 0.7 at the edges); the Lamp-room and the summary keep 0.6. A card's box gets a warm inner glow on its top edge and a 1 px gilt rule, in the existing tokens (`--ember`, `--bone`, `#5a3424`).
- **Where a card sits.** On a portrait phone (width under 520 px and taller than wide) the beacon card is a bottom sheet: its top edge at most at 58% of the height, so the beacon shows above it. On a wide or landscape screen it sits at the right, at most 46% of the width. The other cards stay centred.
- **Lamp cards.** A choice (a wick, a spark, a start ability) is a card: a glass at the left or top (a CSS radial gradient and a small flame of two stacked shapes, no image file), the name in the title font, the gift in one or two lines. The glass's colour: wicks amber (`--ember`), Flame `#e08a3c`, Ward `#7fd1a0`, Gloam `#a58cff` (the hues `COLOURS` already uses for the HUD). A bright ability gets a gold rim and a stronger glow. Rarity and colour are shown by light, and also in words for screen readers (`aria-label`).
- **Motion** (CSS transitions and the Web Animations API; nothing on a timer that runs while the card is idle):
  - Deal-in: when a set of choices shows, each card fades in and rises 12 px over 220 ms, 70 ms after the one before.
  - Hover and focus: the card rises 4 px over 120 ms, its glow goes from 40% to 100%, the flame grows 15%. Keyboard and pad focus look the same as a hover.
  - Pick: the chosen card flares (its glow to 140% and back, 240 ms) and the others fade to 30% over 160 ms; the next step deals in 200 ms later. A pick is not delayed for input: the choice is made on the press, and the motion only follows it.
  - Reduced motion (`prefers-reduced-motion: reduce`, the `still` flag main.js already reads): no rise, no scale, no drift, no flare. Fades only, 150 ms or less. The glow change on focus stays, because it is not motion.
- **Sound** (new cues in `sound.js` `CUES` and its recipes; levels under `choice`):
  - `hover`: a soft glass tick in the place's key, on hover or focus of a choice. It replaces `focus` inside choice cards. At most one each 60 ms.
  - `reveal`: a quiet shimmer when a set of choices deals in, once per set.
  - `pick`: a lamp catching (a breath of noise and a low bell in the key) on a wick, spark or ability pick. `choice` stays for the plain buttons.
  - `kindle`: a longer catch for a kindle, with a rising fifth.
  - `tally`: a tick for the number roll, at most 12 a roll.
  - The audio context still starts on the first press (`soundPress()`), so the title's hovers before the first press are silent. That is the browser's rule.

### The title screen
- `screens.js` `cardOnLoad` returns `'title'` where it returned `'help'` or `'lamp'`. The summary, the win card and the beacon card on a load do not change.
- `#title` (new, in `index.html`): the title "Gloam Downs" in the title font at 44 px (34 px under 360 px wide), filled with a warm gradient (`#f2d7a6` to `#e08a3c`) and a soft glow, over a brush rule drawn as one inline SVG path. Under it, the place line of the place that is loaded.
- **The places as lamps.** A path of five lamps, I to V, as one row of buttons on a drawn path (inline SVG behind them). In a run they show the route and how far the player has come: a lamp is lit for each place the player has ever reached in a run (`rs.furthest`, new, the highest index reached), dim for the rest. Under the pointer or the focus a lamp lights fully and the line under the path shows its name and subtitle ("II · The Crow Wall. A broken wall rides the downs as the storm light dies"). In a run the lamps do not start a place (a run always starts in the Gaol); a press on one shows its line. In the explorer they are the place buttons, and a press goes there (the old `#places` list moves into this row; the Gilt Lattice lamps follow, in their own group).
- **The seed and Ember line**: "Seed 000007 · Ember 0". With Ember 1 or more open, ◀ and ▶ buttons (44 px) beside it change the level, as the Lamp-room's Ember row does.
- **Buttons**: Begin the run (main, with the focus), Lamp-room, How to play, Explore. On a first visit (`!rs.seen`), Begin the run opens the help card first, whose own Begin starts the run, as today. After that Begin the run starts at once. In the explorer: Walk and Fight.
- **The drift.** `menu-scene.js` (new) gives `titleView(base, t, still)`: the view of the start camera (the follow view at the spawn, as now) with its yaw moved by 9° × sin(2πt / 48 s) and its distance by 4% × sin(2πt / 61 s). main.js passes it as `draw({ view })` while the title shows. `play.js` is not touched. With reduced motion the view is the start camera's, still. The draw goes on each frame under the title so the place's own life moves.

### The beacon card
- Opens as now on a lit beacon (the camera is already at the beacon). The card's choices are lamp cards: two wicks, then the three sparks, then Belt's ability (as `startPicks`). Spend glim and Walk on stay plain buttons.
- On the pick, main.js emits `screen-pick` on the bus with `{ kind: 'wick' | 'spark' | 'ability', colour }` (colour: `'wick'`, `'flame'`, `'ward'`, `'gloam'`). On hover and focus it emits `screen-hover` with the same fields, at most once each 150 ms. Builder E's life makes the beacon answer (Part E, "The world answers the screens"). If life is off, nothing breaks.
- The beacon's own text lines (kept, banked, the warning in numbers) stay, under the choices.

### The Lamp-room
- **Shelves.** The card gets three headed shelves: Wares (the lasting wares, `UPGRADES`), Patterns (found, to kindle), and Panes; then Unlocks and Ember as today. The top line keeps the glim carried and banked and the run's colours.
- **A ware is a lamp tile**: a glass whose light fills from the bottom by level / levels (0 levels a cold glass; all levels a full flame), the name and level ("Mantle 2 of 8"), the next gift and its cost, and Buy. Tiles are in a grid: 2 columns under 520 px, 3 up to 900 px, 4 above. Each tile's Buy is 44 px or more on its shorter side. The row of dots goes; the glass shows the level, and the text says it.
- **A pattern is an unlit lamp** with its colour's hue at 25%, its name, gift and cost, and Kindle.
- **A buy**: the tile's glass rises to its new level over 300 ms, a flash (a white-gold radial burst on the tile, 180 ms), `buy`, and the glim line rolls from the old to the new count over 400 ms with `tally` ticks. **A kindle**: the lamp catches (its flame grows from nothing over 400 ms), `kindle`, and the tile moves to its colour. With reduced motion the numbers change at once and the flash is a 150 ms fade.
- The focus stays where it is after a buy, as now (main.js keeps the next Buy).

### The summary and the win card
- **The recap** (`screens.js` `recapOf(ended)`, new; replaces the use of `summaryOf` in main.js, which stays for old saves):
  - The path: the run's route as five lamps. Each place passed is lit, with its time and foes under it. The place where the run ended is a snuffed lamp (a death) or a bright one (a win).
  - The rows: Foes put out; Glim kept and lost; Patterns kept, by name; Sparks, as "Flame 2 · Ward 1 · Gloam 0" in their hues; Best combo; and on a death "Put out by a Snuffer" (or Pitchrook, Mirelight, Ironback, an elite's name, the Barrow Reeve, or a fall).
  - New fields in `rs.ended` from `run.js` `die` and `win`: `path` (`[{ id, time, foes }]`, one a place reached), `colours` (`{ flame, ward, gloam }`), `kept` names (`patternNames`), and `by` (the type code of the last hit taken, or `'fall'`). `run-save.js` `clean()` checks each; a save without them shows the old rows.
- **Motion**: the lamps light one after another, 180 ms apart, then the rows fade in and their numbers count up over 600 ms with `tally`. The main button has the focus from the start and works at once; a press during the motion ends it. Reduced motion: all at once, one 150 ms fade.
- The win card is the same recap with all five lamps lit and the gold of the win.

### Inputs and layouts
- Keys: arrows and Tab move the focus, Enter or Space presses. On lamp cards and the title's lamps, left and right move along a row and up and down between rows (`cards.js` `move` gains a grid move: the nearest button in that direction by its centre).
- Pad: the d-pad and the left stick move the same way, A presses, B goes back where a card has a back action. Start and Back cannot pass the wicks, as now.
- Touch: a tap picks. There is no hover; the focus style shows on `pointerdown`.
- Layouts: 320x640, 360x640, 390x844, 844x390, 800x600 and 1280x720. Every card inside the screen with no page scroll (the Lamp-room scrolls inside itself, as now), every button 44 px or more on its shorter side, nothing under ◀ Lab or Games.
- Readable: text at 14 px or more; the contrast of each text colour on its card is 4.5:1 or more (checked in the e2e from computed styles).

## Part E: places that live

### How it is drawn
- `life.js` (new) builds a block of life splats per place at load and draws them each frame. Each splat is a row of `world.data` like the baked ones, with a motion kind the splat shader already has, so the GPU moves it with no new uniform and no shader change:

| Life | Kind | Range and speed |
|---|---|---|
| Embers rising from lamps and fires | 3 rise | 1.2 to 2.4 m, 0.25 to 0.5 m/s |
| Motes drifting | 6 bob, and 11 wander | 0.05 to 0.15 m |
| Moths at lamps | 11 wander | 0.12 to 0.25 m about a point 0.4 m from the flame |
| Leaves, ash, petals falling | 15 flutter down (up to 1.5 m), 2 fall (longer) | 0.2 to 0.6 m/s, sway 0.15 to 0.3 m |
| Grass tufts and rags | 14 sway from the foot | 0.04 to 0.1 a metre of height |
| Lamp and candle flicker | 1 twinkle | 1.5 to 3 Hz |
| Mist bands | 11 wander, low and slow | 0.3 m, 0.1 rad/s |
| Crows perched | 0 still, 8 flap for the wings in flight | flown by the CPU |

- **Where it goes**, found at load from the place's own data (no rebake, no hand table of points):
  - Lamp anchors: clusters (0.6 m) of the baked rising embers (kind 3) and glow splats (kind 7). Each place has 6 or more.
  - Grass and ground: floor cells of the walk map with slope under 0.3 and no roof, within 26 m of the start or the route; a tuft takes the colour of the nearest baked splat there.
  - The route, as the page knows it: the spawn, the zone centres (`meta.zones[].c`) and the beacon, joined in order of their distance from the spawn. (`ROUTES` in `games/gloam-downs/lib/zones.mjs` is bake-side and not in the page.)
  - Perches: walk-map tops 1.5 m or more over the floor beside them (walls, roofs, stones), within 6 m of that route.
  - Hollows for mist: floor cells lower than the mean of the cells 4 m round them by 0.5 m or more.
  - The seed is the place's `meta.seed`, so the same place gets the same life.
- **Where it lives in the data.** `makeLife` grows `world.data` and `world.count` by its block right after main.js reads `placeCount`, before the pool is made. So `makePool` copies it with the place, and the veils, the cut and the occluders (which use `placeCount`) never touch it. Life reads `world.data` afresh on each write (the pool replaces the array), as `sparks.js` does. Its sort-moving splats (kinds 2 and 3) are added to `world.moving`.
- **CPU work each frame** (`life.draw(view, t, lamplighter, foes)`): only the reactive parts write rows: a crow flock in flight, a lamp brightening, a gust, the hush. Steady state writes no row. A write marks its 512-splat rows in main.js's `pendingRows`.

### Per place
Every colour is a slot of the place's own palette, or a shared slot under 34, or the lamp slots 46 and 47 near a lamp only. The page has the palette's colours (`meta.pal`) but not the biome's ramp names, so `LIFE` in `life.js` lists, per place, the slot index of each use, read off the biome's palette order (`games/gloam-downs/biomes/<id>.mjs`). The life test checks each slot's colour in the baked JSON against the biome's colour of that name.

| Place | Mood | Life |
|---|---|---|
| The Sunken Gaol | moor at night, the keep on the hill | moths at the cell lamps (the lamp's pale 47), embers off the braziers (33), drips of mist in the cells' hollows (`fog`), moor-grass tufts (`moss`), two crow flocks on the keep wall (`ink`) |
| The Crow Wall | storm light dying on chalk | rags on the wall that sway (`rag`), chalk dust that drifts (`chalk`), torn leaves blown along the wall (`grass`), three crow flocks on the wall, more than any place, as its name says (`ink`) |
| Lantern Fen | black water, stilt huts | fireflies over the water (`lantern`'s low step, twinkle; never fire), mist bands over the water (`fog`), reed tufts (`moss`), moths at the hut lanterns, one flock of rooks on the mill |
| The Bell Knoll | blood-red dusk, bronze | falling verdigris flakes and rust leaves (`verd`, `rust`), dust motes in the red light (`lit`'s low step), grass tufts (`grass`), rooks on the cogs |
| Barrow Crown | mounds of the dead, ghost light | pale motes over the mounds (`ghost`, wander), ash falling (`earth`'s light step), rags on the stones (`rag`), moths at the grave candles, one crow flock on the keep |

### Reactive life
- **Crows take off.** A flock is 3 to 5 birds of about 12 dark dabs each. When the lamplighter comes within 5 m (or a foe within 3 m, or a hit lands within 6 m), the flock lifts: each bird flies away from the lamplighter and up, on a curve, over 2.5 s, its wings on kind 8; then it is put away (density 0). It comes back to its perch when the place is entered again. Life emits `life-stir` `{ kind: 'crows', x, y, z, n }` on the bus.
- **Lamps answer the lamplighter.** Each anchor has a halo of 4 dabs in the lamp slots. Within 4 m the halo grows from 0.04 to 0.07 m and its pale dab moves from 46 to 47 over 0.4 s, and back over 1 s after.
- **Gusts.** Every 9 to 20 s (the seed's stream) a gust of 2 s: the tufts' sway range doubles, then eases back, and 6 to 12 leaves (or flakes, or ash) shed. One row write per frame while it lasts. Life emits `life-stir` `{ kind: 'gust', k }` at its start.
- **The hush.** Within 8 m of an awake foe, life's bright dabs (embers, fireflies, motes, halos) fade to 0 over 0.3 s and come back 2 s after the fight there is calm. So nothing ambient shines near a tell.
- **Reduced motion**: kinds 3, 11, 15, 2 and 8 become 0 (still), twinkle becomes 7 (a soft glow), crows fade out where they sit instead of flying, the drift of mist stops. Leaves that would fall lie on the ground instead.

### The world answers the screens
Life listens on the bus: on `screen-hover` the beacon's glow (8 dabs round `meta.beacon.p`, in the hovered colour's slot: wick 46, Flame 33, Ward 38, Gloam 39) brightens for 0.3 s; on `screen-pick` and `spark-take` it flares (0.5 s) in that slot; on `pattern-kindled` and a buy (`lamp-room` stays open) the nearest anchors' halos pulse once; on `beacon-lit` the anchors within 15 m of the beacon brighten, one after another, nearest first, 120 ms apart. None of it uses slots 34 to 37.

### The fire rule
- No life dab uses slots 34, 35, 36 or 37. Embers use 33; flames are the bake's. Halos use 46 and 47 only within 0.6 m of an anchor. A Node test checks every life row's colour against the palette slots.
- The phone tell check of `gloam-downs-run.fight.e2e.mjs` (the fire pixels counted round a Snuffer's wind-up) must still pass with life on. The hush is what makes it pass near lamps.

### Budget and the measured check
- **Count.** At most 1,200 life splats a place. The place with its pool, the sparks and life stays at or under 277,000 splats (`gloam-downs-foes.test.mjs` holds the place with its pool at 275,000; the sparks add 256). Each place's count is printed by the life test.
- **Writes.** In steady play no row is written; with a flock in flight or a gust, at most 4 rows of 512 a frame.
- **Frame time** (`qa/lab/gloam-downs-life.e2e.mjs`, new): Chromium with SwiftShader at 390x844 with touch (the phone layout) and `?run&test&seed=7`. For each of the five places and three views (the start, the nearest lamp anchor to the route's middle, the beacon), with the game stepped by `__gloam.tick` and drawn by `__gloam.draw({ time })`: 15 draws to warm up, then 120 timed draws, in blocks of 10 with life on and off by turns (`__gloam.life({ on })`), the same time steps in both. The median frame time with life must be at most 1.05 times the median without it, over all 15 views; no single view over 1.08. Life's own CPU time in `draw` (`__gloam.life().ms`) has a median of 0.25 ms or less. The same check runs once in the explorer (`?explore&test`) at the Gaol.
- SwiftShader draws on the CPU, so this measures the sort, the uploads and the fill together, more harshly than a phone's GPU would. No real phone is checked; that is stated with the results.

### Sound beds
- `beds.js` (new): per place, a bed of voices made in code on the run's mix, under the music's `amb` layer. Each is quiet and sparse; the music keeps its wind and drips.

| Place | Bed |
|---|---|
| The Sunken Gaol | a low moor wind; a chain creak each 12 to 30 s |
| The Crow Wall | a high wind on the wall that swells with each gust; caws at a distance |
| Lantern Fen | water lapping; a frog now and then; reeds in the gusts |
| The Bell Knoll | a dry wind; a faint ring of loose cogs in the gusts |
| Barrow Crown | a low hollow wind; an owl each 20 to 45 s; moth wings at lamps nearby |

- **Reactive**: on `life-stir` `gust`, a wind swell of 2 s that follows the gust's `k`; on `crows`, a flutter of wings and two or three caws placed at the flock with `space()` from `sound.js`. The beds duck by 6 dB while foes are awake, with the music's combat layers, and stop in the boss fight and the Lamp-room.
- **Levels**: each bed alone at -38 ±3 LUFS; with the music of its place, the place's music level as the music demo measures it moves by 0.5 LU or less. `qa/lab/gloam-downs-music-demo.mjs` gets a `beds` group that renders each bed for 30 s with two gusts and one flock and checks these.
- The beds start with the run's sound (the first press) and only in a run, as the music does. The explorer has no sound today and gets none.

## Who builds what
Two builders, each in their own worktree from `720edbba`. No file is changed by both, except the one-line hooks listed here; each hook is added by the builder named, exactly as written, and the other builder does not edit that line.

### Builder S: the screens
Owns:
- `public/lab/gloam-downs/screens.js`, `cards.js`, `index.html` (markup and CSS), `main.js` (all of it but Builder E's hooks below).
- `public/lab/gloam-downs/menu-scene.js` (new): `titleView`.
- `public/lab/gloam-downs/sound.js`: the cues `hover`, `reveal`, `pick`, `kindle`, `tally` in `CUES` and their recipes. No other change.
- `public/lab/gloam-downs/run.js`: only `die` and `win` (the `path`, `colours`, `patternNames` and `by` fields) and the runner's record of the last hit's type (`run.lastHurt`) and each place's time and foes as it ends. `run-save.js`: `clean()` for those fields and `rs.furthest`.
- Tests: `qa/lab/gloam-downs-screens.test.mjs` (new), `qa/lab/gloam-downs-screens.e2e.mjs` (new), `qa/lab/gloam-downs-screen-sound.e2e.mjs` (new); updates to `gloam-downs-run.test.mjs`, `gloam-downs-growth.test.mjs`, `gloam-downs-run.cards.e2e.mjs`, `gloam-downs-run.growth.e2e.mjs`, `gloam-downs-run.input.e2e.mjs` and `gloam-downs.e2e.mjs` where they meet the title or the new card markup.

Builder S emits, from main.js, `screen-hover` and `screen-pick` with the fields in Part S. It does not add them to `bus.js` (`emit` and `on` work for any name).

### Builder E: life and beds
Owns:
- `public/lab/gloam-downs/life.js` (new): `makeLife(world, meta, o)` returning `{ draw(view, t, lamplighter, foes), test(o), rows, count }`.
- `public/lab/gloam-downs/beds.js` (new): `makeBeds(ctx, mix, o)`.
- `public/lab/gloam-downs/run-sound.js`: make the beds in `A.start`, follow the scene, and the `life-stir` handler.
- `public/lab/gloam-downs/bus.js`: add `'life-stir'` to the end of `EVENTS`. That one line.
- Tests: `qa/lab/gloam-downs-life.test.mjs` (new), `qa/lab/gloam-downs-life.e2e.mjs` (new), `qa/lab/gloam-downs-music-demo.mjs` (the `beds` group), `qa/lab/gloam-downs-sound.test.mjs` (the bed scenarios).

Builder E's hooks in `public/lab/gloam-downs/main.js` (five lines, each its own line, no other main.js change):
1. After `import { makeFight, SPARKS } from './fight.js';`: `import { makeLife } from './life.js';`
2. After `let foeTargets = () => [], fight = null;`: `let life = null;`
3. After `const placeCount = world.count;` (in the place's setup, before `pool = RUN ? makePool(`): `life = makeLife(world, meta, { walk, still, rows: pendingRows, on: !LOOK && !q.has('nolife') });`
4. In `draw()`, on the line before `try {` (the one that calls `renderer.render`): `life?.draw(view, t, o.body || body.s, fightView().foes);`
5. In `window.__gloam`, after the `pool: () => ...` entry: `life: o => life?.test(o) ?? null,`

Builder S keeps these five lines where they are when it changes main.js, and if it moves the code round them, it moves each line with its anchor.

### Merge pass
- Merge E onto S. Run every check in tasks.md section 3. Update `games/gloam-downs/README.md` ("The run in the page": `life.js`, `beds.js`, `menu-scene.js`; "Checks": the new tests) and the AGENTS.md Gloam Downs line with the new checks.
- Take the screenshots for the pull request: the title, the beacon card, the Lamp-room and the summary at 390x844 and 1280x720, and each place's life at 390x844.

## Builder E: what was built, and what changed from the plan
- **Sizes.** The art is drawn at about 46,000 pixels on a phone and 100,000 on a desktop, so a pixel is about 3 to 4 cm at the follow camera's distance. Dabs of 1.5 cm did not show. Tuft blades are 2.2 cm wide, motes 2.6 to 4 cm, embers and fireflies 3 cm, moths 2.6 cm, crows 1.4 times the first sketch. The halo keeps 0.04 to 0.07 m.
- **Where.** Tufts stand within 10 m of the route. A third of the motes and of what falls stands within 12 m of the start, where the player looks first. Motes, fireflies and what falls in the air stand 2.5 m or more off the route: the follow camera rides the route, and a mote a metre from the eye drew as a big pale ball in the first pictures.
- **The Gaol** also has moonlit motes (`moon`, slots 30 and 31). Its drips are in `moon` 30, not `fog`, because a fog-coloured drip does not show against the fog. Every other place keeps the table in "Per place".
- **Life can be seen.** The baked fires and embers already move about 0.8% of the Gaol's start picture between 0 s and 1 s. Life makes it 1.4% (1.86 times as much), so the check asks for 1.5 times, not 3. More dabs to reach 3 times cluttered the picture.
- **The hush** fades the bright dabs (embers, motes, fireflies, moths, halos). Tufts, rags, leaves and crows stay, so the ground does not go bare by a fight.
- **Crows** lift on a foe in `stagger`, `stun` or `down` within 6 m: that is how a landed hit shows to life.
- **Gusts with reduced motion** still emit `life-stir`, so the beds still swell, but nothing moves or sheds.
- **`life-stir` kinds:** `gust`, `crows`, and `lamp` (a lamp brightening by the lamplighter, which the Barrow Crown bed answers with moth wings). A buy has no bus event, so only `pattern-kindled` pulses the lamps.
- **Bed levels.** The explore music of the places measures -31 to -39 LUFS. A bed at -38 LUFS would lift the Fen's music by about 3 LU, so the two targets of "Sound beds" could not both hold. The beds keep the rule that matters: each is 10 LU or more under its place's explore music (and over -52 LUFS), and lifts it by 0.5 LU or less. Each place has its own trim in `BEDS`.
- **Merge item: the rows hook.** Hook 3 passes `pendingRows`, but `go()` then replaces it twice with `pendingRows = new Set()`. Life's row marks go to the old set, so a life write reaches the GPU only when its rows are uploaded for another reason (it happened to work in the tests, because the pool's rows share the upload). The merge must change those two lines to `pendingRows.clear();`, or pass life's rows to the renderer.
- **The bus count.** `gloam-downs-builds.test.mjs` and `gloam-downs-sound.test.mjs` counted 23 bus events; with `life-stir` they count 24.

### Measured (Builder E, SwiftShader, 390x844 with touch)
One run of `gloam-downs-life.e2e.mjs` with `WARM=3 DRAWS=24 BLOCK=4`, not the spec's 15, 120 and 10. On this machine SwiftShader took 6 to 15 s a draw, with another browser check running beside it, so the full counts would have taken about 8 hours. The blocks go on, off, off, on, so a slow spell falls on both. With so few draws a view, the noise is a few percent either way (Bell Knoll's beacon reads 0.857). Life's own time is the median of its `draw` over the view.

| View | With life (ms) | Without (ms) | Ratio | Life's own (ms) |
|---|---|---|---|---|
| gaol/start | 14503 | 14654 | 0.990 | 0.2 |
| gaol/lamp | 13935 | 13869 | 1.005 | 0.2 |
| gaol/beacon | 11150 | 11695 | 0.953 | 0.2 |
| ramparts/start | 9558 | 9651 | 0.990 | 0.3 |
| ramparts/lamp | 11403 | 11519 | 0.990 | 0.3 |
| ramparts/beacon | 7965 | 8041 | 0.991 | 0.2 |
| fen/start | 8723 | 8790 | 0.992 | 0 |
| fen/lamp | 7537 | 7560 | 0.997 | 0.1 |
| fen/beacon | 6955 | 7281 | 0.955 | 0.2 |
| bells/start | 9716 | 9650 | 1.007 | 0 |
| bells/lamp | 8933 | 9206 | 0.970 | 0 |
| bells/beacon | 7157 | 8349 | 0.857 | 0.1 |
| barrows/start | 6978 | 6887 | 1.013 | 0 |
| barrows/lamp | 6415 | 6575 | 0.976 | 0 |
| barrows/beacon | 6189 | 6287 | 0.984 | 0.1 |
| explorer/gaol | 6739 | 6729 | 1.002 | |

Over all 15 views: 0.981 (at most 1.05). Worst view: 1.013 (at most 1.08). Life's own median: 0.1 ms (at most 0.25). Life's count: the Gaol 1,010, the Crow Wall 862, Lantern Fen 756, the Bell Knoll 752, Barrow Crown 762. No real phone was checked.

Bed levels (music demo `beds` group, 30 s, two gusts and one flock, integrated LUFS): bed alone, then the place's explore music, then the two together.

| Place | Bed | Music | Both | Lift |
|---|---|---|---|---|
| The Sunken Gaol | -46.6 | -34.5 | -34.3 | 0.2 |
| The Crow Wall | -46.9 | -36.6 | -36.2 | 0.4 |
| Lantern Fen | -48.8 | -38.7 | -38.3 | 0.4 |
| The Bell Knoll | -42.8 | -32.7 | -32.3 | 0.4 |
| Barrow Crown | -40.8 | -30.6 | -30.5 | 0.1 |

No one listened to the beds on speakers or headphones; the levels are measured only.

## Risks
- **The title adds a screen.** A returning player pressed Begin in the Lamp-room before; now they press Begin on the title. The count of presses is the same.
- **Life near tells.** If the hush is too slow, a mote can shine by a wind-up. The fight e2e's tell check is the guard.
- **Sorting.** Kinds 15, 11 and 14 move a splat without the sort knowing. Their ranges are small (1.5 m or less), and kind 2 (sort-corrected) is used for longer falls.
- **SwiftShader is not a phone.** The 5% rule is measured on the CPU raster. A phone's GPU may differ either way. The count cap and the no-large-dab rule are the other guards.
