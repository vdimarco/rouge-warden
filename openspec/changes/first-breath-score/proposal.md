# First Breath: a film score in the Family Guy style

## Why

The user asked for better music in First Breath:

> "can we make the music better"

> "make it feel liek like stweie in family guy during the pregnancy episode"

The episode is "Emission Impossible" (Family Guy, season 3, 2001). Stewie flies a tiny ship into Peter's body to stop
his own future sibling, and the show scores it like a real adventure film. The music is a studio orchestra with a big
band inside it: brass fanfares, a spy chase, a swashbuckling expedition, a Broadway show number, and soft strings for
the tender moments. Stewie hears his life as a grand film, and the score plays it straight. First Breath follows a
baby from the race to the first breath, so the same idea fits: the baby is the hero of its own film.

Today First Breath has no music at all. It has her heart, a souffle noise, a hummed voice and short one-shots, all
through the womb filter, which is 150 Hz in the early stages. Every stage sounds like a low thump.

## What changes

- **An original score** in the idiom of the Family Guy underscore: ten cues (the title screens, eight stages and the
  ending), twelve stingers and one leitmotif, "your" theme, that returns in the title, stage 1, stage 5 and the
  ending. No existing melody is quoted or paraphrased; only the idiom is borrowed (`design.md` 1).
- **The music follows the action.** Each stage cue has three layers that join as the stage heats up, and stages 2 and
  5 have a boss layer. Changes land on the next bar line. Stage 8 speeds up a little each wave. Stage 6's show number
  locks to her heartbeat, two music beats to each of hers.
- **Stingers** for the big moments: a grade fanfare at each stage end (Good, Great, Glowing), a boss stab, a harp
  flourish for a gift or a pool, two brass notes at a gate, a brass rip for an item. A knock-out gets a soft settling
  chord, never a sad sting.
- **The score is the baby's inner film.** It bypasses the womb filter and goes straight to the master, after the mute.
  Her heart and the other sounds stay inside the womb, muffled as before, and the score leaves room for them.
- **The ending stays calm.** The score is silent from the white to the first cry, then plays one soft warm chord. The
  lullaby plays on the run result.
- **A Music setting** next to Sound, on by default and saved. Sound off (the arcade mute or M) silences the score too.
- **Captions** name the music once per stage, in plain words, such as "♪ spy-chase music".
- **Real instruments.** The score plays on vendored FluidR3_GM samples (about 1.5 MB of mp3, credited on the Sources
  screen), loaded after Play. Until they load, or if they fail, a synth stand-in plays, so the music never waits.

## Capabilities

- Modify `first-breath-presentation`: the score, its cues, layers, stingers, the heart over the score, stage 6's
  beat lock, the calm ending, music captions, loading, the fallback and its cost. "Womb sound" changes: the score is
  the one source that uses recorded samples and skips the womb bus.
- Modify `first-breath-journey`: the Music setting, and the score stopping with pause.
- Modify `first-breath-arcade-machine`: "Sound follows the arcade" now covers the score.
- Modify `first-breath-facts-and-tone`: the Sources screen ends with the music credit.
- `first-breath-input` and `first-breath-stages` keep their requirements. Each stage gains a pure `mood(st)`, which is
  part of the score plumbing, not a gameplay change.

## Impact

- New code: `public/first-breath/core/music/` (the score as pure data: `score.js`, `theory.js`, `kit.js`,
  `stingers.js`, `cues/*.js`), `public/first-breath/ui/music.js` (the engine).
- New assets: `public/first-breath/audio/score/` (165 mp3 files, `manifest.json`, `README.md` with the license),
  rebuilt by `qa/first-breath/fetch-score-samples.mjs`.
- Changed code: `ui/sound.js` (one score input after the mute), `main.js` (build, load, tick, cues, stingers, sync),
  `ui/screens.js` (the Music switch, the credit), `ui/captions.js` and `core/text.js` (music captions and labels),
  `core/stages/*.js` (`mood`), `core/sources.js` or the Sources screen (the credit).
- Checks: new `qa/first-breath/music.test.mjs`, `music.e2e.mjs` and `music-demo.mjs`; updates to `text.test.mjs`,
  `pacing.test.mjs`, `save.test.mjs`, `layout.e2e.mjs`, `screens.e2e.mjs` and `perf.e2e.mjs`. The existing checks
  and `qa/arcade/quiet.mjs` must still pass.
- Size: about 1.5 MB of samples, fetched only after Play; about 184 KB of score and engine code (`core/music/` and
  `ui/music.js` as built, 183,781 bytes; about 65 KB gzipped file by file). Decoded, the samples take about 42 MB of memory at
  44.1 kHz.
- No new game, so the homepage cabinet, its row and the switcher entry stay as they are.
- A person must still listen on a phone and on speakers before this ships. The pull request says so.
