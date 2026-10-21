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

### Round 6 — 2026-10-21 — rubric v1

- What changed: A clear bank on mission 4 plays a short original whistle when the step moves from the return gate to the clamp. A bank spoiled by the ink, or taken before the ball is on the middle panel, stays on that step, increments a session-only miss count, and the local player hears a rasp. The miss count is not in the v1 save. The cooked cues, the pond tick, the page, and the music loops are unchanged.
- Why it helped: The bank was the mission's joke, and it answered with the same checkpoint cue as a walk-up. The whistle marks the shot that lands. The rasp marks the one the ink takes.
- Screenshots: title `docs/gauntlet/gta-missions/r6-title-1280.png`, `r6-title-390.png`, `r6-title-320.png`. Play client, host offline, `r6-play-1280.png`. Menu with Recover `r6-play-menu-390.png`. The title loaded with no page errors. The raw play page still logs the missing `@epicgames-ps/lib-pixelstreamingfrontend-ue5.8` specifier; the shell and Recover still draw. The whistle and the rasp were not heard: Unreal is not in this container. `Scripts/test_court_rules.py` reports 144 assertions, 0 failures, on c++, g++ and clang++. Syntax check `--both` passed for the campaign, the controller, the race-result test and the music tests. OpenSpec CLI is not installed, so `openspec validate` did not run.
- Next target: fun factor (4), still tied with controls, mission clarity, pacing, sound and performance. Responsiveness stays at 3 and stays out of scope. The whistle was not played, so the feel score waits. The next round should open mission 6 rather than touch the stream.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 3 | Unchanged. |
| Color palette | 5 | Unchanged. |
| Detail density | 3 | Unchanged. |
| Texture and material quality | 3 | Unchanged. |
| Composition and camera | 4 | Unchanged. |
| Atmosphere | 4 | Unchanged. The court was not played. |
| Character models | 3 | Unchanged. |
| Animation smoothness | 3 | Unchanged. |
| Particles and VFX | 2 | Unchanged. |
| UI polish | 4 | Unchanged. |
| Responsiveness and input latency | 3 | Unchanged. Still a lagged stream. Out of scope for this loop. |
| Controls feel | 4 | Unchanged. The bank is still E at the gate. |
| Mission clarity | 4 | Unchanged. The card already named the gate. The sounds were not heard in play. |
| Pacing | 4 | Unchanged. |
| Fun factor | 4 | The penalty on the light now has a whistle on paper. It was not played, so the feel score stays. |
| Difficulty curve | 5 | Unchanged. The ink window was already there. The rasp names a miss; it does not change the window. |
| Feedback | 6 | A clear bank whistles and a spoiled bank rasps. Those are not the checkpoint cue, the pond tick, or the page. They were not heard in Unreal. |
| Sound design | 4 | Unchanged. The city still has two loops. The whistle and the rasp are short blips, and nobody is voiced. |
| Variety | 6 | Unchanged. Five of eight story missions. |
| Performance stability | 4 | Unchanged. |

- Aesthetics raw: 34 / 10 dimensions, index 34
- Playability raw: 44 / 10 dimensions, index 44
- Total: 78 / 200
- Delta vs last round: +1 (round 5 was 77). Feedback 5 → 6. Every other score held.

![GTA title at 1280](gta-missions/r6-title-1280.png)

![GTA title at 390](gta-missions/r6-title-390.png)

![GTA title at 320](gta-missions/r6-title-320.png)

![Play client at 1280, host offline](gta-missions/r6-play-1280.png)

![Menu on a 390-wide screen, Recover visible](gta-missions/r6-play-menu-390.png)

### Round 7 — 2026-10-21 — rubric v1

- What changed: After the show is banked, mission 6 Nobody Left in the Picture leads through three short pulls, in any order, on dry ground at the terrace, the north pond and the court. Freeing one group does not clear the others. The mask is session state. The v1 save still stores CompletedMissions 0–2. Side jobs and T wait until every group is out. R restores the current group and does not clear a freed bit. The terrace recover steps east, away from the water. The pond and the court recover step south.
- Why it helped: Fun was the tied target, and the story still stopped while three groups were in the pictures. The any-order pulls are that chapter's joke without NPC escorts. The diamond names the first unfinished group, and any unfinished post still accepts E.
- Screenshots: title `docs/gauntlet/gta-missions/r7-title-1280.png`, `r7-title-390.png`, `r7-title-320.png`. Play client, host offline, `r7-play-1280.png`. Menu with Recover `r7-play-menu-390.png`. The title loaded with no page errors. The raw play page still logs the missing `@epicgames-ps/lib-pixelstreamingfrontend-ue5.8` specifier; the shell and Recover still draw. No native rescue capture: Unreal is not in this container. `Scripts/test_rescue_rules.py` reports 226 assertions, 0 failures, on c++, g++ and clang++. Show, court, pond and job rule tests still pass. Syntax check `--both` passed for the campaign, the controller and the race-result test. OpenSpec CLI is not installed, so `openspec validate` did not run.
- Next target: fun factor (4), still tied with controls, mission clarity, pacing, sound and performance. Responsiveness stays at 3 and stays out of scope. The three pulls were not played, so the feel score waits. The next round should keep going into mission 7 rather than touch the stream.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 3 | Unchanged. Sky and worklight only. |
| Color palette | 5 | Unchanged. The rescue posts use the same cream, gold and lime. |
| Detail density | 3 | Unchanged. The new posts are three comic cylinders. |
| Texture and material quality | 3 | Unchanged. |
| Composition and camera | 4 | Unchanged. The diamond is the one the story already used. |
| Atmosphere | 4 | Unchanged. The group copy is in the card; the pulls were not played. |
| Character models | 3 | Unchanged. |
| Animation smoothness | 3 | Unchanged. A freed group is a bit, not a walk. |
| Particles and VFX | 2 | Unchanged. No new effect. |
| UI polish | 4 | The card names mission 6, and touch says Menu · Recover. French and English still share the screen. |
| Responsiveness and input latency | 3 | Unchanged. Still a lagged stream. Out of scope for this loop. |
| Controls feel | 4 | Unchanged. Each group is still E. There is no escort. |
| Mission clarity | 4 | The card names the open groups and any order. The native card was not seen, and there is still no route line. |
| Pacing | 4 | Unchanged. A sixth beat exists on paper between the show and the side jobs. Its length was not played. |
| Fun factor | 4 | The any-order rescues and Memphis's line are written. They were not played, so the feel score stays. |
| Difficulty curve | 5 | Unchanged. Three pulls in any order do not add a tighter window than the ink. |
| Feedback | 6 | Unchanged. A group uses the checkpoint cue and the last group uses complete. No new tone. |
| Sound design | 4 | Unchanged. The city still has two loops. Nobody is voiced. |
| Variety | 7 | Six of eight story missions are now in the build, plus the four side jobs. The rescue was not played in Unreal. |
| Performance stability | 4 | Unchanged. |

- Aesthetics raw: 34 / 10 dimensions, index 34
- Playability raw: 45 / 10 dimensions, index 45
- Total: 79 / 200
- Delta vs last round: +1 (round 6 was 78). Variety 6 → 7. Every other score held.

![GTA title at 1280](gta-missions/r7-title-1280.png)

![GTA title at 390](gta-missions/r7-title-390.png)

![GTA title at 320](gta-missions/r7-title-320.png)

![Play client at 1280, host offline](gta-missions/r7-play-1280.png)

![Menu on a 390-wide screen, Recover visible](gta-missions/r7-play-menu-390.png)

### Round 8 — 2026-10-21 — rubric v1

- What changed: After every group is out, mission 7 Can't Tow Tomorrow leads along the street ring. Walk to the ink feeder, pull its clamp in the beam's gap, invert the projector plate, then take the escape gate. A pull while the beam is painting stays on that step. A pull during the warning still lands. The step is session state. The v1 save still stores CompletedMissions 0–2. Side jobs and T wait until the escape. R restores the current stop and does not rewind a disruption. The recover points step off the carriageway, away from the race gates.
- Why it helped: Fun was the tied target, and the story still stopped while the border was being drawn. The gap is a second timing read after the court's ink window. The moving wagons and the drive stay out of this round.
- Screenshots: title `docs/gauntlet/gta-missions/r8-title-1280.png`, `r8-title-390.png`, `r8-title-320.png`. Play client, host offline, `r8-play-1280.png`. Menu with Recover `r8-play-menu-390.png`. The title loaded with no page errors. The raw play page still logs the missing `@epicgames-ps/lib-pixelstreamingfrontend-ue5.8` specifier; the shell and Recover still draw. No native convoy capture: Unreal is not in this container. `Scripts/test_convoy_rules.py` reports 94 assertions, 0 failures, on c++, g++ and clang++. Rescue, show, court, pond and job rule tests still pass. Syntax check `--both` passed for the campaign, the controller and the race-result test. OpenSpec CLI is not installed, so `openspec validate` did not run.
- Next target: fun factor (4), still tied with controls, mission clarity, pacing, sound and performance. Responsiveness stays at 3 and stays out of scope. The gap was not played, so the feel score waits. The next round should open mission 8 rather than touch the stream.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 3 | Unchanged. Sky and worklight only. |
| Color palette | 5 | Unchanged. The convoy posts use the same berry, gold, lime and cream. |
| Detail density | 3 | Unchanged. The new posts are a feeder, a beam bar, a projector and a gate. |
| Texture and material quality | 3 | Unchanged. |
| Composition and camera | 4 | Unchanged. The diamond is the one the story already used. |
| Atmosphere | 4 | Unchanged. The border copy is in the card; the gap was not played. |
| Character models | 3 | Unchanged. |
| Animation smoothness | 3 | Unchanged. The beam is a bar appearing. |
| Particles and VFX | 2 | Unchanged. No new effect. |
| UI polish | 4 | The card names mission 7, and touch says Menu · Recover. French and English still share the screen. |
| Responsiveness and input latency | 3 | Unchanged. Still a lagged stream. Out of scope for this loop. |
| Controls feel | 4 | Unchanged. The pull is still E. There is no drive. |
| Mission clarity | 4 | The card names the gap and then the plate. The native card was not seen, and there is still no route line. |
| Pacing | 4 | Unchanged. A seventh beat exists on paper between the groups and the side jobs. Its length was not played. |
| Fun factor | 4 | The beam gap and the borrowed route line are written. They were not played, so the feel score stays. |
| Difficulty curve | 6 | The paint refuses the pull. The warning still lets it land. The rules prove both. It was not played. |
| Feedback | 6 | Unchanged. A painted pull uses the dialogue cue. The gap and the escape reuse checkpoint and complete. |
| Sound design | 4 | Unchanged. The city still has two loops. Nobody is voiced. |
| Variety | 8 | Seven of eight story missions are now in the build, plus the four side jobs. The convoy was not played in Unreal. |
| Performance stability | 4 | Unchanged. |

- Aesthetics raw: 34 / 10 dimensions, index 34
- Playability raw: 47 / 10 dimensions, index 47
- Total: 81 / 200
- Delta vs last round: +2 (round 7 was 79). Difficulty curve 5 → 6. Variety 7 → 8. Every other score held.

![GTA title at 1280](gta-missions/r8-title-1280.png)

![GTA title at 390](gta-missions/r8-title-390.png)

![GTA title at 320](gta-missions/r8-title-320.png)

![Play client at 1280, host offline](gta-missions/r8-play-1280.png)

![Menu on a 390-wide screen, Recover visible](gta-missions/r8-play-menu-390.png)

### Round 9 — 2026-10-21 — rubric v1

- What changed: After the convoy is banked, mission 8 Leave the Last Page Blank leads through three projection gates in order, on dry ground south of the theatre, then a pull that leaves the page blank. Crossing a gate does not skip the next one. The step is session state. The v1 save still stores CompletedMissions 0–2. Side jobs and T wait until the page is blank. R restores the current gate and does not uncross one that is already crossed.
- Why it helped: Fun was the tied target, and the story still stopped one chapter short. The three gates are the "draw him out" beat without the drive. The pull is the blank page. The page-turn attack and the two clamps stay out of this round.
- Screenshots: title `docs/gauntlet/gta-missions/r9-title-1280.png`, `r9-title-390.png`, `r9-title-320.png`. Play client, host offline, `r9-play-1280.png`. Menu with Recover `r9-play-menu-390.png`. The title loaded with no page errors. The raw play page still logs the missing `@epicgames-ps/lib-pixelstreamingfrontend-ue5.8` specifier; the shell and Recover still draw. No native page capture: Unreal is not in this container. `Scripts/test_blank_rules.py` reports 124 assertions, 0 failures, on c++, g++ and clang++. Convoy rules still pass. Syntax check `--both` passed for the campaign, the controller and the race-result test. OpenSpec CLI is not installed, so `openspec validate` did not run.
- Next target: fun factor (4), still tied with controls, mission clarity, pacing, sound and performance. Responsiveness stays at 3 and stays out of scope. All eight story missions are now in the build as session beats, and none of the new ones were played, so the feel score waits. The next round should change how a beat plays, such as a route line on the card, rather than touch the stream.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 3 | Unchanged. |
| Color palette | 5 | Unchanged. The gates use the same lime, gold and cream. |
| Detail density | 3 | Unchanged. Three gates and a panel. |
| Texture and material quality | 3 | Unchanged. |
| Composition and camera | 4 | Unchanged. |
| Atmosphere | 4 | Unchanged. The blank-page line is in the card; it was not played. |
| Character models | 3 | Unchanged. |
| Animation smoothness | 3 | Unchanged. A gate is a post appearing. |
| Particles and VFX | 2 | Unchanged. |
| UI polish | 4 | The card names mission 8, and touch says Menu · Recover. French and English still share the screen. |
| Responsiveness and input latency | 3 | Unchanged. Still a lagged stream. Out of scope for this loop. |
| Controls feel | 4 | Unchanged. The gates are walk-up and the page is E. There is no drive. |
| Mission clarity | 4 | The card names the current gate, then the page. The native card was not seen, and there is still no route line. |
| Pacing | 4 | Unchanged. An eighth beat exists on paper. Its length was not played. |
| Fun factor | 4 | The blank page is written. It was not played, so the feel score stays. |
| Difficulty curve | 6 | Unchanged. The gates are in order. They do not add a tighter window than the beam. |
| Feedback | 6 | Unchanged. A gate uses the checkpoint cue and the page uses complete. |
| Sound design | 4 | Unchanged. The city still has two loops. Nobody is voiced. |
| Variety | 9 | Eight of eight story missions are now in the build, plus the four side jobs. The page was not played in Unreal. |
| Performance stability | 4 | Unchanged. |

- Aesthetics raw: 34 / 10 dimensions, index 34
- Playability raw: 48 / 10 dimensions, index 48
- Total: 82 / 200
- Delta vs last round: +1 (round 8 was 81). Variety 8 → 9. Every other score held.

![GTA title at 1280](gta-missions/r9-title-1280.png)

![GTA title at 390](gta-missions/r9-title-390.png)

![GTA title at 320](gta-missions/r9-title-320.png)

![Play client at 1280, host offline](gta-missions/r9-play-1280.png)

![Menu on a 390-wide screen, Recover visible](gta-missions/r9-play-menu-390.png)

### Round 10 — 2026-10-21 — rubric v1

- What changed: While a diamond is showing, the mission card names the turn (ahead, left, right, behind, or here) and draws a gold needle. The radar draws a gold stroke from the player to that diamond, inset past the arrow and short of the diamond. A linear beat also draws a fainter stroke toward the next stop. A rescue group and a side-job guide do not. When the world diamond is outside the safe view, a gold chevron sits on the inset edge and points at the stop. A stop behind the camera leaves through the bottom of the frame.
- Why it helped: Fun was the tied target. Beats played as a name, a distance, and a diamond. The needle says which way to turn. The stroke is the way to the stop. The chevron keeps that way when the diamond leaves the frame.
- Screenshots: title `docs/gauntlet/gta-missions/r10-title-1280.png`, `r10-title-390.png`, `r10-title-320.png`. Play client, host offline, `r10-play-1280.png`. Menu with Recover `r10-play-menu-390.png`. The title loaded with no page errors. The raw play page still logs the missing `@epicgames-ps/lib-pixelstreamingfrontend-ue5.8` specifier; the shell and Recover still draw. No native route line: Unreal is not in this container. `Scripts/test_route_line.py` reports 34 assertions, 0 failures, on c++, g++ and clang++. Syntax check `--both` passed for the campaign and the HUD. OpenSpec CLI is not installed, so `openspec validate` did not run.
- Next target: fun factor (4), still tied with controls, pacing, sound and performance. Responsiveness stays at 3 and stays out of scope. The card now names the turn, and the rules prove ahead, left, right, behind, here, the radar insets and the edge chevron. The native HUD was not seen, so the feel score waits. The next round should keep changing how a beat plays, not add a chapter and not touch the stream.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 3 | Unchanged. |
| Color palette | 5 | Unchanged. The needle, the stroke and the chevron use the same gold. |
| Detail density | 3 | Unchanged. |
| Texture and material quality | 3 | Unchanged. |
| Composition and camera | 4 | Unchanged. The chevron sits on the existing view inset. It was not seen in the native frame. |
| Atmosphere | 4 | Unchanged. |
| Character models | 3 | Unchanged. |
| Animation smoothness | 3 | Unchanged. |
| Particles and VFX | 2 | Unchanged. |
| UI polish | 4 | The turn word is on the card. The native card was not seen, and French and English still share the screen. |
| Responsiveness and input latency | 3 | Unchanged. Still a lagged stream. Out of scope for this loop. |
| Controls feel | 4 | Unchanged. The needle follows facing. Steering is the same. |
| Mission clarity | 5 | The card names ahead, left, right, behind, or here, and the radar strokes the stop. The rules prove the needle, the insets, the next-stop stroke and the off-screen chevron. The native HUD was not seen. |
| Pacing | 4 | Unchanged. The route is marked. The length of a beat was not played. |
| Fun factor | 4 | The way to the stop is written. It was not played, so the feel score stays. |
| Difficulty curve | 6 | Unchanged. The line does not add a tighter window. |
| Feedback | 6 | Unchanged. The line is a mark, not a new hit. |
| Sound design | 4 | Unchanged. The city still has two loops. Nobody is voiced. |
| Variety | 9 | Unchanged. Eight of eight story missions, plus the four side jobs. |
| Performance stability | 4 | Unchanged. |

- Aesthetics raw: 34 / 10 dimensions, index 34
- Playability raw: 49 / 10 dimensions, index 49
- Total: 83 / 200
- Delta vs last round: +1 (round 9 was 82). Mission clarity 4 → 5. Every other score held.

![GTA title at 1280](gta-missions/r10-title-1280.png)

![GTA title at 390](gta-missions/r10-title-390.png)

![GTA title at 320](gta-missions/r10-title-320.png)

![Play client at 1280, host offline](gta-missions/r10-play-1280.png)

![Menu on a 390-wide screen, Recover visible](gta-missions/r10-play-menu-390.png)

### Round 11 — 2026-10-21 — rubric v1

- What changed: On foot, the turn word and the needle follow the camera yaw, flattened. Ahead means walk forward. Right means strafe right. In a car the word follows the nose, because that is the way the car drives. The world chevron still uses the full camera, including pitch.
- Why it helped: Fun was the tied target, and the route line could disagree with the walk. The body turns only after you move, while W follows the camera. A needle on the body told you to turn a character who is not the stick.
- Screenshots: title `docs/gauntlet/gta-missions/r11-title-1280.png`, `r11-title-390.png`, `r11-title-320.png`. Play client, host offline, `r11-play-1280.png`. Menu with Recover `r11-play-menu-390.png`. The title loaded with no page errors. The raw play page still logs the missing `@epicgames-ps/lib-pixelstreamingfrontend-ue5.8` specifier; the shell and Recover still draw. No native needle: Unreal is not in this container. `Scripts/test_route_line.py` reports 40 assertions, 0 failures, on c++, g++ and clang++. Syntax check `--both` passed for the HUD. OpenSpec CLI is not installed, so `openspec validate` did not run.
- Next target: fun factor (4), still tied with controls, pacing, sound and performance. Responsiveness stays at 3 and stays out of scope. The word now matches the walk key, which is clearer, and it was not played, so the feel score waits. Steering itself did not change. The next round should keep changing how a beat plays, not add a chapter and not touch the stream.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 3 | Unchanged. |
| Color palette | 5 | Unchanged. |
| Detail density | 3 | Unchanged. |
| Texture and material quality | 3 | Unchanged. |
| Composition and camera | 4 | Unchanged. The shoulder camera is the graphics loop's. |
| Atmosphere | 4 | Unchanged. |
| Character models | 3 | Unchanged. |
| Animation smoothness | 3 | Unchanged. |
| Particles and VFX | 2 | Unchanged. |
| UI polish | 4 | Unchanged. The native card was not seen, and French and English still share the screen. |
| Responsiveness and input latency | 3 | Unchanged. Still a lagged stream. Out of scope for this loop. |
| Controls feel | 4 | The word matches the walk key. Graded steering is the same, and it was not driven. |
| Mission clarity | 6 | Ahead is walk forward along the camera yaw, and a car uses its nose. The rules prove both. The native HUD was not seen. |
| Pacing | 4 | Unchanged. The length of a beat was not played. |
| Fun factor | 4 | The turn now matches the stick. It was not played, so the feel score stays. |
| Difficulty curve | 6 | Unchanged. |
| Feedback | 6 | Unchanged. |
| Sound design | 4 | Unchanged. The city still has two loops. Nobody is voiced. |
| Variety | 9 | Unchanged. Eight of eight story missions, plus the four side jobs. |
| Performance stability | 4 | Unchanged. |

- Aesthetics raw: 34 / 10 dimensions, index 34
- Playability raw: 50 / 10 dimensions, index 50
- Total: 84 / 200
- Delta vs last round: +1 (round 10 was 83). Mission clarity 5 → 6. Every other score held.

![GTA title at 1280](gta-missions/r11-title-1280.png)

![GTA title at 390](gta-missions/r11-title-390.png)

![GTA title at 320](gta-missions/r11-title-320.png)

![Play client at 1280, host offline](gta-missions/r11-play-1280.png)

![Menu on a 390-wide screen, Recover visible](gta-missions/r11-play-menu-390.png)

### Round 12 — 2026-10-21 — rubric v1

- What changed: On the ovation, the faint route stroke no longer picks a station during the either-order choice. After the followspot, the stroke leads to the curtain, not back to the followspot. After the backdrop, it does the same. The loading edge still leads to the choice.
- Why it helped: Fun was the tied target, and the new route line lied on mission 5. Either station is legal, but the stroke pointed only at the backdrop. Once the followspot was set, the next stroke pointed back at the followspot instead of the curtain.
- Screenshots: title `docs/gauntlet/gta-missions/r12-title-1280.png`, `r12-title-390.png`, `r12-title-320.png`. Play client, host offline, `r12-play-1280.png`. Menu with Recover `r12-play-menu-390.png`. The title loaded with no page errors. The raw play page still logs the missing `@epicgames-ps/lib-pixelstreamingfrontend-ue5.8` specifier; the shell and Recover still draw. No native stroke: Unreal is not in this container. `Scripts/test_show_rules.py` reports 228 assertions, 0 failures, on c++, g++ and clang++. Syntax check `--both` passed for the campaign. OpenSpec CLI is not installed, so `openspec validate` did not run.
- Next target: fun factor (4), still tied with controls, pacing, sound and performance. Responsiveness stays at 3 and stays out of scope. The ovation stroke now matches the either-order rule, and it was not played, so the feel score waits. The next round should keep changing how a beat plays, not add a chapter and not touch the stream.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 3 | Unchanged. |
| Color palette | 5 | Unchanged. |
| Detail density | 3 | Unchanged. |
| Texture and material quality | 3 | Unchanged. |
| Composition and camera | 4 | Unchanged. |
| Atmosphere | 4 | Unchanged. |
| Character models | 3 | Unchanged. |
| Animation smoothness | 3 | Unchanged. |
| Particles and VFX | 2 | Unchanged. |
| UI polish | 4 | Unchanged. The native card was not seen, and French and English still share the screen. |
| Responsiveness and input latency | 3 | Unchanged. Still a lagged stream. Out of scope for this loop. |
| Controls feel | 4 | Unchanged. Steering was not driven. |
| Mission clarity | 7 | The ovation no longer strokes a station that is already set, and the choice has no single next stop. The rules prove it. The native HUD was not seen. |
| Pacing | 4 | Unchanged. The length of a beat was not played. |
| Fun factor | 4 | The false stroke is gone. The ovation was not played, so the feel score stays. |
| Difficulty curve | 6 | Unchanged. Either order is the same rule as before. |
| Feedback | 6 | Unchanged. |
| Sound design | 4 | Unchanged. The city still has two loops. Nobody is voiced. |
| Variety | 9 | Unchanged. Eight of eight story missions, plus the four side jobs. |
| Performance stability | 4 | Unchanged. |

- Aesthetics raw: 34 / 10 dimensions, index 34
- Playability raw: 51 / 10 dimensions, index 51
- Total: 85 / 200
- Delta vs last round: +1 (round 11 was 84). Mission clarity 6 → 7. Every other score held.

![GTA title at 1280](gta-missions/r12-title-1280.png)

![GTA title at 390](gta-missions/r12-title-390.png)

![GTA title at 320](gta-missions/r12-title-320.png)

![Play client at 1280, host offline](gta-missions/r12-play-1280.png)

![Menu on a 390-wide screen, Recover visible](gta-missions/r12-play-menu-390.png)

### Round 13 — 2026-10-21 — rubric v1

- What changed: While a story beat or the terrace is open, the mission card says which stop this is, such as 2 of 6. When the next stop is a walk, it also says about how many seconds that leg takes at 450 cm/s, the player's walking speed. The ovation's either-order choice and a rescue group do not invent one walk. Parking the car and releasing the table are not walks. The race keeps its own clock. Sprint stays 800 cm/s, so a sprint arrives sooner than the card's walk.
- Why it helped: Pacing was a 4 the tests can prove. A beat was a sentence and a diamond. Nothing said how much of it was left, or how long the next leg was.
- Screenshots: title `docs/gauntlet/gta-missions/r13-title-1280.png`, `r13-title-390.png`, `r13-title-320.png`. Play client, host offline, `r13-play-1280.png`. Menu with Recover `r13-play-menu-390.png`. The title loaded with no page errors. The raw play page still logs the missing `@epicgames-ps/lib-pixelstreamingfrontend-ue5.8` specifier; the shell and Recover still draw. No native card: Unreal is not in this container. `Scripts/test_beat_pace.py` reports 20 assertions, 0 failures, on c++, g++ and clang++. Syntax check `--both` passed for the campaign and the HUD. OpenSpec CLI is not installed, so `openspec validate` did not run.
- Next target: fun factor (4), still tied with controls, sound and performance. Responsiveness stays at 3 and stays out of scope. The length is now a number the rules prove. It was not walked in Unreal, so the feel score waits. The next round should keep to a 4 the tests can prove, such as controls via the input mapping, and should not add a chapter or touch the stream.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 3 | Unchanged. |
| Color palette | 5 | Unchanged. |
| Detail density | 3 | Unchanged. |
| Texture and material quality | 3 | Unchanged. |
| Composition and camera | 4 | Unchanged. |
| Atmosphere | 4 | Unchanged. |
| Character models | 3 | Unchanged. |
| Animation smoothness | 3 | Unchanged. |
| Particles and VFX | 2 | Unchanged. |
| UI polish | 4 | The count shares the status line, which already wraps. The native card was not seen, and French and English still share the screen. |
| Responsiveness and input latency | 3 | Unchanged. Still a lagged stream. Out of scope for this loop. |
| Controls feel | 4 | Unchanged. The walk speed on the card is the same 450 cm/s the player already uses. Steering was not driven. |
| Mission clarity | 7 | Unchanged. The turn line is the same. The new text is the length. |
| Pacing | 5 | The card says which stop this is, and about how many seconds the next walk is. The rules prove the counts and the seconds. A sprint is faster, and the walk was not timed in Unreal. |
| Fun factor | 4 | The length is written. It was not walked, so the feel score stays. |
| Difficulty curve | 6 | Unchanged. The seconds do not add a fail state. |
| Feedback | 6 | Unchanged. |
| Sound design | 4 | Unchanged. The city still has two loops. Nobody is voiced. |
| Variety | 9 | Unchanged. Eight of eight story missions, plus the four side jobs. |
| Performance stability | 4 | Unchanged. |

- Aesthetics raw: 34 / 10 dimensions, index 34
- Playability raw: 52 / 10 dimensions, index 52
- Total: 86 / 200
- Delta vs last round: +1 (round 12 was 85). Pacing 4 → 5. Every other score held.

![GTA title at 1280](gta-missions/r13-title-1280.png)

![GTA title at 390](gta-missions/r13-title-390.png)

![GTA title at 320](gta-missions/r13-title-320.png)

![Play client at 1280, host offline](gta-missions/r13-play-1280.png)

![Menu on a 390-wide screen, Recover visible](gta-missions/r13-play-menu-390.png)

### Round 14 — 2026-10-21 — rubric v1

- What changed: Up and Down walk and drive forward and back at the same scale as W and S. Left and Right strafe at the same scale as D and A. The arrow keys are not also actions. The phone wheel's NumPad levels stay a third and two thirds of full lock. The drive hint and the play page name the arrows.
- Why it helped: Controls feel was a 4 the input mapping can prove. Walk and drive were WASD only. The route line says left and right, and the arrow keys did nothing.
- Screenshots: title `docs/gauntlet/gta-missions/r14-title-1280.png`, `r14-title-390.png`, `r14-title-320.png`. Play client, host offline, `r14-play-1280.png`. Menu with Recover `r14-play-menu-390.png`. The title loaded with no page errors. The raw play page still logs the missing `@epicgames-ps/lib-pixelstreamingfrontend-ue5.8` specifier; the shell and Recover still draw. The arrows were not driven in Unreal. `Scripts/test_move_keys.py` read the input file: 14 axis mappings, the arrows match WASD, none are actions, and the four graded wheel keys are unchanged. Syntax check `--both` passed for the HUD hint. OpenSpec CLI is not installed, so `openspec validate` did not run.
- Next target: fun factor (4), still tied with sound and performance. Responsiveness stays at 3 and stays out of scope. The mapping is proven. Driving itself was not changed, and it was not driven, so the feel score waits. The next round should keep to a 4 the tests can prove, and should not add a chapter or touch the stream.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 3 | Unchanged. |
| Color palette | 5 | Unchanged. |
| Detail density | 3 | Unchanged. |
| Texture and material quality | 3 | Unchanged. |
| Composition and camera | 4 | Unchanged. |
| Atmosphere | 4 | Unchanged. |
| Character models | 3 | Unchanged. |
| Animation smoothness | 3 | Unchanged. |
| Particles and VFX | 2 | Unchanged. |
| UI polish | 4 | The play page names the arrows. The native hint was not seen, and French and English still share the screen. |
| Responsiveness and input latency | 3 | Unchanged. Still a lagged stream. Out of scope for this loop. |
| Controls feel | 5 | Arrow keys walk and drive on the same axes as WASD. The mapping test proves the scales, and that the arrows are not also actions. Graded steering is unchanged, and it was not driven. |
| Mission clarity | 7 | Unchanged. |
| Pacing | 5 | Unchanged. The card still states the stop and the walk. |
| Fun factor | 4 | The arrows are mapped. They were not driven, so the feel score stays. |
| Difficulty curve | 6 | Unchanged. |
| Feedback | 6 | Unchanged. |
| Sound design | 4 | Unchanged. The city still has two loops. Nobody is voiced. |
| Variety | 9 | Unchanged. Eight of eight story missions, plus the four side jobs. |
| Performance stability | 4 | Unchanged. |

- Aesthetics raw: 34 / 10 dimensions, index 34
- Playability raw: 53 / 10 dimensions, index 53
- Total: 87 / 200
- Delta vs last round: +1 (round 13 was 86). Controls feel 4 → 5. Every other score held.

![GTA title at 1280](gta-missions/r14-title-1280.png)

![GTA title at 390](gta-missions/r14-title-390.png)

![GTA title at 320](gta-missions/r14-title-320.png)

![Play client at 1280, host offline](gta-missions/r14-play-1280.png)

![Menu on a 390-wide screen, Recover visible](gta-missions/r14-play-menu-390.png)

### Round 15 — 2026-10-21 — rubric v1

- What changed: While a story beat is open and the race is not running, a third bed plays: an original four-bar loop at 84, about 11.4 seconds, stereo, and it restarts on the downbeat. The race still uses the race loop. With no beat and no race, the neighborhood loop is unchanged. The two cooked loops and their selection log are untouched.
- Why it helped: Sound was a 4 because the city had two loops and nobody was voiced. Missions 3 through 8 were still the neighborhood bed. This is a third bed for those beats. Nobody is voiced, so the score moves one step.
- Screenshots: title `docs/gauntlet/gta-missions/r15-title-1280.png`, `r15-title-390.png`, `r15-title-320.png`. Play client, host offline, `r15-play-1280.png`. Menu with Recover `r15-play-menu-390.png`. The title loaded with no page errors. The raw play page still logs the missing `@epicgames-ps/lib-pixelstreamingfrontend-ue5.8` specifier; the shell and Recover still draw. The native bed was not heard: Unreal is not in this container. `Scripts/test_story_bed.py` reports 13 assertions, 0 failures, on c++, g++ and clang++. Syntax check `--both` passed for the playback wiring. OpenSpec CLI is not installed, so `openspec validate` did not run.
- Next target: fun factor (4), still tied with performance. Responsiveness stays at 3 and stays out of scope. The third bed is proven by the rules. It was not heard in Unreal, and nobody is voiced, so the sound score waits at 5. The next round should keep to a 4 the tests can prove, and should not add a chapter or touch the stream.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 3 | Unchanged. |
| Color palette | 5 | Unchanged. |
| Detail density | 3 | Unchanged. |
| Texture and material quality | 3 | Unchanged. |
| Composition and camera | 4 | Unchanged. |
| Atmosphere | 4 | Unchanged. |
| Character models | 3 | Unchanged. |
| Animation smoothness | 3 | Unchanged. |
| Particles and VFX | 2 | Unchanged. |
| UI polish | 4 | Unchanged. The native card was not seen, and French and English still share the screen. |
| Responsiveness and input latency | 3 | Unchanged. Still a lagged stream. Out of scope for this loop. |
| Controls feel | 5 | Unchanged. Arrow keys still walk and drive on the same axes as WASD. |
| Mission clarity | 7 | Unchanged. |
| Pacing | 5 | Unchanged. The card still states the stop and the walk. |
| Fun factor | 4 | The bed is a loop the rules prove. It was not heard, so the feel score stays. |
| Difficulty curve | 6 | Unchanged. |
| Feedback | 6 | Unchanged. |
| Sound design | 5 | A story beat plays an original third bed, and the rules prove the wrap, the energy, the stereo image, and that a race still wins. The two cooked loops remain. Nobody is voiced. |
| Variety | 9 | Unchanged. Eight of eight story missions, plus the four side jobs. |
| Performance stability | 4 | Unchanged. |

- Aesthetics raw: 34 / 10 dimensions, index 34
- Playability raw: 54 / 10 dimensions, index 54
- Total: 88 / 200
- Delta vs last round: +1 (round 14 was 87). Sound design 4 → 5. Every other score held.

![GTA title at 1280](gta-missions/r15-title-1280.png)

![GTA title at 390](gta-missions/r15-title-390.png)

![GTA title at 320](gta-missions/r15-title-320.png)

![Play client at 1280, host offline](gta-missions/r15-play-1280.png)

![Menu on a 390-wide screen, Recover visible](gta-missions/r15-play-menu-390.png)

### Round 16 — 2026-10-21 — rubric v1

- What changed: Pressing E on a park resident plays that resident's own line, spoken. Eleven givers, eleven takes, each a different espeak-ng voice. The words are the lines already on the caption. The cooked dialogue sting still marks the other cues. The two loops and the story bed are unchanged.
- Why it helped: Sound was a 5 because a beat had a bed and nobody spoke. Talking to a giver was a caption and a sting. The reply is now that giver's voice.
- Screenshots: title `docs/gauntlet/gta-missions/r16-title-1280.png`, `r16-title-390.png`, `r16-title-320.png`. Play client, host offline, `r16-play-1280.png`. Menu with Recover `r16-play-menu-390.png`. The title loaded with no page errors. The raw play page still logs the missing `@epicgames-ps/lib-pixelstreamingfrontend-ue5.8` specifier; the shell and Recover still draw. The lines were not heard in Unreal. `Scripts/test_barks.py` reports 151 assertions, 0 failures, on c++, g++ and clang++, and the spoken words match the resident captions. Syntax check `--both` passed for the playback wiring. OpenSpec CLI is not installed, so `openspec validate` did not run.
- Next target: fun factor (4), still tied with performance. Responsiveness stays at 3 and stays out of scope. The takes are proven. They were not heard in Unreal, and they are one line each, so the sound score waits at 6. The next round should keep to a change the tests can prove, and should not add a chapter or touch the stream.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 3 | Unchanged. |
| Color palette | 5 | Unchanged. |
| Detail density | 3 | Unchanged. |
| Texture and material quality | 3 | Unchanged. |
| Composition and camera | 4 | Unchanged. |
| Atmosphere | 4 | Unchanged. |
| Character models | 3 | Unchanged. |
| Animation smoothness | 3 | Unchanged. |
| Particles and VFX | 2 | Unchanged. |
| UI polish | 4 | Unchanged. The caption is the same line the voice speaks. French and English still share the screen. |
| Responsiveness and input latency | 3 | Unchanged. Still a lagged stream. Out of scope for this loop. |
| Controls feel | 5 | Unchanged. Arrow keys still walk and drive on the same axes as WASD. |
| Mission clarity | 7 | Unchanged. |
| Pacing | 5 | Unchanged. The card still states the stop and the walk. |
| Fun factor | 4 | The givers have voices. They were not heard, so the feel score stays. |
| Difficulty curve | 6 | Unchanged. |
| Feedback | 6 | Unchanged. The resident sting is now the spoken line. The other cues are the same. |
| Sound design | 6 | Pressing E on a mission giver plays that giver's original spoken line. The rules prove eleven distinct takes, the words, the energy and the quiet edges. The cooked loops remain. It was not heard in Unreal. |
| Variety | 9 | Unchanged. Eight of eight story missions, plus the four side jobs. |
| Performance stability | 4 | Unchanged. |

- Aesthetics raw: 34 / 10 dimensions, index 34
- Playability raw: 55 / 10 dimensions, index 55
- Total: 89 / 200
- Delta vs last round: +1 (round 15 was 88). Sound design 5 → 6. Every other score held.

![GTA title at 1280](gta-missions/r16-title-1280.png)

![GTA title at 390](gta-missions/r16-title-390.png)

![GTA title at 320](gta-missions/r16-title-320.png)

![Play client at 1280, host offline](gta-missions/r16-play-1280.png)

![Menu on a 390-wide screen, Recover visible](gta-missions/r16-play-menu-390.png)

### Round 17 — 2026-10-21 — rubric v1

- What changed: The seven story banks pay cash, and the base rises from the terrace to the last page. A clean bank pays that base times the chain already held, then the chain grows. A miss spoils the open beat: it pays the flat base, and the chain starts over. The card names the stake. The bank names the pay. The cash is shared. The chain is this session. The v1 save still stores only CompletedMissions.
- Why it helped: Fun was a 4 because a beat paid the same whether you banked it clean or missed the window. A clean run now pays more than twice a spoiled run, and the card shows the stake before you commit.
- Screenshots: title `docs/gauntlet/gta-missions/r17-title-1280.png`, `r17-title-390.png`, `r17-title-320.png`. Play client, host offline, `r17-play-1280.png`. Menu with Recover `r17-play-menu-390.png`. The title loaded with no page errors. The raw play page still logs the missing `@epicgames-ps/lib-pixelstreamingfrontend-ue5.8` specifier; the shell and Recover still draw. The chain was not played in Unreal. `Scripts/test_chain.py` reports 68 assertions, 0 failures, on c++, g++ and clang++. Syntax check `--both` passed for the campaign and the HUD. OpenSpec CLI is not installed, so `openspec validate` did not run.
- Next target: performance stability (4), the lowest playability score this loop can still see. Responsiveness stays at 3 and stays out of scope. The chain is proven by the rules. It was not played, so the fun score waits at 5. The next round should keep to a change the tests can prove, and should not add a chapter or touch the stream.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 3 | Unchanged. |
| Color palette | 5 | Unchanged. |
| Detail density | 3 | Unchanged. |
| Texture and material quality | 3 | Unchanged. |
| Composition and camera | 4 | Unchanged. |
| Atmosphere | 4 | Unchanged. |
| Character models | 3 | Unchanged. |
| Animation smoothness | 3 | Unchanged. |
| Particles and VFX | 2 | Unchanged. |
| UI polish | 4 | The stake shares the status line. The native card was not seen, and French and English still share the screen. |
| Responsiveness and input latency | 3 | Unchanged. Still a lagged stream. Out of scope for this loop. |
| Controls feel | 5 | Unchanged. Arrow keys still walk and drive on the same axes as WASD. |
| Mission clarity | 7 | Unchanged. The turn line is the same. The new text is the stake. |
| Pacing | 5 | Unchanged. The card still states the stop and the walk. |
| Fun factor | 5 | A clean chain pays more than twice a spoiled run, later beats are worth more, and a miss drops the stake to the flat base. The rules prove the pays. It was not played in Unreal. |
| Difficulty curve | 6 | Unchanged. The windows are the ones the beats already had. A miss costs the chain. It does not add a new fail. |
| Feedback | 6 | The card names the stake and a bank names the pay. The hit is still the sting until it is heard. |
| Sound design | 6 | Unchanged. The givers still speak their own lines. The chain does not add a cue. |
| Variety | 9 | Unchanged. Eight of eight story missions, plus the four side jobs. |
| Performance stability | 4 | Unchanged. |

- Aesthetics raw: 34 / 10 dimensions, index 34
- Playability raw: 56 / 10 dimensions, index 56
- Total: 90 / 200
- Delta vs last round: +1 (round 16 was 89). Fun factor 4 → 5. Every other score held.

![GTA title at 1280](gta-missions/r17-title-1280.png)

![GTA title at 390](gta-missions/r17-title-390.png)

![GTA title at 320](gta-missions/r17-title-320.png)

![Play client at 1280, host offline](gta-missions/r17-play-1280.png)

![Menu on a 390-wide screen, Recover visible](gta-missions/r17-play-menu-390.png)
