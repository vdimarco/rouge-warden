# Get Plunger'd: Cottage Brawl

A fast top-down roguelite for the crew, in the style of Enter the Gungeon. Pick your guy, grab a plunger, and fight across the cottage: the dock, the cabin, the trail, and the beach, six areas a day, then the Porcelain King in the outhouse. The cottage is the director. It builds every area, picks your rewards and wildlife, and remembers how you play. On the live site, [Jev](https://jevapi.dev/) makes those choices through Vercel AI Gateway.

Rename the crew in the `FRIENDS` list near the top of the game script in `public/plungerd/app.js`.

## The arcade

The site opens on the Cottage Arcade, a room of old-school cabinets. Drag a token into a machine's coin slot, or tap the slot, then press its Start button. The screen powers on and grows to fill the window, and the game loads. Get Plunger'd lives at `/plungerd/` and Down the Drain at `/fall/`. The third machine is out of order.

- On a keyboard, the arrow keys pick a machine, 5 drops a token, and 1 or Enter starts, like an emulator.
- You start with 3 tokens. The change machine gives you more.
- Each screen shows your best run from that game, saved in your browser.

## Play

Deploy to Vercel, or serve `public/` from any static server and open it in a browser. Opened locally, a built-in stand-in answers for Jev.

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

- **Pick a friend and a weapon.** Each of the five friends has a perk. You start with the Plunger, or with any weapon you have unlocked.
- **Fight your way down.** Each layer is a route of rooms down to the drains. Some rooms slam shut with screen doors until two waves of critters are dead. The drains stay clogged until the last of those rooms is clear. If you dig around it, the fight comes to you at the drains.
- **Collect caps.** Critters, nests, and sealed rooms drop bottle caps. At the snack bar between layers, spend caps at the tab on unlocks that stay between runs: new weapons, more hot dogs, a better starting shovel, pocket money, a starting scroll, and a second wind. Caps you still carry when you go down are lost.
- **Choose your drain.** Each layer ends at two drains. Each one is labeled with the look of the next layer, and one is richer and harder: more relics and gold, but more critters and one more sealed room.
- **Go fast.** Reach the drain before the timer runs out for bonus caps and gold.
- **Take risks.** From the second layer on, a cooler can be cursed. It holds a weapon, a scroll, and a pile of gold, but any hit takes you down until you beat 10 critters.
- **Grow the build.** Scrolls of power raise Muscle (melee), Aim (gun), or Grit (health). Relics dug out of the walls change the run: Hot Sauce, Energy Drink, Bug Spray, Lucky Loonie, Sunscreen, Flip Flops, Snorkel, Work Gloves, Car Keys, TV Remote, the Golden Plunger, and Lost Sunglasses.
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

Hold F to dig with your shovel. It tunnels a hole your size along your aim and carries you through it. The garden shovel is slow on rock, the steel spade is three times faster, and the power auger chews through rock, metal, and porcelain. Better shovels come from the snack bar and from coolers.

The ground holds junk from the cottage: canoes, tires, old toilets, fridges, bike wheels, bottles, boots, lawn chairs, fish bones, and signs. Relics glint through the dirt. Water pipes run along the ceilings and leak where you shoot or dig them, and the water puts out fires. Propane tanks explode when shot or heated. Hornet nests hang from ceilings and send hornets until you break them.

The first layer starts inside the outhouse under the night sky, and you drop through the seat. Each look has its own back wall, drawn with depth: fieldstone in the cellar, concrete and pipes in the septic tank, floor joists and roots in the crawlspace, and cedar planks under the sauna. Lamps, lava, and candles glow in color. Dust, drips, fireflies, and embers drift in the air.

### The Cottage and Jev

The Cottage runs the world through the same `/api/warden` function, with Jev:

- **Each layer.** One call asks 37 questions: the look, the fill, liquid, and cave shape of six strata, the gold, the critter count, two set pieces, the sealed rooms, how many relics to bury, which props to use (pipes, tanks, nests, or a mix), ten critter slots, and a voice line. The two drains lead to the two next looks that Jev likes best.
- **While you fall.** About every 20 seconds, Jev reads what is near you, whether you are burning or stalling, and your build. Then it picks an act: watch, rain, oil, lava, acid, gas, sand, gold, critters, or quench. It also picks where.
- **The boss.** Jev picks what the Cottage pours into the boss fight.
- **The snack bar.** Jev stocks three free shots and two items for gold, which can be a new melee weapon, a scroll, or a better shovel. It also decides how much you heal.

The code checks each pick and can overrule it. For example, it holds back lava when you are badly hurt, and it applies your drain choice. Every override shows in the Cottage tab.

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

The game fits the screen on desktop and phone, and nothing scrolls.

## Files

| Path | What it does |
| --- | --- |
| `public/index.html` | The Cottage Arcade: the launcher with a cabinet for each game |
| `public/arcade/` | The art on the arcade screens |
| `public/plungerd/index.html` | The page for Get Plunger'd |
| `public/plungerd/app.js` | The game script, with its images and sounds inside the file |
| `public/og.jpg` | The share image |
| `public/fall/index.html` | Down the Drain: the falling-sand simulation, the guns, the critters, and the Cottage's questions, in one file with no libraries |
| `public/fall/art/` | The crew and boss pictures for Down the Drain |
| `api/warden.js` | A Vercel function that sends the director's questions to Jev |
| `vercel.json` | Serves `public/` with no build step |
| `qa/` | Playwright scripts that test the game in a headless browser |
| `legacy/warden-iso.html` | An older build, kept for reference |

The QA scripts open `file:///home/claude/plungerd.html`. Change that path to `public/plungerd/index.html` before you run them.

## Jev and cost

`api/warden.js` signs in to AI Gateway with the project's Vercel OIDC token, so the repo holds no API key. To use a gateway key instead, set `AI_GATEWAY_API_KEY`. To pin a model, set `JEV_MODEL` (the default is `typesafe-ai/jev`).

`/api/warden` is public and spends AI Gateway credits. It accepts calls only from `*.vercel.app` origins and caps the request size. For stronger protection, add a rate-limit rule in the Vercel Firewall.
