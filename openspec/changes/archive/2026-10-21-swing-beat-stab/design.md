# A short stab when the card changes

Marvel's Spider-Man 2 (Insomniac, 2023) marks a mission change with a short sting and keeps a longer countdown for something you line up and start. None of the grass, water, outline, or painted-look sources fit. The stab is two brass notes already available in this game's synthesizer, the same brass the win fanfare uses, cut short.

## Decisions

- The cue is named `beat`. It is two brass notes, E5 then C6, inside a fifth of a second, plus a short hiss. It is not a new sample. Live playback keeps the voice until the later brass note ends, so cleanup does not cut the second note when the hiss has already finished.
- `jobs.start` puts the mission name on the start event. A non-empty name plays `beat`. An empty name plays `trialStart`, which is what an odd job and the test helper do.
- A crime and a trial keep `trialStart`. The first flush starts no job, so it plays neither.
- The countdown stays the one already in the game. This round does not retune the chase clock, the miss, or the win.
