# Shore of the Ancients: melee heroes close the gap

The player reported that melee heroes are weak against ranged heroes. The `shore-ranged-reach` change made ranged basic attacks reach 1.5 times farther. After that change, melee kits won less often than ranged kits.

## Problem
- **Measured gap:** in 480 Veteran bot matches, melee kits won 44.5% and ranged kits won 54.1%.
- **Main cause:** ranged heroes shoot melee heroes while the melee heroes walk into reach. In bot matches, a melee hero took about 19,600 damage per match from ranged basic attacks. A ranged hero took about 8,500 damage per match from melee basic attacks.
- **Result:** a melee hero died 5.5 times per match. A ranged hero died 3.8 times per match.
- **Not the cause:** with basic attacks only, a melee hero beats a ranged hero in most duels. Melee heroes have more health and hit harder. The loss comes from the time they spend under fire before they reach their target.

## Scope
- **Shot guard:** when a ranged hero's basic attack hits a melee hero, the hit deals 25% less damage.
- **Closing speed:** the same hit makes the melee hero move 15% faster for 1.5 seconds. This helps the melee hero reach a hero that walks back while it shoots.
- **Same rules for all:** the rule follows the hero's attack type. The player and the bots on both teams get it in the same way. The simulation stays deterministic.
- **Unchanged:** spells, items, wisps, wards, neutral creatures, melee basic attacks and ranged reach.
- **Bot drafting:** re-measure kit strength and update `KIT_POWER`.
- **Not in scope:** the strength of single kits. Zephyrs is still much stronger than other kits, and Irontide is still much weaker. A separate change must balance them.

## Capabilities
- Modify `moba-combat`: add the melee shot guard and closing speed.
