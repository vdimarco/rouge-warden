# Loon Echo — rescue run

A free-swimming rescue game at `/echo` and `/echo/`. Swim around the lake to collect eight chicks, lead their delayed trail back to the safe nest, and decide whether to bank a small group or risk a long flock for a larger delivery bonus. There is no countdown or automatic victory: all eight must be delivered. Each delivery restores one energy, up to three.

- Click/tap a destination, drag, or use arrows/WASD to move in both axes.
- DIVE (Space) is a toggle. Three seconds of breath let the whole flock pass under rocks and boats and break the eel's pursuit. Surface to rescue or deliver chicks. Empty breath forces surfacing and a short recovery before diving again.
- HONK (E) gathers nearby chicks and stuns a nearby eel. It has a seven-second cooldown and cannot be used underwater.
- The eel hunts the tail, then visibly winds up before lunging at a fixed location. Turning, diving, or honking gives an escape. It stays away from the nest.
- Boat lanes flash before a boat crosses. Surface collisions cost energy; a hit scatters up to two carried chicks, which remain available for rescue. Delivered chicks stay safe.
- Underwater fish grant points and shorten the honk cooldown. Group deliveries score `100 × group size²`; completing a rescue also grants a speed bonus. The best score stays in local storage.
- Pause with P, Escape, or the button. Switching away pauses automatically. Blocked storage/audio does not prevent play.

The alien lake and six original sprites were previously generated through Higgsfield in the requested cartoon direction and are reused here. `art/provenance.json` records those generations; this mechanics change requires no new generated art.

Serve `public/` with a static server. Run `node --test qa/echo/crossing.test.mjs` for simulation checks, including a full rescue with hazards active. `crossing.js` contains the simulation; `main.js` handles rendering, input, sound, and UI. New runs vary chick positions slightly; explicit simulation seeds make tests repeatable.
