# Shore of the Ancients: more varied hero abilities

The user asked for hero abilities that are more interesting and varied.

## Problem
- **Shared kits:** the roster had sixteen heroes but only twelve combat kits. Four pairs played the same four spells with different names:
  - Irontide played Stoneheart's kit.
  - Bloodwake played Dredge's kit.
  - Zephyrs played Riftblade's kit.
  - Coral Sage played Salt Priestess's kit.
- **Missing kinds of play:** no spell hooked a single target, redirected damage, taunted, leashed, cost health, parried, chained strikes, blocked missiles, repelled, swapped places, bounced between allies and enemies, or acted on the whole map.

## Scope
- **Four new combat kits (12 to 15).** Irontide, Bloodwake, Zephyrs and Coral Sage each get their own kit. Every one of the 16 skills uses a mechanic that no other kit has:
  - **Irontide (tank):** Anchor throw hooks the first enemy in a line. Iron oath takes 40% of an ally's damage. Challenge taunts nearby enemies. Anchorfall chains enemies to an anchor.
  - **Bloodwake (duelist):** Crimson lunge resets on a banish. Blood price spends health for attack speed and heavy strikes. Red parry blocks one hit and stuns the attacker. Red horizon cuts up to three enemies in turn.
  - **Zephyrs (trickster):** Gust dash throws enemies aside. Cyclone travels and lifts each enemy once. Wind wall destroys enemy spell missiles. Eye of the storm repels enemies and speeds allies.
  - **Coral Sage (support):** Tide swap trades places with a hero. Polyp swarm hops between enemies and allies. Coral armor reduces damage and turns the shield left into healing. Spring tide cleanses and heals every ally on the map.
- **Each new kit includes:**
  - its own stats, basic attack names and rhythm;
  - mana costs and cast windups;
  - aim previews and warning shapes;
  - bot spell choices;
  - sounds, colours and icons;
  - a spell sheet, a 2D figure and an idle loop.
- **Art without paid generation:**
  - The spell sheets are rendered in Chromium from the hero's 3D portrait, the kit colour and the skill glyph (`qa/tidebreak/render-shore-spells.mjs`).
  - The 2D figures and idle loops come from the existing 3D portraits.
- **Not in scope:** the other twelve kits do not change.

## Capabilities
- Modify `moba-roster`: sixteen combat kits; each identity has its own kit.
- Modify `moba-skills`: add the shore kit mechanics.
