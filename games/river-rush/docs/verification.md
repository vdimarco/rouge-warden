# Verification

Chromium via Playwright was used because Browser/IAB tools are unavailable in this session. Both reference concepts and browser captures were inspected with view_image at native desktop 1536×1024; responsive checks also cover 390×844. Captures are temporary QA files, not deploy assets.

Comparison ledger:
- Copy: menu title, tagline, CTA, supporting copy and keyboard legend retained. Intentional functional addition: How to play. Dynamic preparing/error text is only shown during loading/failure.
- Layout: full-bleed jungle composition, left title/right character, gold rule, lower control legend and best-run footer retained.
- Typography: high contrast Bodoni serif title, Georgia tagline/buttons and DM Sans controls match the reference roles. Native controls have explicit font sizes.
- Palette: evergreen, ivory and gold retained; background art has no added desktop wash. Mobile uses an intentional edge fade to make text legible.
- Assets: clean generated menu image and transparent raft/key/rock atlas loaded successfully. Front-facing sprite preserves facial likeness, an intentional change from rear-facing gameplay concept.
- HUD: thin gold journey rail, large timer, balance meter, timing ring, instruction strip and control keycaps retained. Real rival distance and context-sensitive feedback are functional additions.
- Responsive: touch controls, image crop and single-line title were inspected. Fixed a mobile title overflow and missing word spacing.

Six engine tests pass: steering/reset, successful and early key releases, key-gated sustained unlocking, steering penalty while reaching, collision/fall recovery, escape/treasure/rival finish rules, deadline and terminal-state stability.

Five complete deterministic courses were also simulated through the actual steering/reach/unlock inputs. All won in 94–98 seconds, with collisions and recoverable falls occurring in several runs.

Browser checks pass: menu, instruction dialog, start, keyboard steering/reach, pause freezes timer, resume, sound toggles, restart resets timer, mobile menu without horizontal overflow, mobile game and touch button input. No browser page errors.

WebMCP context is unsupported in the test browser; optional tool registration is guarded and cannot be fully validated here.

The implementation was visually verified against both design concepts with the intentional deviations above. The game is a playable first version, not an exact three-dimensional recreation of the cinematic photograph.

## Cottage Arcade integration

The committed arcade bundle uses `/river-rush/` as its asset base. Engine tests and the existing browser check were repeated against that bundle, including mobile touch buttons. `qa/river-rush/arcade.mjs` also checks quiet.js ordering, the shared switcher identity, cabinet selection and launch, keyboard inputs, frozen pause time, local score display, and malformed, nonpositive, nonnumeric and infinite score fallback. The real game screen is used for the cabinet's 480×320 WebP (50.5 KB).

The result screen was reached with Playwright's accelerated clock, then its Switch game action was verified to close the native dialog and display the shared switcher with River Rush marked. Desktop, mobile and result captures were inspected against the approved art direction. New Switch game and Arcade links intentionally extend the approved menu footer.

Shared audio lifecycle checks passed 15/15 with both emulated visibility changes and pagehide/pageshow. Phone layouts were checked in Chromium at 390×844, not on a physical phone.

The arcade's existing layout, switcher and saves suite passed, including cabinet selection, swipes and no overflow at seven screen sizes from 360×740 to 1920×1080. Each layout size uses a fresh browser to avoid software GPU degradation during the long swipe sequence.

Release commit `1ac04b483bd11069f25baba6f3b9fb9e88ea2673` was published to `vdimarco/rouge-warden` main. The Git transport rejected the upload; GitHub's Git Data API uploaded identical blobs and tree and preserved the exact local commit SHA. Vercel production deployment `dpl_6psk4jmKKykxyDkGJfEqCeBdJjHA` reported READY for that SHA. The game route is `https://warden-alpha-wheat.vercel.app/river-rush/`.

The focused arcade browser check also passed against that public production origin: game assets, cabinet launch, switcher identity, keyboard controls, paused timer, desktop/mobile layouts and score validation. No page errors or failing same-origin requests occurred.

## Animation and Surge update — 2026-10-04

Higgsfield Seedance 2.5 generated one five-second living title scene from the approved menu image. The source and middle frame were inspected for character identity and composition, then browser captures were checked at 1536×1024 and 390×844. The silent 1920×1080 H.264 asset is about 2.2 MB; provider, job ID and encoding are recorded in `media.json`. Motion affects the water, hair, flags and raft while the live menu remains readable.

Ten engine/presentation tests passed, including held versus tapped Surge, balance cost, falling restrictions, once-only close-call rewards, combo breaking, effect expiry/bounds, frozen simulation time and immediate reduced-motion pose selection. Five complete courses through actual steering/reach/unlock/Surge inputs won in 87.5–89.7 seconds with 4–9 close calls; one included a recoverable fall.

`qa/river-rush/animation.mjs` passed: real video playback, silent media, pause under instructions, live reduced-motion changes, Shift and phone-button Surge, exact paused canvas equality, video-failure poster fallback and rendered key/chest/impact/fall/close-call effects. Canvas decoration changes even with course distance held fixed; reduced-motion frames remain identical. Temporary captures were visually inspected. Short live RAF samples averaged 18.1 ms on desktop (95th percentile 33.4 ms) and 16.7 ms on the phone viewport (95th percentile 16.8 ms) in this Chromium environment. Renderer submission time was 0.22 ms per frame; this measures JavaScript commands, not total GPU time. These are brief browser samples, not physical-device benchmarks.

The existing game browser checks and arcade integration checks also passed. Shared audio checks passed 15/15. A missed very fast touch tap was fixed by queuing a one-shot Surge input for the simulation, so both short Shift presses and touch clicks work reliably. Run the new check with `NODE_PATH=games/river-rush/node_modules node qa/river-rush/animation.mjs` against the static server.

Run the static server from the repository root, then:

```sh
GAME_URL=http://localhost:8765/river-rush/ node games/river-rush/tests/browser-check.mjs
NODE_PATH=games/river-rush/node_modules node qa/river-rush/arcade.mjs
QUIET_URL=http://localhost:8765 NODE_PATH=games/river-rush/node_modules node qa/arcade/quiet.mjs --only=river-rush --skip=unit,silent --modes=emulate,pagehide
PARTS=layout,switcher,saves NODE_PATH=games/river-rush/node_modules node qa/arcade/machines.mjs
```
