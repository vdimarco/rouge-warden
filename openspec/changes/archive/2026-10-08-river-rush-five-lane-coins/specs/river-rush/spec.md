## RENAMED Requirements

- FROM: `### Requirement: Character-led title artwork`
- TO: `### Requirement: Higgsfield living title scene`

## MODIFIED Requirements

### Requirement: Higgsfield living title scene
The title scene SHALL use a Higgsfield-generated silent looping video based on the approved character art, with a still-image fallback. It SHALL preserve live readable menu controls, pause while hidden or covered by instructions, and use the still image for reduced motion or data-saving.

#### Scenario: Enter the menu
- **WHEN** the menu loads in a normal-motion browser
- **THEN** the river and character artwork animate behind working Start and Switch game controls

#### Scenario: Video unavailable
- **WHEN** video cannot load or motion/data preferences disable it
- **THEN** the approved still image and all menu actions remain usable

### Requirement: Runner perspective art
River Rush SHALL present a five-lane forward-perspective river with generated environment, approved character likeness, long hair and only a modest loincloth. Lane swaps, raft jumps, ducks and obstacle depth SHALL clearly communicate their gameplay state at 1536×1024, 390×844 and 844×390.
#### Scenario: Chain actions
- **WHEN** the player swaps lane, jumps a log and ducks a branch
- **THEN** the raft and character visibly perform the actions while upcoming hazards remain readable

### Requirement: Endless runner controls and retry
The finite adventure SHALL offer five lanes, immediate lane changes, jump,
duck and Rush through keyboard/buttons and screen-wide directional gestures.
Inputs SHALL consume each tap once. A fatal collision SHALL show cumulative
score, distance, coins, cause and one-action current-map retry. Map clears SHALL
show Next map or final victory rather than a wipeout.

#### Scenario: Keyboard and swipe
- **WHEN** a player uses keyboard actions or swipes on any gameplay area
- **THEN** matching actions occur immediately, with left/right buttons anchored
  at the screen edges and no gesture-guide interception

#### Scenario: Restart or advance
- **WHEN** the player retries a wiped-out map or advances a cleared map
- **THEN** the current map restarts with earlier clears preserved or the next
  harder map starts with cumulative totals carried exactly once

### Requirement: Procedural downhill whitewater course
The primary view SHALL use a run-seeded continuous river profile with bends, varying width, quiet pools and downhill chutes. The channel SHALL be wider than the previous 19-unit strip and the chase framing SHALL make the raft smaller relative to the environment. Elevation ahead SHALL descend along the course. Terrain, water, hazards and decorative objects SHALL follow the same profile. Near scenery SHALL approach coherently in the downstream chase view with irregular spacing and asymmetry.
#### Scenario: Ride through pools and chutes
- **WHEN** the player rides through successive generated sections on phone, desktop or landscape
- **THEN** water width, bends, drop grade and bank composition visibly change, the raft points downstream and upcoming hazards remain legible across the five lanes
#### Scenario: Cross procedural boundaries
- **WHEN** the course advances through a chute or terrain segment boundary
- **THEN** elevation and channel edges remain continuous, hazards remain on the river and the raft does not teleport or change logical lanes

### Requirement: Bounded preparation and rendering stalls
Renderer preparation SHALL avoid repeated model texture/program work in active simulation frames. Water quality and drawing-buffer size SHALL adapt to rendering pressure without changing gameplay speed, river shape, input timing or character poses. Replaced and late graphics resources SHALL be released.
#### Scenario: Start and restart
- **WHEN** the player starts, returns home and starts again, or scenery models finish loading
- **THEN** resource preparation remains bounded, animation scheduling continues and the accepted river visuals and controls are available
#### Scenario: Sustained slow rendering
- **WHEN** active frame times remain slow or the viewport changes size
- **THEN** rendering cost reduces with bounded buffer changes, while all five lanes remain readable on phone, desktop and landscape
#### Scenario: Pause and visibility
- **WHEN** the player pauses or hides the page and later resumes
- **THEN** paused pixels remain unchanged, hidden time does not lower quality or advance the run, and resumed rendering continues

#### Scenario: Asset download stops responding
- **GIVEN** a model or panorama request remains pending without returning an error
- **WHEN** the asset preparation deadline expires
- **THEN** Start becomes available with loaded art and playable 3D fallback models
- **AND** responses arriving afterward are discarded without changing models or uploading maps during the run

### Requirement: Fair escalating obstacle course
Each seeded finite five-lane course SHALL vary slalom, coin zigzags, mixed obstacles,
jump waves, low canopy and split-current motifs. Later maps SHALL increase
speed/complexity while each row retains a clear lane or traversable action
barrier and enough time for the existing jump/duck durations. Hazards SHALL
stop before the finish runway and active course entities SHALL remain bounded.

#### Scenario: Choose an action
- **WHEN** a player jumps a log, ducks a branch or avoids a rock
- **THEN** the matching action safely clears the hazard and rewards its points

#### Scenario: Finish a varied map
- **WHEN** a player survives to the finish of any of the three maps
- **THEN** multiple route motifs appear, a legal route remains, the last 90 m
  is hazard-free, and simulation stops at the stated distance

### Requirement: Shoreline ducking branches
Duck hazards SHALL visibly grow from rooted shoreline trees in WebGL and the
2D fallback. Generated trees SHALL offer three contiguous widths covering one,
two or three river lanes. Each tree SHALL originate from its declared bank. Full-river canopy rows SHALL vary which bank carries the three-lane tree. One tree SHALL present
each coherent span. Its visible low wood, markers, hint and physical coverage
SHALL agree, including between covered lanes. Timed ducking SHALL clear every
covered lane; uncovered lanes SHALL remain safely traversable. Accepted speed,
inputs, action windows, protection feedback and finite finishes SHALL remain.
Full five-lane canopy rows SHALL use two opposite-bank native trees rather than stretching one tree beyond its three-lane variant. A successful duck SHALL reward that row once. Partial three-lane trees SHALL NOT be labeled as covering the full river. Tree resources SHALL be prepared and bounded.

#### Scenario: Read and react to three widths
- **WHEN** a player approaches one-, two- or three-lane branches on phone, desktop or short landscape
- **THEN** each rooted tree visibly covers its marked contiguous lanes and shows a readable duck cue
- **AND** a timely duck clears any covered lane while an uncovered lane remains safe

#### Scenario: Physical span contact
- **WHEN** the standing raft crosses in a covered lane or between two covered lanes
- **THEN** that single branch triggers the existing collision outcome once
- **AND** coin pickups still require actual coin contact and a perfect duck earns one row reward

#### Scenario: Safe routes and stopped state
- **WHEN** seeded play completes all three maps, pauses or uses the fallback
- **THEN** full five-lane canopies formed by opposite-bank three-plus-two-lane trees remain duckable, partial spans retain a fair clear or duck route, paused pixels stay fixed, and fallback coverage agrees within fixed resource bounds

## ADDED Requirements

### Requirement: Varied five-lane coin routes
Seeded maps SHALL offer geometrically distinct ground coin ribbons, adjacent sweeps, staggered zigzags and split or geometric choices across all five lanes, with at least four ground families over each full map. Raised gold SHALL retain the existing reachable jump arcs. Each station SHALL retain a reachable primary reward route; optional simultaneous branches SHALL NOT require collecting every alternative. Changes along the primary route SHALL allow the existing steering spring enough time even at maximum Rush speed. No ground reward SHALL bait a collision with a rock or a conflicting jump. Coin contact SHALL retain its physical lane and height tolerances without adjacent auto-collection. Entity and render pools SHALL remain bounded.

#### Scenario: Follow changing gold
- **WHEN** a player rides a complete seeded map
- **THEN** at least four distinct ground layout families and raised jump arcs appear, use all five lanes, and a timed primary route can be followed with existing steering and actions

#### Scenario: Choose a reward branch
- **WHEN** the player takes one side of a split or fork trail
- **THEN** touched gold pays normally while untaken and adjacent coins remain uncollected

#### Scenario: Move across the wider river
- **WHEN** keyboard or a continuous whole-screen drag sweeps from lane0 to lane4 and reverses
- **THEN** five distinct lane centers remain visible and usable, outer inputs clamp safely, and continuous steering agrees with hazard and coin contact in both renderers
