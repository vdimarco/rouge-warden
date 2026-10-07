# Verification

## Automated
All 20 `qa/tidebreak/*.test.mjs` suites pass, with the new `team-presence.test.mjs`. It covers the draft for all sixteen heroes and three seeds (no repeated hero, no repeated kit on a team, same seed gives the same draft, teammates talk), the drafted lineup and names in the match, an unchanged match without a lineup, first blood, double kill inside 12 seconds and not after, killing spree, shutdown, the ward alarm cooldown and lane name, assist and rally for both teams, the rally expiry, and two full bot matches with pings and kill records. `node --check` and `git diff --check` pass.

## Browser
Local Playwright with the preinstalled Chromium (software GL) at 1440x900, 390x844 and 844x390:
- The draft locks six distinct heroes, and the battlefield names match the board at all three sizes. The start button stays on screen. Enter skips the draft.
- Staged events show the kill feed, the "Double kill" style banner, the ward alarm banner, a minimap pulse and the team chat without covering controls.
- The Rally button records a rally ping at all three sizes. The tactical map shows hero portraits, the ward alarm and pings.
- A full six-minute bot match in the page fired these calls in order with no console errors: first blood, the Wild Hunt, ward alarms by lane, enemy ward destroyed, our ward has fallen, killing spree, double kill, mega kill, unstoppable, wicked sick, shut down, and defeat. Chat lines came from both teammates.
- HUD skill icons measure 54 to 62 px for every tested hero. The clock holds while the mouse is outside the window and runs after it returns.

## Recorded clips
All 40 clips load with no 404s. In a full in-page match, first blood, double kill, killing spree and the battle start played as recorded lines and no longer reached the speech engine. Lines without a clip (ward alarms, objectives) still use speech. `team-presence.test.mjs` checks that every multi-kill and streak name has a clip file.

## Music
In local Chromium the menu played A Legend Will Rise, the draft played Prepare to Fight, the match played the calm and battle tracks together, and a forced loss stopped them and played the defeat lament. No 404s or console errors. The six CC0 tracks total 5.7 MB and stream only for their scene.

## Camera and skills
At 1440x900 the left edge scrolled the view and showed "Back to hero". A minimap click moved the view to the enemy base without opening the tactical map, and Space returned it. The skill arc was checked at all three sizes. The shared `browser` check passes on all six viewports.

## Desktop camera, menu, sound and large screens
`NODE_PATH=qa/browser/node_modules node qa/tidebreak/desktop.e2e.mjs` passes in local Chromium (software GL, the desktop autoplay rule):
- The Menu button sits in the top left and reads "Menu Esc".
- A centred mouse leaves the push near 0; the right edge pushes it to +475 and the left edge to -593 world units; "Back to hero" stays hidden.
- With the mouse outside the window, the clock keeps running and the push holds.
- Esc opens the menu and it stays open; Esc closes it; the Menu button and Keep playing do the same.
- The match measures 0.107 RMS at the output; the speaker button turns sound off and on and saves it.
- At 3440x1440 the canvas has 3,685,014 backing pixels (pixel ratio 0.86), inside the 2560x1440 budget.
All 20 `qa/tidebreak/*.test.mjs` suites pass. Screenshots at 1440x900, 390x844 and 844x390 show the Menu and speaker buttons clear of the score and the objective.

## Second pass and review fixes
`NODE_PATH=qa/browser/node_modules node qa/tidebreak/desktop.e2e.mjs` passes 17 checks in local Chromium without GPU flags (SwiftShader flags made the 2D canvas take about 3 s per frame in this container). Page state for the sound checks is read through CDP with `userGesture: false`, and `navigator.userActivation.hasBeenActive` is false before the first click.
- Sound: one real click on Play gives 0.15-0.18 RMS in the draft and match with no refused track; Test sound reports the level and the outside checklist; a deliberate mute saves "off" and the chip restores sound; a click after the context is suspended keeps sound on (0.13-0.16 RMS); a saved mute shows on hero select and one click there gives 0.09-0.10 RMS.
- Camera and input: push right +550 to +580 and left -790 to -840 world units; Space hold removes the push; a held Esc (31 CDP auto-repeats) leaves the menu open; minimap look ends on release and the hero stays on screen; a resize keeps a move order and a held key; full screen ended during play offers the choice, windowed play stays windowed and is saved; with the menu already open the choice appears; closing it with Esc never forces full screen back.
- Motion: from the same open spot, the hero walks at least 250 units per 1 s window; high-pass jitter 0.003-0.006 px at 144 Hz, 0.06 px at 75 Hz, 0.11 px at 60 Hz. With interpolation switched off the 144 Hz check fails at 1.48 px.
- Phone 390x844 with sound off: nothing in the top left overlaps the score (with the old styles the chip did).
- 3440x1440: 2,948,594 backing pixels; `?perf` shows frame timing and counts only match frames.
`node qa/tidebreak/adapt.test.mjs` passes 10 cases; the old ratio formula, no raise floor and a .35 floor each make it fail. All `qa/tidebreak/*.test.mjs` suites and the CI creature browser check (`qa/creatures/browser.mjs`, five viewports) pass. Screenshots at 1440x900, 844x390 and 390x844 show the Test sound panel, the readout under the minimap, and the hero-select nav with the chip at 640-740 px without overflow.

## Not checked
Speech was checked with a stubbed speech engine, so the real voice and the sound mix have not been heard. The headless browser cannot play audio to a listener. Physical phone touch and performance were not tested. A real 100-175 Hz panel was simulated with a manual rAF pump, not measured. The frame rate on a real ultra-wide monitor with a GPU was not measured; the test browser renders in software at about 3 frames per second, so only the pixel budget was checked there. Keyboard lock and the full-screen exit path need a check in a real Chrome, Firefox and Safari window. OpenSpec CLI is not installed, so the change was checked by hand against the existing delta format.
