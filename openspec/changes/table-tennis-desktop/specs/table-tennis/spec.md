## ADDED Requirements

### Requirement: Desktop gate without a motion prompt
A fine pointer SHALL select desktop play. A coarse touch phone SHALL keep the tilt gate, including when the motion API is missing. On the desktop court the gate button SHALL read "Click to pick up your bat", a one-line hint SHALL be shown, and the tap SHALL NOT call motion or orientation permission. The phone button SHALL keep reading "Tap to pick up your bat".

#### Scenario: Click to start on a desktop
- WHEN the page loads with a fine pointer
- THEN the gate button reads "Click to pick up your bat"
- AND a one-line hint is visible
- AND starting play does not call motion permission

#### Scenario: Phone gate stays
- WHEN the page loads with a coarse pointer
- THEN the gate button reads "Tap to pick up your bat"
- AND the phone instructions are visible
- AND the desktop hint is hidden

### Requirement: Mouse and keys use the phone swing
The pointer on the canvas SHALL drive bat x and depth through the same bat spring as tilt. A pointer flick measured over about 60 ms SHALL map onto the same shot bands and the same contact window as a phone swing. A click SHALL play a medium drive. Arrow keys or WASD SHALL move the bat, and Space SHALL swing. The 3-2-1 count-in SHALL still run before the serve.

#### Scenario: The spring follows the pointer
- WHEN the pointer steps from the centre to the side
- THEN one frame leaves the bat short of that side
- AND the spring has covered most of the step by about 80 ms

#### Scenario: A flick wins the opening point
- WHEN a desktop player flicks the mouse as the opening ball arrives
- THEN the score becomes 1 to 0
- AND the count 3, 2, 1 happened before the serve

### Requirement: Landscape shows the room
On a canvas wider than the hall sheet, the backdrop SHALL fit by height using the same vertical window as the portrait cover, so the windows, lamp and wall sit behind the Neighbour and the far ball path is on the wall rather than the floor. The side gaps SHALL be filled from colours sampled at the sheet's edges, with a soft mirrored edge at the seam. A portrait canvas SHALL keep the cover fit.

#### Scenario: Wide court
- WHEN the view is 1280 by 800
- THEN the sheet is fit by height and does not cover the width
- AND the source behind the far end of the table is above the floor of the sheet
- AND a 390 by 844 view still cover-fits
