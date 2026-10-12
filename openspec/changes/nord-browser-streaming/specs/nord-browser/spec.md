## ADDED Requirements

### Requirement: Browser streaming of the existing game
NORD SHALL use the existing Unreal game through an official UE5.8-compatible browser streaming player, retaining native controls and existing campaign behavior.

#### Scenario: Connect and play
- **WHEN** the configured GPU host is running and a desktop player selects an available stream and clicks connect/play
- **THEN** actual Unreal video appears and keyboard/mouse actions reach the game after the required browser gesture
- **AND** disconnecting releases held movement, car input and that player's worklight without resetting progress
- **AND** the player can release pointer lock, reconnect and request fullscreen without trapping page controls
- **AND** essential controls remain readable at desktop and narrow browser widths

#### Scenario: Host unavailable or connection fails
- **WHEN** the endpoint is absent, the PC is off, the stream is occupied or WebRTC cannot establish media
- **THEN** the player sees an actionable offline/connection error rather than simulated gameplay or a successful play claim
- **AND** production endpoints require WSS and arbitrary query-string endpoint overrides are disabled

#### Scenario: Ordinary browser on the hosting PC
- **WHEN** the hosting PC opens the deployed HTTPS player using normal browser DNS and security settings
- **THEN** the public signalling endpoint connects without resolving to a private tailnet address
- **AND** both free streams can play real media, receive input and reconnect
- **AND** a QA run using a DNS override is explicitly labelled and does not count as ordinary-browser acceptance

#### Scenario: Direct media blocked on a mobile network
- **WHEN** the phone reaches signalling but cannot establish the direct video/control path
- **THEN** the configured authenticated fallback relay can carry the media/control path to the game PC
- **AND** relay access is limited to the game host and unrelated network destinations remain denied
- **AND** a remaining network failure is identified separately from host availability and unsupported touch controls

#### Scenario: Diagnose sluggish playback without adding input overhead
- **WHEN** a player sends movement or camera input through the production browser
- **THEN** the shared streaming logger suppresses debug/info packet logs and stack capture while retaining warnings and errors
- **AND** a sluggish-playback investigation measures incoming frames, loss, decoding and host load separately rather than treating connection success as smooth-play acceptance

### Requirement: Independent browser co-op
The temporary deployment SHALL distinguish independent player streams from multiple viewers controlling the same pawn.

#### Scenario: Two friends join
- **WHEN** two browsers select NordHost and NordFriend1 respectively
- **THEN** separate Unreal instances connect to the same multiplayer session and control distinct characters
- **AND** progression remains authoritative on the host and client selection/reconnect does not overwrite host saves

### Requirement: Bounded temporary hosting and deployment
The browser rollout SHALL use Vercel for the player and the existing PC for GPU execution, with explicit runtime/network limits.

#### Scenario: Publish and stop the demo
- **WHEN** the tested player is deployed and the temporary PC hosting processes are started or stopped
- **THEN** the deployment preserves the existing arcade, map/assets and unrelated computer services
- **AND** stopping the host terminates only owned processes and makes the browser report unavailability
- **AND** verified local/public reachability and remaining ICE/TURN or capacity limits are reported separately from Vercel deployment status

### Requirement: Mobile touch gameplay
The browser player SHALL provide touch controls on touch-capable devices using the existing native keyboard and camera bindings without changing the game package or desktop controls.

#### Scenario: Move, look and act on a phone
- **WHEN** a touch-capable browser plays a connected stream in portrait or landscape
- **THEN** a left stick moves or steers, a right pad looks around, and clearly labelled buttons provide sprint, jump/handbrake, interact/car, crew, recovery, race replay and comic view
- **AND** simultaneous fingers can move, look and hold an action without capturing the desktop mouse
- **AND** controls remain within the viewport, have at least 44-pixel touch targets and remain available in fullscreen
- **AND** action buttons accept keyboard or assistive click activation without duplicating ordinary touch actions

#### Scenario: Release interrupted touch input
- **WHEN** a held touch is lifted, cancelled or loses capture, or the page loses focus, is hidden, rotates or disconnects
- **THEN** all affected touch-held native keys are released and the stick returns to its centre
- **AND** an offline, connecting or disconnected player cannot send touch gameplay input
- **AND** desktop mouse/keyboard, occupied-slot refusal and reconnect continue working
