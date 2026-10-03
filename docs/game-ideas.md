# New games: the bar and the ideas

This note sets a bar for new games in the Cottage Arcade and lists ideas that could meet it. It has six parts:

1. The bar: what "still fun on the hundredth run" means here.
2. How we check a new idea before a full build.
3. Eight ideas, best first.
4. Ideas for every cabinet.
5. Ideas we dropped because a game already does them.
6. The toys in the lab.

## 1. The bar

A new game must meet all eight points. The research behind the bar is in [drain-fun.md](drain-fun.md).

1. **Toy test.** The core move is fun with no goal. A new player keeps at it for 2 minutes with no instructions.
2. **Depth.** An expert run looks different from a beginner's run, and the skill has no clear top.
3. **New situations.** Run 50 holds something that run 1 did not. The source can be a seed, systems that collide, friends, or Jev.
4. **Short runs.** A run lasts 1 to 6 minutes. A restart takes less than 2 s. The end screen shows how close you came.
5. **A breathtaking moment in every run**, such as a vista or a slow-motion peak.
6. **Something to share:** a daily seed, a ghost link, or initials on the cabinet.
7. **Fair and juicy.** A warning comes at least 0.3 s before a hit, in two senses. Every action gets feedback.
8. **The crew decides.** A toy goes to a full build only when people ask for another go without a prompt.

## 2. How we check a new idea

1. Build a toy. A toy has the core move, sound and feedback. It has no menus and no painted art.
2. Put the toy on the preview URL.
3. Give it to the crew on their phones. Do not explain it first.
4. Watch for points 1, 2 and 8 of the bar. If the toy fails one of them, change it or drop it.
5. If the toy passes, build the full game: the endless engine (seeds and ghosts), the look, the music and the cabinet.
6. Do a fun audit like [drain-fun.md](drain-fun.md), and add bots in `qa/`.
7. Test the speed on phones before the game goes into the arcade.

## 3. The ideas

### 3.1 Take the Plunge

You are a loon, and winter is coming. Fly south across the lake country.

- **What you do.** Hold to tuck your wings and dive. Let go to glide. Hit a lake at a steep angle and you slice in with no splash, race under the water through a school of fish, and burst out faster than you went in. A flat landing is a belly-flop.
- **Why it lasts.** Each lake is a dive to judge: the angle in, the line under the water, and the angle out. The lakes change every day, and the whole crew flies the same ones. Each clean entry adds a loon to your V. Winter follows you as a white wall and freezes the lakes behind you, so a run lasts 1 to 6 minutes. A link lets a friend race your ghost.
- **Breathtaking.** The burst out of the water into the sunrise, in slow motion, and the V of loons against the sunset.
- **New.** We found no game where diving into water gives you speed. Tiny Wings builds speed on hills, and its water slows you down.
- **In the style of** Tiny Wings and Alto's Odyssey, with the painted look of Breath of the Lake.
- **Reuse.** `Painter` in `public/wild/js/post.js`, and the loon voice in `public/fish/js/audio.js`.
- **Size.** Small.

### 3.2 Up the Creek

Your phone is the canoe paddle.

- **What you do.** Tip the phone to one side and rock it to take a stroke on that side. Twist it at the end of the stroke for a J-stroke. Hold it tipped hard to brace. Run a new river every day.
- **Why it lasts.** Real whitewater skills are hard: the ferry, the eddy turn, the peel-out and the boof off a ledge. Rivers come from a seed. Slalom gates, some of them upstream, test the technique. A long trip links rivers with portages, where you tilt the phone to balance the canoe on your head. Later, two players can share a tandem canoe.
- **Breathtaking.** A slow-motion drop over a falls, through a rainbow in the mist.
- **New.** We found no game that uses the phone's motion as the paddle. [Paddle Panic](https://futuregames.itch.io/paddle-panic) is a raft game played on the touch screen.
- **Reuse.** `Motion` and `Haptics` in `public/fish/js/`. The river, the flow and the canoe are new work: no code in the repo floats a boat today.
- **Size.** Large.

### 3.3 Full Tilt

A pinball machine made from the other cabinets.

- **What you do.** Flip with the two halves of the screen. Shake the phone to nudge. Shake too hard and it tilts. The ball launcher is the plunger, which is its real name.
- **Why it lasts.** Pinball skill has no top: the cradle, the post pass, the live catch and the nudge save. Each mode is a goal, and a wizard mode waits at the end. High scores go on the cabinet with initials. A daily rule changes one thing.
- **Modes.** The Porcelain King swallows balls for Flush Multiball. Neon Gabe throws a punch, and a flip at the neon flash parries it. The dock ramp hooks the ball for a Reel It In mode. Beat a mode and a trophy lights up on that game's cabinet.
- **Breathtaking.** The Porcelain King rises out of the playfield, and in the wizard mode the whole table floods.
- **New.** The modes are the arcade's own games.
- **Reuse.** `public/chip.js` for the music on the score display, and Higgsfield for the playfield art and the toys on it.
- **Size.** Medium to large. The feel of the flippers is the risk.

### 3.4 House Rules

You are the Cottage, the director that builds the levels in the other games.

- **What you do.** Build a Down the Drain layer: pour lava, stack sand over water, hide propane tanks and place critters. Clear the layer yourself before you can share it, as in Mario Maker. Then send the link to the crew.
- **Why it lasts.** The players make the levels. The whole layer fits in the link, so no server is needed. A later version adds a drama score from the run log: close calls and comebacks score high, and a hit with no warning costs points. The fair-play rules become the score.
- **Breathtaking.** A sand dam gives way under the hero, and the lake comes down.
- **New.** Noita has no level maker. Its players share levels only through mods.
- **Reuse.** The sand simulation in `public/fall/index.html`, and its run log.
- **Size.** Medium.

### 3.5 Make a Splash

Dock sports on one phone that you pass around.

- **What you do.** Skip a stone with a sidearm flick. Throw an axe. Tuck at the right moment for the biggest cannonball. Balance on a rolling log.
- **Why it lasts.** Each event is short and hard to master, and the crew is the opponent. It needs no network.
- **Breathtaking.** A stone that skips 20 times across a gold lake, in slow motion.
- **Reuse.** `Motion`, and the cast math in `public/fish/js/cast.js`.
- **Size.** Small for each event.

### 3.6 Roast

A party night for the crew.

- **What you do.** The TV shows the campfire, and each phone is a controller. Jev hosts: it picks the prompts, judges the answers and roasts the winner. The rounds include Who Ate the Last Hot Dog? (one player is secretly the thief), Critter Sketch, Cottage Feud and Loonie Auction.
- **Why it lasts.** Other people make every round different.
- **Reuse.** `api/warden.js` takes the players' answers as options, so Jev can judge them with no change to the function.
- **New work.** A live link between the phones (the repo has no networking today), and a filter for what players type.
- **Size.** Medium, plus a new service.

### 3.7 Make Waves

Two-minute wakeboard runs behind the cottage boat, in the style of Tony Hawk's Pro Skater. Cut across the wake for air, grind the dock rail, hit the kicker on the floating outhouse, collect L-O-O-N-I-E, and chain it all into one combo. A combo score has no top. The size is large, because the tricks need a lot of animation.

### 3.8 Bug Out

One night of skeeters, in the style of Vampire Survivors. The cottage fights for you with a bug zapper, citronella smoke, a box fan and fireflies. Many games do this. It is on the list because it is quick to build.

## 4. Ideas for every cabinet

- **A daily seed** on every cabinet, and a card that shares the result with the crew's initials.
- **Ghost links.** A run is its seed plus your inputs, so it fits in a URL. A friend opens the link and races you. No server is needed.
- **A prize counter** in the arcade. Tickets from any game buy hats, paddles, lures and flippers that show up in every game.
- **Jev's relics.** Jev builds new relics for Down the Drain and Get Plunger'd from lists of parts. For example, it picks "when you roll" and "the ground catches fire", then gives the relic a name. `api/warden.js` already works by picking from lists, so the function does not change.

## 5. Dropped because a game already does it

| Idea | Game that does it |
| --- | --- |
| Tetris with water: build a dam before the flood | [Wetrix](https://en.wikipedia.org/wiki/Wetrix) (1998), [Floodgates](https://newbhope.itch.io/floodgates) |
| Cribbage in the style of Balatro | [Cribbish](https://morehexagons.com/review-cribbish/) |
| A water bomber against a spreading fire | [Wetline - Fire Break](https://store.steampowered.com/app/4801080), [Rescue Ops: Wildfire](https://store.steampowered.com/app/2915770/Rescue_Ops_Wildfire/) |
| Curling where you rub the screen to sweep | [Curling Chaos](https://apps.apple.com/us/app/-/id6758259377) |
| Tubing | [Tube Jumpers](https://www.crazygames.com/game/tube-jumpers), [Toobin'](https://en.wikipedia.org/wiki/Toobin') (1988) |

## 6. The toys in the lab

The lab is at `/lab/`. The arcade has a Lab machine for it and a machine for each toy, and the game switcher lists them. Each toy has only the core move.

| Toy | Path | The question for the crew |
| --- | --- | --- |
| Take the Plunge | `/lab/plunge/` | Do you want one more dive after the 50th lake? |
| Up the Creek | `/lab/creek/` | Does the phone read your strokes? Does a caught eddy feel like a safe harbour? |
| Full Tilt | `/lab/tilt/` | Do the flippers feel like a real machine? Can you cradle the ball and pass it? |
| House Rules | `/lab/rules/` | Is it fun to build a trap and watch a friend fall into it? |

The lab page shows how long you played each toy. Tell the crew your times, and whether you wanted another go.

## Sources

- [Tiny Wings](https://en.wikipedia.org/wiki/Tiny_Wings)
- [Endless Migration 2](https://www.gameflare.com/online-game/endless-migration-2/), a flock game with no diving
- [Paddle Panic](https://futuregames.itch.io/paddle-panic)
- [Noita and its mods](https://playwanderer.online/game-reviews/noita)
- [A falling-sand level editor, built for one game's own team](https://www.slowrush.dev/news/falling-sand-level-editor/)
