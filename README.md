# Get Plunger'd: Cottage Brawl

A fast top-down roguelite for the crew, in the style of Enter the Gungeon. Pick your guy, grab a plunger, and fight across the cottage: the dock, the cabin, the trail, and the beach, six areas a day, then the Porcelain King in the outhouse. The cottage is the director. It builds every area, picks your rewards and wildlife, and remembers how you play. On the live site, [Jev](https://jevapi.dev/) makes those choices through Vercel AI Gateway.

Rename the crew in the `FRIENDS` list near the top of the game script in `public/plungerd/app.js`.

## The arcade

The site opens on the Cottage Arcade, a room of old-school cabinets. Click anywhere on a machine to play it: a token drops in, and the game starts. If you are out of tokens, it plays on free play. You can also drag a token into a coin slot, or tap the slot, then press Start. The screen powers on and grows to fill the window, and the game loads. Get Plunger'd lives at `/plungerd/`, Down the Drain at `/fall/`, and Crimson Rouge at `/crimson/`.

- On a keyboard, the arrow keys pick a machine, 5 drops a token, and 1 or Enter starts, like an emulator.
- You start with 3 tokens. The change machine gives you more.
- On a phone you see one machine at a time. Swipe left or right, or tap the arrows, to switch.
- Every game's menu has a **Switch game** button. It lists all the cabinets, marks the one you are playing, and jumps straight to another game or back to the arcade. The list lives in `public/arcade/switch.js`. To add the button to a game, load that script and give a menu button the `data-switch` attribute. Breath of the Lake (`/wild/`) is already on the list: its tile shows as soon as that game is live.
- Each screen shows your best run from that game, saved in your browser. Down the Drain shows its high score and the initials of the player who set it.

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

## Down the Drain

Down the Drain is a spin-off at `/fall/`, with the same crew, critters, and bosses as Get Plunger'd. The outhouse backed up, and the ground under the cottage is now a falling-sand world. Every pixel moves. Sand and gold fall. Water, oil, lava, drain cleaner (acid), sewage, and blood flow. Fire spreads through wood, moss, oil, and swamp gas. It plays like a fast action roguelite in the style of Dead Cells, dropped into a Noita-like world.

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

## Crimson Rouge

Crimson Rouge is a third-person 3D boss fight at `/crimson/`, in the spirit of Black Myth: Wukong and Sekiro. One of the crew, dressed as a ronin, meets Gabe the mountain man at night in the red-rock hills of Sedona. The whole world is black-and-white ink wash. Only Gabe's neon track suit has color, and neon means danger: a fist, foot, or claw glows neon just before it lands.

- **Pick a friend.** Tank Top hits 20% harder, Fifty-One has 20% more life, Shades has a wider parry window, New Balance dodges for less ki, and Red Jersey moves 12% faster. All five fight as the same ronin for now.
- **Gabe, the mountain man.** A boxer in a neon track suit. He throws jab-cross combos, a lunging roundhouse kick, and a cartwheel into a flying kick. He slips your swings and counters. A neon 危 means a grab: he hauls you over his head and throws you, so dodge it.
- **Gabe, the grizzly.** At about half life, Gabe cracks his knuckles, his track suit tears, and he turns into a standing grizzly twice your height. The bear rakes with a two-hit claw sweep, chops overhead, smashes with both paws, slams the ground, and charges. A neon 危 before a charge means dodge.
- **Deflect.** Press parry just as a blow lands. A clean deflect throws white-hot sparks, punches the camera in, and fills Gabe's posture bar. Hold parry to block: a block costs ki, and an empty ki bar breaks your guard.
- **Break him.** When the posture bar fills, Gabe staggers. Strike the neon mark for a deathblow that takes almost a fifth of his life.
- **Drink.** You carry three gourds. Each one heals 40 life, but you stand still to drink.

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

### How it is made

- **Characters.** The ronin, Gabe, and the bear are textured 3D models with skeletons, made with Higgsfield (Meshy image-to-3D) from concept art. Every move is a motion-capture clip from the same library. The rigging service gives each clip a slightly different skeleton, so a build step moves each clip onto the detailed model: it copies every bone's world rotation change from the rest pose. The game cuts attacks out of the longer clips, and hit timings come from measuring when each fist, foot, or paw moves fastest.
- **Look.** The models get cel shading and an ink outline. A post pass turns the frame to ink: it keeps only neon, crushes blacks, draws edges, adds grain and film scratches, and makes the neon bloom.
- **Sedona.** The sky all the way round is one ink painting of the buttes and the moon, made from two generated halves. The desert floor, sandstone spires, boulders, junipers, and grass that leans away from the fighters are made in code.
- **Title screen.** The fighter you pick fills the screen, and Gabe stands opposite on wide screens. The ink-wash portraits (the five crew members, Gabe, and the grizzly) were made on Higgsfield from the crew art.
- **Clips.** The boss intro (Gabe turns into the bear, with sound) was made with Seedance on Higgsfield.
- **Music.** Nero's "Promises" (Skrillex remix) plays through SoundCloud's own embed player, from Skrillex's SoundCloud page. Try another track with `?song=<SoundCloud link>`.
- **Phones.** Phones get a lighter setup (lower resolution, fewer grass blades, smaller shadows). On every device the game lowers the render resolution when frames run long, and raises it again when there is room.
- **Sound.** Every sound effect is made in the browser with Web Audio.

The game uses Three.js r170 (in `public/crimson/lib/`) with no build step. Add `?god` to the URL to take no damage while you test.

## Files

| Path | What it does |
| --- | --- |
| `public/index.html` | The Cottage Arcade: the launcher with a cabinet for each game |
| `public/arcade/` | The art on the arcade screens, and `switch.js`, the game switcher every game's menu opens |
| `public/plungerd/index.html` | The page for Get Plunger'd |
| `public/plungerd/app.js` | The game script, with its images and sounds inside the file |
| `public/og.jpg` | The share image |
| `public/fall/index.html` | Down the Drain: the falling-sand simulation, the guns, the critters, and the Cottage's questions, in one file with no libraries |
| `public/crimson/index.html`, `public/crimson/game.js` | Crimson Rouge: the page, the HUD, and the fight: moves, boss AI, camera, and flow |
| `public/crimson/js/` | Crimson Rouge modules: the ink renderer, the Sedona world, effects, sound, and the character loader |
| `public/crimson/models/` | The ronin, Gabe, and the bear: textured, rigged, with their clips |
| `public/crimson/art/`, `public/crimson/clips/` | The title art, the character portraits, and the clips for Crimson Rouge |
| `public/crimson/lib/` | Three.js r170 and its glTF loader, used only by Crimson Rouge |
| `public/fall/art/` | The crew and boss pictures for Down the Drain |
| `public/fall/clips/`, `public/plungerd/clips/` | Short looping gameplay clips for the title screen and the How to play card |
| `api/warden.js` | A Vercel function that sends the director's questions to Jev |
| `vercel.json` | Serves `public/` with no build step |
| `qa/` | Playwright scripts that test the game in a headless browser |
| `legacy/warden-iso.html` | An older build, kept for reference |

The QA scripts open `file:///home/claude/plungerd.html`. Change that path to `public/plungerd/index.html` before you run them.

## Jev and cost

`api/warden.js` signs in to AI Gateway with the project's Vercel OIDC token, so the repo holds no API key. To use a gateway key instead, set `AI_GATEWAY_API_KEY`. To pin a model, set `JEV_MODEL` (the default is `typesafe-ai/jev`).

`/api/warden` is public and spends AI Gateway credits. It accepts calls only from `*.vercel.app` origins and caps the request size. For stronger protection, add a rate-limit rule in the Vercel Firewall.
