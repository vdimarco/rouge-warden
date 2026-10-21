# Full Swing missions gauntlet

Loop: missions, playability, controls, feel, UX, pacing and fun for In Full Swing. Focus group: playability. Reference: Marvel's Spider-Man 2. Rubric: [RUBRIC.md](RUBRIC.md). Original fiction and UI only.

### Round 1 — 2026-10-21 — rubric v1

- What changed: While a job has a goal, a comic sticker names it and shows the distance. On the Sludge Run it reads RUNNER (CREW once his crew is out). It sits on the goal in view. Off to the side, or behind the camera, it sits on the left or right edge and points the way to turn. A chase says CLOSING or FALLING BEHIND. The compass title says "Your job" during a job.
- Why it helped: A play of Mission 1 showed the bomb runner at the bottom of the chase camera, about 40 m away, while the training card said to swing at a gold ring and the compass was still titled "The nearest clog". Spider-Man 2 keeps the chase target readable, including when he leaves the frame, and tells you if you are gaining. The sticker does that without a new mission or a change to the timer.
- Screenshots: before `docs/gauntlet/fullswing-r1/before-chase.png`. After `docs/gauntlet/fullswing-r1/runner-closing.png` and `docs/gauntlet/fullswing-r1/runner-offscreen.png`.
- Next target: pacing (4), tied with sound design. Pacing is the one to change next: Mission 1's timer should not run against the training lesson. Sound stays at 4 until a round listens to it.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 5 | Golden-hour sun and ink shadows read clearly, and they are not a filmed city at dusk. |
| Color palette | 6 | Yellow, red and sludge green are consistent and loud enough to separate the HUD from the blocks. |
| Detail density | 4 | Blocks, a few signs and simple streets. A swing reads as open space more than a dressed borough. |
| Texture and material quality | 3 | Flat fills. Little of the wear, glass or cloth a 2023 city uses to sell a surface. |
| Composition and camera | 4 | The chase camera looks at the skyline. The runner stays low in the frame even with the sticker on him. |
| Atmosphere | 5 | The dusk skyline and the lake have a mood. The street under the chase does not. |
| Character models | 3 | The hero and the gang read as simple comic figures at this distance. |
| Animation smoothness | 4 | Scored from still frames in software GL. Poses exist. Continuous motion was not watched. |
| Particles and VFX | 4 | Clog beams and the comic words are the effects in play. This chase frame had neither a hit nor a trail. |
| UI polish | 6 | The chips, the training card and the new sticker share one ink-and-yellow system and stay inside the window. |
| Responsiveness and input latency | 7 | The sticker and the mission card update on the stepped frame that moves the hero. No missed press showed up in the run. |
| Controls feel | 5 | Swing is hold-forward plus the mouse, with an auto target. It is not a one-button web swing, and the training still asks for the gold ring during the chase. |
| Mission clarity | 6 | The runner is named, measured, and marked when he leaves the view, and the compass says it is the job. The training card still gives a second target. |
| Pacing | 4 | The bomb timer, the eight-row training card and the gold-ring lesson all start together. After that, Mission 2 is twelve of the same clog. |
| Fun factor | 5 | Catching a marked runner is a readable chase now. The opening still splits attention, so the swing is not the whole of the first minute. |
| Difficulty curve | 5 | The runner jogs at 5.4 m/s once you can see him. The fail is a toast and a retry, then a short crew fight. |
| Feedback | 6 | CLOSING and FALLING BEHIND sit on the chase, next to the existing GO cue, hit-stop and focus meter. |
| Sound design | 4 | Not listened to this round (the playtest ran with audio disabled). The events have stingers. There is no chase bed that rises as the runner pulls away. |
| Variety | 5 | Odd jobs and crimes cover chase, carry, drive and fight. The story objective after Mission 1 does not. |
| Performance stability | 6 | Desktop play booted in software GL and the job tests passed with no page errors. Frame time on a real GPU was not measured. |

- Aesthetics raw: 44 / 10 dimensions, index 44
- Playability raw: 53 / 10 dimensions, index 53
- Total: 97 / 200
- Delta vs last round: — (first v1 score of this loop)

![Before the sticker, the chase card names the runner and the view does not](fullswing-r1/before-chase.png)

![RUNNER 38 m, CLOSING, on the runner](fullswing-r1/runner-closing.png)

![Turned away, the sticker sits on the left edge and points left](fullswing-r1/runner-offscreen.png)

### Round 2 — 2026-10-21 — rubric v1

- What changed: On a first lesson (the gold-ring row, or the spoken tutorial's first line), the Sludge Run runner stands and the bomb clock does not count. The card keeps the time and says "Swing first. He waits until you do." A rope, or the end of that lesson, starts the run and the clock. A retry after the lesson runs at once. The eight training rows stay.
- Why it helped: A play at 1280×800 had "SLUDGE RUN 75 s" and "Catch the runner, 38 m" while training still said "Swing at the gold ring". Three seconds later the clock read 72 s and the runner had moved 17 m. Spider-Man 2 teaches the swing inside the opening chase and does not burn the fail timer during that beat. After the change the clock stayed at 76 s for three seconds, a rope on the gold ring ticked the first row, and the card became "Catch the runner, 32 m" with the clock at 74 s.
- Screenshots: before `docs/gauntlet/fullswing-r2/before-lesson.png`. After `docs/gauntlet/fullswing-r2/clock-waits.png` and `docs/gauntlet/fullswing-r2/clock-runs.png`.
- Next target: sound design (4). It is the lowest playability score. It stays at 4 until a round listens to the chase.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 5 | Unchanged. Golden-hour sun and ink shadows, not a filmed city at dusk. |
| Color palette | 6 | Unchanged. Yellow, red and sludge green still separate the HUD from the blocks. |
| Detail density | 4 | Unchanged. The swing still reads as open space more than a dressed borough. |
| Texture and material quality | 3 | Unchanged. Flat fills. |
| Composition and camera | 4 | Unchanged. The chase camera still watches the skyline, and the runner leaves the bottom of the frame once he runs. |
| Atmosphere | 5 | Unchanged. The dusk skyline has a mood. The street under the chase does not. |
| Character models | 3 | Unchanged. Simple comic figures at this distance. |
| Animation smoothness | 4 | Scored from still frames in software GL. The rope pose is there. Continuous motion was not watched. |
| Particles and VFX | 4 | The second frame shows the rope line. No hit, trail or blast. |
| UI polish | 6 | The wait sentence fits the mission pill beside the training card, in the same ink and yellow. |
| Responsiveness and input latency | 7 | The card switches to the chase on the swing, and the stepped tests show the clock and the runner on that frame. |
| Controls feel | 5 | Unchanged. Swing is still hold-forward plus the mouse. The lesson no longer races the bomb, and the swing itself is the same. |
| Mission clarity | 7 | The card says to swing first while the gold-ring row is open, then names the runner and the distance. The gold ring is still a second place to look. |
| Pacing | 6 | The bomb and the runner wait out the first swing, so the lesson is not a fail timer. After that, Mission 2 is still twelve of the same clog. |
| Fun factor | 6 | The first minute is a swing and then a chase. The opening no longer splits the bomb and the lesson. |
| Difficulty curve | 6 | Standing on the roof to learn the swing no longer loses the runner. Once he runs he is still the same 5.4 m/s jog, with a toast and a retry. |
| Feedback | 6 | Unchanged. CLOSING, the GO cue and the hit-stop are the juice. The new sentence is the card, not a new hit. |
| Sound design | 4 | Not listened to. The playtest ran with audio disabled. No chase bed was judged. |
| Variety | 5 | Unchanged. Odd jobs cover chase, carry, drive and fight. The story after Mission 1 does not. |
| Performance stability | 6 | The first-run play and the job tests passed with no page errors. Frame time on a real GPU was not measured. |

- Aesthetics raw: 44 / 10 dimensions, index 44
- Playability raw: 58 / 10 dimensions, index 58
- Total: 102 / 200
- Delta vs last round: +5 (round 1 was 97). Pacing 4 → 6, mission clarity 6 → 7, fun factor 5 → 6, difficulty curve 5 → 6. Every other score held.

![Before: the bomb clock and the gold-ring lesson run together](fullswing-r2/before-lesson.png)

![The clock stays at 76 s and the card says to swing first](fullswing-r2/clock-waits.png)

![After the rope, the card is the chase and the clock has moved to 74 s](fullswing-r2/clock-runs.png)

### Round 3 — 2026-10-21 — rubric v1

- What changed: A chase (the runner before his crew, the thief, the getaway car, the balloon) adds a clock tick to the groove. Falling behind speeds the tick and opens the filter. Closing takes the tick away. The first-lesson hold, and a fight, stay on the groove they already had.
- Why it helped: The sticker could already say FALLING BEHIND while the music stayed the same sunset loop. Spider-Man 2 tightens the chase when the target pulls away. An offline render of the same groove, same speed, was brighter with the clock (high end 0.0075 to 0.0081, difference 0.0034). In play, falling behind sets the bed to full, closing sets it to quiet, and the lesson hold keeps it quiet.
- Screenshots: `docs/gauntlet/fullswing-r3/falling-behind.png` (the sticker reads FALLING BEHIND, which is the full tick). No speaker in this run. The level was measured from the render, not heard in a room.
- Next target: controls feel (5), tied with variety and sound. Controls is the one to change next: swing is still hold-forward plus the mouse.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 5 | Unchanged. Golden-hour sun and ink shadows. |
| Color palette | 6 | Unchanged. Yellow, red and sludge green still separate the HUD from the blocks. |
| Detail density | 4 | Unchanged. Open blocks more than a dressed borough. |
| Texture and material quality | 3 | Unchanged. Flat fills. |
| Composition and camera | 4 | Unchanged. The chase camera still leaves the runner low in the frame. |
| Atmosphere | 5 | Unchanged. The dusk skyline has a mood. The street under the chase does not. |
| Character models | 3 | Unchanged. Simple comic figures at this distance. |
| Animation smoothness | 4 | Scored from still frames in software GL. |
| Particles and VFX | 4 | Unchanged. A rope line and the sticker. No hit or trail in this frame. |
| UI polish | 6 | Unchanged. The sticker and the mission pill are the same ink and yellow. |
| Responsiveness and input latency | 7 | Unchanged. The bed follows the same stepped frame as the sticker. |
| Controls feel | 5 | Unchanged. Swing is still hold-forward plus the mouse. |
| Mission clarity | 7 | Unchanged. The card and the sticker still name the runner, and the clock now agrees when you are losing him. |
| Pacing | 6 | Unchanged. The lesson still waits, and Mission 2 is still twelve of the same clog. |
| Fun factor | 6 | Unchanged. The chase is the same swing. The tick marks losing him. It does not add a new trick. |
| Difficulty curve | 6 | Unchanged. Falling behind is now audible. The runner is still the same jog. |
| Feedback | 6 | The tick sits under the sticker's FALLING BEHIND. Hits, the GO cue and hit-stop are unchanged. |
| Sound design | 5 | The chase now has a clock that speeds up when the runner pulls away and drops out when you close. It is a click on the same groove, measured from a render, not a scored chase heard on speakers. |
| Variety | 5 | Unchanged. Odd jobs cover chase, carry, drive and fight. The story after Mission 1 does not. |
| Performance stability | 6 | The chase play and the render finished with no page errors. Frame time on a real GPU was not measured. |

- Aesthetics raw: 44 / 10 dimensions, index 44
- Playability raw: 59 / 10 dimensions, index 59
- Total: 103 / 200
- Delta vs last round: +1 (round 2 was 102). Sound design 4 → 5. Every other score held.

![Falling behind: the sticker names the runner and says FALLING BEHIND](fullswing-r3/falling-behind.png)

### Round 4 — 2026-10-21 — rubric v1

- What changed: On the ground, a swing button with no stick walks the hero toward the web at walking speed. W and the left stick still steer. A clog, a pipe, or the crack does not pull you. The hint, the training row, the spoken line, the title note and How to play name the swing button. They no longer ask for a forward hold.
- Why it helped: The first lesson said HOLD W AND LEFT MOUSE, and a press on its own slid across the start roof and stopped. Spider-Man 2 starts the web from the swing button. In play at 1280×800, E alone left the roof in under 4 s with the rope still attached. The physics check measured 3.57 s. A rope on a clog stayed put.
- Screenshots: `docs/gauntlet/fullswing-r4/roof.png` (the hint and the training row on the roof) and `docs/gauntlet/fullswing-r4/air.png` (in the air a moment later, rope out). No phone, pad, or headset was in this run.
- Next target: variety (5), tied with sound design. Variety is the one to change next: after Mission 1 the story is twelve of the same clog. Sound just gained a click on the same groove.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 5 | Unchanged. Golden-hour sun and ink shadows. |
| Color palette | 6 | Unchanged. Yellow, red and sludge green still separate the HUD from the blocks. |
| Detail density | 4 | Unchanged. Open blocks more than a dressed borough. |
| Texture and material quality | 3 | Unchanged. Flat fills. |
| Composition and camera | 4 | Unchanged. The chase camera still leaves the runner and the swing low in the frame. |
| Atmosphere | 5 | Unchanged. The dusk skyline has a mood. The street under the swing does not. |
| Character models | 3 | Unchanged. Simple comic figures at this distance. |
| Animation smoothness | 4 | Scored from still frames in software GL. The rope is out. Continuous motion was not watched. |
| Particles and VFX | 4 | Unchanged. A rope line and the sticker. No hit or trail in this frame. |
| UI polish | 6 | The hint and the training row now name one button, in the same ink and yellow. |
| Responsiveness and input latency | 7 | Unchanged. The rope and the walk start on the stepped frame of the press. |
| Controls feel | 6 | One button leaves the roof and the rope carries the swing. It is still hold-the-button and one arc, not a chained web swing. |
| Mission clarity | 7 | Unchanged. The card and the sticker still name the runner, and the first row no longer asks for a second hold. |
| Pacing | 6 | Unchanged. The lesson still waits, and Mission 2 is still twelve of the same clog. |
| Fun factor | 6 | The first minute is a swing and then a chase. Starting it is one button now, and the minute is still that chase. |
| Difficulty curve | 6 | Unchanged. The roof is no longer a stuck press. The runner is still the same jog. |
| Feedback | 6 | Unchanged. The GO cue still shows while the rope drags along the roof. |
| Sound design | 5 | Unchanged. The chase clock is the click from last round. This play ran with audio disabled. |
| Variety | 5 | Unchanged. Odd jobs cover chase, carry, drive and fight. The story after Mission 1 does not. |
| Performance stability | 6 | The one-button play and the physics checks passed with no page errors. Frame time on a real GPU was not measured. |

- Aesthetics raw: 44 / 10 dimensions, index 44
- Playability raw: 60 / 10 dimensions, index 60
- Total: 104 / 200
- Delta vs last round: +1 (round 3 was 103). Controls feel 5 → 6. Every other score held.

![On the roof, the hint says left mouse or E to swing](fullswing-r4/roof.png)

![A moment later the rope is out and the hero is off the roof](fullswing-r4/air.png)

### Round 5 — 2026-10-21 — rubric v1

- What changed: After the Sludge Run, Mission 2 is Stop, Thief!, Mission 3 is Catch!, and Mission 4 is a rooftop brawl. Each starts near the hero, a miss starts that same mission again, and odd-job markers wait until the three are done. The mission card names the current one. The twelve clogs stay in the city and still wake the King, and the card returns to them when Mission 4 is over. The King card no longer calls itself Mission 3.
- Why it helped: The story after the bomb was twelve of the same plunge. Spider-Man 2 follows its opening with missions that change what you do. A 1280×800 play showed a street chase (THIEF, 51 m), a person on a roof edge (FALLING), and a roof fight (FIGHT, wave 1 of 2). None of those cards said to flush a clog. When the route ended, the clog card came back.
- Screenshots: `docs/gauntlet/fullswing-r5/thief.png`, `docs/gauntlet/fullswing-r5/catch.png`, `docs/gauntlet/fullswing-r5/brawl.png`.
- Next target: sound design (5). It is the lowest playability score. Variety is 7. The chase bed is still a click on the same groove.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 5 | Held. Golden-hour sun and ink shadows. |
| Color palette | 6 | Held. Yellow, red and sludge green still separate the HUD from the blocks. |
| Detail density | 4 | Held. Open blocks more than a dressed borough. |
| Texture and material quality | 3 | Held. Flat fills. |
| Composition and camera | 4 | Held. The chase camera still leaves the thief low in the frame. The catch and the brawl are wider, and still not a led fight camera. |
| Atmosphere | 5 | Held. The dusk skyline has a mood. The street under the chase does not. |
| Character models | 3 | Held. Simple comic figures. The faller and the goons read at this distance. |
| Animation smoothness | 4 | Scored from still frames in software GL. Poses exist. Continuous motion was not watched. |
| Particles and VFX | 4 | Held. Beams and the sticker. No hit or trail in these frames. |
| UI polish | 6 | Held. The mission pill, the sticker and the training card share one ink-and-yellow system. |
| Responsiveness and input latency | 7 | Held. The card and the sticker were on the stepped frame that started each mission. |
| Controls feel | 6 | Held. One button still leaves the roof. These missions do not change the swing. |
| Mission clarity | 7 | Held at 7. Each card names its own mission and the sticker names THIEF, FALLING or FIGHT. The training card can still sit beside them. |
| Pacing | 7 | The lesson still waits. The next mission is a short chase, then a rescue, then a fight, not the clog list. The twelve clogs return after those three. |
| Fun factor | 6 | Held. The three missions are on the card. This play started them. It did not play one through to the payoff. |
| Difficulty curve | 6 | Held. The thief is a faster jog than the bomb runner, the catch gives time to swing there, and a miss retries. |
| Feedback | 6 | Held. The sticker and the timer are the new mission's feedback. No new hit or cue. |
| Sound design | 5 | Held. The chase clock is the click from round 3. This play ran with audio disabled. |
| Variety | 7 | Missions 2, 3 and 4 are a street chase, a falling rescue and a roof fight. The clog set is still the path to the King after that. |
| Performance stability | 6 | The 1280×800 play and the job checks passed with no page errors. Frame time on a real GPU was not measured. |

- Aesthetics raw: 44 / 10 dimensions, index 44
- Playability raw: 63 / 10 dimensions, index 63
- Total: 107 / 200
- Delta vs last round: +3 (round 4 was 104). Variety 5 → 7. Pacing 6 → 7. Every other score held.

![Mission 2 is a purse snatcher on the street](fullswing-r5/thief.png)

![Mission 3 is a person on a roof edge](fullswing-r5/catch.png)

![Mission 4 is a fight on a roof](fullswing-r5/brawl.png)

### Round 6 — 2026-10-21 — rubric v1

- What changed: The chase clock is a wood block under the click. Keeping pace is a light hit on the quarter notes. Falling behind is a heavier hit, and on the eighth notes. Closing and the first-lesson wait stay quiet. A fight still uses its own pulse.
- Why it helped: The old tick lived with the hats, so falling behind was barely brighter than the groove. A 4 s render of the same seed (speed 10) puts the keeping-pace clock 0.0033 RMS from the quiet groove, and falling behind 0.0114 RMS from it, about 3.4 times that clock. The whole mix only rises from 0.039 to 0.041, because the compressor holds the level. Closing and the lesson wait still report a chase of 0.
- Screenshots: `docs/gauntlet/fullswing-r6/falling-behind.png`. The picture shows the state. The loudness is the render, not the picture. No speaker listen.
- Next target: fun factor (6), tied with controls feel, difficulty, feedback, performance and sound. Fun is the one to change next: catching the thief, the faller or the roof still ends in a toast and a coin count.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 5 | Held. Golden-hour sun and ink shadows. |
| Color palette | 6 | Held. Yellow, red and sludge green still separate the HUD from the blocks. |
| Detail density | 4 | Held. Open blocks more than a dressed borough. |
| Texture and material quality | 3 | Held. Flat fills. |
| Composition and camera | 4 | Held. The runner still sits low in the chase frame. |
| Atmosphere | 5 | Held. The dusk skyline has a mood. The street under the chase does not. |
| Character models | 3 | Held. Simple comic figures at this distance. |
| Animation smoothness | 4 | Scored from still frames in software GL. Continuous motion was not watched. |
| Particles and VFX | 4 | Held. The sticker and the street. No new hit or trail. |
| UI polish | 6 | Held. The FALLING BEHIND sticker is the same ink chip. |
| Responsiveness and input latency | 7 | Held. The chase state flipped on the stepped frames. |
| Controls feel | 6 | Held. One button still leaves the roof. The clock does not change the swing. |
| Mission clarity | 7 | Held. The sticker still says FALLING BEHIND when the clock is full. |
| Pacing | 7 | Held. The lesson waits, then the story missions, then the clogs. |
| Fun factor | 6 | Held. The chase is the same jog. The clock marks losing it. This play did not catch him. |
| Difficulty curve | 6 | Held. Falling behind is the same distance rule. The clock is heavier then, not a new fail. |
| Feedback | 6 | Held. The sticker was already the chase readout. The clock now backs the losing state. |
| Sound design | 6 | Falling behind is a wood block on the eighths, 3.4 times the keeping-pace clock in a seeded render. It is still one block on the same groove. Not heard on a speaker. |
| Variety | 7 | Held. Missions 2, 3 and 4 are still a chase, a rescue and a fight. |
| Performance stability | 6 | The chase-bed play and the render passed with no page errors. Frame time on a real GPU was not measured. |

- Aesthetics raw: 44 / 10 dimensions, index 44
- Playability raw: 64 / 10 dimensions, index 64
- Total: 108 / 200
- Delta vs last round: +1 (round 5 was 107). Sound design 5 → 6. Every other score held.

![Falling behind, the state that drives the heavier clock](fullswing-r6/falling-behind.png)

### Round 7 — 2026-10-21 — rubric v1

- What changed: A won job hangs in play before the next mission. A comic word fills about 62% of the view (FLUSH on the bomb, KASPLASH on every other win), a cheer plays with the old stinger, and the world slows for a short moment. The pill says GOT IT. The next mission card waits about 1.35 s, then the story scene and the next job. A miss stays a toast.
- Why it helped: Catching the thief, the faller, or the roof used to be a toast and a coin count, and Mission 3 opened in that same moment. Spider-Man 2 lets a clear land: time slows, a big title, a cheer, then the next objective. A 1280×800 play caught the purse snatcher. KASPLASH measured 61% of the view, the slow moment and the hit were on, the pill read GOT IT, and Mission 3 started after the hang. The cheer was not heard on a speaker (the play ran with audio disabled).
- Screenshots: `docs/gauntlet/fullswing-r7/gotcha.png`.
- Next target: controls feel (6), tied with difficulty, sound, and performance. Controls is the one to change next: one button leaves the roof, and the swing is still one held arc. Sound just moved, and this play did not listen. Performance still has no real-GPU frame time.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 5 | Held. Golden-hour sun and ink shadows. |
| Color palette | 6 | Held. Yellow, red and sludge green still separate the HUD from the blocks. |
| Detail density | 4 | Held. Open blocks more than a dressed borough. |
| Texture and material quality | 3 | Held. Flat fills. |
| Composition and camera | 4 | Held. The chase camera still looks down the street. The word sits in the middle of that view. |
| Atmosphere | 5 | Held. The dusk skyline has a mood. The street under the chase does not. |
| Character models | 3 | Held. Simple comic figures at this distance. |
| Animation smoothness | 4 | Scored from still frames in software GL. Continuous motion was not watched. |
| Particles and VFX | 5 | The win frame is a KASPLASH across about 61% of the view. It is still one comic word, not a trail or a crowd. |
| UI polish | 6 | Held. GOT IT uses the same ink pill. The training card still sits beside it on a skip-intro start. |
| Responsiveness and input latency | 7 | Held. The word and the pill were on the stepped frame that ended the job. |
| Controls feel | 6 | Held. One button still leaves the roof. The payoff does not change the swing. |
| Mission clarity | 7 | Held. GOT IT names the job that just ended. Mission 3's card waits, then names the catch. |
| Pacing | 7 | Held. The hang is about a second and a third, then the next mission. The twelve clogs are still after Mission 4. |
| Fun factor | 7 | Catching the thief ends on a word bigger than a finisher, a short slow moment, and then the next mission. It is not a filmed finish. |
| Difficulty curve | 6 | Held. The thief is the same jog. The win is louder. The miss is still a toast. |
| Feedback | 7 | The win is a word, a hit, and a hang, not only a toast and a coin count. The cheer was not heard. |
| Sound design | 6 | Held. The cheer is the existing stinger. This play ran with audio disabled. The chase clock is unchanged. |
| Variety | 7 | Held. Missions 2, 3 and 4 are still a chase, a rescue and a fight. |
| Performance stability | 6 | The 1280×800 play passed with no page errors. Frame time on a real GPU was not measured. |

- Aesthetics raw: 45 / 10 dimensions, index 45
- Playability raw: 66 / 10 dimensions, index 66
- Total: 111 / 200
- Delta vs last round: +3 (round 6 was 108). Fun factor 6 → 7. Feedback 6 → 7. Particles and VFX 4 → 5. Every other score held.

![Catching the thief lands a KASPLASH and GOT IT before the next mission](fullswing-r7/gotcha.png)

### Round 8 — 2026-10-21 — rubric v1

- What changed: On mouse and pad, letting go of a building rope while you are already moving at least 8 m/s carries the swing: 2.2 m/s along the flight and 1.6 m/s up. It does not cancel a fall and it does not flip the hero. The GO cue still does the larger boost and the flip. Under 8 m/s, a let-go is still just a let-go. The phone's own release is unchanged.
- Why it helped: A swing died when you let go outside the GO window, so each arc was one hold and a drop. Spider-Man 2 keeps a moving web flying into the next one. A 1280×800 play let go while falling, outside the cue, already moving across the rope. The carry added 2.2 m/s, the fall continued, and the pose stayed swing. A near-still let-go added nothing.
- Screenshots: `docs/gauntlet/fullswing-r8/carry.png`.
- Next target: difficulty curve (6), tied with sound and performance. Difficulty is the one to change next: the thief is still the same jog, and a miss is still a toast. Sound was not listened to. Performance still has no real-GPU frame time.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 5 | Held. Golden-hour sun and ink shadows. |
| Color palette | 6 | Held. Yellow, red and sludge green still separate the HUD from the blocks. |
| Detail density | 4 | Held. Open blocks more than a dressed borough. |
| Texture and material quality | 3 | Held. Flat fills. |
| Composition and camera | 4 | Held. The chase camera still sits behind the hero. This frame is the swing, not a new view. |
| Atmosphere | 5 | Held. The dusk skyline has a mood. The street under the swing does not. |
| Character models | 3 | Held. Simple comic figures. |
| Animation smoothness | 4 | Scored from still frames in software GL. Continuous motion was not watched. |
| Particles and VFX | 5 | Held. The win word is still the effect from the last round. This frame is the swing. |
| UI polish | 6 | Held. The training card and the mission pill are the same. |
| Responsiveness and input latency | 7 | Held. The let-go carried on the stepped frame that released the rope. |
| Controls feel | 7 | A fast let-go outside the GO cue keeps the swing moving and does not flip. The timed let-go is still the real pop. It is not a chained web. |
| Mission clarity | 7 | Held. The missions are unchanged. |
| Pacing | 7 | Held. The story route and the win hang are unchanged. |
| Fun factor | 7 | Held. The win still lands on the big word. This round changes the let-go, not the mission finish. |
| Difficulty curve | 6 | Held. The thief is the same jog. A miss is still a toast. |
| Feedback | 7 | Held. The carry is a speed change. The GO cue and the win word are unchanged. |
| Sound design | 6 | Held. Not listened to. The carry can play the existing WHOOSH. The chase clock is unchanged. |
| Variety | 7 | Held. Missions 2, 3 and 4 are still a chase, a rescue and a fight. |
| Performance stability | 6 | The 1280×800 play passed with no page errors. Frame time on a real GPU was not measured. |

- Aesthetics raw: 45 / 10 dimensions, index 45
- Playability raw: 67 / 10 dimensions, index 67
- Total: 112 / 200
- Delta vs last round: +1 (round 7 was 111). Controls feel 6 → 7. Every other score held.

![A fast let-go outside the GO cue, the hero still in the air](fullswing-r8/carry.png)

### Round 9 — 2026-10-21 — rubric v1

- What changed: The purse snatcher stays at a 6.3 m/s jog while the hero is within 28 m, and rises toward 9.2 m/s when the gap is wider. Closing the gap brings him back to the jog. The Sludge Run runner does the same, milder: 5.4 m/s within 46 m, toward 7.4 m/s past that, and the first-swing wait still holds him stopped. A miss holds a lesson card for 1.7 s. GOT AWAY says to stay close, because a swing beats a jog. The toast still says what happened. There is no payoff word. The story mission starts again after that card.
- Why it helped: The chase was one jog, and losing it was a toast. Spider-Man 2 pulls a pursuit away when you lose the gap, and a miss says what to do before the retry. A 1280×800 play stayed about 40 m behind the thief. His speed rose past 8 m/s and the card said he was pulling away. The clock running out showed GOT AWAY and the swing line, with no KASPLASH, and then Mission 2 started again.
- Screenshots: `docs/gauntlet/fullswing-r9/pull.png`, `docs/gauntlet/fullswing-r9/miss.png`.
- Next target: sound design (6), tied with performance. Sound is the one to change next: the pull-away and the miss are still the same mix, and a buffer can measure a new sting the way the chase clock was measured. Performance still has no real-GPU frame time.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 5 | Held. Golden-hour sun and ink shadows. |
| Color palette | 6 | Held. Yellow, red and sludge green still separate the HUD from the blocks. |
| Detail density | 4 | Held. Open blocks more than a dressed borough. |
| Texture and material quality | 3 | Held. Flat fills. |
| Composition and camera | 4 | Held. The chase camera still sits behind the hero. The card is the new read. |
| Atmosphere | 5 | Held. The dusk skyline has a mood. The street under the chase does not. |
| Character models | 3 | Held. Simple comic figures. |
| Animation smoothness | 4 | Scored from still frames in software GL. Continuous motion was not watched. |
| Particles and VFX | 5 | Held. No new word on a miss. The win word is unchanged. |
| UI polish | 6 | Held. The lesson uses the same ink pill as the mission. |
| Responsiveness and input latency | 7 | Held. The speed and the card were on the stepped frames. |
| Controls feel | 7 | Held. The swing carry is unchanged. |
| Mission clarity | 7 | Held. The missions were already named. The new lines say the chase is getting away. |
| Pacing | 7 | Held. The lesson is under two seconds, then the same mission. The twelve clogs are still after Mission 4. |
| Fun factor | 7 | Held. The win still lands on the big word. This round changes the chase, not the finish. |
| Difficulty curve | 7 | Falling behind turns the jog into a run, and closing the gap brings the jog back. A miss holds a lesson, then the chase starts again. The later missions are still one pace. |
| Feedback | 7 | Held. The miss is a card and a toast, not a new hit. The win payoff is unchanged. |
| Sound design | 6 | Held. Not listened to. The pull-away and the miss add no new sting. The chase clock is unchanged. |
| Variety | 7 | Held. Missions 2, 3 and 4 are still a chase, a rescue and a fight. |
| Performance stability | 6 | The 1280×800 play passed with no page errors. Frame time on a real GPU was not measured. |

- Aesthetics raw: 45 / 10 dimensions, index 45
- Playability raw: 68 / 10 dimensions, index 68
- Total: 113 / 200
- Delta vs last round: +1 (round 8 was 112). Difficulty curve 6 → 7. Every other score held.

![Falling behind: the card says he is pulling away](fullswing-r9/pull.png)

![A miss holds GOT AWAY before the chase starts again](fullswing-r9/miss.png)

### Round 10 — 2026-10-21 — rubric v1

- What changed: While the purse snatcher or the sludge runner is pulling away, the chase clock stays on the fast tick even if the gap is holding steady. Closing still drops it. A miss plays a low falling sting (220 Hz down to 146 Hz, with a 73 Hz body) and does not play the win's rising brass.
- Why it helped: A steady gap used to sound like keeping pace while the card said he was pulling away, and a miss was silent next to the win fanfare. Spider-Man 2 tightens the chase music when you lose them, and a fail has its own sting. A 1280×800 play held about 40 m behind the thief: the clock stayed at full while the card said he was pulling away, and it dropped once the jog returned and the gap closed. An offline buffer put the miss lower than the win fanfare. A speaker was not used.
- Screenshots: `docs/gauntlet/fullswing-r10/clock.png`.
- Next target: performance stability (6). It is the only playability score still at 6. Frame time on a real GPU was not measured. The next change should be something a SwiftShader play can time.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 5 | Held. Golden-hour sun and ink shadows. |
| Color palette | 6 | Held. Yellow, red and sludge green still separate the HUD from the blocks. |
| Detail density | 4 | Held. Open blocks more than a dressed borough. |
| Texture and material quality | 3 | Held. Flat fills. |
| Composition and camera | 4 | Held. The chase camera still sits behind the hero. This frame is the card and the clock. |
| Atmosphere | 5 | Held. The dusk skyline has a mood. The street under the chase does not. |
| Character models | 3 | Held. Simple comic figures. |
| Animation smoothness | 4 | Scored from still frames in software GL. Continuous motion was not watched. |
| Particles and VFX | 5 | Held. No new word. The win word is unchanged. |
| UI polish | 6 | Held. The lesson and the chase still use the same ink pill. |
| Responsiveness and input latency | 7 | Held. The clock value was on the stepped frame that held the gap. |
| Controls feel | 7 | Held. The swing carry is unchanged. |
| Mission clarity | 7 | Held. The card still says he is pulling away. |
| Pacing | 7 | Held. The story route is unchanged. The clock follows the pull. |
| Fun factor | 7 | Held. The win still lands on the big word. This round changes the chase music and the miss. |
| Difficulty curve | 7 | Held. Falling behind still turns the jog into a run. The clock now follows that. |
| Feedback | 7 | Held. The miss is still the lesson card. The new sting was measured, not heard on a speaker. |
| Sound design | 7 | The fast clock stays on while he is pulling away, even with the gap held. A miss is a low falling sting, and the buffer puts it under the win's brass. A speaker was not used. |
| Variety | 7 | Held. Missions 2, 3 and 4 are still a chase, a rescue and a fight. |
| Performance stability | 6 | The 1280×800 play passed with no page errors. Frame time on a real GPU was not measured. |

- Aesthetics raw: 45 / 10 dimensions, index 45
- Playability raw: 69 / 10 dimensions, index 69
- Total: 114 / 200
- Delta vs last round: +1 (round 9 was 113). Sound design 6 → 7. Every other score held.

![The fast clock stays on while he is pulling away](fullswing-r10/clock.png)

### Round 11 — 2026-10-21 — rubric v1

- What changed: A won job in flat play hops the hero off the ground: 8 m/s up and 3.5 m/s forward, and the view widens by 6 degrees. The feet leave the ground in that same moment, because a grounded step would zero the rise. Reduced motion and a headset keep the word and do not launch. A miss does not change the hero's speed.
- Why it helped: The win was a title while the hero stood still. Spider-Man 2 throws you back into motion when a mission clears. A 1280×800 play caught the purse snatcher. The body rose from 44 m to 46.4 m, the pose was jump, the pill read GOT IT, and Mission 3 waited. A miss left the hero at the same height with no upward speed. Reduced motion kept KASPLASH and stayed on the ground. A headset was not worn.
- Screenshots: `docs/gauntlet/fullswing-r11/hop.png`.
- Next target: variety (7). Fun just moved. Missions 2, 3 and 4 are still a chase, a rescue and a fight, then the twelve clogs. Performance stays at 6. This machine has no real GPU to time, so that score is not the next round.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 5 | Held. Golden-hour sun and ink shadows. |
| Color palette | 6 | Held. Yellow, red and sludge green still separate the HUD from the blocks. |
| Detail density | 4 | Held. Open blocks more than a dressed borough. |
| Texture and material quality | 3 | Held. Flat fills. |
| Composition and camera | 4 | Held. The chase camera still sits behind the hero. The hop is in that same view. |
| Atmosphere | 5 | Held. The dusk skyline has a mood. The roof under the hop does not. |
| Character models | 3 | Held. Simple comic figures. |
| Animation smoothness | 4 | Scored from still frames in software GL. Continuous motion was not watched. |
| Particles and VFX | 5 | Held. The win word is unchanged. The hop is the body, not a new effect. |
| UI polish | 6 | Held. GOT IT is the same ink pill. |
| Responsiveness and input latency | 7 | Held. The hop was on the stepped frames after the catch. |
| Controls feel | 7 | Held. The swing carry is unchanged. |
| Mission clarity | 7 | Held. GOT IT names the job. Mission 3's card waits. |
| Pacing | 7 | Held. The hang is the same length. The hop happens inside it. |
| Fun factor | 8 | Catching the thief pops the hero 2.4 m into a jump, under the word, before the next mission. It is still one hop, not a filmed finish. |
| Difficulty curve | 7 | Held. Falling behind still turns the jog into a run. A miss still holds the lesson. |
| Feedback | 7 | Held. The word, the hang, and the lesson card are unchanged. The hop is the finish, not a new hit. |
| Sound design | 7 | Held. The cheer and the miss sting are unchanged. A speaker was not used. |
| Variety | 7 | Held. Missions 2, 3 and 4 are still a chase, a rescue and a fight. |
| Performance stability | 6 | The 1280×800 play passed with no page errors. Frame time on a real GPU was not measured. |

- Aesthetics raw: 45 / 10 dimensions, index 45
- Playability raw: 70 / 10 dimensions, index 70
- Total: 115 / 200
- Delta vs last round: +1 (round 10 was 114). Fun factor 7 → 8. Every other score held.

![Catching the thief hops the hero off the roof under GOT IT](fullswing-r11/hop.png)

### Round 12 — 2026-10-21 — rubric v1

- What changed: After the roof fight, Mission 5 is a pizza delivery. The card says to get it to a roof 70 to 160 m out, a swing or two. An odd-job pizza still runs across town. Odd-job markers stay hidden until that delivery is done, and then the clog card returns. The twelve clogs still wake the King.
- Why it helped: After the bomb, every story mission was a chase, a rescue, or a fight. Spider-Man 2 changes what you do from one mission to the next. A 1280×800 play opened Mission 5. The pill read MISSION 5 and to get the pizza to the roof, the drop was 114 m, and no odd-job markers were out. Ending the route brought FLUSH THE CLOGS back. A skip-intro run that never wins the bomb still shows FLUSH THE CLOGS 1/12.
- Screenshots: `docs/gauntlet/fullswing-r12/pizza.png`.
- Next target: feedback (7). Variety just moved. The pull-away is still a line on the card, and the miss sting was measured, not heard. Performance stays at 6. This machine has no real GPU to time, so that score is not the next round.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 5 | Held. Golden-hour sun and ink shadows. |
| Color palette | 6 | Held. Yellow, red and sludge green still separate the HUD from the blocks. |
| Detail density | 4 | Held. Open blocks more than a dressed borough. |
| Texture and material quality | 3 | Held. Flat fills. |
| Composition and camera | 4 | Held. The chase camera still sits behind the hero. This frame is the roof and the card. |
| Atmosphere | 5 | Held. The dusk skyline has a mood. The roof under the card does not. |
| Character models | 3 | Held. Simple comic figures. |
| Animation smoothness | 4 | Scored from still frames in software GL. Continuous motion was not watched. |
| Particles and VFX | 5 | Held. No new effect. The win word is unchanged. |
| UI polish | 6 | Held. Mission 5 uses the same ink pill. |
| Responsiveness and input latency | 7 | Held. The card was on the stepped frame that started the delivery. |
| Controls feel | 7 | Held. The swing carry is unchanged. |
| Mission clarity | 7 | Held. The card names the delivery and the roof. The missions were already named. |
| Pacing | 7 | Held. One more beat after the fight, then the clogs. The drop is a swing, not a hike across town. |
| Fun factor | 8 | Held. A win still hops the hero. This round changes the next mission, not the finish. |
| Difficulty curve | 7 | Held. Falling behind still turns the jog into a run. The delivery is a new job, not a new fail. |
| Feedback | 7 | Held. The card is the same kind of line. No new hit on the delivery or the pull-away. |
| Sound design | 7 | Held. Not listened to. The delivery uses the existing job start. |
| Variety | 8 | After the chase, the rescue and the fight, Mission 5 is a delivery to a roof. The twelve clogs are still the path after that. |
| Performance stability | 6 | The 1280×800 play passed with no page errors. Frame time on a real GPU was not measured. |

- Aesthetics raw: 45 / 10 dimensions, index 45
- Playability raw: 71 / 10 dimensions, index 71
- Total: 116 / 200
- Delta vs last round: +1 (round 11 was 115). Variety 7 → 8. Every other score held.

![Mission 5 asks for a pizza on a roof, not another chase](fullswing-r12/pizza.png)

### Round 13 — 2026-10-21 — rubric v1

- What changed: While a chase card says he is pulling away, the pill itself turns hot: a warm fill and a magenta edge. Closing the gap brings the cream ink pill back with the jog line. The speed rule is unchanged.
- Why it helped: Losing the gap was a sentence on the same cream chip as every other card. Spider-Man 2 marks a pursuit you are losing on the objective, not only in the words. A 1280×800 play stayed about 40 m behind the thief. The pill read that he was pulling away, and its fill and edge measured as the warm card (`#ffd6c4`, magenta `#d8457a`). Coming back in, the line said to run him down and the magenta edge was gone.
- Screenshots: `docs/gauntlet/fullswing-r13/hot.png`.
- Next target: pacing (7), tied with responsiveness, controls, mission clarity, difficulty, and sound. Pacing is the one to change next: the story is four beats, then twelve of the same clog. Sound was not the round. Performance stays at 6. This machine has no real GPU to time, so that score is not the next round.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 5 | Held. Golden-hour sun and ink shadows. |
| Color palette | 6 | Held. Yellow, red and sludge green still separate the HUD from the blocks. The hot card uses the magenta already in the HUD. |
| Detail density | 4 | Held. Open blocks more than a dressed borough. |
| Texture and material quality | 3 | Held. Flat fills. |
| Composition and camera | 4 | Held. The chase camera still sits behind the hero. This frame is the card. |
| Atmosphere | 5 | Held. The dusk skyline has a mood. The street under the chase does not. |
| Character models | 3 | Held. Simple comic figures. |
| Animation smoothness | 4 | Scored from still frames in software GL. Continuous motion was not watched. |
| Particles and VFX | 5 | Held. No new word or trail. The card is the change. |
| UI polish | 6 | Held. The hot state is a fill and an edge on the same pill. |
| Responsiveness and input latency | 7 | Held. The hot class was on the stepped frame after the line changed. |
| Controls feel | 7 | Held. The swing carry is unchanged. |
| Mission clarity | 7 | Held. The line already said he was pulling away. The color repeats that line. |
| Pacing | 7 | Held. The story route is unchanged. The card follows the pull. |
| Fun factor | 8 | Held. A win still hops the hero. This round changes the chase card, not the finish. |
| Difficulty curve | 7 | Held. Falling behind still turns the jog into a run. The card now shows that. |
| Feedback | 8 | Losing the gap turns the card hot, and closing the gap puts the ink pill back. It is a color, not a hit. |
| Sound design | 7 | Held. Not listened to. The fast clock and the miss sting are unchanged. |
| Variety | 8 | Held. Mission 5 is still the delivery after the fight. |
| Performance stability | 6 | The 1280×800 play passed with no page errors. Frame time on a real GPU was not measured. |

- Aesthetics raw: 45 / 10 dimensions, index 45
- Playability raw: 72 / 10 dimensions, index 72
- Total: 117 / 200
- Delta vs last round: +1 (round 12 was 116). Feedback 7 → 8. Every other score held.

![Pulling away turns the mission card hot](fullswing-r13/hot.png)

### Round 14 — 2026-10-21 — rubric v1

- What changed: The fourth flush starts UP FOR AIR, a balloon to bring back. The eighth starts GET HIM DOWN, a washer to carry to the street. The card names that job until it ends, then FLUSH THE CLOGS returns with the count. Three flushes, and the flushes between the beats, stay on the clog card. One flush does not start a beat. All twelve still wake the King. A beat waits while a story mission is running.
- Why it helped: After the story, the path to the King was twelve of the same pump. Spider-Man 2 breaks a long list with a different activity, then hands it back. A 1280×800 play flushed three clogs and the card stayed FLUSH THE CLOGS 3/12. The fourth named the balloon. Bringing it back returned the clog card at 4/12. Seven stayed on the clog card. The eighth named the washer, a carry, not the balloon. A skip-intro run that flushes one clog still shows FLUSH THE CLOGS 1/12.
- Screenshots: `docs/gauntlet/fullswing-r14/balloon.png`, `docs/gauntlet/fullswing-r14/washer.png`.
- Next target: difficulty curve (7), tied with responsiveness, controls, mission clarity, and sound. Difficulty is the one to change next: the later breather is the same 60 s grip as an odd-job washer, so the clog run does not get tighter. Sound was not the round. Performance stays at 6. This machine has no real GPU to time, so that score is not the next round.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 5 | Held. Golden-hour sun and ink shadows. |
| Color palette | 6 | Held. Yellow, red and sludge green still separate the HUD from the blocks. |
| Detail density | 4 | Held. Open blocks more than a dressed borough. |
| Texture and material quality | 3 | Held. Flat fills. |
| Composition and camera | 4 | Held. The chase camera still sits behind the hero. These frames are the card. |
| Atmosphere | 5 | Held. The dusk skyline has a mood. The roof under the card does not. |
| Character models | 3 | Held. Simple comic figures. |
| Animation smoothness | 4 | Scored from still frames in software GL. Continuous motion was not watched. |
| Particles and VFX | 5 | Held. No new effect. The beats use the jobs already in the city. |
| UI polish | 6 | Held. The beats use the same ink pill. |
| Responsiveness and input latency | 7 | Held. The new card was on the stepped frames after the flush. |
| Controls feel | 7 | Held. The swing carry is unchanged. |
| Mission clarity | 7 | Held. The card names the balloon, then the washer, then the clogs again. The missions were already named. |
| Pacing | 8 | The fourth flush is a balloon and the eighth is a carry, and the clog card comes back between them. The other ten are still the same pump. |
| Fun factor | 8 | Held. A win still hops the hero. This round changes when the next job starts, not the finish. |
| Difficulty curve | 7 | Held. Falling behind still turns the jog into a run. The washer on the eighth flush has the same 60 s grip as an odd job. |
| Feedback | 8 | Held. A chase that is pulling away still turns the card hot. The beats did not add a new hit. |
| Sound design | 7 | Held. Not listened to. The beats use the existing job start. |
| Variety | 8 | Held. The balloon and the washer were already jobs. This round is when they show up in the clog run. |
| Performance stability | 6 | The 1280×800 play passed with no page errors. Frame time on a real GPU was not measured. |

- Aesthetics raw: 45 / 10 dimensions, index 45
- Playability raw: 73 / 10 dimensions, index 73
- Total: 118 / 200
- Delta vs last round: +1 (round 13 was 117). Pacing 7 → 8. Every other score held.

![The fourth flush is a balloon to bring back](fullswing-r14/balloon.png)

![The eighth flush is a washer to carry down](fullswing-r14/washer.png)
