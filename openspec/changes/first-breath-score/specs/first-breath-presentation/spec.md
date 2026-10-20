## ADDED Requirements

### Requirement: An original score in the Family Guy idiom
The game SHALL play an original orchestral score in the idiom of Family Guy's underscore: a studio orchestra with a big band inside it, played straight, as if the baby were the hero of a film. Brass stabs, rips and falls, timpani rolls, harp glissandos, swing in two stages and a short button at a cue's end SHALL carry the style. No melody SHALL quote or paraphrase an existing theme. One leitmotif SHALL return in the title, stage 1, stage 5 and the ending.

#### Scenario: Every cue has its own tune
- **GIVEN** the score data in `core/music/score.js`
- **WHEN** the first 8 melody notes of every cue are compared, counted from each cue's tonic
- **THEN** no two cues share them, and the leitmotif, with its rising fifth and its leap of a sixth, is in the title, swim, grow and ending cues
- **CHECK** `qa/first-breath/music.test.mjs`

#### Scenario: A person listens
- **GIVEN** the demo renders of every cue at each level and every stinger, made through the real engine and samples
- **WHEN** a person listens on a phone speaker and on speakers or headphones
- **THEN** it sounds like a cartoon film orchestra with real brass and strings, and no cue sounds like a known theme
- **CHECK** `qa/first-breath/music-demo.mjs`, then a person listens (tasks 8)

### Requirement: A cue for every screen and stage
Each stage, the title screens and the ending SHALL have their own cue: an overture, a spy chase, a siege march, a sneaky caper, an expedition, a full-orchestra battle, a big-band show number, a last stand, a great escape and a lullaby. A stage's cue SHALL start at the stage start, and a change of cue SHALL land on a bar line after the old cue's button. Through each overlay and card the cue SHALL play on at its lowest level, so no gap is longer than 1 s.

#### Scenario: The cue follows the stage
- **GIVEN** a run played by the reference bot with Music on
- **WHEN** each stage starts
- **THEN** the score's `stats().cue` is that stage's cue (`swim`, `egg`, `split`, `root`, `grow`, `answer`, `turn`, `birth`) within one bar, and the old cue's button played on the bar line where the new cue began
- **CHECK** `qa/first-breath/music.e2e.mjs`

#### Scenario: No silence between stages
- **GIVEN** stage 3 ending with Great
- **WHEN** the score is read from the stage's last second, through its overlay and the stage 4 card, to the first bar of stage 4
- **THEN** no gap between scheduled notes is longer than 1 s
- **CHECK** `qa/first-breath/music.e2e.mjs`

#### Scenario: Back on the title screens
- **GIVEN** a finished run, so the sound has started
- **WHEN** the player opens Stages from the run result
- **THEN** the overture starts on the next bar line
- **CHECK** `qa/first-breath/music.e2e.mjs`

#### Scenario: A cue for every id
- **GIVEN** the stage list in `core/stages/index.js`
- **WHEN** `cueFor` is asked for each stage id, each index from 0 to 8, "title" and "ending"
- **THEN** every stage has its own cue, index 8 and "ending" give the ending's cue, and "title" gives the overture
- **CHECK** `qa/first-breath/music.test.mjs`

### Requirement: The music rises with the action
Every stage cue SHALL have three layers that join as the stage's mood rises: level 0 when it is calm, 1 in the thick of it, 2 at its peak. Stages 2 and 5 SHALL add a boss layer while a boss is on. A level change SHALL land on the next bar line, a boss on the next beat, and stage 8's tempo SHALL rise by at most 12%, at a bar line. The bass and the harmony SHALL play on through every change.

#### Scenario: A gate closing ahead
- **GIVEN** stage 1 with the score at level 0
- **WHEN** the mood rises to level 2 as a gate starts to close ahead
- **THEN** the first level 2 note sounds on the next bar line, within 5 ms of it
- **CHECK** `qa/first-breath/music.e2e.mjs`

#### Scenario: Layers nest
- **GIVEN** each stage cue
- **WHEN** its notes are read at levels 0, 1 and 2, and with the boss on where it has one
- **THEN** each level holds every note of the level below it, and every level keeps the bass and the harmony playing
- **CHECK** `qa/first-breath/music.test.mjs`

#### Scenario: The big germ arrives
- **GIVEN** stage 5 at level 2
- **WHEN** the big germ comes in
- **THEN** the boss stinger plays, the choir and timpani of the boss layer join on the next beat, and the tunes rest while the boss is on
- **CHECK** `qa/first-breath/music.e2e.mjs`

#### Scenario: The waves of birth speed up
- **GIVEN** stage 8 at its first wave
- **WHEN** the run reaches the last wave
- **THEN** the cue's tempo has risen only at bar lines and is at most 1.12 times its start
- **CHECK** `qa/first-breath/music.e2e.mjs`

### Requirement: Stingers mark the big moments
Short stingers SHALL mark the big moments, on the playing cue's next beat and in its key: the grade fanfare after a stage's button (Good, Great and Glowing, each grander), a brass stab and a timpani roll as a boss arrives, a harp and bell flourish for a gift picked or a pool found, two bright brass notes at a gate passed, and a short brass rip for an item used. The cue SHALL duck under each stinger, and no stinger SHALL be dropped.

#### Scenario: A grade at the stage end
- **GIVEN** stage 3 ending with Great
- **WHEN** the overlay shows
- **THEN** the caper's button plays on its bar line, and the Great fanfare follows it in the caper's key
- **CHECK** `qa/first-breath/music.e2e.mjs`

#### Scenario: A gate passed
- **GIVEN** stage 1 with the score at level 1
- **WHEN** you pass Gate 1
- **THEN** two brass notes play on the next beat, and the cue's gain drops by its duck amount for the stinger's length
- **CHECK** `qa/first-breath/music.e2e.mjs`

#### Scenario: Grades grow and every key fits
- **GIVEN** the stingers in `core/music/score.js`
- **WHEN** Good, Great and Glowing are compared, and every stinger is moved into every cue's key
- **THEN** each grade has more notes and lasts at least as long as the one before, and every note stays in its instrument's range
- **CHECK** `qa/first-breath/music.test.mjs`

### Requirement: A knock-out settles softly
A knock-out SHALL never get a sad sting. As you curl up and rest, the score SHALL play a soft settling chord in low strings and horn, in the cue's key, with no drums, and the cue SHALL fall to its lowest level until the player picks Try again or Go on.

#### Scenario: Knocked out in the shooter
- **GIVEN** stage 5 with the score at level 2
- **WHEN** your last pip goes
- **THEN** the knock-out chord plays on the next beat with no drum in it, and behind the Almost card the cue plays at level 0
- **CHECK** `qa/first-breath/music.e2e.mjs`

#### Scenario: The chord is soft
- **GIVEN** the knock-out stinger
- **WHEN** its notes are read
- **THEN** it has no drum note and no note above velocity 0.35
- **CHECK** `qa/first-breath/music.test.mjs`

### Requirement: The heart stays audible over the score
The score SHALL leave room for her heartbeat and each stage's own sounds. At level 1 a cue SHALL sit at least 6 LU under her heart, her heartbeat onsets SHALL stay detectable over the score at every level, and the mix SHALL peak below −1 dBFS. In stage 6 the band SHALL keep out of the hum's register, MIDI 51 to 73, at levels 0 and 1, so the lane sounds stay clear.

#### Scenario: Her heart in the busiest moment
- **GIVEN** stage 5 at level 2 with the boss layer on
- **WHEN** 10 s of the whole mix is rendered with OfflineAudioContext
- **THEN** each of her beat onsets is found within 10 ms of its time in `run.beats()`, and the true peak is below −1 dBFS
- **CHECK** `qa/first-breath/music.e2e.mjs`

#### Scenario: Loudness at level 1
- **GIVEN** stage 1 at level 1
- **WHEN** her heart alone and the score alone are each rendered for 10 s and measured with EBU R128
- **THEN** the score is at least 6 LU under the heart
- **CHECK** `qa/first-breath/music.e2e.mjs`

#### Scenario: The hum's register
- **GIVEN** the stage 6 cue
- **WHEN** its notes at levels 0 and 1 are read
- **THEN** none lies between MIDI 51 and 73
- **CHECK** `qa/first-breath/music.test.mjs`

### Requirement: Stage 6 plays on her beat
In stage 6 the show number SHALL follow her heartbeat: two music beats to each of her beats, its grid set by her laid beats, so each downbeat lands on one of her beats within 10 ms. Its shout chorus SHALL come in only at a high combo and leave on a bar line when the combo falls.

#### Scenario: Downbeats on her beat
- **GIVEN** stage 6 with her beats laid at about 78 bpm with their natural jitter, given to the score at least 0.5 s ahead
- **WHEN** 20 s of the score is rendered
- **THEN** every downbeat is within 10 ms of one of her beats
- **CHECK** `qa/first-breath/music.e2e.mjs`

#### Scenario: The shout chorus
- **GIVEN** stage 6 with a low combo
- **WHEN** the combo rises to the stage's level 2 mark, and later breaks
- **THEN** the three-trumpet shout chorus joins on the next bar line, and leaves on a bar line after the break
- **CHECK** `qa/first-breath/music.e2e.mjs`

### Requirement: The ending stays calm
The ending SHALL stay tender, slow and soft. No score note SHALL sound from the ending's white until the first cry. After the cry the score SHALL play only one soft warm chord, under her heartbeat and her song. The lullaby, a solo horn singing the leitmotif in three over strings and harp, with no drums, SHALL play on the run result.

#### Scenario: The first breath in quiet
- **GIVEN** a run reaching the end of stage 8
- **WHEN** the ending plays with no input
- **THEN** no score note sounds from the white to the cry, the warm chord plays once after the cry, and no other score note sounds until the run result
- **CHECK** `qa/first-breath/music.e2e.mjs`

#### Scenario: The lullaby
- **GIVEN** the ending cue
- **WHEN** its notes are read
- **THEN** it is in 3 at 70 bpm or slower, has no drums and no note above velocity 0.6, a horn sings its tune, and it ends on the warm chord
- **CHECK** `qa/first-breath/music.test.mjs`

### Requirement: Music captions
With captions and Music on, a caption SHALL name the music once per stage when its cue starts, in plain words, such as "♪ spy-chase music". Music captions SHALL follow the banned words, so a working name such as "Battle" is never shown. A music caption SHALL NOT cut a fact or a sub-goal line. Stingers SHALL need no caption, since each marks a moment the screen already shows.

#### Scenario: One line per stage
- **GIVEN** stage 1 with captions and Music on at 390 × 844
- **WHEN** the stage starts and plays for 30 s
- **THEN** "♪ spy-chase music" shows once, in the caption band, and not again in the stage
- **CHECK** `qa/first-breath/music.e2e.mjs`

#### Scenario: Gentle words
- **GIVEN** every `music.<cue>` string in `core/text.js`
- **WHEN** the text test scans them with each of the four carer words
- **THEN** none has a banned word or an em dash
- **CHECK** `qa/first-breath/text.test.mjs`

#### Scenario: Facts still show whole
- **GIVEN** every stage played by the reference bot through the real captions, with the music captions sent
- **WHEN** the captions are recorded in portrait, landscape and desktop
- **THEN** every fact sent still shows whole
- **CHECK** `qa/first-breath/pacing.test.mjs`

### Requirement: The score loads after Play
The page SHALL fetch no score file before Play. The samples, at most 2 MB, SHALL load after the first stage has started, and the score SHALL play at once on a synth stand-in until they are ready. An instrument whose samples fail SHALL stay on the synth, with no error shown and no gap in the music.

#### Scenario: The boot fetches nothing
- **GIVEN** a fresh visit to `/first-breath/`
- **WHEN** the title shows and the player waits 5 s without tapping Play
- **THEN** no request has gone to `audio/score/`
- **CHECK** `qa/first-breath/music.e2e.mjs`, `qa/first-breath/boot.e2e.mjs`

#### Scenario: The samples are blocked
- **GIVEN** every request under `audio/score/` blocked
- **WHEN** the player taps Play and stage 1 runs for 10 s
- **THEN** the score plays on the synth, all 14 sampled instruments are listed in `stats().fallback`, and the console shows no error
- **CHECK** `qa/first-breath/music.e2e.mjs`

#### Scenario: The size and the license
- **GIVEN** the folder `public/first-breath/audio/score/`
- **WHEN** its files are summed and its README is read
- **THEN** they come to 2 MB or less, and the README names the source, the license and what was changed
- **CHECK** `qa/first-breath/music.e2e.mjs`

### Requirement: The score costs little
With the score playing, every stage SHALL keep its frame budgets. The score SHALL keep at most 48 live voices and SHALL steal only voices already fading. A note SHALL never sound late: one more than 20 ms late SHALL be dropped. The scheduler tick SHALL average 0.5 ms or less.

#### Scenario: The busiest moment
- **GIVEN** stage 5 at level 2 with the boss layer, at 390 × 844 with `?probe=1`
- **WHEN** 120 frames are measured after 3 s
- **THEN** the frame budgets hold, the score never has more than 48 live voices, no held note was cut, and the tick averages 0.5 ms or less
- **CHECK** `qa/first-breath/perf.e2e.mjs`, `qa/first-breath/music.e2e.mjs`

## MODIFIED Requirements

### Requirement: Womb sound
The game's own sounds SHALL be synthesized in one graph built on the Play tap against an injected AudioContext, with no audio files; only the score uses samples. Every source except the birth sounds and the score SHALL pass a womb low-pass bus. The voice SHALL be a sine hum. The mother's beat sounds SHALL come from the run's beat clock, so sound and picture agree and the beat does not jump at a stage start. The mother's heart SHALL include 2nd and 3rd harmonics so phone speakers carry it.

#### Scenario: Inside the womb
- **WHEN** 6 s of stage 1 audio from the sound graph alone, with no score, is rendered with OfflineAudioContext
- **THEN** at least 90% of the energy is below 500 Hz, and envelope peaks match the mother's beat times within 5 ms
- **CHECK** `qa/first-breath/sound.e2e.mjs`

#### Scenario: Two hearts
- **WHEN** 6 s after the stage 4 hinge is rendered
- **THEN** a second peak train at about 110 bpm sits under the mother's beat
- **CHECK** `qa/first-breath/sound.e2e.mjs`

#### Scenario: Across a stage change
- **WHEN** the audio from the end of a stage, through its overlay and card, into the next stage is rendered
- **THEN** the mother's beat peaks keep an even spacing within the rate glide, with no extra or missing beat
- **CHECK** `qa/first-breath/sound.e2e.mjs`

#### Scenario: The score skips the womb filter
- **GIVEN** stage 1 with the womb cutoff at 150 Hz and the score playing into `sound.scoreDest()`
- **WHEN** 6 s of the whole mix is rendered with OfflineAudioContext
- **THEN** the mix has clear energy above 1 kHz from the score, while the womb bus alone keeps at least 90% of its energy below 500 Hz
- **CHECK** `qa/first-breath/music.e2e.mjs`

#### Scenario: Mute silences the score
- **GIVEN** stage 1 with the score playing
- **WHEN** the sound is muted
- **THEN** the score falls silent with the rest, because it joins the master after the mute
- **CHECK** `qa/first-breath/music.e2e.mjs`
