# Ahead of the Light: the canyon run

## Why

The user played the ring-view racer and said "this game sucks", then "to be clear it's ahead of the light that
sucks". Asked what to do, they chose to rebuild the core: keep the idea of outrunning the light, drop the ring view,
the cards and most systems, put a camera with the ship and get one fun minute first. While that work began they
said: "make it more like https://nullrange.com/".

Null Range is a first-person space flight over dark ground drawn as cyan point-cloud contours, with orange vector
instruments (a heading tape, SPD and ALT arcs, hull and shield bars), scanlines and a split of the colour channels,
a sonar ping (SPACE), a boost (SHIFT), WS and AD flight keys, and a flat orange title page with black condensed
capitals beside a black terminal strip.

## What Changes

- **Replace** the whole game in `public/ahead-of-the-light/` (the ring view, the 8-leg run with cards, offers,
  rivals, bosses, docks, fuel, the chart, the log, the hangar and practice) with one canyon run:
  - you fly first person down a winding canyon toward Earth through 8 sectors (about 19 km, about 3.5 minutes);
  - the burst's light comes up behind you a little faster than you cruise;
  - orange gates in the canyon give boost charge and a kick of speed;
  - SONAR lights the dark ground ahead for a moment and marks the gates;
  - BOOST spends charge for speed; skimming low trickles charge in;
  - the ground hits shield, then hull; above the canyon the burst burns you.
- **Look:** Null Range's: the ground as points with contour lines, the orange HUD, scanlines, the colour split and a
  vignette; the title as an orange panel beside a black status strip over a bot flying the canyon.
- **Keep:** the route's names (the cosmic web to Earth), the cinematic score in `ui/sound.js` (with a sonar blip and
  a sector chord added), the machine in the arcade (id, name, route) and the cabinet's best line.
- **Remove** the old change `openspec/changes/ahead-of-the-light/` (never archived; it described the game that is
  gone) and the old tests in `qa/ahead-of-the-light/`; add `world.test.mjs`, `flight.test.mjs` and `smoke.e2e.mjs`.

## Impact

- `public/ahead-of-the-light/`: new `core/world.js`, `core/flight.js`, `core/bot.js`, `render/view.js`,
  `ui/hud.js`, `ui/input.js`, `main.js`, `index.html`, `style.css`; `ui/sound.js` kept.
- The homepage cabinet keeps reading `ahead-of-the-light.meta.v1` (the game writes the furthest sector there).
- `qa/ahead-of-the-light/`, README and AGENTS.md's test lines.
