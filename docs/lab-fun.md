# The lab: what makes each game fun

This note is a fun audit of the twelve games that the Lab page lists, in the way that [drain-fun.md](drain-fun.md) audits Down the Drain. It has four parts:

1. How we checked the games.
2. How each game measured up.
3. What changed.
4. What is still open.

## 1. How we checked

Six reviewers played every game in Chromium, first on a 390×844 phone screen with touch and then on a 1280×800 desktop. They read the code and ran each game's tests. Where a number could settle a question, they wrote a bot or a sim: how long a run lasts, whether a careful player beats a careless one, and how much warning comes before a hit.

Each game got a score against the first seven points of the bar in [game-ideas.md](game-ideas.md). The eighth point, "the crew decides", needs the crew.

## 2. How the games measured up

P is a pass, W is weak, and F is a fail.

| Game | 1 Toy | 2 Depth | 3 New | 4 Short runs | 5 Moment | 6 Share | 7 Fair | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Threadwake | F | F | F | F | F | W | W | Rethink |
| Borrowed Bodies | W | F | F | W | F | F | W | Rethink |
| Neon Ronin | W | W | W | W | W | F | F | Rethink |
| Foldwild | W | F | F | W | W | W | W | Invest |
| Storm Choir | W | F | F | W | F | W | W | Invest |
| Loon Echo | W | F | F | W | F | F | P | Invest |
| Take the Plunge | W | P | W | W | W | P | W | Invest |
| House Rules | W | W | P | W | W | W | W | Invest |
| Full Tilt | W | F | F | W | P | F | W | Polish |
| Season Thief | W | F | W | W | F | W | W | Polish |
| Heartship | W | W | W | W | F | W | W | Polish |
| Up the Creek | W | W | W | W | F | F | F | Polish |

The same few problems came up again and again:

- **Runs that end in seconds, or that you cannot lose.** A Threadwake run took 4 to 8 s, Borrowed Bodies 5 to 15 s, Loon Echo 10 to 20 s and Storm Choir about 25 s.
- **A top score on the first run.** In Threadwake, Borrowed Bodies, Storm Choir, Foldwild and Loon Echo, a simple bot gets the top score. A careful player has nothing more to reach for.
- **Seeds that change almost nothing.** In most of Small Worlds, Loon Echo and Full Tilt, the seed moves a few things a few pixels. Run 50 is run 1.
- **An end that hides the ending.** In Small Worlds the result card covered the scene on the same frame as the finish. Most end cards gave a score with nothing to compare it with.
- **Warnings that come late, or only to the eye.** Full Tilt lit "FLIP NOW" 0.05 to 0.25 s before the ball arrived. Up the Creek warned of a capsize a median 0.16 s ahead. Neon Ronin's ronin attacked from off screen. Heartship's hazards made no sound.
- **One mistake that turns into a spiral.** In Take the Plunge, a skim on the lake bed cost most of your speed, and a beginner then thudded into shore after shore. In Loon Echo, a rock pinned the loon and drained its hearts. In Up the Creek, a capsize sent you back to the top of the river.

## 3. What changed

Each game first got the bug fixes from its review, and then the changes that add the most fun for the effort. The numbers come from the same bots and sims before and after the change.

**The Small Worlds shell.** When a world ends, the scene keeps moving for 1.6 s at half speed with input off. Then the result card rises from the bottom and says how the score compares with your best. A loss plays a falling note. Each world opens on today's seed, so the crew plays the same world each day.

**Threadwake.** The thread now keeps its length, so the creature swings like a pendulum, and a release keeps the swing's speed. The flowers climb an endless seeded tower, a mist rises and ends the run, a crown waits every 100 m, and a ghost of your best run on the seed flies beside you. Before, a bot reached the top score in about 4 s, and no run could end. Now an expert bot climbs 820 to 1,158 m in 3 to 4 minutes, and a beginner bot gets 23 to 67 m in about a minute.

**Borrowed Bodies.** The spark flies on a real arc that adds the motion of the body it leaves, and a miss costs light. The bodies climb an endless seeded forest, and light drains as you go. Before, every run took 4 to 5 s and got the top score. Now an exact aimer climbs 3,007 to 3,368 m, a human-like aimer 1,107 to 1,394 m, and a sloppy one 192 to 444 m.

**Foldwild.** Each seed makes its own sheet. The water races you, spills at open edges with a warning 0.5 s before, and a path home adds 15 s and brings the next, bigger sheet. Before, every seed had the same answer, and four known seeds started solved. Now 500 seeds give 500 different sheets, and none starts joined.

**Season Thief.** Each seed makes a garden with its own rules and a par. Dragging the timeline shows the change at once, and every choice costs time. Before, there were 4 gardens and the budget never mattered. Now 1,000 seeds give 986 gardens with a par of 4 to 6, and the end card gives stars against par.

**Neon Ronin.** A ronin now attacks only when it is in reach and on screen. Every windup warns with a rising tone, a red edge and a buzz, and a parry opens the guard at once with a freeze and slow motion. The menu fits a phone, and every day brings a new duel. In a model of a touch player, 3 of 27 windups started on screen before, and all 27 do now. A new touch player lasted 22 to 24 s before, and 88 to 386 s now. The tests work again: 29 in Node and 18 in the browser.

**Loon Echo.** Rocks now block without damage. Each full nest hatches a harder clutch, only a warned strike costs energy, and a bank of four or more gets slow motion. Every day brings a new lake. Before, runs lasted 10 to 20 s, and a simple bot got the top score. Now the careful bot's median run is 260 s, and the greedy bot's scores spread from 21,150 to 58,450.

**Take the Plunge.** A skim on the lake bed now costs 8% of your speed once, instead of most of it. A green cue says when a hold will rip, thuds warn up to 0.8 s ahead, the first burst of each run is a slow-motion peak, and the sky turns from sunset to the northern lights as you fly. Before, a lake-diving bot flew 376 m in 49 s, no farther than a bot that never touched the screen. Now it flies 937 m in 88 s.

**Up the Creek.** Every capsize now warns at least 0.32 s ahead, and a swim puts you back near the swim. Eddies show a ring that fills, and a stroke frees the canoe from any eddy. Thumbs and keys turn the way you press, and a ledge at the end gives a slow-motion boof. Before, only 12% of eddy-line capsizes had 0.3 s of warning, and a canoe facing downstream stayed stuck in 36 of 87 eddies. Now every one of those capsizes has the warning, and such a canoe stays stuck in 2 of 93 eddies.

**House Rules.** Every tool fits a phone, and a tap hits what you aim at. A friend races the maker's time on a live clock and can send a time back or remix the layer. The death card says how far down you got, and Settle shows propane tanks blow up. The Down the Drain side changes 4 lines, each behind `Custom.on`.

**Storm Choir, Heartship and Full Tilt.** Their changes land later in this pass.

## 4. What is still open

- **The crew test.** Nobody has played these changes on a real phone. The bots measure timing, reach and run length. Only the crew can say whether a game is fun (bar point 8).
- **Sound on a phone speaker.** The tests check that each action plays a sound, not how it sounds.
- **Frame rate on a phone.** The mist at the Up the Creek ledge draws about 48 frames a second in a desktop browser with no graphics card.
- **Down the Drain in a painted layer.** On a 390 px phone, the game's top bar runs off the right edge, and "Depth 1" means nothing in a painted layer.
