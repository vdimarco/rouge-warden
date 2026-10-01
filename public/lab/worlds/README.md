# Small Worlds

Six mobile game experiments at `/lab/worlds/`. Open the page through a static web server. No build step or generation API is needed to play.

| World | Main action | Goal |
| --- | --- | --- |
| Threadwake | Tap anchors; pull and release a living thread | Gather three lights and reach the crown |
| Foldwild | Turn paper river panels; hold to preview | Grow three gardens and connect spring to home |
| Storm Choir | Hold and steer the wind | Carry at least five creatures through a ring; collect four songs |
| Borrowed Bodies | Drag the spark toward another host | Transfer through six hosts to the beacon |
| Season Thief | Select objects and scrub their ages | Open three crossings with a limited time budget |
| Heartship | Charge the heart and release toward an organ | Dodge reefs, shield storms, and reach 900 metres |

## Runtime

- Portrait logical canvas: 420 × 680, scaled with pointer coordinates kept in sync.
- Uses the Lab's fixed-step loop, capped catch-up, and canvas pixel ratio of 2.
- Pointer capture supports one-finger play. Cancelled input and hidden tabs pause safely.
- Start, pause, restart, help, world selection, and sound controls are shared.
- Sound unlocks on a user gesture and can be muted. Reduced-motion settings limit extra particles.
- Retry preserves the seed. “A different world” selects a fresh seed. Share links include it.
- Best scores and sound preference are stored locally. No account, analytics, lives, or daily streaks.

Each `games/*.js` module exports `createGame(api)` with `update`, `draw`, `pointer`, `key`, and `getState`. The shell owns layout, background art, sound, particles, and lifecycle. `window.__worlds.getState()` is a read-only diagnostics snapshot.

## Art

The six backdrops share one 405 KiB WebP atlas, indexed in reading order. Canvas source rectangles and CSS background positions select each world without six separate downloads. See `assets/provenance.json` for provider and prompt notes.

The built-in image generator supplied the current artwork. Fal orchestration stalled without returning a result or request ID, so submission status is unknown. Higgsfield credentials were unavailable in this workspace; the repository requires its local API workflow. No generated output from either provider is claimed here.

These are short mechanic demos. They establish playable goals and replay, but do not yet contain a full campaign or endless content system. Physical phone playtesting remains necessary before release.
