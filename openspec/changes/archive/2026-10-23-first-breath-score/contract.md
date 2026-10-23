# First Breath score: build contract

The user asked: "can we make the music better" and "make it feel like Stewie in Family Guy during the pregnancy
episode". The episode is "Emission Impossible" (2001): Stewie flies a tiny ship into Peter's body to stop his own
future sibling. Its score is Walter Murphy's: a theatrical studio orchestra with a big band inside it. Brass fanfares,
spy-thriller chases, swashbuckling adventure, Broadway show numbers, and soft strings for the tender moments. Stewie
hears his life as a grand film, and the score plays it straight.

Today First Breath has no music. It has her heart, a souffle noise, a hummed voice and one-shots, all through the womb
filter (150 Hz in the early stages). This change adds a score.

## Rules

1. **Original music.** Write new melodies, harmony and rhythm in that style. Do not quote or paraphrase any existing
   theme: not the Family Guy theme, not James Bond, Mission: Impossible, Star Wars, Indiana Jones, Pink Panther,
   Fantastic Voyage or any show tune. Borrow only the idiom: instrumentation, form, gestures (brass stabs, rips,
   falls, timpani rolls, harp glisses, swing feel, stingers, a "button" ending).
2. **The score is non-diegetic.** It is Stewie-style inner cinema, not something the baby hears through the wall. It
   bypasses the womb filter and goes straight to the master (after mute). Her heart and the other diegetic sounds stay
   as they are.
3. **The heart stays audible.** In every stage the score leaves room for her heartbeat and the stage's own cues. Stage
   6 (the rhythm stage) keeps its lane sounds clear above the score.
4. **The ending stays calm.** Tender, slow, soft. The score fades out before the first inhale and comes back only as a
   soft warm chord after the cry.
5. **A knock-out is never a sad sting.** Its stinger is a soft settling chord.
6. **Core stays pure.** The score data in `core/music/` is plain data and pure functions: no DOM, no Math.random, no
   wall time. `purity.test.mjs` must pass.
7. **Words.** Player-facing words in plain simple English, short sentences, no em dashes.

## Files

| Path | Owner | What |
|---|---|---|
| `public/first-breath/core/music/score.js` (and more files in `core/music/` if useful) | composer | the cues, sections, layers, stingers, leitmotif; pure data |
| `public/first-breath/ui/music.js` | engine | the sampler, drum synth, score bus, scheduler |
| `public/first-breath/audio/score/` | engine | the vendored samples, `manifest.json`, `README.md` with the license and credit |
| `public/first-breath/ui/sound.js` | engine | one small hook: a destination node for the score that goes to the master after mute |
| `public/first-breath/main.js`, `ui/screens.js`, `ui/captions.js`, `core/text.js`, `core/stages/*.js` (`mood`), `core/sources.js`, `public/arcade/switch.js` (credits) | integrator | the wiring |
| `qa/first-breath/music.test.mjs` | composer | node checks of the score |
| `qa/first-breath/music.e2e.mjs`, `qa/first-breath/music-demo.mjs` | integrator | browser checks and the demo render |

## The score data (`core/music/score.js`)

```js
export const INSTRUMENTS = ["trumpet", "trombone", "horn", "tuba", "strings", "pizz", "contrabass", "harp",
  "glock", "clarinet", "flute", "piano", "choir", "timpani", "kick", "snare", "hat", "ride", "crash", "roll", "brush"];
// kick, snare, hat, ride, crash, roll (snare roll) and brush (swing brushes) are drum voices the engine synthesizes;
// the others are samples. A drum note's midi field is ignored (use 0) except timpani, which is pitched.

export const CUES = { title, swim, egg, split, root, grow, answer, turn, birth, ending }; // one per screen/stage
// cue = {
//   id, name,                       // name: a short title for the demo files and the caption, e.g. "Spy chase"
//   bpm,                            // quarter-note tempo
//   swing,                          // 0 (straight) to 0.33 (hard swing): delays every off-beat eighth by swing × 1/2 beat
//   meter,                          // beats per bar: 3, 4 or 6
//   sync: "own" | "mother",         // "mother": the beat grid follows her laid heartbeats (stage 6 only; see Engine)
//   intro: "A0",                    // the section played first, once
//   loop: ["A", "A", "B", "A2"],    // then this order, looping
//   sections: { [id]: { bars, layers: { [layerId]: { inst, level, gain, notes } } } },
//     // level: the lowest mood level (0, 1 or 2) at which the layer plays; "boss" layers play only while mood.boss
//     // gain: 0..1 layer gain; notes: [[beat, durBeats, midi, vel 0..1], ...] from the section start, beat in quarter
//     // notes (fractions allowed). Every note starts inside the section. Chords are several notes at one beat.
//   end: "button",                  // the stinger played when the cue ends at a stage end (see STINGERS)
//   ducks: 0..1,                    // how far the cue's gain drops under a stinger (default 0.5)
// }

export const STINGERS = { ko, good, great, glowing, boss, gift, gate, win, button, item };
// stinger = { bpm, notes: [[beat, dur, midi, vel, inst], ...], key: "free" | "cue" }
//   key "cue": transposed to the playing cue's tonic (each cue gives `tonic`, a midi note number, in its fields)

export const LEITMOTIF = [[beat, dur, midi], ...];  // "your" theme: 2 to 4 bars, heard in title, swim, grow and ending

export function cueFor(screenOrStage) { /* → cue id */ }
export function notesIn(cue, sectionId, fromBeat, toBeat, mood) { /* → the notes to play, pure */ }
```

The composer chooses keys, tempos and forms. The cue plan (change it if the music is better for it, and say why in
`design.md`):

| Cue | Stage | Idiom | Guide tempo | Levels |
|---|---|---|---|---|
| `title` | title screen | grand villain overture, a march that turns into a fanfare; states the leitmotif | 108 to 116 | 1 |
| `swim` | 1 kart race | spy-chase: low string ostinato, muted-brass stabs, snare drive, bongo-like hats | 160 to 172 | 0 cruising, 1 in the pack, 2 a gate or the tide near |
| `egg` | 2 brick breaker | siege march: timpani, horns, strings tremolo; boss layer for the hardest pattern | 138 to 148 | 0, 1, 2 by pattern density |
| `split` | 3 roguelike | sneaky caper: pizzicato, clarinet, walking bass, brushes, swing | 116 to 124 | 0 room start, 1 fighting, 2 many foes |
| `root` | 4 adventure | swashbuckling expedition: horns, strings, harp; wonder on a pool found | 126 to 136 | 0 exploring, 1 fighting, 2 hp low |
| `grow` | 5 shooter | full-orchestra battle; a boss section with choir and timpani | 148 to 156 | 0, 1, 2, boss |
| `answer` | 6 rhythm | Broadway big-band swing, a show number; shout chorus at a high combo | 156, locked to her 78 bpm | 0, 1, 2 by combo |
| `turn` | 7 survivor | last stand: relentless ostinato, brass rising, layers grow with the swarm | 158 to 164 | 0, 1, 2 by swarm size |
| `birth` | 8 runner | great escape: brass and strings, faster each wave (tempo up at a bar line) | 172 to 184 | 0, 1, 2 by wave |
| `ending` | the ending | tender lullaby: solo horn and strings, the leitmotif in major | 60 to 70 | 0 |

Stingers: `ko` (soft settling chord, low strings and horn), `good`, `great`, `glowing` (fanfares, each grander),
`boss` (brass stab and a timpani roll), `gift` (harp gliss and glock), `gate` (two brass notes), `item` (a short brass
rip), `win` (a stage-clear "ta-da"), `button` (the end of a cue: the classic short-short button).

## Mood (each stage's `mood`, optional)

Each stage module may export `mood(st)` → `{ level: 0 | 1 | 2, boss?: boolean, tempo?: number }`. Pure, cheap (it
runs every 100 ms). `tempo` multiplies the cue's bpm (stage 8 only; 1 to 1.12). No `mood` means `{ level: 1 }`.

## Engine (`ui/music.js`)

```js
export function createMusic(ctx, { dest, base = "audio/score/", fetchFn = fetch, latencyS = null, seed = 1 })
// → {
//   load(),                    // → Promise: fetch manifest.json and decode the samples; an instrument whose
//                              //   samples fail falls back to a synth voice, listed in stats().fallback
//   cue(id, at, mood),         // start cue id at ctx time `at`. If a cue plays, the change lands on its next bar
//                              //   line: the old cue plays its `end` stinger (or a 1-bar fade) and the new one starts
//                              //   on that bar line. cue(null) stops after the current bar with a 1-bar fade.
//   setMood(mood),             // level, boss and tempo changes take effect on the next bar line (boss on: next beat)
//   sting(id, at),             // a stinger at ctx time `at` (quantized to the next beat when a cue plays);
//                              //   the cue ducks by its `ducks` for the stinger's length
//   sync(times),               // her laid beat times (ctx time) for a "mother" cue: 2 music beats per heartbeat; the
//                              //   beat grid follows them, so a downbeat lands on her beat within 10 ms
//   tick(now),                 // schedule the next 150 ms plus the latency (main.js calls it from its 25 ms timer);
//                              //   it schedules nothing while ctx.state is not "running" or document.hidden
//   setEnabled(on),            // the Music setting: off fades the score out over 0.3 s and schedules nothing
//   stats(),                   // { cue, level, boss, bar, beat, bpm, loaded, fallback, enabled, voices,
//                              //   scheduled (notes so far), recent (last 16 { inst, midi, at }), bus: "score" }
// }
```

- Instrument ranges (midi, sounding pitch; the composer writes inside them, the engine vendors samples over them):
  trumpet 54 to 84, trombone 40 to 72, horn 41 to 77, tuba 28 to 58, strings 28 to 96, pizz 28 to 84, contrabass
  28 to 55, harp 36 to 96, glock 72 to 108, clarinet 50 to 91, flute 60 to 96, piano 36 to 96, choir 48 to 79,
  timpani 40 to 57. `core/music/score.js` exports them as `RANGES`.
- Sampler: the nearest sample for each note, `playbackRate` for the rest (at most 2 semitones away), an
  attack-release gain envelope per note. Voices are made per note and freed on end (unlike `sound.js`'s fixed pool);
  cap 48 live voices, oldest released first.
- Drums are synthesized (noise and oscillators): kick, snare, hat, ride, crash, roll, brush. Timpani is a sample.
- Score bus: cue gain → a stinger duck gain → a short convolution reverb (an impulse made from seeded noise, about
  1.6 s, wet about 0.18) → `dest`. `sound.js` gives `dest`: a node that feeds its master after mute, not through the
  womb filters. Mute (the arcade sound setting) silences the score too.
- Samples: FluidR3_GM rendered by gleitz/midi-js-soundfonts (CC BY 3.0, Frank Wen). Vendor only the notes the score
  needs, one sample every 4 semitones over each range in the table above, mono mp3, 22.05 or 44.1 kHz, about 48 to 64
  kbps, trimmed to the shortest length that still sounds right (at most 3 s; strings and choir may hold to 4 s), with
  a short fade at the end. Total at most 2 MB. `audio/score/manifest.json` lists them:
  `{ "instruments": { "trumpet": { "notes": { "60": "trumpet/60.mp3", ... }, "gain": 1 } } }`.
- Load at the Play tap, after the first stage starts. The boot must not fetch any score file. Until the samples load,
  the fallback synth plays.

## Integration (`main.js` and the rest)

- Build the music with the sound on the Play tap; call `tick` from the existing 25 ms sound timer.
- `title` plays on the title screen after the first tap; each stage's cue starts at its `stageStart`; the card and
  overlay keep the playing cue at level 0 so no gap is longer than 1 s; the ending cue follows its own timing (rule 4).
- At a stage end: the cue's `end` stinger, then the grade stinger (`good`, `great` or `glowing`) with the overlay.
  A knock-out: `ko`. A boss arriving: `boss`. A gift picked (stage 3), a gate passed (stage 1), an item used (stage 1),
  a pool found (stage 4): their stingers.
- Stage 6: `sync` gets her laid beats from `run.beats(…, "mother")` each tick.
- Pause and a hidden page: the score stops scheduling and resumes on the next bar line.
- A Music setting (on by default, saved) in Settings, next to Sound.
- Captions: one line when a cue starts, once per stage, e.g. "♪ spy-chase music" (`music.<cue>` in `core/text.js`).
- Credits: the Sources screen and the arcade `credits` field name the samples and their license.

## Checks

- `node qa/first-breath/music.test.mjs`: every stage and the title and ending have a cue; every section's notes fit
  its bars; every note is in its instrument's range; every cue has layers at levels 0, 1 and 2 (the ending and title
  may have one); every stinger exists; `notesIn` is deterministic; no two cues share their first 8 melody notes.
- `music.e2e.mjs` (Chromium, OfflineAudioContext where it fits): the score bypasses the womb filter (stage 1 has
  energy above 1 kHz while the womb cutoff is 150 Hz); a mood change lands on a bar line within 5 ms; stage 6
  downbeats land on her beats within 10 ms; Sound off and Music off both silence the score; the boot fetches no
  score file; with the samples blocked the fallback synth plays; a hidden page schedules nothing; the mix peak stays
  below −1 dBFS; her heartbeat onsets stay detectable over the score.
- `music-demo.mjs`: renders each cue (10 s at level 0, 15 s at 1, 15 s at 2, with the boss layer where there is one)
  and each stinger to mp3 with ffmpeg in a folder given by `DEMO` (default the system temp folder), so a person can
  listen.
- The existing checks still pass: all node tests, `sound.e2e`, `smoke`, `boot`, `perf`, and the arcade `quiet.mjs`
  entry for First Breath.
- A person must still listen on a phone and on speakers. Say so in the PR.
