## Why
The user shared a Forge fragment (forge.ui8.ai, `frag_1eb8944c-57b1-42ca-a909-5c2d7e517c24`): a pixel fighter jet that flies over islands, dogfights, throws missiles off with a roll, and ejects. It is a sandbox with no goals. The user asked for a fun, full campaign game made from it, then for cutscenes, then for the game to move into the arcade.

## What Changes
Add Ember Tide at `/ember-tide/`, an Action game. It is a campaign of twelve sorties in three acts, flown in the fragment's scene. Each sortie is a list of stages: fly marker gates, skim the sea, shoot down enemies, roll missiles off, land counter-attacks, stay alive for a time, or shoot down an ace with a health bar. A sortie has a briefing, radio lines in flight, spare jets, a debrief and up to three stars. Stars buy five hangar upgrades and open four paint schemes. Progress is kept in the browser.

Seven cutscenes tell the story: the opening, the start of Acts II and III, the ace's arrival and fall, the last dawn, and the epilogue. A cutscene plays on the scene itself between black bars, with the speaker's pixel portrait and typed lines. The player can hurry or skip it, and watch any seen cutscene again from the flight line.

## Impact
New static folder `public/ember-tide/` (the campaign, the patched scene modules, 30 sounds, React as local modules and a compiled stylesheet), its sources and build tools in `games/ember-tide/`, a cabinet screen `public/arcade/key/ember-tide.webp`, an Action cabinet and its stars line in `public/index.html`, an entry in `public/arcade/switch.js`, a Corridor piece in `public/corridor/index.html` (cabinets 20 to 44 become 21 to 45, the light slots grow from 88 to 90), a date entry in `public/arcade/game-dates.json`, the Action list in `public/lab/riftwalk/hall.js`, a `PAGES` entry in `qa/arcade/quiet.mjs`, and `qa/arcade/machines.mjs` updated for the new last machine of the Action row. No other game changes.
