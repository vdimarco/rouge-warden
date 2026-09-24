# Warden

An endless isometric roguelite where the dungeon watches you back. The Warden is an AI director. It designs every room zone by zone and picks your rewards, doors, and foes. On the live site, [Jev](https://jevapi.dev/) makes those choices through Vercel AI Gateway.

## Play

Deploy to Vercel, or open `public/index.html` in a browser. Opened locally, a built-in stand-in answers for Jev with the same answer shape.

- On a phone, one hand is enough: drag anywhere to move, and you attack on your own. Tap to throw your lantern where you tapped, and flick to dash. Turn "One hand" off to use buttons instead.
- Attack with J or the left mouse button. Hold it for a three-hit combo.
- Special with K or the right mouse button.
- Cast with L to throw your lantern. Walk over it to pick it up.
- Dash with Space. Dash through a blow at the last moment and your next swing crits.
- Tap the health bar or the eye at the top for stats and the Warden's decisions.

## Wardenfall

Wardenfall is a spin-off at `/fall/`, built like Noita. The Warden melted its halls, and every pixel now moves. You carry the lantern down a well of sand, stone, and liquid. Sand and gold fall. Water, oil, lava, acid, sludge, and blood flow. Fire spreads through wood, moss, oil, and miasma. Water turns lava to obsidian, acid eats stone but not glass, and lightning shocks all that touch water. You fight with a wand of spells that casts from left to right. Modifiers change the next spell.

Jev runs the environment:

- **Each layer.** One call asks 32 questions: the look, then the fill, liquid, and cave shape of six strata, then the gold, the foe count, ten foe slots, and a voice line.
- **While you fall.** About every 20 seconds, Jev reads what is near you, whether you are burning or stalling, and your wand. Then it picks an act: watch, rain, oil, lava, acid, gas, sand, gold, foes, or quench. It also picks where. An eye opens on the ceiling before anything pours.
- **The hand.** Every fourth layer ends in the hand's cavern. Jev picks what the hand pours from its palm.
- **The landing.** Between layers, Jev stocks three free spells and two items for gold, and it decides how much you heal.

The code checks each pick and can overrule it. For example, it holds back lava when you are badly hurt, and it adds a digging spell when your wand cannot dig. Every override shows in the Warden tab. Both games use the same `/api/warden` function. When both games run on the same site, Wardenfall reads how many runs you made through the halls.

Controls: A and D move. W or Space jumps, and holding it floats you on your lantern. Aim with the mouse and hold the left button to cast. On a phone, the left thumb moves and the right thumb aims and casts.

## How it works

| Path | What it does |
| --- | --- |
| `public/index.html` | The whole game: Phaser 3, the sound, the UI, and the Warden's questions |
| `public/fall/index.html` | Wardenfall: the falling-sand simulation, the wand, and the Warden's questions, in one file with no libraries |
| `api/warden.js` | A Vercel function that sends the Warden's questions to Jev, for both games |
| `vercel.json` | Serves `public/` with no build step |

Each call sends the game state and a set of choice questions. A room call asks 23 at once: pressure, ten foe slots, the theme, mirroring, nine zones, and a voice line. Jev returns probabilities, the game samples from them, and the code checks the result. For example, it cuts a path if a zone seals off a door. Every call shows in the Warden tab with its options, odds, and any code overrides.

`api/warden.js` signs in to AI Gateway with the project's Vercel OIDC token, so the repo holds no API key. To use a gateway key instead, set `AI_GATEWAY_API_KEY`. To pin a model, set `JEV_MODEL` (the default is `typesafe-ai/jev`). If Jev fails twice in a row, the stand-in answers for 20 seconds.

## A note on cost

`/api/warden` is public and spends AI Gateway credits. It accepts calls only from `*.vercel.app` origins and caps the request size. A room costs about $0.0003 at Jev's input price. For stronger protection, add a rate-limit rule in the Vercel Firewall.
