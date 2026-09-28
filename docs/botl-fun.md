# Breath of the Lake: what makes it fun

This note applies the research in [drain-fun.md](drain-fun.md) to Breath of the Lake. Read part 1 of that note for the sources. Here is the short form, for an open-world action game:

- **Fairness.** You see and hear an attack coming at least 0.3 s before it lands, and you know why a hit got you.
- **Competence.** The game shows each hit, and the dodge rewards good timing more than button mashing.
- **Autonomy.** You go where you like. A wall the game puts in front of you must say why it is there and what opens it.
- **Pacing.** A hard fight has checkpoints and turns. A death does not throw away the last ten minutes.
- **Teaching.** A tip comes the first time it matters, and not before.

## How the game measured up

An agent read the combat, player and boss code against these rules. Its main findings:

| Problem | Rule it breaks | Evidence in the code |
| --- | --- | --- |
| The roll kept you safe for its full 0.42 s and cost nothing. Each dodged hit gave the slow-time reward, so mashing roll beat every fight | Competence | `if (this.roll > 0) { G.perfectDodge(); return false; }` |
| A crowd of critters could all wind up and bite at the same moment | Fairness | No limit on how many critters attack at once |
| Some wind-ups were shorter than 0.3 s, and a wind-up made no sound | Fairness | `this.t = T.windup`, with no minimum and no sound |
| A bite hit you from any side, so stepping behind a critter did nothing | Competence | The strike checked distance only |
| Quick hits kept a critter flinching, so it could never fight back | Interesting choices | Each hit set the `hurt` state again |
| Hits showed no numbers, so you could not tell a strong weapon from a weak one | Feedback | Sparks only |
| A swing or a roll pressed during the short freeze after a hit was lost | Feedback | The freeze returned before input was read |
| You could walk onto the King's court at any time and meet the hardest fight in the game with three hearts | Autonomy, pacing | The court had no gate and no warning |
| A death at a boss sent you back to your last checkpoint, often far away | Pacing | Checkpoints only at the cottage, trials and freed friends |
| The three friends had a lot of health, and said one line each at the start | Pacing | Gabe 220, Christian 180, Ryu 160 |
| Christian's cards flew at 2.2 m, over the hero's head | Fairness | Card height `from.pos.y + 2.2` |
| A long fall hurt with no way to soften it, even after Christian's updraft threw you into the sky | Autonomy | Fall damage above 23 m/s, with no exceptions |
| Drowning took hearts with no sound and no number | Feedback | Only a screen flash |

## What changed

**The roll takes timing:**
- The roll keeps you safe for its first 0.26 s, not the full roll.
- The slow-time reward comes only when the roll starts just before the hit lands.
- A roll costs 14 stamina, so you cannot roll forever.

**Critters take turns:**
- At most two critters wind up at once. The rest wait.
- Each wind-up lasts at least 0.4 s and makes a sound: a honk for a goose, a growl for a bear, a swish for the rest.
- A bite lands only in front of the critter. Step around it and it misses.
- A critter flinches once, then shrugs off hits for 1.4 s. A stun still stops it.

**Every hit shows:**
- Each hit shows a number. It is white for a normal hit, gold with a "!" for a critical hit, and red for damage to you.
- A critical hit plays the critical-hit sound.
- Drowning plays the hurt sound, shakes the screen, and shows a red number.
- A swing, a roll or a jump pressed during the freeze after a hit is kept and happens after it.

**The Porcelain King waits:**
- Until Gabe, Christian and Ryu are free, the King pushes you off his court.
- He tells you why, and how many friends you have freed ("0 of 3").

**Boss fights:**
- A boss fight sets a checkpoint just outside the arena. A death puts you back at the fight.
- Gabe has 180 health (was 220), Christian 150 (was 180), and Ryu 140 (was 160). The Plunger does 5 damage (was 4).
- Each boss says a new line at two thirds and at one third of its health, so you hear the fight turn.
- Christian's cards fly at body height, where a roll or a jump answers them.

**Falls:**
- Press roll just before you land from a long fall. You take half the damage and roll out of it.
- For 6 s after Christian's updraft, a fall does no damage.

**Teaching:**
- The first time a critter winds up near you, a tip says to roll through the hit and then swing.
- The first time you fall fast, a tip says to open the umbrella or roll as you land.
- The first time your hearts get low while you carry food, a tip says how to eat.
- The help page explains the roll timing, the roll cost and the landing roll.

## Tests

`qa/wild/fun.mjs` checks these rules in a real browser:

- the King's gate,
- the roll cost,
- a bite from behind against a bite from the front,
- no more than two wind-ups at once,
- the red damage number,
- a fall with and without a landing roll,
- a fall after the updraft,
- the boss lines.

A playtest is still the only real test of fun. These tests show only that the rules work.
