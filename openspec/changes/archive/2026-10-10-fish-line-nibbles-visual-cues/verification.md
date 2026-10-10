# Verification

## Spec structure

Node.js 24.19.0 meets the OpenSpec package's `>=20.19.0` requirement. `npx --yes @fission-ai/openspec --version` reported 1.14.1. `npx --yes @fission-ai/openspec validate fish-line-nibbles-visual-cues --type change --strict` passed before archive, and `archive -y` updated the two canonical specs. The CLI was run transiently; no repository dependency was added. After the canonical spec review, `fish-feedback` passes strict validation. `fish-casting` passes normal validation but strict mode reports a long prose warning in its pre-existing quick-turnaround requirement; the new line requirement is below that limit.

## Cast and line

- `node qa/fish/cast.sim.mjs` passed. The new high-lob case lands about 21.2 m away and starts the reel with about 23.2 m of line, the final span with the existing sag. Before the fix, the peak airborne line was about 31 m.
- `node qa/fish/line.test.mjs` passed at 30, 60 and 120 fps.
- In a 390x844 Chromium page, a staged high-lob flight showed a 21.2 m splash report. The live simulation and gauge both read 23.15774391127648 m of line, with no page error. The flight was staged through an ephemeral Playwright script, not thrown on a physical phone.
- In a focused `LakeSim` check with no fish, 15 m and 50 m lure placements started with 14.39 m and 50.17 m of line after rod position and sag. LINE OUT never rose during a steady one-turn-per-second retrieve, and both came home. A forced muskie fight started with 29.54 m of line, then paid out to 34.80 m during runs; this confirms the fight still permits extra line.

## Nibble haptics

- `CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node qa/fish/haptics.test.mjs` passed, including Android vibration patterns, native iPhone plugin stubs, mute and priority rules, and Chromium iPhone-pad interaction checks.
- The web/Android nibble is two light taps with a 70 ms gap; the iPhone plugin receives two LIGHT impacts 80 ms apart. The stronger strike preempts them.
- After the broader haptics pass, the same command passed again with checks for menu selections, pause, ordinary release, empty return, dry landing, missed or refused fish, and silent drag-limit presses.
- An Android-like Chromium live-game check observed the ordinary release `[16]`, failure `[20,65,8]`, empty-home `[9,32,15]`, and menu/Settings selection `[8]` patterns, with no page error. A no-op drag adjustment did not click, and pause stopped continuous haptics before one light bump. The catch pattern's higher priority blocked the weaker menu tick.

## Visual cue

- The updated game booted and rendered in Chromium at 390x844 portrait and 844x390 landscape. The cue boxes were `(220,52)–(380,151)` and `(674,58)–(834,157)` respectively, clear of the gauge, HUD, toast and rod cue.
- Motion portrait, rotated landscape, and Calm portrait rendered without page errors. The cast-ready instruction remained in the screen-reader announcement and visually clipped corner text.
- `node qa/fish/action-cues.test.mjs` passed 11 checks for cast, reel, nibble, hook, run, steer and jump action selection.
- `CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node qa/fish/cues.e2e.mjs` passed 17 checks: moving jump cue, nibble art, corner placement and clearance, mirrored reel side, Larger text, fish drawing scale and no page errors.
- Manual Chromium views at 390x844 touch and motion, 844x390 touch and rotated motion, Calm portrait, and reduced-motion landscape showed no overlap with controls or page errors. The normal lower-rod pose changed over 600 ms; Calm and reduced-motion poses stayed still while retaining their directional drawing. Physical motion hardware was not tested.
- `CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node qa/fish/menus.e2e.mjs` passed the full menu browser suite after its card check was updated for visible art. The art measured 150 x 89 px inside a 160 x 99 px card; toast text measured 17.5 px and gauge words 15/13 px.

## Final integration checks

`node qa/fish/cast.sim.mjs`, `node qa/fish/line.test.mjs`, `node qa/fish/action-cues.test.mjs`, `node qa/fish/words.test.mjs`, and `node qa/fish/release.test.mjs` passed on the combined change. `git diff --check` passed. A blocked `#catchGo` click during `cardWait` produced no vibration, then an accepted click produced one `[8]` selection tick in the live Android-like browser check, without a page error. The full haptics test and `node --check public/fish/js/main.js` passed again after that fix.

## Device limits

Physical iPhone and Android vibration feel, and a physical motion cast, were not checked in this environment. These require a device.
