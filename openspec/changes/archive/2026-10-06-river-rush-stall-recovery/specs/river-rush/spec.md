## ADDED Requirements

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
