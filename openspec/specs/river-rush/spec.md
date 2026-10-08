# River Rush Specification

## Purpose
Define River Rush's finite three-map whitewater adventure, responsive keyboard/swipe/touch actions, fair progressively harder courses, coin streaks, challenges, power-ups, shareable scores, public guest leaderboard and Cottage Arcade integration.

## Requirements

### Requirement: River Rush arcade cabinet
The arcade SHALL retain the River Rush cabinet id, name, /river-rush/ route,
Action membership, approved art direction and shared switcher entry. Its copy
SHALL describe the finite three-map adventure.

#### Scenario: Launch and switch
- **WHEN** a player starts the River Rush cabinet or uses Switch game
- **THEN** the selected adventure opens correctly and the shared switcher
  identifies River Rush while retaining links to other games and the arcade

### Requirement: Validated best score
The game SHALL save positive bounded finite-adventure best scores in
river-rush-adventure-best with version 3. Older race/endless scores SHALL NOT
become adventure records. The cabinet SHALL show valid adventure scores and
tolerate malformed storage.

#### Scenario: Retry an adventure map
- **WHEN** a player finishes or wipes out with a new personal best and retries
- **THEN** the best persists, current-map statistics reset and prior clears carry

#### Scenario: Malformed or old records
- **WHEN** storage is malformed, inconsistent or from the earlier runner
- **THEN** the game remains playable with safe defaults and no old best score

### Requirement: Shared audio lifecycle
The arcade build SHALL load `/arcade/quiet.js` before other scripts so audio suspends when the page is hidden.

#### Scenario: Hide the page
- **WHEN** game audio has started and the page becomes hidden
- **THEN** the shared lifecycle script silences the game without breaking its own mute control

### Requirement: Motion lifecycle and accessibility
The simulation SHALL stop on pause, page hide and completion. Reduced motion SHALL disable water displacement, decorative particles, paddle cycling and cosmetic raft rocking while preserving course movement and lane/jump/duck feedback. Data saving SHALL disable menu video and gameplay video in fallback. All actions SHALL remain available through keyboard and touch buttons.
#### Scenario: Pause mid-effect
- **WHEN** the player pauses during a jump or water effect
- **THEN** simulation and the displayed frame remain unchanged until resume
#### Scenario: Reduced motion
- **WHEN** reduced motion changes during play
- **THEN** water displacement and decorative effects stop while lane/jump/duck controls remain functional

### Requirement: Character-led title artwork
The title screen SHALL display local illustrated jungle-rafting key art inspired by the supplied adult character, with long dark hair, a brown wrap and wooden raft in rapids. The illustration SHALL contain no phone overlay or baked-in title text. Responsive crops SHALL retain the character's face and readable live title, Start, map, Help, Leaderboard and arcade controls. The previous title video SHALL NOT cover this artwork.

#### Scenario: View the title across layouts
- **WHEN** the player opens the title at 1365×900, 390×844 or 844×390
- **THEN** the hero is undistorted, his face and the full Start button are initially visible, and all menu actions are reachable without artwork intercepting input

#### Scenario: Use the title actions
- **WHEN** the player starts a ready run or opens and closes Help or Leaderboard
- **THEN** the existing action works and returning to the title restores its artwork and controls

#### Scenario: Art unavailable or motion reduced
- **WHEN** the hero image fails to load or the player prefers reduced motion
- **THEN** readable live menu actions remain usable on a stable dark background without waiting for the title artwork

### Requirement: Runner perspective art
River Rush SHALL present a three-lane forward-perspective river with generated environment, approved character likeness, long hair and only a modest loincloth. Lane swaps, raft jumps, ducks and obstacle depth SHALL clearly communicate their gameplay state at 1536×1024, 390×844 and 844×390.
#### Scenario: Chain actions
- **WHEN** the player swaps lane, jumps a log and ducks a branch
- **THEN** the raft and character visibly perform the actions while upcoming hazards remain readable

### Requirement: Runner action feedback
Coins, successful obstacle actions, power-ups, shield impacts and fatal collisions SHALL provide short readable feedback with bounded effects and no change to control timing.
#### Scenario: Earn and spend protection
- **WHEN** a protected player hits a hazard
- **THEN** a shield burst communicates protection consumed, the streak breaks and the run continues with brief collision grace

### Requirement: Endless runner controls and retry
The finite adventure SHALL offer three lanes, immediate lane changes, jump,
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

### Requirement: Fair escalating obstacle course
Each seeded finite course SHALL vary slalom, coin zigzags, mixed obstacles,
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

### Requirement: Coins streaks and power-ups
Coin trails and successful actions SHALL reward points and Rush charge.
Streaks SHALL increase the multiplier and expire after a collection gap.
The eight-second coin power SHALL boost rewards for physically collected
coins, with a clear name and HUD feedback. Shield SHALL absorb one impact.
Rush SHALL grant four seconds of faster invulnerable riding, SHALL NOT collect
remote coins or recharge itself, and SHALL use Shift or its touch control.

#### Scenario: Use the contact coin boost
- **WHEN** a raft acquires the timed coin power by actual overlap
- **THEN** touched coins earn a clearly communicated bonus for eight seconds
  while adjacent coins remain missed

#### Scenario: Use Rush
- **WHEN** a player activates full Rush charge
- **THEN** charge spends once, speed/protection activate and expire normally,
  and coins continue to require contact

### Requirement: Active runner challenges
The runner SHALL offer rotating trick, coin and distance challenges with visible progress, a one-time 500-point reward, and a fresh target relative to the start of each challenge.
#### Scenario: Complete a trick challenge
- **WHEN** the player performs the required perfect jumps and ducks
- **THEN** the challenge pays once, shows completion feedback and advances to a new coin target

### Requirement: Living gameplay river
River Rush SHALL primarily render a three-dimensional displaced water surface with directional waves, normal-based lighting, moving crest foam, wakes and obstacle ripples. The water and raft buoyancy SHALL share a world-distance wave field. The 3D renderer SHALL use no gameplay video. Unavailable WebGL SHALL retain a playable 2D fallback.
#### Scenario: Ride through living rapids
- **WHEN** a normal-motion player rides, steers and lands from a jump
- **THEN** the raft follows surface height and slopes, banking creates a wake and landing creates a short splash and settling response without changing collision timing
#### Scenario: Video and GPU unavailable
- **WHEN** WebGL cannot initialize
- **THEN** the course and all controls remain playable through the 2D fallback

### Requirement: Runner character animation
The approved adult character SHALL use a rear-facing fal-generated skeletal rider in the primary WebGL view, with continuous coordinated paddling, a raised-knee jump and an independent near-prone brace for ducking. Generated registered rear-facing art SHALL remain available in the 2D and missing-rig fallback. His long hair, bare torso, modest loincloth and identity SHALL remain consistent. The chase view SHALL show him facing downstream toward upcoming hazards, with the wake behind the raft and approaching scenery moving toward the camera. Rider feet and raft anchors SHALL remain registered. Visual animation SHALL NOT change action windows, speed, collision outcomes or scores.
#### Scenario: Paddle and chain actions
- **WHEN** the player rides, changes lanes, jumps and ducks
- **THEN** paddling faces downstream, the raft banks, jump and duck use visibly different anatomical silhouettes and a landing splash marks a completed jump
#### Scenario: Direction and fallback
- **WHEN** the player rides in the primary 3D view or 2D fallback
- **THEN** the rider faces the upcoming course, the wake trails behind and scenery approaches the camera coherently

### Requirement: Animated runner rewards and powers
Collected coins SHALL disappear at contact and fly toward the HUD as small,
distinct score tokens with immediate reward feedback. Perspective SHALL NOT
enlarge feedback into apparent collectible coins beside the raft. The timed
coin boost SHALL visibly enhance contact rewards.
Shield SHALL show a shatter/recoil on impact; Rush SHALL show motion trails
and obstacle bursts. Effects SHALL remain bounded and preserve legible controls.

#### Scenario: Score at contact
- **WHEN** a coin is touched during a rapid lane change or a coin boost
- **THEN** its reward is shown at contact rather than delayed until the raft
  appears beside its former lane, no remote pickup animation is shown and
  its small score token remains distinct from golden coins in the river

### Requirement: Snappy runner response
The runner SHALL use map start speeds of 52 / 62 / 72 m/s with respective caps of 68 / 80 / 92 m/s, use .66-second jumps and .60-second ducks, and settle visual lane changes to 95% within 150 ms at normal frame rates. Actions SHALL cancel or chain without animation locks. A launch-frame jump SHALL clear a log and its raised coin before the visible arc reaches full height. Touch drags SHALL support successive lane changes at an initial 26-pixel segment and subsequent 56-pixel segments.
#### Scenario: Chain a dodge and action
- **WHEN** a player rapidly changes lanes, jumps and ducks
- **THEN** each input takes effect on the next simulation update, each action silhouette appears immediately and movement settles without long trailing interpolation
#### Scenario: Late launch
- **WHEN** a player taps jump just before a log reaches the raft
- **THEN** the launch frame clears the log and its raised coin without consuming protection
#### Scenario: Continuous touch drag
- **WHEN** a player drags across an initial lane-change segment and a deliberate longer additional segment
- **THEN** two lane changes occur without lifting the finger, and a cancelled pointer produces no further action

### Requirement: Coherent fluid motion
Water waves and raft buoyancy SHALL share the same surface definition. Raft pitch and roll SHALL come from separated surface probes with stable damping; steering and landing SHALL produce bounded additional response. The approved rider appearance SHALL remain registered to the raft through actions.
#### Scenario: Accelerate and dodge
- **WHEN** a run accelerates and the player dodges
- **THEN** world scenery and hazards approach coherently, the raft follows the water continuously and its action feedback does not drift away from the raft

### Requirement: Bounded frame rendering
The renderer SHALL cap backing-buffer pixels, share repeated model resources, bound scene objects independently of run length and stop repeating scene work on inactive runs. Pause SHALL preserve the visible frame. GPU loss SHALL pause play and allow restart with a usable fallback.
#### Scenario: Warm active rendering
- **WHEN** a phone or desktop run is sampled after assets load
- **THEN** model loads, draw calls, triangle counts and frame times are recorded and repeated scenery does not grow with distance
#### Scenario: Inactive run
- **WHEN** a run is paused or completed
- **THEN** simulation and captured pixels remain unchanged and scene rendering stops until a meaningful state or viewport change

### Requirement: Continuous forward world motion
The runner SHALL present genuine 3D terrain and Meshy-generated textured riverbank and raft models with consistent perspective, lighting, depth occlusion and distance fog. Bank scenery SHALL remain outside playable lanes, recycle beyond the camera and have bounded counts. Reduced motion SHALL suppress decorative bank movement.
#### Scenario: Ride without steering
- **WHEN** a normal-motion player rides forward on phone, desktop or landscape
- **THEN** solid banks, layered vegetation and rocks pass beside the raft while the playable river remains readable
#### Scenario: Pause or reduce motion
- **WHEN** the player pauses or enables reduced motion
- **THEN** pause freezes the world and reduced motion suppresses decorative movement while preserving course movement

### Requirement: Continuous steering and character geometry
Visual steering SHALL move through a continuous carving glide and preserve position and velocity through repeated lane inputs, settle a single-lane step to 95% within 150 ms and retain immediate logical lane selection. Jump and duck SHALL retain the approved rider identity, with continuous raft lift and distinct registered rider poses. Duck SHALL use a near-prone anatomical brace with no vertical image compression. Rider art SHALL remain independent of the registered raft geometry.
#### Scenario: Reverse a dodge and jump
- **WHEN** the player changes lanes, immediately reverses and jumps or ducks
- **THEN** steering follows a short continuous trajectory, the rider identity and raft remain consistent, distinct jump/duck silhouettes remain registered and controls are available throughout the action

### Requirement: Meshy asset provenance
The deployed game SHALL load locally hosted GLBs generated by Meshy for its raft and riverbank scenery. Generation request IDs, input prompts, source URLs and optimization steps SHALL be recorded. Model failure SHALL retain usable substitutes without blocking controls.
#### Scenario: Generated assets load
- **WHEN** a normal run starts with the generated assets available
- **THEN** the Meshy raft and bank meshes render in the world and renderer status identifies loaded assets
#### Scenario: Missing model
- **WHEN** a model request fails
- **THEN** a usable geometric substitute remains and the run continues

### Requirement: Rich river presentation with preserved pace
The river SHALL use textured shoreline and rocks, varied foliage and layered lighting/atmosphere within the existing fixed scene budgets. Normal speed SHALL follow the three map profiles (52–68 / 62–80 / 72–92 m/s); jump SHALL last .66 seconds and duck .60 seconds. Reduced motion, exact paused frames and readable hazards/controls SHALL be retained at phone, desktop and short landscape layouts.
#### Scenario: Ride through upgraded scenery
- **WHEN** the player starts the updated game and chains lane/jump/duck actions
- **THEN** the new scenery and distinct rider poses remain readable while speed follows the extended-map profiles, action timing stays responsive and routes remain traversable

### Requirement: Near-prone duck silhouette
Ducking SHALL use an independent near-prone rear-facing rider pose, with head and shoulders close to the deck and a low horizontal paddle. The primary view SHALL fold the skeletal body anatomically; fallback SHALL retain the independent registered brace image. Its visible silhouette SHALL be at most 45% of the jumping pose height at the same art scale. Jump SHALL retain its raised-leg and lifted-paddle appearance. Both poses SHALL preserve the approved identity, hair, modest loincloth, downstream orientation and raft registration without vertical compression or gameplay changes.
#### Scenario: Chain a jump into a duck
- **WHEN** the player jumps and immediately ducks using keyboard or touch
- **THEN** the raised jump pose changes into a visibly low near-prone brace in both WebGL and fallback, with the same immediate collision windows and raft anchor

### Requirement: Detailed river surface materials
The river SHALL use locally hosted detailed rock, wood, shoreline and water surface textures with bounded map resolution, shared material instances and existing scenery instance counts. Water detail SHALL flow downstream with the course while preserving the shared displacement/buoyancy field. Hardware and software renderers SHALL retain readable hazards, reduced motion and exact paused pixels.
#### Scenario: Inspect and pause textured play
- **WHEN** the player rides, jumps, ducks and pauses on phone, desktop or landscape
- **THEN** surface detail remains visible, pose silhouettes remain clear and paused pixels remain stable, without changing speed or controls

### Requirement: Distinctive lost-temple models
The primary world SHALL present the locally hosted fal-generated textured
expedition raft and detailed driftwood across maps. Moonlit Ruins SHALL add
serpent temples and carved guardian obstacles with mossy stone and gold accents.
Temple landmarks SHALL remain outside playable lanes. Shared scenery/hazards
SHALL remain bounded and controls/action windows SHALL retain their timings.

#### Scenario: Inspect upgraded course
- **WHEN** a player enters Moonlit Ruins on phone, desktop or landscape
- **THEN** carved temple and guardian silhouettes differ from canyon boulders,
  hazards remain readable, and the same controls retain their action timing

### Requirement: Continuous skeletal rider motion
The primary view SHALL use a fal-generated humanoid skeletal rider with long dark hair, modest loincloth and downstream orientation. Paddling SHALL follow a continuous time-based stroke with a physical paddle and coordinated arm joints. Steering SHALL use continuous bank, torso and leg weight shifts without pose teleportation or animation locks. Rendering SHALL follow display animation-frame cadence and SHALL NOT quantize the paddle cycle to a handful of still frames.
#### Scenario: Paddle while reversing lanes
- **WHEN** the player watches a full stroke and rapidly steers left then right
- **THEN** the paddle follows a continuous reach, plant, pull and recovery path, both hands follow its grip, and rider balance transitions without an abrupt side-to-side jump
#### Scenario: Actions and accessibility
- **WHEN** the player jumps, ducks, pauses, resumes or enables reduced motion
- **THEN** raised jump and near-prone duck remain distinct, pause freezes pixels, reduced motion disables decorative cycling, and every control remains available
#### Scenario: Asset unavailable
- **WHEN** a new model fails after bounded retries or WebGL cannot initialize
- **THEN** the existing registered rear-facing character art and usable geometric substitutes keep the course playable

### Requirement: Layered adventurous world presentation
The primary view SHALL distinguish jungle canopy, sandstone gorge and moonlit temple maps using prepared sky/background palettes, textured trees, rock/temple landmarks and driftwood. Jungle MAY retain its locally hosted fal panorama. Redstone and Moonlit SHALL use atmosphere-only skies and course-registered landscape layers. Near scenery SHALL move with the course and the distant environment SHALL provide atmospheric depth. Decorative landmarks SHALL remain outside playable lanes and preserve hazard readability.

#### Scenario: Discover the rivers
- **WHEN** a player advances through all three maps on a supported layout
- **THEN** sky, water, bank composition and landmarks visibly change between
  the lush jungle, orange gorge and violet moonlit ruin environments

#### Scenario: Preserve motion and performance
- **WHEN** a player paddles, reverses lanes, jumps, ducks or reduces motion
- **THEN** the continuous rider and responsive control timings remain, optional
  decoration freezes, and measured scenes stay below 65 calls and 300,000
  triangles on the full path or 125,000 triangles on the software path

### Requirement: Procedural downhill whitewater course
The primary view SHALL use a run-seeded continuous river profile with bends, varying width, quiet pools and downhill chutes. The channel SHALL be wider than the previous 19-unit strip and the chase framing SHALL make the raft smaller relative to the environment. Elevation ahead SHALL descend along the course. Terrain, water, hazards and decorative objects SHALL follow the same profile. Near scenery SHALL approach coherently in the downstream chase view with irregular spacing and asymmetry.
#### Scenario: Ride through pools and chutes
- **WHEN** the player rides through successive generated sections on phone, desktop or landscape
- **THEN** water width, bends, drop grade and bank composition visibly change, the raft points downstream and upcoming hazards remain legible across the three lanes
#### Scenario: Cross procedural boundaries
- **WHEN** the course advances through a chute or terrain segment boundary
- **THEN** elevation and channel edges remain continuous, hazards remain on the river and the raft does not teleport or change logical lanes

### Requirement: Reactive whitewater presentation
Water SHALL show animated downstream currents, broken crests, eddies, shoal foam and wakes. Rapids SHALL increase local wave energy and spray, and buoyancy SHALL pitch the raft with the shared downhill surface. Presentation SHALL preserve accepted speed, immediate inputs, collision windows, continuous skeletal paddling and independent near-prone duck.
#### Scenario: Paddle and steer in rapids
- **WHEN** the player paddles, reverses lanes, jumps or ducks through a steep section
- **THEN** the raft heaves and pitches with the surface, foam and spray indicate rough water, and controls remain responsive without involuntary lane shifts
#### Scenario: Pause, accessibility and rendering bounds
- **WHEN** the player pauses, enables reduced motion or an asset/context becomes unavailable
- **THEN** pause freezes canvas pixels, reduced motion suppresses turbulence/spray/camera bob, fallbacks remain playable and measured scenes remain below 300000 triangles and 65 calls on full rendering or 125000 triangles and 65 calls on software

### Requirement: Recoverable rendering cadence
A graphics or audio exception SHALL NOT permanently terminate animation scheduling. A transient graphics failure SHALL recover on subsequent frames; repeated rendering failure SHALL preserve the run in a paused, usable fallback. Audio failure SHALL leave game controls available.
#### Scenario: Transient graphics failure
- **WHEN** one graphics draw fails during play
- **THEN** animation resumes without reloading the page and lane, jump and duck controls remain available
#### Scenario: Repeated graphics failure
- **WHEN** successive graphics draws fail or the graphics context is lost
- **THEN** the run pauses into a usable fallback, and Resume advances the same run with working controls
#### Scenario: Audio failure
- **WHEN** sound playback throws during an action
- **THEN** the river and controls continue to advance and the animation loop remains scheduled

### Requirement: Bounded preparation and rendering stalls
Renderer preparation SHALL avoid repeated model texture/program work in active simulation frames. Water quality and drawing-buffer size SHALL adapt to rendering pressure without changing gameplay speed, river shape, input timing or character poses. Replaced and late graphics resources SHALL be released.
#### Scenario: Start and restart
- **WHEN** the player starts, returns home and starts again, or scenery models finish loading
- **THEN** resource preparation remains bounded, animation scheduling continues and the accepted river visuals and controls are available
#### Scenario: Sustained slow rendering
- **WHEN** active frame times remain slow or the viewport changes size
- **THEN** rendering cost reduces with bounded buffer changes, while all three lanes remain readable on phone, desktop and landscape
#### Scenario: Pause and visibility
- **WHEN** the player pauses or hides the page and later resumes
- **THEN** paused pixels remain unchanged, hidden time does not lower quality or advance the run, and resumed rendering continues

#### Scenario: Asset download stops responding
- **GIVEN** a model or panorama request remains pending without returning an error
- **WHEN** the asset preparation deadline expires
- **THEN** Start becomes available with loaded art and playable 3D fallback models
- **AND** responses arriving afterward are discarded without changing models or uploading maps during the run

### Requirement: Whole-screen gameplay dragging
During active play, horizontal dragging SHALL change lanes from anywhere on the gameplay screen, including HUD, header and control areas. The same held gesture SHALL support additional lane changes and reversal without lifting, with continuous visual steering. Mouse, touch and primary pen input SHALL be accepted. Recognized drags SHALL avoid activating the button under their origin. Existing button taps, keyboard input and vertical swipes SHALL remain available.
#### Scenario: Drag through overlays
- **GIVEN** a run is playing on phone, desktop or landscape
- **WHEN** a primary pointer begins over the HUD, a disabled Rush button or another gameplay control and drags horizontally
- **THEN** the raft changes lane, can cross another lane and reverse without releasing, with no unintended pause, jump, duck or Rush
#### Scenario: Tap and vertical action
- **WHEN** the player taps a control without dragging, activates it by keyboard, or swipes vertically
- **THEN** the intended action occurs once and the regular pause and sound buttons remain usable
#### Scenario: Cancel or leave play
- **WHEN** a drag is cancelled, the page is hidden or the run pauses or ends
- **THEN** further movement of that gesture produces no action, and a new gesture works after resuming

### Requirement: Outer lane-arrow controls
The control row SHALL present Left lane, Jump, Duck and Right lane in that order, with the lane arrows at the outer ends. Jump and Duck labels SHALL remain visible. All four controls SHALL remain usable on phone, desktop and landscape.
#### Scenario: Control position and action
- **WHEN** a run is displayed on a supported layout
- **THEN** the left arrow is the leftmost control, the right arrow is the rightmost control, and Jump and Duck sit between them with readable labels
- **AND** tapping any control performs its intended action once without layout overflow

### Requirement: Shoreline ducking branches
Duck hazards SHALL visibly grow from rooted shoreline trees in WebGL and the
2D fallback. Generated trees SHALL offer three contiguous widths covering one,
two or three river lanes. One- and two-lane branches SHALL originate from the
nearest bank; full-width branches SHALL vary bank sides. One tree SHALL present
each coherent span. Its visible low wood, markers, hint and physical coverage
SHALL agree, including between covered lanes. Timed ducking SHALL clear every
covered lane; uncovered lanes SHALL remain safely traversable. Accepted speed,
inputs, action windows, protection feedback and finite finishes SHALL remain.
Tree resources SHALL be prepared and bounded.

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
- **THEN** full-width branches remain duckable, partial spans retain a fair clear or duck route, paused pixels stay fixed, and fallback coverage agrees within fixed resource bounds

### Requirement: Natural tree anatomy and materials
Shoreline duck trees SHALL resemble the supplied oak-over-water and mossy
jungle-limb references: a rooted leaning bank trunk continuously grows into a
thick crooked tapering limb with broad asymmetric lateral forks, recursively
smaller twigs, airy broadleaf foliage and hanging strands. They SHALL NOT read
as a straight rail with repeated upright prongs, a detached beam/stump or tiny
foliage balls at equally spaced tips. The visible bank root, branch collar and
low river limb SHALL form one coherent connected tree. One/two/three-lane
coverage SHALL vary by natural reach rather than a decorative fixed fork count.
The primary view SHALL use an optimized locally hosted complete Meshy tree
with recorded provenance and preserve its native topology/proportions. Low
blocking wood SHALL register to covered lanes and remain above a ducking raft;
uncovered lanes SHALL stay open. Native and procedural fallback trees SHALL
retain the same span rules, speed, actions and inputs. Decorative trees SHALL
remain outside playable water. Resources SHALL be prepared before play and
recycled within fixed limits; failed assets SHALL retain a natural playable
fallback.

#### Scenario: Read a naturally attached canopy
- **WHEN** one-, two- or three-lane trees approach from either bank in phone or desktop chase framing
- **THEN** a visible grounded trunk and broad collar support irregular crooked tapering wood, sideways forks, hanging twigs and sparse foliage like the supplied references
- **AND** the tree remains visibly attached without a repeated rail/antenna silhouette or counted lollipop tips

#### Scenario: Preserve physical branch play
- **WHEN** a player ducks through a covered lane or passes beside a partial tree
- **THEN** the blocking limb agrees with its contact marker, ducking clears the wood and uncovered lanes remain open with existing reward/input behavior

#### Scenario: Prepared native tree and fallback
- **WHEN** the run pauses, enables reduced motion, advances through all maps or cannot load the new native model
- **THEN** paused pixels stay unchanged, essential coverage remains readable, native proportions or matching organic fallback remain intact and tree/texture/shader resources stay bounded

### Requirement: Three finite adventure maps
River Rush SHALL offer exactly three maps in order: Canopy Run, Redstone Rapids
and Moonlit Ruins, each with a finite visible finish and a distinct environment.
A cleared level SHALL stop simulation, report results and unlock the next map.
The third clear SHALL show an adventure victory. Campaign totals SHALL carry
between levels; wiping out SHALL retry the current level with prior clears
preserved. Later maps SHALL have higher speed and more demanding varied
sequences while preserving fair routes and the existing action durations.

#### Scenario: Finish the adventure
- **WHEN** a player clears each of the three map finish gates and chooses Next level
- **THEN** every level ends at its stated distance, totals accumulate exactly once,
  the next map visibly changes, and the third finish shows a final victory

#### Scenario: Read varied routes and increasing difficulty
- **WHEN** a player plays the three seeded maps
- **THEN** multiple slalom, mixed obstacle, jump/duck and coin-route sequences
  appear, each row remains traversable, and later maps increase speed and timing demands

#### Scenario: Retry and resume
- **WHEN** a player wipes out or pauses in the second or third level
- **THEN** retry restarts that level with prior cleared totals intact, resume
  preserves simulation, and whole-screen dragging and edge controls still work

#### Scenario: Distinct readable maps
- **WHEN** a map is played at phone, desktop or short landscape size
- **THEN** jungle, rocky gorge and moonlit temple silhouettes and palettes are
  distinct, the character and next hazard remain readable, and the finish is visible

#### Scenario: Prepared maps and fallback
- **WHEN** a level changes, reduced motion is active or graphics/image loading fails
- **THEN** stage transitions allocate no new play-time textures or shader variants,
  stopped screens freeze, and all three maps remain playable in fallback

#### Scenario: Persistent progress
- **WHEN** a player reloads after a level clear or stored progress is malformed
- **THEN** valid map unlocks persist, malformed data starts safely, and old endless
  scores do not become finite adventure records

### Requirement: Shareable scores and gesture guidance
The game SHALL offer a button to save a legible PNG score image with the map,
score and adventure progress. Animated visual guidance SHALL demonstrate
horizontal lane swipes, upward jumping and downward ducking; reduced motion
SHALL retain still diagrams. Guides SHALL not capture gameplay gestures.
Active phone guidance SHALL be compact at the HUD edge and leave the central
river, raft, upcoming hazards and gameplay controls visible. Enemy guidance
SHALL distinguish weaving crocodiles, leaping fish and bank-diving birds.

#### Scenario: Save a score
- **WHEN** a player chooses Save score image during a run or on a result screen
- **THEN** a downloaded PNG contains the current score, map and cleared progress
  and does not depend on retaining WebGL drawing-buffer pixels

#### Scenario: Learn gestures
- **WHEN** a player opens instructions or starts an early run
- **THEN** directional swipe/jump/duck guides visibly show the required gesture,
  remain readable at phone size, respect reduced motion and permit screen-wide input

#### Scenario: Keep the river view open
- **WHEN** opening or enemy hints appear at 390x844, 360x640 or short landscape size
- **THEN** the compact card remains beside the HUD without overlapping score,
  distance, power badges or controls and leaves the central hazard corridor open
- **AND** a drag beginning on the hint still steers the raft through the normal whole-screen gesture handler

### Requirement: Public guest leaderboard
The game SHALL show a shared persistent high-score leaderboard visible to
anyone. Guests SHALL be able to choose a short display name and explicitly
submit their completed score without signing in. The service SHALL validate
names and finite bounded score statistics, return ranked results, and report
failure visibly without replacing the shared board with local-only data.

#### Scenario: Submit and read across browsers
- **WHEN** a guest submits a finished score and another browser opens the board
- **THEN** the named score persists in the ranked public board and is visible to both

#### Scenario: Invalid or unavailable submission
- **WHEN** a request has invalid score/name data or the shared service is unavailable
- **THEN** invalid data is rejected or a retryable service error is shown, and
  the adventure, score capture and local progression remain usable

### Requirement: Longer faster river courses
Each map SHALL have a finite finish at 4,200 / 5,400 / 6,600 m respectively.
Travel SHALL retain current fast start/cap speeds and responsive controls.
Routes SHALL progressively vary and intensify through four course sections,
offer recovery stretches and remain traversable with ordinary reaction delay.
The last 150 m SHALL be hazard-free. Historical progress/scores SHALL remain usable.

#### Scenario: Complete the wilder adventure
- **WHEN** a player clears the three maps in order
- **THEN** simulation stops exactly, the total distance is 16,200 m, the latter
  sections are more demanding and public score storage accepts the result

#### Scenario: Recover and react
- **WHEN** delayed-input players ride at 30, 60 or 120 Hz
- **THEN** changing seeded route episodes, burst/recovery spacing and legal
  action routes allow every map to finish without requiring a shield

### Requirement: Coin pickup follows visible overlap
Every coin SHALL require actual visible raft overlap at its crossing, including
coin-boost and Rush runs. Selecting a lane before arrival SHALL NOT award a
side coin. Misses SHALL pass without reward or pickup feedback. Raised coins
SHALL require the appropriate jump contact; powered play SHALL NOT bypass
contact. Contact rewards SHALL appear while the raft is touching the coin.

#### Scenario: Miss coins during powered play
- **WHEN** a stationary or late-steering raft passes beside a coin during
  ordinary play, the timed coin boost or Rush
- **THEN** no coin, points, charge or streak are awarded and the coin passes
  visibly uncollected

#### Scenario: Touch and show the award
- **WHEN** the raft overlaps a coin while steering, reversing or jumping
- **THEN** that coin rewards exactly once and the counter/contact effect agree
  with the visible collection in 3D and fallback views

### Requirement: Coherent Redstone horizon and faster current
Redstone SHALL retain its textured gorge and use a distant canyon/sky that
matches perspective, fog and relative motion without a stationary painted
near-river scene. Water/current motion SHALL visibly increase, stay downstream
and remain consistent with raft buoyancy. Resources SHALL be prepared before
play and remain bounded.

#### Scenario: Move through the gorge
- **WHEN** a player rides and reverses lanes in Redstone on supported layouts
- **THEN** near banks move faster than distant silhouettes, the water joins the
  horizon without a painted river wall, and hazards remain legible

#### Scenario: Pause and fall back
- **WHEN** play pauses, motion is reduced or graphics fail
- **THEN** paused pixels freeze, decorative motion reduces, all maps remain
  playable and the prepared skyline introduces no play-time texture/shader work

### Requirement: Visible power pickup contact
Timed coin powers and shields SHALL activate only on actual raft overlap at
their crossing. Target-lane selection alone SHALL NOT grant a power. Crossed
items SHALL resolve in travel order; bonuses SHALL affect only later coins.
Missed powers SHALL remain visible as they pass.

#### Scenario: Steer too late toward a power
- **WHEN** a player selects a power's lane without reaching it in time
- **THEN** the power passes uncollected and later side coins remain missed

### Requirement: Escalating organic river acts
All maps SHALL pass through four visibly distinct intensity sections with
continuous geography and shared CPU/GPU buoyancy/placement. Late sections
SHALL contain stronger varied bends, chutes and whitewater, with readable
recovery pools and consistent downstream motion. Resources SHALL be bounded
and prepared before play; paused/reduced-motion behavior SHALL remain usable.

#### Scenario: Ride from opening to finale
- **WHEN** a player moves through each map's four sections
- **THEN** the river becomes progressively wilder, seeded episodes vary,
  boundaries do not pop and water, raft, hazards and banks remain registered

### Requirement: Memorable themed finish gate
Each map SHALL end at a substantial gate across the navigation corridor with
a legible themed checkered banner, beacons and approach markers. The gate
SHALL be registered to the exact finish and readable on portrait phone,
landscape and desktop layouts in primary 3D and 2D fallback views.

#### Scenario: Approach and cross the gate
- **WHEN** a raft approaches the last hazard-free stretch and crosses the gate
- **THEN** increasing approach cues make the finish unmistakable, all lanes
  pass safely beneath it and the clear bonus/result occur once at the exact end

### Requirement: Readable bank rocks and physical hazard contact
Decorative bank rocks SHALL remain outside navigable lanes throughout the seeded curved course. Canopy, Redstone and Moonlit riverbanks SHALL NOT show detached white vertical cards or stripes from bank effects. Hazard outcomes SHALL follow the raft position at the hazard crossing, rather than the lane selected before the raft has moved there. Rocks SHALL remain dodge-only; jump, duck, shield and Rush behaviors SHALL retain their readable action rules and fair traversable routes.

#### Scenario: Swipe toward a neighboring rock
- **WHEN** a player selects a neighboring rock lane immediately before its crossing but the raft remains clear of the rock
- **THEN** the rock passes without an invisible hit or shield consumption

#### Scenario: Swipe away from a contacted rock
- **WHEN** a player selects another lane while the raft still overlaps a rock at its crossing
- **THEN** contact produces the normal protection or wipeout feedback rather than target-lane immunity

#### Scenario: Ride every riverbank
- **WHEN** a player rides through opening and late sections of Canopy, Redstone and Moonlit on phone, desktop or short landscape
- **THEN** rock scenery remains outside playable lanes, banks have no detached white vertical strips, and upcoming hazards remain readable

#### Scenario: Preserved action and rendering lifecycle
- **WHEN** the player jumps, ducks, activates protection, pauses or uses reduced motion
- **THEN** controls respond immediately, stopped frames remain unchanged, action barriers stay traversable, and the correction adds no active shader or texture preparation

#### Scenario: A dodged rock passes beside the raft
- **WHEN** the raft successfully passes beside a rock or jumps over a log
- **THEN** the obstacle remains solid as it passes the raft and retires after leaving the near viewport behind the raft; only an actual shield or Rush impact removes it, without reappearing when feedback expires

### Requirement: Seamless varied terrain with bounded forward chunks
Riverbanks SHALL use deterministic seamlessly periodic two-dimensional noise with bounded layered relief. Canopy SHALL have rounded hills, Redstone SHALL have eroded terraced rock formations, and Moonlit SHALL have broken stepped ridges. CPU scenery placement and GPU bank geometry SHALL use matching terrain heights, with additional relief fading to zero at the navigable channel.

Terrain SHALL reuse a fixed pool of six 64 m chunks per bank, retain contiguous visible coverage, schedule terrain ahead of travel, and recycle only chunks no longer needed behind the camera. Forward movement SHALL use the prepared shader; terrain instance matrices SHALL update only when chunk identities change. Resources and active counts SHALL remain bounded independent of distance and stage transitions.

#### Scenario: Cross a terrain chunk or noise period
- **WHEN** the raft passes a chunk boundary or the procedural noise wraps
- **THEN** terrain height and surface slope remain continuous with no crack, popping bank edge or displaced scenery foot

#### Scenario: Compare three river environments
- **WHEN** a player rides opening and late portions of all maps on supported layouts
- **THEN** seeded bank shapes visibly vary across the course, each map has its stated terrain character, and playable lanes and upcoming hazards remain clear

#### Scenario: Recycle the visible corridor
- **WHEN** the raft advances, changes maps or restarts a river
- **THEN** six prepared slots per bank cover the visible corridor and enough upcoming terrain, old slots recycle without memory growth, and no play-time terrain texture or shader work occurs

#### Scenario: Keep controls and stopped frames
- **WHEN** the player steers, jumps, ducks, pauses or enables reduced motion
- **THEN** accepted speed and action rules remain, scenery stays registered to the shared terrain, and stopped frames remain unchanged

### Requirement: Coherent Moonlit landscape depth
Moonlit Ruins SHALL use an atmosphere-only night sky and prepared bounded course-registered landscape silhouettes. Near, middle and far landscape layers SHALL move with coherent perspective and relative depth; the background SHALL NOT contain a stationary painted river or near temple scene. Moonlight, violet mist and ruin identity SHALL remain, and landscape silhouettes SHALL stay outside playable lanes.

#### Scenario: Advance through Moonlit Ruins
- **WHEN** a player advances and steers through opening, middle and late Moonlit sections on phone, desktop or short landscape
- **THEN** nearer scenery advances faster than distant silhouettes, shared landscape anchors follow the course, no fixed duplicate river remains, and hazards stay readable

#### Scenario: Cross horizon sections
- **WHEN** a horizon slot enters or leaves the visible course
- **THEN** its silhouette enters or recedes gradually without a sudden replacement, and instance/resource counts stay bounded

#### Scenario: Pause, reduce motion and restart
- **WHEN** the player pauses, enables reduced motion, retries or changes maps
- **THEN** stopped frames are stable, decorative motion reduces, controls retain their timing, and prepared resources introduce no play-time terrain texture or shader work

#### Scenario: Use graphics fallback
- **WHEN** WebGL cannot initialize
- **THEN** Moonlit remains playable with a coherent night environment and no fixed painted near river

### Requirement: Epic adaptive gameplay soundtrack
River Rush SHALL play a locally hosted original instrumental adventure loop during active gameplay, with a smoothly fuller mix as course intensity and Rush increase. Action cues SHALL remain distinct. Playback SHALL reuse bounded resources and SHALL NOT delay the frame loop.

#### Scenario: Start and build momentum
- **WHEN** a new player starts a run on desktop or portrait/landscape touch layouts
- **THEN** the score begins from that gesture, loops continuously and smoothly increases in energy with the rapids while jump, duck and pickup sounds remain available

#### Scenario: Pause, hide, finish and retry
- **WHEN** a sounding run pauses, the page hides, a map completes, its brief wipeout presentation ends or the player returns to the menu
- **THEN** playback becomes silent and stays silent until an explicit sounding Start or Resume; retry does not create duplicate media elements or contexts

#### Scenario: Persist mute
- **WHEN** the player mutes sound and retries a map or reloads the page
- **THEN** the preference remains muted until the player explicitly enables sound

#### Scenario: Soundtrack unavailable
- **WHEN** the soundtrack cannot load or browser audio playback is rejected
- **THEN** the game, pause, retry and keyboard/swipe controls continue to work without an unhandled rejection or repeated allocation

### Requirement: Terrain-linked river encounters
Each seeded course SHALL alternate visually distinct narrows, rough-water jump sections, low-canopy passages and calmer recoveries. Their shared distance profile SHALL connect river shape and obstacle/coin routes, rather than decorating an unrelated obstacle sequence. Terrain SHALL preserve the three existing finite maps, accepted speed and immediate keyboard/buttons/screen-wide gestures. Every obstacle row SHALL provide either an adjacent clear lane or a consistent jump/duck wave with sufficient action spacing. Wave-train sections SHALL offer raised coin ribbons; complete encounters SHALL provide at least three eligible jump rows and a one-time 350-point bonus for three perfect unprotected jumps within that section. Truncated final encounters SHALL show their pickup route without advertising an unreachable chain objective. A collision or a new section SHALL reset incomplete progress; Rush or collision grace SHALL NOT farm the chain reward. Resources SHALL remain bounded at late-course distances.

#### Scenario: Follow changing terrain
- **WHEN** the player proceeds through each map on desktop, phone or short landscape
- **THEN** narrow boulder slaloms, rough-water jumps, low duck passages and calm recoveries have distinct visible course shapes and corresponding routes, with safe traversable choices and the existing finish

#### Scenario: Collect within a terrain encounter
- **WHEN** the player touches or passes beside a coin while steering or jumping through a terrain section
- **THEN** only physical contact rewards once, raised coins require jump contact, and control and power rules remain consistent

#### Scenario: Chain whitewater jumps
- **WHEN** the player performs three perfect unprotected jumps in a wave-train section with an advertised chain objective
- **THEN** the visible chain fills and awards 350 points once; additional clears or powered contact do not duplicate it, and a collision or next section resets incomplete progress

### Requirement: Audible and tangible contact
Collected coins SHALL produce a distinct short pickup chime at contact. Protected and fatal collisions SHALL produce a distinct impact sound with readable raft/rider recoil and splash. Each emitted contact SHALL be handled once even when a frame also crosses other rewards. A fatal contact SHALL stop the simulation at impact, show a short wipeout beat, and then provide the existing result and one-action retry. Protected impacts SHALL NOT lock controls. Persisted mute, audio failure, pause and hidden state SHALL retain their existing behavior.

#### Scenario: Hit a protected or unprotected obstacle
- **WHEN** the raft physically collides with a hazard with or without protection
- **THEN** contact produces a visible impact and audible transient when sound is enabled, protection remains responsive, and a fatal hit gives a brief wipeout followed by the score/retry screen

#### Scenario: Collect rapid coins
- **WHEN** several physically touched coins and another reward occur in one update
- **THEN** pickup audio remains audible and bounded without skipped contacts or duplicate rewards, while passing beside coins stays silent

#### Scenario: Pause, mute or reduce motion
- **WHEN** the player pauses, hides the page, mutes, retries, or uses reduced motion on a supported layout
- **THEN** pause/hidden/mute stop the appropriate audio, paused pixels freeze, retry resets the impact beat, reduced motion suppresses shake while retaining clear contact feedback, and a failed sound resource cannot stop play

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

### Requirement: Readable moving river enemies
Each seeded river SHALL include sparse crocodile, leaping-fish and swooping-bird enemies after its tutorial and early required actions. Crocodiles SHALL repeatedly weave back and forth across lanes, remain moving near contact and weave faster on later maps. Crocodiles and fish SHALL allow jumping or dodging; birds SHALL allow ducking or dodging. Fish SHALL visibly leap from water, and birds SHALL descend into the river from either shoreline. Their visible lane and height SHALL use a shared deterministic pose; physical crossing SHALL use that pose's contact lane. A clear action tell and predicted contact-lane marker SHALL provide enough warning for a timed response. Generation SHALL preserve reachable action rewards, attainable advertised chains, clear routes and finite finishes. Prepared animation resources and active entities SHALL remain bounded.

#### Scenario: React to weaving and leaping wildlife
- **WHEN** a crocodile or fish approaches on desktop, portrait touch or short landscape
- **THEN** the crocodile reverses repeatedly without settling before contact, the fish visibly launches out of water, and their jump/dodge cues and contact markers agree with the physical crossing lane
- **AND** a correctly timed jump clears the enemy and reaches its raised reward without requiring an adjacent-lane coin pickup

#### Scenario: Duck a bank-diving bird
- **WHEN** a bird approaches from either side of the river
- **THEN** its trajectory begins beyond the bank and visibly descends into its marked high contact envelope, with a readable duck/dodge tell and enough response time

#### Scenario: Contact and stopped state
- **WHEN** the raft overlaps an enemy, pauses, retries or enables reduced motion
- **THEN** physical contact uses its shared visible lane and existing protection/wipeout feedback, paused positions remain unchanged, retry resets encounters, and reduced motion keeps essential collision motion clear without extra shake

#### Scenario: Preserve complete varied courses
- **WHEN** delayed-input play proceeds through all three maps including Rush and advertised jump chains
- **THEN** all three species appear, routes and raised coin arcs remain attainable, finishes remain finite, and entities and prepared graphics resources stay within fixed bounds

### Requirement: Drifting bonus relic targets
Courses SHALL offer sparse drifting relic targets in clear recovery space using the existing steering controls. Both renderers SHALL show their shared moving position and destination. Actual compatible ground-height contact within the existing .25-lane pickup radius SHALL award 200 points once and 10 charge outside active Rush with distinct visual and audible feedback; adjacent or airborne misses SHALL pass silently. Bonus routes SHALL NOT conflict with preceding jump arcs or demand an immediate lane change into another hazard.

#### Scenario: Collect or miss a drifting relic
- **WHEN** a player physically steers over a target or passes beside/above it
- **THEN** only compatible contact awards the bonus once, emits one pickup cue and visible burst, and preserves ordinary coin contact rules

#### Scenario: Keep accessible feedback and bounded play
- **WHEN** a player mutes, pauses, hides, retries or plays the graphics fallback
- **THEN** sound preferences and stopped motion remain correct, targets remain distinct and reachable, and their prepared resources do not grow with course distance
