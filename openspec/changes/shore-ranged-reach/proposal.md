# Shore of the Ancients: ranged attacks reach farther

The user reported that ranged heroes cannot attack from farther away. They said the same of intelligence heroes, which are mostly ranged mages.

## Problem
- **Short reach:** ranged heroes had a basic attack reach of 290 to 390 world units, while melee heroes have 140 to 160.
- **Large models:** hero models are 340 to 475 units tall. At that scale a ranged hero at full reach stood almost against its target.
- **No visible shot:** a ranged basic attack drew only an impact at the target, so it looked like a melee hit.
- **Rules were correct:** the simulation already let ranged heroes attack from their full reach without walking in. The problem was the reach value and the missing shot.

## Scope
- **Longer reach:** ranged basic attacks reach 1.5 times the listed range, which gives 435 to 585 units. Melee reach does not change.
- **A visible bolt:** each ranged basic attack draws a bolt from the hero to the target during the windup, in the 2D and 3D views. The bolt lands as the hit resolves.
- **Wards still out-range heroes:** against a ward or the core, a hero's reach stops inside the structure's own reach. To hit a ward, a ranged hero must stand where the ward can shoot back.
- **Bot strength:** re-measure kit strength, because ranged kits gain reach.

## Capabilities
- Modify `moba-combat`: ranged reach and the bolt.
