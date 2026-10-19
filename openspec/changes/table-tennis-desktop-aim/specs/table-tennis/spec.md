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

### Requirement: A flick is window widths per second
A flick SHALL be pointer speed over 60 ms, using coalesced pointermove samples, in window widths per second. Under 1.2 SHALL NOT swing. 1.2 through 2.3 SHALL push at 6 m/s. Above 2.3 through 4.3 SHALL drive at 11 m/s. Above 4.3 SHALL smash at 17 m/s when the ball is high enough, and drive otherwise. The same speed in window widths per second SHALL pick the same shot at 1280 and at 2560. A swing SHALL cool down for 350 ms. Contact inside ±40 ms SHALL be perfect, and contact out to ±120 ms SHALL still hit. On the phone, a swing SHALL count only above 300 deg/s rotation rate. On the desktop, a swing SHALL count only at 1.2 window widths per second or faster. A flick that counts, within ±200 ms of the opening ball, SHALL win the point. A speed of 0, or any slower input on that path, SHALL NOT win point 1. A miss SHALL lose that point or replay it.

#### Scenario: A slow move never swings
- WHEN the pointer moves at under 1.2 window widths per second
- THEN there is no swing at 1280 or at 2560

#### Scenario: The bands match at both widths
- WHEN the speed is 1.2, 2.3, 2.4, 4.3, or 4.4 window widths per second
- THEN the shot is a push, a push, a drive, a drive, or a smash on a high ball
- AND 4.4 on a low ball stays a drive
- AND each of those speeds picks the same shot at 1280 and at 2560

#### Scenario: The opening flick wins
- WHEN a desktop player flicks as the opening ball arrives
- THEN the score becomes 1 to 0
- AND the count 3, 2, 1 happened before the serve
- AND the page reports no console errors

#### Scenario: A speed-0 miss does not take the hook
- WHEN the opening feed is missed 383 ms early with no flick
- THEN the score does not become 1 to 0
- AND a flick of at least 1.2 window widths per second inside ±200 ms still wins that point

### Requirement: Flick bend sets spin
A flick that bends at least 20 degrees upward SHALL be topspin. A flick that bends at least 20 degrees downward SHALL be backspin. A flatter flick SHALL add no spin.

#### Scenario: Up and down
- WHEN a flick bends 20 degrees up, 10 degrees up, or 20 degrees down
- THEN the spin is topspin, none, or backspin

### Requirement: A browser without coarse touch is a desktop
A fine pointer SHALL select mouse mode, including when the browser also reports touch points. A page with no coarse pointer and no touch points SHALL show the desktop gate, including when the pointer is none and DeviceMotionEvent exists. A coarse pointer, or touch with no fine pointer, SHALL keep the phone gate. The first trusted mouse move SHALL switch a phone gate to mouse mode. A touch-generated move SHALL NOT switch it. After the gate click at 1280, the test state SHALL report inputMode mouse.

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

#### Scenario: Fine pointer after start
- WHEN a fine pointer starts the game at 1280
- THEN the test state reports inputMode mouse

### Requirement: The phone gate stays
A coarse phone SHALL keep the tilt gate and the phone instructions. The desktop hint SHALL stay hidden there.

#### Scenario: Portrait gate
- WHEN the page loads at 390 wide with a coarse pointer
- THEN the gate button reads "Tap to pick up your bat"
- AND the phone instructions are visible
