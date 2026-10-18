## ADDED Requirements

### Requirement: The Warm Lantern look
The game SHALL draw soft translucent membranes lit from behind, with plum shadows, coral and amber bodies and cream rims, using the colour script in the design for each stage. Light SHALL rise over the run from dim violet-red to deep red, rose, amber and ember, then plum to white at birth and a warm cream room in the ending. In each stage the cue the player needs now SHALL be the brightest thing on screen.

#### Scenario: A frozen cell
- **GIVEN** `?seed=1&freeze=1&stage=3` at 390 × 844
- **WHEN** the frame is read
- **THEN** a cell centre has a higher R / (G + B) than the background, and its rim is the brightest band within 20 px
- **CHECK** `qa/first-breath/visual.e2e.mjs`

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

### Requirement: One draw list for both renderers
Every stage SHALL describe its frame as one draw list of plain data within the limits: at most 32 splats with the baby figure included, 600 points, 6 strips, 24 marks and 8 rings. The renderer SHALL add at most 900 decorative motes, so a frame holds at most 1,500 points. The WebGL2 renderer and the Canvas 2D fallback SHALL both draw only that list. No per-pixel smooth-minimum loop over shapes SHALL be used.

#### Scenario: Draw lists stay in budget
- **WHEN** every 30th view of each stage's reference and idle runs is validated in node
- **THEN** no list exceeds a limit
- **CHECK** `qa/first-breath/draw.test.mjs`

### Requirement: A plain 2D fallback
The Canvas 2D fallback SHALL draw the draw list as plain shapes. It SHALL start when WebGL2 is missing, a shader fails, the context is lost twice, or `?gl=0` is set.

#### Scenario: The fallback in every stage
- **WHEN** each stage runs with `?gl=0`
- **THEN** its frame has a mean luminance above 0.04 and a centre brighter than all four corners
- **CHECK** `qa/first-breath/smoke.e2e.mjs`

### Requirement: Smooth frames
The frame cost SHALL be the JavaScript time of one frame, from the start of its fixed steps to the end of its draw, with `gl.finish()` at the end under `?probe=1`. In SwiftShader with `?probe=1` and the scale step pinned (`?res=0.5` on the two phone sizes, `?res=0.35` on desktop, whose base is capped at 0.6 MP), its 95th percentile SHALL be 12 ms or less over 120 frames after 3 s in every stage. A frame SHALL use at most 12 WebGL draw calls.

#### Scenario: Pinned scale
- **WHEN** each stage runs for 3 s and then 120 more frames at 390 × 844, 844 × 390 and 1440 × 900 with its pinned step and `?probe=1`
- **THEN** `__fb.perf.p95Ms` is at most 12 and `__fb.perf.draws` at most 12
- **CHECK** `qa/first-breath/perf.e2e.mjs`

### Requirement: Adaptive scale
The scale step SHALL apply to each axis of the canvas. Without `?res`, the adaptive scale SHALL settle at a step of 0.5 or more on the two phone sizes and 0.35 or more on desktop.

#### Scenario: Adaptive scale
- **WHEN** each stage runs for 6 s with `?probe=1` and no `?res`
- **THEN** `__fb.perf.scale` is at least 0.5 at 390 × 844 and 844 × 390, and at least 0.35 at 1440 × 900
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
The HUD SHALL show the stage name and the clock label at the top left and the score and the pause button at the top right. In stage 1 a place slot under the score SHALL show the place, such as "3rd of 20". The scale bar SHALL sit at the top left under the clock in portrait, and at the bottom left in landscape and desktop. A prompt line under the HUD SHALL name the live gesture with an icon. Text SHALL be at least 16 px, and 20 px with Large text.

#### Scenario: Large text
- **WHEN** the player turns on Large text at 390 × 844
- **THEN** HUD and caption text grow to 20 px and 22 px with no overlap
- **CHECK** `qa/first-breath/layout.e2e.mjs`

#### Scenario: The place slot in every layout
- **GIVEN** stage 1 at 390 × 844 and 844 × 390 with touch, and at 1440 × 900, with `?inset=47,0,34,0`
- **WHEN** the race is under way
- **THEN** the place slot reads the same place as `__fb.race()`, sits under the score inside the safe area, above 60% of the height in portrait, and overlaps no HUD, prompt or caption box
- **CHECK** `qa/first-breath/layout.e2e.mjs`

#### Scenario: The scale bar in portrait
- **WHEN** stage 4 is shown at 390 × 844
- **THEN** the scale bar sits under the clock at the top left, above 60% of the height
- **CHECK** `qa/first-breath/layout.e2e.mjs`

### Requirement: The egg and its arc in the free part of the screen
In stage 2 the egg's centre SHALL be the layout's subject point: 45% of the height in portrait; 38% of the width and 55% of the height in landscape; 40% of the width and half the height on desktop. The camera SHALL show 140 u across the short axis. The shell, the arc, every stuck or held sperm and the player's incoming gold sperm SHALL stay inside the safe area, under no HUD, prompt or caption, in 390 × 844, 844 × 390 and 1440 × 900.

#### Scenario: Portrait guard
- **GIVEN** `?seed=1&moment=guard` at 390 × 844, stepped 33 s into the guard, when the gold sperm burrows at the shell
- **WHEN** the frame and `__fb.guard()` are read
- **THEN** the egg's centre is at 45% of the height, every stuck sperm and the gold sperm are between the caption band and 60% of the height, and none is under the HUD or prompt
- **CHECK** `qa/first-breath/layout.e2e.mjs`

#### Scenario: Landscape and desktop guard
- **GIVEN** the same guard frame at 844 × 390 and 1440 × 900
- **WHEN** the frame and `__fb.guard()` are read
- **THEN** the egg's centre is at 38% of the width and 55% of the height in landscape, and at 40% of the width and half the height on desktop, and every stuck sperm and the gold sperm are inside the screen and under no HUD, prompt or caption box
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
Sound SHALL be synthesized in one graph built on the Play tap against an injected AudioContext, with no audio files. Every source except the birth sounds SHALL pass a womb low-pass bus. The voice SHALL be a sine hum. The mother's beat sounds SHALL come from the run's beat clock, so sound and picture agree and the beat does not jump at a stage start. The mother's heart SHALL include 2nd and 3rd harmonics so phone speakers carry it.

#### Scenario: Inside the womb
- **WHEN** 6 s of stage 1 audio is rendered with OfflineAudioContext
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
A frame SHALL have at most 8 DOM rings. In the guard, burrow rings SHALL be capped at 7, and at 6 while a target ring shows.

#### Scenario: Rings at the seal
- **GIVEN** stage 2 idle until the seal, so many rivals are stuck when the seal target shows
- **WHEN** `svg#rings` is read during the seal
- **THEN** it holds the mother's ring, the target ring and at most 6 burrow rings, 8 in all at most
- **CHECK** `qa/first-breath/input.e2e.mjs`, `qa/first-breath/draw.test.mjs`

### Requirement: Reduced motion
With `prefers-reduced-motion: reduce`, `?rm=1` or the Motion setting at Reduced, the game SHALL halve the membrane warp, drop scale bounce and camera shake, change beats by brightness only, keep the walls still during contractions, and make the birth light a plain 1.5 s fade. The stage change SHALL stay the same 0.8 s crossfade. The rhythm and the timing SHALL stay the same.

#### Scenario: Emulated reduced motion
- **WHEN** a stage runs with reduced motion emulated
- **THEN** `__fb.motion.warpAmp` is at most half its full value and `bounce` is 0
- **CHECK** `qa/first-breath/visual.e2e.mjs`

#### Scenario: The stage change
- **WHEN** a stage ends with reduced motion
- **THEN** the next stage arrives by a 0.8 s crossfade with no scale bounce
- **CHECK** `qa/first-breath/visual.e2e.mjs`

### Requirement: Flash safety
The game SHALL make one swell per heartbeat, never one each for "lub" and "dub". A full-screen tint SHALL follow only the mother's heart and change frame luminance by 6% or less. The baby's faster heart SHALL move only its ring and a small splat. There SHALL be no more than 3 luminance swings of 10% or more in any 1 s, no red flashes, and the birth light SHALL rise steadily.

#### Scenario: Busy stages
- **GIVEN** `?probe=1`
- **WHEN** `__fb.lum()` is sampled every frame for 5 s in stages 4, 5, 6 and 8
- **THEN** no 1 s window has more than 3 swings of 10% or more
- **CHECK** `qa/first-breath/visual.e2e.mjs`

#### Scenario: Birth light
- **WHEN** the light after wave 8 plays
- **THEN** the mean luminance never falls by more than 1% and ends at 0.95 or more
- **CHECK** `qa/first-breath/visual.e2e.mjs`

### Requirement: Colour-blind safe cues
No goal SHALL depend on hue alone. Cues SHALL differ by shape and brightness: solid and dashed rings with a dot for the two hearts, dotted rims for gland pools, wavy rims for blood pools, chevrons for the warm lane, and words for grades. Every cue SHALL have a 2 px dark halo. Each cue colour SHALL have a contrast of at least 3:1 against its stage background and against its halo, in normal vision and under protan, deutan and tritan simulation.

#### Scenario: Palette test
- **WHEN** every cue token in `render/palette.js` is checked with the Machado 2009 matrices
- **THEN** every pair meets 3:1 in all four views
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
The embryo, fetus and newborn SHALL be soft blobs on a 2D skeleton with no face and no expression. The newborn SHALL never be drawn blue, grey, dusky or limp, and SHALL show no lungs or other anatomy. Its warmth SHALL rise only as a warm glow. The skin-to-skin image SHALL be a big warm shape and a small one in a circle of light, with no face and no body outline.

#### Scenario: Ending colours
- **WHEN** a frozen frame of skin-to-skin is read
- **THEN** its mean R is above its mean G, which is above its mean B
- **AND** every chromatic ending palette token has a hue between 0° and 50°, with achromatic tokens such as white skipped
- **CHECK** `qa/first-breath/visual.e2e.mjs`, `qa/first-breath/palette.test.mjs`
