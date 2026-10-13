# Light Years Home lab v2

## Why

After playing v1, the user said: "the concept is stale. let's make something that is actually fun to play."

v1's loop was: read a clue, pick one of three rings, then hold a button so a meter stays under a line. That is trivia
plus a meter. Play waited 12 seconds for captions, the screen held a lot of text, and light speed was a number on the
HUD rather than something you feel in your hands. We want a verb that is fun on its own, real skill, and light speed
you can feel.

## What Changes

- Add a chooser at `/light-years-home/lab/`: a quiet black page in the video's look with two thin-ring buttons, one
  plain line under each, a link back to the arcade and the game switcher.
- Add prototype A, LIGHT YEARS AHEAD (steer and skim), at `/light-years-home/lab/a/`. You steer round a ring while
  galaxies stream at you. Near misses make you faster, and going faster shrinks the ring and speeds up the beat. A
  burst's light chases you, and the score is a spectral-class rank.
- Add prototype B, SLINGSHOT HOME (grab, whip, let go), at `/light-years-home/lab/b/`. You hold to grab a galaxy and
  whip round it, and lift to fling to the next one. Deep, well-aimed releases make you faster. The score is your own
  clock: the fewer years you age, the better.
- Each prototype is one stage, THE WEB, out to the Coma Cluster, about 45 to 90 seconds. Both start play within
  3 seconds, retry in under 2 seconds, and fire sound, flashes, slow motion, shake and callouts on every event.
- Add a pure core with bots and node tests for each prototype, and a test hook for browser checks.
- A playtest picks one. The other is dropped, and its best idea can be grafted into the winner afterwards.
- v1 at `/light-years-home/` and its change `add-light-years-home` stay as they are until a winner is picked.

## Capabilities

### New Capabilities

- `light-years-lab-a`: prototype A and its chooser button.
- `light-years-lab-b`: prototype B and its chooser button.

### Modified Capabilities

None.

## Impact

- New files: `public/light-years-home/lab/index.html`, `public/light-years-home/lab/a/`,
  `public/light-years-home/lab/b/`, `qa/light-years-home/lab-a.test.mjs` and `qa/light-years-home/lab-b.test.mjs`.
- Reused without edits: `render/points.js`, `core/physics.js`, `core/rng.js`, `core/gen/web.js`, `core/captions.js`
  and `CHAPTER_KEYS` from `ui/audio.js`. The prototypes do not import `render/view.js`, `ui/overlay.js` or `ui/hud.js`.
- No change to v1, the arcade page, its cabinets or the switcher list. The lab pages are `noindex`.
- No backend and no new dependency. Run logs stay in the player's `localStorage`; testers paste them back by hand.
