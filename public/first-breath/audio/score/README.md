# First Breath score samples

The instrument samples that `ui/music.js` plays the score with.

## Source and license

- Sounds: **FluidR3_GM** General MIDI SoundFont by **Frank Wen**.
- Rendered to one mp3 per note by **gleitz/midi-js-soundfonts**
  (https://github.com/gleitz/midi-js-soundfonts, files from
  https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/).
- License: **Creative Commons Attribution 3.0** (CC BY 3.0),
  https://creativecommons.org/licenses/by/3.0/

## What was changed

From each original note file we:

- cut the silence before the attack, so the note starts at 0;
- trimmed it short (the length depends on the instrument, at most 2.6 s). A note that dies away by itself (pizzicato,
  harp, glockenspiel, piano, timpani) ends once it is 42 dB below its peak;
- added a short fade at the end (60 to 120 ms);
- mixed it to mono and re-encoded it as 44.1 kHz mp3 at about 48 kbps;
- levelled it: each note moves halfway toward its instrument's median loudness (at most 6 dB), and the instrument's
  loudest peak sits at -3 dBFS.

`manifest.json` lists the files and gives each instrument a `gain`. The gains bring a velocity-1 note of every
instrument to about the same loudness (the EBU R128 momentary maximum, measured with ffmpeg's `ebur128` filter).

## What is here

One note every 4 semitones over each instrument's range, plus the top of the range, so the engine never moves a
sample more than 2 semitones. Files are named by MIDI note number (60 is middle C).

| Instrument | FluidR3_GM program | Range (MIDI) | Files |
|---|---|---|---|
| trumpet | trumpet | 54 to 84 | 9 |
| trombone | trombone | 40 to 72 | 9 |
| horn | french_horn | 41 to 77 | 10 |
| tuba | tuba | 28 to 58 | 9 |
| strings | string_ensemble_1 | 28 to 96 | 18 |
| pizz | pizzicato_strings | 28 to 84 | 15 |
| contrabass | contrabass | 28 to 55 | 8 |
| harp | orchestral_harp | 36 to 96 | 16 |
| glock | glockenspiel | 72 to 108 | 10 |
| clarinet | clarinet | 50 to 91 | 12 |
| flute | flute | 60 to 96 | 10 |
| piano | acoustic_grand_piano | 36 to 96 | 16 |
| choir | choir_aahs | 48 to 79 | 9 |
| timpani | timpani | 40 to 57 | 6 |
| upright | acoustic_bass | 28 to 55 | 8 |

`upright` is not a score instrument. The engine plays a short contrabass note (0.75 s or less, as in a walking bass)
on it, plucked, and a longer one on the bowed `contrabass`.

165 files, about 1.45 MB in all. The drums (kick, snare, hat, ride, crash, roll, brush) are made in code and have no
files.

## Rebuild

With ffmpeg (with libmp3lame) and Node 18 or later, from the repository root:

```
node qa/first-breath/fetch-score-samples.mjs
```

It downloads the originals (kept in the system temp folder, or in `--cache DIR`), cuts, levels and encodes them, and
writes this folder's instrument folders and `manifest.json`. `--only trumpet,horn` rebuilds some instruments and keeps
the rest.
