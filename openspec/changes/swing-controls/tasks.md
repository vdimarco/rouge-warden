# Tasks

The OpenSpec CLI is not installed. These files are plain Markdown in the layout of the other changes. `openspec validate` has not run. A script read the seven spec files and checked that each requirement has SHALL, and that each requirement has at least one scenario with WHEN and THEN. It also checked the files for em dashes.

A box is ticked only when the code and a test in the branch show the work done. No code exists yet, so no box is ticked.

Baseline: when I first drafted this change I ran `physics.test`, `city.test`, `mobile.test`, `mobile.e2e`, `phone-swing.e2e` and `climb.e2e` on main. All six passed. `phone-swing.e2e` read a mean of 18.9 m/s and 190 m in its 12 s run. Run them again before you start, because main may have moved.

Run the suites from the repo root with `NODE_PATH=/opt/node22/lib/node_modules node qa/vr/<name>.mjs`. The machine has four cores and software WebGL, so run the browser suites one at a time.

## Order and ownership

Agent A and agent B work at the same time. Their files do not overlap. The interface is in "The interface between agent A and agent B" in `design.md`, and it is frozen. A browser check of B that needs A's wiring is marked "join". It fails until A5 lands. Inside A, do A1 to A3 first: they need no browser. Neither agent edits `mobile.test.mjs`, `mobile.e2e.mjs`, `phone-swing.e2e.mjs` or `climb.e2e.mjs`.

## Agent A: the picker, the desktop and the pad

- [ ] A1. Words and numbers in `config.js`, and the lines in `ui.js`.
  - Add `TARGET`, `DESKTOP`, `PAD`, `HINT`, `FLATCAM` and `PHONE.buzz`.
  - Write `LINES_DESKTOP`, `LINES_PAD` and `LINES_PHONE` as in "Words" in `design.md`, with the `wall` group in every table.
  - Change the table order of `sayLine` in `ui.js` (hands, phone, mouse, pad, controller). Add the "Rope trigger" and "Release cue" rows to the `desk` branch of the Comfort page.
  - Check: `ui.mjs` (updated in A7) passes the line checks. `LINES_PAD` and `LINES_PHONE` have the keys and counts of `LINES_DESKTOP`. The phone lines name no mouse word. No line has an em dash. `climb.e2e.mjs` still finds `/W and S climb/`.
- [ ] A2. The picker and its Node test.
  - Write `js/target.js` with `createTarget`, `update`, `pick`, `tap`, `hand`, `releaseWindow`, `kick`, `reset` and `info`.
  - Write `qa/vr/target.test.mjs`.
  - It checks the reach rules of each tier over 5,000 sampled states, each tier against its own bounds.
  - It checks the screen limit at 390 by 844 and 960 by 540, at the default pitch and at +8 degrees.
  - It checks the preferred elevation at rest, looking up and falling.
  - It checks the specials: a clog, a clog behind a wall, a clog at 40 degrees, the enter and leave angles, a pipe from behind, and the gold ring from the start roof at 16 by 9 and 390 by 844.
  - It checks the hysteresis sweep and the variety rule (two towers, only one tower).
  - It checks the hand, the second rope, and `same` for one rope.
  - It checks `tap`: a clog on a lower roof, the exact point, the marked target, the bias, and a vertical ray that gives no bias.
  - It checks the superset of the old assist: a reference copy of `assistAim` and of the cone of `rope.js`, 5,000 states, views that differ from the velocity heading.
  - It checks `releaseWindow` and `kick`, the ray counts, the replaced `city.raycast`, and the import in Node with no three.
  - Check: `node qa/vr/target.test.mjs` passes.
- [ ] A3. The two first-time bots in Node.
  - Add them to `target.test.mjs`. They use `physics.js`, `city.js`, `target.js`, `releaseWindow` and `kick`, with `FLATCAM` and the rules in "The first-time bots".
  - Tune in this order: the `TARGET` weights, the variety penalty, `DESKTOP.attachSpeed` (0 to 12), `DESKTOP.hop` (0 to 5). Never change `physics.js`.
  - Check: the same file passes. For each bot, at least 17 of 18 start-roof runs and at least 120 of 150 random runs pass, with a median of 15 s or less. Write the numbers under "Results" below.
  - If a gate fails after tuning, stop and report the measured rates to the person. Do not lower the gate.
- [ ] A4. The input side of `desktop.js`.
  - Swing 1 and swing 2, with `D.chooseHand`, the hand mapping and `swingDown`. The keys E and Q (M stays mute, from #182). The rule that a modifier key does nothing.
  - The wheel rule (Ctrl and Meta, the flick cap). The resume click and the lock click. Page keys in a pause.
  - Trigger hysteresis, the radial dead zone and the look curve. Y. Start toggles the pause. B, Back, the stick buttons and the D-pad do nothing.
  - `viewDown` from the pad and from `mobile.sample().view`. A map press closes an open map.
  - `D.marker` with `#lockRing`, `D.pop`, `D.cue` with the caption, `D.hints` with `#keyHints`, `D.rumble` and the pad kind. `document.body.dataset.device`.
  - Check: the key, mouse and pad sections of `flat.mjs`. They use real `KeyboardEvent` and mouse events, and a fake `navigator.getGamepads` for every button and axis in the pad spec.
- [ ] A5. The wiring in `main.js`.
  - Fill the context. Delete `AIM_UP`, `AIM_NEAR` and the ground branch of `viewAim`. Rewrite `flatInput`: the picker decides in play, the exact ray stays in the opening and the pause, a test override wins. Keep the hit of `viewAim` in `AIM_HIT`.
  - Set `D.chooseHand` in play only. Pass the pick to `shoot` and `fire`. Handle the second rope, the 0.3 s wait, the dry fire along the view and the "No building" line in `aimAndFire`.
  - Add the latch (the cup lands, and the kick reads the latch). Generalise `phoneBoost` to the kick. Add the hop when `DESKTOP.hop` is above 0.
  - Route `feedback` to `D.mobile.buzz`, `D.pop` and `D.rumble`, in flat play only. Move the first wall line to `ui.sayLine("wall", 0)`.
  - Make `phoneAim` follow the tap rules with the picker, with `same` for one rope.
  - Honour `settings.hold` for a computer and a pad. Add `settings.cue` to the defaults and the loader. Close an open map on a map press. Call `D.lock()` when a key closes the map or the pause.
  - Call `flatcam.turnTo` for a real swing from a wall. Call `D.hints`, the marker and the cue. Set the lift flag from `info().specialNear`.
  - Add `G.test.target()`, and `viewDown` and `swingDown` in `G.test.input()`. In `wireTitle`, read `data-label-touch`, show `#playMouse` on a touch device with a fine pointer, wire it to `D.mobile.use(false)`, show the right note, and set `document.body.dataset.device`.
  - Check: the rest of `flat.mjs`. `hero.mjs`, `mobile.e2e.mjs`, `phone-swing.e2e.mjs`, `climb.e2e.mjs`, `boot.mjs` and `play.mjs` pass with no threshold changed. `grep -n "AIM_UP\|AIM_NEAR" public/vr/js/main.js` returns nothing.
- [ ] A6. The camera in `flatcam.js`.
  - Move the follow numbers to `FLATCAM`. Add `flags.lift` with the clog rule. Add `turnTo(yaw, secs)`.
  - Check: the lift scenarios in `flat.mjs`. The pitch rises to +0.12 rad in 1.5 s, never lowers, pauses for 0.7 s after a look input, stops for a clog, and the follow turn still runs. The turn from a wall ends within 20 degrees of the target bearing in 0.5 s. `hero.mjs` passes, including the 3,000-view sweep.
- [ ] A7. The existing tests.
  - `boot.mjs`: the pad kind check presses button 1.
  - `ui.mjs`: a pad reads `LINES_PAD`. The key check covers `LINES_PAD` and `wall`. The flat Comfort page shows "Rope trigger" and "Release cue".
  - `hero.mjs`: the comments say "auto target". Two VR assertions.
  - Check: `boot.mjs`, `ui.mjs` and `hero.mjs` pass.
- [ ] A8. The full `qa/vr/flat.mjs`.
  - Sizes 640 by 360, 960 by 540 and 1280 by 720.
  - The opening: a real left button and a fake RT at the crack attach, and F and RB pump.
  - A quick click and a quick RT tap attach. The resume click and the lock click fire nothing. Tab, Tab keeps the lock.
  - Exact aim first in first person. A stubbed picker result of none with a real roof in view fires nothing.
  - The marker position within 3 px, the arrow at the start roof, the arrow behind the camera on a wall, the safe window, the pop and the cue. The wheel rules. The hint strip with its tail.
  - A cling, a swing off the wall, the view turns. A clog 20 m below stays the target through a 3 s swing.
  - The fake pad for every button, axis, trigger hysteresis and rumble, a non-standard pad, and a touch device with a fine pointer (`maxTouchPoints` 5) and both title buttons.
  - The browser bot from the start views -10, 0 and +10. Screenshots to `SHOTS`.
  - Check: `node qa/vr/flat.mjs` passes with no console error.
- [ ] A9. Release, after B reports done.
  - Set `VERSION` to 1.7.0 in `config.js` and `sw.js` (main is at 1.6.0 after #182). List `target.js` in `sw.js`.
  - Set `appVersion` and `appVersionName` to 1.7.0 and `appVersionCode` to 6 in `quest/twa-manifest.json`.
  - In `.github/workflows/swing-browser.yml`, add `target.test.mjs` and `mobile-panel.test.mjs` to the Node step of the first job. Add a second job, `flat-play`, with a timeout of 30 minutes. It runs `pwa.mjs`, `flat.mjs`, `phone-controls.e2e.mjs`, `climb.e2e.mjs`, `boot.mjs`, `ui.mjs` and `hero.mjs` one after the other. If a suite needs more time on the runner, split the job. The first job stays at 12 minutes plus the new Node file.
  - Check: `pwa.mjs` passes. It fails when a file in `js/` is missing from `sw.js` or when the versions differ. The workflow runs green on the branch.

### Results (fill in at A3)

| Bot | Start roof, -10 to +10 (18 runs) | 150 random starts | Median time |
|---|---|---|---|
| Bot 1, follows the cue | not run | not run | not run |
| Bot 2, ignores the cue | The throwaway prototype passed 18 | The prototype passed 133 | The prototype read 8.1 s |

## Agent B: the phone panel and the page

- [ ] B1. The phone panel in `mobile.js`.
  - Make `enabled` a getter and add `use(on)`. Add `view` to `sample()` and the VIEW button.
  - Add `marker(m)`: the lock-on ring, the edge arrow, the safe window, the class `no-target` on SWING and the class `target-ready` on the panel. Add `pop()` and `buzz(ms)`.
  - Show Center only while motion aim is on. Show the centre ring only in first person (`body[data-view="first"]`).
  - Let `target()` keep only the dead-latch safety. Update the hint strings: the ring is yellow now, not green.
  - The disabled stub implements `marker`, `pop`, `buzz` and `use` as no-ops.
  - New code guards `style` and `classList.contains` as `rush()` does.
  - Check: the old `mobile.test.mjs` passes unmodified. The new `mobile-panel.test.mjs` runs: the `view` edge lasts one sample. `marker` moves the ring and sets the classes. `marker(null)` hides the ring. `behind` puts the arrow on the bottom border. `buzz` calls `navigator.vibrate` at most once every 40 ms and does not throw when `vibrate` is missing. `pop` sets and clears its class. The stub methods do not throw. `use(false)` makes `enabled` false and hides the panel.
- [ ] B2. The page in `index.html`.
  - Restyle the phone buttons in the comic style, at 48 by 48 px or larger. Fit four top buttons in one row at 360 px. Move `.fs-top` to 74 px. Put the score pills in one row on a narrow portrait screen.
  - Add the CSS for `.phone-target`, its arrow, `.phone-view`, `.no-target` and the pop.
  - Write How to play with five sections from "Words" in `design.md`. Rename "Controllers" to "Headset controllers". Remove "A game pad works too". Order the sections by `body[data-device]`.
  - Set `data-label-touch="PLAY WITH TOUCH"` on `#playFlat`. Add `#playMouse` (hidden). Rewrite `#touchNote`. Add `#deskNote` and `#hybridNote` (hidden).
  - Check: `phone-controls.e2e.mjs` (sizes, both layouts, text, labels, order). `boot.mjs` still finds "pinch" and "Shift" in the dialog.
- [ ] B3. `qa/vr/phone-controls.e2e.mjs`, at 390 by 844, 844 by 390 and 360 by 740.
  - Marker API: the ring centre is within 2 px of the NDC. The arrow sits on the border of the safe window. The `behind` arrow sits on the bottom border. A clog ring is green. `null` hides the ring. `no-target` dims SWING.
  - Safe window: targets at NDC y from 0.3 to 1.5 and x from -1.5 to 1.5 with a spoken line showing. The ring and the arrow overlap no top button, score pill, spoken line, SWING panel or climb pad. The window is at least 55 percent of the height in portrait and 45 percent in landscape.
  - Every visible button is at least 48 by 48. The top row is one line with the sensors granted (a stub that grants them) and denied. The layout boxes do not overlap. No turn card shows. `#keyHints` is hidden on touch in play with an unfinished tutorial.
  - The title labels, the notes, the How to play sections and their order.
  - A `navigator.vibrate` spy for `buzz`. The pop on a device with no `vibrate`.
  - A tap on the pixel of a clog on a lower roof reaches the clog. A tap with the only building held keeps the rope.
  - The bot that only taps, for 30 s, from the start roof facing the ring at -10, 0 and +10 degrees.
  - Join checks, which need A5: VIEW toggles the view once. The ring and `G.test.target().ndc` agree within 3 px. Vibration fires on a real attach and a real pump. The bot passes.
  - Check: the file runs. Before A5 only the join checks fail. If the phone bot passes less than 3 of 3, report the rate and the cause before the gate changes.
- [ ] B4. Main's phone tests stay green.
  - Run `mobile.test.mjs`, `mobile.e2e.mjs`, `phone-swing.e2e.mjs` and `climb.e2e.mjs`. Change no file and no threshold.
  - Check: all four pass on B's branch (they pass on main), and again at the join.

## Join

- [ ] J1. Merge both branches. No file conflicts are expected, because the two agents edit different files.
- [ ] J2. Run every `qa/vr` suite on the merged tree, one at a time, and write the results here: `physics.test`, `city.test`, `target.test`, `mobile.test`, `mobile-panel.test`, `mobile.e2e`, `phone-swing.e2e`, `phone-controls.e2e`, `climb.e2e`, `flat`, `hero`, `boot`, `xr`, `swing`, `comfort`, `fx`, `render`, `perf`, `audio`, `pwa`, `play`, `ui`, `mr`. The CI runs `physics.test`, `city.test`, `target.test`, `mobile.test`, `mobile-panel.test`, `mobile.e2e` and `phone-swing.e2e` in the first job, and `pwa`, `flat`, `phone-controls.e2e`, `climb.e2e`, `boot`, `ui` and `hero` in the second. `xr`, `swing`, `comfort`, `fx`, `render`, `perf`, `audio`, `play` and `mr` stay manual.
- [ ] J3. Read the screenshots at 640 by 360, 960 by 540, 1280 by 720, 844 by 390, 390 by 844 and 360 by 740 against the scenarios. Look for the ring on the target, the edge arrow at the start roof, the arrow behind the camera on a wall, the LET GO caption, the hint strip, the green clog ring, the dimmed SWING button, the VIEW button and the four-button top row.
- [ ] J4. Validate with the OpenSpec CLI when it is available. Until then run the structure script on the seven spec files.
- [ ] J5. Hardware checks. They are not possible in this session.
  - A real phone, Android Chrome and iPhone Safari: thumb reach, vibration on Android, the pop on iPhone, the ring over a moving city, motion aim with four top buttons.
  - A touch laptop: both title buttons, and the pad after PLAY WITH MOUSE AND KEYBOARD.
  - A real mouse with pointer lock, a trackpad (E, Q, pinch and scroll momentum), and the Ctrl and Cmd keys.
  - An Xbox pad and a PlayStation pad: layout, trigger values, drift, rumble, and the generic button words.
  - A Quest: unchanged play, no ring, no strip, no pad rumble.
- [ ] J6. Do not archive yet. The lead decided (open question 2): `swing-hero-comic` and `full-swing-phone-and-climbing` stay open until their device checks run, so this change stays open too. When the device checks are done, archive in this order:
  1. In `swing-hero-comic/tasks.md` and `full-swing-phone-and-climbing/tasks.md`, move every open box that needs a device or a final run to a "Deferred" list with the reason. Keep each box visible. Archive both changes.
  2. Check that `openspec/specs/` now holds `swing-flat-camera`, `swing-phone-aim`, `swing-climbing` and `swing-phone-play`.
  3. Archive this change. Read the new specs under `openspec/specs/`. Check that the pad lines, the title labels and the wall line read the same in every spec.
  4. If the person wants the old changes left open, turn the `MODIFIED` entries of this change into `ADDED` entries with new names, list the old requirements for removal, and archive this change alone.
