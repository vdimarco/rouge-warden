# Get Plunger'd: Cottage Brawl

A fast top-down roguelite for the crew, in the style of Enter the Gungeon. Pick your guy, grab a plunger, and fight across the cottage: the dock, the cabin, the trail, and the beach, six areas a day, then the Porcelain King in the outhouse. The cottage is the director. It builds every area, picks your rewards and wildlife, and remembers how you play. On the live site, [Jev](https://jevapi.dev/) makes those choices through Vercel AI Gateway.

Rename the crew in the `FRIENDS` list near the top of the game script in `public/index.html`.

## Play

Deploy to Vercel, or open `public/index.html` in a browser. Opened locally, a built-in stand-in answers for Jev.

- Move with WASD. Keep moving to break into a sprint.
- Aim with the mouse and hold the left button to shoot.
- Roll with Space or the right button. You can't be hit while you roll.
- E blows the air horn and clears every bullet.
- Q or 1 to 4 switches guns.
- R reloads. Tap R again in the gold part of the bar to reload at once and heat up the next clip.
- On a phone with "One hand" on, drag anywhere to move and you shoot the nearest critter on your own. Flick to roll, tap the air horn to clear bullets, and tap your gun to switch. With "One hand" off, the left thumb moves and the right thumb aims and shoots.

## Wardenfall

Wardenfall is a spin-off of the Warden build in `legacy/`, at `/fall/`. It plays like Noita. The Warden melted its halls, and every pixel now moves. You carry the lantern down a well of sand, stone, and liquid. Sand and gold fall. Water, oil, lava, acid, sludge, and blood flow. Fire spreads through wood, moss, oil, and miasma. Water turns lava to obsidian, acid eats stone but not glass, and lightning shocks all that touch water. You fight with a wand of spells that casts from left to right. Modifiers change the next spell.

Jev runs the environment through the same `/api/warden` function:

- **Each layer.** One call asks 32 questions: the look, then the fill, liquid, and cave shape of six strata, then the gold, the foe count, ten foe slots, and a voice line.
- **While you fall.** About every 20 seconds, Jev reads what is near you, whether you are burning or stalling, and your wand. Then it picks an act: watch, rain, oil, lava, acid, gas, sand, gold, foes, or quench. It also picks where. An eye opens on the ceiling before anything pours.
- **The hand.** Every fourth layer ends in the hand's cavern. Jev picks what the hand pours from its palm.
- **The landing.** Between layers, Jev stocks three free spells and two items for gold, and it decides how much you heal.

The code checks each pick and can overrule it. For example, it holds back lava when you are badly hurt, and it adds a digging spell when your wand cannot dig. Every override shows in the Warden tab.

Controls: A and D move. W or Space jumps, and holding it floats you on your lantern. Aim with the mouse and hold the left button to cast. On a phone, the left thumb moves and the right thumb aims and casts.

Each layer is a route of rooms that zigzag down to the well, joined by wide sloped tunnels, with side rooms for gold and liquids. Lava and acid pool only in side rooms. A gold arrow by your lantern points along the route, and the map (Q, or the Map button) shows what your lantern has lit. The well always shows on the map.

## Files

| Path | What it does |
| --- | --- |
| `public/index.html` | The whole game, with its images inside the file |
| `public/og.jpg` | The share image |
| `public/fall/index.html` | Wardenfall: the falling-sand simulation, the wand, and the Warden's questions, in one file with no libraries |
| `api/warden.js` | A Vercel function that sends the director's questions to Jev |
| `vercel.json` | Serves `public/` with no build step |
| `qa/` | Playwright scripts that test the game in a headless browser |
| `legacy/warden-iso.html` | An older build, kept for reference |

The QA scripts open `file:///home/claude/plungerd.html`. Change that path to `public/index.html` before you run them.

## Jev and cost

`api/warden.js` signs in to AI Gateway with the project's Vercel OIDC token, so the repo holds no API key. To use a gateway key instead, set `AI_GATEWAY_API_KEY`. To pin a model, set `JEV_MODEL` (the default is `typesafe-ai/jev`).

`/api/warden` is public and spends AI Gateway credits. It accepts calls only from `*.vercel.app` origins and caps the request size. For stronger protection, add a rate-limit rule in the Vercel Firewall.
