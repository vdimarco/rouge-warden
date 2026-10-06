## RENAMED Requirements

- FROM: `### Requirement: Expanded two-stage arena`
- TO: `### Requirement: Grand three-tier arena`

## MODIFIED Requirements

### Requirement: Grand three-tier arena
The arena SHALL be 9600 units square. Positions SHALL be authored as fractions of the map size, and footprints (cover, brush, river
width, bridges) SHALL keep a fixed size, so the map size can change without enlarging obstacles. Team 1's half SHALL mirror team 0's
half across the river. Each of the three lanes SHALL cross the river exactly once and SHALL stay open for the largest moving body in
both realms. The middle lane SHALL curve so that it is at least 75% as long as a side lane.

Each lane SHALL have an outer, a middle and an inner ward for each team. Wards SHALL be placed by walking distance along the lane from
the team's own base; the same ward of the two teams SHALL be the same walk from its base within 2%, and consecutive wards on a lane
SHALL be at least 2.5 tower ranges apart. A ward SHALL be protected while the previous ward on its lane stands. Every tower type,
including base guardians, SHALL be a tower with a tier (0 outer, 1 middle, 2 inner, 3 guardian), so every renderer can draw it.

The arena SHALL have eight spirit camps, about 24 brush patches, about 26 cover blocks and six rift gates: four river gates, each
paired with the gate across the river on the other side of the map, and one gate near each base that sends a hero to the team's own
river gate on the side the hero faces. World paths, river, terrain, camps, gates, scenery, the 2D and 3D views and both maps SHALL use
the same dimensions, and the 2D ground SHALL show water along the whole river.

#### Scenario: Break a lane
- **WHEN** a player attacks a lane's middle ward while its outer ward stands
- **THEN** the middle ward takes no damage, attack orders on it are refused, and a tip names the outer ward that must fall first.
- **WHEN** the outer ward falls, then the middle ward
- **THEN** each next ward becomes vulnerable in turn, and the HUD names the next ward and how many of the nine enemy wards stand.

#### Scenario: Another lane keeps its own chain
- **WHEN** the outer ward of one lane falls
- **THEN** the middle wards of the other two lanes stay protected.

#### Scenario: A fair, mirrored shore
- **WHEN** both teams play the same heroes lane for lane over many seeded bot matches
- **THEN** each team wins about half of them, and every ward of one team is the same walk from its base as the matching ward of the
  other team.

#### Scenario: Cross the river
- **WHEN** a hero walks any lane from base to base
- **THEN** it crosses the river once, on a bridge that spans the water and lands on dry ground at both ends.

#### Scenario: Take a base gate
- **WHEN** a hero stands at the gate near its base, faces west and uses the gate
- **THEN** the hero arrives at its team's western river gate, and facing east sends it to the eastern one.

### Requirement: Clear match flow
Players SHALL begin on their lane a short walk behind their allied outer ward and receive a clear next objective that follows the
protection chain (outer, middle, inner ward, then the guardians, then the core). Map destinations SHALL issue actual movement or
attack orders after the map closes. The camera SHALL keep the player and forward action visible while following movement smoothly.
The match clock SHALL count down to sudden death and then to the hard limit.

#### Scenario: Enter the arena
- **WHEN** the player starts a match
- **THEN** the hero begins on its lane behind its outer ward, can learn a skill, and can follow a map route to the next vulnerable enemy
  structure.

#### Scenario: Follow a map route
- **WHEN** the player selects a destination on the tactical map
- **THEN** the map closes and the hero moves to it or pursues the selected vulnerable structure, while manual movement can cancel the
  route.

### Requirement: Spell resources
Every hero SHALL have mana, distinct spell costs and regeneration. A failed cast SHALL spend neither mana nor cooldown. Respawn and the home
court SHALL restore mana. Lane regeneration SHALL be low enough that a player who casts every spell on cooldown in fights runs short of mana
for part of the match, so spells compete for mana; a player who spends with care SHALL rarely run short.

#### Scenario: Plan a combination
- **WHEN** a trained hero casts skills in sequence
- **THEN** each successful cast spends its shown cost; insufficient mana blocks casting while basic attacks and training remain available.

#### Scenario: Cast on cooldown in a long fight
- **WHEN** a player presses every ready spell whenever an enemy is near, for a whole match
- **THEN** the hero lacks the mana for its cheapest learned spell for about a tenth to a fifth of its living time, and the home court refills
  it quickly.

## ADDED Requirements

### Requirement: Base guardians
Each base SHALL have two guardians beside its court. Guardians SHALL be protected until any inner ward of their team falls, and the core
SHALL be protected until both guardians fall. A vulnerable guardian SHALL slam the ground under a hero (or a packed wave) in its range:
a labelled circle SHALL show at least 0.6 seconds before impact, the slam SHALL hit only units inside the circle when it lands, and the
guardian SHALL then be exposed for a recovery window in which it does not attack and takes extra damage.

#### Scenario: Open the base
- **WHEN** any inner ward of the enemy team falls
- **THEN** both enemy guardians become vulnerable while the enemy core stays protected, and the HUD names the guardians.
- **WHEN** one guardian falls
- **THEN** the core is still protected; when the second guardian falls, the core becomes vulnerable and the HUD says the rift is exposed.

#### Scenario: Dodge and punish a slam
- **WHEN** a guardian marks a circle under the player's hero and the player walks out of it before impact
- **THEN** the slam deals no damage to the hero, the guardian shows an exposed state, and hits on it during that window deal 25% more
  damage.

### Requirement: Match pacing and finish
A match on the grand arena SHALL have a laning phase, a middle game of tower sieges and a decisive end:
- The first wave SHALL leave each base at 0:24 and later waves every 20 seconds. A wave SHALL have two melee wisps and a caster wisp that
  attacks from range, a siege wisp on every third wave, and an elder wisp on a lane where the enemy inner ward is down. Waves SHALL grow
  stronger over time after five minutes.
- Outer wards SHALL take reduced damage for the first three and a half minutes, and the 2D view SHALL label them as fortified.
- Wards, guardians and cores SHALL take much less damage from heroes unless a wisp or siege beast of the attacking team is at the
  structure, and the player SHALL see a tip that explains it. Outside sudden death a core SHALL heal while no enemy wisp is at it,
  so a failed push does not wear it down.
- Every hero (keyboard movement, click orders and bots) SHALL get the same out-of-combat sprint and speed effects.
- Respawn SHALL take 6 + 1.2 seconds per level, at most 28 seconds.
- At 14:00 sudden death SHALL start: protection is lifted, structures take more damage and no longer need a wave, home heals slowly,
  respawns take longer and the change is announced. At 17:00 the team that broke more structures SHALL win, then the team with more
  structure health, then the team with more kills; otherwise the match is a draw. The result SHALL state the reason.
- Over at least 36 seeded bot matches, each with its own draft, the medians SHALL be close to: first skirmish 0:20–0:40, first blood
  1:00–2:30, first outer ward 3:00–4:30, first middle ward 5:00–7:00, first inner ward 7:00–9:00, core exposed 9:00–11:00, and match end
  about 12 minutes with the middle half of matches ending roughly between 10 and 14 minutes.

#### Scenario: Laning phase
- **WHEN** a match starts
- **THEN** heroes meet their first wave near the middle of their lane, outer wards show as fortified, and no outer ward falls in the
  first three minutes of a typical bot match.

#### Scenario: Siege without a wave
- **WHEN** the player attacks an enemy ward with no allied wisp near it
- **THEN** the ward loses only a quarter of the damage and a tip tells the player to push with a wave; with a wisp at the ward, the full
  damage lands.

#### Scenario: Sudden death
- **WHEN** 14 minutes have passed (the match clock runs out) and both cores stand
- **THEN** a sudden death banner appears, every structure can be damaged, deaths last longer and home heals slowly.

#### Scenario: Hard limit
- **WHEN** 17 minutes have passed (the final countdown runs out) and both cores stand
- **THEN** the match ends, the team that broke more structures wins, and the result screen states that reason (or the next tiebreak).

### Requirement: Bots on the grand arena
Bots SHALL walk their lane with their wave, SHALL not walk into the range of an enemy ward, guardian or core that no wisp of their team
tanks, and SHALL wait at their own front ward when they have no wave. When every ward on an enemy lane is down, bots SHALL
join the push on that lane, taking a routed path around cover to reach it. Rotation, assist, rally and Wild Hunt reach SHALL scale with the map
size. A side-lane bot leaving its base SHALL take its base gate when its wave has already passed the river gate.

#### Scenario: A bot without a wave
- **WHEN** a bot's lane has no allied wisps and the bot stands just outside an enemy ward's range
- **THEN** the bot falls back toward its own ward and never enters the enemy ward's range.

#### Scenario: Bait under a ward
- **WHEN** the player stands under their own ward at 45% health, no enemy wisp is at that ward, and it is not sudden death
- **THEN** a Veteran enemy bot that chases or fights the player stops outside the ward's range.

#### Scenario: A fight beside an enemy ward
- **WHEN** a bot fights or assists near an enemy ward that no wisp of its team tanks, outside sudden death
- **THEN** every move it makes stays outside that ward's range, unless the target is almost dead and the bot can take the shots.

### Requirement: Every heavy attack warns in two senses
Heavy attacks SHALL give the defender at least 0.3 s of warning in both sight and sound before they can hit.

#### Scenario: An enemy starts a committed cast
- **WHEN** an enemy hero or neutral guardian starts a cast that is not instant
- **THEN** a red shape appears over the ground it will hit, the caster leans into a windup, and a rising sound plays from that direction, at
  least 0.3 s before the hit, and the sound is brighter when the shape covers the player.

#### Scenario: An engage that stuns
- **WHEN** an enemy begins a leap or a charge that stuns on contact
- **THEN** a path to its landing point is drawn for at least 0.3 s before the stun can land, and a player who leaves that path before the hit
  takes no stun and no damage from it.

#### Scenario: A tower chooses a new hero target
- **WHEN** an enemy tower switches its fire to a hero
- **THEN** a lock-on line from the tower to that hero appears, a warning tone plays when that hero is the player, and the tower's first shot at
  that hero lands no earlier than 0.35 s after the lock-on appears.

### Requirement: A missed commitment can be punished
A committed cast that hits nothing SHALL leave its caster open for a window the enemy can see and use.

#### Scenario: A cast that hits nothing
- **WHEN** a hero resolves a committed cast and it hits no enemy
- **THEN** the caster cannot cast or attack for 0.5 s (0.7 s after an ultimate), and an EXPOSED ring and countdown show over the caster for
  that time.

#### Scenario: Hitting an exposed enemy
- **WHEN** a hero hits an enemy hero who is exposed
- **THEN** the hit deals 15% more damage and shows OPENING HIT, and a hit that kills an exposed hero shows FINISHER.

#### Scenario: A cast that lands
- **WHEN** a committed cast that is not an ultimate hits what it was aimed at
- **THEN** the caster keeps the short recovery and is not exposed; an ultimate that lands is exposed for its own recovery.

#### Scenario: An interrupted cast
- **WHEN** a hero's pending cast is cancelled by a stun, fear, silence or death
- **THEN** the caster staggers and is exposed for 0.4 s, and the cast spends no mana and no cooldown.

### Requirement: Heavy hits are felt
Important hits SHALL be reported through at least two channels beyond the health bar.

#### Scenario: A heavy hit on the player or by the player
- **WHEN** a heavy strike, an ambush, an opening hit, an ultimate or a hero kill involves the player
- **THEN** the picture of the units in the hit holds for 60 to 90 ms by the weight of the event, the view shakes by 4 to 8 pixels, and a low
  impact sound plays, while the match simulation keeps its fixed rate so a seeded replay is unchanged.

#### Scenario: The player takes damage
- **WHEN** the player loses health
- **THEN** a thud plays, scaled by the share of health lost, the screen edge flashes red, and below 30% health a heartbeat plays until the
  player heals.

#### Scenario: A last hit and a big number
- **WHEN** the player lands the finishing hit on a wisp, or deals a large hit
- **THEN** a gold chime confirms the last hit, and damage numbers grow with the amount and take the colour of the damage type.

#### Scenario: Reduced motion
- **WHEN** the player's system asks for reduced motion
- **THEN** no hitstop and no extra shake are applied, and the sounds and the edge flash remain.

### Requirement: The player can read a death
After a death the player SHALL be able to explain it without replaying the match.

#### Scenario: A hero dies
- **WHEN** the player's hero dies
- **THEN** a recap appears during the respawn that names the killer, lists the damage by source and by type over the last 8 seconds, names
  the warned hits that landed and whether they were dodgeable, names the time spent stunned or feared, and gives one tip drawn from the main
  cause, and its totals match the health and shield the hero lost.

#### Scenario: The recap never blocks play
- **WHEN** the recap is shown at 1440x900, 390x844 or 844x390
- **THEN** it covers no control, stays inside the screen, carries the respawn countdown, and closes with its own button.

### Requirement: Skill is rewarded in the small moments
Timing and spacing SHALL change the result of ordinary exchanges.

#### Scenario: A press during a cast
- **WHEN** the player presses a spell in the last 0.12 s of a cast or a recovery
- **THEN** the button reads QUEUED and that spell is cast on the first step the hero is free, and a press earlier than that is dropped.

#### Scenario: Your own cast begins
- **WHEN** the player's cast starts its windup
- **THEN** a short click confirms the commitment.

#### Scenario: The third basic strike
- **WHEN** a hero's third chain strike is aimed at another hero
- **THEN** an arc shows where it will reach, and a target who steps out of that reach before contact takes no damage and sees DODGED.

### Requirement: Targets and timers guide the next decision
The player SHALL be able to see which enemy matters next and when the next peak comes.

#### Scenario: Marks on priority targets
- **WHEN** an enemy wisp can be finished by the player's next basic attack, or an enemy summon heals its team
- **THEN** that unit carries a visible mark.

#### Scenario: Camps fight like their art
- **WHEN** a spirit camp uses its special
- **THEN** a mage or archer camp warns a line and an ogre or knight camp warns a cleave, each named after the creature.

#### Scenario: The objective clock
- **WHEN** a match is running
- **THEN** the HUD shows the time to the next Wild Hunt, which turns gold and sounds a horn in its last 10 seconds, and when the player is out
  of combat with no peak within 20 seconds, the clock shows a quiet phase.

### Requirement: Enemy difficulty setting
The game SHALL offer three enemy difficulties, Apprentice, Veteran and Mythic, chosen on the selection screen before a match. Veteran SHALL be
the default. The choice SHALL be saved on the device and shown during the match. Difficulty SHALL change only how enemy bots perceive and
decide, never health, damage, speed, range, armour, mana or gold. Allied bots SHALL play at one fixed level for every difficulty.

#### Scenario: Choose and keep a difficulty
- **WHEN** the player selects Mythic beside Play and reloads the page
- **THEN** Mythic is still selected, and the next match shows "Mythic" next to the minimap.

#### Scenario: Difficulty does not change stats
- **WHEN** the same lineup starts on Apprentice and on Mythic
- **THEN** every hero has the same health, damage, speed, range, armour, mana and gold in both matches.

#### Scenario: Allies stay the same
- **WHEN** the player changes the difficulty
- **THEN** the two allied bots play by the same profile as before.

### Requirement: Bots react at human speed
A bot SHALL NOT answer a new cast warning or pending ground before the reaction floor of its difficulty (Apprentice 0.45 s, Veteran 0.30 s,
Mythic 0.24 s). A bot SHALL sometimes fail a dodge with a short step, more often at lower difficulty. Bot spell warnings SHALL keep their
length at every difficulty.

#### Scenario: A quick cast lands on a slow bot
- **WHEN** the player starts a spell whose warning covers an Apprentice bot and the spell resolves 0.4 s later
- **THEN** the bot has not started to dodge.

#### Scenario: Bot spells stay readable
- **WHEN** a Mythic bot casts an offensive spell
- **THEN** the warning shape shows for at least 0.5 s before the damage.

#### Scenario: A failed dodge leaves the bot in the zone
- **WHEN** a bot fails its dodge roll against pending ground
- **THEN** it steps about 120 units, goes back to its fight, and the ground can still hit it.

### Requirement: Bots recall as the player does
A bot that recalls SHALL stand still for 2.5 s and SHALL show the recall ring to the player's team when they can see it. A hit SHALL cancel
the recall. A bot SHALL start a recall only when it has not been hit for 3 s and sees no enemy hero close.

#### Scenario: A recalling bot can be caught
- **WHEN** the player sees a hurt enemy bot recall and hits it before 2.5 s
- **THEN** the recall ring goes away and the bot stays on the map.

### Requirement: Bots judge trades
Mythic enemy bots and allied bots SHALL leave a fight when their side's health and damage are clearly lower than the visible enemy side's,
counting enemy wards, or when they are below half health and the enemy is clearly healthier. Veteran and Apprentice bots SHALL go home at a
fixed health floor (28% and 20%).

#### Scenario: A hurt Mythic bot leaves
- **WHEN** a Mythic bot at 40% health faces the player at full health
- **THEN** the bot retreats within 1.5 s.

#### Scenario: A Veteran bot holds until its floor
- **WHEN** a Veteran bot at 40% health faces the player at full health
- **THEN** the bot keeps fighting until its health falls below 28%, which gives the player a chance to finish it.

### Requirement: Bots play the map with what their team can see
Veteran and Mythic bots SHALL gank from a pushed lane, use rift gates when a gate saves time, answer their team's defend calls (the structure nearest the base first), gather before
the Wild Hunt wakes, and push a ward with their wave after a won fight. They SHALL leave spirit camps alone. They SHALL use only what their
team can see, the public kill feed, and their team's own calls.

#### Scenario: A gank from a pushed lane
- **WHEN** the player is seen at low health in another lane and an enemy bot's lane has no wave in front
- **THEN** that bot moves toward the player, through a rift gate when that is faster.

#### Scenario: Fog hides the player
- **WHEN** no enemy unit can see the player
- **THEN** no enemy bot starts a gank toward the player or picks the player as its team's focus.

#### Scenario: The inner ward comes first
- **WHEN** the player's team hits an enemy outer ward and an enemy inner ward at the same time
- **THEN** the enemy bot that answers goes to the inner ward.

### Requirement: Bots focus and punish
Veteran and Mythic bots SHALL prefer, among heroes in reach, the one with the least effective health and the team focus target. They SHALL
prefer a hero that is in cast recovery, EXPOSED, stunned or casting, and they SHALL see that window only after their reaction floor. They
SHALL keep normal spells for heroes instead of the wave unless their mana is full.

#### Scenario: A missed cast is punished
- **WHEN** the player misses a spell and is in its recovery near a Veteran bot
- **THEN** the bot attacks the player before a healthier, closer hero.

### Requirement: Mythic drafts strong heroes
A Mythic enemy team SHALL weigh measured kit strength by lane when it drafts. Every team SHALL draft from the same pool, and the player SHALL
see every pick.

#### Scenario: A Mythic draft
- **WHEN** the same seed is drafted against Veteran and against Mythic
- **THEN** the Mythic team's picks have at least the same summed kit strength, and every pick shows on the draft board.

### Requirement: Bot strength is measured
Seeded six-bot matches with sides swapped SHALL be run for each difficulty against the previous bots on the current map. The report SHALL
give the win rate, kills, wards taken, dive deaths and the number of seeds that the lineup decided (the same side won both games). Veteran and
Mythic enemies SHALL get more kills and fewer dive deaths than the previous bots, and Apprentice enemies SHALL get fewer kills. Mythic enemies
SHALL win more than half of their matches against Veteran and against the previous bots.

#### Scenario: Measured fights
- **WHEN** `AB_DRAFT=1 node qa/tidebreak/bot-ab.mjs <difficulty> legacy 30` runs for each difficulty on the 9600-unit map, and Mythic
  plays Veteran the same way
- **THEN** Veteran and Mythic get more kills and fewer dive deaths per match than the previous bots, Apprentice gets fewer kills, Mythic wins
  more than half of its matches in both of its pairings, and the report states the win rate and how many of the 30 seeds the lineup decided.
