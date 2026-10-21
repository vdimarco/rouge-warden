# GTA missions gauntlet

Loop: keep making NORD (the GTA row) clearer, more playable and more fun. Focus group: playability. Reference: GTA 6. Rubric: [RUBRIC.md](RUBRIC.md).

Unreal is not available here, so the native diamond was not captured. The title and the play client were loaded. Job choice is covered by `Scripts/test_job_rules.py` (126 assertions, 0 failures). A round that fails that test or the syntax check is reverted.

### Baseline — 2026-10-21 — rubric v1

- What changed: Nothing. Re-score of the build before round 1, for rubric v1.
- Why it helped: Gives round 1 a number to move.
- Screenshots: none. The round 1 shots are this same shell.
- Next target: mission clarity (2), the lowest playability score.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 3 | A sky, weather clock and worklight exist; streets are not a lit city. |
| Color palette | 5 | Ink, gold and paper stay consistent from the title badge through the HUD. |
| Detail density | 3 | Park fronts carry balconies and stairs; most other blocks are still plain boxes, and one tree repeats. |
| Texture and material quality | 3 | Some greystone and slate are in the apply step; many surfaces are flat comic fills. |
| Composition and camera | 4 | The chase camera and compact radar leave the street readable; a phone still watches a streamed frame. |
| Atmosphere | 4 | The festival premise, weather and comic captions give the park a mood; the city is not alive at GTA scale. |
| Character models | 3 | Eight crew styles read as people; hands and faces are still coarse. |
| Animation smoothness | 3 | Sprint, jump and comic tumbles exist; locomotion is not a full performance set. |
| Particles and VFX | 2 | Ink, a plunger tug and a hit flash cover the action; ambient effects are almost absent. |
| UI polish | 4 | The mission card, stars and banners are readable; French and English share the screen, and touch hid the retry. |
| Responsiveness and input latency | 3 | Play is a stream; phone steering was rebuilt for late input and is still late. |
| Controls feel | 4 | Graded steering, WASD and aim assist are in; driving is still the hard part. |
| Mission clarity | 2 | The story diamond is clear; after it the card said you were done, and side jobs stayed off the radar past 100 m. |
| Pacing | 3 | Two short story beats, then free roam with nothing pointing at the next job. |
| Fun factor | 4 | The terrace rescue and the lap have a trick and a joke; the side jobs are a delivery, a ram, a fight and an escape. |
| Difficulty curve | 4 | Mission 1 teaches the plunger, then the lap and the three-star escape step up; phone delivery timing is unproven. |
| Feedback | 4 | Mission-complete banners, wanted stars, a hit flash and comic sound words mark the hits. |
| Sound design | 3 | Stingers and a music selector exist; the city is not scored and nobody is voiced. |
| Variety | 3 | Two of eight story missions, four side jobs, and fists through a shotgun. |
| Performance stability | 4 | The six static scenes meet the frame budget; driving, co-op and the stream are not proven. |

- Aesthetics raw: 34 / 10 dimensions, index 34
- Playability raw: 34 / 10 dimensions, index 34
- Total: 68 / 200
- Delta vs last round: —

### Round 1 — 2026-10-21 — rubric v1

- What changed: After both story scenes, the mission card and the existing gold diamond name the nearest unfinished side job, with distance. A running job puts its objective, timer and restart hint on that card. A finished set points at the nearest replay. During the story the campaign objective keeps the diamond. On touch, MISSION RATÉE says Menu · Recover. Keyboard still says R réessaie.
- Why it helped: From the terrace the nearest job is about 199 m away, and from the spawn about 308 m, so the old 100 m radar dots never showed a job. The card also used to say the story was over while a side job was running. A phone player who failed had no retry line, because that line only named the R key.
- Screenshots: title `docs/gauntlet/gta-missions/r1-title-1280.png`, `r1-title-390.png`, `r1-title-320.png`. Play client, host offline, `r1-play-1280.png`. Menu with Recover `r1-play-menu-390.png`. No native before/after: Unreal is not in this container.
- Next target: variety (3), tied with responsiveness, pacing and sound. Variety is the one this loop can raise: the story still stops at mission 2 of 8.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 3 | Unchanged. Sky and worklight only. |
| Color palette | 5 | Unchanged. The new card uses the same gold and paper. |
| Detail density | 3 | Unchanged. |
| Texture and material quality | 3 | Unchanged. |
| Composition and camera | 4 | Unchanged. The diamond sits in the radar the story already used. |
| Atmosphere | 4 | Unchanged. |
| Character models | 3 | Unchanged. |
| Animation smoothness | 3 | Unchanged. |
| Particles and VFX | 2 | Unchanged. |
| UI polish | 4 | The card is clearer, and touch and keyboard now disagree less about retry; the mixed-language HUD remains. |
| Responsiveness and input latency | 3 | Unchanged. Still a lagged stream. |
| Controls feel | 4 | Unchanged. |
| Mission clarity | 4 | After the story the card names the next job, the diamond and the distance; touch failures name Menu · Recover. There is still no route line, and the story still stops at two missions. |
| Pacing | 3 | Finding a job is no longer a search; the session still ends the story after two beats. |
| Fun factor | 4 | Unchanged. The jobs are easier to start, not yet more fun to play. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | Unchanged. The failure line is clearer; the hits feel the same. |
| Sound design | 3 | Unchanged. |
| Variety | 3 | Unchanged. Still two story missions and four side jobs. |
| Performance stability | 4 | Unchanged. |

- Aesthetics raw: 34 / 10 dimensions, index 34
- Playability raw: 36 / 10 dimensions, index 36
- Total: 70 / 200
- Delta vs last round: +2 (baseline 68). Mission clarity 2 → 4. Every other score held.

![GTA title at 1280](gta-missions/r1-title-1280.png)

![GTA title at 390](gta-missions/r1-title-390.png)

![GTA title at 320](gta-missions/r1-title-320.png)

![Play client at 1280, host offline](gta-missions/r1-play-1280.png)

![Menu on a 390-wide screen, Recover visible](gta-missions/r1-play-menu-390.png)

### Round 2 — 2026-10-21 — rubric v1

- What changed: After the lap is banked, the mission card and the gold diamond lead mission 3, Still Life, Moving Target, along the north shore. The player tags the beam that never blinks, moves the worklight through a near lock and a far lock, sprints the opened path, and pulls the picnic clamp. The picnic is session state: the v1 save still stores CompletedMissions 0–2, and a reloaded finish offers the pond again. While it is open, side jobs and race replay wait. R, or Menu · Recover on touch, restores the current step and does not rewind it. Once the picnic is banked, the round 1 side-job guide returns.
- Why it helped: The story stopped at mission 2 of 8, so variety and pacing both sat on "two beats, then free roam." A third beat with a watch, a wrong answer, a route change and a sprint sits between the lap and the side jobs.
- Screenshots: title `docs/gauntlet/gta-missions/r2-title-1280.png`, `r2-title-390.png`, `r2-title-320.png`. Play client, host offline, `r2-play-1280.png`. Menu with Recover `r2-play-menu-390.png`. The title loaded with no page errors. The raw play page still logs the missing `@epicgames-ps/lib-pixelstreamingfrontend-ue5.8` specifier; the shell and the Recover button still draw. No native pond capture: Unreal is not in this container. `Scripts/test_pond_rules.py` reports 373 assertions, 0 failures, on c++, g++ and clang++. `Scripts/test_job_rules.py` still reports 126 assertions, 0 failures. Syntax check `--both` passed for the campaign, the HUD, side jobs and the race-result test.
- Next target: sound design (3), tied with responsiveness. Responsiveness is the stream. This loop can put a cue on the pond beats.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 3 | Unchanged. Sky and worklight only. |
| Color palette | 5 | Unchanged. The pond posts use the same ink, gold, cream, lime and berry. |
| Detail density | 3 | Unchanged. The new posts are a few comic primitives on the north shore. |
| Texture and material quality | 3 | Unchanged. |
| Composition and camera | 4 | Unchanged. The diamond is the one the story already used. |
| Atmosphere | 4 | Unchanged. The postcard copy is in the card; the shore was not played. |
| Character models | 3 | Unchanged. |
| Animation smoothness | 3 | Unchanged. |
| Particles and VFX | 2 | Unchanged. The blink is a post turning on and off. |
| UI polish | 4 | The card names mission 3, and touch says Menu · Recover. French and English still share the screen. |
| Responsiveness and input latency | 3 | Unchanged. Still a lagged stream. |
| Controls feel | 4 | Unchanged. The dash uses the existing sprint. |
| Mission clarity | 4 | The card names the current pond step and the diamond marks it. There is still no route line, and the native card was not seen. |
| Pacing | 4 | A third story beat now sits between the lap and free roam. |
| Fun factor | 4 | The peel, the wrong beam and the irritated picnic are written. They were not played, so the feel score stays. |
| Difficulty curve | 4 | Unchanged. The new step is a short puzzle in front of the same side jobs. |
| Feedback | 4 | Unchanged. The pond reuses the checkpoint and complete cues. |
| Sound design | 3 | Unchanged. Those cues are the same three one-shots. |
| Variety | 4 | Three of eight story missions are now in the build, plus the four side jobs. The pond was not played in Unreal. |
| Performance stability | 4 | Unchanged. |

- Aesthetics raw: 34 / 10 dimensions, index 34
- Playability raw: 38 / 10 dimensions, index 38
- Total: 72 / 200
- Delta vs last round: +2 (round 1 was 70). Pacing 3 → 4. Variety 3 → 4. Every other score held.

![GTA title at 1280](gta-missions/r2-title-1280.png)

![GTA title at 390](gta-missions/r2-title-390.png)

![GTA title at 320](gta-missions/r2-title-320.png)

![Play client at 1280, host offline](gta-missions/r2-play-1280.png)

![Menu on a 390-wide screen, Recover visible](gta-missions/r2-play-menu-390.png)

### Round 3 — 2026-10-21 — rubric v1

- What changed: During mission 3's tag step, the local player hears a short original tick whenever the decoy beams change state. Tagging a blinking beam plays the existing dialogue cue. The neighborhood and race loops are unchanged.
- Why it helped: The puzzle is "which beam never blinks," and that blink was silent. The tick gives the watch a rhythm. A miss sounds like dialogue, not like the blink.
- Screenshots: title `docs/gauntlet/gta-missions/r3-title-1280.png`, `r3-title-390.png`, `r3-title-320.png`. Play client, host offline, `r3-play-1280.png`. Menu with Recover `r3-play-menu-390.png`. The title loaded with no page errors. The raw play page still logs the missing `@epicgames-ps/lib-pixelstreamingfrontend-ue5.8` specifier; the shell and Recover still draw. The tick was not heard: Unreal is not in this container. `Scripts/test_pond_rules.py` reports 385 assertions, 0 failures, on c++, g++ and clang++. Syntax check `--both` passed for the controller, the campaign and the music tests.
- Next target: responsiveness and input latency (3), now the only playability score at 3. It is the stream. This loop should not invent a stream fix to move that number.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 3 | Unchanged. Sky and worklight only. |
| Color palette | 5 | Unchanged. |
| Detail density | 3 | Unchanged. |
| Texture and material quality | 3 | Unchanged. |
| Composition and camera | 4 | Unchanged. |
| Atmosphere | 4 | Unchanged. The shore still was not played. |
| Character models | 3 | Unchanged. |
| Animation smoothness | 3 | Unchanged. |
| Particles and VFX | 2 | Unchanged. The blink is still a post turning on and off. |
| UI polish | 4 | Unchanged. |
| Responsiveness and input latency | 3 | Unchanged. Still a lagged stream. |
| Controls feel | 4 | Unchanged. |
| Mission clarity | 4 | Unchanged. The tick marks the blink; the card is still one line and was not seen in Unreal. |
| Pacing | 4 | Unchanged. |
| Fun factor | 4 | Unchanged. The tick was not heard in play. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | The blink now has a tick and a wrong tag has the dialogue cue. The hits still use the same three one-shots, and none of this was heard. |
| Sound design | 4 | The tag step ticks with the decoys. The city still has two loops, and nobody is voiced. |
| Variety | 4 | Unchanged. Three of eight story missions. |
| Performance stability | 4 | Unchanged. |

- Aesthetics raw: 34 / 10 dimensions, index 34
- Playability raw: 39 / 10 dimensions, index 39
- Total: 73 / 200
- Delta vs last round: +1 (round 2 was 72). Sound design 3 → 4. Every other score held.

![GTA title at 1280](gta-missions/r3-title-1280.png)

![GTA title at 390](gta-missions/r3-title-390.png)

![GTA title at 320](gta-missions/r3-title-320.png)

![Play client at 1280, host offline](gta-missions/r3-play-1280.png)

![Menu on a 390-wide screen, Recover visible](gta-missions/r3-play-menu-390.png)

### Round 4 — 2026-10-21 — rubric v1

- What changed: After the picnic is banked, mission 4 Match Pointless leads on the mapped exhibition court. Score the gold panel once (it restarts the rally), bank the ball into the return gate while the ink is off the line, then pull the clamp. The court is session state. The v1 save still stores CompletedMissions 0–2. Side jobs and T wait until the clamp is banked. R restores the current rally and does not rewind it.
- Why it helped: Variety was tied at the bottom of the scores this loop can move. The story stopped at mission 3 of 8, and the picnic handed the player straight to side jobs. The gold panel teaches the loop; the bank is a timing window the ink can spoil.
- Screenshots: title `docs/gauntlet/gta-missions/r4-title-1280.png`, `r4-title-390.png`, `r4-title-320.png`. Play client, host offline, `r4-play-1280.png`. Menu with Recover `r4-play-menu-390.png`. The title loaded with no page errors. The raw play page still logs the missing `@epicgames-ps/lib-pixelstreamingfrontend-ue5.8` specifier; the shell and Recover still draw. No native court capture: Unreal is not in this container. `Scripts/test_court_rules.py` reports 133 assertions, 0 failures, on c++, g++ and clang++. `Scripts/test_pond_rules.py` still reports 385 assertions, 0 failures. `Scripts/test_job_rules.py` still reports 126 assertions, 0 failures. Syntax check `--both` passed for the campaign, the HUD, side jobs and the race-result test. OpenSpec CLI is not installed, so `openspec validate` did not run.
- Next target: fun factor (4), tied with controls, mission clarity, pacing, feedback, sound and performance. Responsiveness stays at 3 and stays out of scope. This loop should put a played payoff on the bank shot, or open mission 5, rather than touch the stream.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 3 | Unchanged. Sky and worklight only. |
| Color palette | 5 | Unchanged. The court posts use the same ink, gold, cream, lime and berry. |
| Detail density | 3 | Unchanged. The new posts are a few comic primitives on one court. |
| Texture and material quality | 3 | Unchanged. |
| Composition and camera | 4 | Unchanged. The diamond is the one the story already used. |
| Atmosphere | 4 | Unchanged. The exhibition copy is in the card; the court was not played. |
| Character models | 3 | Unchanged. |
| Animation smoothness | 3 | Unchanged. The ball steps between panels. It is not a rally. |
| Particles and VFX | 2 | Unchanged. The ink is a bar turning on and off. |
| UI polish | 4 | The card names mission 4, and touch says Menu · Recover. French and English still share the screen. |
| Responsiveness and input latency | 3 | Unchanged. Still a lagged stream. Out of scope for this loop. |
| Controls feel | 4 | Unchanged. Scoring is still E at a panel. There is no racket. |
| Mission clarity | 4 | The card names the gold trap and the return gate. The native card was not seen, and there is still no route line. |
| Pacing | 4 | Unchanged. A fourth beat exists on paper between the picnic and the side jobs. Its length was not played. |
| Fun factor | 4 | The absurd bank and the penalty on the light are written. They were not played, so the feel score stays. |
| Difficulty curve | 5 | The gold panel teaches the loop. The bank then adds a window the ink can close. The rules prove both a clear window and a dangerous one. |
| Feedback | 4 | The trap panel uses the dialogue cue. The bank and the pull reuse checkpoint and complete. None of it was heard. |
| Sound design | 4 | Unchanged. The city still has two loops and the pond tick. Nobody is voiced. |
| Variety | 5 | Four of eight story missions are now in the build, plus the four side jobs. The court was not played in Unreal. |
| Performance stability | 4 | Unchanged. |

- Aesthetics raw: 34 / 10 dimensions, index 34
- Playability raw: 41 / 10 dimensions, index 41
- Total: 75 / 200
- Delta vs last round: +2 (round 3 was 73). Difficulty curve 4 → 5. Variety 4 → 5. Every other score held.

![GTA title at 1280](gta-missions/r4-title-1280.png)

![GTA title at 390](gta-missions/r4-title-390.png)

![GTA title at 320](gta-missions/r4-title-320.png)

![Play client at 1280, host offline](gta-missions/r4-play-1280.png)

![Menu on a 390-wide screen, Recover visible](gta-missions/r4-play-menu-390.png)

### Round 5 — 2026-10-21 — rubric v1

- What changed: After the court is banked, mission 5 Standing Ovation leads on dry ground south of the west pond. Walk to the loading edge, set the followspot and hang the backdrop in either order, then call the curtain from that edge. The curtain reveals four comic panels. A local page sound plays once on that step. The show is session state. The v1 save still stores CompletedMissions 0–2. Side jobs and T wait until the curtain. R restores the current step and does not rewind a station that is already set.
- Why it helped: Fun was the tied target, and the story still stopped before the show the rescues were building toward. The either-order stations and the page turn are that show's joke. The page sound is the first payoff that is not one of the three cooked cues.
- Screenshots: title `docs/gauntlet/gta-missions/r5-title-1280.png`, `r5-title-390.png`, `r5-title-320.png`. Play client, host offline, `r5-play-1280.png`. Menu with Recover `r5-play-menu-390.png`. The title loaded with no page errors. The raw play page still logs the missing `@epicgames-ps/lib-pixelstreamingfrontend-ue5.8` specifier; the shell and Recover still draw. No native show capture: Unreal is not in this container. `Scripts/test_show_rules.py` reports 221 assertions, 0 failures, on c++, g++ and clang++. Court, pond and job rule tests still pass. Syntax check `--both` passed for the campaign, the controller, the race-result test and the music tests. OpenSpec CLI is not installed, so `openspec validate` did not run.
- Next target: fun factor (4), still tied with controls, mission clarity, pacing, sound and performance. Responsiveness stays at 3 and stays out of scope. The page is in the build, but it was not played, so the feel score waits. The next round should keep going into mission 6 rather than touch the stream.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 3 | Unchanged. Sky and worklight only. |
| Color palette | 5 | Unchanged. The show posts use the same ink, gold, cream, lime and berry. |
| Detail density | 3 | Unchanged. The new posts are a few comic primitives south of the pond. |
| Texture and material quality | 3 | Unchanged. |
| Composition and camera | 4 | Unchanged. The diamond is the one the story already used. |
| Atmosphere | 4 | Unchanged. The ovation copy is in the card; the show was not played. |
| Character models | 3 | Unchanged. |
| Animation smoothness | 3 | Unchanged. The page is posts appearing. |
| Particles and VFX | 2 | Unchanged. No new effect. The page is visibility. |
| UI polish | 4 | The card names mission 5, and touch says Menu · Recover. French and English still share the screen. |
| Responsiveness and input latency | 3 | Unchanged. Still a lagged stream. Out of scope for this loop. |
| Controls feel | 4 | Unchanged. The stations are still E. There is no followspot aim. |
| Mission clarity | 4 | The card names either station and then the loading edge. The native card was not seen, and there is still no route line. |
| Pacing | 4 | Unchanged. A fifth beat exists on paper between the court and the side jobs. Its length was not played. |
| Fun factor | 4 | The either-order rehearsal and the page turn are written. They were not played, so the feel score stays. |
| Difficulty curve | 5 | Unchanged. The new beat is a short choice in front of the same side jobs. |
| Feedback | 5 | The curtain plays a page sound that is not the pond tick and not one of the three cooked cues. It was not heard in Unreal. |
| Sound design | 4 | Unchanged. The city still has two loops. The page is one more procedural blip, and nobody is voiced. |
| Variety | 6 | Five of eight story missions are now in the build, plus the four side jobs. The show was not played in Unreal. |
| Performance stability | 4 | Unchanged. |

- Aesthetics raw: 34 / 10 dimensions, index 34
- Playability raw: 43 / 10 dimensions, index 43
- Total: 77 / 200
- Delta vs last round: +2 (round 4 was 75). Feedback 4 → 5. Variety 5 → 6. Every other score held.

![GTA title at 1280](gta-missions/r5-title-1280.png)

![GTA title at 390](gta-missions/r5-title-390.png)

![GTA title at 320](gta-missions/r5-title-320.png)

![Play client at 1280, host offline](gta-missions/r5-play-1280.png)

![Menu on a 390-wide screen, Recover visible](gta-missions/r5-play-menu-390.png)
