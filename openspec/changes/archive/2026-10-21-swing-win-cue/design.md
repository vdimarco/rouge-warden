# A sting that fits the job

Marvel's Spider-Man 2 (Insomniac, 2023) closes a mission with a short sting that fits what you just did, and keeps a longer fanfare for a timed challenge. None of the grass, water, outline, or painted-look sources fit. These stings use the synthesizer already in this game: the splash, the brass, a noise burst, and a tone.

## Decisions

- Four cues, named `winWet`, `winFight`, `winDash`, and `winLift`. No new samples.
- Sludge Run and Sludge Tanker play `winWet`. Rooftop Brawl and Mugging play `winFight`. Stop, Thief!, Pizza Rush, Getaway Car, and Taxi! play `winDash`. Catch!, Window Washer, and Balloon Chase play `winLift`. Anything else plays `winLift`, so a won job never falls through to the ring fanfare.
- Each cue returns the later of its parts, so live voice cleanup does not cut a note that is still held.
- `trialEnd` stays the ring-trial fanfare. `finishTrial` is unchanged. A miss still plays `miss`. The cheer, the comic word, and the hop stay on a win.
- This round does not retune the chase clock, the mission stab, or the King finale.
