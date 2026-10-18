## ADDED Requirements

### Requirement: Mature graphic-novel character direction
The graphics follow-up SHALL pursue original NORD characters with mature human silhouettes, convincing anatomy/clothing and expressive illustrated faces, using the user's Spider-Verse visual reference with smooth motion. Crew roles/style IDs SHALL remain stable; likeness and outfit continuity SHALL be reviewed through redesign feedback. Earlier neutral-face acceptance SHALL NOT be treated as acceptance of this new target.

#### Scenario: Review the first style study
- **WHEN** the initial concept is presented
- **THEN** it is clearly labelled as a direction study rather than an implemented character or gameplay capture
- **AND** mature silhouettes, graphic shapes, drawn shading and controlled expressions can be reviewed independently of runtime motion

#### Scenario: Review an implemented character pilot
- **WHEN** the actual possessed pilot is reviewed at 1280×720 and 1920×1080
- **THEN** front/three-quarter face and whole-body views show the intended human proportions, readable face/hands and dimensional clothing
- **AND** unpaused idle/start/stop/walk/sprint/turn/jump/landing video in both render modes demonstrates smooth pose updates, blended transitions, stable line treatment and grounded feet
- **AND** source provenance, remaining facial/finger/material limits and separate native/co-op/package/performance verdicts are recorded before the whole crew is accepted

### Requirement: Isolated native pilot review
The local pilot SHALL be available only through the explicit `-NordGraphicNovelCandidate` review flag until graphics acceptance. Original sources and production crew/map packages SHALL remain recoverable and unchanged.

#### Scenario: Opt into the local character
- **WHEN** the native game starts with the candidate flag and style 9 is selected
- **THEN** its candidate body, own clips, blended graph and ink stencil are selected without a Python asset override
- **AND** other styles and normal launches retain production assets, and F2 remains private and initially off

#### Scenario: Observe native motion without a renderer
- **WHEN** the candidate runs the explicit headless verification fixture
- **THEN** actual bone refresh is enabled for observation and real evaluated foot/knee poses must change with movement; hand/eye controls must change where supplied by that rig, while body-only variants explicitly report zero controls
- **AND** the report identifies fixture overrides, skipped images, failed topology and unverified visual/performance acceptance instead of treating graph clocks as graphics evidence

#### Scenario: Refine a funded pilot without replacing provenance
- **WHEN** a local collar or neck shading repair is made after the funded pilot review
- **THEN** the original funded model/maps remain immutable and the local derivative records its exact source and affected surface region
- **AND** native close-ups in both modes/sizes improve the demonstrated defect while preserving face colours, rig, matching clips and movement
- **AND** shaded-normal changes are labelled intentional refinement rather than unchanged bake output, with remaining art/performance limits retained

#### Scenario: Compare a higher-detail body independently
- **WHEN** Candidate, Generated and HighDetail review flags are supplied together
- **THEN** style 9 selects the separately imported higher-detail body, its own skeleton/four clips and UV0 PBR maps
- **AND** incomplete flag combinations, ordinary launches and the earlier pilot routes retain their existing selection
- **AND** missing or mismatched generation receipts, bounded source-file hashes or own-rig evidence reject import before asset mutation
- **AND** native appearance, deformation and workload are compared with the retained draft before promotion or wider cast spending; static face/fingers and unverified packaged performance remain disclosed

#### Scenario: Correct the rejected airborne silhouette
- **WHEN** the private higher-detail pilot is revised after the rejected airborne frame
- **THEN** matching front, side and three-quarter airborne/landing views and actual continuous motion show a natural shoulder/sleeve silhouette and plausible held-prop scale/grip without face occlusion
- **AND** original sources, ordinary crew/district packages, gameplay/input, collision and saved state remain preserved; passing import or pose counters alone do not accept art quality

#### Scenario: Relax the Tripo pilot's stiff arms
- **WHEN** the own-rig pilot is standing or recovering from a jump
- **THEN** the authored idle keeps soft forward elbows, relaxed shoulders, inward palms and loosely curled fingers instead of returning to the rigid bind pose
- **AND** actual exported clips preserve their own hierarchy/reference pose and matching relaxed endpoints, with front/side/three-quarter and motion review distinguishing CPU authoring evidence from native acceptance

#### Scenario: Select the isolated own-rig Tripo pilot
- **WHEN** Candidate, Generated, HighDetail and Tripo review flags are all present and crew style9 is selected
- **THEN** the native character uses the separate Tripo mesh, own skeleton/four clips and saved three-sample BlendSpace with its baked relaxed finger poses
- **AND** the held tool follows an own reference-derived `hand_r` socket, while selecting another crew or removing review flags restores the standard attachment and body
- **AND** incomplete flags preserve their prior non-Tripo route; source inputs, ordinary crew/district assets, live package and saves remain protected until separately verified promotion

#### Scenario: Review the full mature cast
- **WHEN** all four review flags are enabled and a player cycles C through the eight crew
- **THEN** each completed candidate uses that person's preserved design, separate own skeleton, compatible four clips, relaxed forward elbows and loosely articulated fingers
- **AND** each held prop follows its own measured hand grip, including the style8 PVC tube; stopping, jumping, landing and leaving/reselecting a crew preserve compatible animation and attachment state
- **AND** ordinary launches and incomplete flag combinations retain their prior routes until separately checked promotion; missing or unreviewed bodies are not reported as completed candidates
- **AND** actual continuous motion and head/hand/sleeve/prop clearance are reviewed in both F2 modes at1280×720 and1920×1080 before live rollout; headless counters alone do not accept natural graphics

#### Scenario: Preserve own-rig body and prop scale through Jump
- **WHEN** a completed private Tripo candidate transitions from standing through ascent, airborne pose, landing and recovery
- **THEN** its static root keeps the imported reference transform while the pelvis carries the own Jump pose, with no body or held-tool scale collapse
- **AND** native headless checks retain the calibrated182cm body and16×55cm plunger or6.6×90cm tube; actual grip/contact and rendered naturalness still require separate visual review

### Requirement: Detailed animated playable crew
The supplied playable characters SHALL retain readable facial details and distinct locomotion in the comic view.

#### Scenario: Inspect and move each character
- **WHEN** a player cycles all eight bodies, walks, sprints, jumps and lands
- **THEN** all bodies use their matching idle, walking, running and jump/landing clips
- **AND** running has a distinct leg/arm stride and airborne poses reflect ascent/descent followed by landing recovery
- **AND** character texture details remain visible without halftone or normal-edge ink obscuring eyes and mouths
- **AND** movement and appearance remain replicated and supported HUD layouts remain readable

### Requirement: Relaxed default crew expressions
The eight supplied crew designs SHALL have relaxed static default expressions while preserving recognizable identities, outfits and the established comic direction.

#### Scenario: Inspect a resting character
- **WHEN** a player views any crew member at conversation distance in the ordinary comic view at 1280×720 or 1920×1080
- **THEN** the face has resting brows/lids and a comfortably closed or softly parted mouth, without an exaggerated fixed toothy grin, grimace or startled stare
- **AND** individual facial proportions, skin tone, hair/facial hair, eyewear/headwear, outfit and accessories remain recognizable from the retained supplied design
- **AND** original source data remains immutable, original Unreal assets remain recoverable and the replacement's reference, generation and import provenance are retained

#### Scenario: Accept a relaxed-expression replacement
- **WHEN** the neutral-reference skull-shirt pilot is captured as the actual possessed pawn in unobstructed front and three-quarter views at both supported sizes
- **THEN** native rendered identity and relaxed expression pass visual review before the remaining crew is regenerated
- **AND** idle, walk, run, airborne and landing use intact matching body poses without movement/root regressions
- **AND** each subsequent replacement receives native face review at both sizes before the complete crew is accepted

### Requirement: Populated mapped district
The neighborhood SHALL contain additional parked cars, moving traffic and pedestrians distributed through the district.

#### Scenario: Explore the streets and park
- **WHEN** the map starts and a player explores the mapped roads and paths
- **THEN** at least 32 additional parked cars, 16 moving traffic cars and 96 additional ambient people populate valid ground routes/activity points
- **AND** traffic follows connected roads, yields to obstructions and becomes player-controlled only at a safe speed
- **AND** peers observe the same population and original controls/objectives remain usable

#### Scenario: Observe varied neighbourhood activity
- **WHEN** a host and joining peer observe Sherbrooke, the chalet vicinity and park paths for at least one minute
- **THEN** the 96 ambient people comprise 72 walkers, 16 joggers and eight stationary social residents, with at least four visibly different appearances, replicated pace/endpoint pauses and retained Idle/Walk/Run clips
- **AND** all 88 mobile actors show sustained minute-long movement while the eight social actors hold their assigned positions; selected existing residents use clear mapped chalet/spawn-adjacent routes with staggered turnaround points and focused nearby labels
- **AND** the fleet shows three cosmetic cabin/roof silhouettes and deterministic cruise-speed variation, with existing collision footprints and wheels unchanged
- **AND** animation phases/activity timing vary, routes remain clear and traffic/mobile people resume after a temporary obstruction
- **AND** peers share authoritative activity modes/pace profiles/vehicle state while safe car entry/exit, E interactions, C selection, F2 and shared objectives remain usable

### Requirement: Recognizable park district appearance
Environment improvements SHALL preserve municipal building massing and mapped park geometry while improving its comic rendition.

#### Scenario: Inspect reference views
- **WHEN** the Sherbrooke streets, ponds, chalet and theatre are rendered at 1280×720 and 1920×1080
- **THEN** mature irregular canopy replaces repeated balloon crowns and masonry has subdued varied brick/stone detail
- **AND** two-pond/path arrangement, survey roofs/footprints and tree XY positions remain preserved
- **AND** primary reference sources and estimated facade/landmark details are documented without claiming identical Street View geometry

#### Scenario: Read local details at walking height
- **WHEN** the player walks from the Sherbrooke spawn toward the chalet/theatre and sports areas at either supported resolution
- **THEN** the closest residential facades show readable entrances, basement/window/cornice variation and restrained ironwork, with institutional fronts treated distinctly
- **AND** contextual street/park furniture and chalet terrace/theatre details contribute visible local identity without obstructing routes or changing protected shell/roof, pond/path or tree inventory positions
- **AND** fourteen retained tennis footprints show the documented carpet/acrylic distinction and two illustrated volleyball playing areas use retained in-park sand way `311018514`, with inferred arrangement/numbering documented, fine tennis nets replacing legacy backing/grid/posts and the replaced single-volleyball-net dressing suppressed

#### Scenario: Verify the neighbourhood correction
- **WHEN** the new surroundings/activity pass is built and reviewed
- **THEN** a fresh twenty-one-view native matrix at each supported size receives separate completion and visual-review verdicts: the existing seven cameras, seven ground-level comic views of the four park-edge streets/chalet/tennis/sand courts and those same seven after actual F2
- **AND** native interaction/replication/collision and current packaged lifecycle checks pass with the new details/population enabled
- **AND** current-build warmed performance is measured at unchanged Epic/100% settings against the existing p95 below 16.67 ms requirement, with failed gates kept open
- **AND** dated official references, source assumptions, preservation checks and remaining terrain/construction/likeness limits are retained

### Requirement: Save the park story campaign
The proposed campaign SHALL deliver the eight-mission [One More Tomorrow treatment](../../../../../games/nord-unreal/Design/SaveThePark.md), preserving the comic direction, recognizable park setting and freely selectable crew. Missions 1 and 2 have a native prototype with passing automated progression and bounded presentation checks; physical play acceptance remains pending. Missions 3–8 and full-campaign completion remain planned. The narrative treatment alone does not establish implemented or verified gameplay.

#### Scenario: Discover the Curator's trap
- **WHEN** the crew completes the first four festival events and the theatre performance
- **THEN** recurring collector marks and captured closing cues foreshadow the revelation that their endings charge the Boogeyman's master book
- **AND** the crew's established backstage position explains how the player-controlled characters escape capture
- **AND** the early rescues retain value through released people and equipment that support the comeback

#### Scenario: Play varied encounters and finish the story
- **WHEN** a player follows the full campaign from the chalet to the final theatre confrontation
- **THEN** meaningful actions include a light/plunger rescue, a street race, a pond reflection puzzle, a court skill encounter, a staged performance, resident rescues, convoy interception and a phased finale
- **AND** worklights reveal seams, plungers open exposed clamps and the stolen projector creates blank-panel gaps according to taught rules
- **AND** the finale exposes and breaks the master binding before the show ends voluntarily, leaving visible park restoration and continued free-roam
- **AND** story completion requires neither performance medals nor a particular supplied character choice

### Requirement: Resumable solo and shared campaign
The proposed campaign SHALL support solo and the supported multiplayer party sizes with host-owned progression, banked retries and mission-boundary saves. The first two native encounters pass automated retry, replication and actual save/reload checks; physical co-op acceptance remains pending. The remaining campaign's recovery and restoration behavior is planned. The three exploration objectives remain available only in explicit legacy mode.

#### Scenario: Play alone or change the party
- **WHEN** a solo player undertakes a driving/runner encounter, or a peer joins or disconnects during a mission
- **THEN** required actions can be completed sequentially without passenger seats or simultaneous mandatory switches
- **AND** completed subgoals remain banked, late joiners receive the active phase/restoration state and an absent player's avatar or car cannot permanently block progression
- **AND** checkpoint retry and mission-boundary reload preserve the intended progress without duplicating rewards or restoring removed clamps/captives incorrectly
- **AND** E entry/exit, C selection, private F2, collision, authoritative driving and disconnect recovery retain their existing behavior
- **AND** tools/captive identity are independent of CrewStyle, parked-car clamp access avoids the existing car-entry radius and the unique shared projector remains recoverable without duplication
- **AND** the theatre capture cue waits for active players in its safe unframed area and places late joiners there safely

#### Scenario: Accept the first playable story slice
- **WHEN** missions 1 and 2 are implemented and reviewed solo and with peers
- **THEN** actual play establishes a comprehensible opening mystery, usable worklight/plunger actions and enjoyable racing-style handling rather than two renamed proximity markers
- **AND** objectives, captions and hazard telegraphs remain readable at 1280×720 and 1920×1080, with visual alternatives to essential sound cues
- **AND** playtest findings separately assess handling enjoyment, pacing, variety, retry frustration and story comprehension
- **AND** current native/package checks pass and performance is measured against the unchanged frame-time gate before any implemented slice is accepted


### Requirement: First story slice observable acceptance
The first two campaign missions SHALL be accepted through actual native interactions, authoritative progression and separately reviewed solo/co-op play. Automated native actions, save/reload, bounded visual inspection, packaged startup and six static performance scenes pass as recorded in the verification report. Physical solo/co-op play, audio and full packaged campaign/save flow remain unverified, so overall slice acceptance stays open.

#### Scenario: Learn and perform the terrace rescue
- **WHEN** a player attempts the chalet worklight/plunger actions from the wrong phase, outside the permitted range or while driving, then performs the taught sequence correctly on foot
- **THEN** invalid attempts do not advance the host-owned campaign or free captives
- **AND** the valid native actions visibly reveal and release the intended fixtures in order, with shared completion replicated to peers
- **AND** C changes appearance without removing campaign tools or changing progress, and F2 remains private

#### Scenario: Race, retry and change the party
- **WHEN** the player starts the street race in an eligible car, attempts a later gate first, follows the ordered route and retries after a mistake
- **THEN** skipped/out-of-order gates cannot grant completion, while valid native driven crossings advance the expected checkpoint
- **AND** retry returns to a safe documented checkpoint without erasing banked story work or duplicating rewards
- **AND** joining or departing peers receive or release the correct shared phase, vehicle occupancy and appearance without permanently blocking solo completion

#### Scenario: Resume and inspect the first slice
- **WHEN** an isolated test session ends and the host reloads its campaign save, and the slice is inspected at both supported resolutions
- **THEN** mission-boundary progress and the documented unfinished-encounter reset policy load from actual saved state while the production slot remains unchanged
- **AND** native 1280×720 and 1920×1080 captures separately pass completion checks and visual review of prompts, objectives, telegraphs and restored terrace/race states
- **AND** manual physical-control solo/co-op findings assess story comprehension, racing enjoyment, mission variety and retry frustration separately from automated progression
- **AND** current gameplay/package regressions pass and performance is measured against the unchanged requirement before playable acceptance

### Requirement: Responsive racing-style driving
Player-controlled cars SHALL provide progressive acceleration, braking before reverse, speed-sensitive steering, controllable handbrake slip and recovery, speed-responsive camera feedback and local engine/tire feedback while preserving authoritative control, tested collision and ambient traffic behavior.

#### Scenario: Brake, corner and recover
- **WHEN** a driver accelerates, holds S while moving forward, steers at different speeds and releases a handbrake turn
- **THEN** braking stops forward motion before reverse, steering remains controllable at speed and lateral momentum settles after release
- **AND** the follow camera widens with speed while retaining manual look and the existing grace period
- **AND** native handling checks reject non-finite input and verify bounded motion, and a representative street circuit receives a separate subjective handling review

#### Scenario: Retain safe shared driving
- **WHEN** peers drive over a marking/curb, encounter a tall wall, lose driving packets or disconnect
- **THEN** tested curb traversal, wall blocking, stale-input clearing, occupancy cleanup and recovery still work
- **AND** ambient traffic retains its route/yield behavior and local audio does not create an audible fleet of unoccupied cars

## MODIFIED Requirements

### Requirement: Smooth character animation
Playable crew and visible ambient residents SHALL update their poses with their active animation updates in both standard and comic views, without deliberate 12 Hz holds or animation-clock quantization. Movement and camera SHALL remain continuous; enabling the comic filter SHALL NOT impose a lower pose cadence. This requirement does not promise a fixed render or stream frame rate.

#### Scenario: Watch the character run
- **WHEN** the player runs or observes a moving resident in either render mode
- **THEN** the animation clock advances without deliberate held steps while ground movement remains continuous
- **AND** pressing F2 changes the local look without reducing the character's pose-update cadence or another player's rendering

### Requirement: Textured cottage crew
The eight supplied cottage characters SHALL use complete textured skeletal models with recognizable face, hair, clothing and accessories and relaxed default expressions, in the established comic art direction.

#### Scenario: Inspect the crew
- **WHEN** the eight residents are viewed at conversation distance and in the 1600 by 900 lineup
- **THEN** all eight render with textured complete bodies and distinct reference outfits, correctly grounded and without missing materials
- **AND** original source models and generation provenance remain retained alongside versioned replacements

#### Scenario: Walk and talk online
- **WHEN** a client joins a host and approaches a crew member with E
- **THEN** the resident walks using the imported animation, movement replicates and only the interacting player sees the existing caption
- **AND** existing car controls and mission state are preserved

#### Scenario: Revised skull-shirt likeness
- **WHEN** the skull-shirt resident is viewed in the saved face close-up
- **THEN** his short tousled hair, short beard/moustache and facial proportions remain recognizable from the supplied face illustration, with a relaxed resting mouth and brows
- **AND** his black graphic shirt, teal palm shorts and bare feet remain recognizable

### Requirement: Interchangeable playable crew
Each player SHALL be able to play as any of the eight supplied cottage crew designs using versioned textured skeletal models with matching body animation clips.

#### Scenario: Choose a character
- **WHEN** a player starts the map and presses C repeatedly
- **THEN** the revised skull-shirt body is the default and C cycles through all eight supplied designs, wrapping to the first
- **AND** the HUD identifies the current choice at 1280×720 and 1920×1080
- **AND** walking, sprinting, jumping, camera and shared progress remain usable

#### Scenario: Share and retain the appearance
- **WHEN** a client switches character on foot or while driving
- **THEN** all connected peers see the new choice for that player without changing another player's selection
- **AND** car occupancy stays valid and exiting restores the selected visible body
- **AND** an ongoing-session join receives the current appearance

#### Scenario: Respect the selected body provider
- **WHEN** preparing the remaining seven characters after the user's explicit Tripo-body selection
- **THEN** each new production candidate uses a reviewed Tripo-generated body and its own Tripo rig, preserving the mature identity and outfit references
- **AND** completed Meshy comparisons remain recoverable with their original costs and are not reported as the selected final cast
- **AND** missing funds, incompatible geometry or unfinished native/visual checks keep that character pending rather than silently substituting a different source or repeating paid jobs
### Requirement: Generated crew face their direction of forward travel

The complete private Tripo route SHALL align the six generated styles3–8 with the native pawn's forward movement, while retaining pilot9 and ordinary production orientation.

#### Scenario: Switch between generated, pilot and production crew

- **WHEN** a player selects each generated crew style, switches to pilot9 or production10, or removes the Tripo opt-in flags
- **THEN** the evaluated standing feet and visible face point along native forward travel for the selected body, held tools follow their own hand sockets, and production orientation is restored when its route is selected
- **AND** fresh native and rendered checks cover the actual selected body rather than substituting a capture-only transform
