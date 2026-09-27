# Down the Drain: what makes it fun

This note has three parts:

1. What the research says makes a game fun.
2. How Down the Drain measured up against it.
3. What changed in this pass, and what is still open.

## 1. What makes a game fun

**Fun is a feeling that comes out of the rules.** The MDA model splits a game into three layers. Mechanics are the rules and numbers. Dynamics are what those rules do in play. Aesthetics are the feelings the player has. A designer changes the mechanics, but the player judges the game by the feelings. For an action roguelite, the feelings that matter most are:

- challenge (can I beat this?)
- discovery (what is down there?)
- sensation (does it feel good to hit things?)

[MDA framework](https://en.wikipedia.org/wiki/MDA_framework)

**Players come back when three needs are met.** Research on why games pull people back (self-determination theory) names three needs:

- **Competence:** I am getting better.
- **Autonomy:** my choices are mine.
- **Relatedness:** I am connected to the characters or other players.

Each of these predicts enjoyment, and each predicts whether a person plays again. [PENS](https://selfdeterminationtheory.org/player-experience-of-needs-satisfaction-pens/), [Ryan, Rigby and Przybylski 2006](https://selfdeterminationtheory.org/SDT/documents/2006_RyanRigbyPrzybylski_MandE.pdf)

**Flow sits between boredom and panic.** A task that is too easy is dull, and a task that is too hard is stressful. Games stay in the band between the two by fitting the challenge to the player's skill, and some games adjust difficulty as the player plays. [Flow in gameful design](https://www.tandfonline.com/doi/full/10.1080/10447318.2025.2470279), [DDA](https://www.intechopen.com/chapters/1228576)

**A hit must feel fair.** When a hit is fair, the player sees the attack coming, has time to react, and knows what they did wrong. Some numbers:

- A player needs more than 0.3 s to see a warning and press a button.
- New players, or busy screens, need more time than that.
- A warning should use more than one sense: a pose, a colour, and a sound.

A warning the player cannot see or hear does not count. [Bugnet on telegraphs](https://bugnet.io/blog/how-to-design-enemy-attack-telegraphs), [GDKeys: anatomy of an attack](https://gdkeys.com/keys-to-combat-design-1-anatomy-of-an-attack/)

**Feedback makes actions feel good.** "Juice" means the game answers every action. Hit stop, screen shake, recoil, particles, marks left behind, and sound turn a plain rule into a good feeling. [Juice It or Lose It](https://www.gdcvault.com/play/1016487/Juice-It-or-Lose), [The Art of Screenshake](http://notebook.maryrosecook.com/Theartofscreenshake,JanWillemNijman.html)

**A choice matters when it has a trade-off.** A game can be seen as a series of interesting decisions. A decision is interesting when:

- the player understands it,
- the result matters,
- no option is plainly best.

Risk against reward is the classic way to build one. [Sid Meier, GDC 2012](https://www.gamedeveloper.com/design/gdc-2012-sid-meier-on-how-to-see-games-as-sets-of-interesting-decisions)

**Pacing needs rest between peaks.** Intensity should rise and fall. Start calm, build up, peak, then rest, because constant high intensity numbs the player. Branches off the main path should reward the player, and they should not punish exploring with a long walk back to nothing. When several ways lead through a level, they should meet again at clear points. [Level Design Book: pacing](https://book.leveldesignbook.com/process/preproduction/pacing), [critical path](https://book.leveldesignbook.com/process/layout/criticalpath), [on branches and dead ends](https://www.strayspark.studio/blog/level-design-fundamentals-blockout-flow)

**In a roguelite, death is part of the loop.** Hades and Dead Cells treat death as a normal step in the cycle. A run should leave the player with something: story, unlocks, or a new option. Dead Cells grows the player's options more than their raw power. [Supergiant on Hades](https://www.tomsguide.com/uk/features/hades-exclusive-interview-supergiant), [Indiecator on roguelite progression](https://indiecator.org/2022/03/30/on-roguelikes-and-progression-systems/)

## 2. How the game measured up

An agent read the game code and checked each system against these principles. Its top findings:

| Problem | Principle it breaks | Evidence in the code |
| --- | --- | --- |
| Critters chain hits while you stand in them, at about 23 damage a second, with no knockback | Fairness, competence | 0.35 s of safety after a hit, and no push |
| The roll is no faster than walking | Feedback, competence | The roll speed of 3.2 was cut back to the run speed of 1.9 on the next frame |
| Lava, acid, fire and poison hurt you silently | Feedback, fairness | Hurt sound and shake only for hits of 3 or more; hazards deal about 0.6 per frame |
| Attacks cannot be seen in the dark, and wind-ups are silent | Fairness | The lantern lights 75 px, but gulls spit from 110 px; the sound plays only at the strike |
| Digging brings a cave-in before one stamina bar is used | Autonomy (the core verb is punished) | Noise faded at 0.05 per second |
| Death takes every cap, and the end screen says the opposite | Roguelite death loop | "Caps dropped … spend them at the tab next time" |
| Hitting a propane tank always blows up on you | Interesting choices (it is a trap, not a choice) | Melee reach 10 against a blast radius of 15, with no fuse |
| The boss slam has no warning, and the boss pays no reward | Fairness, reward | The slam starts at once; no relic, boon or scroll on a kill |
| Navigation is weak on the wide map | Pacing, discovery | A tiny yellow compass next to the yellow aim line; no pointer to the drains |
| Grind at depth | Flow | Every critter doubled; hornet nests spawn forever |
| The hints never teach hover, hot dogs or wall jumps, and one hint names the wrong key | Competence | "Hold F or Shift" (Shift rolls) |
| A slow online Cottage can hold the loading banner a long time | Pacing | A 6 s timeout, 2 attempts, several calls per layer |

## 3. What changed

**Fair hits:**
- After a hit you now have 0.8 s of safety, up from 0.35 s.
- Every hit knocks you away from the critter that hit you.

**The roll works:** it keeps its speed through the whole roll and covers about three times the distance of a run in the same time.

**Hazards give feedback:** damage from lava, acid, fire and poison is added up. A few times a second it plays the hurt sound, shakes the screen, flashes the hero, and shows a red number. Damage to you now shows as a red number too.

**Warnings you can see and hear:**
- Any critter that is winding up an attack glows through the dark.
- The lantern reaches 96 px, up from 75.
- The goose, gull and moose click when the wind-up starts.
- The moose also flashes during its wind-up.

**Propane tanks:** a hit starts a 1.1 s hissing fuse. The tank blinks and throws sparks, so you have time to run, or to lure critters into the blast.

**The boss:**
- It shudders and flashes for 0.5 s before a slam.
- After a slam it stays down 0.7 s, which gives you a window to hit back.
- A kill drops a scroll of power and a rich cooler.

**Digging:**
- Noise now fades about three times faster.
- At 70% noise the ground groans and a hint warns you, before any cave-in comes.

**Caps:** a death keeps half of the caps you carry for your next run. The end screen says how many were kept.

**Navigation:**
- The compass is teal and longer, so it does not look like the aim line.
- Once the drains open, an arrow at the edge of the screen points to each drain. The richer drain's arrow is orange.

**Less grind:**
- The wide layer adds half again as many critters, not double.
- A hornet nest makes six hornets, then it is empty.

**Teaching:**
- First-time tips appear on a long fall (hover), at low health (eat a hot dog), and on the first wall slide.
- The dig hint names the right key.

**Waiting:** each online Cottage call now gives up after 3.5 s, down from 6 s.

## Still open

These need a decision or a playtest before I change them:

- **The fast-drain timer is hidden on phones.** The top bar has no room for it.
- **Gold has few uses.** Only two items per snack bar take gold. Gold could buy hot dogs, rerolls, or a shovel upgrade.
- **Intensity peaks and rests.** Sealed rooms are the peaks. Calm rooms and safe spots between them would give real rest.
- **Loading the next layer.** It could be planned during the snack bar, so there is no wait at all.
- **The streak meter.** It drains fast. Across the wide map, anything above rank C is realistic only in sealed rooms.

A playtest is still the only real test of fun. Automated tests show only that the game works.
