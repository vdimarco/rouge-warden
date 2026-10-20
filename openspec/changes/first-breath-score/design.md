# First Breath score: design

Change `first-breath-score`. `contract.md` in this folder is the build contract the composer, the engine builder and
the integrator worked from: the rules, the file owners, the data format and the engine API. This file records the
decisions and why, the score as it was written, the measurements, the open items and the sources. Where this file
and `contract.md` disagree on an API name, `contract.md` wins, except for the deviations listed in section 9, which
are what was built. What this file does not change, the First Breath design still sets: the one clock, the two
hearts, the sound graph and the womb bus (archived `2026-10-19-add-first-breath/design.md` section 11) and the action
stages (`first-breath-action-genres/design.md`).

## 0. Summary

| | |
|---|---|
| Request | "can we make the music better"; "make it feel like Stewie in Family Guy during the pregnancy episode" |
| Reference | Family Guy's underscore, as in "Emission Impossible" (season 3, episode 11, 8 November 2001) |
| What we made | an original score: 10 cues, 12 stingers, 1 leitmotif, as pure data in `core/music/` |
| How it plays | `ui/music.js`: FluidR3_GM samples, drums made in code, a synth stand-in, a lookahead scheduler |
| Where it goes | a score input in `ui/sound.js` after the mute, outside the womb filters |
| How it adapts | vertical layers (levels 0, 1, 2, boss) and horizontal sections, both changed on bar lines; stingers |
| Size | 165 mp3 files, 1,473 KB (1.52 MB with the manifest and README); about 190 KB of code |
| Status | score, engine and samples built and checked in node and Chromium; integration in progress; nobody has listened yet |

## 1. The style

### 1.1 What the reference is

"Emission Impossible" is the episode where Stewie learns that Lois and Peter want another baby, shrinks himself, and
flies a tiny ship into Peter's body to stop the sperm that would become his sibling. The show scores it as a real
adventure film. Family Guy's music is written for a live studio orchestra with a big band inside it: Walter Murphy
composed the theme and writes the series' underscores with a 60-piece orchestra each week (his own biography). The
episode's own cue is credited to Ron Jones, who scored many early episodes alongside Murphy: track 17,
"Emission Impossible" (3:39), on La-La Land Records' *Family Guy: Movement I* (2016). Both write in the same house
idiom, so the style reference holds; the contract's "Walter Murphy's" stands for the show's house style, not for the
author of that one cue (section 9.3).

The idiom, as we use it:

- **The band:** a studio orchestra (strings, horns, harp, timpani, woodwinds, glockenspiel, choir for the biggest
  moments) with a big band inside it (trumpets and trombones in close harmony, tuba, rhythm section, swing drums).
- **Played straight.** The music never winks. A tiny cell gets a full spy-chase cue, and that is the joke.
- **Gestures:** brass stabs on the "and", rips up to a note and falls off it, timpani rolls into a new section, harp
  glissandos for wonder, a swing feel for the caper and the show number, stingers on every big moment, and the
  short-short "button" that ends a cue.
- **Genres by scene:** spy thriller, siege march, sneaky caper, swashbuckling expedition, battle, Broadway show
  number, last stand, great escape, lullaby. Each First Breath stage already is its own game genre, so each gets its
  own film genre.

### 1.2 Original music, no quotes

Every melody, chord progression and rhythm is new. No cue quotes or paraphrases the Family Guy theme, James Bond,
Mission: Impossible, Star Wars, Indiana Jones, the Pink Panther, Fantastic Voyage or any show tune. We borrow only the
idiom: instrumentation, form and gestures, which no one owns.

Why: those themes are under copyright, and a game in a public arcade cannot ship them. A parody quote is also a joke
that wears thin after one run. The feeling the user asked for comes from the idiom: a big orchestra taking a tiny
hero seriously. The score proves it is its own music in two ways. `music.test.mjs` checks that no two cues share
their first 8 melody notes, counted from each cue's tonic. A person must still listen to every cue and stinger for
any likeness to a known theme before the pull request ships (tasks 8).

### 1.3 The leitmotif

"Your" theme, in C (`kit.js` `LEITMOTIF`): C4 D4 G4 E5 F5 | E5 D5 B4 C5, then D4 E4 A4 F5 G5 | A5 G5 E5 D5. A dotted
lift, a rising fifth, a leap of a sixth with F on the "and", a turn home through the leading tone; then a step higher,
open on the dominant. It is stated whole by four trumpets in the title, hidden in minor in the low brass of the spy
chase (section C), broken into its head and sequenced upward in stage 5 (and stated whole in C major in its B
section), and sung by a solo horn in F major, in three, in the lullaby.

## 2. Decisions

### 2.1 The score is the baby's inner film, outside the womb

The score is non-diegetic. It is not music the baby hears through the wall; it is the film the baby is starring in,
the way Stewie hears his own life. So it bypasses the womb filter: `ui/sound.js` gives it one gain node, `scoreIn`,
that feeds the master after the mute and the pause, and `sound.scoreDest()` returns it. Her heart, the souffle, the
hum and the one-shots stay on the womb bus, muffled as before, and the hearing still grows over the run.

Why: through a 150 Hz low-pass a score would be a mumble with no brass and no tune, and it would blur her heart, the
one sound the game's timing depends on. Kept apart, the two read as two layers: the warm, low, felt world inside, and
a bright film score over it. The mute still silences both, because `scoreIn` sits after the mute.

The cost of that choice is loudness. The score bus runs at 0.8 into the master and its limiter. At level 1 a cue sits
about 7.7 LU under her heart (EBU R128: her heart about −19 LUFS, the score about −26.7). The score leaves the hum's
register free in stage 6 (2.4).

### 2.2 Samples, not a pure synth, not generated tracks

| Option | For | Against | Choice |
|---|---|---|---|
| A pure synth (oscillators only) | no files, tiny, matches the rest of the game | brass and strings from oscillators sound like a chiptune, not a studio orchestra; the idiom lives in the timbre of real brass | kept only as the stand-in and fallback |
| Generated tracks (a music model) | a finished sound | the repository's Higgsfield tooling (`higgsfield/`) makes images, video and 3D models and has no music path, and its credentials are not in this environment; a rendered track is a fixed stereo file with no layers, so it cannot change level on a bar line or lock to her beat in stage 6; ten cues at three levels would be many megabytes; a model asked for this style could echo real themes we cannot check note by note | not used |
| Vendored samples played from note data | real brass, strings, harp and timpani; the score stays data, so it adapts, transposes, syncs and is checked in node; 1.5 MB in all; a known open license | memory once decoded; a few hours of trimming and levelling | **chosen** |

The samples are FluidR3_GM by Frank Wen, as rendered to one mp3 per note by gleitz/midi-js-soundfonts. We vendor
only the notes the score needs: one sample every 4 semitones over each instrument's range plus the top note, so the
engine never moves a sample more than 2 semitones. 165 files, mono, 44.1 kHz, about 48 kbps, attack at 0, faded at
the end, 1,473 KB. `qa/first-breath/fetch-score-samples.mjs` rebuilds them byte for byte. Section 8 has the license.

### 2.3 Adaptive music: vertical layers and horizontal sections

We follow iMUSE, LucasArts' adaptive music system (US patent 5,315,057, Land and McConnell). The patent describes a
sound driver that can "enable, disable, or set the volume of particular instrument parts", jump to other places in a
sequence through hooks, play composed transitions, and hold every change until the next musically fitting decision
point. We use both halves:

- **Vertical layering.** Each layer of a section has a `level`: 0, 1 or 2, or `"boss"`. A layer plays while the
  stage's mood level reaches it. Levels nest: level 1 holds all of level 0, level 2 all of level 1. A layer marked
  `off: "boss"` rests while a boss is on, so the tunes make way for the boss riff in stages 2 and 5.
- **Horizontal re-sequencing.** A cue plays its intro (`A0`) once, then loops its sections (for example A B A2 C).
  A cue change plays the old cue's `button` and starts the new cue on the same bar line. Stingers are the patent's
  "trumpet fanfare when a punch has landed".
- **Decision points are bar lines.** A level change and a cue change land on the next bar line not yet scheduled; a
  boss arriving lands on the next beat; stage 8's tempo rises at a bar line. A stinger lands on the next beat, in the
  playing cue's key, and the cue ducks under it.
- **Loops join.** Each section's last chord leads into the next one's first, and each loop's seam is a real cadence
  (dominant, half step, plagal, flat VI or flat VII). `music.test.mjs` checks this, and that the bass and harmony keep
  playing through every mood change.

### 2.4 Stage 6 locks to her beat

Stage 6 is the rhythm stage, and its lanes follow her heartbeat, which drifts a little. A score on its own clock
would drift against the lanes within a bar. So the `answer` cue has `sync: "mother"`: it runs at 156 bpm, two music
beats to each of her beats at 78, and its beat grid follows her laid beats, which `main.js` passes each tick from
`run.beats(now, now + 1.0, "mother")`. With her beats given at least 0.5 s ahead, every downbeat lands exactly on her
beat (0 ms measured). At levels 0 and 1 the band plays no note from MIDI 51 to 73, the hum's register and its echo,
so the lane sounds stay clear. The shout chorus is level 2, at a high combo.

### 2.5 The ending stays calm

The ending is tender: white, 1.5 s of silence, "Breathe.", the first breath, skin-to-skin, her heart close and clear,
her song. The score must not fill that silence. So:

- Birth ends on its own end stinger, `light`: a held chord with the choir as the light rises.
- No score note sounds from the ending's white to the first cry. `light` and any cue fade must be done by the white.
- After the cry the score plays only `warm`, one soft chord, under her heart and her song.
- The lullaby (the `ending` cue: F major, 66 bpm, in 3; strings, harp rocking in eighths, a soft contrabass, the solo
  horn singing the leitmotif) plays on the run result, where the player can rest. `cueFor("result")` gives `ending`.

Why on the result: a bar of the lullaby is 2.73 s, so `cue(null)` can take up to about 5.5 s to fade, and the first
inhale can come 1.5 s into the ending. There is no room for the lullaby before the breath. This was the composer's
option (c). If `light` or a fade would still sound at the white, the engine needs a short hush (tasks 3.11).

### 2.6 A knock-out is never a sad sting

`ko` is a soft F add9 settling to C add9 in low strings and horn over a held bass (a plagal "amen"), in the playing
cue's key, with no drums and no note above velocity 0.35. The cue drops to level 0 behind the Almost card. Resting is
part of the game's gentle tone (the action-genres change), and the music says "rest", not "you failed".

### 2.7 Timing

Chris Wilson's "A tale of two clocks": `main.js` already runs a 25 ms timer that schedules her beats ahead on the
audio clock. `music.tick(ctx.currentTime)` runs from the same timer and schedules the next 150 ms plus the output
latency (the article's example uses 100 ms; we take 150 ms because a dense cue has more notes per tick and phones
stall more). Every time in the engine API is a heard time, scheduled at time minus latency, as in `sound.js`. A note
more than 20 ms late is dropped, never played late. After any stop longer than 1 s (a hidden page, a suspended
context, Music off) the scheduled notes are cancelled and the cue comes back on a new bar line.

### 2.8 Voices and the bus

Voices are made per note and freed when they end (unlike `sound.js`'s fixed pool), capped at 48 live voices, the
oldest fading voice released first. The bus: cue voices → cue gain → duck gain, and stinger voices → stinger gain,
both into a dry path plus a convolution reverb (an impulse of seeded noise with an exponential decay, 1.6 s, wet
0.18, decorrelated stereo), then the Music gain, then `scoreDest()`.

### 2.9 Loading

- The boot fetches no score file. `core/music/score.js` builds each cue only the first time it is read (2 to 13 ms in
  node), so importing it is cheap. The integrator may still import `ui/music.js` with `import()` on the Play tap, so
  the boot does not parse about 190 KB of score and engine code; either way the boot budget must hold.
- On the Play tap, after `sound.start()`: `createMusic(audioCtx, { dest: sound.scoreDest(), seed: run.seed })`, which
  fetches nothing. After stage 1 has started: `music.load()`, which fetches `manifest.json` and decodes the samples.
- Until they load, each instrument plays on its synth stand-in (a filtered saw for brass and strings, a square for
  the clarinet, a triangle for the flute, choir and piano, a decaying sine for the glock, harp and timpani), in tune
  and at about the same level. An instrument whose samples fail stays on the synth for the visit, listed in
  `stats().fallback`.
- Decoded, the samples take about 42 MB at 44.1 kHz and 46 MB at 48 kHz. That is the main memory risk on old phones
  (section 10).

## 3. The cues

Written by the composer (`core/music/score.js` header, `cues/*.js`). 4/4 unless noted; the intro plays once, then the
loop. Tempos sit in the contract's guide ranges. The plan in the contract held; no cue changed its idiom.

| Cue | Screen or stage | Working name | Key, tempo | Form (bars) | Loop | Level 0 | Level 1 | Level 2 and boss |
|---|---|---|---|---|---|---|---|---|
| `title` | title, Stages, Settings, Sources | Overture | B-flat major, 112 | A0 4, then A 8, B 8, A2 8 | 51 s | march bass and tuba, horn after-beats, string pad, snare, kick | the theme in 4 close trumpets and trombone, string runs, timpani; B: strings in octaves, horn chorale, flute | glockenspiel doubling, trumpet fanfare |
| `swim` | 1, the race | Spy chase | D minor, 168 | A0 4, then A B A C (8 each) | 46 s | string ostinato with a falling line, dotted contrabass, high pad, bongo-like hats, kick | a trumpet spy tune; strings in G minor; the theme in minor in trombone and tuba (C); snare backbeat | muted stabs on the "and" of 2 and 4, a rising horn line, violins up an octave, snare drive, crash |
| `egg` | 2, the egg | Siege march | C minor, 144 | A0 4, then A 8, B 8, A2 8 | 40 s | march bass, pad, timpani, light snare | a horn tune in 3 parts, strings in E-flat (B), full march snare, tuba | trumpet stabs, string tremolo in sixteenths, kick on every beat; boss: a brass riff on the flat 2, timpani eighths, the tunes rest |
| `split` | 3, first cells | Caper | G minor, 120, swing 0.3 | A0 4, then A A2 B A3 (8 each) | 64 s | walking bass, pizzicato on 2 and 4, brushes | a clarinet tune (flute added in A3), piano comp | a muted trumpet answering in the gaps, trombone pads, ride |
| `root` | 4, the placenta | Expedition | E-flat major, 132 | A0 4, then A B A2 C (8 each) | 58 s | harp arpeggios, bass, pad, soft hat | a horn tune in 3 parts, running strings, timpani, snare; B strings in C minor; C flute and clarinet | trumpet stabs and doubling, tremolo, snare drive |
| `grow` | 5, the shooter | Battle | A minor, 152 | A0 2, then A B A2 C (8 each) | 51 s | galloping string ostinato, bass, pad, kick, hat | the theme in pieces traded by horns and trumpets, sequenced upward (whole in C in B), snare, timpani | stabs, strings two octaves up, sixteenth snare; boss: choir "aahs", timpani eighths, a dark flat-2 riff, the tunes rest |
| `answer` | 6, the rhythm stage | Showstopper | G major, 156, swing 0.28, locked to her beat | A0 4, then A A2 B A3 (8 each) | 49 s | walking bass, brushes, hat on 2 and 4, high piano | a clarinet and flute tune (MIDI 74 to 84), low trombone pads (50 and below), ride | the shout chorus: 3 trumpets with rips and falls, trombone punches, kick and snare, crash |
| `turn` | 7, the survivor stage | Last stand | E minor, 160 | A0 2, then A B C D (8 each) | 48 s | an ostinato whose top note climbs each bar, a pedal, pad, kick, hat; the key climbs E minor, F-sharp minor, G-sharp minor, then a B7 pedal | a rising brass line in 3 parts, snare, timpani, trombone pedal | stabs, violins up an octave, timpani eighths, sixteenth snare, crashes |
| `birth` | 8, the runner | Great escape | D major, 176 | A0 2, then A B A2 C (8 each) | 44 s | string eighths, pumping bass, horn chorale, snare | a trumpet tune in 3 parts; horns in F with trumpet fanfares; strings soaring in B minor; timpani | stabs, high strings, glockenspiel, flute, sixteenth snare |
| `ending` | the run result (section 2.5) | Lullaby | F major, 66, in 3 | A0 2, then A 8, B 8, A2 8 | 66 s | one level: string chorale, harp rocking in eighths, soft contrabass, the solo horn theme; a violin countermelody (B); flute (A2) | | |

The working names are design words. They are never shown (section 7).

Each cue gives `tonic` (MIDI): title 58, swim 62, egg 60, split 55, root 63, grow 57, answer 55, turn 64, birth 62,
ending 65. `ducks` (how far a cue drops under a stinger): answer 0.4, ending 0.3, all others 0.5. Every stage cue
ends on `button`; birth ends on `light`, the ending on `warm`.

### 3.1 Stingers

Written in C and moved to the playing cue's tonic (−6 to +5 semitones), every note kept in range in every key.

| Stinger | Length | What it is | When |
|---|---|---|---|
| `ko` | 3.3 s | soft F add9 settling to C add9, low strings and horn, no drums | a knock-out |
| `good` | 1.0 s | a quick fanfare: a triplet pickup to a bright major chord in close trumpets | grade Good |
| `great` | 1.5 s | flat VI, flat VII, I in the full brass, timpani falling under it | grade Great |
| `glowing` | 2.3 s | the same cadence, grander, with harp, bells, a timpani roll and a crash | grade Glowing |
| `boss` | 2.0 s | a dark brass stab, a timpani roll, a second stab | a boss arrives |
| `gift` | 1.5 s | a pentatonic harp glissando and glockenspiel | a gift picked (3), a pool found (4) |
| `gate` | 0.7 s | two bright brass notes | a gate passed (1) |
| `item` | 0.4 s | a short brass rip | an item used (1) |
| `win` | 1.8 s | the "ta-da" | a boss or room cleared, where the integrator wants one |
| `button` | 1.0 s | flat VI to I, short-short | the end of a stage cue |
| `light` | 7.5 s | the choir and a held chord | the end of birth (added) |
| `warm` | 5.0 s | one soft warm chord | after the first cry (added) |

`light` and `warm` are two more than the contract's ten (section 9).

## 4. The mood signals

Each stage module exports `mood(st)` → `{ level: 0 | 1 | 2, boss?: boolean, tempo?: number }`. It is pure and cheap,
reads only the stage state, and runs every 100 ms; `main.js` passes it to `music.setMood`, and only changes take
effect, on the next bar line. No `mood` means level 1. The integrator sets the thresholds in each stage and records
them in that stage's tune file.

| Stage | Level 0 | Level 1 | Level 2 | Boss | Tempo |
|---|---|---|---|---|---|
| 1 `swim` | cruising: no rival close, no gate soon | in the pack: rivals close around you | a gate closing ahead, or the cool tide near | none | 1 |
| 2 `egg` | the opening and the calm between waves | formations firing | the dense late patterns | the swarm, while its boss bar shows | 1 |
| 3 `split` | a room's start | germs in the room | many germs, or the Knot | none (the Knot plays level 2) | 1 |
| 4 `root` | exploring | germs near | hp low | none | 1 |
| 5 `grow` | the rest between waves | a wave | a late wave, or hp low | the big germ | 1 |
| 6 `answer` | a low combo | a combo building | a high combo: the shout chorus | none | locked to her beat |
| 7 `turn` | few foes | a crowd | the swarm at its biggest, the Big Germ wave | none | 1 |
| 8 `birth` | the first waves | the middle waves | the last waves | none | 1 to 1.12, rising by wave |

A level should rise at once and fall only after about 4 s of calm, measured in stage time, so `mood` stays pure and
the music does not flap between levels every bar. During a stage's overlay, the Almost card and the next card, the
playing cue stays at level 0, so the score never stops for more than 1 s between stages.

## 5. The engine (`ui/music.js`)

### 5.1 API

As in the contract: `createMusic(ctx, { dest, base, fetchFn, latencyS, seed, level, score })` returns `load()`,
`cue(id, at, mood)`, `setMood(mood)`, `sting(id, at)`, `sync(times)`, `tick(now)`, `setEnabled(on)` and `stats()`.
`ctx` may be null: every call works and nothing sounds. Extras are in section 9.

### 5.2 How it plays

- **Sampler:** the nearest sample for each note, `playbackRate` for the rest (at most 2 semitones), an attack and
  release envelope per note. Velocity sets the gain on a gentle curve, and for brass also a low-pass, so loud notes
  sound brassier. A note longer than its sample loops a crossfaded middle section.
- **Bass:** a contrabass note of 0.75 s or less plays plucked on an extra upright bass set (FluidR3 `acoustic_bass`);
  a longer one plays bowed. FluidR3's contrabass is bowed with a slow swell, which smeared the walking bass lines.
- **Drums** are made in code from seeded noise and oscillators: kick (a falling sine), snare (noise and a tone), hat,
  ride and crash (a metallic tone from six square waves, after the TR-808 cymbal, through band-pass filters), roll
  (a snare roll) and brush (a swing brush). Timpani is a sample.
- **Gains:** each instrument's `gain` in `manifest.json` brings a velocity-1 note to about the same loudness, measured
  with ffmpeg's `ebur128` filter (momentary maximum).

### 5.3 What was measured

All in Chromium with an OfflineAudioContext from scratch scripts, unless noted.

| What | Result |
|---|---|
| Pitch, notes up to 2 semitones from their sample | within ±20 cents on every instrument with a clear pitch; choir and timpani checked by spectrum, in tune |
| Note timing | every onset within 5 ms of its scheduled time |
| Swing 0.33 | the off-beat lands at 0.665 of the beat |
| Changes | a mood change exactly on a bar line; boss on the next beat; a tempo change (120 to 132) on the bar line |
| Stingers | quantized to the next beat; the cue ducks −6.6 dB under it; transposed notes match `stingerNotes`; all 12 play |
| Cue changes | `button` and the new cue on the same bar line; `cue(null)` fades over the bar before its stop |
| Drums | all seven sound; spectral centroids: kick 78 Hz, snare 5.3 kHz, hat 12.6 kHz, ride 10.3 kHz, crash 12 kHz |
| Reverb tail | −36 dB at 0.5 s, −52 dB at 0.9 s, −77 dB at 1.5 s after a note |
| Stage 6 sync | downbeats exactly on her beats (0 ms) with her beats 1 s ahead; with only 0.12 s ahead, the error grows to her beat jitter (up to 17.6 ms), hence "at least 0.5 s ahead" |
| Fallback | with the sample files blocked, all 14 instruments play on the synth, in tune, at about the samples' level |
| Live AudioContext | the synth plays until the samples load, then the samples take over; nothing is scheduled while hidden, suspended or with Music off; each resumes on a new bar line; Music off is silent within 0.35 s; `tick()` averages 0.09 ms, at most 2 ms |
| Through `sound.js` | the score passes the 150 Hz womb filter (high-frequency energy −42 dB with the score, −94.5 dB with the heart alone); mute silences it; a 40 ms latency moves notes 40 ms earlier |
| Peaks | −6.5 to −22 dBFS on the bare score bus; with her heart through `sound.js`, true peak at most −1.6 dBFS |
| Loudness (EBU R128) | heart about −19 LUFS; score at level 1 about −26.7, the ending about −31; `grow` at level 2: score −21.2, about 1 LU above the heart there (−22.3) |
| Voices | `grow`, `turn` and `root` at level 2 reach 48; only fading voices are stolen; at most 33 still holding, so no sounding note is cut |
| Score data (node) | the busiest beat holds 23 notes; level 0 to 1 rises 3 to 9 dB, 1 to 2 rises 0.3 to 2.5 dB (level 2 adds rhythm more than loudness); seams within 3 dB with no dips |

## 6. Integration (`main.js` and the rest)

The integrator is still working on this part. The plan, from the engine builder's notes:

1. **Create** after `sound.start()` on the Play tap: `music = createMusic(audioCtx, { dest: sound.scoreDest(), seed:
   run.seed })`. **Load** after stage 1 has started: `music.load()`.
2. **Tick** with `music.tick(audioCtx.currentTime)` from the 25 ms timer, placed before `scheduleSound`'s early return
   on `screen === "title"`, or the title cue never schedules. Calling it while paused is fine.
3. **Cues:** `music.cue(cueFor(stageId), toCtx(t), stageMood)` at each `stageStart`; `music.cue("title",
   audioCtx.currentTime, { level: 1 })` on the title screens once the sound has started. The AudioContext still starts
   on Play (the journey and arcade specs), so on a first visit the title is silent; the overture greets the player on
   the title, Stages, Settings and Sources screens afterwards.
4. **Mood:** `music.setMood(mood)` every 100 ms from the stage's `mood(st)`.
5. **Stingers:** `music.sting(id, toCtx(ev.at))` from the run's events. At a stage end, `sting(CUES[id].end, at)` and
   then the grade; the queue sequences them.
6. **Stage 6:** each tick, `music.sync(run.beats(now, now + 1.0, "mother").map(toCtx))`.
7. **Settings:** `music.setEnabled(on)`. Mute and pause need nothing more: they go through `sound.js`'s master and
   context.
8. **The ending:** `light` at birth's end; nothing from the white to the cry (`cue(null)` early enough, or a hush);
   `music.sting("warm", at)` after the cry; the lullaby on the run result.
9. **Test hook:** `__fb` exposes `music.stats()` for the browser checks. `stats().bars[].at` and `changes[].at` are
   context times. To test the fallback, block `**/audio/score/**`.

## 7. Captions and words

With captions and Music on, one caption names the music when a stage's cue starts, once per stage, from
`music.<cue>` in `core/text.js`. Suggested words, all plain and gentle:

| Cue | Caption |
|---|---|
| `title` | ♪ grand march music |
| `swim` | ♪ spy-chase music |
| `egg` | ♪ march music |
| `split` | ♪ sneaky music |
| `root` | ♪ adventure music |
| `grow` | ♪ big orchestra music |
| `answer` | ♪ a big band plays |
| `turn` | ♪ rising music |
| `birth` | ♪ escape music |
| `ending` | ♪ a soft lullaby |

The working names in section 3 ("Battle", "Siege march", "Last stand") are never shown: "battle" is on the banned word
list, and the others are not the game's tone. Stingers get no caption: each marks a moment the screen already shows
(the grade word, the gate tag, the gift, the rest line). A music caption is a line, not a fact, and must not cut a
fact that is showing; `pacing.test.mjs` must send it.

## 8. Credits and license

- **The files we vendor** come from gleitz/midi-js-soundfonts, whose README says FluidR3_GM is "Released under
  Creative Commons Attribution 3.0 license" (it links the CC BY 3.0 US page), generated from `FluidR3_GM.sf2`.
- **The soundfont itself** is Fluid (R3) GM by Frank Wen, "Copyright © 2000-2002, 2008 Frank Wen", released under the
  MIT license (its COPYING, as packaged by Debian).
- We credit both. `audio/score/README.md` names the source, the CC BY 3.0 license and what we changed; it should also
  carry Frank Wen's MIT notice (tasks 2.4).
- **The Sources screen** ends with a music credit, in plain words: "Music: an original score for this game.
  Instrument sounds: FluidR3_GM by Frank Wen (MIT license), from gleitz/midi-js-soundfonts (CC BY 3.0)." with links.
- **The arcade switcher:** the contract asked for the arcade `credits` field to name the samples. In
  `public/arcade/switch.js` that field is a boolean (`credits: false` keeps a game off Crimson Rogue's end credits),
  so it cannot hold a credit line. First Breath leaves it unset and needs no switcher change.

## 9. Deviations from the contract

### 9.1 Engine

1. An extra `upright` sample set (FluidR3 `acoustic_bass`) in the manifest, for short contrabass notes (5.2). The
   manifest also has top-level `source` and `license` fields.
2. Every `at` and every `sync` time is a heard time, scheduled at time minus latency, as in `sound.js`.
3. A cue or mood change lands on the next bar line that is not yet scheduled, meaning more than 150 ms plus latency
   ahead.
4. An OfflineAudioContext counts as running while it renders (it reads "suspended" at each suspend point).
5. `cue()` with the cue already playing only updates the mood, and cancels a pending stop.
6. When a cue changes, its `end` stinger plays unless `sting(end)` was already called during that cue; then the old
   cue fades out instead.
7. Stingers queue and are never dropped. A new one waits for a sounding one to end, at most 1.5 s, then plays over it.
8. A mother cue waits up to 2 s for her first beat.
9. `createMusic` also takes `level` (default 0.8) and `score` (tests). `stats()` adds `held`, `section`, `samples`,
   `dropped`, `bars`, `stings`, `changes` and `latencyS`; `loaded` is a boolean; `fallback` lists the contract's
   instruments without samples (all 14 before load).
10. `tick(now)` uses `ctx.currentTime` as the clock.

### 9.2 Score

1. Two stingers beyond the contract's ten: `light` (birth's end: the choir and a held chord) and `warm` (the soft
   chord after the cry).
2. `score.js` exports more helpers than the contract names: `sectionAt`, `sectionBeats`, `layerOn`,
   `stingerNotes(id, tonic)`, `stingerShift`, `stingerSeconds`, `scoreErrors()`, `DRUMS` and `CUE_ORDER`. `notesIn`
   accepts a cue object or an id. Each cue is built lazily on first read and then frozen.
3. `off: "boss"` on a layer rests it while a boss is on.
4. `cueFor` maps stage ids and indices 0 to 7 (8 is the ending), "title", "menu", "settings", "stages" and "sources"
   to `title`, and "ending" and "result" to `ending`.

### 9.3 Facts in the contract that were wrong

The contract stays as written (it is the record the builders worked from). These corrections hold instead:

1. "Its score is Walter Murphy's": the episode's cue is credited to Ron Jones (La-La Land Records, *Family Guy:
   Movement I*, track 17). Murphy wrote the theme and writes the show's underscores; both write in the same idiom
   (1.1). The header comment in `core/music/score.js` repeats the contract's wording; it is a code comment, not
   shown, and can be corrected when that file is next edited.
2. "The arcade `credits` field names the samples": it is a boolean (8).
3. "FluidR3_GM (CC BY 3.0, Frank Wen)": the files are CC BY 3.0 as gleitz distributes them; the soundfont is MIT by
   Frank Wen (8).

## 10. Risks and open items

- **Nobody has listened yet.** The composer's demo used a crude additive synth; the engine's listening renders predate
  the last gain changes. A person must listen to every cue, level and stinger on a phone speaker and on speakers or
  headphones (tasks 8). The pull request says so.
- **Balance at level 2.** In `grow` at level 2 the score is about 1 LU above her heart there. Her beat onsets must
  stay detectable (`music.e2e.mjs`); if listening agrees it is too loud, lower some level 2 layer gains.
- **Memory.** About 42 to 46 MB of decoded samples. If an old phone struggles, decode at 22.05 kHz or decode each
  instrument on first use.
- **The ending's timing.** `light` (7.5 s) and a 1-bar fade must be done by the ending's white (2.5).
- **The title on a first visit** is silent until Play, because the AudioContext starts on Play. Starting it on any
  first tap would change "Play starts the first stage at once" and "Sound follows the arcade"; not part of this change.
- **iOS.** `navigator.audioSession.type = "playback"` lets the score play with the ring switch on silent where it
  exists; older iOS follows the switch.

## 11. How each requirement is checked

| Requirement (spec) | Check | State |
|---|---|---|
| An original score (presentation) | `music.test.mjs` (first 8 notes, leitmotif); `music-demo.mjs` and a person listening | node check passes; demo and listening open |
| A cue for every screen and stage | `music.test.mjs` (cues, `cueFor`); `music.e2e.mjs` (cue per stage, no gap over 1 s, title cue) | node passes; e2e open |
| The music rises with the action | `music.test.mjs` (levels nest, bass and harmony kept); `music.e2e.mjs` (bar line within 5 ms, boss) | node passes; engine measured; e2e open |
| Stingers mark the big moments | `music.test.mjs` (ranges in every key, grades grow); `music.e2e.mjs` (on the beat, duck) | node passes; e2e open |
| A knock-out settles softly | `music.test.mjs` (no drums, velocity ≤ 0.35); `music.e2e.mjs` | node passes; e2e open |
| The heart stays audible | `music.e2e.mjs` (onsets, R128, peak); `music.test.mjs` (stage 6 register) | node passes; engine measured; e2e open |
| Stage 6 plays on her beat | `music.e2e.mjs` (downbeats within 10 ms) | engine measured 0 ms; e2e open |
| The ending stays calm | `music.test.mjs` (lullaby soft, no drums, warm); `music.e2e.mjs` (silent white to cry) | node passes; e2e open |
| Music captions | `music.e2e.mjs`; `text.test.mjs`; `pacing.test.mjs` | open |
| The score loads after Play | `music.e2e.mjs` (boot fetch, blocked samples, size); `boot.e2e.mjs` | engine measured fallback; e2e open |
| The score costs little | `perf.e2e.mjs` with the score; `music.e2e.mjs` (voices, tick) | engine measured; open |
| Womb sound (modified) | `sound.e2e.mjs` (womb bus alone); `music.e2e.mjs` (the score skips it) | sound.e2e passes (51); e2e open |
| The Music setting (journey) | `music.e2e.mjs`; `save.test.mjs`; `layout.e2e.mjs` | open |
| The score pauses with the game | `music.e2e.mjs`; `qa/arcade/quiet.mjs` | engine measured; open |
| Sound follows the arcade (modified) | `qa/arcade/quiet.mjs`; `smoke.e2e.mjs` | open |
| The Sources screen (modified) | `screens.e2e.mjs`; `smoke.e2e.mjs` | open |

`music.e2e.mjs` runs in Chromium with `--disable-gpu`, with an OfflineAudioContext where it fits; timing checks are
noisy on a shared machine, so a timing failure is rerun once alone before it counts.

## 12. Sources

Each was fetched and read for this change unless the row says otherwise.

| Technique | Source adapted |
|---|---|
| The lookahead scheduler | Chris Wilson, "A tale of two clocks", web.dev (last updated 9 January 2013): a JavaScript timer every 25 ms schedules notes about 100 ms ahead on the audio clock. We schedule 150 ms plus the output latency from the game's existing 25 ms timer. |
| Vertical layering, horizontal re-sequencing, changes held to the next decision point, stingers | iMUSE: Michael Z. Land and Peter N. McConnell, LucasArts Entertainment Company, US patent 5,315,057, "Method and apparatus for dynamically composing music and sound effects using a computer entertainment system", filed 25 November 1991, granted 24 May 1994 (read from the patent PDF). Its sound driver can "enable, disable, or set the volume of particular instrument parts", jump by hooks, play transitional phrases, and defer commands "to the next musically appropriate moment"; its example adds "a trumpet fanfare when a punch has been successfully landed". Our levels are its parts on and off; our sections, buttons and bar-line changes are its hooks and decision points. |
| The samples | gleitz/midi-js-soundfonts (github.com/gleitz/midi-js-soundfonts): FluidR3_GM "Released under Creative Commons Attribution 3.0 license", generated from FluidR3_GM.sf2, one mp3 per note. The soundfont: Fluid (R3) GM by Frank Wen, © 2000-2002, 2008, MIT license (Debian's copyright file for the FluidR3 soundfont). We trimmed, levelled and re-encoded a subset (`audio/score/README.md`). |
| The nearest sample, pitched by playback rate | danigb's soundfont-player (MIT; archived in May 2023 in favour of smplr), which plays gleitz's FluidR3_GM and MusyngKite files in the browser, and danigb's smplr (MIT), whose "nearest" mode plays "the nearest loaded note, pitch-shifted". We keep one sample every 4 semitones so the shift is at most 2 semitones. |
| The reverb | The ConvolverNode of the W3C Web Audio API ("a convolution engine for a wide range of linear effects, especially very high-quality room effects", and its convolution reverb send), and Boris Smus, *Web Audio API* (O'Reilly, 2013), chapter 6, "Advanced Topics", section "Room Effects": a convolver with an impulse response, mixed with the dry sound (found by search; the O'Reilly page refused a direct fetch). The impulse itself: **none fit; our own**, seeded noise with an exponential decay, 1.6 s, decorrelated per channel, so there is no recorded hall to license and the same seed gives the same room. |
| Metallic drums | Gordon Reid, "Practical Cymbal Synthesis", Sound On Sound, July 2002: the TR-808 cymbal from "six square-wave oscillators tuned enharmonically", split by band-pass filters. Kick, snare, roll and brush: **none needed**, a falling sine and filtered noise with envelopes. |
| The style reference only | Family Guy's underscore: Walter Murphy, who composed the theme and writes the series' underscores with a 60-piece orchestra each week (waltermurphy.com biography); "Emission Impossible" (season 3, episode 11, 8 November 2001), whose cue La-La Land Records credits to Ron Jones (*Family Guy: Movement I*, 2016, track 17). Named only as the idiom; no melody, progression or rhythm was taken from it (contract rule 1), and a person still checks for likeness by ear (tasks 8.3). |
| Melodies, harmony, voice leading, forms | **None; our own**, in `core/music/` (`theory.js` helpers for chord charts, walking bass, close brass voicing, a strict four-part voice-leader, stabs, ostinatos, glissandos and drum patterns). |
