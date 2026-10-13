## ADDED Requirements

### Requirement: Tall phone frame follows the running game
The browser player SHALL ask the game for a frame shaped like the phone only when the running game build says it supports that frame, and SHALL lay out the picture and controls for the frame it actually receives. The page SHALL NOT depend on a build-time flag for this.

#### Scenario: Phone held upright on a game that supports tall frames
- **WHEN** a player on a phone held upright (for example 390×844 or 412×915 CSS pixels) taps Play on a game build that sends the frame message
- **THEN** within 3 seconds the game picture fills the play area from top to bottom with no black band, and the HUD uses its tall layout
- **AND** the sticks and the button row sit in the bottom 40% of the screen, as `mobile.test.mjs` checks
- **AND** in the no-host browser test, after the tall frame arrives, the input converter's player size equals the video box, and a look-pad drag of dx, dy sends normalized deltas within 5% of dx ÷ (half the box width) and dy ÷ (half the box height).

#### Scenario: Phone held upright on an older game build
- **WHEN** the running game build does not send the frame message
- **THEN** the page asks for no other size, the game keeps 1280×720, and the phone shows the full wide picture at the top with the controls below it, as before.

#### Scenario: Phone turned sideways
- **WHEN** a player turns a phone with a 19.5:9 screen sideways on a game that sends the frame message
- **THEN** the game sends a frame of about the phone's shape and the picture is not stretched (circles in the HUD map stay round)
- **AND** a rotation in either direction sends at most one size request after the screen settles
- **AND** on a game that does not send the message, landscape fullscreen keeps filling the screen edge to edge, as before.

#### Scenario: The game ignores a size request
- **WHEN** the page asked for a size and the received frame still has the old aspect after 5 seconds
- **THEN** the page keeps the layout for the frame it receives, marks the request as ignored for QA, and does not repeat the same request.

#### Scenario: The next visitor after a phone
- **WHEN** a phone player leaves a slot that was streaming a tall frame and a desktop player then connects to that slot
- **THEN** the desktop player receives a 1280×720 frame.

#### Scenario: Oversized size request
- **WHEN** any browser asks a slot for a frame larger than 921,600 pixels, an odd size or a side shorter than 360 pixels
- **THEN** the game limits the frame to at most 921,600 pixels, even dimensions and at least 360 pixels on the short side, as a native automation test checks
- **AND** on the host, flat (`Resolution.Width`) and nested (`{Resolution:{Width,Height}}`) 4096×4096 requests both leave the frame at or under 921,600 pixels.

### Requirement: Idle player slot frees the GPU
When the host launcher passes the idle flag, a game process with no connected browser SHALL stop drawing the 3D world after a grace period, and SHALL draw it again as soon as a browser connects, without changing the game for the players who are connected. Each check compares the new package with the flag on against the same package with the flag off.

#### Scenario: One player in the session
- **WHEN** only the NordHost slot has a browser, at least 90 seconds after the game started and at least 30 seconds plus one poll interval after NordFriend1 lost its last browser
- **THEN** the NordFriend1 process logs `NORD_STREAM_IDLE state=sleep`, and its GPU use in `nvidia-smi pmon` is at most 5% SM and at least 70% below its awake value
- **AND** the connected player's decoded frame rate over 60 seconds is at least the flag-off rate minus 1 FPS.

#### Scenario: A friend joins the sleeping slot
- **WHEN** a browser connects to a sleeping slot and the player taps Play
- **THEN** the slot logs `NORD_STREAM_IDLE state=wake`, the live world appears within 2 seconds of that log line (a first frame that already shows the world counts as 0 seconds), and movement, look and actions work at once.

#### Scenario: The host slot has no viewer while the friend plays
- **WHEN** NordHost has no browser for more than 90 seconds and a player drives and walks in the NordFriend1 slot
- **THEN** the host's `NORD_STREAM_FPS` rate is at least the flag-off rate minus 2 FPS
- **AND** the friend-only mode of `live.test.mjs` (`NORD_LIVE_SLOTS=NordFriend1`, which never connects to NordHost) passes its walking and driving checks, and the host log has no warnings or errors that the flag-off run does not have.

#### Scenario: Runs without the flag
- **WHEN** the game runs in the editor, in automation or smoke tests, in capture runs (`-NordCapture`) or as a native client without the idle flag
- **THEN** world drawing never stops.

### Requirement: Smooth phone stream over the relay
The stream SHALL start at a bitrate that a phone on mobile data through the relay can carry, and SHALL adapt up on faster connections without lowering desktop picture quality.

#### Scenario: Phone on mobile data through the relay
- **WHEN** a person plays on a physical phone on a mobile network through the TURN relay for 60 seconds with the `?stats=1` readout open
- **THEN** video starts without a gap longer than 1 second in the first 10 seconds
- **AND** over the 60 seconds the longest frame gap is at most 500 ms and the decoded frame rate stays within 3 FPS of the slot's `NORD_STREAM_FPS` log.

#### Scenario: Desktop on a direct connection
- **WHEN** a desktop browser with a direct (non-relay) connection plays for 60 seconds
- **THEN** the received video bitrate reaches at least 6 Mbps within 10 seconds.

### Requirement: Stream budget keeps the sky look
When the host launcher passes the stream budget flag, both game processes SHALL draw the day, night and weather from `nord-sky-water` with fewer lights and rain streaks, keeping the look the user asked for.

#### Scenario: Night rain on the stream
- **WHEN** both slots run pinned to 22:00 and rain, standing at the spawn with no input, once with and once without the budget flag
- **THEN** with the flag, the street near the player is lit by lamps, rain streaks are visible and lit near lamps, and wet ground shines
- **AND** the median GPU frame time of each process over 900 profiled frames is lower with the flag than without
- **AND** paired streamed screenshots with and without the flag are recorded, and the user reviews the look.
