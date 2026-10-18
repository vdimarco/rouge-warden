# First Breath

## Why

The user asked, in these words: "I'd like to make a game inspired by the birth process from the perspective of the
baby. starting with the sperms and ovulation. and then embryo stage growing and the placenta. and the 1st 2nd and 3rd
trimester. finally with the birth".

The arcade has no game like this. The user named eight phases, in order: the sperm, ovulation, the growing embryo, the
placenta, the first, second and third trimesters, and the birth. The game must follow that order, from the baby's
point of view, and stay tender, accurate and never graphic.

The user gave no art direction, no controls preference and no arcade row. Those choices are ours, and this change
records them as ours (design.md section 1).

## What Changes

- Add a new game, **First Breath**, at `/first-breath/` (id `first-breath`). Subtitle: "A baby's journey to birth".
  Tagline: "Nine months. Eight small stages. One first breath."
- **Eight stages in the user's order, then an ending:**
  1. The Journey: you are a sperm cell. Drag to swim on the waves and against a gentle current, rest on a glowing wall
     until you are ready, and settle in a warm pocket. It is not a race; other sperm only rest on the walls.
  2. Ovulation: you are the egg. A gold hormone surge comes first; then tap with your mother's heartbeat to open the
     follicle and ride the cilia. Tap the gold beats to call your waiting sperm. Fertilization plays with no input.
  3. The Embryo: first cells: tap as each split comes, then hold and let go to fill your hollow and hatch.
  4. The Placenta: drift to a soft spot and nestle in, then steer your growing roots to the pools. Then your heart
     beats for the first time: "This beat is yours. Tap with it." Then your body grows from 2 mm to 10 mm, by itself.
  5. First Trimester: tap with your own fast heart as lights reach it along the cord, and drag to stretch between
     phrases. The tempo peak of the run follows the real heart rate (about 170 bpm at weeks 9 to 10).
  6. Second Trimester: your mother's heartbeat becomes sound at week 15. From week 19, listen to the hummed phrases,
     then answer. "Your mother feels you." Your answers become your song.
  7. Third Trimester: practise breathing with holds, turn head-down in roomy moments, then rest while your song is
     hummed.
  8. Birth: hold through the waves; tuck, turn, lift and turn back on the prompted waves. The opening is drawn only as
     light.
  - Ending (not scored): white, a breath that comes by itself within 3 seconds, skin-to-skin, your mother's heartbeat
    clear, your song clear, then "Your nine months took 9 min 48 s".
- **Nothing fails after fertilization.** Development happens on schedule; skill only changes the score. Only stage 1
  can end in "Almost. Try again?", with Try again (at once, nothing lost) and Go on.
- **One live gesture per moment**, named by the prompt: drag anywhere (a floating stick), tap, hold, or drag and hold.
  Keys only on desktop. One-button mode and Assist in every stage. A fair timing judge on input timestamps, with a Tap
  test and a manual offset.
- **One heartbeat** that runs on through overlays and cards, so the beat never jumps at a stage start.
- **Score**: up to 10,000 points per stage (Goal, Skill, Flourish), grades Good, Great and Glowing, a run total and run
  time, a best per stage and a Stages menu for practice. No Apgar framing; Apgar appears only as a sourced fact after
  the ending.
- **One clock**: weeks count from the first day of the last period, as midwives and doctors count. Early stages show
  "Day N after fertilization (week M)". Every fact has a source and an access tag, and its label comes from the clock.
- **The look**: "Warm Lantern", soft membranes lit from behind, from dim red to amber to white, drawn by one WebGL2
  splat-and-composite stack with a plain-shape Canvas 2D fallback. Stages join with a short crossfade. Womb sound that
  is felt first, then heard, then opens at birth.
- **The arcade**: a machine at the end of the Action row, after Ahead of the Light; a switcher entry; a hand-drawn SVG
  screen; a cabinet line with the best run; homepage checks at 390, 320 and 1280 px wide.

### Scope of this change

This change builds the **v1 form** of each stage: its minimum form plus its best one or two flourishes (design.md
section 6). These wait for later changes (design.md section 19.2): Continue, density assist, auto-drift of the timing
offset, the log zoom between stages, a 2D fallback that matches the look, the formant voice, haptics, "Play your song",
the FURTHEST cabinet line, the stage 6 repeats, jump and hiccups, and the stage 1 fork and moving rivals.

### Our choices (the user gave none)

| Topic | Choice |
|---|---|
| Title | First Breath |
| Art direction | "Warm Lantern" (design.md section 13, with the hex colour script) |
| Controls | One live gesture per moment; relative stick; keys only on desktop; one-button mode |
| Row | Action, the last machine, after `ahead-of-the-light` |
| The person carrying the baby | "your mother" by default; Settings offer mother, mum, mom, parent; no pronouns in any string |
| Week convention | Gestational age from the first day of the last period; "Day N after fertilization (week M)" in early stages |

## Capabilities

### New Capabilities

- `first-breath-journey`: the run as a whole: Play into stage 1, the stage order, stage cards, stage-end overlays, the
  clock and its moment spans, the one heartbeat, carry-over, scoring and grades, the stage 1 retry, pause, saves,
  practice, the ending and the run result.
- `first-breath-stages`: what each of the eight stages asks and how it always completes, with its controls on touch
  portrait, touch landscape and desktop, its one-button form and its gentle misses.
- `first-breath-input`: one live gesture at a time, presses at touch-down, the floating stick, keys only on desktop,
  the timing judge on the stage clock, calibration, one-button mode and Assist.
- `first-breath-presentation`: the Warm Lantern look, the renderer and its plain 2D fallback, the frame-cost budget,
  the three layouts and the thumb zone, the womb sound, captions, reduced motion, flash safety, colour contrast and the
  scale bar.
- `first-breath-facts-and-tone`: sourced facts, labels from the clock, the clock wording, the word for the person
  carrying the baby, banned words and pronouns, the tone rules and the Sources screen.
- `first-breath-arcade-machine`: the machine in the Action row, the switcher entry, the cabinet screen and line, the
  page in the arcade, and the homepage checks at 390, 320 and 1280.

### Modified Capabilities

None. The arcade's own requirements already ask for a machine for every game page.

## Impact

- **New folder** `public/first-breath/`: `index.html`, `style.css`, `main.js`; a pure `core/` (`rng`, `clock`, `beat`,
  `judge`, `intent`, `draw`, `events`, `carry`, `score`, `text`, `facts`, `sources`, `save`, `run`, `bots`, `ending`,
  `lib/` and `stages/` with a module, a tune file, a facts file and a text file per stage); `render/` (the WebGL2 stack,
  the plain 2D fallback, the camera, the palette, DOM rings, strips); `ui/` (input, HUD, captions, screens, sound,
  store).
- **New file** `public/arcade/key/first-breath.svg` (the cabinet screen, under 10 KB).
- **New tests** in `qa/first-breath/`: node tests (purity, clock, beat, judge, track, draw, run, save, facts, text,
  palette, perf, sim, one per stage, ending), the bot CLI `bot.mjs`, browser checks (`smoke`, `layout`, `input`,
  `perf`, `visual`, `sound`) and `shots.mjs`.
- **Research notes** in this change folder: `research/research-biology.md` (the facts and their access tags) and
  `research/research-art.md` (rendering, game and audio sources, and the SwiftShader measurements).
- **Edited files:**
  - `public/index.html`: the cabinet article after `ahead-of-the-light` in `#row`, its `.cab.first-breath` colours,
    `"first-breath"` appended to the Action group's `games`, and the cabinet best-line block.
  - `public/arcade/switch.js`: the `GAMES` entry after Ahead of the Light.
  - `qa/arcade/groups.e2e.mjs`: Action goes from seven games to eight.
  - `qa/arcade/machines.mjs`: the best-line key `first-breath.save.v1` and its wanted line ("BEST 61,240"), the size
    check for the SVG screen, and a new part `firstbreath` for the homepage checks at 390 × 844, 320 × 568 and
    1280 × 720, with screenshots.
  - `qa/arcade/quiet.mjs`: a page entry for `/first-breath/` that presses `#play`.
  - `public/arcade/game-dates.json`: regenerated from git with `node qa/arcade/game-dates.mjs`.
  - `README.md`: a section for the game, file table rows and the test commands.
  - `AGENTS.md`: one test line under the Cursor Cloud instructions.
- No backend, no new dependency, no build step, no audio files (all sound is synthesized). Saves stay in
  `localStorage` under `first-breath.save.v1`; mute uses the shared `arcade.sound`. Nothing is sent anywhere except
  the arcade's existing analytics script.
