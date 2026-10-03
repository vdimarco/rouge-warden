# Decisions

Use the existing hero kits and visual direction. Preserve mana, rank gates, item rules, target orders, concurrent pointers and the six-minute match limit.

Low-level `cast` resolves an accepted spell. Player gameplay requests may first create a visible, locked-aim intent for selected strong attacks. Defensive and ordinary spells keep quick response. Death, stun, fear and silence cancel pending casts without resource spend. A root cancels movement skills, preserves non-movement skills and permits basic attacks. Forced displacement remains possible and interrupts a pending commitment when it moves the caster beyond eight units, keeping damage aligned with the shown warning.

Keep attack cadence and mean three-hit damage intact while varying windup and recovery by hero. Expose mark duration and bonus-ready skills through native overlays. Add result cues rather than more routine shake.

Bot Omen and Soul thread commits retain the selected creature and display a following target marker. They check target range and visibility at impact; another creature crossing the aimed point cannot receive the spell instead. Directional and placed attacks retain their locked geometry.

Bots must respond after a bounded delay and share objective opportunities under the same team rules. Neutral specials have explicit shapes, locked aim and recovery windows; they use existing collision and line-of-sight rules.

Validate behavior with meaningful deterministic scenarios and existing seeded full-match suites. Use local Playwright because the Browser plugin is absent. Report physical-phone performance separately. OpenSpec CLI is unavailable; inspect delta format and scenario coverage directly instead of claiming CLI validation.


Combat-fun follow-up: committed casts now separate the defender's two rewards. The warning is the dodge opportunity; the post-cast recovery is the punish opportunity. Regular committed casts use a 0.22-0.26 second recovery and ultimates use 0.34 seconds. Defensive/instant actions keep zero added recovery.
