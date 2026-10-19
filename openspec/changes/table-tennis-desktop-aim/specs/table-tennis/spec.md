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
A flick SHALL be pointer speed over 60 ms, using coalesced pointermove samples, in window widths per second. Under 1.2 SHALL NOT swing. 1.2 through 2.3 SHALL push at 6 m/s. Above 2.3 through 4.3 SHALL drive at 11 m/s. Above 4.3 SHALL smash at 17 m/s, high or low. The same speed in window widths per second SHALL pick the same shot at 1280 and at 2560. A swing SHALL cool down for 350 ms. Contact inside ±40 ms SHALL be perfect, with no aim pull. Contact out to ±120 ms SHALL still hit, pulling about 6 degrees at 58 ms and 25 degrees at the window edge, and that hit SHALL stay in play. On the phone, a swing SHALL count only above 300 deg/s rotation rate. On the desktop, a swing SHALL count only at 1.2 window widths per second or faster. A flick that counts, within ±200 ms of the opening ball, SHALL win the point. A speed of 0, or any slower input on that path, SHALL NOT win point 1. A miss SHALL lose that point or replay it.

#### Scenario: A slow move never swings
- WHEN the pointer moves at 0.5, 1.0, or 1.19 window widths per second
- THEN there is no swing at 1280 or at 2560
- AND 1.2 window widths per second does swing

#### Scenario: The bands match at both widths
- WHEN the speed is 1.2, 2.3, 2.4, 4.3, or 4.4 window widths per second
- THEN the shot is a push, a push, a drive, a drive, or a smash
- AND 4.4 on a low ball is a smash
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

### Requirement: Flick curve sets spin
Spin SHALL compare the stroke direction in the first 50 ms with the direction in the last 50 ms before peak speed. A bend of 20 degrees or more upward SHALL be topspin. The same bend downward SHALL be backspin. A straight diagonal flick of 20 degrees or more SHALL also count, upward as topspin and downward as backspin. A flatter bend and a flatter diagonal SHALL add no spin.

#### Scenario: A bend and a straight diagonal
- WHEN a flick's heading changes by 20 degrees up, 10 degrees up, or 20 degrees down, and separate straight flicks point 20 degrees up, 10 degrees up, and 20 degrees down
- THEN the spin is topspin, none, backspin, topspin, none, and backspin

### Requirement: Ink clears and stays light
A table splat SHALL fade to 0 across the next point and then be cleared. It SHALL NOT return to full opacity when the next countdown starts or when another mark is added. Overlapping splats SHALL stay under 25% opacity together, and marks SHALL be kept rather than wiped to reduce that overlap. The ink slash for a push, a drive, and a smash SHALL be drawn after the bat at the same stroke size as before. `__test.lastSlash` SHALL be the latest slash, and `__test.splatCount` SHALL be how many splat marks are still on the table.

#### Scenario: Fade across the next point
- WHEN a point ends and the next point is played
- THEN the splat fades toward 0 through that point and does not jump back to full
- AND once it reaches 0 the ink is clear

#### Scenario: Two marks overlap
- WHEN two splats cover the same pixel
- THEN that pixel is under 25% opaque

#### Scenario: Slash over the bat
- WHEN the player hits a push, a drive, or a smash
- THEN the slash is visible over the bat
- AND the stroke is the same size as before the draw-order change
- AND `__test.lastSlash.kind` names that shot
- AND `__test.splatCount` is 0 once the ink has cleared

### Requirement: A swing inside the window connects
Any swing inside the ±120 ms window SHALL connect. A miss for reach inside that window is a bug. Desktop auto-track SHALL keep the bat within the 0.22 m side reach of the incoming ball.

#### Scenario: Early and wide still meet
- WHEN the swing is 9 ms early with the ball 0.20 m aside, and again 9 ms early with the ball 0.23 m aside, and again at 120 ms early
- THEN each swing connects
- AND auto-track stays inside the side reach when the ball jumps sideways

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
