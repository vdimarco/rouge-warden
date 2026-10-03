# Small Worlds

Six mobile game experiments at `/lab/worlds/`. Open the page through a static web server. No build step or generation API is needed to play.

| World | Main action | Goal |
| --- | --- | --- |
| Threadwake | Hold to grab the nearest flower in your ring, swing, and let go | Climb above the rising mist. A crown waits every 100 m |
| Foldwild | Tap a panel to turn it; drag left to turn it back | Join the river home before the water spills. Each path home adds 15 s |
| Storm Choir | Hold and slide to steer the flock; raise your finger to climb faster | Carry at least 5 birds through each ring past drifting storms. A dawn comes every sixth ring |
| Borrowed Bodies | Hold, drag and let go to throw the spark | Climb from body to body before the light runs out |
| Season Thief | Tap an object and drag its age along the timeline | Open three crossings within 8 time, as near to par as you can |
| Heartship | Drag from the heart to an organ, and let go on the beat | Sail as far as you can before the hearts run out |

## Runtime

- Portrait logical canvas: 420 × 680, scaled with pointer coordinates kept in sync.
- Uses the Lab's fixed-step loop, capped catch-up, and canvas pixel ratio of 2.
- Pointer capture supports one-finger play. Cancelled input and hidden tabs pause safely.
- Start, pause, restart, help, world selection, and sound controls are shared.
- Sound unlocks on a user gesture and can be muted. Reduced-motion settings limit extra particles and turn off shake.
- Each world opens on today's seed, so the crew plays the same world each day. Retry keeps the seed, and "A different world" picks a new one. Share links include the seed, and after a run the shared text gives the score.
- When a world ends, the scene keeps moving for a 1.6 s outro at half speed with input off. Then the result card rises from the bottom and says how the score compares with your best. A loss plays a falling note.
- Best scores and the sound setting stay in this browser. No account, analytics or lives.

Each `games/*.js` module's default export takes the shell's api and returns `update`, `draw`, `pointer`, `key`, `getState` and `destroy`. The comment at the top of `worlds.js` lists the api: the seeded random, the seed and today's flag, the stored best, status lines, and the sound and feel helpers (`tone`, `noise`, `chord`, `burst`, `slow`, `shake`, `buzz`). The shell owns layout, background art, sound, particles, the outro and the result card. `window.__worlds.getState()` is a read-only diagnostics snapshot.

Tests: `qa/lab/worlds.e2e.mjs` checks the shell with all six games in a browser, and `qa/lab/worlds.<id>.sim.mjs` plays each game in Node with scripted players.

## Art

The six backdrops share one 405 KiB WebP atlas, indexed in reading order. Canvas source rectangles and CSS background positions select each world without six separate downloads. See `assets/provenance.json` for provider and prompt notes.

The built-in image generator supplied the current artwork. Fal orchestration stalled without returning a result or request ID, so submission status is unknown. Higgsfield credentials were unavailable in this workspace; the repository requires its local API workflow. No generated output from either provider is claimed here.

Each world now has a way to lose, a layout from the seed, and a score that grows with skill. Threadwake, Borrowed Bodies, Storm Choir and Heartship are endless. Foldwild chains sheets in a timed run, and Season Thief makes a new garden with a par on each seed. They are still prototypes: nobody has played them on a real phone yet.
