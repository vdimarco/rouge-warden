# first-breath-presentation Specification

## Purpose
How First Breath looks and sounds: the paper-cut look, the HUD, captions and screens in each layout, and the synthesized sound of her heartbeat and the birth.

## Requirements

### Requirement: The paper-cut look
The game SHALL draw every stage as flat sheets of coloured paper stacked like a shadow box or tunnel book, using the paper colour script in the design for each stage. Each sheet SHALL be one flat colour with a fine grain that moves with its sheet, with hand-cut edges that stay put from frame to frame. Depth SHALL come only from soft drop shadows between sheets, with the light above and a little left in every layout.

#### Scenario: A paper cell
- **GIVEN** `?seed=1&freeze=1&stage=3` at 390 × 844
- **WHEN** the palette and the frame are read
- **THEN** stage 3's cell token has a contrast of at least 3:1 against its back sheet and a higher R / (G + B), the brightest ring within 8 px of a cell's edge is its pale cut edge, and the pixels just below and right of the cell are darker than the back sheet
- **CHECK** `qa/first-breath/palette.test.mjs`, `qa/first-breath/visual.e2e.mjs`

#### Scenario: Edges stay put
- **WHEN** a course edge is cut from two overlapping windows, and a list of tails or splats is drawn in another order
- **THEN** the cut offsets are the same where the windows overlap, and every outline is the same, because no cut depends on an index or on the window's start
- **CHECK** `qa/first-breath/paper.test.mjs`

### Requirement: Depth, one accent and the rising light
Frame sheets SHALL get darker toward the viewer, and the subject SHALL sit on the highest sheet with the deepest shadow. One marigold accent SHALL mark "you". Light SHALL rise over the run from dim violet-red sheets to deep red, rose, amber and ember, then plum toward a bright opening at birth and a warm cream room in the ending. In each stage the cue the player needs now SHALL be the brightest thing on screen.

#### Scenario: No black stage
- **WHEN** each stage is frozen at 390 × 844, 844 × 390 and 1440 × 900
- **THEN** the mean luminance of every frame is above 0.04, and a screenshot of each is saved for the pull request
- **CHECK** `qa/first-breath/visual.e2e.mjs`, `qa/first-breath/shots.mjs`

#### Scenario: The brightest cue
- **WHEN** each stage is frozen and the page is captured with its DOM rings
- **THEN** the luminance at the cue's screen position is at or above the frame's 95th percentile
- **CHECK** `qa/first-breath/visual.e2e.mjs`

#### Scenario: Light rises
- **WHEN** the frozen frames of stages 1 to 7 at 390 × 844 are compared
- **THEN** each stage's mean luminance is at least 0.9 times the one before, and stage 7's is at least twice stage 1's
- **CHECK** `qa/first-breath/visual.e2e.mjs`

### Requirement: Labels are paper tags in the DOM
The canvas SHALL draw no text. The place slot, the prompt line, the captions, the stage name and the clock SHALL be DOM elements styled as small cream paper tags, at the positions the HUD and layout requirements give, so the layout checks read their boxes. CSS shadows MAY be used on DOM tags; the canvas SHALL use no `ctx.filter` and no `shadowBlur`.

#### Scenario: No canvas text
- **GIVEN** a spy on the canvas `fillText` and `strokeText` installed before the page loads
- **WHEN** every stage, screen and tier is shown
- **THEN** neither is ever called, and the place slot, prompt and captions are DOM boxes
- **CHECK** `qa/first-breath/visual.e2e.mjs`

### Requirement: One draw list for both tiers
Every stage SHALL describe its frame as one draw list of plain data within the limits: at most 32 splats with the baby figure included, 600 points, 6 strips, 24 marks and 8 rings, plus the action part (bullets, foes, pickups, tells and pops) within the caps of `core/draw.js` that `contract.md` sets. The renderer SHALL add at most 150 decorative motes in the full tier and none in the low tier. The full paper tier and the low tier SHALL both draw only that list, with Canvas 2D. Still sheets SHALL be baked into offscreen canvases, and frames that bake SHALL be left out of the frame cost.

#### Scenario: Draw lists stay in budget
- **WHEN** every 30th view of each stage's reference and idle runs is validated in node
- **THEN** no list exceeds a limit or a cap
- **CHECK** `qa/first-breath/draw.test.mjs`

### Requirement: A low quality tier
The low tier SHALL draw the same sheets as the full tier with no grain, one flat shadow per sheet, no motes and no dapple sheet, so it still reads as paper cut. `?q=low` SHALL pin it, with `?gl=0` as an alias, and `?q=full` SHALL pin the full tier. Without `?q`, the game SHALL switch to the low tier for the rest of the run when the rAF interval averages more than 20 ms for 60 frames at a scale step of 0.5 or lower, and `__fb.perf.fallback` SHALL then be true.

#### Scenario: The low tier in every stage
- **WHEN** each stage runs with `?q=low`, and again with `?gl=0`
- **THEN** its frame has a mean luminance above 0.04, and the subject's sheet is brighter than the frame's median
- **CHECK** `qa/first-breath/smoke.e2e.mjs`

### Requirement: Smooth frames
The frame cost SHALL be the JavaScript time of one frame, from the start of its fixed steps to the end of its draw calls. Under `?probe=1` each frame SHALL end with a 1 px `getImageData` of the canvas, so the cost includes the raster. The checks SHALL run in headless Chromium with `--disable-gpu` and no SwiftShader flags. No canvas SHALL use `willReadFrequently`.

#### Scenario: The probe counts the raster
- **GIVEN** `?probe=1` in headless Chromium with `--disable-gpu`
- **WHEN** a stage runs
- **THEN** each frame ends with a 1 px readback of the canvas, and no canvas was created with `willReadFrequently`
- **CHECK** `qa/first-breath/perf.e2e.mjs`

### Requirement: Frame budgets
Under `?probe=1`, with the scale step pinned (`?res=0.5` on the two phone sizes, `?res=0.35` on desktop, whose base is capped at 0.6 MP), the 95th percentile of the frame cost over 120 frames SHALL be 16 ms or less in the full tier and 10 ms or less in the low tier, in every stage, measured at each stage's busiest moment: stage 1 at Gate 2 with the pack bunched, stage 2 in the swarm's third phase with 6 glows, stage 3 in the Knot's second phase, stage 4 while a tunnel is cut, stage 5 at the big germ, stage 6 in the sing-along, stage 7 in the Big Germ wave and stage 8 in wave 8.

#### Scenario: Pinned scale
- **WHEN** each stage is stepped to its busiest moment and then runs 120 more frames at 390 × 844, 844 × 390 and 1440 × 900 with its pinned step and `?probe=1`, in the full tier and then with `?q=low`, in runs with no luminance probes
- **THEN** `__fb.perf.p95Ms` is at most 16 in the full tier and at most 10 in the low tier, `__fb.perf.splats` at most 32, and `__fb.perf.draws` within the measured cap in the design
- **CHECK** `qa/first-breath/perf.e2e.mjs`

### Requirement: Adaptive scale
The scale step SHALL apply to each axis of the canvas, and it SHALL move only on the rAF interval. Without `?res` and `?q`, the adaptive scale SHALL settle at a step of 0.5 or more on the two phone sizes and 0.35 or more on desktop, switching to the low tier first if the frames stay slow.

#### Scenario: Adaptive scale
- **WHEN** each stage runs for 6 s with no `?res` and no `?q`
- **THEN** `__fb.perf.scale` is at least 0.5 at 390 × 844 and 844 × 390, and at least 0.35 at 1440 × 900, and once `__fb.perf.fallback` is true it stays true
- **CHECK** `qa/first-breath/perf.e2e.mjs`

### Requirement: Core step cost
In node, the 99th percentile of a stage step SHALL be 1 ms or less, and the bot suite of 20 seeds by 4 skills SHALL finish within 120 s.

#### Scenario: Core step cost
- **WHEN** each stage's reference run is timed in node
- **THEN** the 99th-percentile step takes 1 ms or less, including space colonization
- **CHECK** `qa/first-breath/perf.test.mjs`

#### Scenario: Bot suite time
- **WHEN** the bot suite runs 20 seeds at skills 1.0, 0.7, 0.5 and 0
- **THEN** it finishes within 120 s of wall time
- **CHECK** `qa/first-breath/sim.test.mjs`

### Requirement: Three layouts
The game SHALL fit phone portrait (390 × 844, touch), phone landscape (844 × 390, touch) and desktop (1440 × 900, keys), with no horizontal scroll on any screen. Every interactive control SHALL be at least 44 px on its shorter side, Play at least 56 px tall and pause 48 × 48 px. The HUD, prompt line, captions and controls SHALL sit inside the safe-area insets and SHALL NOT overlap.

#### Scenario: Portrait with insets
- **GIVEN** 390 × 844 with `?inset=47,0,34,0`
- **WHEN** each stage and screen is shown
- **THEN** the HUD, prompt and captions are inside the insets and nothing overlaps
- **CHECK** `qa/first-breath/layout.e2e.mjs`

#### Scenario: Landscape
- **GIVEN** 844 × 390 with touch
- **WHEN** each screen is shown
- **THEN** every button is at least 44 px on its shorter side and the page does not scroll sideways
- **CHECK** `qa/first-breath/layout.e2e.mjs`

#### Scenario: Desktop
- **GIVEN** 1440 × 900
- **WHEN** each screen is shown
- **THEN** the canvas backing store is at most 0.6 MP before the scale step, and every screen fits without scrolling
- **CHECK** `qa/first-breath/layout.e2e.mjs`

### Requirement: The thumb zone in portrait
In portrait, the bottom 40% of the screen is the thumb zone. During play (the stages, their overlays and the ending) the subject SHALL stay above it, and nothing to read SHALL sit in it. Menus and cards MAY use the whole screen. Captions SHALL sit in a band at 50% to 58% of the height in portrait (18% to 26% in stage 2, above the egg), and at the bottom centre in landscape and desktop. In stage 1 in portrait, captions SHALL be one line and SHALL show for 2.5 s.

#### Scenario: Captions and text in portrait
- **GIVEN** 390 × 844
- **WHEN** each stage, its overlay and the ending are shown
- **THEN** captions sit between 50% and 58% of the height (between 18% and 26% in stage 2), and no HUD, caption or overlay text sits below 60% of the height
- **AND** in stage 1 each caption is one line and is gone within 2.5 s
- **CHECK** `qa/first-breath/layout.e2e.mjs`

#### Scenario: Thumb reach
- **WHEN** each stage is shown at 390 × 844
- **THEN** the subject's screen position is at or above 60% of the height
- **CHECK** `qa/first-breath/layout.e2e.mjs`

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

### Requirement: The gold sperm's path and the bright arc
In portrait the gold sperm's path SHALL never pass under a caption or below 60% of the height. The arc SHALL be the brightest band in the guard.

#### Scenario: The gold's path in portrait
- **GIVEN** stage 2 at 390 × 844 over 20 seeds and stage 1 places of 1, 3 and 20
- **WHEN** the gold sperm comes in and enters, with no input and with the reference bot
- **THEN** its screen point is never inside a caption box and never below 60% of the height
- **CHECK** `qa/first-breath/layout.e2e.mjs`

#### Scenario: The arc is the brightest band
- **WHEN** a frozen guard frame is captured with its DOM rings
- **THEN** the luminance on the arc is at or above the frame's 95th percentile
- **CHECK** `qa/first-breath/visual.e2e.mjs`

### Requirement: Womb sound
The game's own sounds SHALL be synthesized in one graph built on the Play tap against an injected AudioContext, with no audio files; only the score uses samples. Every source except the birth sounds and the score SHALL pass a womb low-pass bus. The voice SHALL be a sine hum. The mother's beat sounds SHALL come from the run's beat clock, so sound and picture agree and the beat does not jump at a stage start. The mother's heart SHALL include 2nd and 3rd harmonics so phone speakers carry it.

#### Scenario: Inside the womb
- **WHEN** 6 s of stage 1 audio from the sound graph alone, with no score, is rendered with OfflineAudioContext
- **THEN** at least 90% of the energy is below 500 Hz, and envelope peaks match the mother's beat times within 5 ms
- **CHECK** `qa/first-breath/sound.e2e.mjs`

#### Scenario: Two hearts
- **WHEN** 6 s after the stage 4 hinge is rendered
- **THEN** a second peak train at about 110 bpm sits under the mother's beat
- **CHECK** `qa/first-breath/sound.e2e.mjs`

#### Scenario: Across a stage change
- **WHEN** the audio from the end of a stage, through its overlay and card, into the next stage is rendered
- **THEN** the mother's beat peaks keep an even spacing within the rate glide, with no extra or missing beat
- **CHECK** `qa/first-breath/sound.e2e.mjs`

#### Scenario: The score skips the womb filter
- **GIVEN** stage 1 with the womb cutoff at 150 Hz and the score playing into `sound.scoreDest()`
- **WHEN** 6 s of the whole mix is rendered with OfflineAudioContext
- **THEN** the mix has clear energy above 1 kHz from the score, while the womb bus alone keeps at least 90% of its energy below 500 Hz
- **CHECK** `qa/first-breath/music.e2e.mjs`

#### Scenario: Mute silences the score
- **GIVEN** stage 1 with the score playing
- **WHEN** the sound is muted
- **THEN** the score falls silent with the rest, because it joins the master after the mute
- **CHECK** `qa/first-breath/music.e2e.mjs`

### Requirement: Hearing grows over the run
The womb bus cutoff SHALL be 150 Hz with heart harmonics kept in stages 1 to 5 (felt, not heard), 250 Hz at week 15 rising to 450 Hz at week 27, up to 600 Hz in the third trimester, 300 Hz in the squeeze, and SHALL open to 16 kHz over 1.5 s at birth.

#### Scenario: The cutoff by stage
- **WHEN** `__fb.sound.cutoffHz` is read at the start of stage 3, at week 15 and week 27 in stage 6, and in the squeeze
- **THEN** it reads 150, 250, 450 and 300 Hz
- **CHECK** `qa/first-breath/sound.e2e.mjs`

#### Scenario: The world opens
- **WHEN** audio before and after the birth opening is rendered
- **THEN** energy above 2 kHz is more than 20 dB higher after the opening
- **CHECK** `qa/first-breath/sound.e2e.mjs`

### Requirement: Captions and a picture for every sound
Captions SHALL be on by default in an `aria-live="polite"` region, with a symbol and a direction where it helps. Every sound cue SHALL also have a visual cue: every beat a ring, every hummed note a ripple, every answer note a ghost ripple, every bump or bounce a small contact ring, and every target a DOM ring in `svg#rings` before its time. The contact rings SHALL NOT be cut. Stages 2, 3, 5 and 6 SHALL be playable with sound off.

#### Scenario: Muted rhythm stage
- **GIVEN** the sound muted with M
- **WHEN** stage 2 plays
- **THEN** every target has a DOM ring in `svg#rings` at least its preview time, max(2 beats, 1.2 s), before its time
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Captions name the sound
- **WHEN** the voice hums from the left in stage 6
- **THEN** a caption such as "♪ voice, left: 3 notes" shows
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

### Requirement: Cue contrast
Each cue colour SHALL have a contrast of at least 3:1 against its keyline. Each cue SHALL read against every sheet it can sit on: for a sticker, its keyline or its light layer, whichever contrasts more, at least 3:1; for a plain cue with no keyline, the cue itself at least 3:1. In stages 1 and 2 the player's sperm SHALL be at least 2.25:1 brighter than the rivals. All of this SHALL hold in normal vision and under protan, deutan and tritan simulation.

#### Scenario: Palette test
- **WHEN** every cue token in `render/palette.js` is checked against its keyline and its `under` tokens with the Machado 2009 matrices
- **THEN** every pair meets 3:1 in all four views, and the player's sperm is at least 2.25:1 above the rivals
- **CHECK** `qa/first-breath/palette.test.mjs`

#### Scenario: A cue on a pale sheet
- **GIVEN** stage 5, where the cord lights sit on the cord and the heart sits on the body
- **WHEN** the palette is checked
- **THEN** the plain cord lights have at least 3:1 against the cord, and the heart's sticker has at least 3:1 against the body and the sac
- **CHECK** `qa/first-breath/palette.test.mjs`

### Requirement: The scale bar
Between stages the game SHALL crossfade for 0.8 s. A scale bar SHALL show a round real length, and the real span of the short screen axis SHALL never shrink over the run, from 0.3 mm in stage 1 to 2 m in the ending. In stages 1 and 2, whose spaces are not drawn to scale, the bar SHALL show only the subject's own size.

#### Scenario: The scale only grows
- **WHEN** a whole run is played in node
- **THEN** the real span across the short axis never decreases from one step to the next
- **CHECK** `qa/first-breath/run.test.mjs`

#### Scenario: Not to scale
- **WHEN** stage 1 or stage 2 is shown
- **THEN** the bar reads only the subject's size, "You: about 0.05 mm" or "You: about 0.1 mm", and the stage 1 sperm cell is drawn 22 u long, 13% to 15% of the short axis
- **CHECK** `qa/first-breath/layout.e2e.mjs`

### Requirement: An abstract, warm baby
The embryo, fetus and newborn SHALL be a few rounded paper pieces on a 2D skeleton with no face and no expression. The newborn SHALL never be drawn blue, grey, dusky or limp, and SHALL show no lungs or other anatomy. Its warmth SHALL rise only as a warm paper glow. The skin-to-skin image SHALL be two plain paper ovals, a big warm one and a small one, in a circle of cream light, with no face, no limbs and no head-and-shoulders outline.

#### Scenario: Ending colours
- **WHEN** a frozen frame of skin-to-skin is read
- **THEN** its mean R is above its mean G, which is above its mean B
- **AND** every chromatic ending palette token has a hue between 0° and 50°, with achromatic tokens such as white skipped
- **CHECK** `qa/first-breath/visual.e2e.mjs`, `qa/first-breath/palette.test.mjs`

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

### Requirement: An original score in the Family Guy idiom
The game SHALL play an original orchestral score in the idiom of Family Guy's underscore: a studio orchestra with a big band inside it, played straight, as if the baby were the hero of a film. Brass stabs, rips and falls, timpani rolls, harp glissandos, swing in two stages and a short button at a cue's end SHALL carry the style. No melody SHALL quote or paraphrase an existing theme. One leitmotif SHALL return in the title, stage 1, stage 5 and the ending.

#### Scenario: Every cue has its own tune
- **GIVEN** the score data in `core/music/score.js`
- **WHEN** the first 8 melody notes of every cue are compared, counted from each cue's tonic
- **THEN** no two cues share them, and the leitmotif, with its rising fifth and its leap of a sixth, is in the title, swim, grow and ending cues
- **CHECK** `qa/first-breath/music.test.mjs`

#### Scenario: A person listens
- **GIVEN** the demo renders of every cue at each level and every stinger, made through the real engine and samples
- **WHEN** a person listens on a phone speaker and on speakers or headphones
- **THEN** it sounds like a cartoon film orchestra with real brass and strings, and no cue sounds like a known theme
- **CHECK** `qa/first-breath/music-demo.mjs`, then a person listens (tasks 8)

### Requirement: A cue for every screen and stage
Each stage, the title screens and the ending SHALL have their own cue: an overture, a spy chase, a siege march, a sneaky caper, an expedition, a full-orchestra battle, a big-band show number, a last stand, a great escape and a lullaby. The old cue's button SHALL play at the stage's end, and the next stage's cue SHALL come in on a bar line within two bars of its start. Through each overlay and card the cue SHALL play on at its lowest level, so no gap is longer than 1 s.

#### Scenario: The cue follows the stage
- **GIVEN** a run played by the reference bot with Music on
- **WHEN** each stage starts
- **THEN** the score's `stats().cue` is that stage's cue (`swim`, `egg`, `split`, `root`, `grow`, `answer`, `turn`, `birth`) within two bars, starting on a bar line of the old cue (stage 6's on her first beat after it), and the old cue's button played once, on a beat at its stage's overlay, and not again where the new cue began
- **CHECK** `qa/first-breath/music.e2e.mjs`

#### Scenario: No silence between stages
- **GIVEN** stage 3 ending with Great
- **WHEN** the score is read from the stage's last second, through its overlay and the stage 4 card, to the first bar of stage 4
- **THEN** no gap between scheduled notes is longer than 1 s
- **CHECK** `qa/first-breath/music.e2e.mjs`

#### Scenario: Back on the title screens
- **GIVEN** a finished run, so the sound has started
- **WHEN** the player opens Stages from the run result
- **THEN** the overture starts on the next bar line
- **CHECK** `qa/first-breath/music.e2e.mjs`

#### Scenario: A cue for every id
- **GIVEN** the stage list in `core/stages/index.js`
- **WHEN** `cueFor` is asked for each stage id, each index from 0 to 8, "title" and "ending"
- **THEN** every stage has its own cue, index 8 and "ending" give the ending's cue, and "title" gives the overture
- **CHECK** `qa/first-breath/music.test.mjs`

### Requirement: The music rises with the action
Every stage cue SHALL have three layers that join as the stage's mood rises: level 0 when it is calm, 1 in the thick of it, 2 at its peak. Stages 2 and 5 SHALL add a boss layer while a boss is on. A level change SHALL land on the next bar line, a boss on the next beat, and stage 8's tempo SHALL rise by at most 12%, at a bar line. The bass and the harmony SHALL play on through every change.

#### Scenario: A gate closing ahead
- **GIVEN** stage 1 with the score at level 0
- **WHEN** the mood rises to level 2 as a gate starts to close ahead
- **THEN** the first level 2 note sounds on the next bar line, within 5 ms of it
- **CHECK** `qa/first-breath/music.e2e.mjs`

#### Scenario: Layers nest
- **GIVEN** each stage cue
- **WHEN** its notes are read at levels 0, 1 and 2, and with the boss on where it has one
- **THEN** each level holds every note of the level below it, and every level keeps the bass and the harmony playing
- **CHECK** `qa/first-breath/music.test.mjs`

#### Scenario: The big germ arrives
- **GIVEN** stage 5 at level 2
- **WHEN** the big germ comes in
- **THEN** the boss stinger plays, the choir and timpani of the boss layer join on the next beat, and the tunes rest while the boss is on
- **CHECK** `qa/first-breath/music.e2e.mjs`

#### Scenario: The waves of birth speed up
- **GIVEN** stage 8 at its first wave
- **WHEN** the run reaches the last wave
- **THEN** the cue's tempo has risen only at bar lines and is at most 1.12 times its start
- **CHECK** `qa/first-breath/music.e2e.mjs`

### Requirement: Stingers mark the big moments
Short stingers SHALL mark the big moments, on the playing cue's next beat and in its key: the grade fanfare after a stage's button (Good, Great and Glowing, each grander), a brass stab and a timpani roll as a boss arrives, a harp and bell flourish for a gift picked, for the first pool you link and for the last pool when you link it, two bright brass notes at a gate passed, and a short brass rip for an item used. The cue SHALL duck under each stinger, and no stinger SHALL be dropped.

#### Scenario: A grade at the stage end
- **GIVEN** stage 3 ending with Great
- **WHEN** the overlay shows
- **THEN** the caper's button plays on its next beat, and the Great fanfare follows it in the caper's key
- **CHECK** `qa/first-breath/music.e2e.mjs`

#### Scenario: A gate passed
- **GIVEN** stage 1 with the score at level 1
- **WHEN** you pass Gate 1
- **THEN** two brass notes play on the next beat, and the cue's gain drops by its duck amount for the stinger's length
- **CHECK** `qa/first-breath/music.e2e.mjs`

#### Scenario: Grades grow and every key fits
- **GIVEN** the stingers in `core/music/score.js`
- **WHEN** Good, Great and Glowing are compared, and every stinger is moved into every cue's key
- **THEN** each grade has more notes and lasts at least as long as the one before, and every note stays in its instrument's range
- **CHECK** `qa/first-breath/music.test.mjs`

### Requirement: A knock-out settles softly
A knock-out SHALL never get a sad sting. As you curl up and rest, the score SHALL play a soft settling chord in low strings and horn, in the cue's key, with no drums, and the cue SHALL fall to its lowest level until the player picks Try again or Go on.

#### Scenario: Knocked out in the shooter
- **GIVEN** stage 5 with the score at level 2
- **WHEN** your last pip goes
- **THEN** the knock-out chord plays on the next beat with no drum in it, and behind the Almost card the cue plays at level 0
- **CHECK** `qa/first-breath/music.e2e.mjs`, `qa/first-breath/music.test.mjs` (no drum in the chord)

#### Scenario: The chord is soft
- **GIVEN** the knock-out stinger
- **WHEN** its notes are read
- **THEN** it has no drum note and no note above velocity 0.35
- **CHECK** `qa/first-breath/music.test.mjs`

### Requirement: The heart stays audible over the score
The score SHALL leave room for her heartbeat and each stage's own sounds. At level 1 a cue SHALL sit at least 6 LU under her heart, her heartbeat onsets SHALL stay detectable over the score at every level, and the mix SHALL peak below −1 dBFS. In stage 6 the band SHALL keep out of the hum's register, MIDI 51 to 73, at levels 0 and 1, so the lane sounds stay clear.

#### Scenario: Her heart in the busiest moment
- **GIVEN** stage 5 at level 2 with the boss layer on
- **WHEN** 10 s of the whole mix is rendered with OfflineAudioContext
- **THEN** each of her beat onsets is found within 10 ms of its time in `run.beats()`, and the true peak is below −1 dBFS
- **CHECK** `qa/first-breath/music.e2e.mjs`

#### Scenario: Loudness at level 1
- **GIVEN** stage 1 at level 1
- **WHEN** her heart alone and the score alone are each rendered for 10 s and measured with EBU R128
- **THEN** the score is at least 6 LU under the heart
- **CHECK** `qa/first-breath/music.e2e.mjs`

#### Scenario: The hum's register
- **GIVEN** the stage 6 cue
- **WHEN** its notes at levels 0 and 1 are read
- **THEN** none lies between MIDI 51 and 73
- **CHECK** `qa/first-breath/music.test.mjs`

### Requirement: Stage 6 plays on her beat
In stage 6 the show number SHALL follow her heartbeat: two music beats to each of her beats, its grid set by her laid beats, so each downbeat lands on one of her beats within 10 ms. Its shout chorus SHALL come in only at a high combo and leave on a bar line when the combo falls.

#### Scenario: Downbeats on her beat
- **GIVEN** stage 6 with her beats laid at about 78 bpm with their natural jitter, given to the score at least 0.5 s ahead
- **WHEN** 20 s of the score is rendered
- **THEN** every downbeat is within 10 ms of one of her beats
- **CHECK** `qa/first-breath/music.e2e.mjs`

#### Scenario: The shout chorus
- **GIVEN** stage 6 with a low combo
- **WHEN** the combo rises to the stage's level 2 mark, and later breaks
- **THEN** the three-trumpet shout chorus joins on the next bar line, and leaves on a bar line after the break
- **CHECK** `qa/first-breath/music.e2e.mjs`

### Requirement: The ending stays calm
The ending SHALL stay tender, slow and soft. No score note SHALL sound from the ending's white until the first cry. After the cry the score SHALL play only one soft warm chord, under her heartbeat and her song. The lullaby, a solo horn singing the leitmotif in three over strings and harp, with no drums, SHALL play on the run result.

#### Scenario: The first breath in quiet
- **GIVEN** a run reaching the end of stage 8
- **WHEN** the ending plays with no input
- **THEN** no score note sounds from the white to the cry, the warm chord plays once after the cry, and no other score note sounds until the run result
- **CHECK** `qa/first-breath/music.e2e.mjs`

#### Scenario: The lullaby
- **GIVEN** the ending cue
- **WHEN** its notes are read
- **THEN** it is in 3 at 70 bpm or slower, has no drums and no note above velocity 0.6, a horn sings its tune, and it ends on the warm chord
- **CHECK** `qa/first-breath/music.test.mjs`

### Requirement: Music captions
With captions and Music on, a caption SHALL name the music once per stage when its cue starts, in plain words, such as "♪ spy-chase music", waiting its turn when the caption line is busy. Music captions SHALL follow the banned words, so a working name such as "Battle" is never shown. A music caption SHALL NOT cut a fact or a sub-goal line. Stingers SHALL need no caption, since each marks a moment the screen already shows.

#### Scenario: One line per stage
- **GIVEN** stage 1 with captions and Music on at 390 × 844
- **WHEN** the stage starts and plays for 30 s
- **THEN** "♪ spy-chase music" shows once, in the caption band, and not again in the stage
- **CHECK** `qa/first-breath/music.e2e.mjs`

#### Scenario: Gentle words
- **GIVEN** every `music.<cue>` string in `core/text.js`
- **WHEN** the text test scans them with each of the four carer words
- **THEN** none has a banned word or an em dash
- **CHECK** `qa/first-breath/text.test.mjs`

#### Scenario: Facts still show whole
- **GIVEN** every stage played by the reference bot through the real captions, with the music captions sent
- **WHEN** the captions are recorded in portrait, landscape and desktop
- **THEN** every fact sent still shows whole
- **CHECK** `qa/first-breath/pacing.test.mjs`

#### Scenario: Every stage names its music
- **GIVEN** every stage but the ending, played by the bots through the real captions, with the music caption offered as its cue starts
- **WHEN** the captions are recorded in portrait, landscape and desktop
- **THEN** the stage's music caption shows once, for at least 1.2 s, within 12 s of its cue's start, even when the stage's lines and facts fill the caption line
- **CHECK** `qa/first-breath/pacing.test.mjs`

### Requirement: The score loads after Play
The page SHALL fetch no score file before Play. The samples, at most 2 MB, SHALL load after the first stage has started, and the score SHALL play at once on a synth stand-in until they are ready. An instrument whose samples fail SHALL stay on the synth, with no error shown and no gap in the music.

#### Scenario: The boot fetches nothing
- **GIVEN** a fresh visit to `/first-breath/`
- **WHEN** the title shows and the player waits 5 s without tapping Play
- **THEN** no request has gone to `audio/score/`
- **CHECK** `qa/first-breath/music.e2e.mjs`

#### Scenario: The samples are blocked
- **GIVEN** every request under `audio/score/` blocked
- **WHEN** the player taps Play and stage 1 runs for 10 s
- **THEN** the score plays on the synth, all 14 sampled instruments are listed in `stats().fallback`, and the console shows no error
- **CHECK** `qa/first-breath/music.e2e.mjs`

#### Scenario: The size and the license
- **GIVEN** the folder `public/first-breath/audio/score/`
- **WHEN** its files are summed and its README is read
- **THEN** they come to 2 MB or less, and the README names the source, the license and what was changed
- **CHECK** `qa/first-breath/music.e2e.mjs`

### Requirement: The score costs little
With the score playing, every stage SHALL keep its frame budgets. The score SHALL keep at most 48 live voices and SHALL steal only voices already fading. A note SHALL never sound late: one more than 20 ms late SHALL be dropped. The scheduler tick SHALL average 0.5 ms or less.

#### Scenario: The busiest moment
- **GIVEN** stage 5 at level 2 with the boss layer, at 390 × 844 with `?probe=1`
- **WHEN** 120 frames are measured after 3 s
- **THEN** the frame budgets hold, the score never has more than 48 live voices, no held note was cut, and the tick averages 0.5 ms or less
- **CHECK** `qa/first-breath/perf.e2e.mjs`
