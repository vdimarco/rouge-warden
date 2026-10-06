# Design

## Modules

- `combat.js` (pure): the goons and the hero's hearts. A goon walks on his own surface with `city.topBelow` (no step over 0.6 m,
  so never off an edge) and `collideSphere` (no walls). States: idle, chase, windup, swing, stagger, pulled, down, out. Events
  (hurt, knockout, ko, windup, slam, pulled, arrived) go to main.
- `cars.js` (pure): parked cars on the kerb lines of the street model (`streetsOf` from street.js) and a bicycle car model with
  sideways grip and a handbrake. A car checks three spheres along its length against the colliders, the lake and steps; on a hit
  it stops and bounces (0.25 of its speed back).
- `jobs.js` (pure): the Sludge Run and five odd jobs, each a setup and a per-frame run function that ends with done or failed.
  Jobs use combat for goons and carry their own people (figures) and the balloon.
- `streetview.js` `createFigures`: one instanced figure mesh and its hull for the street people, the goons and the job people
  (two draws for all). New pose codes: punch, windup, stagger, down, fall, limp, wave, kick; a per-instance body pitch, roll and
  lift lays a figure down, tips a carried one over the shoulder.
- `actionview.js`: the cars (an instanced box-built car, toon-shaded, with an ink hull), the marker beams and rings (additive,
  instanced) and the balloon. `actionhud.js`: hearts, the energy gauge, the prompt, the hit glow and the phone car buttons (DOM).
- `main.js` runs it all in `actionFrame` after the physics events, only in flat play once the game has started. Driving skips the
  physics and sets the body to the car each frame; the chase camera gets `flags.drive` (follow the car's yaw, a 1.7 times
  longer arm).

## Input

- R / pad B / the phone's CAR: in and out. Shift / pad L3: sprint. The swing input punches when `combat.inReach` finds a goon: the
  press is taken before it fires a rope. Space held is the handbrake (`inp.jumpHeld`).

## Rope catches

Goons (when fighting), the falling person and the balloon are rope targets with the tags goon, person, balloon. They are in
`SPECIAL_TAGS` (no attach kick) and `CATCH_TAGS`: on attach main calls `combat.pull` or `jobs.ropeCaught` and lets go of the rope.

## Physics

- `MOVES` in config.js (flat and phone configs only, so the headset is unchanged): sprint factor, energy rates, the roll.
- `land()` starts a roll when `P.rollReady` (main: the hero dove in the last 0.45 s) or the fall is faster than 13 m/s, and
  sets the ground speed to at least 6 m/s along the travel; the ground step skips walking and uses a low friction while `P.roll`.

## Story and saves

- The cold open plays from `beginIntro` before the cottage room (first run, flat, not with ?nocut or ?skipintro). `save.seen`
  gains mission2; `save.jobs` keeps `sludge` (Mission 1 won) and the count of each job done. Odd jobs and clog guards need
  `save.jobs.sludge`, so the tests (which never win it unless they ask) are not disturbed by goons or markers.
