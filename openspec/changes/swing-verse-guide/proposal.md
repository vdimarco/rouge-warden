# Swing: the Spider-Verse build guide, part one

The user wrote a build guide, "Spider-Verse Style Game Build Guide" (a Claude Docs page), and asked to build the gaps it found in `swing-verse-style`. This change builds those gaps for Full Swing (`public/vr/`) in flat play.

## Why

The guide asks for more than the first change gave:

- **One frame rate for every character.** The gang moved smoothly next to a hero on twos. The film runs two fighters at different rates in one shot.
- **The freeze shows no strike.** A hit-stop held the first frame of the punch, a wind-up, not the blow.
- **The body is stiff.** No squash on a landing, no stretch on a jump.
- **No multiples.** Fast moves leave no copies of the body.
- **Words do not scale with the fight.** A finisher word was the size of a punch word, and a crash into a wall left nothing behind.
- **A heavy blow does not hit the camera.** No snap zoom, and the plates do not slip further.
- **No paper.** The frame has no grain.

## What changes

Flat play only. The headset does not change.

- **The gang on threes.** Goons take 8 poses a second, the hero 12. A goon's place still moves every frame, and a new pose (a wind-up, a fall) shows at once. Goons now swing their legs when they walk: their walk cycle never advanced before (`combat.js`).
- **Key pose on a hit.** A punch, a kick, a zip kick or a finisher starts at full reach. The hit-stop holds that pose, and the rest of the move follows through (`hero.js H.attack(kind, side, apex)`).
- **Squash and stretch.** A landing squashes the hero (to 0.8 of his height at the hardest, and wider), a jump stretches him, and a spring brings him back. Volume stays the same. None on a wall or in a roll.
- **Multiples.** A blow leaves a see-through copy of the wind-up for 0.16 s, and a zip leaves copies along its flight, in the plate colours magenta and cyan. Two copies at most: two draws while they show (`H.ghost`).
- **Words.** The finisher word fills a third of the view. A crash into a wall leaves a small BONK on the wall for 20 s, six at most (`fx.js` `life`).
- **Heavy blows.** A kick, a zip kick, a finisher or a slam doubles the plate slip for a moment and snaps the view in by 12 %, back in about six frames (`flatcam.snap`).
- **The frame edge.** The plates slip more toward the frame edge.
- **Paper.** A fine grain and soft blotches darken the mid-tones by up to 7 %. Black and white stay clean.
- The version goes to 1.23.0 (Quest APK code 30).

## Out of scope

From the same guide, each a change of its own: the world switch (a look per universe), mood grading, panels, a beat clock, face sprites, velocity smears, hatching in the post pass, interior lines.

## Capabilities

- `swing-verse-guide`: the items above.
