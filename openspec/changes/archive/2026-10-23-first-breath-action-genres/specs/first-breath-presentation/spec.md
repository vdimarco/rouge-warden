## ADDED Requirements

### Requirement: New things are cut paper
Every new thing in the action stages SHALL be drawn as cut paper with the sticker rule: your shots as cream dots, foe sparks as keylined diamonds, germs as sage and teal blobs with zigzag cut edges, white cells as large pale lilac blobs with a dotted rim, pickups as cream squares, plus-cut glows and small stars, and a pop as a small burst of paper confetti. Number pops, hp pips and the boss bar SHALL be DOM tags, so the canvas still draws no text.

#### Scenario: Shapes, not hue
- **WHEN** a frozen frame of stage 1 at an item row, stage 2's swarm, stage 3's Knot and stage 7's Big Germ wave is shown in greyscale
- **THEN** your shots, foe sparks, germs and pickups are still told apart by their round, diamond, zigzag, square, plus and star shapes, and each has its keyline
- **CHECK** `qa/first-breath/visual.e2e.mjs`, `qa/first-breath/shots.mjs`

#### Scenario: Marigold stays you
- **WHEN** the palette tokens of the new things are read
- **THEN** none is the marigold `#ffc53d`, and each cue token keeps 3:1 against its keyline and its `under` tokens in all four views
- **CHECK** `qa/first-breath/paper.test.mjs`

### Requirement: The race and the guard in paper
Stage 1's item boxes SHALL be cream paper cubes with a cut swirl, and its drift sparks SHALL be 1, 2 or 3 confetti pieces a puff for blue, orange and pink. Stage 2's glow SHALL be a cream disc with a gold halo, its rivals SHALL show hits left as 1 to 3 cream dots, capped ones with a cream cap, and its power-ups SHALL be cream discs with a cut icon and a DOM tag.

#### Scenario: Drift levels in greyscale
- **WHEN** a frozen frame of each drift level is shown in greyscale
- **THEN** blue, orange and pink are told apart by 1, 2 and 3 confetti pieces a puff
- **CHECK** `qa/first-breath/visual.e2e.mjs`

#### Scenario: Hits left in greyscale
- **WHEN** a frozen frame of stage 2's W3 is shown in greyscale
- **THEN** plain, tough and capped rivals are told apart by their dots and caps, and the glow by its halo
- **CHECK** `qa/first-breath/visual.e2e.mjs`

### Requirement: New places are cut paper
Stage 1's bending tube SHALL be cut as sheets in world tiles, its knockout gates as pale rose bands with cut dashes and its cool tide as a lilac sheet with a cut wavy front that stays put, stage 4's tunnels SHALL be holes cut in the front lining sheet, stage 6's lanes SHALL be paper strips with cut dashes, and stage 8's folds SHALL be plum flaps from the side flats that never close a ring round the light.

#### Scenario: Paper in every new place
- **WHEN** stages 1, 4, 6 and 8 are frozen at 390 × 844
- **THEN** the bends, the gates, the tide, the tunnels, the lanes and the folds are drawn as sheets with cut edges and drop shadows, and in stage 8 no closed ring of sheet edges surrounds the light
- **CHECK** `qa/first-breath/visual.e2e.mjs`, `qa/first-breath/paper.test.mjs`

### Requirement: The action in the free part of the screen
In every action stage, in portrait, you and the arena SHALL stay above 60% of the screen height, and no foe SHALL spawn in the bottom 40%, except stage 2's formations, which sit all round the egg. In every layout the hp pips, stage 1's place slot with its "racing", gate and item tags, the boss bar, gift tags and any edge arrow SHALL sit inside the safe area and overlap no HUD, prompt or caption box.

#### Scenario: Portrait with insets
- **GIVEN** each action stage at 390 × 844 with `?inset=47,0,34,0`
- **WHEN** the stage plays with the reference bot
- **THEN** your screen point stays at or above 60% of the height, and every new HUD box is inside the insets with no overlap
- **CHECK** `qa/first-breath/layout.e2e.mjs`

## MODIFIED Requirements

### Requirement: The egg and its arc in the free part of the screen
In stage 2 the egg's centre SHALL be the layout's subject point: 45% of the height in portrait; 38% of the width and 55% of the height in landscape; 40% of the width and half the height on desktop. The camera SHALL show 140 u across the short axis. The shell, the arc, the rim, every rival in formation, every stuck or held sperm and the gold sperm SHALL stay inside the safe area, under no HUD, prompt or caption, in 390 × 844, 844 × 390 and 1440 × 900.

#### Scenario: Portrait guard
- **GIVEN** `?seed=1&moment=guard` at 390 × 844, stepped through W3 and then to when the gold sperm burrows at the shell
- **WHEN** the frame and `__fb.guard()` are read
- **THEN** the egg's centre is at 45% of the height, the rim and every rival are inside the safe area, the gold sperm and every stuck sperm are between the caption band and 60% of the height, and none is under the HUD or prompt
- **CHECK** `qa/first-breath/layout.e2e.mjs`

#### Scenario: Landscape and desktop guard
- **GIVEN** the same guard frames at 844 × 390 and 1440 × 900
- **WHEN** the frame and `__fb.guard()` are read
- **THEN** the egg's centre is at 38% of the width and 55% of the height in landscape, and at 40% of the width and half the height on desktop, and the rim, every rival, every stuck sperm and the gold sperm are inside the screen and under no HUD, prompt or caption box
- **CHECK** `qa/first-breath/layout.e2e.mjs`

### Requirement: One draw list for both tiers
Every stage SHALL describe its frame as one draw list of plain data within the limits: at most 32 splats with the baby figure included, 600 points, 6 strips, 24 marks and 8 rings, plus the action part (bullets, foes, pickups, tells and pops) within the caps of `core/draw.js` that `contract.md` sets. The renderer SHALL add at most 150 decorative motes in the full tier and none in the low tier. The full paper tier and the low tier SHALL both draw only that list, with Canvas 2D. Still sheets SHALL be baked into offscreen canvases, and frames that bake SHALL be left out of the frame cost.

#### Scenario: Draw lists stay in budget
- **WHEN** every 30th view of each stage's reference and idle runs is validated in node
- **THEN** no list exceeds a limit or a cap
- **CHECK** `qa/first-breath/draw.test.mjs`

### Requirement: Frame budgets
Under `?probe=1`, with the scale step pinned (`?res=0.5` on the two phone sizes, `?res=0.35` on desktop, whose base is capped at 0.6 MP), the 95th percentile of the frame cost over 120 frames SHALL be 16 ms or less in the full tier and 10 ms or less in the low tier, in every stage, measured at each stage's busiest moment: stage 1 at Gate 2 with the pack bunched, stage 2 in the swarm's third phase with 6 glows, stage 3 in the Knot's second phase, stage 4 while a tunnel is cut, stage 5 at the big germ, stage 6 in the sing-along, stage 7 in the Big Germ wave and stage 8 in wave 8.

#### Scenario: Pinned scale
- **WHEN** each stage is stepped to its busiest moment and then runs 120 more frames at 390 × 844, 844 × 390 and 1440 × 900 with its pinned step and `?probe=1`, in the full tier and then with `?q=low`, in runs with no luminance probes
- **THEN** `__fb.perf.p95Ms` is at most 16 in the full tier and at most 10 in the low tier, `__fb.perf.splats` at most 32, and `__fb.perf.draws` within the measured cap in the design
- **CHECK** `qa/first-breath/perf.e2e.mjs`

### Requirement: The HUD and prompt line
The HUD SHALL show the stage name and the clock label at the top left and the score and the pause button at the top right. In stage 1 a slot under the score SHALL show the place, such as "3rd of 20", with small tags under it for how many still race, the next gate when it is near, and the item you hold. In stages 2, 3, 4, 5 and 7 the hp pips SHALL sit under the score, with shield sparks as brighter pips. A boss bar SHALL show under the prompt line while a boss is on screen. The scale bar SHALL sit at the top left under the clock in portrait, and at the bottom left in landscape and desktop. A prompt line under the HUD SHALL name the live gesture with an icon. Text SHALL be at least 16 px, and 20 px with Large text.

#### Scenario: Large text
- **WHEN** the player turns on Large text at 390 × 844
- **THEN** HUD and caption text grow to 20 px and 22 px with no overlap
- **CHECK** `qa/first-breath/layout.e2e.mjs`

#### Scenario: The place slot in every layout
- **GIVEN** stage 1 at 390 × 844 and 844 × 390 with touch, and at 1440 × 900, with `?inset=47,0,34,0`
- **WHEN** the race is under way
- **THEN** the slot reads the same place as `__fb.race()`, sits under the score inside the safe area, above 60% of the height in portrait, and overlaps no HUD, prompt or caption box
- **CHECK** `qa/first-breath/layout.e2e.mjs`

#### Scenario: Hp and the boss bar
- **GIVEN** stage 3's Knot at 390 × 844 with `?inset=47,0,34,0`
- **WHEN** the Knot is on screen and you have been hit once
- **THEN** the hp pips show one dim pip, the boss bar shows its share of hp, and neither overlaps the prompt, the captions or the pause button
- **CHECK** `qa/first-breath/layout.e2e.mjs`

#### Scenario: The scale bar in portrait
- **WHEN** stage 4 is shown at 390 × 844
- **THEN** the scale bar sits under the clock at the top left, above 60% of the height
- **CHECK** `qa/first-breath/layout.e2e.mjs`

### Requirement: A ring budget
A frame SHALL have at most 8 DOM rings. In stage 6 they SHALL be her ring and the target rings of the notes in view. In stage 2 they SHALL be her ring, the seal charge ring, and burrow rings capped at 6. In the other action stages the DOM rings SHALL be only her ring and at most 3 cue rings; telegraphs, spawn tells and contact rings SHALL be drawn on the canvas.

#### Scenario: Rings at the seal
- **GIVEN** stage 2's rush with the arc held still, so the four rivals and the gold sperm burrow at once
- **WHEN** `svg#rings` is read
- **THEN** it holds her ring, the charge ring and at most 6 burrow rings, 8 in all at most
- **CHECK** `qa/first-breath/input.e2e.mjs`, `qa/first-breath/draw.test.mjs`

### Requirement: Reduced motion
With `prefers-reduced-motion: reduce`, `?rm=1` or the Motion setting at Reduced, the game SHALL halve the sway of the paper sheets, drop scale bounce, screen shake and hit-stop, change beats by brightness only, keep the walls still during contractions and the stage 8 surges, show pops as a fade with no flying confetti, and make the birth light a plain 1.5 s fade. The stage change SHALL stay the same 0.8 s crossfade. The rhythm, the timing and the speed of play SHALL stay the same.

#### Scenario: Emulated reduced motion
- **WHEN** a stage runs with reduced motion emulated
- **THEN** `__fb.motion.warpAmp` is at most half its full value, `bounce` is 0, and the draw list's `shake` is 0 after a hit
- **CHECK** `qa/first-breath/visual.e2e.mjs`

#### Scenario: The stage change
- **WHEN** a stage ends with reduced motion
- **THEN** the next stage arrives by a 0.8 s crossfade with no scale bounce
- **CHECK** `qa/first-breath/visual.e2e.mjs`

### Requirement: Flash safety
The game SHALL make one swell per heartbeat, never one each for "lub" and "dub". A full-screen tint SHALL follow only the mother's heart and change frame luminance by 6% or less. The baby's faster heart SHALL move only its ring and a small splat. A hit SHALL blink only you, and a foe's hit flash only that foe. There SHALL be no more than 3 luminance swings of 10% or more in any 1 s, no red flashes, and the birth light SHALL rise steadily, in every stage and in the busiest fights.

#### Scenario: Busy stages
- **GIVEN** `?test=1&probe=1`
- **WHEN** stage 2's swarm, stage 3's Knot, stage 5's big germ, stage 6's sing-along, stage 7's Big Germ wave and stage 8's last waves are stepped one frame at a time with `__fb.step(1)` for 300 frames (5 s), reading `__fb.lum()` after each
- **THEN** no 60-frame window has more than 3 swings of 10% or more
- **CHECK** `qa/first-breath/visual.e2e.mjs`

#### Scenario: A hit is not a flash
- **GIVEN** `?test=1&probe=1` in stage 5
- **WHEN** you are hit
- **THEN** the frame's mean luminance changes by less than 6% over the next 10 frames, and no pixel turns more red than the stage palette allows
- **CHECK** `qa/first-breath/visual.e2e.mjs`

#### Scenario: Birth light
- **GIVEN** `?test=1&probe=1`
- **WHEN** the light after wave 8 is stepped one frame at a time
- **THEN** the mean luminance never falls by more than 1%, and it ends at 0.95 or more on a full-screen `#ffffff` sheet with the grain faded to 0
- **CHECK** `qa/first-breath/visual.e2e.mjs`

### Requirement: Colour-blind safe cues
No goal SHALL depend on hue alone. Cues SHALL differ by shape and brightness: solid and dashed rings with a dot for the two hearts, dotted rims for gland pools, wavy rims for blood pools, chevrons for the racing line, cut dashes for the gates, drift sparks counted by pieces, round shots, diamond sparks, zigzag germs, dashed lanes and words for grades. Every cue SHALL be drawn as a sticker: a 2 px ink keyline outside (its halo; cream in the ending), a cream margin when the cue is not cream, then the cue.

#### Scenario: Shapes, not hue
- **WHEN** each stage is frozen and shown in greyscale
- **THEN** each cue is still told apart by its ring, dash, dot, rim, chevron, shape or word, and each has its keyline
- **CHECK** `qa/first-breath/visual.e2e.mjs`, `qa/first-breath/shots.mjs`
