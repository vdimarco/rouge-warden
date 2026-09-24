# Get Plunger'd: Cottage Brawl

A fast top-down roguelite for the crew, in the style of Enter the Gungeon. Pick your guy, grab a plunger, and fight across the cottage: the dock, the cabin, the trail, and the beach, six areas a day, then the Porcelain King in the outhouse. The cottage is the director. It builds every area, picks your rewards and wildlife, and remembers how you play. On the live site, [Jev](https://jevapi.dev/) makes those choices through Vercel AI Gateway.

Rename the crew in the `FRIENDS` list near the top of the game script in `public/app.js`.

## Play

Deploy to Vercel, or open `public/index.html` in a browser. Opened locally, a built-in stand-in answers for Jev.

- Move with WASD. Keep moving to break into a sprint.
- Aim with the mouse and hold the left button to shoot.
- Roll with Space or the right button. You can't be hit while you roll.
- E blows the air horn and clears every bullet.
- Q or 1 to 4 switches guns.
- R reloads. Tap R again in the gold part of the bar to reload at once and heat up the next clip.
- On a phone with "One hand" on, drag anywhere to move and you shoot the nearest critter on your own. Flick to roll, tap the air horn to clear bullets, and tap your gun to switch. With "One hand" off, the left thumb moves and the right thumb aims and shoots.

## Down the Drain

Down the Drain is a spin-off at `/fall/`. It plays like Noita, with the same crew, critters, and bosses as Get Plunger'd. The outhouse backed up, and the ground under the cottage is now a falling-sand world. Every pixel moves. Sand and gold fall. Water, oil, lava, drain cleaner (acid), sewage, and blood flow. Fire spreads through wood, moss, oil, and swamp gas. Water turns lava to obsidian, acid eats stone but not glass, and lightning shocks all that touch water.

Pick one of the five friends on the title screen. Each one has a perk: Tank Top hits 20% harder, Fifty-One has 25 more health, Shades has a 12% crit chance, New Balance digs 40% faster, and Red Jersey moves 12% faster. The game starts on the friend you last picked in Get Plunger'd.

You carry up to three guns. Each gun fires its shots from left to right, then reloads. Each gun has its own slots, pressure, fire rate, and spread. Some guns shuffle their shots, and some fire a shot of their own every time. Shots include the Plunger Shot, Nail, Sparkler, Roman Candle, Propane Tank, Drain Cleaner, Frisbee, Bug Zapper, Water Balloon, and Bottle Rocket. Modifiers change the next shot: Binoculars make it home in on critters, TP Spread fires it three times, and Care Package makes a shot carry the next shot and fire it where it lands. You find guns in side rooms and buy them at the snack bar.

The critters are raccoons, hornets, seagulls, bats, skunks, moose, and geese. They use the same drawings as the main game. Every fourth layer ends at a boss: the Porcelain King, then Gabe the Mountain Man, Christian the Mystic, and Ryu.

The Cottage runs the environment through the same `/api/warden` function, with Jev:

- **Each layer.** One call asks 35 questions: the look (the cellar, the septic tank, the crawlspace, or under the sauna), then the fill, liquid, and cave shape of six strata, then the gold, the critter count, two set pieces, the sealed rooms, ten critter slots, and a voice line.
- **While you fall.** About every 20 seconds, Jev reads what is near you, whether you are burning or stalling, and your gun. Then it picks an act: watch, rain, oil, lava, acid, gas, sand, gold, critters, or quench. It also picks where. A drain pipe opens on the ceiling before anything pours.
- **The boss.** Jev picks what the Cottage pours into the boss fight.
- **The snack bar.** Between layers, Jev stocks three free shots and two items for gold, and it decides how much you heal.

The code checks each pick and can overrule it. For example, it holds back lava when you are badly hurt, and it adds a digging shot when your gun cannot dig. Every override shows in the Cottage tab.

Controls: A and D move. W, Space, or the right mouse button jumps, and holding it hovers you on your leaf blower. Aim with the mouse and hold the left button to shoot. 1, 2, 3, or the mouse wheel changes guns, E takes a gun from the ground, and F or Shift digs with your plunger. S drops you faster, Q shows the map, and M turns sound on or off. With a gamepad, the left stick moves, A jumps and hovers, the right stick aims, RT shoots, LT digs, Y changes guns, and X takes a gun. On a phone, the left thumb moves, the right thumb aims and shoots, the Dig button turns the right thumb into a digger, and you tap a gun in the bar to hold it.

The game fits the screen on desktop and phone, and nothing scrolls. The Cottage's decisions show as one line under the cottage icon. Tap the line or the icon for the full record.

Each layer is a route of rooms that zigzag down to the drain, joined by wide sloped tunnels, with side rooms for gold and liquids. Lamps hang on chains and break into burning oil when shot. Coolers hold gold, and sometimes a shot or a gun. Jev picks two set pieces for each layer: falls from a hidden reservoir, an ossuary, a great root, a sealed vault you must dig into, or a cellar of oil drums.

You cannot run past the critters. Most of them wait in the rooms on the route. Some rooms slam shut with screen doors when you enter, and they stay shut until two waves of critters are dead. The last room before the drain always shuts, and Jev picks how many others do.

The crew and boss pictures are in `public/fall/art/`. They come from the images in `public/app.js`.

## Files

| Path | What it does |
| --- | --- |
| `public/index.html` | The page for Get Plunger'd |
| `public/app.js` | The game script, with its images and sounds inside the file |
| `public/og.jpg` | The share image |
| `public/fall/index.html` | Down the Drain: the falling-sand simulation, the guns, the critters, and the Cottage's questions, in one file with no libraries |
| `public/fall/art/` | The crew and boss pictures for Down the Drain |
| `api/warden.js` | A Vercel function that sends the director's questions to Jev |
| `vercel.json` | Serves `public/` with no build step |
| `qa/` | Playwright scripts that test the game in a headless browser |
| `legacy/warden-iso.html` | An older build, kept for reference |

The QA scripts open `file:///home/claude/plungerd.html`. Change that path to `public/index.html` before you run them.

## Jev and cost

`api/warden.js` signs in to AI Gateway with the project's Vercel OIDC token, so the repo holds no API key. To use a gateway key instead, set `AI_GATEWAY_API_KEY`. To pin a model, set `JEV_MODEL` (the default is `typesafe-ai/jev`).

`/api/warden` is public and spends AI Gateway credits. It accepts calls only from `*.vercel.app` origins and caps the request size. For stronger protection, add a rate-limit rule in the Vercel Firewall.
