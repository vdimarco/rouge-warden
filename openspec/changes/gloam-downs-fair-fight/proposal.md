# Gloam Downs: a fair fight

## Why
After playing the preview, the player said: "game is quite hard... can we mnake the dificult scale in a more natural way... enemies are ruthless, my attacks should interrupt like in deadcells".

The study of the code at 9e243098 (design.md "What is there now") found why:
- **Hits do not interrupt.** A cut in a foe's wind-up never stops it. In 12 of 12 measured cases a Snuffer's hook landed while the player cut it. Only the finisher or a plunge stops a light foe, and the finisher lands too late for a hook. Trading blows always loses, so rolling is the only safe answer.
- **The rules are one-sided.** A foe's hit stops any move of the lamplighter. A foe in a move ignores the lamplighter's hits.
- **Attacks come with no gap.** A melee token comes back when a blow's active time ends, and the next foe takes it on the very next step. Standing still, 17 to 51 blows in 30 s land inside the 0.9 s safe time after a hit.
- **Blows come from off screen** with only a notch to warn, 0.4 s later than a foe in view.
- **The curve compounds.** Damage and health both grow by d^1.5 on top of Ember 0's ×1.3. By Barrow Crown a hook deals 79 and a Snuffer needs 5.6 strings. 45% of the slow bot's deaths are at The Crow Wall.
- **Armor cannot be read.** The Ironback and the elites fight through hits, and nothing shows that they will.

## What changes
### Interrupts
- A blade hit, a plunge and a damaging ability make a light or medium foe flinch in any state. A hit in its wind-up cancels the attack: the blow does not land, the foe resets and waits before it tries again. Each foe kind has its own hit stun.
- A foe that flinches three times in 3 s is braced for 1 s, so no foe is held in an endless flinch.
- The Ironback and the elites have poise. Hits wear it down, hits in a wind-up wear it faster, and a break staggers them. Their armored attacks glow during the wind-up in a clear cold colour, never the warning fire.
- The Barrow Reeve flinches only when its poise breaks.
- An interrupt feels good: a short hit stop, a knock back, its own sound.

### Fair foes
- Fewer foes attack at once: one melee attack in the run's first two places, two after that, and one coal.
- Blows on the lamplighter are spaced at least 0.6 s apart, and no foe starts a wind-up within 1.0 s of a hit on the lamplighter.
- A foe that lands a hit backs off. Foes that wait circle at a distance.
- No attack from off screen without its sound tell.
- After a hit, the lamplighter has 1.0 s of safe time and a short knockback.

### A natural difficulty curve
- The steep d^1.5 growth is replaced with a gentle line. Later places bring new foe kinds (as now), more foes, mixed zones and a second attack token before they bring raw damage.
- Foes also grow a little with the sparks the run holds, so the challenge follows the player's power.
- Ember 0 damage goes from ×1.3 to ×1.1, so the first places forgive mistakes. Lasting growth stays meaningful: a spark always gives more than the foes gain from it.

### Pacing targets and checks
- The bot reads interrupts and armor and uses the real foe rules. Targets for 60 bots a skill: at 0.3, place 2 in 80% of first runs and place 3 in 40%, first win in run 8 to 20; at 0.5 in run 3 to 8; at 0.9 in run 1 to 2. Damage taken rises smoothly through the places, and no place's death rate spikes.
- Node tests for the interrupt rules, tokens, safe time and the curve; a browser check that hits a winding-up foe and sees the attack cancelled and the flinch drawn.

## Capabilities
- Modified: `gloam-downs-run`. The delta is `specs/gloam-downs-run/spec.md`.
- The explorer capability, `gloam-downs`, does not change.

## Scope
- The game keeps its own names: flinch, brace, poise, armor glow, tokens, glim, sparks. No name, art, text or sound comes from Dead Cells or any other game. Only the mechanic (a hit interrupts a small foe) is borrowed from the genre.
- No baked place, foe or boss file changes. Foe pools stay as baked.
- `play.js` camera code does not change unless a test proves it is needed.
- Fire stays the brightest colour: the armor glow is not a fire slot (34 to 37).
- No Higgsfield or other paid generation. The new sound is synthesized like the others.
- The 0.9 bot's 15 to 25 minute winning run is out of scope: it needs new ground, not tuning (gloam-downs-growth design.md "Pacing results").
