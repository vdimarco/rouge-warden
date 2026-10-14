# Light Years Home v3

## Why

The user has asked for this game three times:

1. With the space video: "can we turn this into a game? traveling at the speed of light. on some kind of quest."
2. After v1 (read a clue, pick a ring, hold a throttle under a line): "the concept is stale. let's make something that
   is actually fun to play."
3. After the two v2 prototypes (A: steer round a ring on rails and skim galaxies; B: hold to swing round galaxies, let
   go to fling): "they are both boring more adventure and driving".

Then they chose what to drive: **"Ship, flown freely"**, an arcade ship with car-like handling (throttle, steer,
drift, boost) that you fly anywhere round each landmark before you punch to light speed. They chose all three kinds of
adventure: explore and discover, missions and story ("GTA in space"), and races and challenges.

On-rails games with one verb bored this user twice. v3 gives them a ship that is fun to drive with no goal, open places
to fly round, people with jobs, races with ghosts and medals, and a light-speed jump that is a driving set piece.

## What Changes

- **BREAKING:** v3 replaces v1 at `/light-years-home/`. v1's game, its `window.__lyh` hook and its saves go; git keeps
  them. v3 saves under new keys.
- Chapter 1, "The Web": The Wall (a pit stop) → jump J1 → Coma City → J2 → Virgo with M87's jet as a pocket → J3 →
  the Andromeda edge, where the chapter ends on a card. Earth's clock runs back from 1.07 billion years ago to 2.5
  million years ago.
- The Tern drives like a car on an invisible road in each place: auto-cruise, gas, brake, drift with three spark tiers
  and a drift-boost, a boost bar that only risk fills, near misses, skims, drafts, slingshots round giants, takedowns,
  a tow and fragile cargo. Crashes cost speed, never the run.
- In every place: scans that draw the video's rings and labels, sourced fact cards, rumours, secrets, sets, sparks, a
  postcard of Earth, a radar and a ship log.
- Missions with Dot (the ship's AI), Ferro, Vela, Redshift and the Magpies: WHICH WAY HOME, FIRST SHOUT, PELICAN DOWN,
  FRAGILE and THE STRAIGHT RAY. Fails retry in 1.2 s; a skip comes after 3 fails.
- Five timed events and 14 stunts, each with a ghost, a pacer and medals; restarts in 1.6 s; Vela as the rival.
- The jump is a free corridor: the ship flies down a tube of light and the player steers it on two axes with the same
  controls as in the places, past real structure, with the real aberration and Doppler. A jump cannot be failed, and
  its medal fills the boost bar for the arrival.
- Phones in portrait and landscape (stick and pedals with auto-cruise by default, one thumb as a setting); desktop with
  keys, mouse or a gamepad.
- Built in two rounds:
  - **Round 1:** M1 the toy (ship, collisions, traffic, camera, input, the Wall's roads), M2 the Wall (zone runtime,
    race kit, ghosts, talk, saves, HUD, radar, the Wall's events, scans, secret and WHICH WAY HOME with the Magpie
    chase), M3 the jump J1 into Coma City as a drivable place (traffic, giants, scans, Look Home), and the cutover from
    v1.
  - **Round 2:** M4 Coma's missions, events, Vela and secrets; M5 Virgo, the jet, J2, J3 and the end card; M6 the
    arcade machine in the Action group, README, AGENTS.md, the performance pass and archiving this change.
- Cut from Chapter 1 and kept for later: SHINY THINGS, Downtown Eight, INFALL, HOT KNOT, the Web Highway lap, the
  Downtown Run, the Infall race, Cluster Halo, free-roam duels and rewind.
- This change supersedes `add-light-years-home` (v1), which stays unarchived and is marked superseded.
  `light-years-lab-v2` and the labs at `/light-years-home/lab/` stay until Chapter II removes them.

## Capabilities

### New Capabilities

- `lyh-flight`: the ship, drift, boost bar, collisions, wells, tow and cargo, edges, the camera, the feel of speed and
  the controls on each device.
- `lyh-world`: the Chapter 1 places, scale cards, scanning, cards, rumours, secrets, sets, sparks, Look Home, the
  objective, the radar and the ship log.
- `lyh-story`: the premise, Earth's clock, the cast and talk rules, missions, retries and skips, and the end card.
- `lyh-events`: starting events, gates, medals, restarts, ghosts and the pacer, Chapter 1's timed events, Vela and
  stunts.
- `lyh-jump`: arming, the run-up, the punch, the free corridor, speed and the nines, the real aberration and Doppler,
  forks, the vista and drop-out, medals and loading behind the jump.
- `lyh-interface`: the start, HUD layouts at each size, hints, menus, saves, sound, reduced motion, performance budgets,
  the test hook and the arcade machine.

### Modified Capabilities

None. v1's `light-years-home` capability was never archived into `openspec/specs/`, and no canonical requirement pins
the Action group's games.

## Impact

- `public/light-years-home/` is rebuilt in place: new `core/` modules (tune, events, vec, game, ship, frame, collide,
  traffic, actors, zone, race, ghost, mission, talk, jump, save, hash, bots, layout, `world/`), new `render/` and `ui/`
  modules, and new `index.html`, `style.css` and `main.js`.
- Kept and imported unchanged: `core/physics.js`, `objects.js` (with new Coma and Virgo members), `rng.js`,
  `captions.js`, `timeline.js`, `milestones.js` (with a new `oxygen` entry), `labels.js`, `project.js`, `pick.js`,
  `gas.js`, `gen/*`, `render/points.js`, `galaxy.js`, `nebula.js`, `planets.js`, `sky.js` and `ui/perf.js`.
- Deleted (v1 only): `core/engine.js`, `route.js`, `geo.js`, `bot.js`, `render/view.js` and `render/lens.js` once their
  parts move to `stage.js` and `photo.js`, and the tests `engine`, `route`, `geo`, `pure`, `save` and `bot.mjs`.
- Tests: new node tests and browser checks in `qa/light-years-home/v3/`. The kept tests `captions`, `gas`, `gen`,
  `gen-clusters`, `physics`, `timeline`, `lab-a` and `lab-b` keep passing.
- Round 2 edits `public/index.html` (the Action group), `public/arcade/switch.js`, adds
  `public/arcade/light-years-home.webp`, and updates `README.md` and one test line in `AGENTS.md`.
- No backend, no new dependency, no network textures. Nothing is sent anywhere; run logs stay on the device.
