# Tasks

Owners are in `contract.md` ("Files"). The composer owns `core/music/` and `qa/first-breath/music.test.mjs`; the engine
builder owns `ui/music.js`, `audio/score/`, the `ui/sound.js` hook and `qa/first-breath/fetch-score-samples.mjs`; the
integrator owns `main.js`, `ui/screens.js`, `ui/captions.js`, `core/text.js`, each stage's `mood`, the Sources credit,
`qa/first-breath/music.e2e.mjs` and `qa/first-breath/music-demo.mjs`. Section numbers refer to `design.md`. A task is
ticked only when its work and its checks are done.

## 1. Contract and plan

- [x] 1.1 `contract.md`: the style, the rules, the file owners, the score data format, the engine API, the integration plan and the checks.
- [x] 1.2 `proposal.md`, `design.md`, `tasks.md` and the spec deltas; `openspec validate first-breath-score --strict` passes.
- [ ] 1.3 The lead decides whether to correct the three wrong facts in `contract.md` (design 9.3: the episode's composer credit, the arcade `credits` field, the FluidR3 license) or to leave them recorded in `design.md` only.

## 2. Samples

- [x] 2.1 `qa/first-breath/fetch-score-samples.mjs` downloads, trims, levels and encodes the samples; a second run gives byte-identical files; `--cache`, `--only` and `--kbps` work.
- [x] 2.2 165 mono mp3 files at 44.1 kHz, about 48 kbps, attack at 0, faded at the end, one every 4 semitones plus the top of each range, with the extra upright bass set: 1,473 KB, under the 2 MB limit.
- [x] 2.3 `audio/score/manifest.json` with each instrument's gain from EBU R128, and `audio/score/README.md` with the source, the CC BY 3.0 license and its link, what was changed and how to rebuild.
- [ ] 2.4 Add Frank Wen's MIT notice for FluidR3_GM (© 2000-2002, 2008) to `audio/score/README.md` and the manifest's `license` field, and link gleitz's CC BY 3.0 US page as its README does (design 8).

## 3. Engine (`ui/music.js`)

- [x] 3.1 `createMusic` with the contract's API (`load`, `cue`, `setMood`, `sting`, `sync`, `tick`, `setEnabled`, `stats`) and the extras in design 9.1; `ctx` may be null.
- [x] 3.2 The sampler: the nearest sample, `playbackRate` within 2 semitones, an envelope per note, a crossfaded loop for long notes; pitch within ±20 cents on every pitched instrument.
- [x] 3.3 Drums made in code: kick, snare, hat, ride, crash, roll and brush, all sounding with the measured spectra (design 5.3).
- [x] 3.4 A synth stand-in per instrument family, in tune and at about the samples' level, playing until the samples load and for any instrument whose samples fail.
- [x] 3.5 The score bus: cue gain, duck gain, stinger gain, a convolution reverb from seeded noise (1.6 s, wet 0.18), the Music gain, into `dest`.
- [x] 3.6 The scheduler: 150 ms plus the latency per tick, heard times, late notes dropped; cue and mood changes on bar lines, a boss on the next beat, tempo on a bar line; stingers on the next beat, in the cue's key, queued; the old cue's button on a cue change; `cue(null)` fades over a bar.
- [x] 3.7 Stage 6: `sync(times)` sets the grid from her laid beats; downbeats on her beats (0 ms with beats given 1 s ahead).
- [x] 3.8 At most 48 live voices, stealing only fading ones; `stats()` with the contract's fields and the extras.
- [x] 3.9 Nothing scheduled while the page is hidden, the context is suspended or Music is off; each resumes on a new bar line; Music off is silent within 0.35 s; `tick()` averages 0.09 ms.
- [x] 3.10 `ui/sound.js`: the `scoreIn` gain after the mute and pause, outside the womb filters; `sound.scoreDest()`.
- [ ] 3.11 A short hush for the ending (for example a fade option on `cue(null)`, or a call that fades the stingers too), if `light` or a 1-bar fade would still sound at the ending's white (design 2.5).

## 4. Composition (`core/music/`)

- [x] 4.1 `theory.js` and `kit.js`: chord charts, melody notation, walking bass, close brass voicing, a four-part voice-leader, stabs, arpeggios, ostinatos, glissandos, drum patterns, layer and section builders; the leitmotif.
- [x] 4.2 Ten cues (design 3) with intros, loops, levels 0 to 2, boss layers in `egg` and `grow`, `sync: "mother"` for `answer`, and keys, tempos and ducks.
- [x] 4.3 Twelve stingers: the contract's ten, plus `light` and `warm` (design 3.1).
- [x] 4.4 `qa/first-breath/music.test.mjs` passes 18 checks; `purity.test.mjs` passes 26.
- [ ] 4.5 Balance after listening: in `grow` at level 2 the score is about 1 LU above her heart; lower some level 2 layer gains if the listening in section 8 agrees.

## 5. Integration (`main.js` and the rest)

- [ ] 5.1 On the Play tap, after `sound.start()`, build the music with `sound.scoreDest()` and the run's seed; call `music.load()` after stage 1 starts; the boot fetches no score file (consider `import()` for `ui/music.js`, design 2.9).
- [ ] 5.2 Call `music.tick(audioCtx.currentTime)` from the 25 ms sound timer, before `scheduleSound`'s early return on the title.
- [ ] 5.3 Cues: the overture on the title, Stages, Settings and Sources once the sound has started; each stage's cue at its `stageStart`; the overlay, the Almost card and the next card keep the cue at level 0.
- [ ] 5.4 `mood(st)` in `core/stages/swim.js`: cruising, in the pack, a gate closing or the tide near (design 4).
- [ ] 5.5 `mood(st)` in `core/stages/egg.js`: by pattern density; `boss` during the swarm.
- [ ] 5.6 `mood(st)` in `core/stages/split.js`: a room's start, germs in the room, many germs or the Knot.
- [ ] 5.7 `mood(st)` in `core/stages/root.js`: exploring, germs near, hp low.
- [ ] 5.8 `mood(st)` in `core/stages/grow.js`: rest, a wave, a late wave or hp low; `boss` for the big germ.
- [ ] 5.9 `mood(st)` in `core/stages/answer.js`: by combo; level 2 brings the shout chorus.
- [ ] 5.10 `mood(st)` in `core/stages/turn.js`: by swarm size.
- [ ] 5.11 `mood(st)` in `core/stages/birth.js`: by wave, with `tempo` from 1 to 1.12.
- [ ] 5.12 `music.setMood` every 100 ms; a level rises at once and falls only after about 4 s of calm; the thresholds recorded in each stage's tune file.
- [ ] 5.13 Stingers from the run's events: the cue's `end` then the grade at a stage end; `ko` at a knock-out; `boss` as a boss arrives; `gift` for a gift picked (stage 3) and a pool found (stage 4); `gate` and `item` in stage 1.
- [ ] 5.14 Stage 6: `music.sync(run.beats(now, now + 1.0, "mother").map(toCtx))` each tick.
- [ ] 5.15 The ending: `light` at birth's end, no score note from the white to the cry, `warm` after the cry, the lullaby on the run result.
- [ ] 5.16 The Music setting: a switch next to Sound in `ui/screens.js`, its label in `core/text.js`, saved with the settings (on by default), applied with `music.setEnabled`.
- [ ] 5.17 Music captions: `music.<cue>` strings in `core/text.js` (design 7), one line when a stage's cue starts with captions and Music on, through `ui/captions.js` without cutting a fact.
- [ ] 5.18 The music credit at the end of the Sources screen (design 8). `public/arcade/switch.js` needs no change: its `credits` field is a boolean for Crimson Rogue's end credits.
- [ ] 5.19 `window.__fb` exposes the music's `stats()` for the browser checks.

## 6. Checks

- [x] 6.1 Before integration, with the score, engine and samples in the tree: every `qa/first-breath/*.test.mjs` passes (engine builder's run), `sound.e2e.mjs` passes 51 checks and `boot.e2e.mjs` 264.
- [x] 6.2 The engine measurements of design 5.3, in Chromium with an OfflineAudioContext and a live context, from scratch scripts.
- [ ] 6.3 `qa/first-breath/music.e2e.mjs`: the score skips the womb filter; a mood change on a bar line within 5 ms; stage 6 downbeats within 10 ms; Sound off and Music off silence the score; the boot fetches no score file; blocked samples play the synth; a hidden page or pause schedules nothing; the mix peak below −1 dBFS; her beat onsets detectable; the score 6 LU under her heart at level 1; the ending silent from the white to the cry; a caption once per stage; the sample folder at 2 MB or less.
- [ ] 6.4 Updates to existing checks: `text.test.mjs` scans the music captions, the Music label and the credit; `pacing.test.mjs` sends the music captions; `save.test.mjs` keeps Music; `layout.e2e.mjs` finds the Music switch in three layouts; `screens.e2e.mjs` finds the credit; `perf.e2e.mjs` runs with the score playing.
- [ ] 6.5 After integration, all pass: every node test, `sound`, `smoke`, `boot`, `perf`, `input`, `layout`, `screens` and `visual` e2e checks, `qa/arcade/quiet.mjs` and `qa/arcade/machines.mjs`.
- [ ] 6.6 `openspec validate first-breath-score --strict` passes again after any spec change during integration.

## 7. Demos

- [x] 7.1 The engine builder's listening renders of every cue (8 s at level 0, 10 s at 1, 10 s at 2 with the boss) and the stingers, in the scratch folder (before the last gain changes).
- [x] 7.2 The composer's demo renders on an additive synth, the leitmotif solos and spectrograms, in the scratch folder.
- [ ] 7.3 `qa/first-breath/music-demo.mjs` renders every cue (10 s at level 0, 15 s at 1, 15 s at 2, with the boss where there is one) and every stinger through the real engine and samples to mp3 in `DEMO`.

## 8. Listening by a person

- [ ] 8.1 On a phone speaker: her heart is clear in every stage, the brass and the tunes read, the stage 6 lanes stay clear.
- [ ] 8.2 On speakers or headphones: the balance, the reverb, seamless loops, clean level changes, no clicks.
- [ ] 8.3 No cue or stinger sounds like a known theme (the list in contract rule 1).
- [ ] 8.4 The ending feels calm, and the knock-out chord does not sound sad.
- [ ] 8.5 Record what was heard in `design.md` 10 and adjust gains (4.5).

## 9. Pull request

- [ ] 9.1 The pull request lists what changed, the music credit, the checks run and their results, and states plainly whether a person has listened on a phone and on speakers; it includes screenshots of Settings with the Music switch at 390 × 844, 844 × 390 and 1440 × 900.
- [ ] 9.2 The lead commits, publishes and merges as the user asks.

## 10. Archive

- [ ] 10.1 After the merge, archive `first-breath-action-genres` first if it is still open (both changes touch `first-breath-presentation` and `first-breath-journey`; their changed requirements do not overlap), then this change.
- [ ] 10.2 Review `openspec/specs/first-breath-*/spec.md` after the archive: the score requirements are in, "Womb sound", "Sound follows the arcade" and "The Sources screen" read as modified, and nothing from the action-genres change was lost.
