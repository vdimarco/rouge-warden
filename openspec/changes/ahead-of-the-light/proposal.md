# Ahead of the Light

## Why

With the space video the user asked: "can we turn this into a game? traveling at the speed of light. on some kind of
quest." v1 was "stale", and the two v2 lab prototypes were "boring" (that round became the v3 adventure). About those
labs they then said: "both of these games have cool elements for a survival racing game but they are too simple can
we expand on it".

They chose to keep both games, so the racer is a separate game, and they chose all four survival pieces:

1. **Outrun a threat:** a wave of light chases you; slow down and it catches you.
2. **Hull and fuel:** hits damage the hull, you burn fuel, and there are pickups and repairs on the run.
3. **Upgrades between legs:** pick 1 of 3 after each leg, so each run builds a different ship.
4. **Rival racers:** other ships race you home; draft them, ram them, slingshot past them.

"Too simple" meant one verb, one stage, no progression, no rivals, no resources and no choices that matter.

## What Changes

- Add a new game, **AHEAD OF THE LIGHT**, at `/ahead-of-the-light/` (slug `ahead-of-the-light`, the `SLUG` constant
  that prefixes every save key). Cabinet line: "Race home ahead of a gamma-ray burst. Every near miss holds the light
  back." Sub line on the machine: "Race home before the burst".
- **The game.** A star at the edge of the cosmic web collapsed into a gamma-ray burst as you left, and its light races
  you home along the video's route. You fly lab A's ring: drag to steer round it, and skim galaxies to speed up and to
  hold the light back. Flick up to burn fuel. Press as a big mass passes to whip round it, which is lab B's swing
  rebuilt for the ring. Three named rivals and a few drifters race the same road; they draft, ram and get eaten by the
  same kind of light. A run is 8 legs, about 10 minutes home. At each landmark you THREAD its gate for speed or DOCK
  for repairs, then pick 1 card of 3 and the next lane on a star chart. Your score is how many years you aged.
- **The four pieces, all in the first build:**

  | The user's piece | Where it lives |
  |---|---|
  | Outrun a threat | Every ship has its own light, gaining at (1 − β). It is a white ring outside the play ring that closes as you slow. Grazes push it back. A hit outside the glare can put you in the glare, never past it; one hit in the glare and it has you |
  | Hull and fuel | 3 hull pips with a recharging shield, and up to 4 fuel cells. A flick burns a cell for speed. Fuel and patches sit off the safe line. Docks repair and refuel for lead. Landing at Earth spends what you saved |
  | Upgrades between legs | After legs 1 to 7, pick 1 of 3 cards (4 if you came first, 2 of 3 after a risky lane). Every card changes a rule. Pairs unlock fusions; 3 of a family unlock its legendary |
  | Rival racers | HOUND, PIKE, REMORA and MOTH (three a run), drifters, a Nemesis, and a boss per act (WHALE, MAKO, MANTA) |

- **The merge decisions** (spec section 2), in short: two meters (hull with a shield, and fuel); burn with a flick up;
  speed climbs the nines to LIGHT SPEED, and burns alone stop at η 2.6; each leg launches by gate choice (THREAD η 1.6,
  fly past 1.0, DOCK 0.8); a hit costs 0.5 η, the shield or 1 hull, and a 1.0 s stumble; each ship has its own gap;
  lab A's push-back sizes; the whip has a red zone that spends hull for speed; a SLAM spills a fuel cell; the first
  whip comes in leg 1; all 8 legs, all three bosses; one purse, seconds of lead; rivals fly your lane and never take
  cards; the HUD shows only speed and place; hull and fuel sit on the ring as wings; 22 starter cards, 6 fusions,
  4 legendaries and 4 trophies; FAMILY, RISK and VOID lanes; no points; on desktop Space grabs and ↑, W or Shift burns.
- **Cut from the first build:** station and signal lanes, the trader and signals; rival lane choice; rivals taking
  cards; boss relics; salvage; card packs and Epic glass cannons; the KITE and ANCHOR ships; daily mutators; REDSHIFT
  7 to 10; STEAL and BOUNCE on wells; hot-gas fog and the `orbit` kind; separate `tail`, `block` and `sweep` kinds;
  points and spectral ranks; the short-route mode.
- **Devices.** Phones in portrait (390 × 844) and landscape (844 × 390) with touch, and desktop (1440 × 900) with keys,
  mouse or a gamepad. Fun in the first 3 seconds; steering within 1.5 s of TAP TO FLY.
- **The look.** The video's: black space, white points, thin white rings with leader lines and labels, bold uppercase
  captions with the current word in orange. Real aberration, Doppler colour and time dilation.
- **The arcade.** A machine in the Action group after River Rush, with the cabinet line from the save, the game
  switcher on the title and pause menus, a README section and one line in AGENTS.md.

## What Stays

- **The v3 adventure** at `/light-years-home/` keeps being built by its own team under `light-years-v3`. This change
  edits nothing under `public/light-years-home/`. It imports `core/physics.js`, `core/rng.js`, `core/gen/web.js`,
  `galaxy.js`, `stars.js`, `core/captions.js` and `render/points.js` read-only, and copies (never imports) what it
  needs from `ui/` and the v3 modules, which are being replaced.
- **The labs** at `/light-years-home/lab/a/` and `/lab/b/` stay as they are, with their pages. Their code is ported by
  copying and reshaping. `light-years-lab-v2` is not touched.
- `docs/game-ideas.md` stays as it is.

## Capabilities

### New Capabilities

- `race-handling`: the ring and camera, steering and the pass check, the burn, the whip, gears and the light-speed
  feel, controls and the HUD on each device, feedback on every event, and the 30-second toy.
- `race-light-and-hull`: each ship's gap and time to catch, push-backs, the light's states and ring, hits and catches,
  hull, shield and fuel, pickups, the wings, gates, docks and the landing at Earth.
- `race-rivals`: the field, drafting and the slingshot, contact and the lean, the regulars, fair driving, the light
  eating rivals, labels and barks, the Nemesis and the three bosses.
- `race-run-and-cards`: the run and its breaks, offers, rarity and pity, the cards, fusions, legendaries and
  trophies, years and the result card, saves, the log, ships, modes and REDSHIFT, and the whole-run bot targets.
- `race-course`: the route and legs, the leg grammar, the first minute, lanes and conditions, the VOID, pieces and the
  generator, the validator, the director and each leg's backdrop.
- `race-arcade-machine`: the machine, the cabinet line, the title and the page in the arcade, sound, the phone budget
  and the test hook.

### Modified Capabilities

None. No canonical requirement lists the Action group's games, and the arcade's own requirements (`arcade-groups`, the
`arcade-machine-for-every-game` change) already ask for a machine for every game page.

## Impact

- New folder `public/ahead-of-the-light/` (about 15,000 lines): `index.html`, `style.css`, `main.js`; a pure `core/`
  (tune, ringmath, handle, survival, rivals, bosses, race, run, chart, offer, cards, meta, save, log, route, bots and
  `course/` with kinds, legs, gen, validate, director, strip and the pieces); `render/` (scene, hazards, landmarks,
  overlay, vista, chart); `ui/` (input, hud, screens, sound, haptics, store); `dev/strip.html`.
- New tests in `qa/ahead-of-the-light/` (about 3,000 lines): node tests (`handle`, `survival`, `rivals`, `course`,
  `run`, `cards-drive`, `save`, `meta`, `copies`, `sim`, `toy`), the bot CLI `bot.mjs`, and browser checks (`smoke`,
  `input`, `layout`, `perf`, `feedback`).
- Edits `public/arcade/switch.js`, `public/index.html` and `qa/arcade/machines.mjs`; adds
  `public/arcade/key/ahead-of-the-light.webp`; adds a README section and one line to AGENTS.md.
- No backend, no new dependency, no build step: static three.js r185 through the import map. Saves stay in
  `localStorage` under `ahead-of-the-light.*` keys, and Copy log puts the run log on the clipboard only when the
  player asks. Nothing is sent anywhere.
