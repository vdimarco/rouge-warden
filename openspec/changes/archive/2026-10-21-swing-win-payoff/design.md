# Win payoff

No new rendering technique. The comic words already on `art/words.json` (KASPLASH, FLUSH) are drawn by `fx.word` with an explicit width, the same path a finisher uses. None of the grass, water, or outline sources fit, because nothing new is shaded.

The beat follows Marvel's Spider-Man 2 (Insomniac, 2023): time slows, a big title lands, and a cheer plays before the next objective. Original words only. The sheet has no new title, so a flush carries the bomb and a kasplash carries every other win.

## Decisions

- The word sits about 2.8 m in front of the camera, short of a wall, and spans about 62% of the view. A finisher spans about a third.
- It stays 3.2 s. The next mission card waits 1.35 s, then the story scene (when there is one) and the next job.
- A fail stays a toast. Reduced motion skips the slow moment and the hit, and still shows the word.
- The cheer is the existing `cheer` stinger, with `trialEnd`.
