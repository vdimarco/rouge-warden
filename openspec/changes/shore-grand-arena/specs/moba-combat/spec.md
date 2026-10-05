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

#### Scenario: Break a lane in order
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
- The first wave SHALL leave each base at 0:23 and later waves every 20 seconds. A wave SHALL have two melee wisps and a caster wisp that
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
- **WHEN** the clock reaches 14:00 and both cores stand
- **THEN** a sudden death banner appears, every structure can be damaged, deaths last longer and home heals slowly.

#### Scenario: Hard limit
- **WHEN** the clock reaches 17:00 and both cores stand
- **THEN** the match ends, the team that broke more structures wins, and the result screen states that reason (or the next tiebreak).

### Requirement: Bots on the grand arena
Bots SHALL walk their lane with their wave, SHALL not walk into the range of an enemy ward, guardian or core that no wisp of their team
tanks, and SHALL wait at their own front ward when they have no wave. When every ward on an enemy lane is down, bots SHALL
join the push on that lane, taking a routed path around cover to reach it. Rotation, assist, rally and Wild Hunt reach SHALL scale with the map
size. A side-lane bot leaving its base SHALL take its base gate when its wave has already passed the river gate.

#### Scenario: A bot without a wave
- **WHEN** a bot's lane has no allied wisps and the bot stands just outside an enemy ward's range
- **THEN** the bot falls back toward its own ward and never enters the enemy ward's range.
