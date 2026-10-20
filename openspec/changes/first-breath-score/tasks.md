# Tasks

Owners are in `contract.md` ("Files"). The composer owns `core/music/` and `qa/first-breath/music.test.mjs`; the engine
builder owns `ui/music.js`, `audio/score/`, the `ui/sound.js` hook and `qa/first-breath/fetch-score-samples.mjs`; the
integrator owns `main.js`, `ui/screens.js`, `ui/captions.js`, `core/text.js`, each stage's `mood`, the Sources credit,
`qa/first-breath/music.e2e.mjs` and `qa/first-breath/music-demo.mjs`. After integration a verifier fixed faults in
`ui/music.js`, `main.js` and the checks, and a music critic worked in `core/music/` and `music.test.mjs`. Then two
agents closed the gaps in parallel (the game fixes: 4.5, 5.20 to 5.23; the checks: 6.4, 6.7), and a final verifier
checked the combined tree (1.5, 3.13, 6.8, 7.4). Section numbers refer to `design.md`. A task is ticked only when its
work and its checks are done.

## 1. Contract and plan

- [x] 1.1 `contract.md`: the style, the rules, the file owners, the score data format, the engine API, the integration plan and the checks.
- [x] 1.2 `proposal.md`, `design.md`, `tasks.md` and the spec deltas; `openspec validate first-breath-score --strict` passes.
- [x] 1.3 The lead decided: `contract.md` stays as the record the builders worked from, and its three wrong facts (the episode's composer credit, the arcade `credits` field, the FluidR3 license) are corrected in design 9.3 only.
- [x] 1.4 `design.md` and `tasks.md` brought in line with the code as built, after the verifier and the critic. The journey spec's Music setting now says "saved for the next visit" and names `music.e2e.mjs` alone, since Music is saved outside `core/save.js` (design 9.4).
- [x] 1.5 The spec brought in line with the design as built (the final verifier): the cue requirement and "The cue follows the stage" (within two bars, on a bar line of the old cue, stage 6's on her first beat after it, the old cue's button once at the overlay on a beat and not again at the change) and "A grade at the stage end" (the button on the next beat), since the button plays at the overlay (design 9.1.6) and a stinger lands on the next beat; the stingers requirement's gift rule (5.22); the music caption waits its turn (5.21), with a new scenario, "Every stage names its music". `design.md` updated for her heart at −19.8 LUFS, the trim and the new level 1 table, the caption, the gift and win rules, and the check map (11); `openspec validate first-breath-score --strict` passes.

## 2. Samples

- [x] 2.1 `qa/first-breath/fetch-score-samples.mjs` downloads, trims, levels and encodes the samples; a second run gives byte-identical files; `--cache`, `--only` and `--kbps` work.
- [x] 2.2 165 mono mp3 files at 44.1 kHz, about 48 kbps, attack at 0, faded at the end, one every 4 semitones plus the top of each range, with the extra upright bass set: 1,473 KB, under the 2 MB limit.
- [x] 2.3 `audio/score/manifest.json` with each instrument's gain from EBU R128, and `audio/score/README.md` with the source, the CC BY 3.0 license and its link, what was changed and how to rebuild.
- [x] 2.4 Frank Wen's MIT notice for FluidR3_GM (© 2000-2002, 2008), from Debian's copyright file, in `audio/score/README.md`, and the manifest's `license` naming both licenses (the lead; design 8).

## 3. Engine (`ui/music.js`)

- [x] 3.1 `createMusic` with the contract's API (`load`, `cue`, `setMood`, `sting`, `sync`, `tick`, `setEnabled`, `stats`) and the extras in design 9.1; `ctx` may be null.
- [x] 3.2 The sampler: the nearest sample, `playbackRate` within 2 semitones, an envelope per note, a crossfaded loop for long notes; pitch within ±20 cents on every pitched instrument.
- [x] 3.3 Drums made in code: kick, snare, hat, ride, crash, roll and brush, all sounding with the measured spectra (design 5.3).
- [x] 3.4 A synth stand-in per instrument family, in tune and at about the samples' level, playing until the samples load and for any instrument whose samples fail.
- [x] 3.5 The score bus: cue gain, duck gain, stinger gain, a convolution reverb from seeded noise (1.6 s, wet 0.18), the Music gain, into `dest`.
- [x] 3.6 The scheduler: 150 ms plus the latency per tick, heard times, late notes dropped; cue and mood changes on bar lines, a boss on the next beat, tempo on a bar line; stingers on the next beat, in the cue's key, queued; the old cue's button on a cue change; `cue(null)` fades over a bar.
- [x] 3.7 Stage 6: `sync` sets the grid from her laid beats; downbeats on her beats (0 ms with beats given 1 s ahead).
- [x] 3.8 At most 48 voices sounding, the oldest released first, a dying one before a held one; `stats()` with the contract's fields and the extras (design 2.8, as fixed in 3.12).
- [x] 3.9 Nothing scheduled while the page is hidden, the context is suspended or Music is off; each resumes on a new bar line; Music off is silent within 0.35 s; `tick()` averages 0.09 ms.
- [x] 3.10 `ui/sound.js`: the `scoreIn` gain after the mute and pause, outside the womb filters; `sound.scoreDest()`. The integrator added a 1 dB trim after the limiter, so the mix peaks under −1 dBFS (design 2.1).
- [x] 3.11 A short hush for the ending: `fadeOut(seconds)` stops the cue at once and fades every voice, the stingers' too (design 2.5, 9.1).
- [x] 3.12 The verifier's fixes, each with a check in `music-engine.test.mjs` (15 checks) or `music.e2e.mjs`: the voice cap counts only sounding voices; nodes are freed only when all of a voice's sources end, and the crash's metal loops; one 1e-9 window edge; a resync when Music comes back on; a cue that has not sounded yet is replaced at once; `sync(times, from, to)`; the late start for a cue whose downbeat passed; the samples load only with Music on; a cancelled fade rises from where it was (design 2.7, 2.8, 9.1).
- [x] 3.13 A cue asked for while stopped (a stage begun with Music off) takes the mood when its first bar is laid, so its first bar plays the level the stage's mood gives, not the one from when it was asked (the final verifier; a check in `music-engine.test.mjs`, 18 checks, that fails on the old engine, and the live check in `music.e2e.mjs`; design 2.7, 9.1.19).

## 4. Composition (`core/music/`)

- [x] 4.1 `theory.js` and `kit.js`: chord charts, melody notation, walking bass, close brass voicing, a four-part voice-leader, stabs, arpeggios, ostinatos, glissandos, drum patterns, layer and section builders; the leitmotif.
- [x] 4.2 Ten cues (design 3) with intros, loops, levels 0 to 2 (the title 0 and 1), boss layers in `egg` and `grow`, `sync: "mother"` for `answer`, and keys, tempos and ducks.
- [x] 4.3 Twelve stingers: the contract's ten, plus `light` and `warm` (design 3.1).
- [x] 4.4 `qa/first-breath/music.test.mjs` passes (18 checks from the composer, 24 after the critic); `purity.test.mjs` passes 26.
- [x] 4.5 The heart rule: one trim at the score's input, `SCORE_DB = −2.5` in `ui/sound.js`, so `mix.js` keeps its shape. Her heart alone measures −19.8 to −20.2 LUFS (not −19), so the cues sat only 4.3 to 5.5 LU under; with the trim, 6.7 to 8.0 LU (design 2.1), and `music.e2e.mjs` measures 7.8 LU in stage 1. Her heart's room over the score at level 2 is now 10.4 dB at least (`grow` with the boss). Any change after listening is 8.5.
- [x] 4.6 The critic's pass: six tunes rewritten for originality, more of the idiom's gestures, `closeChord` keeping the top note asked for, the title on levels 0 and 1 only, and the mix in `mix.js`, with six more checks in `music.test.mjs` (design 1.4, 3.2).

## 5. Integration (`main.js` and the rest)

- [x] 5.1 On the Play tap, after `sound.start()`, the music is built into `sound.scoreDest()` with the run's seed; `music.load()` after the stage starts, with Music on; the boot fetches no score file. The engine and the score are imported statically, not with `import()` (design 2.9).
- [x] 5.2 `music.tick(audioCtx.currentTime)` from the 25 ms sound timer, before `scheduleSound`'s early return on the title.
- [x] 5.3 Cues: the overture on the title, Stages, Settings and Sources once the sound has started; each stage's cue at its `stageStart`; the overlay, the Almost card and the card keep the cue at level 0; the next cue built at the card; a new run fades the last run's music.
- [x] 5.4 `mood(st)` in `core/stages/swim.js`: cruising, in the pack, a gate closing or the tide near (design 4).
- [x] 5.5 `mood(st)` in `core/stages/egg.js`: by pattern density; `boss` during the swarm.
- [x] 5.6 `mood(st)` in `core/stages/split.js`: a room's start, germs in the room, many germs or the Knot.
- [x] 5.7 `mood(st)` in `core/stages/root.js`: exploring, germs near, hp low.
- [x] 5.8 `mood(st)` in `core/stages/grow.js`: rest, a wave, a late wave or many germs; `boss` for the big germ.
- [x] 5.9 `mood(st)` in `core/stages/answer.js`: by combo; level 2 brings the shout chorus.
- [x] 5.10 `mood(st)` in `core/stages/turn.js`: by swarm size; `boss` for the Big Germ.
- [x] 5.11 `mood(st)` in `core/stages/birth.js`: by wave, with `tempo` from 1 to 1.12.
- [x] 5.12 `music.setMood` every 100 ms; a level rises at once and falls only after 2.5 s of calm (design 4, 9.4).
- [x] 5.13 Stingers from the run's events: the cue's `end` then the grade at a stage end; `ko` at a knock-out and stage 1's rest; `boss` as a stage's mood turns boss; `gift` for a gift taken (stage 3) and a pool you link (stage 4); `gate` and `item` in stage 1; `win` at `act.win` (design 3.1).
- [x] 5.14 Stage 6: `music.sync(run.beats(now − 0.5, now + 1.0, "mother").map(toCtx), from, to)` each tick (design 2.4).
- [x] 5.15 The ending: `light` at birth's light, then `fadeOut` before the light ends; no score note from the white to the cry; `warm` 0.9 s after the cry; the lullaby on the run result.
- [x] 5.16 The Music setting: a switch right after Sound in `ui/screens.js`, its label in `core/text.js`, on by default, saved under `first-breath.music` (design 9.4), applied with `music.setEnabled`.
- [x] 5.17 Music captions: `music.<cue>` strings in `core/text.js` (design 7), offered once per stage within 12 s of its start when the caption line is free, so they never cut a fact.
- [x] 5.18 The music credit at the end of the Sources screen, with its links (design 8). `public/arcade/switch.js` and `qa/arcade/machines.mjs` are as on main: the lead reverted the integrator's credit string and the verifier's matching check change.
- [x] 5.19 `window.__fb.music` exposes the music's `stats()` plus `want` and `setting`, and `__fb.sound.times` her scheduled beats, for the browser checks.
- [x] 5.20 The mood thresholds stay literals in each `mood()`, on purpose: they set only the music, so they sit beside the state they read. Each `mood()` comment names them (design 4, 9.4).
- [x] 5.21 The music caption is a sound's caption that must show (`captions.say(…, { kind: "cue", wait: true })`): on a busy line it waits its turn instead of being dropped, cuts nothing, stays 1.2 s while a fact waits and 2.5 s on a free line, and `drop(id)` removes it when Music or the sound goes off (design 7). `pacing.test.mjs` (26 checks) checks every stage but the ending in every bot, seed, layout and mode; `captions.test.mjs` (9) checks the waiting caption and `drop()`. In a real-time browser run every stage showed its caption once.
- [x] 5.22 `root` plays `gift` on the first pool you link and on the last of the pools when you link it, from the new pure `core/music/wiring.js` (`stingsFor`, `stingMemory`), which `main.js` now calls; `music-engine.test.mjs` counts it over bot runs (design 3.1). Listening may still change it (8.5).
- [x] 5.23 `turn` plays `win` once, at the Big Germ's pop, and none at the clear (none at all when the Big Germ is not popped), from `wiring.js`; `music-engine.test.mjs` counts it over bot runs (design 3.1).

## 6. Checks

- [x] 6.1 Before integration, with the score, engine and samples in the tree: every `qa/first-breath/*.test.mjs` passes (engine builder's run), `sound.e2e.mjs` passes 51 checks and `boot.e2e.mjs` 264.
- [x] 6.2 The engine measurements of design 5.3, in Chromium with an OfflineAudioContext and a live context, from scratch scripts.
- [x] 6.3 `qa/first-breath/music.e2e.mjs` passes 53 checks: the score skips the womb filter; a mood change on a bar line within 5 ms; stage 6's downbeats within 10 ms offline and live; Sound off and Music off silence the score; the mix peak below −1 dBFS; her heartbeat detectable over every cue at level 2; the boot fetches no score file, nor the Play tap with Music off; blocked samples play the synth; a hidden page schedules nothing; the cue's opening kept at the Play tap; the Music switch next to Sound, on by default, saved and still off after a reload; the end stinger, then the grade; stage 1's caption once; the ending silent from the white to the cry, then the warm chord; the lullaby on the result and the overture over it. What it does not check yet is in 6.7.
- [x] 6.4 Updates to existing checks. `text.test.mjs` scans the music captions, the Music label and the credit (its scan covers every registered string); `pacing.test.mjs` sends the music captions and checks each stage shows its own (5.21). `layout.e2e.mjs` finds the Music switch by role and name at all three sizes, right after Sound, at least 44 px, overlapping nothing, with Tab's focus ring the same as Sound's (199 checks). `screens.e2e.mjs` checks Open Sources and the music credit, whose links open in a new tab and answer online (32). `perf.e2e.mjs` measures stage 5 with the boss and the score playing (181). `save.test.mjs` needs no change, since Music is saved outside `core/save.js` (design 9.4).
- [x] 6.5 After integration, all pass in the builders' runs: every node test (`sim.test.mjs` 98), and `sound` 51, `smoke` 226, `boot` 264, `perf` 175, `input` 102, `layout` 190, `screens` 24, `visual` 88 and `music` 53 in the browser, and `qa/arcade/quiet.mjs` 35 for First Breath. `qa/arcade/machines.mjs`: `switch.js` and `machines.mjs` are as on main again, and the verifier's partial runs found only failures that main has too (the switcher shows 27 of 38 tiles, `/lab/plunge/` and `/echo/` unmarked, a `createPattern` page error in Crimson's credits at 1280 × 720), outside this change.
- [x] 6.6 `openspec validate first-breath-score --strict` passes again after the spec change in 1.4.
- [x] 6.7 Every spec scenario names a check that tests it, except "A person listens" (8). New in `music.e2e.mjs` (it runs in parts with `ONLY=node,offline,live,stage2,run,moods`): the score 7.8 LU under her heart at level 1; the sample folder (1,517,968 bytes) and its README; a cue per stage in one run and no gap over 1 s through an overlay and card; the big germ's boss stinger and boss layer; birth's tempo in the page; a gate passed, with the duck; a knock-out in stage 5 with the cue at level 0 behind the Almost card; the shout chorus; Esc on desktop in stage 7; Music off and on with real taps; muted in the arcade. The CHECK lines that named a check which never tested them now name the one that does (presentation, arcade-machine and facts-and-tone specs).
- [x] 6.8 The final verification on the combined tree (design 11): every node test, `music`, `sound`, `boot`, `smoke`, `layout`, `screens`, `input`, `perf` and `visual` in the browser, and `qa/arcade/quiet.mjs` for First Breath, all pass. Fixes it made: 3.13; the spec text in 1.5 and the matching `music.e2e.mjs` checks (stage 6's beats read from her laid beats and its own notes, its cue on her first beat after the old cue's bar line).

## 7. Demos

- [x] 7.1 The engine builder's listening renders of every cue (8 s at level 0, 10 s at 1, 10 s at 2 with the boss) and the stingers, in the scratch folder (before the last gain changes).
- [x] 7.2 The composer's demo renders on an additive synth, the leitmotif solos and spectrograms, in the scratch folder.
- [x] 7.3 `qa/first-breath/music-demo.mjs` renders every cue (10 s at level 0, 15 s at 1, 15 s at 2, 12 s of the boss in `egg` and `grow`, birth's last 8 s at 1.12), the stage cues with her heart, and every stinger, through the real engine and samples to mp3 in `DEMO`; `MIX=0` renders the score alone. The critic's renders, after the mix, are the latest, in the scratch folder.
- [x] 7.4 The final demos on the combined tree (the 2.5 dB trim in): `music-demo.mjs` renders all 22 files.

## 8. Listening by a person

- [ ] 8.1 On a phone speaker: her heart is clear in every stage, the brass and the tunes read, the stage 6 lanes stay clear.
- [ ] 8.2 On speakers or headphones: the balance, the reverb, seamless loops, clean level changes, no clicks.
- [ ] 8.3 No cue or stinger sounds like a known theme (the list in contract rule 1 and the screen in design 12, with the Family Guy theme, Get Smart and Fantastic Voyage, which the screen could not compare).
- [ ] 8.4 The ending feels calm, and the knock-out chord does not sound sad.
- [ ] 8.5 Record what was heard in `design.md` 10, and change the score's trim (4.5), the gift (5.22) or the win (5.23) if listening says so.
- [ ] 8.6 On an older phone, a whole run plays through without the tab reloading and without audible gaps (decoded samples take about 42 to 46 MB, and a few notes drop under long main-thread stalls; design 10).

## 9. Pull request

- [ ] 9.1 The pull request lists what changed, the music credit, the checks run on the committed tree and their results, and states plainly whether a person has listened on a phone and on speakers; it includes screenshots of Settings with the Music switch at 390 × 844, 844 × 390 and 1440 × 900.
- [ ] 9.2 The lead commits, publishes and merges as the user asks.

## 10. Archive

- [ ] 10.1 After the merge, archive `first-breath-action-genres` first if it is still open (both changes touch `first-breath-presentation` and `first-breath-journey`; their changed requirements do not overlap), then this change.
- [ ] 10.2 Review `openspec/specs/first-breath-*/spec.md` after the archive: the score requirements are in, "Womb sound", "Sound follows the arcade" and "The Sources screen" read as modified, and nothing from the action-genres change was lost.
