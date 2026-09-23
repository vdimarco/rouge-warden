# Get Plunger'd: Cottage Brawl

A fast top-down roguelite for the crew, in the style of Enter the Gungeon. Pick your guy, grab a plunger, and fight across the cottage: the dock, the cabin, the trail, and the beach, six areas a day, then the Porcelain King in the outhouse. The cottage (the director, powered by Jev) builds every area, picks your rewards and wildlife, and remembers how you play.

Rename the crew in the FRIENDS list near the top of the game script in public/index.html.

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

## How it works

| Path | What it does |
| --- | --- |
| `public/index.html` | The whole game: Phaser 3, the sound, the UI, and the Warden's questions |
| `api/warden.js` | A Vercel function that sends the Warden's questions to Jev |
| `vercel.json` | Serves `public/` with no build step |

Each call sends the game state and a set of choice questions. A room call asks 23 at once: pressure, ten foe slots, the theme, mirroring, nine zones, and a voice line. Jev returns probabilities, the game samples from them, and the code checks the result. For example, it cuts a path if a zone seals off a door. Every call shows in the Warden tab with its options, odds, and any code overrides.

`api/warden.js` signs in to AI Gateway with the project's Vercel OIDC token, so the repo holds no API key. To use a gateway key instead, set `AI_GATEWAY_API_KEY`. To pin a model, set `JEV_MODEL` (the default is `typesafe-ai/jev`). If Jev fails twice in a row, the stand-in answers for 20 seconds.

## A note on cost

`/api/warden` is public and spends AI Gateway credits. It accepts calls only from `*.vercel.app` origins and caps the request size. A room costs about $0.0003 at Jev's input price. For stronger protection, add a rate-limit rule in the Vercel Firewall.
