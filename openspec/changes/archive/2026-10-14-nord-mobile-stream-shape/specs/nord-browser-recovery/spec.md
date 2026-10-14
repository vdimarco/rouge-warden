## MODIFIED Requirements

### Requirement: Failed sessions stay recoverable
The player SHALL reject late media readiness/play events outside an active connection/play phase, release touch input and close the session when its control channel fails, and preserve an actionable error through disconnect notification.

#### Scenario: Late media after failure or leaving
- **WHEN** video initialization, autoplay rejection or playing arrives after an error or explicit disconnect
- **THEN** the page stays in its recovery state, controls stay disabled and Reconnect remains available.

#### Scenario: Controls fail during real play
- **WHEN** an active session reports a control-channel error
- **THEN** touch input is released, the SDK session closes and its slot becomes available; late media cannot hide the error.
- **WHEN** the player chooses Reconnect
- **THEN** a fresh real video stream and usable controls return.

#### Scenario: Occupied slot
- **WHEN** a subscription is refused because another browser owns a slot
- **THEN** its live signalling selector remains usable for another slot, without evicting the owner.

#### Scenario: Change players after a pending subscription
- **WHEN** the initial subscription is still pending
- **THEN** the selector waits for readiness or refusal before accepting another choice, so an older refusal cannot mask the newly selected stream; selection becomes available after that outcome.

#### Scenario: Reconnect closes the old socket
- **WHEN** Reconnect intentionally closes the previous socket before opening its replacement
- **THEN** that old disconnect does not replace the pending connection UI, and the fresh stream reaches Ready and Play normally.

#### Scenario: Leave after reconnecting a closed session
- **WHEN** a failed closed session reconnects and the player later chooses Disconnect
- **THEN** its receiving peers close, no delayed retry silently reopens the session, and another viewer can acquire the freed slot.
