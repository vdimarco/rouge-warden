## ADDED Requirements

### Requirement: Diverging river adventures
Seeded maps SHALL sometimes split around visible island land into two genuine streams, then smoothly reunite into the five-lane river. Left lanes0–1 and right lanes3–4 SHALL remain on their respective water surfaces; center lane2 SHALL be land only within the island footprint. A shared distance topology SHALL drive raft, rewards, enemies, water, terrain and both renderers. Steering SHALL remain continuous and responsive, with explicit player choice and a hazard-free approach rather than involuntary target-lane changes. Actual island contact SHALL produce coherent collision/protection feedback; protected contact SHALL rebound toward water without teleporting through land. Moving enemies and rooted branch anatomy SHALL remain in their own stream. Tutorial, promised wave chains, finite finishes, accepted speed/action timing and fixed resource bounds SHALL remain intact.

#### Scenario: Choose and ride a stream
- **WHEN** a fork approaches and the player steers into either stream
- **THEN** water and playable routes visibly separate around land, the chosen stream has its own coherent challenges and treasure, the rider retains normal readable scale, and the raft returns smoothly to five-lane play at the confluence

#### Scenario: Cross visible island land
- **WHEN** the actual raft trajectory reaches the island footprint
- **THEN** terrain contact is sampled along the continuous motion, normal impact feedback occurs, and protection rebounds the raft toward water rather than allowing a silent land crossing

#### Scenario: Preserve physical contact and enemy geography
- **WHEN** the raft passes beside rewards or wildlife moves within a split stream
- **THEN** only actual compatible height and physical proximity collect a reward, aquatic enemies remain over their stream, birds enter from that stream's own bank, and branch wood/markers agree with stream coverage

#### Scenario: Read the split and reunion
- **WHEN** a player rides a fork on desktop, portrait, short landscape or fallback
- **THEN** the fork nose, two water channels, island and reunion are visually clear, cues do not obstruct the central river or gestures, and stopped motion and resource usage remain bounded

### Requirement: Purposeful treasure encounters
Reward placement SHALL express coherent challenges through sparse approach clues, action rewards, attainable landing pockets and visible treasure caches instead of cycling arbitrary geometric scatter. Fork encounters SHALL vary their seeded theme, side and multi-beat action/avoidance sequence. A calmer stream SHALL offer a smaller payoff; a richer stream SHALL offer greater exposure and a larger clean-completion cache reward. Clean completion SHALL depend on actual required unprotected clears. Any physical impact during the chosen adventure SHALL invalidate its clean bonus while preserving the base prize. Partial or protected play SHALL pay only earned rewards. Cache contact SHALL require physical ground-height overlap, have distinct visual and sound feedback, and occur after the preceding action has landed, including maximum future Rush. Normal recoveries, strictly contacted coin streaks and finite finishes SHALL remain attainable.

#### Scenario: Judge a remembered objective
- **WHEN** a player approaches either stream's treasure encounter
- **THEN** its reward and required challenge are readable before commitment, actions form a coherent sequence, and the visible end prize agrees with its actual attainable payout

#### Scenario: Earn a clean or partial prize
- **WHEN** the player touches a cache after clean required clears, protected play or an incomplete route
- **THEN** the larger completion reward is granted only for qualified physical play, contacted partial rewards pay once, and untaken or adjacent treasure remains uncollected

#### Scenario: Land into treasure
- **WHEN** the player completes a jump or duck sequence at normal or future-Rush speed
- **THEN** the landing pocket and cache remain reachable with existing steering and action durations instead of hiding ground rewards under an airborne raft


## MODIFIED Requirements

### Requirement: Fair escalating obstacle course
Each seeded finite five-lane course SHALL vary slalom, mixed obstacles, jump waves, low canopy and genuine split-current adventures. Later maps SHALL increase speed and complexity while each normal row or individual split stream retains a clear route or traversable action barrier with enough time for the existing jump/duck durations. Calmer fork streams MAY trade fewer required actions for a smaller payoff. Hazards SHALL stop before the finish runway and active course entities SHALL remain bounded.

#### Scenario: Choose an action
- **WHEN** a player jumps a log, ducks a branch or avoids a rock on the main river or chosen stream
- **THEN** the matching response safely clears that hazard and only qualified physical actions earn their rewards

#### Scenario: Finish a varied map
- **WHEN** a player survives to the finish of any of the three maps
- **THEN** varied encounters and genuine split streams appear, each selected route remains legal, the last 90m is hazard-free, and simulation stops at the stated distance

### Requirement: Varied five-lane coin routes
Seeded maps SHALL place sparse approach clues, meaningful action rewards and reachable landing/recovery pockets across the normal five-lane river instead of cycling arbitrary geometric token shapes. Real fork streams SHALL offer coherent alternatives with visible treasure objectives. Raised gold SHALL retain reachable speed-aware jump arcs. Each selected route SHALL remain attainable with the existing steering spring, including maximum future Rush. Simultaneous alternatives SHALL NOT imply that every reward can be collected. No ground reward SHALL bait a rock collision or conflict with its selected jump. All reward contact SHALL use actual compatible height and a fixed physical pickup radius without collecting adjacent tokens across a widened stream or island gap. Entity and render pools SHALL remain bounded.

#### Scenario: Follow meaningful gold
- **WHEN** a player rides a complete seeded map
- **THEN** pickups mark approach, action, landing and recovery opportunities rather than repeated decorative chains, and gold remains reachable in every normal river lane

#### Scenario: Choose a reward branch
- **WHEN** the player chooses one of two genuine streams and follows its treasure encounter
- **THEN** physically touched rewards pay normally while the other stream's rewards and adjacent coins remain uncollected

#### Scenario: Move across the wider river
- **WHEN** keyboard or continuous whole-screen dragging moves between lanes and reverses
- **THEN** five normal lane centers remain visible and usable, split-stream steering is continuous within its water and actual land contact is coherent, and both renderers agree with contact geometry

### Requirement: Tactical coin decisions
After the tutorial, occasional eligible partial-action or moving-enemy stations SHALL offer a sparse ordinary-coin bypass and richer guarded rewards. Guarded coins SHALL be visually distinct and pay twice the base points of ordinary coins under the same streak and Gold Boost. A protected collision SHALL NOT earn the existing perfect-action reward. Choices SHALL vary their lanes and required jump or duck action. Later maps and later course sections SHALL introduce harder entry or exit commitments with enough physical steering and action time. Both strategies SHALL be playable without protection; untaken alternatives SHALL remain uncollected. Real fork adventures SHALL carry richer multi-beat decisions to visible treasure rather than duplicating an isolated one-row choice at every station. Tutorial beats, full-river mandatory action walls outside forks, promised wave chains and finish runway SHALL retain their existing behavior. Choice metadata, visual cues and scoring SHALL describe the same routes and actual values within bounded pools.

#### Scenario: Choose safety or a richer enemy route
- **GIVEN** an approaching decision station with a safe bypass and guarded premium rewards
- **WHEN** the player takes the bypass or enters the guarded route and times its required action
- **THEN** the bypass yields a smaller payout without contacting its guard, while the guarded route pays double-value touched coins and the existing unprotected perfect-action reward
- **AND** coins beside the raft and untaken alternatives remain uncollected

#### Scenario: Commit or bail out
- **WHEN** the player reads a guarded route ahead, then commits or changes to the shown safe alternative before its pickups
- **THEN** both choices remain physically attainable at the current speed, mutually exclusive payouts do not demand late returns, and exposure matches the warning

#### Scenario: Grab partial treasure and escape
- **WHEN** the player physically touches an approach token and leaves its guard before contact
- **THEN** only contacted rewards pay, missed tokens remain uncollected, and no perfect-action reward is granted for bypassing the guard

#### Scenario: Harder later decisions
- **WHEN** the player reaches later maps or later sections
- **THEN** guarded decisions and fork adventures vary actions, wildlife, entry and reachable exit commitments instead of adding equally safe decorative coins
- **AND** mandatory wave chains, calm recoveries and finite finishes remain attainable

#### Scenario: Read choices on supported screens
- **WHEN** a decision approaches on desktop, portrait, short landscape or fallback
- **THEN** rewards, route actions and attainable payoffs are readable before contact, and edge cues yield to immediate hazards without blocking river or gestures

### Requirement: Varied required action beats
After the readable three-row tutorial, each seeded map SHALL introduce required jumping and ducking early and bound subsequent action droughts on the normal river. Courses SHALL combine short varied action, weave and recovery encounters. Forks SHALL deliberately contrast a calmer route with fewer required actions and a richer multi-beat action route; they SHALL NOT force both streams to play identically. Full-width normal formations and within-stream action gates SHALL share a traversable action with human reaction time and preserve accepted speed and continuous controls. Seeded terrain ordering SHALL agree between CPU and shader and preserve attainable advertised jump-chain objectives.

#### Scenario: Learn actions early
- **WHEN** a player leaves the opening tutorial or begins a harder map
- **THEN** jumping and ducking become necessary soon and camping one lane or only steering cannot finish the opening

#### Scenario: Read changing combinations
- **WHEN** a player proceeds through a seeded river and chooses fork streams
- **THEN** short jump, duck, weave and recovery beats vary in order, the streams offer different exposure and payoff, realistic delayed input remains viable, and every advertised chain offers enough eligible jumps

### Requirement: Shoreline ducking branches
Duck hazards SHALL visibly grow from rooted shoreline trees in WebGL and fallback. Normal river trees SHALL offer contiguous widths of one, two or three lanes, originate from their declared bank, and vary the bank carrying the three-lane tree in full-river rows. Full five-lane canopy rows SHALL use two opposite-bank native trees rather than stretching a single variant. Inside a fork, each native tree SHALL attach to its own stream's shoreline and cover only that stream's declared contiguous lanes; wood SHALL NOT stretch across the island into the other stream. One tree SHALL present each coherent span. Visible low wood, markers, hints and physical coverage SHALL agree, including between covered lanes. A timely duck SHALL clear covered lanes; uncovered water SHALL remain traversable. Each successful row SHALL reward once. Partial trees SHALL NOT be labeled as full river. Existing speed, inputs, actions, impact feedback, finite finishes and prepared bounded resources SHALL remain.

#### Scenario: Read and react to three widths
- **WHEN** one-, two- or three-lane branches approach on phone, desktop or short landscape
- **THEN** each visibly rooted tree covers its marked contiguous water lanes with a readable duck cue, and a timely duck clears it

#### Scenario: Physical span contact
- **WHEN** the standing raft crosses a covered lane or between covered lanes
- **THEN** that single branch triggers impact once, coins still require physical pickup contact, and a perfect duck earns one row reward

#### Scenario: Safe routes and stopped state
- **WHEN** seeded play completes all three maps, pauses or falls back
- **THEN** full normal five-lane canopies remain duckable, fork trees stay attached to their own stream, partial spans retain a fair clear or duck route, stopped pixels freeze and fallback agrees within resource bounds

### Requirement: Drifting bonus relic targets
Courses SHALL offer sparse drifting relic targets in clear recovery space using existing steering controls. Both renderers SHALL show their shared moving position and destination. Actual compatible ground-height contact within the fixed 0.95m physical pickup radius SHALL award 200 points once and 10 charge outside active Rush with distinct visual and audible feedback; adjacent, opposite-stream or airborne misses SHALL pass silently. Bonus routes SHALL NOT conflict with preceding jump arcs or demand an immediate lane change into another hazard.

#### Scenario: Collect or miss a drifting relic
- **WHEN** a player physically steers over a target or passes beside or above it
- **THEN** only compatible contact awards once, emits one cue and burst, and preserves ordinary coin contact rules

#### Scenario: Keep accessible feedback and bounded play
- **WHEN** a player mutes, pauses, hides, retries or uses fallback
- **THEN** sound preferences and stopped motion remain correct, targets stay distinct and attainable, and resources do not grow with course distance
