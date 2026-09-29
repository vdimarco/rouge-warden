# Loon Echo — bring your little weirdos home

A 72-second lake crossing at `/echo` or `/echo/`. Drag or use the left/right arrows (A/D also work) to steer a parent loon. Rescue up to eight golden chicks; the growing family repeats your turns with a delay. Follow the crossing progress through the quiet reeds, boat channel, and home stretch.

Rocks hurt the parent or send a chick safely ashore. Boats announce their arrival, then leave two wakes with a visible calm gap. CALL (button or Space) gathers the flock for 2.6 seconds and braces it against wakes, with an eight-second recharge. It does not protect against rocks. The parent has three energy; reaching home counts how many chicks made it. The route repeats so learning it improves the next attempt. Best home count is saved locally; blocked storage or audio does not stop play.

Pause with the button, P, or Escape. Switching away automatically pauses. Both end states support a clean restart. Lab and arcade links stay available.

## Art

The alien cottage lake and six original cartoon sprites were generated with Higgsfield GPT Image 2.5, following the requested Rick and Morty-inspired visual direction. Generated images were converted to WebP; the magenta sprite backdrop was keyed out and the six cells cropped into individual assets. Generation IDs and sources are in `art/provenance.json`. The original `lake.webp` remains as the previous prototype's asset; the new game uses `art/lake.webp`.

## Verification

Serve `public/` using a static server. Run `node --test qa/echo/crossing.test.mjs` for rescue, delayed following, call/recharge, wake gaps, collisions, invulnerability, successful arrival, exhaustion, and idle-play regression checks. No package installation is required. Gameplay is in `crossing.js`, rendering/input/audio in `main.js`.
