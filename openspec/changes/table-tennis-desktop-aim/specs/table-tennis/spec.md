## ADDED Requirements

### Requirement: Desktop play is mouse only
The desktop court SHALL NOT swing or move the bat from the arrow keys, WASD, Space, or a click. One click on the gate SHALL start play and audio, hide the system cursor, and show a small aim dot at the pointer. The hint SHALL read "The bat follows the ball. Move the mouse to aim. Flick to swing."

#### Scenario: One click starts the rally
- WHEN a fine pointer clicks the gate
- THEN play starts without a motion prompt
- AND the canvas cursor is hidden
- AND a small aim dot is drawn at the pointer
- AND the hint is the aim line

#### Scenario: Keys and a click do not swing
- WHEN the ball is coming in and the player presses an arrow key, WASD, Space, or clicks
- THEN no shot is played

### Requirement: The bat tracks the ball and the cursor aims
While the ball is coming in, the bat SHALL ease sideways onto the ball on its own. The cursor's x SHALL aim the shot from -30 degrees to 30 degrees. The cursor's y SHALL set the bat's depth, with the top of the court toward the net.

#### Scenario: The cursor does not drag the bat
- WHEN the ball is coming in near the middle and the cursor moves to the side
- THEN the bat stays near the ball
- AND the aim is past 15 degrees toward that side

### Requirement: A normalised flick picks the shot
A flick SHALL be pointer speed over 60 ms, using coalesced pointermove samples, in court-widths per second scaled to a 1280-wide court. Under 1500 SHALL NOT swing. 1500 through 3000 SHALL push at 6 m/s. Above 3000 through 5500 SHALL drive at 11 m/s. Above 5500 SHALL smash at 17 m/s when the ball is high enough, and drive otherwise. The same normalised speed SHALL pick the same shot at 1280 and at 2560. A swing SHALL cool down for 350 ms. Contact inside ±40 ms SHALL be perfect, and contact out to ±120 ms SHALL still hit. A flick within ±200 ms of the opening ball SHALL win the point.

#### Scenario: A slow move never swings
- WHEN the pointer moves at under 1500 on a 1280 court or the matching slower court-speed on a 2560 court
- THEN there is no swing

#### Scenario: The bands match at both widths
- WHEN the normalised speed is 1500, 3000, 3001, 5500, or 5501
- THEN the shot is a push, a push, a drive, a drive, or a smash on a high ball
- AND 5501 on a low ball stays a drive
- AND each of those speeds picks the same shot at 2560

#### Scenario: The opening flick wins
- WHEN a desktop player flicks as the opening ball arrives
- THEN the score becomes 1 to 0
- AND the count 3, 2, 1 happened before the serve
- AND the page reports no console errors

### Requirement: Flick bend sets spin
A flick that bends at least 20 degrees upward SHALL be topspin. A flick that bends at least 20 degrees downward SHALL be backspin. A flatter flick SHALL add no spin.

#### Scenario: Up and down
- WHEN a flick bends 20 degrees up, 10 degrees up, or 20 degrees down
- THEN the spin is topspin, none, or backspin

### Requirement: A browser without coarse touch is a desktop
A page with no coarse pointer and no touch points SHALL show the desktop gate, including when the pointer is none and DeviceMotionEvent exists. A coarse pointer or any touch points SHALL keep the phone gate. A trusted mouse move while that phone gate is still up SHALL switch it to the desktop copy. A touch-generated move SHALL NOT switch it.

#### Scenario: Headless pointer none
- WHEN the page loads at 1280 wide with pointer none, no touch points, and DeviceMotionEvent
- THEN the gate button reads "Click to pick up your bat"
- AND the phone lines are hidden
- AND the desktop hint is visible

#### Scenario: A mouse move after the phone gate
- WHEN the phone gate is showing and a real mouse moves
- THEN the gate button reads "Click to pick up your bat"
- AND the desktop hint is visible
- AND the phone lines are hidden

### Requirement: The phone gate stays
A coarse phone SHALL keep the tilt gate and the phone instructions. The desktop hint SHALL stay hidden there.

#### Scenario: Portrait gate
- WHEN the page loads at 390 wide with a coarse pointer
- THEN the gate button reads "Tap to pick up your bat"
- AND the phone instructions are visible
