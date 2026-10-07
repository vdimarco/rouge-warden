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

### Requirement: Higgsfield living title scene
The title scene SHALL use a Higgsfield-generated silent looping video based on the approved character art, with a still-image fallback. It SHALL preserve live readable menu controls, pause while hidden or covered by instructions, and use the still image for reduced motion or data-saving.

#### Scenario: Enter the menu
- **WHEN** the menu loads in a normal-motion browser
- **THEN** the river and character artwork animate behind working Start and Switch game controls

#### Scenario: Video unavailable
- **WHEN** video cannot load or motion/data preferences disable it
- **THEN** the approved still image and all menu actions remain usable

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
The game SHALL reward coin trails and successful actions with points and Rush charge. Coin streaks SHALL increase the score multiplier and expire after a collection gap; the HUD SHALL communicate time remaining. Rush SHALL NOT recharge itself. Magnet SHALL collect nearby coins across lanes for eight seconds; shield SHALL absorb one impact; full Rush charge SHALL grant four seconds of faster invulnerable riding and be activated by Shift or its touch button.
#### Scenario: Build and use Rush
- **WHEN** a player fills the Rush meter and activates it
- **THEN** charge is spent once, speed increases, hazards are safely cleared and the timed state expires
#### Scenario: Collect magnet
- **WHEN** a player picks up a magnet and passes coins in other lanes
- **THEN** those coins are collected while the timer lasts and normal lane collection returns afterward

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
Coins SHALL spin and fly toward the HUD on collection; magnet attraction SHALL visibly travel from other lanes toward the raft. Shield impacts SHALL show a short shatter burst and recoil; Rush SHALL show motion trails and obstacle bursts. Reward HUD pulses SHALL remain small and preserve readable values and controls.
#### Scenario: Coin and shield feedback
- **WHEN** a player collects a coin and later consumes a shield on impact
- **THEN** the coin travels toward the counter and a shield burst/recoil communicates protection lost without obscuring upcoming hazards
#### Scenario: Magnet and Rush
- **WHEN** magnet or Rush is active
- **THEN** attracted coins and invulnerable obstacle clears have distinct animated feedback and effects expire with bounded counts

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
The primary view SHALL distinguish jungle canopy, sandstone gorge and moonlit
temple maps using locally hosted fal panoramas, prepared palettes, textured
trees, rock/temple landmarks and driftwood. Near scenery SHALL move with the
course and the distant environment SHALL provide atmospheric depth. Decorative
landmarks SHALL remain outside playable lanes and preserve hazard readability.

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
2D fallback, with textured tapering limbs and foliage. Their low tips SHALL
align to the existing branch lane and collision distance. Connecting limbs
crossing other lanes SHALL stay above the standing rider. The existing speed,
duck window and collision outcomes SHALL remain unchanged. Tree geometry SHALL
remain bounded and use locally available resources prepared before active play.

#### Scenario: Approach and duck a shoreline limb
- **WHEN** a player approaches a branch on phone, desktop or short landscape
- **THEN** its tree is grounded on a shoreline, its limb reaches into the marked
  lane, and a correctly timed duck clears it with the existing reward

#### Scenario: Safe route and passed tree
- **WHEN** a player avoids the branch lane or passes below its tip
- **THEN** connecting wood stays overhead outside the hazard lane and the rooted
  tree continues past before being removed within the existing entity bounds

#### Scenario: Fallback and inactive play
- **WHEN** WebGL is unavailable, reduced motion is enabled, or the run pauses
- **THEN** rooted branches remain readable in fallback and reduced motion, and
  pause preserves the rendered scene without decorative branch movement

### Requirement: Natural tree anatomy and materials
Shoreline trees SHALL have smooth curved, tapering limbs, rooted broad trunks,
irregular fuller crowns, detailed bark and natural individual leaf textures.
The duck bough SHALL have substantial structural thickness and multiple
connected woody forks with leafy offshoots along its span. Its terminal
silhouette SHALL descend naturally without a curled upward hook.
Matching decorative trees SHALL be placed outside the playable river. Curved
low limbs SHALL remain confined to their duck lane. Texture and geometry work
SHALL finish before active play; missing new textures SHALL retain usable local
materials. All trees SHALL share a bounded renderer budget and retain existing
speed, action windows, inputs and collision outcomes.

#### Scenario: Read a natural duck tree
- **WHEN** a player approaches and ducks a shoreline branch at phone, desktop
  or short landscape size
- **THEN** the tree has a continuous curved limb, recognizable bark and leaves,
  and a successful timed duck preserves protection and earns the existing reward

#### Scenario: Travel through a fuller riverbank
- **WHEN** a run advances through its bank scenery
- **THEN** matching detailed trees remain outside playable lanes, recycle within
  fixed counts and do not obscure low hazard tips with crown foliage

#### Scenario: Pause or use fallback
- **WHEN** the run pauses, reduced motion is active, WebGL fails or a new texture
  cannot load
- **THEN** paused pixels stay fixed, reduced motion preserves readable trees,
  and the fallback remains playable with the same branch geometry and controls

#### Scenario: Read a substantial branched bough
- **WHEN** a player approaches a duck tree on phone, desktop or landscape
- **THEN** a thick supporting bough has multiple clearly connected leafy forks,
  its low end tapers without curling upward, and a timed duck clears the wood

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

#### Scenario: Save a score
- **WHEN** a player chooses Save score image during a run or on a result screen
- **THEN** a downloaded PNG contains the current score, map and cleared progress
  and does not depend on retaining WebGL drawing-buffer pixels

#### Scenario: Learn gestures
- **WHEN** a player opens instructions or starts an early run
- **THEN** directional swipe/jump/duck guides visibly show the required gesture,
  remain readable at phone size, respect reduced motion and permit screen-wide input

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
Each map SHALL have a finite finish at 2,800 / 3,600 / 4,400 m respectively.
Downstream travel SHALL be faster than the prior adventure while preserving
the current jump/duck durations, responsive steering and traversable routes.
Campaign totals, saved unlocks and public scores SHALL remain usable.

#### Scenario: Complete the extended adventure
- **WHEN** a player completes the three maps in order
- **THEN** finishes stop exactly, distance totals 10,800 m, speed/difficulty
  increase across maps, and the public board accepts the result

#### Scenario: React to faster hazards
- **WHEN** players react with ordinary input delay at 30, 60 or 120 Hz
- **THEN** every map retains a legal route and sufficient action spacing

### Requirement: Coin pickup follows visible overlap
Ordinary coins SHALL score only when the visibly interpolated raft passes
over them; choosing a target lane alone SHALL NOT collect an adjacent coin.
Missed coins SHALL continue past with no pickup event. Magnet and Rush SHALL
retain explicit visible attraction. Raised coins SHALL require a jump unless
an attraction power-up is active.

#### Scenario: Miss or cross a coin
- **WHEN** a coin reaches a raft that is beside it, steering toward it too late,
  or reversing away without overlap
- **THEN** it passes without scoring or pickup effects; a physically overlapped
  coin scores once, including when crossed during a lane transition

#### Scenario: Powered collection
- **WHEN** a magnet or Rush is active while another lane's coin passes
- **THEN** attraction feedback explains the pickup and normal overlap rules
  resume after the power-up expires

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
