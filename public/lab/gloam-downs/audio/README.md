# Gloam Downs score samples

The instrument samples that `music.js` plays the run's score with. The effects have no files: `sound.js` makes them in code.

## Source and license

The six FluidR3_GM instruments are copies of First Breath's score samples (`public/first-breath/audio/score/`), which record the source:

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

## The four instruments made offline

`cello`, `gurdy` (a hurdy-gurdy), `drum-lo` (a large low drum) and `drum-mid` (a frame drum) are not recordings. They are
computed note by note in Node by `qa/lab/gloam-downs-synth.mjs`, with no download and no paid service, and encoded with ffmpeg
to mp3 at 48 kbps, mono, 44.1 kHz. The script writes them to `games/gloam-downs/audio-src/`, and the bank script copies the notes
the score plays from there.

- cello: a bowed string. The bow's friction curve drives two delay lines (the string on each side of the bow), with a loss at the
  bridge and a body of five resonant filters (about 200, 400, 560, 1000 and 2600 Hz). Bow noise sits 30 dB under it. Vibrato of
  5.5 Hz and 12 cents starts after 0.25 s. Each note is 2.0 s and steady, so the engine loops its middle.
- gurdy: the same bowed string, brighter, with a thin body and a nasal peak at 1.2 kHz. The score plays its drone as gurdy notes,
  and its buzz with a voice made in code (`gurdy-buzz` in `music.js`).
- drum-lo: one note (C2). A sine falls from 2.2 times the note to the note in about 60 ms, with membrane modes at 1.0, 1.59, 2.14
  and 2.30 times the base and a short noise slap. 1.6 s.
- drum-mid: one note (D3), the same build higher, with more slap. 0.6 s.

They are made for this repository and carry its license. The script's header names the methods it follows.

## What is here

Ten instruments, and only the notes that the score plays. There is one sample every 4 semitones, so the engine never moves a
sample more than 2 semitones. Each drum has one note, which the engine moves up to 7 semitones. Files are named by MIDI note number (60 is middle C). `manifest.json` lists the files and gives
each instrument First Breath's `gain`.

| Instrument | FluidR3_GM program | Notes here |
|---|---|---|
| harp | orchestral_harp | 44 to 76 |
| strings | string_ensemble_1 | 44 to 64 |
| contrabass | contrabass | 32 to 40 |
| flute | flute | 60 to 68 |
| choir | choir_aahs | 56 to 76 |
| timpani | timpani | 40 to 52 |
| cello | made offline | 36 to 60 |
| gurdy | made offline | 50 to 66 |
| drum-lo | made offline | 36 |
| drum-mid | made offline | 50 |

45 files, about 482 KB. The limit is 800 KB, and each instrument made offline is 100 KB or less. The bank loads after the first press that starts the sound, so it does not count
toward a place's 1.5 MB.

## Rebuild

After a change to the themes or the stingers in `music.js`, from the repository root:

```
node qa/lab/gloam-downs-bank.mjs
```

It copies the notes that the score needs from First Breath's folder and from `games/gloam-downs/audio-src/`, and writes
`manifest.json`. It fails when a note is out of the bank's range, an instrument made offline is over 100 KB, or the bank is over
800 KB. After a change to how the four are made, first run `node qa/lab/gloam-downs-synth.mjs` (it needs ffmpeg).
