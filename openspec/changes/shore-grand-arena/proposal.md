# Shore of the Ancients: grand arena in 3D

The player asked for a much bigger map, three layers of towers, a game that feels more complete, harder and more fun by the
combat-fun research (docs/combat-fun-system.md, docs/drain-fun.md), and a look that is no longer childish. They chose mythic
realism (painterly realism, golden-hour light, weathered stone, natural greens), a map twice as wide and high, and new art for all
heroes. They then asked for real 3D made with Meshy, because the painted 2.5D view felt flat.

## Scope
- A three.js 3D battlefield is the default view. Sixteen rigged hero models, a lane soldier, towers, cores, the Wild Hunt, camp
  beasts and scenery replace the painted sprites. Heroes run, attack, cast, flinch and fall with shared, retargeted animations.
  The painted 2D renderer stays as the fallback when WebGL2 is missing or when `?renderer=2d` is set.
- The map grows from 6400 to 9600 units (2.25 times the area). The layout is mirrored for both teams and written as fractions of the
  map size.
- Each lane has three tower tiers (outer, middle, inner). Two guardians defend each base before the core. Pacing, economy and
  respawn are tuned for a longer, fuller match with a clear finish.
- Combat-fun mechanics from the ten rules: clearer threats and punish windows, stronger hit feedback, target priority, a pressure
  and rest rhythm, and an understandable death. Bots get a difficulty setting and play better but stay readable and fair.
- Hero portraits are rendered from the 3D models. The HUD and menus move to the same mythic look.

## Capabilities
- Modify `moba-combat` (arena size, tower tiers, base defense, pacing, combat feedback, bots), `moba-roster` (hero artwork comes
  from the 3D models) and `moba-ui` (portraits, HUD style, graphics option).
- Add `moba-graphics` (the 3D battlefield, models, animation, lighting, fallback and performance).

## Not in scope
- New heroes or new hero kits.
- Online play.
