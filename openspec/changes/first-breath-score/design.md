# First Breath score: design

Change `first-breath-score`. `contract.md` in this folder is the build contract the composer, the engine builder and
the integrator worked from: the rules, the file owners, the data format and the engine API. It stays as that record
(tasks 1.3), and section 9.3 holds its corrections. This file records the decisions and why, the score as built, the
measurements, the open items and the sources. Where this file and `contract.md` disagree on an API name, `contract.md`
wins, except for the deviations listed in section 9, which are what was built. What this file does not change, the
First Breath design still sets: the one clock, the two hearts, the sound graph and the womb bus (archived
`2026-10-19-add-first-breath/design.md` section 11) and the action stages (`first-breath-action-genres/design.md`).

## 0. Summary

| | |
|---|---|
| Request | "can we make the music better"; "make it feel like Stewie in Family Guy during the pregnancy episode" |
| Reference | Family Guy's underscore, as in "Emission Impossible" (season 3, episode 11, 8 November 2001) |
| What we made | an original score: 10 cues, 12 stingers, 1 leitmotif, as pure data in `core/music/`, mixed per cue and level in `mix.js` |
| How it plays | `ui/music.js`: FluidR3_GM samples, drums made in code, a synth stand-in, a lookahead scheduler |
| Where it goes | a score input in `ui/sound.js` after the mute, outside the womb filters |
| How it adapts | vertical layers (levels 0, 1, 2, boss; the title 0 and 1) and horizontal sections, both changed on bar lines; stingers |
| Size | 165 mp3 files, 1,473 KB (1.52 MB with the manifest and README); about 180 KB of score and engine code, loaded with the page |
| Who built it | the composer, the engine builder and the integrator (`contract.md`); a verifier who fixed 10 faults after integration (9.1); a music critic who rewrote six tunes and set the mix (1.4, 3.2); then the lead (8, 9.3) |
| Status | built, wired, verified and mixed; every First Breath check passes in the builders' runs (11); nobody has listened yet |

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
hero seriously.

Three things guard it:

- `music.test.mjs` checks that no two cues share their first 8 melody notes, counted from each cue's tonic.
- Its originality screen (the critic's, 1.4) compares every tune and countermelody, in windows of 6 notes, by
  interval and rhythm, with about 35 famous themes. A match on all 5 intervals fails, and so does the Raiders March's
  rising pickup rhythm.
- A person listens to every cue and stinger before the pull request ships (tasks 8). The screen's themes were written
  from memory, and it leaves out the Family Guy theme, Get Smart and Fantastic Voyage (12).

### 1.3 The leitmotif

"Your" theme, in C (`kit.js` `LEITMOTIF`), with each note's length in beats:

C4 1, D4 0.5, G4 0.5, E5 1.5, F5 0.5 | E5 1, D5 0.5, B4 0.5, C5 2 |
D4 1, E4 0.5, A4 0.5, F5 1.5, G5 0.5 | A5 1, G5 0.5, E5 0.5, D5 2

It moves in a gallop: a quarter and two eighths, then the long note. C, then D and G in two quick eighths (a step and
a fourth), the leap of a sixth up to E on beat 3 with F on the "and" of 4, and a turn home through the leading tone
(E D B C) in the same gallop. Bars 3 and 4 answer a step higher and stop open on D, over the dominant.

Until the critic's pass it opened with a dotted lift: a dotted eighth, a sixteenth and a quarter. Rising, that rhythm
is the Raiders March's own, so the gallop replaced it everywhere the theme goes (1.4).

It is stated whole by four trumpets in the title, whose opening call is its gallop. It is hidden in minor in the low
brass of the spy chase (section C), broken into its head and sequenced upward in stage 5 (and stated whole in C
major in its B section), and sung by a solo horn in F major, in three, in the lullaby.

### 1.4 The critic's rewrites

After integration a music critic rendered every cue's whole loop at each level through the real engine and samples,
read each melody as note names over its chords, and screened every tune against famous themes. Six tunes came too
close and were rewritten. No cue changed its form, key or tempo.

| Cue | Too close to | What changed |
|---|---|---|
| `egg` | Hedwig's Theme note for note: the horn tune G C E-flat D C G F D in C minor. Its first 5 notes are also the Godfather waltz, in the same key. | A new hook: a held G, a triplet climbing to C, answered a step lower, then the triplet again a fifth up. The Neapolitan cadence is kept, and B echoes the triplet. |
| `title` | A bar 5 matched 6 notes of Hedwig's Theme. A2 bar 6 was close to "Over the Rainbow". The intro's repeated B-flats over a roll sounded like a studio-logo fanfare. | Both bars rewritten. The intro call is now the theme's gallop with a rip. |
| the theme in `title`, `swim` (C) and `grow` | The Raiders March rhythm (1.3). In `grow` the head, in that rhythm, was sequenced upward like Raiders about 12 times a loop, and A0's hits held the 5-1-flat 3-2 cell of Hedwig's Theme and the Godfather. | The gallop throughout; `grow`'s A0 bar 2 changed. |
| `split` | The half-step slide into G, then E and D: the Pink Panther's tail. | A new tiptoe tune: rests between the steps, a C-sharp to D turn, the second phrase a fourth up. |
| `answer` | Bars 2 and 3 (G, then E G C B A) were a phrase of Brahms's Lullaby, with nearly its rhythm. | Bar 3 echoes bar 1 a step up, and bar 4 reaches for the 7th. The cadences changed and the shout chorus follows. It still keeps out of MIDI 51 to 73 at levels 0 and 1. |
| `birth` | Bar 5 (F-sharp F-sharp G A in D major) opened like Ode to Joy, in Beethoven's own key. | Bar 5 rips up to B, and bar 6 climbs back to it. |

The critic also added more of the idiom's gestures, so every stage cue has a rip or a fall, a roll or a crash, and
brass at level 2 (`music.test.mjs` checks this):

- a ripped trumpet hit on each section's downbeat at level 2 in `swim`, `egg`, `root` and `turn`, and one at level 1
  on A2's cadence in the title;
- harp glissandos into the title's B, `root`'s C and `birth`'s F major section;
- in `split`, the muted trumpet's answer ends in a fall, the glockenspiel doubles the staccato steps at level 2, and
  a brushed roll leads into the bridge;
- in `turn`, a timpani roll into each new key (level 1);
- in `root`, the level 2 trumpet descant sits an octave above the horns, not in unison with them;
- louder stabs (velocity 0.66 to 0.68) in `swim`, `egg`, `grow` and `turn`.

**The title runs levels 0 and 1 only.** The title screens play level 1. So the glockenspiel doubling, B's fanfare
and the ripped hit on A2's cadence moved from level 2 to level 1, where they are heard. The cue says
`levels: [0, 1]`, and `music.test.mjs` checks that the title waits for no level 2.

**A voicing fix.** `theory.js` `closeChord` dropped the fifth even when the fifth was the top note asked for. A stab
meant to sit on E sat on C, and with a `lo` floor a whole voicing could vanish: three level 0 bars of `answer` had
nothing above A3. It now keeps the requested top note. This changed every 3-voice stab on a 4-note chord.

## 2. Decisions

### 2.1 The score is the baby's inner film, outside the womb

The score is non-diegetic. It is not music the baby hears through the wall; it is the film the baby is starring in,
the way Stewie hears his own life. So it bypasses the womb filter: `ui/sound.js` gives it one gain node, `scoreIn`,
that feeds the master after the mute and the pause, and `sound.scoreDest()` returns it. Her heart, the souffle, the
hum and the one-shots stay on the womb bus, muffled as before, and the hearing still grows over the run.

Why: through a 150 Hz low-pass a score would be a mumble with no brass and no tune, and it would blur her heart, the
one sound the game's timing depends on. Kept apart, the two read as two layers: the warm, low, felt world inside, and
a bright film score over it. The mute still silences both, because `scoreIn` sits after the mute.

The cost of that choice is loudness:

- The engine's bus runs at 0.8 into `scoreIn`, which feeds the master (0.85) and its limiter.
- The integrator added a 1 dB trim (gain 0.89) after the limiter. The limiter's own makeup gain lets her heart alone
  peak at about −2.0 dBFS, and with the score at level 2 the mix reached −0.7 dBFS. Turning the score down barely
  helped: even at 0.55, the egg's boss still peaked at −1.05 dBFS. With the trim, the mix peaks at −2.0 to
  −2.9 dBFS, and `sound.e2e.mjs` still passes.
- After the critic's mix (3.2), a stage cue at level 1 measures −24.2 to −25.4 LUFS, and her heart about −19. That
  puts the score about 5 to 6 LU under her heart. The spec asks for at least 6 LU, and no check measures it yet
  (10; tasks 4.5 and 6.7).
- Her heartbeat stays clear over every cue at level 2 in `music.e2e.mjs` (5.3).

The score leaves the hum's register free in stage 6 (2.4).

### 2.2 Samples, not a pure synth, not generated tracks

| Option | For | Against | Choice |
|---|---|---|---|
| A pure synth (oscillators only) | no files, tiny, matches the rest of the game | brass and strings from oscillators sound like a chiptune, not a studio orchestra; the idiom lives in the timbre of real brass | kept only as the stand-in and fallback |
| Generated tracks (a music model) | a finished sound | the repository's Higgsfield tooling (`higgsfield/`) makes images, video and 3D models and has no music path, and its credentials are not in this environment; a rendered track is a fixed stereo file with no layers, so it cannot change level on a bar line or lock to her beat in stage 6; ten cues at three levels would be many megabytes; a model asked for this style could echo real themes we cannot check note by note | not used |
| Vendored samples played from note data | real brass, strings, harp and timpani; the score stays data, so it adapts, transposes, syncs and is checked in node; 1.5 MB in all; a known open license | memory once decoded; a few hours of trimming and levelling | **chosen** |

The samples are FluidR3_GM by Frank Wen, as rendered to one mp3 per note by gleitz/midi-js-soundfonts. We vendor
only the notes the score needs: one sample every 4 semitones over each instrument's range plus the top note, so the
engine never moves a sample more than 2 semitones. 165 files, mono, 44.1 kHz, about 48 kbps, attack at 0, faded at
the end, 1,473 KB. Eight of them are an extra `upright` set (FluidR3 `acoustic_bass`, MIDI 28 to 55, gain 0.585)
for plucked bass notes (5.2). `qa/first-breath/fetch-score-samples.mjs` rebuilds them byte for byte, and exits with
an error when the mp3 files come to more than 2 MB. Section 8 has the license.

### 2.3 Adaptive music: vertical layers and horizontal sections

We follow iMUSE, LucasArts' adaptive music system (US patent 5,315,057, Land and McConnell). The patent describes a
sound driver that can "enable, disable, or set the volume of particular instrument parts", jump to other places in a
sequence through hooks, play composed transitions, and hold every change until the next musically fitting decision
point. We use both halves:

- **Vertical layering.** Each layer of a section has a `level`: 0, 1 or 2, or `"boss"`. A layer plays while the
  stage's mood level reaches it. Levels nest: level 1 holds all of level 0, level 2 all of level 1. A layer marked
  `off: "boss"` rests while a boss is on, so the tunes make way for the boss riff in stages 2 and 5. The title has
  levels 0 and 1 only, and the lullaby one level (1.4).
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
beats to each of her beats at 78, and its beat grid follows her laid beats.

Each tick, `main.js` passes her beats and the span they cover:
`music.sync(run.beats(now − 0.5, now + 1.0, "mother").map(toCtx), toCtx(now − 0.5), toCtx(now + 1.0))`. The span
lets the engine drop a beat it was given before that is no longer in the list. A new run or a Try again lays her beats
at another phase, and before this fix a second practice of stage 6 put the first downbeat 130 ms off her beat, and a
Try again ran two bars at 300 bpm. `fadeOut()` also forgets her beats.

Measured: every downbeat exactly on her beat offline (0 ms) with her beats 1 s ahead; at most 5.87 ms live through
`main.js`; within 1 ms after a new run and after a Try again (`music-engine.test.mjs`).

At levels 0 and 1 the band plays no note from MIDI 51 to 73, the hum's register and its echo, so the lane sounds stay
clear. The shout chorus is level 2, at a combo of 12 or with the fever lit (4).

### 2.5 The ending stays calm

The ending is tender: white, 1.5 s of silence, "Breathe.", the first breath, skin-to-skin, her heart close and clear,
her song. The score must not fill that silence. As built:

- Birth's light moment plays its end stinger, `light`: the choir and a held chord as the light rises.
- 1.5 s before the light ends, `main.js` calls `music.fadeOut(1)`. The cue stops at once, and every voice, the
  stinger's too, fades out. The last voice ends about 0.3 s before the ending's white.
- The ending's start calls `fadeOut(1)` again, for anything left by a practice ending or a Try again.
- No score note sounds from the white to the cry (`music.e2e.mjs`).
- 0.9 s after the cry starts, the score plays `warm`: one soft chord of 13 notes, under her heart and her song.
- The lullaby (the `ending` cue: F major, 66 bpm, in 3; strings, harp rocking in eighths, a soft contrabass, the solo
  horn singing the leitmotif) plays on the run result, where the player can rest. `cueFor("result")` gives `ending`.

Why on the result: a bar of the lullaby is 2.73 s, so `cue(null)` can take up to about 5.5 s to fade, and the first
inhale can come 1.5 s into the ending. There is no room for the lullaby before the breath. This was the composer's
option (c). The short hush the plan asked for (tasks 3.11) is the engine's `fadeOut(seconds)`.

### 2.6 A knock-out is never a sad sting

`ko` is a soft F add9 settling to C add9 in low strings and horn over a held bass (a plagal "amen"), in the playing
cue's key, with no drums and no note above velocity 0.35. It plays at `act.ko` in the action stages and when you rest
in stage 1 (its `out` event: a gate closed, or the tide). The cue drops to level 0 behind the Almost card. Resting is
part of the game's gentle tone (the action-genres change), and the music says "rest", not "you failed".

### 2.7 Timing

Chris Wilson's "A tale of two clocks": `main.js` already runs a 25 ms timer that schedules her beats ahead on the
audio clock. `music.tick(ctx.currentTime)` runs from the same timer and schedules the next 150 ms plus the output
latency (the article's example uses 100 ms; we take 150 ms because a dense cue has more notes per tick and phones
stall more). Every time in the engine API is a heard time, scheduled at time minus latency, as in `sound.js`.

A note more than 20 ms late is dropped, never played late. Three rules keep that from losing the music:

- **A late start.** A cue whose first downbeat went by before anything of it was laid starts at the next tick
  instead, from its first note. The Play tap's first frame bakes the stage's paper and can stall the page for most of
  a second; at 1280 × 800 that dropped the cue's first 2 notes, and a slower phone would lose more.
- **One window edge.** The engine and `notesIn` share one edge, 1e-9 beats, so a note at the very end of a tick's
  window is played in that window. Before, the engine used 1e-6, and the title at level 2 lost 5 of 1,826 notes in
  70 s.
- **A resync after a stop.** After any stop longer than 1 s (a hidden page, a suspended context, Music off, a stall)
  the notes scheduled ahead are cancelled and the cue comes back on a new bar line. A cue change asked for while
  stopped lands at once on that bar line, with no end stinger and no bar of the old cue. Before, turning Music back on
  after two stages played a bar of the cue from two stages back, then its button, then the right cue.

A few notes still drop under main-thread stalls longer than the lookahead: one at `root`'s overlay in one real-time
run, two in the middle of `root` in another (10).

### 2.8 Voices and the bus

Voices are made per note and freed when they end (unlike `sound.js`'s fixed pool). At most 48 sound at once:

- The cap is checked as each note starts, and counts only the voices sounding then. The oldest is released, one
  already dying away (a ring or a release) before one still held.
- A voice laid ahead neither counts nor is taken before it starts. At first the cap counted notes laid ahead, and a
  stinger lays all its notes at once: `glowing` alone lost 39 of its 130 sources, 136 never sounded under birth's
  light, and every overlay of a bot run cut cue notes.
- Notes laid ahead can still push the count above 48 for a moment, until the next note starts and takes the oldest.
- A voice's nodes are let go only when all its sources have ended. The crash's noise ends at 1.5 s while its metal
  rings on, so letting go at the first source cut every crash early. The crash's 2 s metal buffer now loops to the
  end of its 2.9 s decay.

The bus: cue voices → cue gain → duck gain, and stinger voices → stinger gain, both into a dry path plus a
convolution reverb (an impulse of seeded noise with an exponential decay, 1.6 s, wet 0.18, decorrelated stereo), then
the Music gain, then `scoreDest()`.

### 2.9 Loading

- `main.js` imports `ui/music.js` and `core/music/score.js` statically, so the boot parses about 180 KB more code
  (about 164 KB at integration; the critic's `mix.js` and rewrites added the rest). The planned `import()` on the Play
  tap was not used. The boot still fetches no score file and builds no music, and `boot.e2e.mjs` passes.
- `score.js` builds each cue only the first time it is read (2 to 13 ms in node), so importing it is cheap. At each
  card, `main.js` reads the next stage's cue, so its first frame does not pay for it.
- On the Play tap (and Play again, and a practice stage), after `sound.start()`:
  `createMusic(audioCtx, { dest: sound.scoreDest(), seed: run.seed, latencyS: null })`, which fetches nothing, then
  `setEnabled` from the Music setting.
- After the stage has started, `music.load()` fetches `manifest.json` and decodes the samples, but only with Music on.
  With Music off they wait until Music is turned on: about 1.5 MB to fetch and 45 MB to decode that nobody would hear.
- Until they load, each instrument plays on its synth stand-in (a filtered saw for brass and strings, a square for
  the clarinet, a triangle for the flute, choir and piano, a decaying sine for the glock, harp and timpani), in tune
  and at about the same level. An instrument whose samples fail stays on the synth for the visit, listed in
  `stats().fallback`.
- Decoded, the samples take about 42 MB at 44.1 kHz and 46 MB at 48 kHz. That is the main memory risk on old phones
  (section 10).

## 3. The cues

Written by the composer (`core/music/score.js` header, `cues/*.js`). The critic rewrote six tunes, added gestures
(1.4) and set the mix (3.2). 4/4 unless noted; the intro plays once, then the loop. Tempos sit in the contract's
guide ranges. No cue changed its idiom or its form.

| Cue | Screen or stage | Working name | Key, tempo | Form (bars) | Loop | Level 0 | Level 1 | Level 2 and boss |
|---|---|---|---|---|---|---|---|---|
| `title` | title, Stages, Settings, Sources | Overture | B-flat major, 112 | A0 4, then A 8, B 8, A2 8 | 51 s | march bass and tuba, horn after-beats, string pad, snare, kick | the theme in 4 close trumpets and trombone, string runs, timpani, glockenspiel doubling; B: strings in octaves, horn chorale, flute, a harp glissando in, a trumpet fanfare; a ripped hit on A2's cadence | none: the title plays level 1 |
| `swim` | 1, the race | Spy chase | D minor, 168 | A0 4, then A B A C (8 each) | 46 s | string ostinato with a falling line, dotted contrabass, high pad, bongo-like hats, kick | a trumpet spy tune; strings in G minor; the theme in minor in trombone and tuba (C); snare backbeat | muted stabs on the "and" of 2 and 4, a ripped hit on each section, a rising horn line, violins up an octave, snare drive, crash |
| `egg` | 2, the egg | Siege march | C minor, 144 | A0 4, then A 8, B 8, A2 8 | 40 s | march bass, pad, timpani, light snare | a horn tune in 3 parts (a held G, a climbing triplet), strings in E-flat (B), full march snare, tuba | trumpet stabs, a ripped hit on each section, string tremolo in sixteenths, kick on every beat; boss: a brass riff on the flat 2, timpani eighths, the tunes rest |
| `split` | 3, first cells | Caper | G minor, 120, swing 0.3 | A0 4, then A A2 B A3 (8 each) | 64 s | walking bass, pizzicato on 2 and 4, brushes, a brushed roll into the bridge | a tiptoe clarinet tune (flute added in A3), piano comp | a muted trumpet answering in the gaps and falling off, glockenspiel on the steps, trombone pads, ride |
| `root` | 4, the placenta | Expedition | E-flat major, 132 | A0 4, then A B A2 C (8 each) | 58 s | harp arpeggios (a glissando opens C), bass, pad, soft hat | a horn tune in 3 parts, running strings, timpani, snare; B strings in C minor; C flute and clarinet | trumpet stabs, a descant an octave over the horns, a ripped hit on each section, tremolo, snare drive |
| `grow` | 5, the shooter | Battle | A minor, 152 | A0 2, then A B A2 C (8 each) | 51 s | galloping string ostinato, bass, pad, kick, hat | the theme in pieces traded by horns and trumpets, sequenced upward (whole in C in B), snare, timpani | stabs, strings two octaves up, sixteenth snare; boss: choir "aahs", timpani eighths, a dark flat-2 riff, the tunes rest |
| `answer` | 6, the rhythm stage | Showstopper | G major, 156, swing 0.28, locked to her beat | A0 4, then A A2 B A3 (8 each) | 49 s | walking bass, brushes, hat on 2 and 4, high piano | a clarinet and flute tune (MIDI 74 to 84), low trombone pads (50 and below), ride | the shout chorus: 3 trumpets with rips and falls, trombone punches, kick and snare, crash |
| `turn` | 7, the survivor stage | Last stand | E minor, 160 | A0 2, then A B C D (8 each) | 48 s | an ostinato whose top note climbs each bar, a pedal, pad, kick, hat; the key climbs E minor, F-sharp minor, G-sharp minor, then a B7 pedal | a rising brass line in 3 parts, snare, timpani, a timpani roll into each key, trombone pedal | stabs, a ripped hit on each section, violins up an octave, timpani eighths, sixteenth snare, crashes |
| `birth` | 8, the runner | Great escape | D major, 176 | A0 2, then A B A2 C (8 each) | 44 s | string eighths, pumping bass, horn chorale, snare | a trumpet tune in 3 parts that rips up to B; horns in F with trumpet fanfares and a harp glissando in; strings soaring in B minor; timpani | stabs, high strings, glockenspiel, flute, sixteenth snare |
| `ending` | the run result (section 2.5) | Lullaby | F major, 66, in 3 | A0 2, then A 8, B 8, A2 8 | 66 s | one level: string chorale, harp rocking in eighths, soft contrabass, the solo horn theme; a violin countermelody (B); flute (A2) | | |

The working names are design words. They are never shown (section 7).

Each cue gives `tonic` (MIDI): title 58, swim 62, egg 60, split 55, root 63, grow 57, answer 55, turn 64, birth 62,
ending 65. `ducks` (how far a cue drops under a stinger): answer 0.4, ending 0.3, all others 0.5. Every stage cue
ends on `button`; birth ends on `light`, the ending on `warm`.

### 3.1 Stingers

Written in C and moved to the playing cue's tonic (−6 to +5 semitones), every note kept in range in every key. The
critic changed only their levels, through their velocities (`mix.js` `louder`), not their notes. The grand ones
(`win`, `glowing`) had sat 7 LU over a cue at level 1, and the gift's harp and bells 7 LU under it; now they are about
4 LU over and 2 LU under. LUFS is each stinger rendered alone in C.

| Stinger | Length | What it is | When, as wired | LUFS |
|---|---|---|---|---|
| `ko` | 3.3 s | soft F add9 settling to C add9, low strings and horn, no drums | a knock-out (`act.ko`); stage 1's rest (`out`) | −33.1 |
| `good` | 1.0 s | a quick fanfare: a triplet pickup to a bright major chord in close trumpets | grade Good, after the cue's end stinger at the overlay | −23.3 |
| `great` | 1.5 s | flat VI, flat VII, I in the full brass, timpani falling under it | grade Great, the same way | −20.7 |
| `glowing` | 2.3 s | the same cadence, grander, with harp, bells, a timpani roll and a crash | grade Glowing, the same way | −20.2 |
| `boss` | 2.0 s | a dark brass stab, a timpani roll, a second stab | a stage's mood turns boss: the egg's swarm, the Knot (3), the big germ (5), the Big Germ (7) | −21.5 |
| `gift` | 1.5 s | a pentatonic harp glissando and glockenspiel | a gift taken (3, `act.up`); a pool you link (4, `root.link` at gain 1), about 8 times a run | −26.9 |
| `gate` | 0.7 s | two bright brass notes | a gate passed (1): its `place` sound, since there is no gate-pass event | −24.2 |
| `item` | 0.4 s | a short brass rip | an item used (1) | −24.7 |
| `win` | 1.8 s | the "ta-da" | `act.win`: the egg's swarm drifts off, the Knot pops, the big germ pops, the Big Germ pops and stage 7 is clear (so stage 7 plays it twice) | −19.8 |
| `button` | 1.0 s | flat VI to I, short-short | the end of a stage cue, at the overlay | −23.0 |
| `light` | 7.5 s | the choir and a held chord | birth's light (added) | −23.4 |
| `warm` | 5.0 s | one soft warm chord | 0.9 s after the cry (added) | −33.6 |

`light` and `warm` are two more than the contract's ten (section 9). Knock-outs and Go on get no grade stinger.

### 3.2 The mix (`mix.js`)

The engine has no per-cue gain. So `core/music/mix.js` sets each cue's loudness at each level by trimming its layers'
gains in dB, once, when a cue is built (`score.js` calls `mixCue`). A trim that would lift a gain past 1 puts the rest
into the notes' velocities through the engine's velocity curve. `mix.js` keeps a copy of that curve as `VG`, because
`core/` cannot import `ui/`, and `music.test.mjs` checks the copy matches `velGain`.

- **Every cue:** the contrabass 3 dB down, the kick 2 dB down, and the level 0 pads and ostinatos 2 dB up, so the bed
  has a middle a phone speaker can play. Its energy under 120 Hz had been 15 to 23 dB over the 1 to 3 kHz band; now it
  is 8 to 15 dB.
- **Per cue:** trims by level, instrument, layer and intro. The `grow` and `birth` intros are 4 dB down: a short
  tutti intro had jumped 5 LU over the loop.

The targets, measured with ffmpeg's `ebur128` on the loop after the intro, the score alone through `ui/music.js` and
`ui/sound.js` with the samples:

| Level | Target (LUFS) | Why |
|---|---|---|
| 0 | about −28.5 | the bed: heard on a phone, under everything |
| 1 | about −24.5 | the tune |
| 2 | about −22.5 | 1.5 to 2.5 LU over level 1: busier more than louder |
| boss | about −22 | |
| `answer` | 1 LU under the others at each level | stage 6's lane sounds sit on top of it |
| `title` | about −23.5 at level 1 | it plays on the menus, with no heart under it |
| `ending` | about −32.5 | the lullaby, softer than any stage's bed |

Measured, LUFS, before → after:

| Cue | Level 0 | Level 1 | Level 2 | Boss |
|---|---|---|---|---|
| title | −28.9 → −28.1 | −22.3 → −23.3 | none now | |
| swim | −30.3 → −28.5 | −25.8 → −24.2 | −24.9 → −22.1 | |
| egg | −28.8 → −28.4 | −22.6 → −24.2 | −22.2 → −22.1 | −21.5 → −21.6 |
| split | −30.0 → −29.0 | −27.9 → −25.3 | −27.5 → −24.1 | |
| root | −31.2 → −28.6 | −24.6 → −24.5 | −23.5 → −22.3 | |
| grow | −30.6 → −28.6 | −22.2 → −24.3 | −21.9 → −22.6 | −21.6 → −21.3 |
| answer | −31.0 → −29.3 | −26.7 → −25.4 | −24.1 → −23.5 | |
| turn | −29.8 → −28.6 | −22.7 → −24.6 | −21.3 → −22.6 | |
| birth | −29.4 → −28.5 | −22.3 → −24.3 | −21.9 → −22.5 | |
| ending | −31.7 → −32.3 | | | |

- **Spread across the stage cues:** 2.4 → 0.9 LU at level 0, 5.7 → 1.2 at level 1, 6.2 → 2.0 at level 2. The ending
  sits 3.1 LU under the softest bed.
- **Steps:** level 0 to 1 was 2.1 to 8.4 LU and is now 3.7 to 4.3; level 1 to 2 was 0.3 to 2.6 and is now 1.2 to 2.2.
- **Kept:** `music.test.mjs` holds the shape with a loudness estimate made from the notes, which tracks the renders
  within 1.8 dB.

## 4. The mood signals

Each stage module exports `mood(st)` → `{ level: 0 | 1 | 2, boss?: boolean, tempo?: number }`, beside `result()`. It
is pure and cheap, reads only the stage state and changes nothing in it (the verifier replayed 9 node bot runs to
check). `main.js` reads it every 100 ms and smooths it:

- A higher level applies at once. A lower one applies only after it has held for 2.5 s of stage time, so the music
  does not flap between levels every bar.
- Only changes reach `music.setMood`, and they land on the next bar line.
- Off the stage (the overlay, the Almost card, the card) the level is 0, so the cue plays on softly and the score
  never stops between stages. On the title screens it is 1.
- A stage with no `mood` plays level 1.
- When a stage's mood turns boss, `main.js` plays the `boss` stinger. Only `egg` and `grow` have boss layers.

The thresholds as built are literals in each `mood()`, described in the comment above it. The plan to record them in
each stage's tune file was not carried out (tasks 5.20).

| Stage | Level 0 | Level 1 | Level 2 | Boss | Tempo |
|---|---|---|---|---|---|
| 1 `swim` | cruising; once you rest or arrive, or the race is done | 3 or more racers within 25 u of you | the next gate you have not passed closes within 6 s or has 2 places or fewer left; or, from 12 s, the tide within 120 u behind you | none | 1 |
| 2 `egg` | a lull in the guard; the surge, the opening, the seal, the fusion, a knock-out | rivals or enzyme sparks about; the rush; your sperm coming in | 12 or more sparks in the air | the swarm, until it drifts off (at level 2) | 1 |
| 3 `split` | a room before its germs; a cleared room, the split, the gift pick, the hatch, a knock-out | germs in the room; the Knot's pop | 6 or more germs, or 16 or more of their shots | the Knot while it lives (at level 2): the stinger only | 1 |
| 4 `root` | exploring the roots; the nestle, the heart, a knock-out | a germ within 45 u, or a germ's shot about; the grow moment | hp 1, or 2 or fewer of 3 or more | none | 1 |
| 5 `grow` | a rest; a knock-out | a wave; the victory beat | from week 10 on, or 12 or more germs, or 24 or more shots | the big germ while it lives (at level 2) | 1 |
| 6 `answer` | a combo under 4; the hearing, the eyes, the outro | a combo of 4 or more | a combo of 12 or more, or the fever lit: the shout chorus | none | locked to her beat |
| 7 `turn` | under 8 germs; the turn, the rest, the outro, a knock-out | 8 or more germs; the clear | 20 or more germs | the Big Germ while it lives (at level 2): the stinger only | 1 |
| 8 `birth` | waves 1 and 2; the light | waves 3 to 5 | waves 6 to 8 | none | 1 rising to 1.12 over the 8 waves, from each wave's warning; 1.12 through the light |

## 5. The engine (`ui/music.js`)

### 5.1 API

As in the contract: `createMusic(ctx, { dest, base, fetchFn, latencyS, seed, level, score })` returns `load()`,
`cue(id, at, mood)`, `setMood(mood)`, `sting(id, at)`, `sync(times, from, to)`, `tick(now)`, `setEnabled(on)` and
`stats()`, plus `fadeOut(seconds)`. `ctx` may be null: every call works and nothing sounds. Extras are in section 9.

### 5.2 How it plays

- **Sampler:** the nearest sample for each note, `playbackRate` for the rest (at most 2 semitones), an attack and
  release envelope per note. Velocity sets the gain on a gentle curve (velocity 1 is 0 dB, 0.5 about −9 dB), and for
  brass also a low-pass, so loud notes sound brassier. A note longer than its sample loops a crossfaded middle section.
- **Bass:** a contrabass note of 0.75 s or less plays plucked on the extra `upright` set (FluidR3 `acoustic_bass`,
  8 files, MIDI 28 to 55); a longer one plays bowed. FluidR3's contrabass is bowed with a slow swell, which smeared
  the walking bass lines in `split` and `answer`.
- **Drums** are made in code from seeded noise and oscillators: kick (a falling sine), snare (noise and a tone), hat,
  ride and crash (a metallic tone from six square waves, after the TR-808 cymbal, through band-pass filters), roll
  (a snare roll) and brush (a swing brush). The crash's metal loops to the end of its 2.9 s decay. Timpani is a sample.
- **Gains:** each instrument's `gain` in `manifest.json` brings a velocity-1 note to about the same loudness, measured
  with ffmpeg's `ebur128` filter (momentary maximum).

### 5.3 What was measured

From the engine builder's scratch scripts in Chromium with an OfflineAudioContext, unless the row names a repository
check or the verifier's real-time runs.

| What | Result |
|---|---|
| Pitch, notes up to 2 semitones from their sample | within ±20 cents on every instrument with a clear pitch; choir and timpani checked by spectrum, in tune |
| Note timing | every onset within 5 ms of its scheduled time |
| Swing 0.33 | the off-beat lands at 0.665 of the beat |
| Changes | a mood change exactly on a bar line (0.00 ms in `music.e2e.mjs`); boss on the next beat; a tempo change (120 to 132, and birth's 1.12 in `music-engine.test.mjs`) on the bar line |
| Stingers | quantized to the next beat; the cue ducks −6.6 dB under it; transposed notes match `stingerNotes`; all 12 play; a big stinger loses none of its notes to the voice cap (`music-engine.test.mjs`) |
| Cue changes | `button` and the new cue on the same bar line; `cue(null)` fades over the bar before its stop; a cue that has not sounded yet is replaced at once (`music-engine.test.mjs`) |
| Drums | all seven sound; spectral centroids: kick 78 Hz, snare 5.3 kHz, hat 12.6 kHz, ride 10.3 kHz, crash 12 kHz |
| Reverb tail | −36 dB at 0.5 s, −52 dB at 0.9 s, −77 dB at 1.5 s after a note |
| Stage 6 sync | 2.4 |
| Fallback | with the sample files blocked, all 14 instruments play on the synth, in tune, at about the samples' level (also live in `music.e2e.mjs`) |
| Live AudioContext | the synth plays until the samples load, then the samples take over; nothing is scheduled while hidden, suspended or with Music off; each resumes on a new bar line; in `music.e2e.mjs` Music off falls 46 dB within 0.35 s and Sound off goes to −240 dBFS |
| Through `sound.js` | in stage 1's scene (the womb bus at 150 Hz) the mix has energy above 1 kHz 49.7 dB over her heart alone (`music.e2e.mjs`); mute silences it; a 40 ms latency moves notes 40 ms earlier |
| Peaks | with her heart, through `sound.js` and its 1 dB trim, the loudest cues at level 2 under two stingers: −2.0 to −2.9 dBFS (`music.e2e.mjs`; −0.7 dBFS before the trim) |
| Loudness (EBU R128) | her heart about −19 LUFS; the score per cue and level in 3.2 |
| Her heart over the score | at level 2 in every stage's scene, the heart band over the first 80 ms of each beat: 7.9 dB or more over the score (lowest: `grow` with the boss), medians 16 to 30 dB; the check needs 3 dB for 90% of her beats (`music.e2e.mjs`). The minimum was 6.5 dB at integration and 3.9 dB after the verifier's fixes, before the mix. |
| Voices | at most 48 sounding with every cue at level 2, stingers and a fade; no node let go while it sounds; every voice let go once its sources end (`music-engine.test.mjs`) |
| Dropped notes | none of the cue's opening at the Play tap at 1440 × 900 (`music.e2e.mjs`; 2 at 1280 × 800 before the late-start rule); 1 or 2 per real-time run, in `root`, from main-thread stalls |
| Cost | `tick()` averages 0.09 ms live, at most 2 ms; with every cue at level 2, p99 at most 2 ms and mean under 0.3 ms (`music-engine.test.mjs`) |
| Real-time runs (verifier) | two whole bot runs (reference skill seed 1, skill 0.5 seed 2) with a real AudioContext: each stage played its own cue, changing once per stage; the result played the lullaby; every stinger fired; nothing sounded from birth's light to the cry; live audio nodes 42 to 164 (49 at the end); the JS heap 30 to 73 MB and not growing; no page error from the game |
| Score data (node) | the busiest beat holds 23 notes; seams within 3 dB with no dips; the level steps after the mix are in 3.2 |

## 6. Integration (`main.js` and the rest)

As built, all in `main.js` unless noted:

1. **Build** on the Play tap (and Play again, and a practice stage), right after `sound.start()`: `createMusic` into
   `sound.scoreDest()`, then `setEnabled` from the Music setting (2.9).
2. **Load** after the stage has started, only with Music on (2.9).
3. **Tick.** `tickMusic()` runs at the top of the 25 ms sound timer, before the title's early return. Every 100 ms it
   reads the mood and offers the cue's caption; then it syncs stage 6 (2.4) and calls
   `music.tick(audioCtx.currentTime)`.
4. **Cues.** At each `stageStart`, `music.cue(cueFor(id), toCtx(t), mood)`. A Try again keeps the cue going and shows
   no new caption. The title, and Stages, Settings and Sources opened over the title or the run result, play the
   overture at level 1; the run result plays the lullaby. A new run fades the last run's music over 0.5 s.
5. **Mood:** section 4.
6. **Stingers:** section 3.1. At the overlay, the cue's `end`, then the grade's; the queue plays them one after the
   other.
7. **Stage 6:** section 2.4.
8. **The ending:** section 2.5.
9. **Settings.** A Music switch right after Sound, on by default. `core/save.js` keeps only its own fields, so
   `main.js` saves Music on its own, under `first-breath.music`, and it survives a reload. `setEnabled(on)` applies
   it; turning it on also loads the samples if they waited. Mute and pause need nothing more: they go through
   `sound.js`'s master and context.
10. **Captions:** section 7.
11. **Test hook.** `__fb.music` gives the engine's `stats()` plus `want` (the cue `main.js` asked for) and `setting`;
    `__fb.sound.times` gives the context times her beats were scheduled at. `stats().bars[].at` and
    `changes[].at` are context times. To test the fallback, block `**/audio/score/**`.
12. **`ui/sound.js`:** the `scoreIn` gain and `scoreDest()` (the engine builder), and the 1 dB trim after the limiter
    (the integrator, 2.1).

On a first visit the title is silent. The AudioContext starts on Play (the journey and arcade specs), so the overture
greets the player on the title screens only after a run has started.

## 7. Captions and words

With captions and Music on, one caption names the music when a stage's cue starts, once per stage, from
`music.<cue>` in `core/text.js`. `main.js` offers it as a sound's caption (`kind: "cue"`, 2.5 s) once that cue is
playing, within 12 s of the stage's start, and only when no other line shows, so it never cuts a fact or a sub-goal
line. A Try again shows none.

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

- `music.title` and `music.ending` are written but never shown: captions show only in a stage, and the ending's score
  is the warm chord alone.
- In the verifier's two real-time runs the egg and root captions never showed: the line was busy for all 12 s. So 6 of
  8 stages named their music (tasks 5.21).
- `text.test.mjs` scans every registered string, these and the Music label and credit among them, for banned words,
  pronouns, em dashes and sentence length. `pacing.test.mjs` sends the music caption the way `main.js` does, and every
  fact still shows whole.

The working names in section 3 ("Battle", "Siege march", "Last stand") are never shown: "battle" is on the banned word
list, and the others are not the game's tone. Stingers get no caption: each marks a moment the screen already shows
(the grade word, the gate tag, the gift, the rest line).

## 8. Credits and license

- **The files we vendor** come from gleitz/midi-js-soundfonts, whose README says FluidR3_GM is "Released under
  Creative Commons Attribution 3.0 license" (it links the CC BY 3.0 US page), generated from `FluidR3_GM.sf2`.
- **The soundfont itself** is Fluid (R3) GM by Frank Wen, "Copyright © 2000-2002, 2008 Frank Wen", released under the
  MIT license (its COPYING, as packaged by Debian).
- **`audio/score/README.md`** names the source and both licenses with their links: gleitz's CC BY 3.0 US page, and
  Debian's copyright file for the soundfont (https://sources.debian.org/src/fluid-soundfont/3.1-5.3/debian/copyright/).
  It carries Frank Wen's MIT notice in full, what was changed and how to rebuild. The lead added the notice (tasks 2.4).
- **`manifest.json`'s `license`** names both: "Files: CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/us/), as
  rendered by gleitz/midi-js-soundfonts. Soundfont: MIT, Copyright (c) 2000-2002, 2008 Frank Wen (see README.md)."
- **The Sources screen** ends with a "Music" heading and `sources.musicCredit`: "Music: an original score for this
  game. Instrument sounds: FluidR3_GM by Frank Wen (MIT license), from gleitz/midi-js-soundfonts (CC BY 3.0)." Its
  links (`core/sources.js` `MUSIC_CREDIT`): gleitz/midi-js-soundfonts, CC BY 3.0 and the MIT license.
- **The arcade switcher is unchanged.** The contract asked for the arcade `credits` field to name the samples. In
  `public/arcade/switch.js` that field is a boolean (`credits: false` keeps a game off Crimson Rogue's end credits),
  so it cannot hold a credit line, and First Breath needs no switcher change. The integrator put a credit string there
  anyway. That broke `qa/arcade/machines.mjs`'s exact-line check for the First Breath entry, and the verifier loosened
  the check. The lead restored both files to main.

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
   instruments without samples (all 14 before load). `voices` and `held` count voices sounding now, not those laid
   ahead.
10. `tick(now)` uses `ctx.currentTime` as the clock.
11. `fadeOut(seconds)` (the integrator): the cue stops at once with no end stinger, every voice fades over `seconds`,
    the stingers' too, and her beats are forgotten. Birth's light, the ending and a new run use it (2.5).
12. `sync(times, from, to)` (the verifier): `from` and `to` are the span of heard time the list covers, and a beat laid
    there before and missing from the list is dropped (2.4).
13. A cue that has not sounded yet (its first bar line still ahead, or a mother cue waiting for her first beat) is
    replaced at once by the next `cue()`, and `cue(null)` simply drops it (the verifier). Before, the change waited
    behind it, which is why `music.e2e.mjs` first found birth still playing `answer`.
14. A change asked for while stopped lands as the score resumes, at once, on its first bar line, with no end stinger
    and no bar of the old cue (the verifier, 2.7).
15. A cue whose first downbeat went by before anything was laid starts at the next tick, from its first note (the
    verifier, 2.7).
16. The engine's tick window and `notesIn` share the 1e-9 edge (the verifier, 2.7).
17. The voice cap counts only voices sounding as each note starts; a voice's nodes are let go only when all its
    sources end; the crash's metal loops (the verifier, 2.8).
18. Cancelling a fade (the same cue asked for again during its fade) rises back from where the fade had got to, not
    straight to full (the verifier; no dedicated check).

### 9.2 Score

1. Two stingers beyond the contract's ten: `light` (birth's end: the choir and a held chord) and `warm` (the soft
   chord after the cry).
2. `score.js` exports more helpers than the contract names: `sectionAt`, `sectionBeats`, `layerOn`,
   `stingerNotes(id, tonic)`, `stingerShift`, `stingerSeconds`, `scoreErrors()`, `DRUMS`, `RANGES` and `CUE_ORDER`.
   `notesIn` accepts a cue object or an id. Each cue is built lazily on first read, mixed and then frozen.
3. `off: "boss"` on a layer rests it while a boss is on.
4. `cueFor` maps stage ids and indices 0 to 7 (8 is the ending), "title", "menu", "settings", "stages" and "sources"
   to `title`, and "ending" and "result" to `ending`.
5. A cue also carries `key`, `tonic`, `levels`, `boss` and `plan`; a section carries its `chords`; a layer may carry
   `role`, `off` and `chorale`. `levels` is `[0, 1]` for the title, `[0]` for the ending and `[0, 1, 2]` for the rest.
6. `mix.js` (the critic): per cue and level gain trims applied when a cue is built, and `louder()` for the stingers'
   levels (3.2).

### 9.3 Facts in the contract that were wrong

The contract stays as written (it is the record the builders worked from; the lead decided this, tasks 1.3). These
corrections hold instead:

1. "Its score is Walter Murphy's": the episode's cue is credited to Ron Jones (La-La Land Records, *Family Guy:
   Movement I*, track 17). Murphy wrote the theme and writes the show's underscores; both write in the same idiom
   (1.1). The header comment in `core/music/score.js` still repeats the contract's wording ("Walter Murphy's Family
   Guy music"); the critic edited that file but not that line. It is a code comment, not shown, and can be corrected
   when that file is next edited.
2. "The arcade `credits` field names the samples": it is a boolean, and the switcher stays as on main (8).
3. "FluidR3_GM (CC BY 3.0, Frank Wen)": the files are CC BY 3.0 as gleitz distributes them; the soundfont is MIT by
   Frank Wen (8).

### 9.4 Integration

1. The Music setting is saved under its own key, `first-breath.music`, not in `core/save.js`'s save, which keeps only
   its own fields. So `save.test.mjs` cannot check it; `music.e2e.mjs` checks it survives a reload. The journey spec's
   "The Music setting" says so.
2. A lower mood level waits 2.5 s of stage time, not about 4 s (4).
3. The mood thresholds are literals in each `mood()`, not in the stage's tune file (4; tasks 5.20).
4. `main.js` imports the engine and the score statically, not with `import()` (2.9).
5. `ui/sound.js`, the engine builder's file, got a 1 dB trim after the limiter (2.1).
6. Stinger sources (3.1): `gate` comes from stage 1's `place` sound, since there is no gate-pass event; `gift` plays
   for a pool you link, not a pool found; `boss` plays in stages 3 and 7 too, from their mood's boss flag, though
   their cues have no boss layer.
7. The cue's caption waits for a free line within 12 s (7).
8. The samples load only with Music on (2.9).

## 10. Risks and open items

- **Nobody has listened yet.** The latest renders are the critic's, made with `music-demo.mjs` through the real
  engine and samples, with her heart. A person must listen to every cue, level and stinger on a phone speaker and on
  speakers or headphones (tasks 8). The pull request says so.
- **Loudness at level 1.** The spec asks for a cue at least 6 LU under her heart at level 1. After the mix, stage cues
  at level 1 measure −24.2 to −25.4 LUFS against her heart's −19: about 5 to 6 LU. No check measures it yet. Either
  lower level 1 by about 1 dB, or change the number after listening (tasks 4.5, 6.7).
- **Her heart under `grow`'s boss.** The lowest margin of all: 7.9 dB at least after the mix (6.5 dB at integration,
  3.9 dB after the verifier's fixes). If listening says her beat blurs there, lower `grow`'s boss and level 2 layers
  (tasks 4.5).
- **Music captions in stages 2 and 4** often do not show, because the caption line is busy for the whole 12 s
  (tasks 5.21).
- **Stingers that may come too often.** `root` plays `gift` about 8 times a run, once for each pool you link. `turn`
  plays `win` twice, at the Big Germ's pop and at the clear, shortly before its button and grade (tasks 5.22, 5.23).
- **Dropped notes.** A few notes still drop under main-thread stalls longer than the lookahead (2.7). That is the
  design: a late note sounds worse than a missing one. Watch for it on an old phone (tasks 8.6).
- **Memory.** About 42 to 46 MB of decoded samples. If an old phone struggles, decode at 22.05 kHz or decode each
  instrument on first use (tasks 8.6).
- **The voice cap** applies as each note starts, so notes laid ahead can push the count above 48 for a moment (2.8).
- **Boot code.** The boot parses about 180 KB more JavaScript (2.9). `boot.e2e.mjs` passes; `import()` could defer it.
- **Checks that do not yet test their scenario.** Several spec scenarios name a check that does not test them yet
  (11; tasks 6.4, 6.7).
- **The title on a first visit** is silent until Play, because the AudioContext starts on Play. Starting it on any
  first tap would change "Play starts the first stage at once" and "Sound follows the arcade"; not part of this change.
- **iOS.** `navigator.audioSession.type = "playback"` lets the score play with the ring switch on silent where it
  exists; older iOS follows the switch.

## 11. How each requirement is checked

The states are from the builders' runs: `music.test.mjs` 24 checks, `music-engine.test.mjs` 15, `purity.test.mjs` 26,
every other First Breath node test including `sim.test.mjs` (98), `music.e2e.mjs` 53, `sound.e2e.mjs` 51,
`boot.e2e.mjs` 264, `smoke.e2e.mjs` 226, `screens.e2e.mjs` 24, `layout.e2e.mjs` 190, `input.e2e.mjs` 102,
`visual.e2e.mjs` 88, `perf.e2e.mjs` 175, and `qa/arcade/quiet.mjs --only=first-breath --skip=scan,unit,silent` 35.

| Requirement (spec) | Check | State |
|---|---|---|
| An original score (presentation) | `music.test.mjs` (first 8 notes, the originality screen, the leitmotif); `music-demo.mjs` and a person listening | node passes; demo renders made; listening open |
| A cue for every screen and stage | `music.test.mjs` (cues, `cueFor`); `music.e2e.mjs` (stage 1, stage 6, birth, the result's lullaby, Stages' overture) | passes; a cue per stage in one run and the 1 s gap through an overlay are in no repository check yet (the verifier's real-time runs saw each stage's cue) |
| The music rises with the action | `music.test.mjs` (levels nest, bass and harmony kept); `music.e2e.mjs` (a mood change on a bar line, 0.00 ms); `music-engine.test.mjs` (birth's tempo on a bar line) | passes; the big germ arriving and birth's live tempo are not checked in the page yet |
| Stingers mark the big moments | `music.test.mjs` (ranges in every key, grades grow); `music-engine.test.mjs` (next beat, duck, queue); `music.e2e.mjs` (end stinger then grade) | passes; a gate passed in the page is not checked yet |
| A knock-out settles softly | `music.test.mjs` (no drums, velocity ≤ 0.35) | passes; the knock-out in the page is not checked yet |
| The heart stays audible | `music.e2e.mjs` (peaks, her heart detectable at level 2); `music.test.mjs` (stage 6 register) | passes; the 6 LU at level 1 is not checked, and the mix puts it at about 5 to 6 LU (10) |
| Stage 6 plays on her beat | `music.e2e.mjs` (0 ms offline, 5.87 ms live); `music-engine.test.mjs` (after a new run and a Try again) | passes; the shout chorus on a combo is not checked yet |
| The ending stays calm | `music.test.mjs` (lullaby soft, no drums, warm); `music.e2e.mjs` (silent white to cry, then the warm chord's 13 notes) | passes |
| Music captions | `music.e2e.mjs` (stage 1's caption once); `text.test.mjs`; `pacing.test.mjs` | passes; egg and root often miss in real time (10) |
| The score loads after Play | `music.e2e.mjs` (boot fetch, Music off, blocked samples); `boot.e2e.mjs` | passes; the folder size and README are checked only when `fetch-score-samples.mjs` rebuilds |
| The score costs little | `music-engine.test.mjs` (voice cap, tick cost); `perf.e2e.mjs` | engine passes; `perf.e2e.mjs`'s stage measures open stages by URL with no Play tap, so no score plays in them yet |
| Womb sound (modified) | `sound.e2e.mjs` (womb bus alone); `music.e2e.mjs` (the score skips it) | passes |
| The Music setting (journey) | `music.e2e.mjs` (next to Sound, on by default, saved, after a reload, M); `layout.e2e.mjs` (every Settings control 44 px and reachable at three sizes) | passes; `layout.e2e.mjs` does not find the switch by name, check it sits next to Sound or check its focus ring |
| The score pauses with the game | `music.e2e.mjs` (a hidden page in a stage and on the result); `qa/arcade/quiet.mjs` | passes; Esc on desktop is not checked yet |
| Sound follows the arcade (modified) | `qa/arcade/quiet.mjs`; `smoke.e2e.mjs` | passes |
| The Sources screen (modified) | `smoke.e2e.mjs`; `text.test.mjs` (the credit's words); `screens.e2e.mjs` | `screens.e2e.mjs` does not find the credit or its links yet |

`music.e2e.mjs` runs in Chromium with `--disable-gpu`, with an OfflineAudioContext where it fits; timing checks are
noisy on a shared machine, so a timing failure is rerun once alone before it counts.

## 12. Sources

Each was fetched and read for this change unless the row says otherwise.

| Technique | Source adapted |
|---|---|
| The lookahead scheduler | Chris Wilson, "A tale of two clocks", web.dev (last updated 9 January 2013): a JavaScript timer every 25 ms schedules notes about 100 ms ahead on the audio clock. We schedule 150 ms plus the output latency from the game's existing 25 ms timer. |
| Vertical layering, horizontal re-sequencing, changes held to the next decision point, stingers | iMUSE: Michael Z. Land and Peter N. McConnell, LucasArts Entertainment Company, US patent 5,315,057, "Method and apparatus for dynamically composing music and sound effects using a computer entertainment system", filed 25 November 1991, granted 24 May 1994 (read from the patent PDF). Its sound driver can "enable, disable, or set the volume of particular instrument parts", jump by hooks, play transitional phrases, and defer commands "to the next musically appropriate moment"; its example adds "a trumpet fanfare when a punch has been successfully landed". Our levels are its parts on and off; our sections, buttons and bar-line changes are its hooks and decision points. |
| The samples | gleitz/midi-js-soundfonts (github.com/gleitz/midi-js-soundfonts): FluidR3_GM "Released under Creative Commons Attribution 3.0 license", generated from FluidR3_GM.sf2, one mp3 per note. The soundfont: Fluid (R3) GM by Frank Wen, © 2000-2002, 2008, MIT license (Debian's copyright file for the FluidR3 soundfont, https://sources.debian.org/src/fluid-soundfont/3.1-5.3/debian/copyright/). We trimmed, levelled and re-encoded a subset (`audio/score/README.md`). |
| The nearest sample, pitched by playback rate | danigb's soundfont-player (MIT; archived in May 2023 in favour of smplr), which plays gleitz's FluidR3_GM and MusyngKite files in the browser, and danigb's smplr (MIT), whose "nearest" mode plays "the nearest loaded note, pitch-shifted". We keep one sample every 4 semitones so the shift is at most 2 semitones. |
| The reverb | The ConvolverNode of the W3C Web Audio API ("a convolution engine for a wide range of linear effects, especially very high-quality room effects", and its convolution reverb send), and Boris Smus, *Web Audio API* (O'Reilly, 2013), chapter 6, "Advanced Topics", section "Room Effects": a convolver with an impulse response, mixed with the dry sound (found by search; the O'Reilly page refused a direct fetch). The impulse itself: **none fit; our own**, seeded noise with an exponential decay, 1.6 s, decorrelated per channel, so there is no recorded hall to license and the same seed gives the same room. |
| Metallic drums | Gordon Reid, "Practical Cymbal Synthesis", Sound On Sound, July 2002: the TR-808 cymbal from "six square-wave oscillators tuned enharmonically", split by band-pass filters. Kick, snare, roll and brush: **none needed**, a falling sine and filtered noise with envelopes. |
| The mix | EBU R128 loudness as ffmpeg's `ebur128` filter measures it (integrated loudness of each loop after its intro; the momentary maximum for the sample gains). The targets and the trims in `mix.js` are **our own** (3.2). |
| The originality screen | **None fit; our own** (the critic's, in `music.test.mjs`): every tune and countermelody, in windows of 6 notes, compared by interval and rhythm with about 35 famous incipits written from memory: Raiders, Star Wars, the Imperial March, Superman, the Godfather, Hedwig's Theme, the Pink Panther, the Bond riff and line, Mission: Impossible (bass and tune), Peter Gunn, Jaws, William Tell, Batman, Close Encounters, Brahms's Lullaby, Ode to Joy, Over the Rainbow, Twinkle, the Mountain King, The Entertainer and several show tunes. Not compared: the Family Guy theme and Get Smart (not known precisely enough from memory) and Fantastic Voyage (its score is atonal). The closest remaining matches are 4 of 5 intervals, all stepwise scale or arpeggio fragments. |
| The style reference only | Family Guy's underscore: Walter Murphy, who composed the theme and writes the series' underscores with a 60-piece orchestra each week (waltermurphy.com biography); "Emission Impossible" (season 3, episode 11, 8 November 2001), whose cue La-La Land Records credits to Ron Jones (*Family Guy: Movement I*, 2016, track 17). Named only as the idiom; no melody, progression or rhythm was taken from it (contract rule 1), and a person still checks for likeness by ear (tasks 8.3). |
| Melodies, harmony, voice leading, forms | **None; our own**, in `core/music/` (`theory.js` helpers for chord charts, walking bass, close brass voicing, a strict four-part voice-leader, stabs, ostinatos, glissandos and drum patterns). |
