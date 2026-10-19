## ADDED Requirements

### Requirement: Responsive streamed controls
The player SHALL deliver driving input without avoidable application buffering and minimize demonstrated streaming delay while retaining supported connection recovery and intentional controls.

#### Scenario: Diagnose delayed driving
- **WHEN** a player reports delayed steering or braking
- **THEN** verification distinguishes native frame supply, transport/protocol round-trip time, browser jitter buffering and decoding
- **AND** local measurements do not claim physical-device, off-LAN or input-to-display acceptance

#### Scenario: Deliver a stream correction
- **WHEN** the verified stream correction is deployed
- **THEN** the relevant measured delay improves under a comparable workload and the player still receives advancing video, responsive input/release and reconnect behavior
- **AND** existing visual settings, maps, characters, latest saved progress and relay identities remain preserved unless an explicit user-approved tradeoff changes that scope

### Requirement: Aligned frame-rate ceilings
The browser host SHALL set both native rendering and WebRTC frame-rate ceilings to 60 FPS without changing the production visual settings. A ceiling SHALL NOT be reported as guaranteed delivered performance.

#### Scenario: One active viewer
- **GIVEN** the unviewed native player has suspended world rendering
- **WHEN** one viewer receives the game on a host with available GPU capacity
- **THEN** the renderer and encoder allow frames above the former 30 FPS ceiling
- **AND** verification records decoded frame rate and receiver buffering separately

#### Scenario: Two active viewers
- **WHEN** both native players render for connected viewers
- **THEN** verification compares their actual throughput with the retained shared-view baseline
- **AND** any remaining GPU limit is reported without promising 60 FPS or reducing visual quality
