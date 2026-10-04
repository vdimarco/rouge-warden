# Tasks

## Phone swinging
- [x] Measure the old phone play: 8.1 m/s average, 80 m in 12 s with taps (bot in a scratch script)
- [x] Phone preset and physics (speed cap 48, gravity 14, drag 0.0045)
- [x] One tap swings; the rope lets go by itself with a fling; a vault when reeled into a wall; release on a roof or a stall
- [x] Tap assist for out-of-reach, too-close and low targets
- [x] Speed kick on attach; the camera follows the flight; the view widens with speed; phone speed lines
- [x] A tap on a clog plunges it; phone tutorial and clog lines
- [x] Layout: score pills under the top buttons, spoken lines over the SWING panel, and hidden under the climb pad in portrait
- [x] `qa/vr/phone-swing.e2e.mjs`, and `qa/vr/mobile.e2e.mjs` updated for the new launch and the sky tap

## Climbing
- [x] Climb physics: grab, climb, top, bottom, corner, overhang, jump, rope off
- [x] WASD and the arrow keys; Space jumps off a wall; the phone climb pad with JUMP
- [x] First-wall hint; How to play: climbing lines and a Phone section
- [x] Physics tests, including the Needle from the street to its tip
- [x] `qa/vr/climb.e2e.mjs`

## Roof antennas
- [x] Antenna colliders in `city.js`; `cityview.js` draws them from the city data
- [x] A rope catches an antenna and the player climbs one (`climb.e2e.mjs`)

## Release
- [x] Version 1.4.0 in `config.js`, `sw.js` and the Quest APK manifest
- [x] Add `phone-swing.e2e.mjs` to the Swing browser QA workflow
- [ ] Validate this change with the OpenSpec CLI
- [ ] Run every `qa/vr` suite
- [ ] Check on a real phone (touch, motion aim, landscape) and in a Quest headset (unchanged play): not possible in this cloud session
