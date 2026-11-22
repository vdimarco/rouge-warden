# Gloam Downs score samples

The instrument samples that `music.js` plays the run's score with. The effects have no files: `sound.js` makes them in code.

## Source and license

These files are copies of First Breath's score samples (`public/first-breath/audio/score/`), which record the source:

- Sounds: **FluidR3_GM** General MIDI SoundFont by **Frank Wen**.
- Rendered to one mp3 per note by **gleitz/midi-js-soundfonts**
  (https://github.com/gleitz/midi-js-soundfonts, files from https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/).
- License of the rendered files: **Creative Commons Attribution 3.0** (CC BY 3.0), as gleitz distributes them,
  https://creativecommons.org/licenses/by/3.0/us/
- License of the soundfont: **MIT**, by Frank Wen. The notice:

> Copyright © 2000-2002, 2008 Frank Wen
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
> documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
> rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
> persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
> Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
> WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
> COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
> OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

First Breath's README says how each note was cut, levelled and encoded. These copies are not changed.

## What is here

Six instruments, and only the notes that the score plays. There is one sample every 4 semitones, so the engine never moves a
sample more than 2 semitones. Files are named by MIDI note number (60 is middle C). `manifest.json` lists the files and gives
each instrument First Breath's `gain`.

| Instrument | FluidR3_GM program | Notes here |
|---|---|---|
| harp | orchestral_harp | 44 to 76 |
| strings | string_ensemble_1 | 36 to 64 |
| contrabass | contrabass | 32 to 40 |
| flute | flute | 60 to 68 |
| choir | choir_aahs | 56 to 72 |
| timpani | timpani | 40 to 52 |

32 files, about 334 KB. The limit is 500 KB. The bank loads after the first press that starts the sound, so it does not count
toward a place's 1.5 MB.

## Rebuild

After a change to the themes or the stingers in `music.js`, from the repository root:

```
node qa/lab/gloam-downs-bank.mjs
```

It copies the notes that the score needs from First Breath's folder and writes `manifest.json`. It fails when a note is out of
the bank's range or the bank is over 500 KB.
