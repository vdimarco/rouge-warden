# Chase clock

No rendering technique is involved, so none of the art sources fit. The feel follows Marvel's Spider-Man 2 (Insomniac, 2023): losing a chase changes the music, not only a marker. The block is a short sine at 740 Hz under the existing click, played by the same scheduler. Original tones only.

## Decisions

- The body sits under the hats, at 740 Hz, so it is not another hat.
- Falling behind (chase above 0.7) uses eighth notes and a heavier hit. Keeping pace (the steady 0.4 bed) stays on quarter notes.
- Loudness is checked on an offline render of the same seed, not by ear. This machine has no speaker listen.
