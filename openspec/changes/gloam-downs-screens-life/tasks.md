# Tasks

Two builders work in parallel worktrees from `720edbba`. design.md "Who builds what" names the files each one owns and Builder E's five hooks in `main.js`. Each builder runs its own checks before it hands over. The merge pass (section 3) runs every check.

## 1. Builder S: the screens
- [x] 1.1 `screens.js`: `cardOnLoad` gives `title`; the title's lamps (`titleLamps(rs, explorer)`), the seed and Ember line, the place subtitles; `recapOf(ended)`; the Lamp-room's shelves and tiles (`wareTile`, "level of levels", fill share); fix the help text to one flask.
- [x] 1.2 `menu-scene.js` (new): `titleView(base, t, still)`, and the title's drift wired in `main.js` through `draw({ view })`. No change to `play.js`.
- [x] 1.3 `index.html`: `#title`, the lamp cards, the Lamp-room shelves and tiles, the recap's path and rows, the per-card vignette, the bottom sheet and side placement of the beacon card, and the reduced-motion rules.
- [x] 1.4 `cards.js`: the grid move for rows of cards; the focus style on `pointerdown`.
- [x] 1.5 `main.js`: the title flow (first visit and later), the explorer's title with the place lamps and the Gilt Lattice, the deal-in, hover, pick, buy, kindle and recap motions, and `screen-hover` and `screen-pick` on the bus. Keep Builder E's five hook lines with their anchors.
- [x] 1.6 `sound.js`: `hover`, `reveal`, `pick`, `kindle`, `tally` in `CUES` with their recipes and rate limits.
- [x] 1.7 `run.js` and `run-save.js`: `path`, `colours`, `patternNames`, `by` in `rs.ended`; `run.lastHurt`; `rs.furthest`; `clean()` for each.
- [x] 1.8 `qa/lab/gloam-downs-screens.test.mjs` (new): the Node scenarios of Title screen, Lamp-room shelves, Run recap and the grid move.
- [x] 1.9 `qa/lab/gloam-downs-screens.e2e.mjs` (new): the browser scenarios of Title screen, Places as lamps, Lamp cards at the beacon, The beacon stays in view, Lamp-room shelves, Buy and kindle moments, Run recap, Screens in every layout and input, and Screens with reduced motion, at 320x640, 360x640, 390x844, 844x390, 800x600 and 1280x720, with keys, a pad alone and touch alone. `SHOTS=<dir>` keeps the pictures.
- [x] 1.10 `qa/lab/gloam-downs-screen-sound.e2e.mjs` (new): the screen cues rendered offline against `choice`.
- [x] 1.11 Update `gloam-downs-run.test.mjs`, `gloam-downs-growth.test.mjs`, `gloam-downs-run.cards.e2e.mjs`, `gloam-downs-run.growth.e2e.mjs`, `gloam-downs-run.input.e2e.mjs` and `gloam-downs.e2e.mjs` for the title and the new markup. Run them, and `gloam-downs-run.fight.e2e.mjs`, `gloam-downs-mouse.e2e.mjs` and `gloam-downs-clicks.e2e.mjs`.

## 2. Builder E: life and beds
- [x] 2.1 `life.js` (new): `makeLife(world, meta, o)`: the anchors, tufts, perches, hollows and route from the baked data and walk map; the block of rows after the place's splats; `world.moving` for kinds 2 and 3; `LIFE` per place with its palette slots.
- [x] 2.2 `life.js`: the per-place life of design.md "Per place", within 1,200 splats.
- [x] 2.3 `life.js`: crows that take off, lamps that brighten, gusts, the hush near awake foes, the answers to `screen-hover`, `screen-pick`, `spark-take`, `pattern-kindled` and `beacon-lit`, and `life-stir`.
- [x] 2.4 `life.js`: reduced motion (`still`), and `test(o)` (on and off, counts, rows written, its own time, the halos and flocks).
- [x] 2.5 The five hooks in `main.js`, exactly as design.md writes them, and `'life-stir'` at the end of `EVENTS` in `bus.js`.
- [x] 2.6 `beds.js` (new) and `run-sound.js`: a bed per place, the gust swell, the flock's wings and caws at the flock, the duck in a fight, the stop in the boss fight and the Lamp-room.
- [x] 2.7 `qa/lab/gloam-downs-life.test.mjs` (new): the Node scenarios of Ambient life, Life answers the lamplighter, Life never looks like a tell (no fire slot), Life budget (the count), Life with reduced motion and The world answers the screens; it prints each place's count. `GLOAM_WORLDS=0` skips the baked places.
- [x] 2.8 `qa/lab/gloam-downs-life.e2e.mjs` (new): life can be seen, crows lift, the hush, reduced motion, and the frame-time check of design.md "Budget and the measured check", which prints each view's ratio. `SHOTS=<dir>` keeps a picture of each place at 390x844 and 1280x720.
- [x] 2.9 `gloam-downs-sound.test.mjs`: the bed scenarios. `gloam-downs-music-demo.mjs`: the `beds` group and its targets.
- [x] 2.10 Run `gloam-downs-run.fight.e2e.mjs` (the phone tell check with life on), `gloam-downs-foes.test.mjs`, `gloam-downs.test.mjs`, `gloam-downs-run.test.mjs` and `node qa/arcade/quiet.mjs --only=lab/gloam-downs`.

## 3. Merge pass
- [x] 3.1 Merge E onto S. Check that Builder E's five hook lines and the `bus.js` line are in place once each.
- [x] 3.2 Node: every `qa/lab/gloam-downs*.test.mjs`, `node qa/lab/gloam-downs-zones.mjs`.
- [x] 3.3 Browser, with the site served: every `qa/lab/gloam-downs*.e2e.mjs` but the uniforms check (the renderer does not change; run it only if a renderer file changed), `CHROMIUM_PATH=/opt/pw-browsers/chromium QUIET_URL=http://127.0.0.1:8765 node qa/arcade/quiet.mjs --only=lab/gloam-downs`, and the music demo's `beds` group.
- [x] 3.4 Look at the pictures: the title, the beacon card, the Lamp-room and the summary at 390x844 and 1280x720, and each place's life at 390x844. Check them against "What is dull today" in design.md, and that the look is still painted lamplight in the dark.
- [x] 3.5 Update `games/gloam-downs/README.md` and the Gloam Downs line in `AGENTS.md` with the new modules and checks. Write the measured frame-time ratios and the bed levels into design.md.
- [x] 3.6 `openspec validate gloam-downs-screens-life --strict`. Say in the report that no real phone, real pad or audio listening test ran, if none did.

The merge pass is written up in design.md "Merge pass: what was done". No real phone, real pad or listening test ran.

## 4. Checker round 2
- [x] 4.1 Pause card, How to play and map fit at 844x390; the layout part checks them at six layouts.
- [x] 4.2 The lamplighter framed clear of the title (`titleSpot`, `frameAt`); the cutaway uses the drawn view.
- [x] 4.3 Smaller motes; the Gaol's motes at its lamps, fewer drips, shorter embers.
- [x] 4.4 The mouse moves the focus; one lit card; ware tiles answer the mouse.
- [x] 4.5 The place's name clear of the HUD and the lamplighter.
- [x] 4.6 The bed stops in a hidden tab and under the switcher.
- [x] 4.7 The life budget gate on life's own time with gusts, flights and the hush.
- [x] 4.8 Cheap lows: `rs.reached`, the deal wait, touch hover, arrows in a card, life's allocations, "Here:", Back on How to play, 14 px text, 320 px line breaks, the snuffed lamp.
- [x] 4.9 Every check of the merge pass again; spec, design.md and validate.

