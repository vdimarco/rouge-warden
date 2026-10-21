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
