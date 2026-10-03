# Combat Fun System

Use this checklist for every combat game in Cottage Arcade. A system is not "fun" because it has more enemies or more damage. It is fun when the player can read a situation, make a choice, execute it, feel the result and learn from the outcome.

## Ten measurable rules

1. **Immediate control** — core movement or attack input should begin within one rendered frame where possible. No unexplained input buffering.
2. **Readable threat** — dangerous attacks need a visible or audible tell before impact. A player who is watching should understand what is about to happen.
3. **Real counterplay** — at least one legal answer must exist for a major threat: dodge, block, interrupt, reposition, cover, outrange or trade.
4. **Punish window** — a missed or defended major attack must create a short period where the defender can act before the attacker fully resets.
5. **Impact feedback** — important hits need at least two clear channels among animation, sound, hit reaction, displacement, VFX, hitstop, UI or state change.
6. **Meaningful target priority** — enemy roles should change who the player wants to attack first. Avoid health-bar-only variants.
7. **Resource tension** — stamina, mana, ammo, cooldowns, health or position should change decisions rather than only limiting frequency.
8. **Pressure rhythm** — encounters should alternate pressure, peak and recovery instead of holding one intensity continuously.
9. **Skill expression** — better timing, aim, spacing, sequencing or positioning should produce visibly better outcomes.
10. **Understandable failure** — after taking a hit or losing an exchange, the player should be able to explain why.

## Audit score

For playtests, score each rule as **0 = absent, 1 = present but weak, 2 = strong**. Do not use the total as a quality verdict. Use low dimensions to identify what to test next.

## Shore of the Ancients

Current strengths: aimable abilities, visible cast warnings, dodgeable geometry, mana tension, hero-specific combos, roots/silence/disarm rules, neutral specials and bounded bot reaction.

Changes in this pass:
- Committed non-defensive casts now have a longer recovery after resolution.
- Regular committed casts expose roughly 0.22–0.26 s.
- Ultimates expose roughly 0.34 s.
- Defensive/instant abilities remain responsive.

Playtest focus:
- Can a player reliably punish a missed major cast without the recovery feeling sluggish?
- Does the longer reset create more bait/dodge/counter decisions?
- Are ranged heroes still able to kite without every exchange becoming a guaranteed punish?

## Crimson Rouge

Current strengths: directional melee, dodge, parry/deflect, posture breaks, lock/soft aim, enemy tells, weapon variety, recoil/recovery states and strong hit feedback.

Changes in this pass:
- Hitting a foe during recoil, recovery or stagger now deals a larger damage bonus.
- Heavy attacks receive the largest opening bonus.
- Opening hits also deal extra posture damage and show an explicit **OPENING HIT** cue.

Playtest focus:
- Do players start waiting for a whiff or deflect instead of mashing light attacks?
- Is the heavy opening reward strong enough to justify its commitment?
- Does posture break faster because of good reads, not because enemies are simply weaker?

## Playtest protocol

For each game, run three short sessions:
1. New player: can they explain why they were hit?
2. Competent player: do they intentionally bait, dodge or punish?
3. Aggressive player: can they still succeed by mashing, or does timing clearly outperform it?

Record which rule failed first. Fix that dimension before increasing health, damage or enemy count.
