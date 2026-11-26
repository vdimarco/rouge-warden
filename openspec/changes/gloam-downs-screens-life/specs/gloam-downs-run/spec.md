## ADDED Requirements

### Requirement: Title screen
A load that today opens the help card or the Lamp-room SHALL open a title screen over the live place: the title in the painted style, the place line, the five places as lamps on a path, a seed and Ember line, and Begin the run with the focus. The place SHALL drift slowly behind it. On a first visit Begin the run SHALL open the help card; after that it SHALL start the run at once.

#### Scenario: A returning player sees the title
- **WHEN** a player with a saved bank and no run loads `?run` at 390x844
- **THEN** `#title` shows with "Gloam Downs", "Seed" and "Ember 0" in its line, Begin the run has the focus, and Enter starts the run in the Gaol. Check: Node test `gloam-downs-screens.test.mjs` (`cardOnLoad` gives `title`), and e2e `gloam-downs-screens.e2e.mjs`.

#### Scenario: A first visit still teaches
- **WHEN** a fresh save loads `?run` and the player presses Begin the run on the title
- **THEN** the help card opens with "one flask" in its text, and its own Begin the run starts the run. Check: e2e `gloam-downs-run.input.e2e.mjs`.

#### Scenario: The place drifts behind the title
- **WHEN** the title shows for 6 s of game time
- **THEN** the drawn view's yaw has moved from the start camera's by more than 1° and at most 9°, and `play.js`'s follow camera was not stepped. Check: Node test `gloam-downs-screens.test.mjs` (`titleView`), and e2e `gloam-downs-screens.e2e.mjs` (`__gloam.state().cam.drawn`).

### Requirement: Places as lamps
The title SHALL show the run's five places as lamps, lit for each place the player has reached in any run. Under the pointer or the focus a lamp SHALL light fully and the line under it SHALL name the place and its subtitle. In a run a lamp SHALL NOT start a place. In the explorer the lamps SHALL be the place choices, and the Gilt Lattice SHALL follow as its own group.

#### Scenario: Focus names a place
- **WHEN** a player who has reached The Crow Wall moves the focus to the second lamp with the arrow keys
- **THEN** lamps I and II are lit, lamp II is fully lit, and the line reads "II · The Crow Wall" with its subtitle. Check: e2e `gloam-downs-screens.e2e.mjs`.

#### Scenario: The explorer picks a place by its lamp
- **WHEN** the explorer's title shows with Lantern Fen open and the player presses its lamp
- **THEN** Lantern Fen loads. Check: e2e `gloam-downs.e2e.mjs`.

### Requirement: Lamp cards at the beacon
Each wick, spark and start ability SHALL be a lamp card with a glass in its colour; a bright ability SHALL have a gold rim. Hover and focus SHALL lift the card and brighten its light, and play `hover`. A set of choices SHALL deal in one after another. A pick SHALL take effect on the press, flare the chosen card, play `pick` and emit `screen-pick`.

#### Scenario: Pick a spark by pad
- **WHEN** the spark cards show and a pad presses right twice and A
- **THEN** Gloam +1 is taken, `__gloam.run()` shows Gloam 1, the cue log has `pick`, and the bus heard `screen-pick` with colour `gloam`. Check: e2e `gloam-downs-screens.e2e.mjs`.

#### Scenario: Hover lifts and lights
- **WHEN** the mouse moves over the second wick card at 1280x720
- **THEN** within 200 ms the card's box is 3 to 5 px higher than at rest, its glow opacity is 1, and the cue log has one `hover`. Check: e2e `gloam-downs-screens.e2e.mjs`.

### Requirement: The beacon stays in view
On a portrait phone the beacon card SHALL be a bottom sheet whose top is at or under 58% of the screen's height; on a wide or landscape screen it SHALL sit at the right in at most 46% of the width. The veil SHALL leave the beacon's part of the picture clear.

#### Scenario: The beacon shows above the card
- **WHEN** the Gaol's beacon is lit at 390x844 and at 844x390
- **THEN** the point `project(meta.beacon.p)` is on screen and outside the card's box in both. Check: e2e `gloam-downs-screens.e2e.mjs`.

### Requirement: Lamp-room shelves
The Lamp-room SHALL group the lasting wares, the patterns and the panes on headed shelves. A ware SHALL be a lamp tile whose light fills by its level, with its name, "level of levels", next gift, cost and Buy. A pattern SHALL be an unlit lamp with Kindle. The tiles SHALL be 2 columns under 520 px wide, 3 up to 900 px and 4 above.

#### Scenario: A ware shows its level as light
- **WHEN** the Lamp-room opens with Mantle 2 bought
- **THEN** Mantle's tile reads "Mantle 2 of 8", and its glass's fill is 25% of its height. Check: Node test `gloam-downs-screens.test.mjs`, and e2e `gloam-downs-screens.e2e.mjs`.

#### Scenario: Columns follow the width
- **WHEN** the Lamp-room shows at 390x844, 800x600 and 1280x720
- **THEN** the ware tiles stand in 2, 3 and 4 columns. Check: e2e `gloam-downs-screens.e2e.mjs`.

### Requirement: Buy and kindle moments
A buy SHALL raise the tile's light to the new level, flash the tile, play `buy` and roll the glim count from the old to the new value with `tally` ticks, at most 12. A kindle SHALL light the pattern's lamp and play `kindle`. The focus SHALL stay on the next Buy, as now. With reduced motion the numbers SHALL change at once.

#### Scenario: Buy Mantle
- **WHEN** the player buys Mantle 1 for 40 with 75 banked
- **THEN** the glim line shows 75 at once and 35 after 400 ms, the cue log has `buy` and 1 to 12 `tally`, and the focus is on the next Buy. Check: e2e `gloam-downs-screens.e2e.mjs`.

#### Scenario: Kindle a pattern
- **WHEN** the player kindles a found Rime lamp pattern
- **THEN** its tile shows a lit glass in Ward's hue and the cue log has `kindle`. Check: e2e `gloam-downs-screens.e2e.mjs`.

### Requirement: Run recap
The summary and the win card SHALL show the run's path as lamps, each place passed lit with its time and foes, the end place snuffed on a death or bright on a win; and the foes put out, the glim kept and lost, the patterns kept by name, the sparks by colour, the best combo, and on a death what put the lamp out. They SHALL come in with motion that a press ends.

#### Scenario: A death on The Crow Wall
- **WHEN** a run passes the Gaol in 2:10 with 9 foes and a Snuffer's hit ends it on The Crow Wall
- **THEN** the summary shows lamp I lit with "2:10" and "9", lamp II snuffed, and "Put out by a Snuffer". Check: Node test `gloam-downs-screens.test.mjs` (`recapOf`), and e2e `gloam-downs-screens.e2e.mjs`.

#### Scenario: An old save still reads
- **WHEN** a save's ended run has no `path` field
- **THEN** the summary shows the old rows and no path. Check: Node test `gloam-downs-screens.test.mjs`.

### Requirement: Screens in every layout and input
The title, the beacon card, the Lamp-room, the summary and the win card SHALL fit inside the screen with no page scroll at 320x640, 360x640, 390x844, 844x390, 800x600 and 1280x720, with each button 44 px or more on its shorter side, nothing under ◀ Lab or Games, text of 14 px or more, and text contrast of 4.5:1 or more. Keys, a pad alone and touch alone SHALL reach every choice.

#### Scenario: Every screen fits
- **WHEN** each screen shows at the six layouts, with touch at the four narrow ones and a mouse at 800x600 and 1280x720
- **THEN** `cardFaults` finds none, and the contrast check passes. Check: e2e `gloam-downs-run.cards.e2e.mjs` (`ONLY=layout`) and `gloam-downs-screens.e2e.mjs`.

#### Scenario: Grid moves on lamp cards
- **WHEN** the three spark cards stand in a row and the right arrow is pressed on the first
- **THEN** the focus goes to the second card, not to a button below. Check: Node test `gloam-downs-screens.test.mjs` (`cards.js` grid move with stand-in rects).

### Requirement: Screens with reduced motion
With reduced motion the screens SHALL NOT drift, rise, scale, shake or flare. Changes SHALL be fades of 150 ms or less, and numbers SHALL change at once. Every choice SHALL still work the same.

#### Scenario: Reduced motion title and picks
- **WHEN** the page loads with `prefers-reduced-motion: reduce` and the beacon card deals its wicks
- **THEN** the title's view equals the start camera's on every draw, each card's transform is none at every sample, and no animation runs longer than 150 ms. Check: e2e `gloam-downs-screens.e2e.mjs` (emulated media).

### Requirement: Screen sounds
The cues `hover`, `reveal`, `pick`, `kindle` and `tally` SHALL be in `CUES` with recipes in the place's key, each quieter than `choice` at its peak. `hover` SHALL play at most once each 60 ms and `tally` at most 12 times a roll. Before the first press they SHALL be silent, as all sound is.

#### Scenario: The screen cues are quieter than a choice
- **WHEN** each new cue and `choice` are rendered offline in the Gaol's key
- **THEN** each new cue's peak is under `choice`'s, and none clips. Check: e2e `gloam-downs-screen-sound.e2e.mjs`.

### Requirement: Ambient life
Each of the five places SHALL have ambient life in its own palette and mood, as design.md "Per place" lists: moths at lamps, embers or motes, falling leaves, flakes or ash, mist in hollows, flicker at lamps, and grass or rags that sway. The life SHALL move by the splat shader's own motion kinds, with no change to the renderer. It SHALL show in the run and in the explorer. What floats SHALL not draw between the eye and the lamplighter.

#### Scenario: Each place has its life
- **WHEN** each place is built with `makeLife` from its baked files
- **THEN** it has at least 6 lamp anchors, moths at them, at least one falling kind, swaying tufts, and every life row's motion kind is one of 0, 1, 2, 3, 6, 7, 8, 11, 14 or 15. Check: Node test `gloam-downs-life.test.mjs`.

#### Scenario: Life can be seen
- **WHEN** the Gaol is drawn at the same view at game times 0 s and 1 s, with no foe awake
- **THEN** at least 0.2% of the picture's pixels differ between the two, and at least 1.5 times as many as with `__gloam.life({ on: false })` (the baked fires and embers already move about 0.8% of it). Check: e2e `gloam-downs-life.e2e.mjs`.

#### Scenario: No pale squares in front of the lamplighter
- **WHEN** a mote, drip, firefly, leaf or mist dab is nearer the drawn eye than the lamplighter less 1 m, on the title's drift or the follow camera at any layout
- **THEN** its density is 0, and it shows again once it is farther than the lamplighter less 0.5 m; a still eye writes no row after the crossing. Check: Node test `gloam-downs-life.test.mjs`, and the title pictures at 1280x720 and 390x844 from `gloam-downs-screens.e2e.mjs` with `SHOTS`.

### Requirement: Life answers the lamplighter
A crow flock SHALL take off when the lamplighter comes within 5 m, a foe within 3 m or a hit lands within 6 m, fly away over 2.5 s and stay gone until the place is entered again. A lamp's halo SHALL brighten within 4 m of the lamplighter. A gust every 9 to 20 s SHALL lean the tufts and shed leaves. Each SHALL emit `life-stir`.

#### Scenario: Crows lift
- **WHEN** the lamplighter is teleported 4 m from a crow flock on The Crow Wall and the game steps 3 s
- **THEN** that flock's birds are put away, the bus heard `life-stir` with kind `crows`, and the cue log of the run's sound has a wing flutter. Check: e2e `gloam-downs-life.e2e.mjs`, and Node test `gloam-downs-life.test.mjs`.

#### Scenario: A lamp brightens as the lamplighter passes
- **WHEN** the lamplighter stands 3 m from a lamp anchor for 0.5 s, then walks 8 m away for 1.5 s
- **THEN** the anchor's halo dabs were 0.07 m with slot 47, and are back to 0.04 m with slot 46. Check: Node test `gloam-downs-life.test.mjs`.

### Requirement: Life never looks like a tell
No life dab SHALL use palette slots 34 to 37. Lamp halos SHALL use 46 and 47 only within 0.6 m of a lamp anchor. Within 8 m of an awake foe, life's bright dabs SHALL fade to nothing within 0.3 s, and return 2 s after the fight there is calm.

#### Scenario: No fire slot
- **WHEN** each place's life is built and stepped through a gust and a flock's flight
- **THEN** no life row's colour equals the place's palette slots 34 to 37. Check: Node test `gloam-downs-life.test.mjs`.

#### Scenario: The hush by a wind-up
- **WHEN** a Snuffer wakes 4 m from a lamp anchor in the Gaol and winds up its hook
- **THEN** after 0.3 s no bright life dab (ember, mote, firefly, moth, halo) within 8 m of it has density over 0, and the phone tell check passes with life on. Check: e2e `gloam-downs-run.fight.e2e.mjs` and `gloam-downs-life.e2e.mjs`.

### Requirement: Life budget
Life SHALL use at most 1,200 splats in a place, and the place with its pool, the sparks and life SHALL stay at or under 277,000. In steady play with a still eye life SHALL write no row; with a flock in flight or a gust, at most 4 rows of 512 a frame. At 390x844 the median frame time with life SHALL be at most 1.05 times that without it, and at most 1.08 in any one view.

#### Scenario: The count
- **WHEN** each place is built with its pool, the sparks and life
- **THEN** life has 1,200 splats or fewer and the total is 277,000 or fewer, and the test prints both. Check: Node test `gloam-downs-life.test.mjs`.

#### Scenario: The frame time on a phone layout
- **WHEN** each place is drawn at 390x844 with touch at three views (start, a lamp, the beacon), 120 timed draws each, life on and off by turns in blocks of 10
- **THEN** the median ratio over all 15 views is 1.05 or less, no view is over 1.08, and life's own median time a draw is 0.25 ms or less. Check: e2e `gloam-downs-life.e2e.mjs` (SwiftShader; `WARM`, `DRAWS` and `BLOCK` lower the counts on a slow machine, and the run prints them; no real phone is checked).

### Requirement: Life with reduced motion
With reduced motion life SHALL hold still: no rising, falling, wandering or flying. Flicker SHALL become a soft steady glow, crows SHALL fade where they sit instead of flying, and leaves SHALL lie on the ground.

#### Scenario: Still life
- **WHEN** the Gaol loads with `prefers-reduced-motion: reduce`
- **THEN** every life row's motion kind is 0 or 7, and a flock that is neared fades in place. Check: Node test `gloam-downs-life.test.mjs` (`still: true`), and e2e `gloam-downs-life.e2e.mjs`.

### Requirement: The world answers the screens
On `screen-hover` the beacon's glow SHALL brighten in the hovered colour for 0.3 s, and on `screen-pick` or `spark-take` it SHALL flare for 0.5 s. On `beacon-lit` the lamp anchors within 15 m of the beacon SHALL brighten one after another, nearest first. None of it SHALL use slots 34 to 37.

#### Scenario: A pick flares the beacon
- **WHEN** the Gaol's beacon card is open and Flame +1 is picked
- **THEN** within 0.1 s life shows 8 dabs round the beacon in slot 33, gone after 0.6 s. Check: Node test `gloam-downs-life.test.mjs`, and e2e `gloam-downs-screens.e2e.mjs` after the merge.

### Requirement: Sound beds
Each place SHALL have a quiet sound bed made in code under the music: wind and a few sparse sounds of its own. A gust SHALL swell the wind with the gust, and a flock's take-off SHALL play wings and caws at the flock. The beds SHALL duck 6 dB while foes are awake, stop in the boss fight and the Lamp-room, and play only in a run.

#### Scenario: Bed levels
- **WHEN** the music demo's `beds` group renders each bed for 30 s with two gusts and one flock
- **THEN** each bed alone is 10 LU or more under its place's explore music and over -52 LUFS, and with that music the level moves by 0.5 LU or less. Check: `qa/lab/gloam-downs-music-demo.mjs` (group `beds`).

#### Scenario: A gust is heard
- **WHEN** life emits `life-stir` with kind `gust` in a run with sound on
- **THEN** the beds log a wind swell of 2 s within 50 ms. Check: Node test `gloam-downs-sound.test.mjs`.
