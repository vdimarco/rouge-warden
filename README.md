# Get Plunger'd: Cottage Brawl

A fast top-down roguelite for the crew, in the style of Enter the Gungeon. Pick your guy, grab a plunger, and fight across the cottage: the dock, the cabin, the trail, and the beach, six areas a day, then the Porcelain King in the outhouse. The cottage is the director. It builds every area, picks your rewards and wildlife, and remembers how you play. On the live site, [Jev](https://jevapi.dev/) makes those choices through Vercel AI Gateway.

Rename the crew in the `FRIENDS` list near the top of the game script in `public/plungerd/app.js`.

## The arcade

The site opens on the Cottage Arcade, a room of old-school cabinets. Click anywhere on a machine to play it: a token drops in, and the game starts. If you are out of tokens, it plays on free play. You can also drag a token into a coin slot, or tap the slot, then press Start. The screen powers on and grows to fill the window, and the game loads. Every game has a machine. Get Plunger'd lives at `/plungerd/`, Down the Drain at `/fall/`, Cottage Brawl at `/brawl/`, Breath of the Lake at `/wild/`, Reel It In at `/fish/`, In Full Swing at `/vr/`, Olympus at `/olympus/`, Crimson Rogue at `/crimson/`, Shore of the Ancients at `/tidebreak/`, Moonwell at `/moonwell/`, BREAKTHROUGH at `/breakthrough2/`, and Follow Suit at `/follow-suit/`. The lab has machines too: The Lab (`/lab/`), Small Worlds (`/lab/worlds/`), Neon Ronin (`/neon/`), Loon Echo (`/echo/`), Tell Me (`/tellme/`), and the four lab toys, Take the Plunge, Up the Creek, Full Tilt and House Rules. The older BREAKTHROUGH page at `/breakthrough/` has no machine: the machine opens `/breakthrough2/`.

- Down the Drain opens on a pixel-art title screen in the game's own look: a 16-bit cutaway of the cottage and the caves under it, a chunky gold logo, "Press any button", a menu in a pixel frame, and a hero select with pixel-art hero cards. Its own 8-bit theme plays from the first press.
- The arcade's browser icon is a pixel-art plunger and a gold token on a purple tile.
- The arcade plays its own 8-bit theme song. It starts with your first tap or key press, and the sound button turns it off.
- On a keyboard, the arrow keys pick a machine, 5 drops a token, and 1 or Enter starts, like an emulator.
- You start with 3 tokens. The change machine gives you more.
- The machines stand in four groups: Cottage, Action, Strategy and Lab. The pills under the sign jump to a group, and the list under the machines names every machine. The pills show Cottage, Action and Strategy; **LAB ↗** goes straight to the lab page. New machines go at the end of the row, because the page counts them in order. Add the game to a group in the `GROUPS` list in `public/index.html`, or it shows under **More**.
- A machine's screen is a picture from the real game, saved as a WebP file in `public/arcade/` (480 pixels wide, under 60 KB), or a small canvas. The line on the screen reads that game's own save in your browser. A missing or broken save keeps the plain line.
- The ◀ ▶ arrows at the sides switch machines on every screen. You can also swipe, drag with the mouse, or use the scroll wheel or a trackpad. On a phone, and on any screen too narrow for the whole row, you see one machine at a time in the middle, and the row slides.
- Every game's menu has a **Switch game** button. It lists every game that has a machine, marks the one you are playing, and jumps straight to another game or back to the arcade. The two buttons at the bottom stay in view while you scroll the list. The list lives in `public/arcade/switch.js`. When one game's address starts with another's (`/lab/worlds/` and `/lab/`), the longer one is the game you are playing. Only some game menus have the button so far. To add the button to a game, load that script and give a menu button the `data-switch` attribute. Breath of the Lake (`/wild/`) is already on the list: its tile shows as soon as that game is live.
- Each screen shows your best run from that game, saved in your browser. Down the Drain shows its high score and the initials of the player who set it.

Sound stops when a page is hidden. On a phone, a tab you leave, a browser you minimise, or a locked screen can keep playing music. `public/arcade/quiet.js` stops it for every game. It keeps track of every `AudioContext`, `<audio>`, and `<video>` that a page makes, and of the SoundCloud songs in Get Plunger'd and Crimson Rogue. When the page is hidden, it suspends them. When the page is visible again, it starts only what it stopped, and a game that suspends its own sound keeps control of it. Each game page that makes sound loads it first in `<head>`: `<script src="/arcade/quiet.js"></script>`. A new game must do the same. In Full Swing (`/vr/`) does not load it. Its own code stops the sound when a headset session is hidden, and when the page is hidden on a phone. To test it, serve `public/` and run `node qa/arcade/quiet.mjs`. It fails when a page with sound does not load the script first. It also opens each game, hides the page, and checks that the sound stops and comes back.

## Play

Deploy to Vercel, or serve `public/` from any static server and open it in a browser. Opened locally, a built-in stand-in answers for Jev.

- The How to play card, and the How to play chip on the title screen, show a short clip of each move.
- Move with WASD. Keep moving to break into a sprint.
- Aim with the mouse and hold the left button to shoot. The aim keeps following the mouse, even after it leaves the window, and you can keep running with the keys.
- Roll with Space or the right button. You can't be hit while you roll.
- E blows the air horn and clears every bullet.
- Q or 1 to 4 switches guns.
- R reloads. Tap R again in the gold part of the bar to reload at once and heat up the next clip.
- On a phone with "One hand" on, drag anywhere to move and you shoot the nearest critter on your own. Flick to roll, tap the air horn to clear bullets, and tap your gun to switch. With "One hand" off, the left thumb moves and the right thumb aims and shoots.

### The look

The world of Get Plunger'd is painted. GPT Image 2.5 on Higgsfield painted the art, and scripts cut it, lined it up, and packed it. The files are in `public/plungerd/art/`.

- Each stop has its own painted ground, wall faces, and wall tops. The ground tiles with no seams, and big soft patches hide the repeat. Walls throw soft shadows on the ground. On the dock and the lake, the water is the wall: you see the side of the dock, or the sand bank, where the ground drops into the water.
- Every critter has a painted sheet with eight walk frames and an attack pose. The black bear, the Porcelain King, Baby Charlie, the Goose Lord, and the Snapping Titan have their own sheets.
- Props, rugs, decals, guns, shots, pickups, chests, and effects are painted too. The effects are muzzle flashes, blasts, hit stars, puffs, splashes, lightning, and stink clouds.
- A light map gives each stop a mood: a rainy night downtown, dusk on the 401, shade under the pines, lamplight at the cottage, sunset on the dock, and a bright day on the water. The player, lamps, doors, muzzle flashes, blasts, and bullets carry light. Outdoors, cloud shadows drift over the ground.
- Phones load the half-size files (`.sd.webp`). The ground and wall images stay out of GPU memory: each day paints a copy scaled to the map. A stop's art loads while the Cottage plans the day, and the next stop's art loads in the background.
- If a file does not load, the game draws that thing in code, as it did before.

## Down the Drain

Down the Drain is a spin-off at `/fall/`, with the same crew, critters, and bosses as Get Plunger'd. The outhouse backed up, and the ground under the cottage is now a falling-sand world. Every pixel moves. Sand and gold fall. Water, oil, lava, drain cleaner (acid), sewage, and blood flow. Fire spreads through wood, moss, oil, and swamp gas. It plays like a fast action roguelite in the style of Dead Cells, dropped into a Noita-like world.

A link from House Rules (`/fall/#L=...`) opens a layer that a player painted. See [The lab](#the-lab).

### Levels

Each layer is 1024 pixels wide and 720 tall, so it is wider than it is tall. It is a web of rooms, not one line:

- An entry room sits under the hole. Below it, rows of four to six rooms spread across the whole width.
- Each open room leads down to one or two rooms near it. Some rows also have side passages, so you can cross over to another way down.
- About one room in five is a dead end: you can get in, but there is no way on. Dead ends hold a cooler or a heap of gold. Blind tunnels also run off into the dirt, and some end in gold.
- Every open way meets again in one last room above the two drains. That room is the sealed room that opens the drains.
- The compass follows the shortest way through the web.
- Each layer picks a style: an even web, rooms that wander, or mostly huge caverns.

The layer is bigger, so each critter the Cottage picks comes twice, and the fast-drain timer is 60% longer. The minimap shows the whole width.

About half the rooms are cave shapes drawn on Higgsfield as black-and-white cross sections: a stalactite cathedral, a sinkhole, worm burrows, a lake basin that fills with the layer's liquid, an old mine, a root chamber, terraces, a crystal geode, stone arches over a pit, and a zigzag fissure. They are stored as small grids and stamped at a random size with rough edges. Short tunnels join the middle of each cave to every tunnel mouth, so the way through stays open. Tunnels bend on the way between rooms.

### Fair play

Research on what makes action games fun, and how this game was tuned against it, is in [docs/drain-fun.md](docs/drain-fun.md). In short:

- A hit knocks you back and gives you 0.8 s of safety.
- Every attack has a wind-up you can see and hear, and it glows through the dark.
- Hazards make a sound and show red damage numbers.
- Propane tanks hiss on a fuse before they blow.
- The boss shudders before it slams, then stays down for a moment. It drops a scroll and a rich cooler when it dies.
- Digging warns you before the ground answers.
- A death keeps half your caps for the next run.
- Once the drains open, arrows at the screen edge point to them.

### Movement and physics

- Jumps: tap jump for a short hop, or hold it for the full jump. Falling pulls harder than rising, and the top of a jump hangs for a moment.
- Turns: turning around bites harder than speeding up.
- Corner correction: a jump that clips the edge of a ceiling slides around it.
- Slopes: walking down a slope keeps you on the ground.
- Walls: push into a wall in the air to slide down it slowly, then jump off it.
- Debris: blasts throw bits of the ground, which bounce off walls and settle as the same material where they land.
- Smooth motion: the hero and the critters are drawn between physics steps. They squash when they land, stretch when they leap, bob and lean as they run, and turn smoothly.

### Graphics

There are two looks. Painted, the default, draws the ground with pixel-art textures made on Higgsfield: cobbles, mossy stone, packed earth, roots, bones, gold nuggets, iron plates, and porcelain tile. Each layer also gets its own back wall: cellar stone, septic tank tile, crawlspace boards, or sauna brick. The textures are pinned to the world, so when you dig, you cut through them. Top edges catch the light, and edges next to open air go dark, like an outline. In Painted mode the crew, the critters, and the bosses are pixel-art sprites made on Higgsfield, with walk and attack frames. They draw at two pixels per world cell with a dark one-pixel outline, so they sit on the same grid as the ground. Classic draws each material in four flat shades and keeps the old character art. Switch with the brush button in the top bar, the G key, the Graphics item on the title menu, or the button in the Stats sheet. The game remembers your choice.

### The loop

- **Learn the moves.** The title screen plays short clips of each move: hit, roll, pound, shoot, and dig.
- **Pick a friend and a weapon.** Each of the five friends has a perk. You start with the Plunger, or with any weapon you have unlocked.
- **Fight your way down.** Each layer is a route of rooms down to the drains. Some rooms slam shut with screen doors until two waves of critters are dead. The drains stay clogged until the last of those rooms is clear. If you dig around it, the fight comes to you at the drains.
- **Collect caps.** Critters, nests, and sealed rooms drop bottle caps. At the snack bar between layers, spend caps at the tab on unlocks that stay between runs: new weapons, more hot dogs, a better starting shovel, pocket money, a starting scroll, and a second wind. Caps you still carry when you go down are lost.
- **Choose your drain.** Each layer ends at two drains. Each one is labeled with the look of the next layer, and one is richer and harder: more relics and gold, but more critters and one more sealed room.
- **Go fast.** Reach the drain before the timer runs out for bonus caps and gold.
- **Take risks.** From the second layer on, a cooler can be cursed. It holds a weapon, a scroll, and a pile of gold, but any hit takes you down until you beat 10 critters.
- **Grow the build.** Scrolls of power raise Muscle (melee), Aim (gun), or Grit (health). Relics dug out of the walls change the run: Hot Sauce, Energy Drink, Bug Spray, Lucky Loonie, Sunscreen, Flip Flops, Snorkel, Work Gloves, Car Keys, TV Remote, the Golden Plunger, and Lost Sunglasses.
- **Chase a rank.** Kills fill a streak meter from D (Damp) up to SS (Sasquatch), as in Devil May Cry. The meter drains fast when you stop killing, and faster at high ranks. A hit knocks you down a rank. Mix your moves: the same kind of kill again and again earns less each time, so crits, pounds, shots, and air hits climb fastest. A higher rank multiplies your caps and your score, up to ×2.5.
- **Take a gift.** Each sealed room you clear brings a gift from a cottage animal, as in Hades. Pick one of three: Bear Paw, Sunburn, Loon Wake, Skeeter Bite, Moose Hide, Thunder Bay, Firefly Pop, Beaver Teeth, Campfire Story, or Chipmunk Cheeks. A gift you already have goes up a level, to level 3. Jev picks which three show up, to fit how you play.
- **Grab the Golden Plunger.** Once a layer, after about ten kills, a Golden Plunger drops, like the power pellet in Pac-Man. For 8 seconds the critters glow blue, run from you, and cannot hurt you. Your hits deal triple damage, and each kill scores double the last: 200, 400, 800, 1600.
- **Beat the high score.** Kills, sealed rooms, depth, bosses, and gold add to your score. A top-10 score asks for your initials, and the best score shows on the Down the Drain cabinet in the arcade.
- **Beat the bosses.** Every fourth layer ends at a boss: the Porcelain King, then Gabe the Mountain Man, Christian the Mystic, and Ryu.

### Combat

Your melee weapon swings in combos, and each weapon crits in its own way:

| Weapon | Combo | Crits |
| --- | --- | --- |
| Plunger | 3 quick hits | On the last hit |
| Canoe Paddle | 2 slow, wide hits that knock critters flat | On stunned critters |
| Hockey Stick | 4 fast hits | On burning or poisoned critters |
| Fishing Rod | 2 hits with the longest reach | With the tip |
| Frying Pan | 1 heavy clang that stuns | On critters in the air |

A swing knocks critter spit out of the air. The dodge roll dodges every hit and passes through critters. In the air, hold down and hit to pound the ground, which stuns everything near where you land. Hits pause the game for a moment, so they land hard. Seagulls flash before they spit, geese before they dash, and moose lower their heads before they charge. Hot dogs heal almost half your health, and the snack bar refills them.

Your gun is the second weapon. Each gun fires its shots from left to right, then reloads, and each gun has its own slots, pressure, fire rate, and spread. You carry up to three.

### Digging and the world

Hold F and push a direction to dig with your shovel, or push nothing to dig toward the mouse. Each swing cuts a chunk of tunnel your size, and an outline shows where the next swing will cut. Soft ground breaks in one swing. Rock, metal, and porcelain crack over several swings. Digging tires you: the brown bar is your stamina, and it refills only when you stop. Digging is also loud. Critters nearby come for you, and if you keep at it, the ceiling caves in or critters dig their way to you. The garden shovel tires fast and takes six swings for rock. The steel spade and the power auger swing faster, cut farther, and tire you less. Better shovels come from the snack bar and from coolers.

The ground holds junk from the cottage: canoes, tires, old toilets, fridges, bike wheels, bottles, boots, lawn chairs, fish bones, and signs. Relics glint through the dirt. Water pipes run along the ceilings and leak where you shoot or dig them, and the water puts out fires. Propane tanks explode when shot or heated. Hornet nests hang from ceilings and send hornets until you break them.

The first layer starts inside the outhouse under the night sky, and you drop through the seat. Each look has its own back wall, drawn with depth: fieldstone in the cellar, concrete and pipes in the septic tank, floor joists and roots in the crawlspace, and cedar planks under the sauna. Lamps, lava, and candles glow in color. Dust, drips, fireflies, and embers drift in the air.

### The Cottage and Jev

The Cottage runs the world through the same `/api/warden` function, with Jev:

- **Each layer.** One call asks 37 questions: the look, the fill, liquid, and cave shape of six strata, the gold, the critter count, two set pieces, the sealed rooms, how many relics to bury, which props to use (pipes, tanks, nests, or a mix), ten critter slots, and a voice line. The two drains lead to the two next looks that Jev likes best.
- **While you fall.** About every 20 seconds, Jev reads what is near you, whether you are burning or stalling, and your build. Then it picks an act: watch, rain, oil, lava, acid, gas, sand, gold, critters, or quench. It also picks where.
- **The boss.** Jev picks what the Cottage pours into the boss fight.
- **The snack bar.** Jev stocks three free shots and two items for gold, which can be a new melee weapon, a scroll, or a better shovel. It also decides how much you heal.

- **Gifts.** After a sealed room, Jev picks the three gifts on offer.
- **After a death.** Jev reviews the run and retunes the game. See the next section.

The code checks each pick and can overrule it. For example, it holds back lava when you are badly hurt, and it applies your drain choice. Every override shows in the Cottage tab.

### The game tunes itself

When you die, the Cottage reads a log of the run: who hurt you and how much, whether you lost half your health in 3 seconds, how often you rolled, whether you died with hot dogs left, cave-ins, time alive, and depth. It sends this to Jev in one call (`cottage.tune`), which judges the run as rough, fair, or breezy and moves nine dials one step each:

| Dial | Range | What it changes |
| --- | --- | --- |
| Critter damage | -40% to +50% | How hard every critter hits |
| Critter toughness | -30% to +50% | Critter health |
| Attack warnings | -20% to +80% | How long critters flash before they attack |
| Critter count | -30% to +40% | How many critters each layer holds |
| Hot dogs | +0 to +2 | Extra hot dogs each run |
| Hot dog heal | 35% to 70% | How much one hot dog heals |
| Shovel effort | -30% to +30% | How fast digging tires you |
| Cap drops | -20% to +100% | How many caps critters drop |
| First-layer ease | 0% to 100% | Fewer critters and sealed rooms on the first two layers |

Jev can also soften one critter that hit too hard, and it picks one tip for the next run. The code keeps at most three dial moves, drops moves that go against the verdict, and always makes at least one fix after a rough run. A breezy run pushes the dials back up. The death screen lists every change and the tip. The Memory tab shows the current dials, and a button there resets them. The tuning stays in your browser.

Between layers, the snack bar also asks Jev for a flow check. If you lost most of your health on that layer, the next one runs calmer. If you barely got touched, it runs hotter.

### Controls

| Action | Keyboard and mouse | Gamepad |
| --- | --- | --- |
| Move, jump, hover | A and D, W or Space (hold to hover) | Left stick, A |
| Hit | Left mouse or J | X |
| Ground pound | S and hit, in the air | Down and X, in the air |
| Roll | Shift or L | B |
| Shoot | Right mouse or K | RT or RB |
| Change guns | 1, 2, 3, or the wheel | LB |
| Dig | Hold F | LT |
| Hot dog | R | Y |
| Take or open | E | D-pad up |
| Map, sound | Q, M | Back |

On a phone, the left thumb moves, and pulling down on the stick while you hit in the air pounds the ground. Tap the right side or the Hit button to swing, and drag the right side to aim and shoot. Buttons roll, eat a hot dog, and switch the right thumb to the shovel.

The game fits the screen on desktop and phone. Menus never shrink their text: a menu too tall for the screen flows into two columns, and on a narrow phone it scrolls inside the screen.

## Crimson Rogue

Crimson Rogue is a third-person 3D boss fight at `/crimson/`, in the spirit of Black Myth: Wukong and Sekiro. One of the crew, dressed as a ronin, meets Gabe the mountain man at night in the red-rock hills of Sedona. The whole world is black-and-white ink wash. Only Gabe's neon track suit has color, and neon means danger: a fist, foot, or claw glows neon just before it lands.

- **Pick a friend.** Tank Top hits 20% harder, Fifty-One has 20% more life, Shades has a wider parry window, New Balance dodges for less ki, and Red Jersey moves 12% faster. All five fight as the same ronin for now.
- **Gabe, the mountain man.** A boxer in a neon track suit. He throws jab-cross combos, a lunging roundhouse kick, and a cartwheel into a flying kick. He slips your swings and counters. A neon 危 means a grab (he hauls you over his head and throws you) or his bear call: he pulls out a PVC pipe and roars down it, and neon sound rings blow you off your feet. Dodge through both.
- **Gabe, the grizzly.** At about half life, a cut scene plays: black bars close in, a low camera circles Gabe as he glows and the ground shakes, the film of him turning into the bear plays (tap or press a key to skip), and the grizzly comes out roaring in slow motion with shockwave rings and a 熊 card. The grizzly stands twice your height. The bear rakes with a two-hit claw sweep, chops overhead, smashes with both paws, slams the ground, and charges. A neon 危 before a charge means dodge.
- **Deflect.** Press parry just as a blow lands. A clean deflect throws white-hot sparks, punches the camera in, and fills Gabe's posture bar. Hold parry to block: a block costs ki, and an empty ki bar breaks your guard.
- **Break him.** When the posture bar fills, Gabe staggers. Strike the neon mark for a deathblow that takes almost a fifth of his life.
- **Drink.** You carry five gourds. Each one heals 50 life, but you stand still to drink.
- **The end.** Beat the bear and the credits roll over the battlefield to their own music: the cast with their portraits, how the game was made, and at the end the other cabinets of the Cottage Arcade, with FIGHT AGAIN and ARCADE. A tap or key skips to the end.

| Action | Keyboard and mouse | Touch |
| --- | --- | --- |
| Move | WASD | Drag on the left half |
| Camera | Mouse | Drag on the right half |
| Light attack (3-hit combo) | Left click or J | CUT, or tap the right half |
| Heavy attack | K or Q | HEAVY |
| Dodge roll | Space | DODGE |
| Parry (hold to block) | Shift, F, or right click | GUARD |
| Drink a gourd | R or E | GOURD |
| Lock on | Tab or middle click | LOCK |
| Pause | Esc or P | II |
| Music on or off | M | ♪ on the title screen |

### Ten Seats: the story

The title screen offers three ways in: NEW STORY, CONTINUE and FIGHT GABE. FIGHT GABE plays the boss fight above, exactly as before, and loads no story code.

NEW STORY opens with the Gabe fight. When you win, Gabe yields, and the game goes back three days to Fifty-One's bachelor party in Sedona. From there it is an open world: a 2 km Sedona with Uptown, West Sedona, the creek, the trailheads and Midgley Bridge. The crew rides in the Whale, a ten-seat white van. The crew learns that Gabe watches the bridge for a trafficking gang and meets the FBI once a month. Together they bring the gang to justice.

- **Missions.** Chapters mix driving, chases, stealth, photo steps, clue hunts and fights in the style of the boss fight. A failed mission offers RETRY from its last checkpoint.
- **Side jobs.** Four Legends (the javelina, the vulture, the gila and the tarantula), two time trials and three photo hunts, marked on the map.
- **Cast.** The crew, Agent Vance, Harlan Voss, "Rattler" and the gang. Mouths move with the lines, and each costume fits the chapter.
- **Saves.** The game saves at checkpoints and when you hide the page. CONTINUE on the title picks up from the last save, and repairs a damaged one.
- **Phones.** Touch controls, a HUD that fits short screens, and an optional tilt look: tap 傾 to steer the camera by tilting the phone, and double-tap to centre it.

| Action | Keyboard | On foot / in a vehicle |
| --- | --- | --- |
| Move or steer | WASD or arrows | both |
| Use, talk, get in or out | E or Enter | both |
| Handbrake | Space | vehicle |
| Horn | H | vehicle |
| Look back | C | vehicle |
| Crouch | C, X or Ctrl | foot |
| Phone camera | V | both |
| Map | M | both |
| Fight | the boss fight keys above | foot |
| Pause and menu | Esc or P | both |

The story code is in `public/crimson/js/story/`, one folder for each package: `look`, `world`, `cast`, `vehicles`, `combat`, `ui`, `missions` and `content`. `types.js` holds the contracts between them.

### How it is made

- **Characters.** The ronin, Gabe, and the bear are textured 3D models with skeletons, made with Higgsfield (Meshy image-to-3D) from concept art. Every move is a motion-capture clip from the same library. The rigging service gives each clip a slightly different skeleton, so a build step moves each clip onto the detailed model: it copies every bone's world rotation change from the rest pose. The game cuts attacks out of the longer clips, and hit timings come from measuring when each fist, foot, or paw moves fastest.
- **Look.** The models get cel shading and an ink outline. A post pass turns the frame to ink: it keeps only neon, crushes blacks, draws edges, adds grain and film scratches, and makes the neon bloom.
- **Sedona.** The sky all the way round is one ink painting of the buttes and the moon, made from two generated halves. The desert floor, sandstone spires, boulders, junipers, and grass that leans away from the fighters are made in code.
- **Title screen.** The fighter you pick fills the screen, and Gabe stands opposite on wide screens. The ink-wash portraits (the five crew members, Gabe, and the grizzly) were made on Higgsfield from the crew art.
- **Clips.** The cut scene film (Gabe turns into the bear, with sound) was made with Seedance on Higgsfield. It plays at the change, not at the start of the fight.
- **Music.** Two songs play through SoundCloud's own embed player. The title screen plays George Baker Selection's "Little Green Bag" in the Marco Zeta bootleg remix, from Ziglio's Musique. The fight plays Nero's "Promises" (Skrillex remix), from Skrillex's SoundCloud page. The player changes song when the fight starts and again when you go back to the title. The song tries to start when the page loads. Browsers that block sound until you tap or press a key start it then; on a phone, tap play on the small SoundCloud bar. Try other tracks with `?titlesong=<SoundCloud link>` and `?song=<SoundCloud link>`, or turn music off with `?nomusic`.
- **Phones.** Phones get a lighter setup (lower resolution, fewer grass blades, smaller shadows). On every device the game lowers the render resolution when frames run long, and raises it again when there is room.
- **Sound.** Every sound effect is made in the browser with Web Audio.
- **Credits music.** An original score for taiko, shakuhachi, koto, strings and low choir in the Japanese in scale, written as Web Audio code (`makeScore` in `public/crimson/js/credits.js`). The game plays `public/crimson/audio/credits.mp3`, the same score rendered offline, and plays the code live if the file cannot load.

The game uses Three.js r170 (in `public/crimson/lib/`) with no build step. Add `?god` to the URL to take no damage while you test.

## Breath of the Lake

Breath of the Lake is a 3D open-world spin-off at `/wild/`, in the style of The Legend of Zelda: Breath of the Wild, with a soft, hand-painted look like a Studio Ghibli film. The Porcelain King clogged Loon Lake. His sludge took Gabe, Christian, and Ryu, and gave them red eyes. You wake up at the cottage and go get them back.

- **A painted lakeside world.** Higgsfield-generated cottage, wood, linen, roof, foliage, sky and meadow artwork is mapped onto real 3D geometry. Raised window frames, a shingled roof, curved furniture and an open pergola catch the sunlight. Leaf clusters sway on instanced trees, while the painted sky yields to sunset, night and the King’s storm. Characters, cottage and foliage share soft cel shading, warm directional sunlight and cool skylight; simpler ground color shapes and drawn outlines give the game a cartoon aesthetic. The cottage remains a solid, climbable building. Asset provenance and rendering notes are in [docs/botl-art.md](docs/botl-art.md).
- **Go anywhere.** The valley is about 1.6 km across: the cottage on the south shore, the pine forest to the west, the meadows to the east, and the mountains to the north. A short dock at the cottage has a kayak tied to it. Paddle it out to Clog Island.
- **Climb anything.** Walk into a cliff, a tower, or a building, and you grab on. You climb hand over hand in pulls, lean into rock faces, and pull yourself up over the top edge. Climbing uses stamina.
- **Glide.** Jump, then jump again in the air to open a beach umbrella. A campfire under you pushes you up.
- **Paddle.** Walk up to the kayak and press E to get in. Steer with the stick, and hold sprint to paddle hard. Press E near a dock or a beach to get out, or jump to slip into the water. When you go far away, the kayak drifts back to the cottage dock.
- **Fish.** Rings on the water mean fish are rising. Stand on the shore, a dock, or sit in the kayak, and press E to cast. When the bobber dips, press Swing to hook the fish. Then hold Swing to lift your green zone and let go to drop it. Keep the fish inside the zone until the bar fills. You can catch Yellow Perch, Lake Trout, Walleye, and the rare Golden Loon Bass. Fish heal you and go in the stew pot. Each spot rests for a while after a catch.
- **Swim.** Swimming uses stamina too. Run out and you wash back up on shore, one heart short.
- **Light the beacons.** Four lookout towers stand on high ground, each with a beacon on top. Climb one and light its beacon, and you map the land you can see from up there: the map opens and the clouds part over that region. You can travel to any lit beacon from the map.
- **Clear the outhouse trials.** Twelve outhouses glow blue. Win the fight inside the ring for a Golden Orb. Pray at the loon statue with four orbs for a new heart or more stamina.
- **Find the Loonies.** Thirty are hidden: most under odd little rocks with flowers on top, and some up high.
- **Fight.** Swing in a combo, or hold and let go for a spin. Tap again during a swing and the next one follows as soon as the first lands. Each swing steps you in toward the target, and the last swing of a combo is a heavy one. Roll or jump to cut off the end of a swing. Every hit lands with a spark, a short freeze, a flash on the target, and a number: white, gold for a critical hit, and red for damage to you. A roll costs a little stamina and keeps you safe for its first quarter second. Roll the moment before a hit lands and time slows down. Roll as you land from a long fall to take half the damage.
- **Fair play.** Critters take turns: no more than two wind up at once. Each wind-up makes a sound, and a bite lands only in front of the critter. A boss fight sets a checkpoint outside the arena. The King waits until your three friends are free. Research on what makes games fun, and how this game was tuned against it, is in [docs/botl-fun.md](docs/botl-fun.md).
- **Weapons.** There are 14, in three kinds, and each kind swings its own way:
  - One-handed weapons swing fast in a 3-hit combo: the Plunger, Maple Branch, Hockey Stick, Lacrosse Stick, Frying Pan (stuns), Marshmallow Torch (sets critters on fire), Frisbee, and Golden Plunger.
  - Two-handed weapons are slow and heavy. They sweep wide and knock critters flying in a 2-hit combo: the Canoe Paddle, Curling Broom, and Antler Axe.
  - Spears reach far. Two quick jabs, then a lunge: the Fishing Rod, Tent Pole, and Pitchfork.
  - Some weapons are better than usual. A **Sturdy** one lasts 60% longer, a **Mighty** one hits 35% harder, and a **Keen** one lands more critical hits.
  - Every weapon but the Plunger and the Frisbee wears out. A worn weapon blinks red, and its last hit, the one that breaks it, does double damage. Then the best weapon left comes to hand.
  - Press T to **throw** the weapon you hold. It spins through the air and hits twice as hard, then lands on the ground for you to pick up. The Frisbee comes back to you.
  - Your pouch holds the Plunger and four more. With a full pouch, pick up a weapon to swap it for your weakest one. Chip, by the loon statue, sews a bigger pouch for Loonies (up to eight weapons and the Plunger).
  - Weapons turn up everywhere: branches under trees, gear at camp sites, and whatever critters drop when they go down. Bears and moose drop the big ones.
- **Treasure chests.** Sixteen chests sit on hilltops and in quiet places, four in each lookout's land. A beam of gold light shows each one from far away. They hold the best weapons in the valley.
- **Critter camps.** Each camp has a cooler of loot, locked until you beat every critter at that camp. It fills again each day.
- **Side quests.** Critters wearing hats are friendly. A ! over a head means a job for you, and a ? means you can finish one. Open the quest log from the pause menu.
  - **Pip's Frisbee:** Pip, a little goose by the cottage, threw a frisbee onto the cottage roof.
  - **The Bandit Fort:** Rocco wants the Raccoon King off his throne at the camp south of the cottage. The King leaps at you (jump the ring when he lands) and calls his bandits for help.
  - **Bruno's Supper:** Bruno the bear wants three fish.
  - **The Glide Course:** Coach Gus wants you to jump off the Loonie Meadows lookout and glide through five rings in 40 seconds. After that, he tracks your best time.
  - **The Moose Alpha:** Marge wants the huge moose in the east meadow taught some manners. He charges, then stomps: jump the shockwave, then hit him while he rests.
- **Eat and cook.** Pick up apples, blueberries, toadstools, and maple syrup, or catch fish. Cook three at a fire to make a stew that fills your hearts and adds a gold one.
- **Free your friends.** Gabe throws boulders and sends shockwaves you must jump. Christian blinks around a stone circle and throws cards. Ryu fights like a martial artist. He circles you, winds up each punch, charges a fireball, and warns you before he dashes. After a dash he is winded, which is your chance to hit back. Each one gives you a heart and a power: Gabe's Grit blocks hits, Mystic Updraft (R) lifts you into the sky, and Ryu's Fury (F) strikes everything near you with lightning.
- **Flush the King.** A porcelain stair climbs from the island dock to the King's court, a round floor of cracked bathroom tiles ringed by copper pipes. Step onto it and a wall of sludge rises behind you, the sky turns purple, and the camera keeps him in view. He fights in three rounds:
  - Round one: he belly-flops onto a red ring that fills up until he lands, and sends out a shockwave you must jump. He gargles and lobs sludge at filling rings. Get close in front of him and he rears back, glints, and snaps his lid shut. The lid sticks for a moment: hit him.
  - Round two: he also spins two streamers of toilet paper across the floor (jump them), calls raccoons out of the pipes, and does the Royal Flush: a whirlpool pulls you in while sludge circles the drain. Run, then jump the wave at the end.
  - Round three: everything is faster, the hops come in threes, and the paper changes direction.
  - Hit him enough (the gold bar under his health) and he reels, and he also reels after the paper and the flush. Walk up and press Swing or E to **plunge** him: you jump onto the rim of his bowl and pump four times for a big chunk of his health.
- **Day and night.** A day lasts 10 minutes. At night the fireflies and the skeeters come out. At midnight the critters come back.

**The look.** The game draws each frame, then paints over it in one pass so it looks like a frame from a Studio Ghibli film. A brush filter (Kuwahara) turns flat areas into soft strokes. Thin ink lines trace hills, trees, and people. Warm colour grading, a soft glow, haze around the sun, and paper grain finish it. Far away, the brush gets broader and the hills fade into a clear painted blue, like the backgrounds of an animated film. The grass is dense and tall, and it covers the ground from your feet to the far hills. Big waves of wind roll across whole fields. The grass parts around you and springs back slowly behind you, and the tips glow when the sun is behind them. The east meadows turn to golden pampas. People and animals ease from one pose to the next, so walking, turning, landing, and swinging blend smoothly. The stride follows the ground: it gets longer as you speed up, the knees lift through each swing, the elbows pump, the hips bob as each foot lands, and the body leans into a sprint. The weapon stays at one steady angle while you run. In the world, cloud shadows drift over the hills, far hills fade into blue haze, tall summer clouds stand on the horizon, and seed fluff floats in the light. A giant old tree stands on the hill behind the cottage. Campfires are painted flames with drifting embers and smoke, and they light up the ground around them at night.

**The map.** The map looks like a page from a storybook: a watercolour valley with hill shading, contour lines, rings along the shore, little trees, dotted paths, place names, and a compass rose. Land you have not mapped yet hides under painted clouds. The HUD map is a round window onto the same painting, in a wooden ring with a north mark.

**The camera.** When a wall or a hill gets between the camera and you, the camera rises over your shoulder instead of moving into you. It moves in fast and eases back out slowly, so it does not jitter.

**Graphics settings.** The pause menu has High, Medium, and Low. The Graphics button steps through them in that order. Phones start on Low. On a phone, High counts only if you picked it on that phone. Computers with built-in graphics (Intel, AMD Radeon Graphics, phone chips) start on Medium. During play the game lowers its resolution in a few steps when frames get slow, and raises it again when there is room. It knows the screen's own frame rate, so an iPhone in Low Power Mode (30 fps) does not count as slow. If a computer is still slow at the lowest step, the game drops one setting for that visit and says so.

**Speed.** How the game was made faster, with the numbers, is in [docs/botl-perf.md](docs/botl-perf.md). In short:
- The forest is split into tiles. Far tiles use a simpler tree and cast no shadow.
- Grass that the camera cannot see is skipped.
- Props such as campfires and towers are merged into a few meshes.
- Nothing is drawn behind the title and full-screen menus.
- The title waits only for the models the world needs.

**Painted assets.** The crew, the three bosses, the King, the critters, the kayak, the fish, the cabin, the outhouses, and the loon statue are 3D models made with [Higgsfield](https://higgsfield.ai/). Each one started as a painted concept picture, then became a textured model. The people have skeletons, and the game drives them with the same walk, climb, glide, swim, and swing poses as before. The ground uses painted grass, dirt, sand, and rock textures. A painted ring of far mountains stands behind the valley, and the loading screen and the arcade cabinet show a painted key art picture. If a model or texture does not load, the game uses its old shape-built version.

**The title screen.** It opens on a painted dawn over the valley, with a gold logo and "Press any button". The first press starts an 8-bit overture and opens the menu. New Journey leads to the hero select: five painted hero cards. Pick one with the arrow keys, a click, or a swipe, and press Begin the Journey.

It saves on its own every 10 seconds, and the arcade cabinet shows your progress. It runs on [three.js](https://threejs.org/), loaded from a CDN. The sounds and music are made in code. It works with a keyboard and mouse, a game pad, or a phone.

## Reel It In

Reel It In is a first-person fishing game at `/fish/`. You stand at the end of the cottage dock on Loon Lake, and later at three more places. Your phone is the rod and the reel: you cast it and reel it with real moves. You can also play with touch, or with a mouse and keys on a computer.

**Hold the phone upright.** In motion play its top edge is the rod, for the cast and for the reel. You never turn it sideways. Grip the phone tight. Only your thumb lets go, never your hand. Use a wrist strap if you have one, and keep 2 m clear around you. The game shows this safety note when it asks to use the motion sensors.

**Motion or touch.** The first time you play on a phone, the game asks to use the motion sensors (an iPhone asks for permission). If you say no, or the phone sends no motion data, you play with touch. After a no on the web, the card tells you how to turn motion on again. On an iPhone, close Safari fully, open the page again, and tap Allow. On Android, allow Motion sensors in the site settings. In the app, a no switches to touch and says "Motion is off. You can play with touch." A computer plays with the mouse and the keys. Settings > Controls changes it later.

### The cast

**With motion:**

1. Turn your body to aim. A dotted line on the water shows where the lure goes.
2. Press and hold your thumb on the screen. The bail clacks open and your thumb holds the line, in one move.
3. Tip the phone back over your shoulder. The rod creaks and taps when it loads, and again at full power.
4. Whip the phone forward. Lift your thumb as the phone tips forward, at 11 o'clock. The line zips off the spool and the lure flies.
   - The gyro measures how fast you swing. A faster flick casts farther. A sweet cast with a brisk flick lands 35 to 55 m out at Loon Lake. A short, sharp flick of the wrist is enough. A harder throw adds little distance.
   - The game times your lift against the moment the rod passes 11 o'clock. A lift up to about 90 ms before or after that moment launches the lure at a good angle, at any swing speed. Lift too early and the lure goes high and short. Lift too late and it slaps the water in front of you.
   - The gyro measures the swing across the rod, so the cast reads true whether the screen faces you or leans toward your thumb.
   - Where you face sets the direction.
   - Lift your thumb with no swing and the bail snaps shut, ready for the next try. Swing and keep your thumb down, and the lure still flies, low. The game then says to lift sooner.

**With touch.** Press anywhere: on the rod, the reel or the lake. The game waits for the drag. Up and down takes the line where you pressed, and sideways aims. Drag down to tip the rod back. Then flick up and let go. A rail beside your finger shows the rod as a bead. Drag the bead down past LOAD. The mark below LOAD is full power. Let go while the bead crosses the green band. The game grades the cast where your finger lifts, so a pause before the lift changes nothing. A flick that carries on past the press point still casts far. A swipe up that never tipped the rod back casts nothing and uses no derby cast.

**On a computer.** Hold the mouse button still. The rod tips back by itself, then swings forward. Let go while it passes the green on the rail. Move the mouse sideways while you hold to aim. If you let go before the rod comes forward, nothing flies. You can also drag down and flick up, as with touch. Space works like the mouse button, and the arrow keys (or A and D) aim. A press on a button or a menu never casts. E opens and closes the bail, but you never need it.

**Feather the line.** Touch the rod while the lure flies to slow the line, so the lure drops short onto a target. On a computer, click anywhere.

**Easy mode** is on at first (in Settings). It softens a cast that goes too high or too low, and a gentle stroke goes farther. In the fight it gives you more time to set the hook, and some fish hook themselves when you keep reeling through the strike. A jump also rises 0.2 s slower, except a legend's.

**What the cast tells you.** A sweet release says "Sweet!" with a sound and a tap the moment the lure leaves. The aim line runs out to where a cast like your last one would land, and turns amber when that spot is not water. After each cast you see the distance and how the release went. One more line can follow. It names a run of sweet casts, a hit on a rising ring, or a near miss ("4 m short of the ring."). It can also say that big fish live far out, give a tip, mark your longest cast, or name the water where the lure landed. A good release with a short back swing says "Tip back farther for more distance." A cast with no back swing says "Tip the phone back first." (with touch, "Drag down first."). Rings on the water show rising fish. Cast into a ring for a near-sure bite. If the motion sensors send nothing for 3 s, the game asks "The motion sensors stopped. Play with touch?", and a tap switches to touch for this visit.

**The next cast comes fast.** "Nothing this time." stays 1 s and a cast onto the shore 0.9 s. A lost fish stays 3.4 s (a legend 4.5 s), so you can read the loss line. A cast input ends the wait early: a press, a click, Space, or your thumb in motion play. It works 0.35 s after the words show (0.8 s after a loss), and the same press goes on into the next cast. A press on the crank or the rod ends the wait. It does not cast. After 3 s with no fish on the way, the prompt says "Nothing is biting here." Each turn of the crank then winds in up to 4 times as much line. A crank faster than 1.5 turns a second shortens that wait, down to 1 s.

### The fight

**Reel.** The reel starts the moment the lure lands. The lake fills the screen and the crank sits under your thumb: on the left in touch play, and on the side you pick in motion play.

- Turn the crank to reel. On a computer, turn the mouse wheel or hold R. The first turn snaps the bail shut, like a real reel. The lure swims back, and it sinks when you stop. A short pause often makes a fish bite. Reel slowly: a small fish cannot catch a fast lure, and the game tells you when you reel too fast.
- On a new save, the first cast that lands in the water always brings a bite from a small, easy fish: a pumpkinseed or a perch.
- A shadow follows the lure. Small taps are nibbles: wait. A hard thump is the strike. Set the hook then: snap the phone up in motion play, swipe up on the rod or anywhere on the open lake in touch play, or press Space. Pull too soon and you spook the fish. Pull too late and it spits the lure.

**Work the rod.** In motion play, tip the phone back as you crank. This adds reel power, and a meter shows how much. Ease the phone forward to rest. In touch play your right thumb drags the rod up, down and sideways. On a computer, drag the rod with the mouse, or use W, A, S and D or the arrow keys. Each move has one right answer. The big words at the top name it, and the guide and the rod cue use the same words:

| The fish | Motion | Touch and mouse |
| --- | --- | --- |
| Runs, and the drag slips | Stop reeling. Hold the rod up. | The same |
| Pulls the line too tight | Stop reeling. Hold the rod up. | The same |
| Turns away | Stop reeling. | The same |
| Runs for cover (weeds, stumps, logs or rocks) | Tilt the phone left or right. | Drag the rod sideways. |
| Shakes its head | Hold the rod up. Keep reeling slowly. | The same |
| Jumps, or jumps again and again (a tail walk) | Lower the phone. | Drag the rod down. |
| Swims at you | Reel fast. | The same |
| Sees you and makes one last run | Let it run. Hold the rod up. Reel only if the line goes slack. | The same |
| Holds on the bottom | Tip back as you reel. | Drag the rod up. Reel as it comes down. |
| Rests between stages (a legend) | Rest your arm. Keep the line tight. | The same |
| Is tired and close | Lift the phone and hold. | Drag the rod up and hold. |

A fish that is heavy for its place, or big for its kind, gets a warning at its first run, or 4 s after the hook set. A toast says "It is a big one!" with a buzz, and the gauge shows "Big fish on!" until you see the fish.

- **The drag.** A run starts with a click of the drag and a buzz. When the spool starts to slip, the crank stops adding pull. The pull builds back over 0.6 s. Stop reeling in that time and the crank does not snap the line. Keep cranking through the run and the line snaps. The − and + buttons beside the crank set the drag ([ and ] on a computer). At Gull Rock a long run can empty the spool: tighten the drag.
- **Slack.** Slack line lets the fish throw the hook. When the line stays slack for 0.3 s, the gauge says SLACK. In a head shake the prompt says "Slack line! Reel it in."
- **The gauge** shows the tension, the drag, the line out, the depth, and how much fight the fish has left. A word under the arc names the state: GOOD, TIGHT, SLIPPING, SLACK or TOO TIGHT. The arc is plain up to the drag mark, hatched past it and striped near the break, so it reads without color. The fish's bar ends in FIGHT, or in TIRED when the fish is beaten. A TIRED fish starts no new jumps, tail walks, charges, head shakes or thrashes.
- **The rub meter.** When the line rubs on a stump, a log, a rock or the weeds, a striped RUB band takes the place of the fish's name and fills. When it is full, the line breaks. Steer the fish away, or hold the rod up over low rocks.
- **Legends** fight in three stages and rest between them, so your arm rests too. Marks on the fish's bar show where the next stages start. In a rest you cannot land the fish, and the line is safe whatever you do. A legend shows TIRED only in its last stage. A fight lasts from a few seconds for a perch to about a minute for a legend.
- **The loss line** names the one move that would have saved the fish, for example "It wrapped the line in the weeds. Drag the rod sideways to steer it." A lost legend gets its own line, with when to look for its gold ring again.
- **Land it.** When the fish is tired and close, tip the phone up and hold it to lift the fish out. At Gull Rock you bring it to the wall.

### Places and goals

**Places.** Land a big fish to open the next place. Each place has its own look, gear, derby, best score, Journal tab, six goals and legend. The Places card shows the facts and the goals of each place, and **Fish here** takes you there.

| Place | You open it with | What is different | Legend |
| --- | --- | --- | --- |
| Loon Lake | (open from the start) | A calm lake. It teaches the moves. Line: 10 lb. | Golden Loon Bass |
| Stump Bay | A 3.5 kg fish at Loon Lake | A flooded forest at dusk, then night. The line rubs on stumps, so you steer fish out. Catfish bite in the dark, where a nibble says "It is dark. Feel for the bite." Line: 20 lb braid. | Old Whiskers, a giant catfish |
| Cedar River | A 6 kg fish at Stump Bay | Fast water at an autumn dawn. The current runs left and swings your lure. The first time, the prompt says "The current takes your lure." Salmon run down the river toward a logjam, so cast to the right. Line: 20 lb. | Old Hookjaw, an old salmon |
| Gull Rock | An 8 kg fish at Cedar River | The open sea, from the end of a stone wall. A giant tuna can empty your spool, and some fish dive for the rocks at your feet. Line: 30 lb. | Big Blue, a tuna as big as a man |

When a catch in free fishing opens a place, a card follows the catch card: "Stump Bay is open!" **Go there** takes you there, and **Stay here** keeps you fishing. A fish of 70% to 100% of the goal weight says "Close! Land a fish of 3.5 kg or more to open Stump Bay."

The first trip to a new place ends on its arrival card. It shows NEW PLACE with the level, the new gear and one tip. **Start** goes straight to free fishing.

An older save keeps every fish. If it already holds a 3.5 kg fish, Stump Bay is open.

**The fish at Loon Lake.** Ten species live in Loon Lake, each in its own water. Pumpkinseed, Yellow Perch and Largemouth Bass live in the lily pads and the weed flat on the left. Rock Bass and Smallmouth Bass live on the rocky point on the right. Walleye hold on the drop-off, and Lake Trout in the deep water far out. The Northern Pike hunts the weed edges, and the Muskellunge is rare. The legend, the Golden Loon Bass, rises in a gold ring far out at dawn and dusk. Each fights its own way: a smallmouth jumps, a pike shakes its head, a walleye bores deep, a lake trout makes long runs, and a muskie makes one last run at the dock. You can also snag an old boot, the King's Plunger, and Pip's Frisbee. The day goes from dawn to dusk, and the fish bite best at their own hours.

**The other places have 16 more fish.** Stump Bay has Black Crappie, Bowfin, Longnose Gar, Channel Catfish, and Old Whiskers. Cedar River has Steelhead, Chinook Salmon, Brown Trout, Brook Trout, and Old Hookjaw. Gull Rock has Atlantic Mackerel, Pollock, Striped Bass, Bluefish, Atlantic Cod, and Big Blue. Each fights its own way. A usual catch is about 2 kg at Loon Lake, and long casts find the biggest ones. The catch card says how big your fish is for its kind, and a very big one gets a TROPHY badge and a photo.

**Goals.** Each place has six goals that ask for the skills the game teaches, such as "Cast 40 m." at Loon Lake or "Turn a fish from the stumps." at Stump Bay. The Places card shows "Goals: 2 of 6" and checks off the ones you did. Each goal you finish plays the record sting and says "Goal done: Cast 40 m."

**Today's goal.** The title shows one goal for each day, picked from the date and the open places: "Today: land 5 fish at Loon Lake. 1 of 5." In the journey sim, the median beginner finishes each one in 20 casts or fewer. Each day you finish adds to a run ("Today's goal is done. 2 days in a row."). A missed day ends the run and takes nothing else away. The first fish of a day says "Your first fish today." When one catch brings several pieces of news, they show together in one toast.

**What next.** The title and the pause card name one thing to aim for. First comes the goal that opens the next place. Then comes a legend you have not landed, with when to look for its gold ring. After that come the next goal at this place, the next derby rank, and the fish still missing from your Journal.

**The derby.** Free fishing has no limit, and its clock moves an hour every 75 s. In the Derby you get ten casts, and your score is the weight of everything you land. A cast that misses the water does not use up a derby cast, and the game says "You get that cast back." Each place has six ranks, from SKUNKED up to its own CHAMPION. The results count the total up from zero, then show the rank, the next rank ("Next rank: WEEKEND ANGLER at 4 kg."), and your old best when you beat it. A derby catch that opens a place says so on its card, and the results offer **Go there**.

**Help for short casters.** While the goal that opens the next place is open, the first cast shorter than 22 m says "Big fish live far out." Every fifth short cast after it says so again. The game also counts your casts in the water at that place in free fishing. After 20 of them, the next ring that rises within 25 m carries a big fish, and the game says "A big fish is rising close in." That ring stays at least 90 s. When you land the big ring's fish, the count starts again from 0. The game keeps the count only while the page is open, and a cast at another place starts it again.

**Sweet casts.** Three sweet casts in a row in free fishing light up the report ("Three sweet casts! A big fish is near.") and make the next cast in the water bring a bigger fish. A cast that is not sweet ends the run.

**The Journal** has a tab for each place. It shows your best of each fish you caught, then the next three to find with where and when to look, then how many more are left. Above the list, under the place tabs, it counts the fish found, the fish landed and the casts, your best sweet run, and the days you finished today's goal.

The arcade cabinet shows one line from your save: all four legends, or the places open with your biggest fish, or your best derby at Loon Lake, or your biggest fish.

### Sound and feel

- **The hook set.** The lake freezes for 70 ms, the view punches in, the rod tip whips, and "Fish on!" fills the prompt's place for about 0.9 s. A deep thump and a buzz longer than the strike's come with it. A set within 250 ms of the strike adds "Quick set!".
- **Jumps.** The view zooms in on a leaping fish, so a smallmouth 30 m out shows at least 20 px wide on a phone. Then it eases back.
- **Catches.** Each kind of catch has its own sound. A plain fish gets the landed sound. A new species gets a short rise and a new record a brass call. A trophy or a legend gets the whole fanfare, and a legend then plays the call of its place. A legend's next stage gets a drum roll and no fanfare. On the catch card the weight counts up with rising ticks, then the badges stamp on. A trophy, a legend, or a fish that opens a place gets a photo first, with a flash and a shutter.
- **A new place.** Its card rises in with a horn call and the new place's own sound, and the NEW PLACE badge stamps on.
- **The derby end.** The total counts up over about 1 s. Then the rank stamps on, with the fanfare for a new best or a soft close.
- **Splashes** grow with distance, so a lure 45 m out still makes a splash you can see.
- **Sound.** The game makes its sounds in code: the bail clack, the rod swish, the spool whirr, the splash, the crank gears, the drag ratchet, the line snap, and a loon on the lake.
- **Buzz.** On Android the phone buzzes for the gear ticks, nibbles, the strike, the line tension, the drag and the catch. A web page on an iPhone cannot start a buzz from code, so there only a finger on the reel or the crank gives a tap. In the iPhone app every buzz goes through the native haptics plugin, with the same priorities, rate limits and mute. **Buzz and taps** in Settings turns it all off.

### Cutscenes

Short cutscenes play in the game's own scene, with letterbox bars, one caption and their own sound. They need no network and no video files.

- **The opening:** the first **Go fishing** on a new save. The camera glides low over Loon Lake at dawn, past the loon, and settles on the dock in the cast view. The cast starts when it ends.
- **Arrivals:** the first trip to a new place flies in over it, with its name, before the arrival card.
- **Legend reveals:** the first gold ring of a place's legend, outside a fight, once you have landed a fish. The camera pushes toward the ring, the legend breaches, and its name shows. Then play goes on from the same cast.
- **Legend landed:** a hero shot of the legend with its name and weight, before its catch card.
- **The finale:** when you leave the card of the fourth legend, "You fished them all."

Each cutscene plays once, and never in a fight. While one plays, the fish, the clock and the derby wait. Escape and the Android back button skip it at once. A tap, Space or Enter skips it after its first 0.5 s, so the second tap of a double tap does not. With Calm effects or reduced motion, a cutscene shows still shots joined by fades. **Watch** on a Places card plays that place's arrival and its legend's reveal again, once you have seen them.

### Menus and settings

**The title** has **Go fishing** (free fishing, the red button), **Derby: 10 casts**, **Places**, **Journal**, **How to play** and **Settings**. On the web it also has **Switch game** and **Back to the arcade**. Under the menu are your best derby and biggest fish at this place, the next thing to aim for, and today's goal. **Places** has a NEW tag while an open place waits for your first visit.

**The guide.** The **?** button in play shows an animated guide to the moves. A new player sees it until they land their first fish, unless they turn it off.

**How to play** opens on the tab for your input: **Motion**, or **Touch and mouse**. Each tab is a short list that ends with the rising rings. The fish moves sit behind a **Fish moves** row. The Motion tab has a short clip of the tip back as you reel.

**Settings:**

| Row | What it does |
| --- | --- |
| Sound | Turns the sound on and off. |
| Buzz and taps | Turns the buzz and the taps on and off. |
| Easy mode | On at first. See [The cast](#the-cast). |
| Controls | Motion or Touch. Motion needs a phone. |
| Reel side | Right or Left. In motion play it moves the crank, the drag buttons and the gauge to the other side. In touch play the crank is always on the left. |
| Art style | Painted (the default: cartoon models, painted skies, painted trees and soft cel shading) or Original (the lake that the code builds). A save from before the name Painted keeps its look. |
| Graphics | Auto (Low on a phone, High on a computer), High or Low. |
| Larger text | Makes the words in play, on the cards and on the gauge 1.25 times as big. |
| Calm effects | Stops the flashes, pulses, pops, count-ups, freezes, camera punches and zooms. The words, the sounds and the buzz stay. It is on when the phone asks for reduced motion. |
| About | The version, a credit line, and the privacy policy. |
| Privacy | The privacy policy (`privacy.html`). It opens with no network. |

The pause card has **Resume**, **How to play**, **Journal**, **Settings** and **Quit to the title**. On the web it also has **Switch game**, and **Fullscreen** where the browser allows it. It shows your catch so far and the next goal. Prompts and toasts reach screen readers through live regions, and each screen is a labeled dialog.

**Keys.** Escape or P pauses and resumes play. Escape also closes How to play, the Journal, Settings, Places, About and Privacy. On the catch card, Enter or Space presses the main button. Space waits until the photo is done.

### Start-up, the store build and the app

**Offline start.** The game starts and plays with no network. three.js r170 is in `lib/`, and the fonts Alfa Slab One and Nunito are in `fonts/` with their licenses. From the first frame a loading screen shows "REEL IT IN", a moving bar and "Loading the lake." A card with **Try again** takes its place when a module does not load or the device cannot draw 3D. The card also comes when the title is not ready after 15 s. If the GL context is lost, the game pauses, the pause card says "The lake is coming back.", and **Resume** waits until it is back. If it is still lost 4 s after the page shows, the card with **Try again** comes up.

**Render scale.** When frames stay slow for about a second, the lake draws with fewer pixels, in steps down to 60%. When frames are fast again, it climbs back in steps. One slow frame changes nothing. A screen held at 30 Hz, such as an iPhone in Low Power Mode, also looks slow at first. The game tests one step down and then 60%. When neither helps, it goes back to the scale it started at. Under a menu card the game draws the lake once, and the lake stands still.

**Phones and rotation.** In motion play the game stays upright on the phone. If the browser turns the page anyway (rotation lock off, or a big steering tilt), the game turns the picture back. On an iPhone, turn on Portrait Orientation Lock for the smoothest cast. On the web, Settings and the pause card have a **Fullscreen** button where the browser allows it. In full screen, motion play also locks the page upright. The screen stays awake while you fish.

**The store build.** `<html data-build="store">` makes the page the app. A script at the top of `index.html` sets it inside a Capacitor app, and the app build writes it into its own copy. The store build hides **Switch game**, **Back to the arcade** and **Fullscreen**. It drops the "GET PLUNGER'D" kicker and skips the game switcher script. It uses app words, such as "Motion is off. You can play with touch." The app build also strips the arcade scripts from its copy. `js/native.js` is the only module that talks to Capacitor, and a missing plugin does nothing. In the app it handles the Android back button, app pause and resume, the splash screen, keep awake, and native haptics. The save and the settings also go to native storage, so they come back when the phone clears the web view's storage. The Android back button closes the top screen. In play it pauses, and on the pause card it resumes. On the catch card, the results and the arrival card it presses the main button. On the card of a new place it picks **Stay here**. On the title it sends the app to the background.

**The apps.** `apps/fish/` wraps this page as an iPhone and Android app with Capacitor 8. [apps/fish/README.md](apps/fish/README.md) has the steps to build, sign and upload both apps. The store kit is in `apps/fish/store/`: the listing, the data safety and age answers, the accessibility labels, the screenshot list, the review notes, and the Play icon and feature graphic in `graphics/`.

**QA switches.** Add these to the address:

| Switch | What it does |
| --- | --- |
| `?open` | Opens every place for this page load. The game does not save it. |
| `?day=YYYY-MM-DD` | Sets the day of today's goal for this page load. The game does not save its progress. |
| `?shot` | For the store pictures: Graphics High, the lake at up to 3 times the CSS pixels, and no automatic render scale. |
| `?debug` | Shows the sensor readings, the cast numbers, the timing of the last lift, and the frame rate. |

## The lab

The lab at `/lab/` holds toys. A toy is a small build that tests the core move of a new game idea before anyone builds the game. The arcade shows the lab: The Lab machine opens `/lab/`, the **LAB ↗** link under the sign does too, and each toy has a machine of its own. The game switcher lists the lab and its toys. Each lab page asks search engines not to index it. The ideas, and the bar a new game must pass, are in `docs/game-ideas.md`.

Each toy starts with a card that says what to try. The lab page shows how long you played each toy. Only your browser keeps these times. Tell the crew your times, and whether you wanted another go.

- **Small Worlds** (`/lab/worlds/`). Six small canvas games on one page, each on today's seed. Swing and let go in Threadwake, throw a spark from body to body in Borrowed Bodies, lead a river home in Foldwild, bend the seasons in Season Thief, guide a flock past the storms in Storm Choir, and keep a living ship on the beat in Heartship. When a world ends, the scene keeps moving for a moment, and then the card says how close you came to your best.
- **Neon Ronin** (`/neon/`). A sword duel in the Portal Badlands, with touch, gyro or a mouse. A ronin attacks only when you can see it, every windup warns with a tone, a red edge and a buzz, and a parry opens the guard at once. Every day brings a new duel.
- **Loon Echo** (`/echo/`). Lead a line of chicks home past an eel and boats. Each full nest hatches a harder clutch, and a big bank gets slow motion. Every day brings a new lake.
- **Take the Plunge** (`/lab/plunge/`). A loon dives into lakes for speed, ahead of winter. Hold to tuck and dive. Let go to glide. A green cue says when a hold will rip, and the first burst of each run is a slow-motion peak. The lakes change each day at midnight at the cottage, so the whole crew flies the same lakes. A ghost link lets a friend race your run.
- **Up the Creek** (`/lab/creek/`). The phone is a canoe paddle: rock the top edge to stroke, twist for a J-stroke, and tilt and hold to brace. Thumbs and keys turn the way you press. Catch the eddies behind the rocks, heed the warning before a capsize, and boof the ledge at the bottom of today's river.
- **Full Tilt** (`/lab/tilt/`). Pinball in open space across six worlds. Light the three beacons in each world, then shoot through the jump gate. A ring and a rising tone come up to 0.9 s before each flip, and each flip is Perfect, Good or Late. Clean flips in a row raise the multiplier, with no top. Hold to aim the launch, and light the gold beacon first for a skill shot that pays double. Start voyage flies the voyage of the day, so the crew flies the same worlds, and the end card says how close you came to your best.
- **House Rules** (`/lab/rules/`). You are the Cottage. Dig tunnels and pour sand, water, lava, oil, acid, swamp gas and gold. Then place critters, propane tanks and the two drains. Settle runs Down the Drain's own rules, tanks included, and a drag while it runs pokes the preview. Test it opens your layer in Down the Drain. When you reach a drain in your own layer, Share gives you a link for the crew. A friend races your time on a live clock and can send a time back or remix the layer.

The latest review of every lab game against the bar, and what changed, is in `docs/lab-fun.md`.

A House Rules link opens Down the Drain at `/fall/#L=<code>`. The code holds the brush strokes, so a busy layer fits in 2,000 characters. With a layer in the link, the game gives you one life, no unlocks, no banked caps and neutral tuning, so everyone plays the same layer. It saves nothing to your memory, your tuning or the high scores. Every change this needs in `public/fall/index.html` sits behind `Custom.on`, which is off for any other link.

## The studio board

The [Cottage Arcade Studio](https://claude.ai/artifact/1XZhrTjde2i2zNrqxT5KfT) is a page that shows who builds what. Every Claude Code session on this repo is an agent. Every branch, and every local git worktree, is a work tree. A branch with no session (from Codex, for example) is an agent too. Every game in `public/arcade/switch.js` is a cabinet, and so is a new game folder on an open branch. When a new agent starts or a new branch is pushed, the next refresh adds it. Nobody has to add it by hand.

`studio/refresh.mjs` builds the page from `studio/page.html`. It reads the branches, the local worktrees and the pull request refs with git, and the sessions from the Claude Code Remote `list_sessions` tool. It reads the hand-kept parts from the live page and keeps them: the production crew, the stages, the feed, the bug board, and the name, blurb, colour and art of each cabinet. It rebuilds the rest, and it adds a feed line for each new agent, new work tree, merge and new cabinet. It reads `switch.js` and the page titles on a branch as text. It never runs code from a branch.

A keeper session refreshes the board every hour. To refresh it by hand, do the same steps:

1. Save the `list_sessions` result (your own sessions, limit 50) to a file.
2. Read the live page with the Artifact tool, which saves it to a file.
3. Save the pull request list (all states) to a file: `gh api "repos/<owner>/<repo>/pulls?state=all&per_page=100"`, one call per page. A pull request that was squash-merged leaves its branch ahead of main, so only the list can tell that the work tree is merged.
4. Run `node studio/refresh.mjs --page <saved page> --sessions <sessions file> --prs <pull request file> --out studio.html --if-changed` in a clone that can fetch from GitHub.
5. If the first word it prints is `changed`, publish `studio.html` to the same artifact.

| Agent state | When |
| --- | --- |
| Working | The session is in a turn now, or a branch with no session got a commit in the last 2 hours |
| Needs you | The session waits for your answer or approval |
| Ready for review | The session stopped with work that is not in main, or a branch has an open pull request |
| Idle | A branch has commits that are not in main, and nobody works on it now |
| Done | The work is in main, or the session is finished |

## Watch call

`voice/` lets the owner talk to their Hermes agent on a Fitbit Sense 2. The watch cannot run apps, but it can answer calls. Hermes rings the owner's phone through Twilio, the owner answers on the watch, and a small call server connects the call to the Hermes API server. It runs on the computer that runs Hermes, not on Vercel, and the arcade does not use it. Setup and use are in `voice/README.md`.

## Files

| Path | What it does |
| --- | --- |
| `public/index.html` | The Cottage Arcade: the launcher with a cabinet for each game |
| `public/arcade/` | The art on the arcade screens, `switch.js` (the game switcher every game's menu opens), and `quiet.js` (stops the sound of a hidden page) |
| `qa/arcade/` | The tests that every game has a machine, and that sound stops when a page is hidden (see below) |
| `public/plungerd/index.html` | The page for Get Plunger'd |
| `public/plungerd/app.js` | The game script. The crew, the boss sheets, and the cover art are inside the file |
| `public/plungerd/art/` | The painted ground, walls, critters, props, guns, shots, and effects. Each file also comes at half size (`.sd.webp`) for phones |
| `public/og.jpg` | The share image |
| `public/fall/index.html` | Down the Drain: the falling-sand simulation, the guns, the critters, and the Cottage's questions, in one file with no libraries |
| `public/crimson/index.html`, `public/crimson/game.js` | Crimson Rogue: the page, the HUD, and the fight: moves, boss AI, camera, and flow |
| `public/crimson/js/` | Crimson Rogue modules: the ink renderer, the Sedona world, effects, sound, and the character loader |
| `public/crimson/models/` | The ronin, Gabe, and the bear: textured, rigged, with their clips |
| `public/crimson/art/`, `public/crimson/clips/` | The title art, the character portraits, and the clips for Crimson Rogue |
| `public/crimson/audio/` | The credits music, rendered from the score in `js/credits.js` |
| `public/crimson/lib/` | Three.js r170 and its glTF loader, used only by Crimson Rogue |
| `public/crimson/js/story/` | Crimson Rogue story mode (Ten Seats): the world, cast, vehicles, missions, UI and chapter content |
| `qa/crimson/` | Playwright tests for Crimson Rogue (see below) |
| `higgsfield/` | Command-line tools that run Higgsfield API models. The key stays in a git-ignored `.env.local` |
| `public/fall/art/` | The crew and boss pictures for Down the Drain, its pixel-art title picture, its hero cards, and the Painted-mode pixel sprites (`pxcrew*.webp` for the crew, `px_*.webp` walk, walk, and attack strips for the critters and bosses) |
| `public/fall/tex/` | The Painted textures for Down the Drain: 64×64 material tiles and 128×128 back walls, one texel for each world cell |
| `public/wild/index.html` | Breath of the Lake: the page, the HUD, and the menus |
| `public/wild/js/` | Breath of the Lake modules: `world.js` (terrain, water, sky, grass, trees, places), `post.js` (the painted look), `player.js`, `foes.js` (critters and bosses), `models.js` (shape-built models), `glb.js` (loads the Higgsfield models and drives their skeletons), `fishing.js` (fishing), `loot.js` (the weapon pouch, thrown and dropped weapons, chests, and camp coolers), `quests.js` (the friendly critters and their side quests), `ui.js` (HUD and map), `audio.js`, and `main.js` |
| `public/wild/models/` | The Higgsfield 3D models (GLB, packed with gltf-transform) |
| `public/wild/tex/` | Painted ground textures, the mountain backdrop, the key art, and the title vista |
| `public/wild/art/` | The hero cards for the hero select |
| `public/fish/index.html` | Reel It In: the page, the boot screen and its error card, the HUD, the menus, and the store build flag with the CSS that hides the arcade parts |
| `public/fish/style.css`, `public/fish/guide.css`, `public/fish/cutscenes.css` | The painted title, the rod cues, Calm effects and Larger text; the moves guide; the cutscene bars, caption and Skip hint |
| `public/fish/js/` | Reel It In modules: `main.js` (the game flow, the menus and the settings), `motion.js` (the phone as the rod: sensors, rod angle, cast timing), `cast.js` (the cast, how a release is graded, and the lure's flight), `cast-rail.js` (the touch cast rail), `reel.js` (the reel face, the crank, the rod pad, and the gauge), `fish.js` (rising fish, bites, and the fight), `pull.js` (the reel power of a tip back), `line-motion.js` (the line and the hanging lure), `places.js` and `places/` (the four maps: height, depth, zones, current, snags), `lake.js` (the map of the place you are at), `species.js` (the 26 fish and the junk), `fishing.js` (who lives where, the gear, the cover, and the legend at each place), `journey.js` (the trail of places, the ranks, the loss lines and the other words), `goals.js` (the six goals of each place, today's goal, the next goal, and the help on the way), `save.js` (the save file), `cutscenes.js` (the cutscene scripts and their player), `guide.js` (the moves guide, and the one set of words for each move), `rod-cues.js` (the cues on the rod), `world.js`, `world-look.js` and `world-*.js` (the 3D places and the fish bodies), `art-style.js`, `cartoon-models.js` and `painted-forest.js` (the Painted style), `render-scale.js` (the automatic render scale), `calm.js` (Calm effects or reduced motion), `native.js` (the bridge to the phone app), `version.js` (the version that About shows), `audio.js` (every sound, made in code), and `haptics.js` (the buzz on Android, the taps on iPhone, and native haptics in the iPhone app) |
| `public/fish/lib/`, `public/fish/fonts/` | three.js r170, and the Alfa Slab One and Nunito fonts with their licenses, so the game starts with no network |
| `public/fish/art/`, `public/fish/clips/` | The painted pictures and the cartoon models of the Painted style (`art/README.md` says how they were made), and the clips for the moves guide and How to play |
| `public/fish/privacy.html` | The privacy policy. The web serves it, and the game shows it in Settings with no network |
| `qa/fish/` | Tests for Reel It In (see below) |
| `apps/fish/` | The iPhone and Android app: a Capacitor 8 project, the script that builds a self-contained `www/` from `public/fish/` and checks it, the native projects, the icons and the splash, and the store kit in `store/`. Its README has the release steps |
| `public/lab/index.html` | The lab: the four toys, and your play time in each |
| `public/lab/kit/` | What the toys share: sound made in code, the frame loop, the start and end cards, play time, and a seeded random with a byte codec for links |
| `public/lab/plunge/` | Take the Plunge: `sim.js` (the flight, the dives and the lakes, exact in every browser), `ghost.js` (ghost links), and `main.js` |
| `public/lab/creek/` | Up the Creek: `river.js` (the river and its current), `canoe.js` (the canoe), `paddle.js` (reads strokes from the phone), and `main.js` |
| `public/lab/tilt/` | Full Tilt: `adventure.js` (the voyage, the worlds and the rally), `physics.js` (the ball, the flippers and the flip forecast), `table.js` (the classic table), `render.js` and `main.js`. Its own README has the details |
| `public/lab/rules/` | House Rules: `layer.js` (a layer as data, as a link, and as ground), `sand.js` (a copy of Down the Drain's sand rules, for the preview), `editor.js`, and `play.js` (the layer inside Down the Drain) |
| `docs/game-ideas.md` | The bar for new games, eight ideas, ideas for every cabinet, and the toys in the lab |
| `qa/lab/` | Tests for the lab (see below) |
| `public/icons/`, `public/favicon.ico` | The arcade's browser and home-screen icons |
| `public/chip.js` | A small 8-bit music player (pulse, triangle, and noise voices) with three original songs: the arcade theme, the Breath of the Lake overture, and the Down the Drain theme |
| `qa/wild/` | Playwright tests for Breath of the Lake (see below) |
| `public/fall/clips/`, `public/plungerd/clips/` | Short looping gameplay clips for the title screen and the How to play card |
| `api/warden.js` | A Vercel function that sends the director's questions to Jev |
| `voice/` | The watch call: the call script, the call server, a Hermes skill and the setup guide (see [Watch call](#watch-call)) |
| `qa/voice/` | Tests for the watch call |
| `studio/refresh.mjs`, `studio/page.html` | The studio board: the script that finds the agents, work trees and cabinets, and the page it fills (see [The studio board](#the-studio-board)) |
| `qa/studio/` | Tests for the studio board |
| `vercel.json` | Serves `public/` with no build step |
| `qa/` | Playwright scripts that test the game in a headless browser |
| `legacy/warden-iso.html` | An older build, kept for reference |

The QA scripts open `file:///home/claude/plungerd.html`. Change that path to `public/plungerd/index.html` before you run them.

### Crimson Rogue tests

Serve `public/` (for example `python3 -m http.server 8765 --directory public`), set `CRIMSON_URL=http://127.0.0.1:8765/crimson/`, then run each script with Node from the repo root. Each one exits with code 1 when something fails.

| Script | What it checks |
| --- | --- |
| `boss.mjs`, `render.mjs` | FIGHT GABE plays and draws exactly as the recorded golden run and images. |
| `handoff.mjs`, `contract.mjs`, `story.mjs` | The fight hands over to the story, and the story packages keep their contracts. |
| `world.mjs`, `look.mjs`, `palette.mjs` | Sedona builds, the roads connect, and the day and night looks stay in range. |
| `cast.mjs`, `talk.mjs`, `van.mjs` | Bodies, poses, talking mouths, and riders seated inside every vehicle, on slopes too. |
| `combat.mjs`, `missions.mjs`, `photo.mjs` | Fights, mission steps and the phone camera. |
| `ui.mjs`, `touch.mjs`, `pad.mjs`, `tilt.mjs`, `text.mjs` | The HUD at desktop and phone sizes, touch, gamepad, tilt and text. |
| `save.mjs`, `music.mjs` | Saves, damaged saves and CONTINUE; the title and fight songs. |
| `perf.mjs` | Triangle and draw budgets at each quality setting, in town and in fights. |
| `playthrough.mjs <fixes, a chapter id, a side job id or newstory>` | A bot plays with the normal controls only. `fixes` runs one check for each blocker found in the full playthrough. |

### Breath of the Lake tests

Serve `public/` (for example `cd public && python3 -m http.server 8765`), then run each script with Node from `qa/wild/`. Each one exits with code 1 when something fails.

| Script | What it checks |
| --- | --- |
| `level.mjs` | Every tower can be climbed from 8 sides with normal stamina. Outhouse doors, coolers, food, Loonies, boss arenas, and the crew are all in reachable places. You can walk down the dock, paddle the kayak to the island, get out, and walk up. Every fishing spot is in deep water you can reach. |
| `fuzz.mjs [runs] [steps]` | A bot mashes random buttons all over the map. After every step: no NaN, never under the ground or inside a building, never out of the world, hearts and stamina in range. |
| `stress.mjs` | Runs, rolls, and jumps into every building from 12 sides. Climbs and lets go. Jumps and glides off every tower. Climbs 40 cliffs. Swims under the dock. Paddles the kayak all over the lake, hops out, and climbs back in. Fishes at every spot with random buttons. Watches for the hero or the camera getting stuck or going inside things. |
| `flows.mjs` | Damaged save files, double clicks on New game, dying during a conversation, menus on top of menus, travel during a boss fight, catching a fish, moving or getting hit while fishing, travel from the kayak, a whole day and night, window resizing, and a graphics reset. |
| `art.mjs` | Generated asset loading, UVs and texture color spaces, cottage batching and roof height, day/night transitions, mobile viewport, and a playable fallback when all generated artwork fails to download. Set `SHOTS` for screenshots. |
| `render.mjs` | Draws the game at every graphics setting, by day, at sunset, and at night. No shader errors, and the picture is never blank, washed out, or black. |
| `adventure.mjs` | Every weapon and its combo, the modifiers, the double-damage last hit, throwing and picking up, the Frisbee coming back, a full pouch, the chests (four in each land), the camp cooler lock, all five side quests, Chip's bigger pouch, the two mini-bosses, and that a save with all of this loads again. |
| `king.mjs` | A bot fights the whole Porcelain King fight with the normal controls. All three rounds happen, plunging works, the sludge wall keeps you on the court, and after the fight or a death everything is put back. |
| `fun.mjs` | The fair-play rules: the King's gate, the roll cost, bites from behind miss, two wind-ups at most, damage numbers, the landing roll, the updraft fall, and the boss lines. |
| `perf.mjs [quality ...]` | Speed: draw calls, triangles, and the time of the game step, the world update and the draw at five places, plus load times. `PERF_PHONE=1` copies an iPhone screen. Compare runs with each other; software rendering is slow. |
| `touch.mjs` | On a phone screen: the stick moves the hero, a drag turns the camera, the buttons swing and jump, and nothing on the HUD covers the buttons. |

Set `WILD_URL` to test another address. If the CDN is blocked, set `THREE_LOCAL` to a local `three.module.min.js` and `THREE_ADDONS` to a local copy of three's `examples/jsm` folder.

### Reel It In tests

Serve `public/` (for example `python3 -m http.server 8765 --directory public`), then run each script with Node from the repo root. The scripts that open a browser need Playwright. Run `npm ci --prefix qa/browser`. Then run `npx playwright install --with-deps chromium` in `qa/browser`. Then set `NODE_PATH=qa/browser/node_modules`. Some scripts serve `public/` themselves. Each one exits with code 1 when something fails. The game ships three.js and its fonts, so the scripts need no network.

| Script | What it checks |
| --- | --- |
| `qa/fish/boot.e2e.mjs` | Boot and the app shell on a 390x844 phone: an offline start with every other host blocked, slow fonts, the boot card for a missing module, no WebGL and a slow title, and **Try again**. The store build with a stub Capacitor: no arcade parts, the six title controls and the five pause buttons, the back button on every screen, app pause and resume, the save mirror, and a save restored from native storage. A GL context lost in a fight, the render scale in the page, and the lake drawn less under menus. One part waits 15 s on purpose |
| `qa/fish/render-scale.test.mjs` | The render scale in node, fed frame times at known rates: one hitch changes nothing, a slow stretch steps down to the floor and climbs back, a screen held at 30 Hz, a phone on the edge that must not pump, and a 120 Hz screen |
| `qa/fish/app-bundle.e2e.mjs` | Builds `apps/fish/www`, serves it on its own origin with every other origin blocked, and opens it with a fake Capacitor: the title shows, the store flag is set, no arcade text shows, no request leaves the origin, and no file is missing. It needs no other server |
| `apps/fish/scripts/check-www.test.mjs` | The bundle check on about 50 small made-up bundles: what must fail (another host, a web address in the code, a root path of the site, a missing file, arcade text on the page), what only warns ("ghibli", arcade text in a script, a file that nothing loads), and what is allowed |
| `qa/fish/flow.mjs` | The whole game with motion, on a virtual phone that sends real sensor events, all upright: one press opens the bail and holds the line, the rod loads, the whip and the lift cast the lure, the reel starts on the landing, the first crank turn closes the bail, a pull sets the hook, and the fight lands the fish. Then a lift with no swing starts again, and a swing with the thumb still down casts low |
| `qa/fish/motion.test.mjs` | The rod angle, its speed, the yaw, the steering tilt, and the orientation from made-up sensor data, in every hold, through the angles where the browser's numbers flip. A simulated overhead cast checks the release angle to within 3° |
| `qa/fish/motion.e2e.mjs` | Real, trusted sensor events from Chromium's sensor emulation reach the game |
| `qa/fish/release.test.mjs` | How a release is graded, in node: the touch mapping in `cast.js`, a motion lift up to 90 ms either side of 11 o'clock is sweet, a held thumb casts low, the same flick gets the same verdict however long the finger rests before the lift, a flick that lifts 10 to 130 px past the press point lands 25 m or more out, and a lift 30 px below the press point grades high |
| `qa/fish/cast.sim.mjs` | Cast distances and flight times for every release angle and swing speed, feathering, early and overhead releases that still land in front of you at every place, casts that slap the water, a motion release stepped from 200 ms early to 200 ms late with no sudden drop, and easy mode for a careful player |
| `qa/fish/touch.e2e.mjs` | Touch play in the page: a press anywhere waits for the drag (up and down takes the line, sideways aims with the bail shut), a stray swipe up casts nothing, the release at the finger, a flick past the press point, "Sweet!" at the release, the rail, a cancelled touch, the aim preview and the near miss, the crank on the left with the rod pad on the right, and a fling on the lake that sets the hook. Also motion with no back swing, sensors that stop (touch is offered within 2.5 to 4.5 s), and a Space cast |
| `qa/fish/mouse.e2e.mjs` | The mouse on a computer: the hold cast and its timing, sideways aim while holding, the rail on the screen, the bail opened with E, the drag and flick, a press on a HUD button that never casts, a click in the flight that feathers the line, and a click in the reel that starts no cast |
| `qa/fish/desk.mjs` | A computer with no sensors: a press and a drag down hold the line, a flick up casts, the reel starts on the landing, the mouse wheel reels and closes the bail, Space sets the hook, and W and S work the rod |
| `qa/fish/turnaround.e2e.mjs` | The time from the end of a cast to the next one, printed and checked: the empty retrieve, "Nothing this time.", a cast onto the shore, a loss, the press that ends a beat and goes on into the cast (a mouse button, Space, a finger, a thumb in motion play), presses on the HUD, the drag bar and the reel controls that cast nothing, the derby rules, and Space on the catch card |
| `qa/fish/fight.sim.mjs` | Thousands of fights at Loon Lake with scripted players: a good player lands 85% or more of the fish hooked, and 70% or more of each species, a greedy one snaps the big ones, an idle one loses them, a late one misses, an early one spooks them. Also the fight times, bite rates by zone, and the weights |
| `qa/fish/places.sim.mjs` | Fights at all four places with skilled, casual, novice and flawed players: median fight times, land rates, the legends' three stages and rests, the rub meter, the spool, and the dead tow. Uses `fightlib.mjs` |
| `qa/fish/size.test.mjs` | The weight mix at each place (median, small and big shares, long casts against short casts), and the size rank of every species |
| `qa/fish/reel.ui.mjs` | The reel controls with real touch sequences: the bail swipe, the pin and release timing, a second finger, the ways a press takes the line in the cast, the crank rate, the mouse wheel, the rod pad and its swipe up, and all of it with the page turned 90° either way. The gauge: a word for each state, the hatching under a deuteranopia filter, the rub band, the line out in red near the end of the spool, a legend's stage marks, and FIGHT and TIRED. It serves `public/` itself |
| `qa/fish/words.test.mjs` | One set of words for each move: the table in `guide.js`, the guide captions, and that `main.js` takes every move's words from the table. Also the loss lines |
| `qa/fish/screens.mjs` | The prompts in their order, the loss lines, "Big fish on!" and the reveal, the sound and the buzz of each move, the catch card, the unlock cards, the results, the journal, the goal reminders, and the old-save toast, with staged fights. Also the prompt hold, the toast queue away from the crank, SLACK, the readable gauge, the loss beat, and the first fish |
| `qa/fish/line.test.mjs`, `qa/fish/pull.test.mjs` | In node: the line and the hanging lure settle and stay finite at 30, 60 and 120 frames a second. The pull strength eases in, needs the crank, and gives nothing near the break or in a jump |
| `qa/fish/places.map.mjs` | The four maps: zone shares, the stand, the current, the snags, the speed of `height()`, and that Loon Lake is unchanged |
| `qa/fish/save.test.mjs` | The save file: old saves, junk values, the move of an old save to the places, and a stable round trip. Also the goal fields and their fuzz, the six goals of each place, today's goal over 60 days with the run of days, the next goal and the next rank |
| `qa/fish/journey.sim.mjs` | How many casts a novice and a good player need to open each place, the derby ranks, and that each goal is a fair size. A beginner who casts short opens Stump Bay in 25 casts or fewer (median) with the help, the sweet-cast boost gives bigger fish, and a beginner finishes each daily goal in 20 casts or fewer (median) |
| `qa/fish/travel.mjs` | Travel between the places: the cards, the draw call and triangle limits at each place, and that memory does not grow over a loop of trips |
| `qa/fish/moments.e2e.mjs` | Each big moment with its sound, its buzz and its picture on a phone: the strike, the hook set, a run, a legend's stage, the jump zoom, a ring hit, a sweet release, a far splash, the catch stingers and the card, the new place card, and the derby end. Then Calm effects, and the jump zoom at 844x390, 360x640 and 1280x800. `PARTS` picks parts |
| `qa/fish/haptics.test.mjs` | Buzz priorities, rate limits, the tension and drag pulse trains, muting, the iPhone switch pads, and native haptics in the iPhone app through a stub Capacitor |
| `qa/fish/audio.render.mjs` | Every sound renders, is not silent, does not clip, and follows its input |
| `qa/fish/cutscenes.test.mjs` | The cutscene scripts in node: how long each lasts, where the camera goes, the captions, and the ids the save keeps |
| `qa/fish/cutscenes.e2e.mjs` | The cutscenes in the page: the opening and the fly-ins play once, a skip by a tap, Space or Escape, **Watch** on the Places card, no cutscene in a fight, a reveal that holds the derby clock, the hero shot, the finale and the back button, an old save, Calm effects, and the bars and the caption at four sizes |
| `qa/fish/menus.e2e.mjs` | The first run, the menus and access: the title (eight controls on the web, six in the store build), **Go fishing** starts free fishing, the guide for a new player, How to play on the right tab with no scroll at 390x844, the settings rows, About and Privacy with no network, the Painted name, Larger text at 360x640, Calm effects, the reel side mirror, the live regions and the dialogs, the HUD chip at 360 px, and `?shot` |
| `qa/fish/shots.mjs` | Screenshots of every screen at the six store sizes, with a layout scan: a control off the screen, text cut off, a control over another, and a tap target under 44 px. Set `SHOTS` to a folder. `TEXT=large`, `CALM=1`, `WEB=1` and `ART=original` take other settings. Look at the pictures too |
| `qa/fish/world.render.mjs` | Each place on the title at four or five hours, and in the cast, flight, reel and catch views at its derby hour. Two or three catches at each place. Its legend fits the catch view, also at its trophy weight on a narrow phone. The night at Stump Bay, the draw call and triangle limits, and the memory over a loop of trips |
| `qa/fish/fish.render.mjs` | Every fish and junk builds with 3 draw calls, stays within the triangle limit, shows in the catch view, and frees its textures |
| `qa/fish/cartoon.render.mjs` | The Painted style: the cartoon models, the painted forest, the rod bend, the switch between the styles, and art that does not load |

Set `FISH_URL` to test another address. Many scripts save screenshots to the folder in `SHOTS`.

### Arcade tests

Serve `public/` (for example `cd public && python3 -m http.server 8765`), then run the script from the repo root with Playwright on `NODE_PATH` (for example `NODE_PATH=$(npm root -g)`). Set `ARCADE_URL` to test another address of the same tree, `SHOTS` to a folder to save screenshots, and `PARTS` (`walk`, `layout`, `switcher`, `saves`, `credits`) to run only some of the browser parts. `quiet.mjs` reads `QUIET_URL` instead (default `http://localhost:8912`, so serve on 8912 or set `QUIET_URL=http://localhost:8765`), and takes `--old`, `--only=`, `--skip=` and `--modes=`. The whole run takes a few minutes, because the page is slow in a headless browser. It exits with code 1 when something fails.

| Script | What it checks |
| --- | --- |
| `qa/arcade/machines.mjs` | Every game folder in `public/` (and every toy folder in `public/lab/`) has a machine and a place in `switch.js`, and the pictures are there. Then, at 390×844 and 1280×720, the arrows walk to every machine, a token goes in (dragged, tapped, or with key 5), START or key 1 or Enter picks the right address, and the page has no errors. It also checks the last machine by key and by swipe at seven window sizes, that no machine is clipped or overlapped, that the game switcher shows every game, marks the right one for each address, and keeps its exit buttons in reach, and that a junk save never breaks a screen line. A game with no machine must be in the `ALLOW` list in the script, with the reason. Each machine and its switcher entry must have the same id and the same name. The end card of Crimson Rogue, which lists the games of the switcher, keeps its buttons in the window at 360×740, 390×844 and 1280×720. |
| `qa/arcade/quiet.mjs` | Every page that makes sound loads `quiet.js` first (the scan). The script itself, on small test pages: contexts, media, SoundCloud songs, speech, `interrupted` contexts, a page with no `AudioContext`, and a script that loads twice. Then every game page, started the way a player starts it: the sound runs, goes silent when the page is hidden (even when the page pokes at its sound, and after 3 s), and runs again when the page is visible. It hides pages four ways: a page-level `visibilitychange`, `pagehide` then `pageshow`, a second tab on top, and a page freeze. A full run takes about 25 minutes. `--old` shows which pages are loud without the script. |

### Lab tests

Serve `public/` (for example `cd public && python3 -m http.server 8765`), then run each script with Node from the repo root. The scripts that open a browser need Playwright: set `NODE_PATH` to the folder that holds it (for example `NODE_PATH=$(npm root -g)`). Each one exits with code 1 when something fails.

| Script | What it checks |
| --- | --- |
| `qa/lab/hidden.mjs` | The arcade has a Lab machine and a link to the lab, the game switcher lists the lab, and every lab page asks search engines not to index it |
| `qa/lab/links.mjs` | Every game card on the Lab page and every game in the switcher opens a page that exists, and every picture in the switcher exists |
| `qa/lab/worlds.e2e.mjs` | The Small Worlds shell with all six games on a phone: today's seed, a run with no page errors, the outro, and a result card that compares the score with your best |
| `qa/lab/worlds.<game>.sim.mjs` | One sim for each Small Worlds game, run in Node with a stand-in shell: the seed sets the layout, a run can be lost, runs last 1 to 6 minutes, and a careful player beats a careless one |
| `qa/lab/plunge.sim.mjs` | The same inputs give the same flight in every run, a ghost survives its link and replays exactly, each kind of entry keeps its speed, a skim on the lake bed costs speed once, the dive cue tells the truth, and a lake-diving bot lasts at least 60 s |
| `qa/lab/plunge.e2e.mjs` | Take the Plunge on a phone and on a computer: hold and let go, a dive, winter at the end, Again, and a ghost link |
| `qa/lab/plunge.feel.e2e.mjs` | The dive cue and the amber line, the slow-motion burst, sunset and the northern lights, the winter pill, labels that stay on screen, and an old ghost link |
| `qa/lab/creek.sim.mjs` | Strokes turn the canoe the right way, J-strokes hold a line, a warning comes at least 0.3 s before every capsize, a swim resets near the swim, no eddy traps the canoe, and the log jam and the ledge work |
| `qa/lab/creek.paddle.test.mjs` | Made-up sensor data gives the right strokes, J-strokes, back strokes and braces, and a walk gives none |
| `qa/lab/creek.thumbs.mjs` | Bots that steer with thumbs: turning toward the side you press gets a simple player down every river |
| `qa/lab/creek.e2e.mjs` | Up the Creek with a virtual phone that sends real sensor events, with thumbs and with keys: an eddy catch, the log jam with Restart and Share, and the ledge |
| `qa/lab/tilt.*.mjs`, `npm run test:pinball --prefix qa/browser` | Full Tilt's sims and browser checks. CI runs them on every pull request that changes the lab (see `.github/workflows/pinball-browser.yml`) |
| `qa/lab/rules.link.mjs` | 500 random layers survive their links, a busy layer fits, the clear stamp catches a changed link, junk links give nothing, and old links still build the same ground |
| `qa/lab/rules.drift.mjs` | The copies in `sand.js` of Down the Drain's sand rules, tank rule and blast, and the sizes and ids in `layer.js`, still match the game |
| `qa/lab/rules.e2e.mjs` | The House Rules editor on a phone and on a computer: every tool on screen, dig, zoom, critters, Settle with a tank that blows, a drag during Settle, Test it, a name that keeps the clear, and remix |
| `qa/lab/rules.drain.mjs` | A painted layer in Down the Drain: its ground, critters and drains, no tuning or unlocks, the race clock, the death card, Send your time, and broken links |
| `qa/lab/rules.regress.mjs` | Down the Drain as it is now, and the same file with every House Rules hook commit taken back out, play the same game with a seeded random and a fake clock |
| `qa/neon/*.test.*` (run with `node --test`), `qa/neon/neon.e2e.mjs` | Neon Ronin: the duel rules with a seeded random, attacks that start on screen, a warning at least 0.3 s before every blow, the parry, the phone menu and hints, and the daily duel |
| `qa/echo/crossing.test.mjs`, `qa/echo/echo.sim.mjs`, `qa/echo/echo.e2e.mjs` | Loon Echo: rocks that block, the chick line, clutch after clutch, warned strikes, the big bank, today's lake, and how long the reviewer's bots last |

Set `LAB_URL` to test another address, and `SHOTS` to a folder to save screenshots.

### Studio tests

Run `node qa/studio/refresh.test.mjs` from the repo root. It builds a small git repo with branches, pull request refs and a local worktree, runs `studio/refresh.mjs` on it with made-up sessions, and checks the agents, the work trees, the cabinets and the feed. Then it opens the page in Chromium at desktop and phone width. The browser part needs Playwright (`NODE_PATH=$(npm root -g)`). It exits with code 1 when something fails.

### Watch call tests

Run `npm ci --prefix voice`, then `node qa/voice/call.test.mjs` from the repo root. The tests place a call against a stand-in Twilio API and open call sessions the way Twilio does, against a stand-in Hermes API server. Forged signatures, forged or reused call tokens and messages before setup must never reach Hermes. The script exits with code 1 when something fails.

## Jev and cost

`api/warden.js` signs in to AI Gateway with the project's Vercel OIDC token, so the repo holds no API key. To use a gateway key instead, set `AI_GATEWAY_API_KEY`. To pin a model, set `JEV_MODEL` (the default is `typesafe-ai/jev`).

`/api/warden` is public and spends AI Gateway credits. It accepts calls only from `*.vercel.app` origins and caps the request size. For stronger protection, add a rate-limit rule in the Vercel Firewall.

## Cottage Brawl platform fighter

The separate Smash-inspired fighter lives at `/brawl/` and has its own Cottage Arcade cabinet and shared game-switcher entry. It includes eight fighters, landscape and portrait controls, collectible power-ups, default-on chiptune audio after the first gesture, and the corrected Christian portrait and title poster. Jev tactics use the existing `/api/warden` gateway, with local AI fallback; no extra client API key is needed.


