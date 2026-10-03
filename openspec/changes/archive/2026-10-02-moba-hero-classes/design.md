# Design
Each hero has one primary attribute and independent attack type and role. Strength adds health and regeneration per level. Agility adds attack speed and armor. Intelligence adds spell power, mana capacity and regeneration. Existing base stats and item rules stay the starting point. Selection shows the primary attribute and its growth beside four spell previews; filters match attribute, range or role.

Preserve the original four folklore combinations. Diversify the expanded roster further: Kraken's lance drains mana and abyss pulls, Wendigo's storm follows its caster, Kitsune launches seeking foxfires, Golem's fault disarms, Banshee sends returning spirits, Phoenix uses a moving sun beam, Dryad spreads roots and grows a targeted restorative bloom, Gorgon bounces venom between separate targets. Add bounded, deterministic projectile and timed ability events, separate from movement input. Debuffs and casts cancel correctly on death or disable.

## Kit contract
| Hero | Attribute | Q | E | C | R |
| --- | --- | --- | --- | --- | --- |
| Mothman | Agility | Flight and ambush cloak | Feather slow fan | Omen empowers next attack | Fear, concealment and sight |
| Nessie | Strength | Healing dive with wet wake | Pull and drench | Wet-target knockback stun | Pulling whirlpool with team healing |
| Baba Yaga | Intelligence | Hut hop and shield | Hidden snare | Delayed mortar and rooted-target burn | Three expanding stomps |
| Jersey Devil | Agility | Stunning leap | Bleed-amplified fear | Bleeding claws and chase speed | Attack frenzy and life steal |
| Kraken | Intelligence | Stationary ink cover | Latch and brine mark | Piercing damage and mana theft | Pulling abyss tentacles |
| Wendigo | Strength | Frost hunt trail | Chill-triggered stun | Missing-health bite and healing | Moving whiteout storm |
| Kitsune | Agility | Decoy blink and return | Three seeking foxfires | Delayed mark-consuming knot | Nine marked-target foxfire pulses |
| Stone Golem | Strength | Collision charge and knockback | Line fissure and disarm | Shield and reflected attacks | Delayed earth eruption |
| Banshee | Intelligence | Phasing drain movement | Silencing line cry | Damage-to-healing soul thread | Six hunting and returning spirits |
| Phoenix | Intelligence | Curved burning flight | Burning feather fan | Moving healing sun beam | Single fatal-hit rebirth |
| Dryad | Intelligence / Support | Thorn and healing sentinel | One-generation spreading roots | Targeted health and mana bloom | Healing and damaging sanctuary |
| Gorgon | Agility | Cleanse and scale guard | Three-target bouncing venom | Facing-dependent stone gaze | Poison-amplified periodic petrification |
