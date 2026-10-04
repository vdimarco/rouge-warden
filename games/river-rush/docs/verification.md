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

Run the static server from the repository root, then:

```sh
GAME_URL=http://localhost:8765/river-rush/ node games/river-rush/tests/browser-check.mjs
NODE_PATH=games/river-rush/node_modules node qa/river-rush/arcade.mjs
QUIET_URL=http://localhost:8765 NODE_PATH=games/river-rush/node_modules node qa/arcade/quiet.mjs --only=river-rush --skip=unit,silent --modes=emulate,pagehide
PARTS=layout,switcher,saves NODE_PATH=games/river-rush/node_modules node qa/arcade/machines.mjs
```
