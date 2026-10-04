# Tasks

The OpenSpec CLI is not installed. These files are plain Markdown in the layout of the other changes. `openspec validate` has not run. A script read the seven spec files and checked that each requirement has SHALL, and that each requirement has at least one scenario with WHEN and THEN. It also checked the files for em dashes.

A box is ticked only when the code and a test in the branch show the work done. Agent A ticked A1 to A3, A6 and A7. A4, A5 and A8 were open for the join checks that need B's markup and `mobile.js`. They are ticked now: the join checks ran on the joined tree (see the status line under each, and J2).

Baseline: when I first drafted this change I ran `physics.test`, `city.test`, `mobile.test`, `mobile.e2e`, `phone-swing.e2e` and `climb.e2e` on main. All six passed. `phone-swing.e2e` read a mean of 18.9 m/s and 190 m in its 12 s run. Run them again before you start, because main may have moved.

Run the suites from the repo root with `NODE_PATH=/opt/node22/lib/node_modules node qa/vr/<name>.mjs`. The machine has four cores and software WebGL, so run the browser suites one at a time.

## Order and ownership

Agent A and agent B work at the same time. Their files do not overlap. The interface is in "The interface between agent A and agent B" in `design.md`, and it is frozen. A browser check of B that needs A's wiring is marked "join". It fails until A5 lands. Inside A, do A1 to A3 first: they need no browser. Neither agent edits `mobile.test.mjs`, `mobile.e2e.mjs`, `phone-swing.e2e.mjs` or `climb.e2e.mjs`.

## Agent A: the picker, the desktop and the pad

- [x] A1. Words and numbers in `config.js`, and the lines in `ui.js`.
  - Add `TARGET`, `DESKTOP`, `PAD`, `HINT`, `FLATCAM` and `PHONE.buzz`.
  - Write `LINES_DESKTOP`, `LINES_PAD` and `LINES_PHONE` as in "Words" in `design.md`, with the `wall` group in every table.
  - Change the table order of `sayLine` in `ui.js` (hands, phone, mouse, pad, controller). Add the "Rope trigger" and "Release cue" rows to the `desk` branch of the Comfort page.
  - Check: `ui.mjs` (updated in A7) passes the line checks. `LINES_PAD` and `LINES_PHONE` have the keys and counts of `LINES_DESKTOP`. The phone lines name no mouse word. No line has an em dash. `climb.e2e.mjs` still finds `/W and S climb/`.
- [x] A2. The picker and its Node test.
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
- [x] A3. The two first-time bots in Node.
  - Add them to `target.test.mjs`. They use `physics.js`, `city.js`, `target.js`, `releaseWindow` and `kick`, with `FLATCAM` and the rules in "The first-time bots".
  - Tune in this order: the `TARGET` weights, the variety penalty, `DESKTOP.attachSpeed` (0 to 12), `DESKTOP.hop` (0 to 5). Never change `physics.js`.
  - Check: the same file passes. For each bot, at least 17 of 18 start-roof runs and at least 120 of 150 random runs pass, with a median of 15 s or less. Write the numbers under "Results" below.
  - If a gate fails after tuning, stop and report the measured rates to the person. Do not lower the gate.
- [x] A4. The input side of `desktop.js`.
  - Swing 1 and swing 2, with `D.chooseHand`, the hand mapping and `swingDown`. The keys E and Q (M stays mute, from #182). The rule that a modifier key does nothing.
  - The wheel rule (Ctrl and Meta, the flick cap). The resume click and the lock click. Page keys in a pause.
  - Trigger hysteresis, the radial dead zone and the look curve. Y. Start toggles the pause. B, Back, the stick buttons and the D-pad do nothing.
  - `viewDown` from the pad and from `mobile.sample().view`. A map press closes an open map.
  - `D.marker` with `#lockRing`, `D.pop`, `D.cue` with the caption, `D.hints` with `#keyHints`, `D.rumble` and the pad kind. `document.body.dataset.device`.
  - Check: the key, mouse and pad sections of `flat.mjs`. They use real `KeyboardEvent` and mouse events, and a fake `navigator.getGamepads` for every button and axis in the pad spec.
  - Status (A): done. The opening, swing, pad and marker parts of `flat.mjs` pass. A pad Y press is real. The `view` edge of `mobile.sample()` is tested with a stand-in sample on a computer (it has the stub) and with B's real VIEW button on a touch page (`flat.mjs` title part, and the [join] check of `phone-controls.e2e.mjs`). Join (J2): passes on the joined tree. `D.update` itself no longer makes arrays or closures each frame. On a touch device `mobile.sample()` still spreads a new object each frame; that predates this change (#81).
- [x] A5. The wiring in `main.js`.
  - Fill the context. Delete `AIM_UP`, `AIM_NEAR` and the ground branch of `viewAim`. Rewrite `flatInput`: the picker decides in play, the exact ray stays in the opening and the pause, a test override wins. Keep the hit of `viewAim` in `AIM_HIT`.
  - Set `D.chooseHand` in play only. Pass the pick to `shoot` and `fire`. Handle the second rope, the 0.3 s wait, the dry fire along the view and the "No building" line in `aimAndFire`.
  - Add the latch (the cup lands, and the kick reads the latch). Generalise `phoneBoost` to the kick. Add the hop when `DESKTOP.hop` is above 0.
  - Route `feedback` to `D.mobile.buzz`, `D.pop` and `D.rumble`, in flat play only. Move the first wall line to `ui.sayLine("wall", 0)`.
  - Make `phoneAim` follow the tap rules with the picker, with `same` for one rope.
  - Honour `settings.hold` for a computer and a pad. Add `settings.cue` to the defaults and the loader. Close an open map on a map press. Call `D.lock()` when Tab closes the map and when a resume closes the pause (`onResume`). M does not: it is the mute key.
  - Call `flatcam.turnTo` for a real swing from a wall. Call `D.hints`, the marker and the cue. Set the lift flag from `info().specialNear`.
  - Add `G.test.target()`, and `viewDown` and `swingDown` in `G.test.input()`. In `wireTitle`, read `data-label-touch`, show `#playMouse` on a touch device with a fine pointer, wire it to `D.mobile.use(false)`, show the right note, and set `document.body.dataset.device`.
  - Check: the rest of `flat.mjs`. `hero.mjs`, `mobile.e2e.mjs`, `phone-swing.e2e.mjs`, `climb.e2e.mjs`, `boot.mjs` and `play.mjs` pass with no threshold changed. `grep -n "AIM_UP\|AIM_NEAR" public/vr/js/main.js` returns nothing.
  - Status (A): done. `flat.mjs`, `hero`, `mobile.e2e`, `phone-swing.e2e`, `climb.e2e`, `boot` and `play` pass, and the grep returns nothing. Before the join the title checks ran with stand-ins for `#playMouse`, `#deskNote`, `#hybridNote`, `data-label-touch` and `mobile.use`, because they are B's. Join (J2): the same checks now run against B's real markup and B's real `mobile.use`, and the stand-ins are gone from `flat.mjs`, and the phone panel is checked hidden after `mobile.use(false)`. PLAY WITH TOUCH calls `mobile.use(true)`, so touch comes back after PLAY WITH MOUSE AND KEYBOARD, and `body[data-device]` follows the touch kind (a join check found it stayed on "pad"). The start-roof scenario was reworded to the measured behaviour (decision D1, see Results).
- [x] A6. The camera in `flatcam.js`.
  - Move the follow numbers to `FLATCAM`. Add `flags.lift` with the clog rule. Add `turnTo(yaw, secs)`.
  - Check: the lift scenarios in `flat.mjs`. The pitch rises to +0.12 rad in 1.5 s, never lowers, pauses for 0.7 s after a look input, stops for a clog, and the follow turn still runs. The turn from a wall ends within 20 degrees of the target bearing in 0.5 s. `hero.mjs` passes, including the 3,000-view sweep.
- [x] A7. The existing tests.
  - `boot.mjs`: the pad kind check presses button 1.
  - `ui.mjs`: a pad reads `LINES_PAD`. The key check covers `LINES_PAD` and `wall`. The flat Comfort page shows "Rope trigger" and "Release cue".
  - `hero.mjs`: the comments say "auto target". Two VR assertions.
  - Check: `boot.mjs`, `ui.mjs` and `hero.mjs` pass.
- [x] A8. The full `qa/vr/flat.mjs`.
  - Sizes 640 by 360, 960 by 540 and 1280 by 720.
  - The opening: a real left button and a fake RT at the crack attach, and F and RB pump.
  - A quick click and a quick RT tap attach. The resume click and the lock click fire nothing. Tab, Tab keeps the lock.
  - Exact aim first in first person. A picker that returns none while `ropes.aim` still sees a real roof fires nothing (the real city and the real `picker.update`, only `picker.result` is stubbed to none: a check that fails when `aimAndFire` lets `ropes.aim` decide). A city that answers no ray gives no target and a dry fire (a separate case).
  - The marker position within 3 px, the arrow at the start roof, the arrow behind the camera on a wall, the safe window, the pop and the cue. The wheel rules. The hint strip with its tail.
  - A cling, a swing off the wall, the view turns. A clog 20 m below stays the target through a 3 s swing.
  - The fake pad for every button, axis, trigger hysteresis and rumble, a non-standard pad, and a touch device with a fine pointer (`maxTouchPoints` 5) and both title buttons.
  - The browser bot from the start views -10, 0 and +10. Screenshots to `SHOTS`.
  - Check: `node qa/vr/flat.mjs` passes with no console error.
  - Status: `node qa/vr/flat.mjs` passes on the joined tree (197 checks, no page error), against B's real markup and `mobile.js`. The start roof (decision D1): with W and the left button the hero is in the air after 3.28 s (3.1 to 3.3 s over several runs), with the left stick up and RT after 3.28 s, and with the button alone the hero is still on the roof after 6 s. `flat.mjs` checks the W case and the pad case against a bound of 4 s and prints the case without W. The key strip text is checked not to be cut off. The headset check now needs the rope to attach before it counts the rumble.
- [ ] A9. Release, after B reports done.
  - Set `VERSION` to 1.7.0 in `config.js` and `sw.js` (main is at 1.6.0 after #182). List `target.js` in `sw.js`.
  - Set `appVersion` and `appVersionName` to 1.7.0 and `appVersionCode` to 6 in `quest/twa-manifest.json`.
  - In `.github/workflows/swing-browser.yml`, add `target.test.mjs` and `mobile-panel.test.mjs` to the Node step of the first job. Add a second job, `flat-play`, with a timeout of 30 minutes. It runs `pwa.mjs`, `flat.mjs`, `phone-controls.e2e.mjs`, `climb.e2e.mjs`, `boot.mjs`, `ui.mjs` and `hero.mjs` one after the other. If a suite needs more time on the runner, split the job. The first job keeps its 20 minutes (main raised it from 12 in #182, because that job also runs `rings-map.e2e` and `sound.e2e`) and gets the two new Node files. Both `paths` lists (pull_request and push) also name `quest/**`, `vercel.json` and `public/.well-known/**`, the files `pwa.mjs` reads outside `public/vr/`.
  - Check: `pwa.mjs` passes. It fails when a file in `js/` is missing from `sw.js` or when the versions differ. The workflow runs green on the branch.

### Results (measured at A3)

Measured by `node qa/vr/target.test.mjs` on the current `physics.js` (main after #182, which changed the wall grab). Start values of the design were enough: kick 10 m/s (`DESKTOP.attachSpeed`), hop 0 (`DESKTOP.hop`), variety penalty 0.6, and the `TARGET` weights as written in `config.js`. No tuning was needed.

| Bot | Start roof, -10 to +10 (18 runs) | 150 random starts | Median time (start roof, random starts) |
|---|---|---|---|
| Bot 1, follows the cue | 18 of 18 | 146 of 150 | 13.07 s, 8.97 s |
| Bot 2, ignores the cue | 18 of 18 | 149 of 150 | 13.67 s, 9.05 s |

- Gates: at least 17 of 18, at least 120 of 150, median 15 s or less. All three hold for both bots.
- (After the third review: a held target is scored against the bearing of the fan, which moved bot 1 from 147 to 146 of 150 random starts. Nothing else changed.)
- A run ends at the third building. A bot that goes on can fall into the water after it, and that is no failure of the picker.
- The start-roof median is 1.4 s under its gate. The variety rule carries it: with the penalty at 0 the start-roof median is 17.9 s.
- With clogs listed as specials in the bot's search (as the game does) bot 1 passes 141 of 150 random starts and bot 2 passes 149 of 150.
- Both bots hold W, as the first-time player does. A start-roof swing with no W only slides the hero across the roof and he stops on it, for hop 0 and for hop 3 at kick 10, and for kick 12. The lead decided (D1): the first tutorial line, the key strip, the title note and How to play say W. With W the hero leaves the roof in 3.1 to 3.3 s (`flat.mjs` checks 4 s or less), and with the button alone `flat.mjs` checks that the hero stays on the roof. See "The start roof" in design.md.

## Agent B: the phone panel and the page

- [x] B1. The phone panel in `mobile.js`.
  - Make `enabled` a getter and add `use(on)`. Add `view` to `sample()` and the VIEW button.
  - Add `marker(m)`: the lock-on ring, the edge arrow, the safe window, the class `no-target` on SWING and the class `target-ready` on the panel. Add `pop()` and `buzz(ms)`.
  - Show Center only while motion aim is on. Show the centre ring only in first person (`body[data-view="first"]`).
  - Let `target()` keep only the dead-latch safety. Update the hint strings: the ring is yellow now, not green.
  - The disabled stub implements `marker`, `pop`, `buzz` and `use` as no-ops.
  - New code guards `style` and `classList.contains` as `rush()` does.
  - Status: done. `mobile.js` keeps its single quotes, because `mobile.test.mjs` rewrites the import of three by its exact text. `mobile.safe()` returns the window of the marker, for tests. The hint lines over SWING were cut to about 42 letters (see B2).
  - Check: the old `mobile.test.mjs` passes unmodified. The new `mobile-panel.test.mjs` runs: the `view` edge lasts one sample. `marker` moves the ring and sets the classes. `marker(null)` hides the ring. `behind` puts the arrow on the bottom border. `buzz` calls `navigator.vibrate` at most once every 40 ms and does not throw when `vibrate` is missing. `pop` sets and clears its class. The stub methods do not throw. `use(false)` makes `enabled` false and hides the panel, and after it `pop()` adds no class and `buzz()` does not vibrate (checked with the buzz gap and the pop clock long over, and again after `use(true)`, so only the scheme can be the cause). A spoken toast with the class `on` cuts the safe window and a toast without it does not.
- [x] B2. The page in `index.html`.
  - Restyle the phone buttons in the comic style: every touch area 48 by 48 px or larger (the top row: boxes 46 px high with a 50 px hit area, see the status). Fit four top buttons in one row at 360 px. Move `.fs-top` to 74 px. Put the score pills in one row on a narrow portrait screen.
  - Add the CSS for `.phone-target`, its arrow, `.phone-view`, `.no-target` and the pop.
  - Write How to play with five sections from "Words" in `design.md`. Rename "Controllers" to "Headset controllers". Remove "A game pad works too". Order the sections by `body[data-device]`.
  - Set `data-label-touch="PLAY WITH TOUCH"` on `#playFlat`. Add `#playMouse` (hidden). Rewrite `#touchNote`. Add `#deskNote` and `#hybridNote` (hidden).
  - Status: done. The top row boxes are 46 px high with a 50 px hit area (an `::after` box, 2 px past each side), because `phone-swing.e2e.mjs` fails a top button taller than 46 px (`row.tall <= 46`, a frozen contract). Every other button box is 48 or more. The lead decided at the join (D2): keep the 46 px boxes and the 50 px hit area, because `phone-swing.e2e.mjs` belongs to main's earlier change and must not change. The requirement "Buttons are big enough for a thumb" in `swing-phone-controls` and "The phone buttons" in `design.md` say so now.
  - Status (join): the `<small>` footnote under the SWING button ("Tap to swing, the rope lets go by itself, drag to look") was removed to give the safe window more height. The hint lines over SWING were cut to about 42 letters, because at 360 px two of them ("Nothing in reach..." and "Aim centered...") wrapped to a second line, which lifted the SWING panel so that the tail of the spoken line (27 px under its box) poked 16 px into the hint. Now every hint line fits on one line at 360 px and the tail clears the panel by 2 px.
  - Check: `phone-controls.e2e.mjs` (sizes, both layouts, text, labels, order). `boot.mjs` still finds "pinch" and "Shift" in the dialog.
- [x] B3. `qa/vr/phone-controls.e2e.mjs`, at 390 by 844, 844 by 390 and 360 by 740.
  - Marker API: the ring centre is within 2 px of the NDC. The arrow sits on the border of the safe window. The `behind` arrow sits on the bottom border. A clog ring is green. `null` hides the ring. `no-target` dims SWING.
  - Safe window: targets at NDC y from 0.3 to 1.5 and x from -1.5 to 1.5 with a spoken line showing. The ring and the arrow overlap no top button, score pill, spoken line, SWING panel or climb pad. The window is at least 55 percent of the height in portrait and 45 percent in landscape.
  - Every visible button has a touch area of at least 48 by 48. The top boxes are 46 px high and a touch 1 px outside any side of one still hits it (`elementFromPoint`). Every other button box is 48 by 48 or more. The top row is one line with the sensors granted (a stub that grants them) and denied. The layout boxes do not overlap, and the tail of the spoken line (27 px under its box) is measured too, for each of the eight hint lines at the three sizes. No turn card shows. `#keyHints` is hidden on touch in play with an unfinished tutorial.
  - The title labels, the notes, the How to play sections and their order.
  - A `navigator.vibrate` spy for `buzz`. The pop on a device with no `vibrate`.
  - A tap on the pixel of a clog on a lower roof reaches the clog. A tap with the only building held keeps the rope.
  - The bot that only taps, for 30 s, from the start roof facing the ring at -10, 0 and +10 degrees.
  - Words: the first phone tutorial line equals the text in "Words" in `design.md` (the test holds that text as a constant, because the change documents move when the change is archived), and none of the 27 phone lines names a mouse, Shift, a key, a trigger, a bumper, a pinch or a grip. The Comfort page on a phone shows Aim assist and no Rope trigger or Release cue.
  - Join checks, which need A5: VIEW toggles the view once. The ring and `G.test.target().ndc` agree within 3 px. Vibration fires on a real attach and a real pump. The bot passes.
  - Status: done, and run again on the joined tree. The file has 14 checks marked `[join]`: the play button label, the touch note only, the first phone tutorial line, the phone words, `body[data-device]`, the Comfort page on a phone, the tap with the only building held (it needs the `same` rule of the picker), VIEW, the ring against `G.test.target().ndc`, the buzz on a real attach, the buzz on a real pump, the bot, the hybrid title and the computer title. On B's own branch the first nine of the original set failed until A5 (123 others passed then). On the joined tree all 161 checks pass: the 14 `[join]` checks and 147 others. The bot (SWING taps only) reaches three buildings at 7.5 s, 7.5 s and 8.3 s (-10, 0 and +10 degrees).
  - Check: the file runs. Before A5 only the join checks fail. If the phone bot passes less than 3 of 3, report the rate and the cause before the gate changes.
- [x] B4. Main's phone tests stay green.
  - Run `mobile.test.mjs`, `mobile.e2e.mjs`, `phone-swing.e2e.mjs` and `climb.e2e.mjs`. Change no file and no threshold.
  - Status: all four pass on B's branch, and so does `rings-map.e2e.mjs`. No file and no threshold changed. J2 runs them again at the join.
  - Check: all four pass on B's branch (they pass on main), and again at the join.

## Join

- [x] J1. Merge both branches. No file conflicts are expected, because the two agents edit different files. (Merged in 4425c44.)
- [ ] J2. Run every `qa/vr` suite on the merged tree, one at a time, and write the results here: `physics.test`, `city.test`, `target.test`, `mobile.test`, `mobile-panel.test`, `mobile.e2e`, `phone-swing.e2e`, `phone-controls.e2e`, `climb.e2e`, `rings-map.e2e`, `sound.e2e`, `flat`, `hero`, `boot`, `xr`, `swing`, `comfort`, `fx`, `render`, `perf`, `audio`, `pwa`, `play`, `ui`, `mr`. The CI runs `physics.test`, `city.test`, `target.test`, `mobile.test`, `mobile-panel.test`, `mobile.e2e`, `phone-swing.e2e`, `rings-map.e2e` and `sound.e2e` in the first job, and `pwa`, `flat`, `phone-controls.e2e`, `climb.e2e`, `boot`, `ui` and `hero` in the second. `xr`, `swing`, `comfort`, `fx`, `render`, `perf`, `audio`, `play` and `mr` stay manual.
  - Status (J2, first part, run by the join agent after the fixes of the review). Each suite ran alone from the repo root on the joined tree, in headless Chromium with software WebGL. The headless run has no real phone, no motion sensor (the page gets a stub), no speakers (nobody listened; `AudioContext` is off in `flat.mjs` and `phone-controls.e2e.mjs`, and `audio.mjs` did not run), an emulated pointer lock and a fake pad. `physics.test`: 74 passed. `city.test`: 83 passed. `target.test`: 82 checks; bot 1 passes 18 of 18 at the start roof and 147 of 150 random starts (medians 13.05 s and 8.95 s), bot 2 passes 18 of 18 and 149 of 150 (13.65 s and 9.05 s), the same numbers as at A3 after the bots started to reset the drag time off the ground. `mobile.test` and `mobile-panel.test`: pass. `mobile.e2e`: 16 checks. `phone-swing.e2e`: 6 checks, taps alone read a mean of 21 m/s and 186 m in 12 s (the thresholds are 15 m/s and 140 m). `phone-controls.e2e`: 161 checks, 14 `[join]` checks, all pass, the bot reaches three buildings at 7.5 s, 7.5 s and 8.3 s. `climb.e2e`: 9. `rings-map.e2e`: 6. `sound.e2e`: 3. `pwa`: 11. `boot`: 33. `ui`: 74. `hero`: 87. `play`: 87. `flat`: 197 checks. Not run in this part: `xr`, `swing`, `comfort`, `fx`, `render`, `perf`, `audio`, `mr`. `openspec validate` could not run (no CLI): the structure script found no problem in the seven spec files.
  - One timing failure: in one full run of `flat.mjs`, the arrow check at 640 by 360 ("the arrow sits on the top border of the safe window, below the score pills") failed once. The marker reads the HUD at most 10 times a second in real time, and 30 frames can run in less time, so the window can be one read old. The same part passed on a rerun alone (and three more times after the wait below). `flat.mjs` now waits 160 ms before that check, as its neighbouring checks do. The game was not changed for this.
  - Status (J2, third review). The fixes of the third review ran on the same tree and machine, each suite alone from the repo root. `physics.test`: 74 passed. `city.test`: 83 passed. `target.test`: 87 checks (82 before; five new: the hold rule on a wall at three aim widths, tier 2 at most 5 times a second, and the same with a rope on the only building that qualifies); bot 1 passes 18 of 18 at the start roof and 146 of 150 random starts (medians 13.07 s and 8.97 s), bot 2 passes 18 of 18 and 149 of 150 (13.67 s and 9.05 s). `mobile.test` and `mobile-panel.test`: pass. `mobile.e2e`: 16 checks. `phone-swing.e2e`: 6 checks, taps alone read a mean of 21 m/s and 186 m in 12 s. `phone-controls.e2e`: 161 checks, the bot reaches three buildings at 7.5 s, 7.5 s and 8.3 s. `climb.e2e`: 9. `rings-map.e2e`: 6. `sound.e2e`: 3. `pwa`: 11. `boot`: 33. `ui`: 74. `hero`: 87. `play`: 87. `flat`: 218 checks (197 before): the browser bot reaches three buildings at 11.8 s, 9.1 s and 9.6 s (-10, 0 and +10 degrees). Also run on the tree before the last small edit (the options object of the second pick is reused): `swing`: 33, `xr`: 43, `fx`: 32, `comfort`: 48, `render`: 50, `mr`: 130, all pass. Not run: `perf`, `audio`, and every device check of J5.
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
  3. Archive this change. Read the new specs under `openspec/specs/`. Check that the pad lines, the title labels and the wall line read the same in every spec. The `swing-fullscreen` spec of `full-swing-rings-map-sound` still says PLAY ON PHONE: align it to PLAY WITH TOUCH and PLAY WITH MOUSE AND KEYBOARD when the changes are archived.
  4. If the person wants the old changes left open, turn the `MODIFIED` entries of this change into `ADDED` entries with new names, list the old requirements for removal, and archive this change alone.

## Open after the third review

- [ ] K1. The kick of a swing off a wall goes along the half-turned view (a review finding that reproduces, not fixed).
  - What happens: a real swing from a wall in third person starts the 0.4 s view turn, and the cup lands before it ends (0.13 to 0.3 s). `boost` in `main.js` reads `G.rigYaw` at the attach, so `kick` pushes the hero along the half-turned view: about 10 m/s along the wall, not toward the target. The phone SWING button on a wall does the same at 17 m/s. A browser check on a one-box tower with a clear street face (hero on its street wall, view into the wall, real left button) read 1.9 m/s toward the anchor and 3.5 m/s sideways a frame after the attach, with the kick set to 10 m/s (the finding gives -9 to 50 percent of the speed toward the target, by target distance).
  - The fix that the review proposed: `turnToSwing` returns true when it started a turn, `shoot` keeps that for the rope (`turned[i]`), and `boost` takes the yaw from the bearing of the hero to the anchor while it is set. It was written, tested and removed again, because it makes the first-time bots worse. The gates are hard, and the tuning order of "The first-time bots" in `design.md` did not bring them back.
  - Measured with the fix (the old numbers are in brackets). Browser bot, real events, 11 start views from -20 to +20 degrees in steps of 4: 8 of 11 pass (11 of 11); it misses -16, -8 and -4, and also -10 (the first gate case). Node bots: start roof 17 of 18 for both (18 of 18), random starts 140 and 138 of 150 (146 and 149), median start-roof time 13.5 s and 14.3 s (gate 15 s). A swing off a wall with no kick at all is worse (start roof 15 and 16 of 18, random 138 and 137). With the kick at the anchor, `DESKTOP.attachSpeed` of 8, 9, 11 and 12 gives start-roof passes of 11, 15 or 16, 15 and 13 of 18 (gate 17), and the variety penalty (0.4 to 0.8) or the up, wall and distance weights never give more than 17 of 18. The hero, kicked down the arc toward the anchor, reaches the street and the bot then drags along it between two towers.
  - Decision for the person (open question 3 of `proposal.md`): keep the sideways kick (the bots decide, and the review is closed as a known trade), or accept the kick at the anchor and a new gate. Nothing else depends on it. If the fix goes in, the Node bots in `target.test.mjs` must model it (the bot calls `kick` with its own camera yaw, so it cannot see this), and the phone suites (`phone-swing.e2e`, `climb.e2e`) must run again, because the phone shares `boost`.

