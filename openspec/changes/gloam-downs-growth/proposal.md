# Gloam Downs: growth and abilities

## Why
The player asked to "make the game more like deadcells mechanics the more you play the stronger you get" and for more "abilities". The last check found the run too short and too easy: a skill 0.9 bot wins its first run in about 8.7 minutes, and a skill 0.3 bot wins by run 3. A death keeps 25% of the glim carried, and a lit beacon banks all of it, so little is ever at risk. There is nothing to find that lasts beyond the Lamp-room's wares, and the lamplighter has one set of moves.

## What changes
### Growth across runs
- Foes and elites sometimes drop a **pattern** for a new ability or pane. A pattern carried is kept only when the run lights the next beacon. In the Lamp-room the player spends glim to **kindle** it. From then on it is in the drops of every later run.
- **Glim is at risk.** A lit beacon no longer banks the glim carried. The player spends it in the Lamp-room at the beacon, or carries it on. A death keeps 10% of the glim carried, and Ash pocket raises that by 8% a level, up to 50%. A win banks all of it. This replaces the 25% rule.
- **Lasting wares with many levels.** Mantle goes to 8 levels, Flask to 4, Edge to 5, Draught to 3 and Ash pocket to 5. New wares: Belt (the abilities a run starts with), Keen eye (better drops), Lantern panes (passive slots) and First spark (sparks at the start). Costs grow with each level, so 15 to 30 runs see steady growth.
- **Two lasting keys.** The Rookchief gives Crow step, a second jump in the air, the first time it falls. The Bellwether gives Bell drop: a plunge that cracks sealed stones. Each opens hidden ledges and sealed stones in the baked places, with caches and, where the walk map allows, shortcuts. No rebake is needed.

### Abilities
- Two ability slots, each on its own cooldown, on new inputs for keys, mouse, pad and touch.
- Nine abilities: Lantern bomb, Smoke step, Ember snare, Moth wisp, Crook line, Rime lamp, Flare, Pitch pour and Bell guard. Each has a clear tell, a cooldown, a sound and a drawn effect.
- **Sparks.** Each lit beacon offers a spark that raises one of three colours of power: Flame (damage), Ward (health) and Gloam (abilities). Each move and ability has a colour and grows with it.
- **Lantern panes.** Passive picks set in the Lamp-room. One slot at first; Lantern panes opens two more.

### Difficulty and pacing
- Ember 0 gets harder, so a new player dies in the first runs and growth carries them to a win.
- Each place gets two or three more zones from a page table, on the baked walk map, and the caches add side trips.
- The bot carries a save between runs, spends glim, kindles patterns and uses abilities. Targets: a skill 0.5 bot first wins in run 6 to 12; a 0.9 bot in run 1 to 3, with a winning run of 15 to 25 minutes of game time; a first run at 0.3 reaches the second place in at least half the bots.

### Save, screens and sound
- The save moves to `gloam-downs.run.v3`. It reads v2 once, and every new field is checked on the way in.
- The Lamp-room shows patterns to kindle, the lasting wares and the panes. The beacon card offers the spark. The HUD shows the two abilities with their cooldowns, and the three colours.
- The bus gets events for a pattern found, kept and kindled, a key found, an ability used and ready, a spark taken and a cache opened. The run's sound plays existing cues for them.

## Capabilities
- Modified: `gloam-downs-run`. The delta is `specs/gloam-downs-run/spec.md`.
- The explorer capability, `gloam-downs`, does not change.

## Scope
- Mechanics of the genre are used, but no name, art, text or item comes from Dead Cells or any other game. Every name is our own: glim, the Lamp-room, wicks, embers, lamps, panes, sparks and patterns.
- The baked places, foes and boss files do not change. Hidden ledges and sealed stones use the walk maps as they are.
- `play.js` camera code does not change unless a test proves it is needed.
- Fire stays the brightest colour: no new effect passes fire slot 37.
- No Higgsfield or other paid generation.
