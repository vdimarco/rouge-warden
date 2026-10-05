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
- [x] Grow the map from 6400 to 9600 units and write the layout as fractions of the map size.
- [x] Add three tower tiers per lane and two guardians per base.
- [x] Tune waves, economy, respawn and the time limit for the bigger map.
- [x] Update the Node tests for the new map and add tests for tiers and guardians.

## 3D renderer
- [x] Add `three-render.js` and `render3d/` with the same renderer interface as the 2D renderer.
- [x] Draw the ground, river, bases, towers, cores, camps and scenery as lit 3D models with shadows.
- [x] Animate heroes and lane soldiers from the sim state.
- [x] Draw telegraphs, bars, labels and damage numbers so they stay readable in 3D.
- [x] Fall back to 2D without WebGL2, in a software renderer or with `?renderer=2d`, and add the graphics choice to the pause menu.
- [x] Scale the render resolution by frame time.
- [x] Add `qa/tidebreak/render3d.e2e.mjs`.

## HUD, menus and portraits
- [x] Render hero portraits from the 3D models.
- [x] Restyle the HUD, draft board and menus in the mythic look.
- [x] Check the HUD at 1440x900, 390x844 and 844x390.

## Combat feel (cloud session, branch `claude/quirky-cerf-vwf0qw-combat`)
- [x] Death recap during respawn.
- [x] Tells of at least 0.3 s with sound for big hits, engages and tower target lock.
- [x] Exposed window after big commits with a readable reward.
- [x] Hitstop, shake by weight, damage-taken flash and sound, crit and finisher emphasis, last-hit chime.
- [x] Input buffer shown as QUEUED, commit click and one outplay mechanic for basic attacks.
- [x] Target marks and objective timers with rest phases.
- [x] Merge the branch and draw its new data in the 3D renderer.
- [x] Lower lane mana regeneration so spells compete for mana (measured before and after).

## 3D render polish (cloud session, branch `claude/quirky-cerf-vwf0qw-render`)
- [x] Better trees, structures that fade when they hide a hero, crystal exposure, hero silhouettes and clear telegraphs.
- [x] Effects per element, a windup pose and a clean death fade.
- [x] Brighter full-length portraits for hero select.
- [x] Merge the branch.
- [ ] Draw the 3D arena behind the hero select (needs a `main.js` change).
- [ ] Give the core crystal more depth; it reads as a flat crimson block in the low sun.

## Bots (cloud session, branch `claude/quirky-cerf-vwf0qw-bots`)
- [x] Difficulty setting (Apprentice, Veteran, Mythic) saved and shown in the match.
- [x] Wave gating, dive guard, trade-aware retreat, ganks, camps, focus fire, objective timing and dodges with reaction delays.
- [x] Measure win rates per difficulty with seeded matches (on the 9600 map: Veteran 38%, Mythic 33%, Apprentice 30% against the previous
  bots over 60 matches each; Veteran and Mythic win fights and die less under wards, but take fewer wards).
- [ ] Fix the bot review findings: bots that freeze when a route grazes a ward, the dive exception path, sieges without a wave, the double
  move, the difficulty badge over the HUD, the picker on small landscape phones and with blocked storage, and the test gaps.
- [ ] Retune Veteran and Mythic so they turn won fights into wards on the 9600 map, then measure again.
- [x] Merge the branch.

## Verification
- [x] Merge the cloud session notes into the capability specs.
- [x] Run all `qa/tidebreak` Node suites and the browser checks.
- [x] Take 3D and HUD screenshots at the supported screen sizes (`notes/render-polish/`).
- [x] Update the test commands in `AGENTS.md`.
- [x] Validate the change with the OpenSpec CLI.
- [ ] Play on a real GPU and an ultra-wide screen and confirm a smooth frame rate.
- [ ] Check phone performance and touch on a physical phone.
- [ ] Listen to the new cues on a device with speakers.
- [ ] Review the canonical specs and archive this change after the device checks.
