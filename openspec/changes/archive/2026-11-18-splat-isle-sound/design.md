# Design

All sound is made in the browser with Web Audio from the lab kit's blocks in `public/lab/kit/sfx.js` (`tone`, `hiss`, `ring`, `splash`, and steered noise beds). The kit copies Loon Lake's engine (`public/fish/js/audio.js`): a bus with a compressor and soft clip, and a short lake echo for the send. No source outside the repository was needed. The kit starts the context on the first press, keeps the arcade's one switch (`localStorage["arcade.sound"]`), and suspends when the page is hidden.

`public/lab/splat-isle/sound.js` holds Splat Isle's voices:
- Beds: the sea is pink noise under a low-pass filter whose level and cut-off swell with two slow sine waves; the wind is pink noise through a band-pass, louder at night.
- Music: a note every 2.6 to 6 seconds, a small random step through a major pentatonic scale, in a key for each island (Home A, Orchard C, Bell D, Wreck E, Lantern F), at half level at night.
- Crickets: three fast clicks of a 4–5 kHz tone, panned at random, while night is past half.
- One-shots by material: wood, stone, clay, glass and soft things each have their own knock; a break adds a falling noise sweep and scattered blips.
- The level stays low: peaks of 0.03 to 0.2 under the kit's 0.9 output. Riftwalk was first too loud, so this starts quiet.

`state()` reports whether the sound is on, the context's state and whether the beds started, for the browser check.

## Checks
- `node qa/lab/splat-isle.e2e.mjs`: no context before the first press; after it, a running context with the beds; Sound turns the switch off and on.
- `node qa/arcade/quiet.mjs --only=lab/splat-isle`: the sound runs once started, goes silent while the page is hidden, and comes back.
- Not done: listening by ear. This session has no speakers.
