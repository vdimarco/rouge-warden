## ADDED Requirements

### Requirement: Reachable action reward routes
Generated log rewards SHALL form a speed-aware coin arc that a single well-timed .66-second jump can collect while clearing its log. Optional low coins SHALL NOT compete with that jump or demand a near-instant lane change between reward routes; subsequent low ribbons and finish gold SHALL be reachable after landing, including earned Rush. WebGL and fallback SHALL render the shared generated heights. Physical lateral pickup tolerance, missed-coin behavior, powers and accepted action timings SHALL remain unchanged.

#### Scenario: Collect a jump reward path
- **WHEN** a player follows a generated log route at normal early or late jump timing on any map
- **THEN** one jump clears the log and collects the arc with no incompatible low coin hidden beneath the airborne raft; subsequent low gold remains reachable after landing

#### Scenario: Preserve physical pickup
- **WHEN** the raft passes beside an arc or beneath raised gold without jumping, including powered play
- **THEN** only actual compatible height and lateral contact reward once, and a missed coin passes silently

### Requirement: Varied required action beats
After the readable three-row tutorial, each seeded map SHALL introduce required jumping and ducking early and bound subsequent action droughts. Courses SHALL combine brief varied formations, optional reward routes, adjacent lane choices and calm recoveries instead of long runs of one obstacle. Full-width formations SHALL share one traversable action, retain human reaction time, and preserve accepted speeds and continuous controls. Terrain ordering SHALL be seeded and noncyclic, agree between CPU and shader, and preserve attainable advertised jump-chain objectives.

#### Scenario: Learn actions early
- **WHEN** a player leaves the opening tutorial or begins a harder map
- **THEN** both jumping and ducking become necessary soon, and a player cannot finish the opening by camping a lane or only steering

#### Scenario: Read changing combinations
- **WHEN** a player proceeds through a seeded river
- **THEN** short jump, duck, weave and recovery beats vary in ordering and spacing, each remains traversable with realistic delayed input, and each advertised chain still offers enough eligible jumps
