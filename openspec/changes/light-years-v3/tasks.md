# Tasks

Tick a task only when its work is done and its checks pass. Each milestone ends on the preview with its checks green.

## Round 1

### 1. M1 · The toy

- [ ] 1.1 Land the contracts: `core/tune.js` (every feel number with a range and `?tune` overrides; `S_CRUISE` 24), `core/events.js`, `core/vec.js`, the `core/game.js` state shape and mode machine, `core/layout.js`, `core/world/schema.js`, the input record and the hook's signature.
- [ ] 1.2 Write the flight core: `core/ship.js` (speed, grip, drift and drift-boost, the bar, pitch and the plane, wells, edges), `core/frame.js`, `core/collide.js` (sweeps, scrape and head-on, near misses, hairlines, threads, skims, drafts, takedowns), `core/traffic.js` and `core/hash.js`.
- [ ] 1.3 Write `core/world/zones/wall.js` with the Wall's roads, traffic, the three seeded galaxies, Node 0, the Bend Giant, the swarm and the empty voids (no events yet).
- [ ] 1.4 Write the look: `render/stage.js` (tiers, step-down, byte counts, worker generator), `backdrop.js`, `zoneview.js`, `traffic.js`, `bodies.js`, `roads.js`, `tern.js`, `chase.js` and `fx.js` (dust, trails, sparks, shake), reusing `points.js`, `galaxy.js` and `nebula.js`.
- [ ] 1.5 Write `ui/input.js` for stick and pedals (portrait and landscape), one thumb, keys, mouse steer and gamepad, and the HUD's speed gauge, pedals and BOOST arc in `ui/hud.js` and `style.css`.
- [ ] 1.6 Write `ui/sound/mix.js`, `engine.js` and the zzip, drift and boost sounds in `sfx.js`.
- [ ] 1.7 Write `index.html` and `main.js`: boot, tier pick, the 120 Hz loop, the opening drop-out at 38 u/s with control from 0.3 s, the event-to-sound table and `window.__lyh` version 3.
- [ ] 1.8 Write `core/bots.js` (idle, random, wander, drifter) and pass `purity`, `tune`, `ship` (cruise checks retuned for 24 u/s), `toy`, `collide`, `traffic`, `layout` and `determinism` in `qa/light-years-home/v3/`.
- [ ] 1.9 Pass `drive.e2e` at 390×844, 844×390 and 1440×900, and review its screenshots.
- [ ] 1.10 Give the toy to the crew for 2 minutes of driving with no goal, or say plainly that this did not run.

### 2. M2 · The Wall

- [ ] 2.1 Write `core/zone.js`: dotted and solid rings, near and far scans, Cruise auto-scan, sparks, rumours, secrets, Look Home, the scale card, the one-objective rule and the exit gate.
- [ ] 2.2 Write `core/race.js` (start rings, arming, gates, splits, medals, stunts, chains, points, restart and back to the last gate) and `core/ghost.js` (record, encode, links, pacer).
- [ ] 2.3 Write `core/talk.js`, `core/world/lines/ch1.js` and `core/world/facts.js` with the Wall's cards and sources.
- [ ] 2.4 Write `core/save.js` for the v3 keys, settings, ghosts and the boot breadcrumb, with the safety rules for missing, throwing and junk storage.
- [ ] 2.5 Write `render/gates.js` and `render/ghosts.js`, `ui/overlay.js` (rings, leaders, labels, chevrons, the home chevron, the radar), the HUD rows (mission line, captions, toast, info box, hint pill, action chip) and `ui/menu.js` (title, pause, settings).
- [ ] 2.6 Add the Wall's events: First Light, Sloan Bend, Void Run, Outbound and Sloan Pads, with ghosts and medals.
- [ ] 2.7 Add the Wall's scans, The Overlook, the 24 sparks and Look Home.
- [ ] 2.8 Pull `core/mission.js` and the `runner` actor forward and add WHICH WAY HOME (the Magpie chase, the chart, the far scans, the fix) and FIRST SHOUT.
- [ ] 2.9 Write the log's MAP and LOG tabs in `ui/log.js`, so the radar tap and scan cards have a home.
- [ ] 2.10 Add the Wall's hints and the cue sounds for scans, gates, stunts, missions and talk.
- [ ] 2.11 Pass `zones`, `race`, `ghost`, `stunt`, `talk`, `save`, `text` and `discovery`, and `events.e2e`, `discovery.e2e` and the Wall part of `story.e2e`.

### 3. M3 · The jump into Coma

- [ ] 3.1 Write `core/jump.js` as the free corridor: run-up rings, the punch, two-axis rate steering in a tube, hazards from real structure, grazes, hairlines, threads, pads, the slide, TWO NINES, THREE NINES and the Headlight, the vista, the drop-out, the medal and the arrival bar, and the long haul.
- [ ] 3.2 Write `render/tunnel.js` with the real aberration and Doppler from `render/points.js`, the rush lines, the vignette and the brightness floor.
- [ ] 3.3 Build the load pipeline in `main.js`: `import()` at the exit gate, the worker build, 6 ms GPU slices in the run, `compileAsync`, `zoneReady`, and freeing the old place at the punch.
- [ ] 3.4 Write `core/world/jumps.js` (J1), `core/world/legs.js`, Earth's clock and the On Earth cards in the top band.
- [ ] 3.5 Write `core/world/zones/coma.js` as a drivable place: roads, the Inner and outer rings, swarms, both giants with their wells and near stars, scans and Look Home (its missions and events wait for Round 2), and the new Coma members in `core/objects.js`.
- [ ] 3.6 Add the jump sounds: the riser, the punch, the corridor zzip, the nines chords, the radios at the Doppler factor, the vista and the drop.
- [ ] 3.7 Add the jump bots (still, mid, expert) and pass `jump.test`.
- [ ] 3.8 Pass `jump.e2e` from the Wall to Coma, with screenshots of the punch, mid-corridor and the drop-out at all three sizes reviewed by eye.
- [ ] 3.9 Try desktop climb on R and F against W and S in the corridor, and give the jump to the crew; record what they say in `design.md`, or say plainly that this did not run.

### 4. Cutover from v1

- [ ] 4.1 Move what `render/stage.js` needs out of `render/view.js` (tiers, `adapt`, `createGenerator`, `interleave`, `textureBytes`) and what `render/photo.js` needs out of `render/lens.js`, or add a stand-in.
- [ ] 4.2 Delete v1-only files: `core/engine.js`, `core/route.js`, `core/geo.js`, `core/bot.js`, `render/view.js`, `render/lens.js`, and v1's tests `engine`, `route`, `geo`, `pure`, `save` and `bot.mjs`.
- [ ] 4.3 Replace v1's `index.html`, `style.css`, `main.js`, `ui/hud.js`, `ui/input.js`, `ui/overlay.js` and `core/save.js`, keeping `CHAPTER_KEYS` reachable from `ui/audio.js` for the labs.
- [ ] 4.4 Pass the kept tests (`captions`, `gas`, `gen`, `gen-clusters`, `physics`, `timeline`, `lab-a`, `lab-b`) and load both labs in the browser.
- [ ] 4.5 Pass `openspec validate light-years-v3 --strict` with the specs brought up to date with Round 1's code.

## Round 2

### 5. M4 · Coma City

- [ ] 5.1 Finish `core/actors.js` (towable, pursuer, runner, racer, faller, blob) and `core/mission.js` (checkpoints, retries, skips, choices, cargo, tow, catches).
- [ ] 5.2 Add PELICAN DOWN (find, hook, sling, haul past three Magpies, the fix to Virgo) and FRAGILE.
- [ ] 5.3 Add Race the Jellyfish with D100 and `render/zones/coma.js` (D100 and its tail, the dark matter glow).
- [ ] 5.4 Add Vela: her flyby 12 s after PELICAN DOWN, her draft to the start, Ring Road Rush with her pace band and lines, and her rumour.
- [ ] 5.5 Add Coma's stunts (Coma Dive, Leo Road Radar, Halo Skim, Twin Bend, Giant Whip), sparks, Zwicky's Clue, The Ghost and the Ghosts set.
- [ ] 5.6 Finish the ship log (JOBS, RECORDS, arrival photos with `render/photo.js`) and the Copy log setting.
- [ ] 5.7 Add the mission bot and pass `mission.test`, Coma's medal floors in `race.test`, both Coma missions with the mission bot, and the Coma parts of `story.e2e` (including PELICAN DOWN with one thumb at 390×844).

### 6. M5 · Virgo and the end

- [ ] 6.1 Add J2 with its fork and set pieces, and J3 with its fork, set pieces and Andromeda vista.
- [ ] 6.2 Write `core/world/zones/virgo.js` and `virgo-jet.js` with the Virgo members in `core/objects.js`, and the zoom in and out.
- [ ] 6.3 Write `render/zones/virgo.js`: the jet beam, blobs, knots, M87*'s orange ring, the lobe, the globulars and the zoom.
- [ ] 6.4 Add THE STRAIGHT RAY (the crate, the lens, the zoom, the jet ride, the Magpie ambush with Vela, the drop at the lobe).
- [ ] 6.5 Add Markarian's Chain with Vela's ghost, Ride the Jet with the HST-1 blob, Virgo's stunts, The Shadow and Messier's 14.
- [ ] 6.6 Write `core/world/zones/andromeda-edge.js`, the chapter end card and KEEP DRIVING.
- [ ] 6.7 Add the chapter and completionist bots and pass `chapter.test` (5 seeds, and 20 with `--full`) and `chapter.e2e` at all three sizes.

### 7. M6 · Ship it

- [ ] 7.1 Add the machine to the Action group in `public/index.html`, an entry in `public/arcade/switch.js`, the cabinet screen `public/arcade/light-years-home.webp` (480 px wide, under 60 KB, a real frame of the drop-out into Coma), the cabinet line from the save, `data-switch` on SWITCH GAME and a new `og:image`.
- [ ] 7.2 Write the README section (what it is, controls per device, what is real and what is stylised, the chapters, the tests) and one line in AGENTS.md for the node tests and browser checks.
- [ ] 7.3 Run the performance pass: `perf.test`, `perf.e2e` and `recover.e2e` under the mid caps, and `qa/arcade/quiet.mjs`.
- [ ] 7.4 Run every node test and browser check, and do a real-phone run or say plainly that none ran (touch feel, 60 fps, audio, haptics, tilt, iOS memory).
- [ ] 7.5 Bring the specs and `design.md` up to date with the code and the bots' numbers, pass `openspec validate light-years-v3 --strict`, archive the change and review the canonical specs in `openspec/specs/`.
