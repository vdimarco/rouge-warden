# Tasks

The OpenSpec CLI is not installed here. These files are plain Markdown in the layout of `camera-toggle` and `arcade-machine-for-every-game`, and `openspec validate` has not run. A script read the three spec files and found that each requirement has SHALL and at least one scenario.

A box is ticked only when the code and a test in the branch show the work done. A box marked "being fixed in this change" stays open until the fix and its check are in.

## The hero and the chase camera

- [x] Load `crew5.glb`, check that it is 1.5 m to 2.2 m tall, and pose 22 of its 24 bones in code: idle, run, jump, fall, swing, yank and land (`hero.js`; `hero.mjs` checks every pose).
- [x] Build the same figure in code when the model does not load (`hero.js`; `hero.mjs` fallback run: it draws, swings and holds the rope).
- [x] Write the chase camera: 4.5 m arm, orbit, pitch limits, pull-in and let-out, close fade, follow, field of view (`flatcam.js`; `hero.mjs`, including a sweep of 3,000 views that never end inside a building or under the street).
- [x] Wire the camera, the hero and the input in `main.js`: camera under the scene in flat play, hero hands start the ropes, the intro in first person and the pull-out at the hand-off, Exit gives the camera back (`hero.mjs`).
- [x] Switch views with V (`hero.mjs`: toggle, key repeat, the `viewDown` edge, `body[data-view]`).
- [x] Keep the headset as it was: the camera stays under the rig and the hero stays hidden (`hero.mjs` VR run in the Quest emulator).
- [x] Keep the `G.test` hooks working in third person (`hero.mjs`: shots, teleport; `play.mjs`).
- [x] Hold the budget: the hero and its outline add at most 4 draws and 26,000 triangles, and the frame stays within 120 draws (`hero.mjs`, `perf.mjs`).
- [x] List `hero.js` and `flatcam.js` in the service worker, precache `crew5.glb` and raise the version (1.5.0 after the merge with `full-swing-phone-and-climbing`, Quest APK code 4) (`sw.js`; `pwa.mjs` fails when a file in `js/` is not listed).

## The phone

- [x] Keep the phone scheme from main working in the chase view: one tap swings, the rope lets go by itself, the speed kick, the sky tap, the clog plunge, motion aim, pause (`mobile.test.mjs`, `mobile.e2e.mjs`, `phone-swing.e2e.mjs`, `climb.e2e.mjs`; CI runs the first three).
- [ ] Build the phone tap ray from the camera the player sees, and aim from the head to the point it hits, in third and first person. Being fixed in this change. Check: `mobile.e2e.mjs` taps a building at least 0.4 off the screen centre and expects the rope on that building, then taps a second building to switch.
- [ ] Start the phone facing the gold ring with the chase pitch kept, and set the hero's yaw after the camera's. Being fixed in this change. Check: `mobile.e2e.mjs` phone start (pitch, distance, not blocked, same yaw).
- [ ] Aim up and ahead when the view shows only ground within 12 m of the hero, for a tap on the hero and for the SWING button, and keep a clog on a lower roof further away a target. Being fixed in this change. Check: `mobile.e2e.mjs`, `hero.mjs` default aim and the lower-roof clog check.
- [ ] Turn the launchers about the head to the view's pitch, so the first-person rope starts low in the view. Being fixed in this change. Check: `hero.mjs` muzzle at about 30 degrees under the axis.
- [ ] Report the input kind "touch" on a phone and give it the phone lines (`LINES_PHONE`). Being fixed in this change. Check: `ui.mjs` and `mobile.e2e.mjs` read the first tutorial line from a live phone input, and `play.mjs` runs the kinds.

## Joining the climbing of `full-swing-phone-and-climbing`

- [x] The hero holds a wall in the pose "cling": faces it, both hands on it, no air pose, no landing crouch from a wall (`hero.js`; `hero.mjs`).
- [x] The attach feedback reads the rope only while it is attached, and each event's feedback runs in its own `try` (`main.js`; `mobile.e2e.mjs` stale attach).
- [x] The no-hit part of the ground rule only within 12 m of the hero (`main.js`; `hero.mjs` low aim at a clog on the same roof).
- [x] Accept the gap between the hero and a thin antenna mast (see `design.md`).

## The comic look

- [x] Cel bands and ink twins on the toilets, the Loonies, the pipes, the ball and the King; the rings with their own ink line (`game.js`). `play.mjs` checks the toilet and Loonie twins and the cap of 6 twins. The pipes, the ball, the King, the ring ink and the cel bands are checked in the code and the screenshots only.
- [x] Ink twins on the ropes, the cups, the launchers and the gloves, with the rope twin drawing as many segments as the rope (`rope.js`, `hands.js`; `swing.mjs`).
- [x] Comic caption boxes for the HUD, the subtitles, the toasts, the pause menu and the map, on a flat screen and in VR (`ui.js`; `ui.mjs` runs the flat-screen HUD, the menus and the map).
- [x] Ink lines on the wall shards of the mixed reality opening (`portal.js`; `mr.mjs`).
- [ ] Check the outlines of the room toilet and the lamp shade in the opening (`portal.js` builds them; no suite reads them yet).
- [x] Keep the hero and the art optional: a missing file gives the built-in look (`hero.mjs`, `render.mjs`).
- [ ] Keep the hero's texture on the GPU after the loader frees the other maps. Being fixed in this change. Check: `ui.mjs` reads that the colour map is uploaded at load and that the first draw does not upload it again.
- [ ] Fit two-line toasts inside their canvas. Being fixed in this change. Check: `ui.mjs` measures the box, the border and the shadow.
- [ ] Fit the compass arrow and its ink line inside the compass ring. Being fixed in this change. Check: `ui.mjs` compass measure.
- [ ] End the shard ink line before the shards vanish, and never bring it back. Being fixed in this change. Check: `mr.mjs` ink run.

## Checks that are still open

- [ ] Off-centre tap at 390x844. `mobile.e2e.mjs` taps off the centre only at 844x390. Add the portrait tap.
- [ ] Screenshots at 960x540, 844x390 and 390x844, read against the scenarios. `mobile.e2e.mjs` writes the two phone sizes. No suite runs at 960x540.
- [ ] The flat HUD, the toast and the pause menu inside the window at the same three sizes. No suite measures this.
- [ ] Run the suites below on the final tree, one at a time, and write the results here. An earlier run, before the review fixes, passed all of them. No run on the final tree is recorded.
- [ ] Validate and archive with the OpenSpec CLI when it is available. Then read the new specs under `openspec/specs/`.

Suites, from the repo root, with `NODE_PATH=/opt/node22/lib/node_modules`:
`physics.test`, `city.test`, `mobile.test`, `mobile.e2e` (these four run in CI, in `.github/workflows/swing-browser.yml`), `hero`, `boot`, `xr`, `swing`, `comfort`, `fx`, `render`, `perf`, `audio`, `pwa`, `play`, `ui` and `mr`. All are `node qa/vr/<name>.mjs`. The machine has four cores and software WebGL, so run them one at a time.

## Checks that need real hardware

The headless suites cannot cover these. Nobody has run them.

**A real Quest 3**
- The opening on real walls: plane detection, the stencil portal, passthrough where nothing draws, the burst, the reveal and the chalk outline.
- Frame time at 72 Hz and at 90 Hz with multiview and fixed foveation, with the ink twins and the haze. The suites count draws and triangles. They do not time frames.
- Whether the ink lines read well in the headset, and whether any dot pattern shimmers.
- That no hero shows, in hands and in controller play.

**A real phone**
- Touch: the thumb's reach to SWING in landscape and in portrait, the 8-pixel limit between a tap and a drag, and several fingers at once.
- Motion sensors: `deviceorientation` and `devicemotion`, the iOS permission prompt, Center, and a yank by pulling the phone. The tests refuse or fake the sensors.
- Vibration. This change does not add it.
- The notch and the safe areas, the address bar, and a turn from portrait to landscape during play.
- Speed and heat on a real phone GPU, and how the narrow view of portrait plays.

**Audio**
- `audio.mjs` checks the sound graph and the events. No one has listened. In flat play the ears now sit at the camera (`viewHead`). Listen to the rope, clog and King sounds on speakers and on headphones in third person.

**A real desktop**
- The mouse with pointer lock, and a real gamepad. The pad button Y does not switch the view yet.

## Not in this change

The flat-screen controls change holds these: the auto target, the pad button Y and an eye button for the view, comic-style touch buttons, vibration, the key hint strip, the portrait "turn your phone" card, and `qa/vr/flat.mjs` and `qa/vr/touch.mjs`. A review found that nothing sets `input.viewDown`, so V is the only view toggle today. `hero.mjs` fakes the edge by hand. That gap belongs to the controls change.
