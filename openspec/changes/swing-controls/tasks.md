# Tasks

The OpenSpec CLI is not installed. These files are plain Markdown in the layout of the other changes. `openspec validate` has not run. A script read the six spec files and checked that each requirement has SHALL, and that each requirement has at least one scenario with WHEN and THEN.

A box is ticked only when the code and a test in the branch show the work done. No code exists yet, so no box is ticked.

Baseline: I ran `physics.test`, `city.test`, `mobile.test`, `mobile.e2e`, `phone-swing.e2e` and `climb.e2e` on main before this change. All six pass. `phone-swing.e2e` reads a mean of 18.9 m/s and 190 m in its 12 s run.

Run the suites from the repo root with `NODE_PATH=/opt/node22/lib/node_modules node qa/vr/<name>.mjs`. The machine has four cores and software WebGL, so run the browser suites one at a time.

## Order and ownership

Agent A and agent B work at the same time. Their files do not overlap. The interface is in "The interface between agent A and agent B" in `design.md`, and it is frozen. A browser check of B that needs A's wiring is marked "join". It fails until A5 lands. Inside A, do A1 to A3 first: they need no browser.

## Agent A: the picker, the desktop and the pad

- [ ] A1. Words and numbers in `config.js`, and the table order in `ui.js`.
  - Add `TARGET`, `DESKTOP`, `PAD`, `HINT` and `PHONE.buzz`.
  - Write `LINES_DESKTOP`, `LINES_PAD` and `LINES_PHONE` as in "Words" in `design.md`.
  - Change the table order of `sayLine` in `ui.js`.
  - Check: `ui.mjs` (updated in A7) passes the line checks. `LINES_PAD` and `LINES_PHONE` have the keys and counts of `LINES_DESKTOP`. The phone lines name no mouse word. No line has an em dash.
- [ ] A2. The picker and its Node test.
  - Write `js/target.js` with `createTarget`, `update`, `pick`, `second`, `hand`, `reset`, `info` and `attachKick`.
  - Write `qa/vr/target.test.mjs`.
  - It checks the reach rules over 5,000 sampled states and the portrait fan.
  - It checks the preferred elevation at rest, looking up and falling.
  - It checks the specials: a clog, a clog behind a wall, a clog at 40 degrees, a pipe from behind and the gold ring.
  - It checks the hysteresis sweep, the replaced `city.raycast`, the superset of the old fan over 5,000 states, the ray counts, and the import in Node with no three.
  - Check: `node qa/vr/target.test.mjs` passes.
- [ ] A3. The first-time bot in Node.
  - Add the bot to `target.test.mjs`. It uses `physics.js`, `city.js`, `target.js` and `attachKick`, with the rules in "The first-time bot".
  - Tune in this order: the `TARGET` weights, then `DESKTOP.attachSpeed` (at most 14). Never change `physics.js`.
  - Check: the same file passes. The offsets 0, +10 and -10 pass, and at least 6 of 7 offsets pass. Write the time to three buildings for each offset under "Results" below.
- [ ] A4. The input side of `desktop.js`.
  - Swing 1 and swing 2, with `D.chooseHand`, the hand mapping and `swingDown`.
  - The keys E, Q and M. The rule that a modifier key does nothing.
  - Trigger hysteresis, the radial dead zone and the look curve. Y and Back.
  - `viewDown` from the pad and from `mobile.sample().view`. A map press closes an open map.
  - `D.marker` with `#lockRing`, `D.hints` with `#keyHints`, `D.rumble` and the pad kind.
  - Check: the key, mouse and pad sections of `flat.mjs`. They use real `KeyboardEvent` and mouse events, and a fake `navigator.getGamepads` for every button and axis in the pad spec.
- [ ] A5. The wiring in `main.js`.
  - Fill the context. Delete `AIM_UP`, `AIM_NEAR` and the ground branch of `viewAim`. Rewrite `flatInput` with the exact-first rule.
  - Set `D.chooseHand`. Handle the second rope, the 0.3 s wait and the "No building" line in `aimAndFire`.
  - Add the hop in `shoot`. Generalise `phoneBoost` to the kick.
  - Route `feedback` to `D.mobile.buzz` and `D.rumble`.
  - Make `phoneAim` call the picker in place of `assistAim`.
  - Make flat play ignore `settings.hold`. Close an open map on a map press.
  - Call `D.hints` and the marker. Set the lift flag.
  - Add `G.test.target()`, and `viewDown` and `swingDown` in `G.test.input()`. Read `data-label-touch` in `wireTitle`.
  - Check: the rest of `flat.mjs`. `hero.mjs`, `mobile.e2e.mjs`, `phone-swing.e2e.mjs`, `climb.e2e.mjs` and `play.mjs` pass with no threshold changed. `grep -n "AIM_UP\|AIM_NEAR" public/vr/js/main.js` returns nothing.
- [ ] A6. The view lift in `flatcam.js` (`flags.lift`).
  - Check: the lift scenarios in `flat.mjs`. The pitch rises to +0.12 rad in 1.5 s, never lowers, pauses for 0.7 s after a look input, and the follow turn still runs. `hero.mjs` passes, including the 3,000-view sweep.
- [ ] A7. The existing tests.
  - `boot.mjs`: the pad kind check presses button 1.
  - `ui.mjs`: a pad reads `LINES_PAD`.
  - `hero.mjs`: the comments say "auto target".
  - Check: `boot.mjs`, `ui.mjs` and `hero.mjs` pass.
- [ ] A8. The full `qa/vr/flat.mjs`.
  - Sizes 640 by 360, 960 by 540 and 1280 by 720.
  - The strip and subtitle overlap check. The marker position within 3 px. The edge arrow at the start roof.
  - The browser bot from the start views -10, 0 and +10. Screenshots to `SHOTS`.
  - Check: `node qa/vr/flat.mjs` passes with no console error.
- [ ] A9. Release, after B reports done.
  - Set `VERSION` to 1.6.0 in `config.js` and `sw.js`. List `target.js` in `sw.js`.
  - Set `appVersion` and `appVersionName` to 1.6.0 and `appVersionCode` to 5 in `quest/twa-manifest.json`.
  - In `.github/workflows/swing-browser.yml`, add `target.test.mjs` to the Node step. Add steps for `flat.mjs`, `phone-controls.e2e.mjs` and `climb.e2e.mjs`. Raise the job timeout to 25 minutes.
  - Check: `pwa.mjs` passes. It fails when a file in `js/` is missing from `sw.js` or when the versions differ.

### Results (fill in at A3)

| Start offset | Plain physics | With the kick |
|---|---|---|
| -30, -20, -10, 0, +10, +20, +30 | The throwaway bot gave 0 of 7 | The throwaway bot gave 6 of 7 at 10 m/s |

## Agent B: the phone panel and the page

- [ ] B1. The phone panel in `mobile.js`.
  - Add `view` to `sample()` and the VIEW button.
  - Add `marker(m)`: the lock-on ring, the edge arrow, the class `no-target` on SWING and the class `target-ready` on the panel.
  - Add `buzz(ms)`.
  - Show Center only while motion aim is on. Show the centre ring only in first person (`body[data-view="first"]`).
  - Let `target()` keep only the dead-latch safety. Update the hint strings: the ring is yellow now, not green.
  - Check: `mobile.test.mjs`, with a stub `Element` that has `style` and `classList.contains`. It keeps every old assert. New asserts: the `view` edge lasts one sample. `marker` moves the ring and sets the classes. `marker(null)` hides the ring. `buzz` calls `navigator.vibrate` at most once every 40 ms, and does not throw when `vibrate` is missing.
- [ ] B2. The page in `index.html`.
  - Restyle the phone buttons in the comic style, at 48 by 48 px or larger.
  - Add the CSS for `.phone-target`, its arrow, `.phone-view` and `.no-target`.
  - Write How to play for the keyboard and mouse, the pad and the phone, from "Words" in `design.md`.
  - Set `data-label-touch="PLAY WITH TOUCH"` on `#playFlat`. Rewrite `#touchNote`. Add `#deskNote`, shown when `#touchNote` is hidden.
  - Check: `phone-controls.e2e.mjs` (sizes, both layouts, text, labels). `boot.mjs` still finds "pinch" and "Shift" in the dialog.
- [ ] B3. `qa/vr/phone-controls.e2e.mjs`, at 390 by 844 and 844 by 390.
  - Marker API: the ring centre is within 2 px of the NDC. The arrow sits on the edge and clear of the buttons. A clog ring is green. `null` hides the ring. `no-target` dims SWING.
  - Every visible button is at least 48 by 48. The layout boxes do not overlap. No turn card shows.
  - The title labels, the notes and the How to play sections.
  - A `navigator.vibrate` spy for `buzz`.
  - The bot that only taps, for 30 s.
  - Join checks, which need A5: VIEW toggles the view once. The ring and `G.test.target().ndc` agree within 3 px. Vibration fires on a real attach and a real pump. The bot passes.
  - Check: the file runs. Before A5 only the join checks fail.
- [ ] B4. Main's phone tests stay green.
  - Run `mobile.test.mjs`, `mobile.e2e.mjs`, `phone-swing.e2e.mjs` and `climb.e2e.mjs`. Change no threshold.
  - Check: all four pass on B's branch (they pass on main), and again at the join.

## Join

- [ ] J1. Merge both branches. No file conflicts are expected, because the two agents edit different files.
- [ ] J2. Run every `qa/vr` suite on the merged tree, one at a time, and write the results here: `physics.test`, `city.test`, `target.test`, `mobile.test`, `mobile.e2e`, `phone-swing.e2e`, `phone-controls.e2e`, `climb.e2e`, `flat`, `hero`, `boot`, `xr`, `swing`, `comfort`, `fx`, `render`, `perf`, `audio`, `pwa`, `play`, `ui`, `mr`.
- [ ] J3. Read the screenshots at 640 by 360, 960 by 540, 1280 by 720, 844 by 390 and 390 by 844 against the scenarios. Look for the ring on the target, the edge arrow at the start roof, the hint strip, the green clog ring, the dimmed SWING button and the VIEW button.
- [ ] J4. Validate with the OpenSpec CLI when it is available. Until then run the structure script on the six spec files.
- [ ] J5. Hardware checks. They are not possible in this session.
  - A real phone: thumb reach, vibration, the ring over a moving city, motion aim.
  - A real mouse with pointer lock, a trackpad (E and Q), and the Ctrl and Cmd keys.
  - An Xbox pad and a PlayStation pad: layout, trigger values, drift, rumble.
  - A Quest: unchanged play, no ring, no strip.
- [ ] J6. Archive `swing-hero-comic` and `full-swing-phone-and-climbing` first. Then archive this change. Read the new specs under `openspec/specs/`.
