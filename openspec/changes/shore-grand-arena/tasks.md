# Tasks

## 3D assets
- [x] Make one reference image per hero in the mythic style, from one style reference.
- [x] Turn each image into a textured mesh with Tripo H3.1 and turn it to face +Z.
- [x] Rig each hero body with the Meshy rigger and buy one animation clip per hero.
- [x] Fix the weapons rigidly to the hand or forearm bones and restore the Tripo PBR maps.
- [x] Retarget any clip to any hero in `hero-rig.js` and store the clip library in `models/clips.json`.
- [x] Make the lane soldier, towers, core, Wild Hunt, camp beast and scenery models.
- [x] Compress all models with meshopt and quantization; vendor the decoder in `lib/`.
- [x] Keep the pipeline scripts in `higgsfield/models3d/` and the job IDs in `models/sources.json`.

## Map, towers and pacing
- [ ] Grow the map from 6400 to 9600 units and write the layout as fractions of the map size.
- [ ] Add three tower tiers per lane and two guardians per base.
- [ ] Tune waves, economy, respawn and the time limit for the bigger map.
- [ ] Update the Node tests for the new map and add tests for tiers and guardians.

## 3D renderer
- [ ] Add `three-render.js` and `render3d/` with the same renderer interface as the 2D renderer.
- [ ] Draw the ground, river, bases, towers, cores, camps and scenery as lit 3D models with shadows.
- [ ] Animate heroes and lane soldiers from the sim state.
- [ ] Draw telegraphs, bars, labels and damage numbers so they stay readable in 3D.
- [ ] Fall back to 2D without WebGL2 or with `?renderer=2d`, and add the graphics choice to the pause menu.
- [ ] Scale the render resolution by frame time.
- [ ] Add `qa/tidebreak/render3d.e2e.mjs`.

## HUD, menus and portraits
- [x] Render hero portraits from the 3D models.
- [ ] Restyle the HUD, draft board and menus in the mythic look.
- [ ] Check the HUD at 1440x900, 390x844 and 844x390.

## Combat feel (cloud session, branch `claude/quirky-cerf-vwf0qw-combat`)
- [ ] Death recap during respawn.
- [ ] Tells of at least 0.3 s with sound for big hits, engages and tower target lock.
- [ ] Exposed window after big commits with a readable reward.
- [ ] Hitstop, shake by weight, damage-taken flash and sound, crit and finisher emphasis, last-hit chime.
- [ ] Input buffer shown as QUEUED, commit click and one outplay mechanic for basic attacks.
- [ ] Target marks and objective timers with rest phases.
- [ ] Merge the branch and draw its new data in the 3D renderer.

## Bots (cloud session, branch `claude/quirky-cerf-vwf0qw-bots`)
- [ ] Difficulty setting (Apprentice, Veteran, Mythic) saved and shown in the match.
- [ ] Wave gating, dive guard, trade-aware retreat, ganks, camps, focus fire, objective timing and dodges with reaction delays.
- [ ] Measure win rates per difficulty with seeded matches.
- [ ] Merge the branch.

## Verification
- [ ] Merge the cloud session notes into the capability specs.
- [ ] Run all `qa/tidebreak` Node suites and the browser checks.
- [ ] Take 3D and HUD screenshots at the supported screen sizes.
- [ ] Update the test commands in `AGENTS.md`.
- [ ] Validate the change with the OpenSpec CLI.
- [ ] Play on a real GPU and an ultra-wide screen and confirm a smooth frame rate.
- [ ] Check phone performance and touch on a physical phone.
- [ ] Listen to the new cues on a device with speakers.
- [ ] Review the canonical specs and archive this change after the device checks.
