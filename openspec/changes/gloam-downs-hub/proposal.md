# Gloam Downs: the walk-through Lamp-room, and more to gain

## Why
After playing the run, the player said: "the lamp room looks ugly make it a walk thru environmewnt" and "with more types of buffs and abilities thatr can be gained". Then: "like different categoies like deadcells".

Today the Lamp-room is a flat HTML card (`#lamp` in `index.html`, filled by `screens.js` and `cards.js`): shelves of lamp tiles over the last frame of the place. Nothing you buy shows up in the world. And the build has gaps: one blade, one state that deals damage (burn), no sure hits, no shield, one summon, few effects on a kill, and no power at low health. Nor are there clear categories: what you find has no slot of its own beyond the two abilities, and no quality beyond bright (design.md "What the build lacks today").

## What changes
### Part H: the Lamp-room as a place
- **A small baked place, `lamproom`.** Between runs the lamplighter stands in a lamp-lit stone hall with an open front and walks to its stations. It is baked with the same Ink Studio pipeline and painted look as the five places, with its own life and sound bed.
- **Stations in the world, one a category.** A lamp shelf (lasting wares), a kiln (kindle patterns), a pane window (set panes), a wick rack (unlocks), a blade rack (pick the start blade), an off-hand stand (pick the start off-hand), a trophy wall (keys), the ability post (try any two abilities), the Ember bell (Ember level), a map table with the run door (begin the run), and a well (the bank and the last run). Walk up to one and its own small card opens next to it, for keys, mouse, pad and touch.
- **The hall grows.** A ware's lamp fills with light by its level. A kindled pattern hangs lit over the kiln. A set pane is coloured glass in the window. An unlock hangs a lit wick. A key's trophy goes up on the wall. Nothing is shown that is not owned.
- **A quick list.** Tab, the pad's View button or the touch List button opens the whole Lamp-room as one card, restyled, for speed and for access.
- **At a beacon, a shrine, not a load.** A lit beacon becomes a small shrine in the place itself: walk up to it and the same station cards (wares, patterns, panes) open beside the beacon. Nothing loads, and the glim at risk stays a choice made on the spot.

### Part C: categories
- **Gear slots:** a Blade (1), an Off-hand (1, new) and Abilities (2). Found gear lies on the ground and is swapped there.
- **Blades:** the Lamp blade and three found blades, the Hook blade, Twin knives and Bell maul (the tempers of the first draft), each with its own string, speed, reach, damage and colour.
- **Off-hands:** Buckler (a parry), Iron cuff, Sling, Fire pot, Lamp chain and Shade lamp, on a new button.
- **Panes** (1 to 3 slots), **Wicks** (one pick a beacon, at most 5 a run), **Relics** (from elites, at most 5) and **Sparks** (the Flame, Ward and Gloam levels) stay their own categories. **Patterns** are the plans for every gear item and pane.
- **Colour:** every blade, off-hand and ability has a colour and grows with that colour's level.
- **Quality:** found gear comes plain, bright or blazing; deeper places and elites drop better tiers. A bright item rolls 1 trait and a blazing one 2, from a table of 10 (for example burn, sure cuts, a heal on a kill).
- **Shown by category:** the HUD's gear row, the touch buttons, every card and the quick list show each item's category glyph, colour edge and tier mark, at every layout.

### Part B: more to gain
- **Four new foe states:** Char (stacks, then bursts), Soot (ticks, spreads when the foe falls), Blind (its next blow misses) and Mark (the next hit bursts it).
- **Sure cuts:** a hit that deals 1.5 times, from new wares, wicks and panes.
- **A ward shell** on the lamplighter: a short shield that takes damage first.
- **Ten new abilities:** Wick lash, Shard fan, Shutter, Post lamp, Oil slick, Bell toll, Ember shell, Moth swarm, Gloam blink and Tack scatter. Each is a pattern kindled at the kiln.
- **New buffs:** 6 panes, 4 wicks, 4 relics and their 4 kindlings, 2 wares, 2 unlocks (Blade rack, Wick crate), 1 key (Gloam dash, a dash in the air) and 3 colour sets, plus the 3 blades, 6 off-hands, 3 tiers and 10 traits of Part C. Each has numbers, a category, a way to gain it and a test.
- **Synergies** with the wicks, relics, panes and abilities there today (design.md "Synergies").

### Balance
The fair-fight change (`openspec/changes/gloam-downs-fair-fight/`, in progress on `ccr-43aa269a-y8yo7l`) is changing the foe curve, interrupts and attack tokens right now. Ticks of Char, Soot and burn never make a foe flinch and never wear its poise. Every new buff stays inside the power budget in design.md "Balance". Pacing SHALL be measured again with the bot after both changes land, and the numbers here may move then.

## Capabilities
- Modified: `gloam-downs-run` (the Lamp-room as a place, the beacon shrine, station cards, the hall that grows, the categories and their slots, blades, off-hands, tiers, traits, depth drop tables, the gear row, foe states, sure cuts, the ward shell, the new abilities, panes, wicks, relics, wares, the key and colour sets).

## Impact
- New: `games/gloam-downs/biomes/lamproom.mjs`; `public/lab/gloam-downs/worlds/lamproom.*`; `public/lab/gloam-downs/hub.js` (stations, growth objects, station cards); `public/lab/gloam-downs/build.js` (sure cuts, the shell, colour sets); `gear.js`, `gear-play.js`, `hud-gear.js` and `gear.css` (blades, off-hands, tiers, traits, the gear row); Node and browser tests named in tasks.md.
- Changed: `bake.mjs` and `lib/check.mjs` (the `hub` set), `places.js`, `save.js`, `main.js` (go to the hub, the shrine), `cards.js` (an anchored card), `input.js` (Use and List), `index.html`, `growth.js`, `run.js`, `run-save.js` (v4), `status.js`, `abilities.js`, `relics.js`, `keys.js`, `foes.js` (after the fair-fight change), `fight.js`, `sparks.js`, `life.js`, `beds.js`, `run-sound.js`, the bot.
- Three builders in parallel worktrees after the fair-fight change merges: hub, buffs and gear (design.md "Who builds what").
- No paid generation. No names or art from other games.
