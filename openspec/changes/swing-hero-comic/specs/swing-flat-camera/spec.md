## ADDED Requirements

### Requirement: Third person is the default on a flat screen
After the opening, a flat screen SHALL show the hero from behind and above. At rest the camera SHALL sit 4.5 m from the pivot (the chest plus 0.25 m), 1.2 m above the pivot, and look down at it by about 15 degrees. The hero SHALL stand near the middle of the view. The first-person crosshair SHALL be hidden in this view.

#### Scenario: Desktop, 960x540
- **WHEN** the player presses PLAY ON THIS SCREEN in a 960x540 window and the opening ends
- **THEN** the camera pulls out from the hero's eyes to the chase position in about half a second
- **AND** the hero in the red jersey stands near the middle of the view, seen from behind
- **AND** the crosshair of the first-person view is hidden

#### Scenario: Phone landscape, 844x390
- **WHEN** the player presses PLAY ON PHONE on a phone held in landscape
- **THEN** the opening is skipped and play starts on the start roof
- **AND** within 1.5 s the camera is 4.5 m behind the hero and looks down at the hero by about 15 degrees
- **AND** the hero and the camera face the same way

#### Scenario: Phone portrait, 390x844
- **WHEN** the player presses PLAY ON PHONE on a phone held upright
- **THEN** the same chase view shows, with the hero near the middle and the rope button inside the window
- **AND** the page does not scroll

### Requirement: The look input turns the camera
The look input SHALL turn the camera around the hero. A mouse SHALL turn the view 0.0022 radians per pixel. In third person the pitch SHALL stop at 60 degrees below and 70 degrees above the horizon. In first person it SHALL stop at 85 degrees either way.

#### Scenario: Move the mouse
- **WHEN** the player moves the locked mouse 200 pixels left and 100 pixels up
- **THEN** the view turns left by 0.44 radians and tilts up by 0.22 radians
- **AND** the camera looks along that yaw and pitch

#### Scenario: Look past the limit
- **WHEN** the player keeps pushing the view up, and then keeps pushing it down
- **THEN** the pitch stops at +70 degrees and then at -60 degrees

### Requirement: Moves follow the camera
On the ground, W SHALL move the hero the way the camera looks, and D SHALL move the hero to the camera's right. The hero SHALL turn to face the way it moves.

#### Scenario: Run forward
- **WHEN** the player holds W on a roof
- **THEN** the hero runs the way the camera looks
- **AND** the hero's body turns to face that way

### Requirement: The camera never shows the inside of a building
The camera SHALL stay outside every building and at least 0.35 m above the street. When a wall is behind the hero, the camera SHALL come in at once. When the wall is gone, it SHALL let out again within about a second. When the camera is closer than 1.5 m to the hero, the hero SHALL fade out in dots. It SHALL be gone at 0.8 m.

#### Scenario: Wall behind the hero
- **WHEN** the hero stands on a lower roof 1.2 m from the wall of the tier above, and the camera looks at the wall
- **THEN** the camera moves in so that it stays in front of the wall
- **AND** the hero fades out in dots when the camera is closer than 1.5 m
- **WHEN** the hero walks away from the wall
- **THEN** the camera lets out to 4.5 m again and the hero is solid

#### Scenario: Look up from a low spot
- **WHEN** the player looks up so that the camera would go below the street, or into a tower
- **THEN** the camera stops above the street and outside the tower

### Requirement: The view follows your swing
While a rope holds the hero, the view SHALL turn toward the travel direction. This SHALL happen only when the speed is above 6 m/s, the horizontal speed is above 3 m/s, and the player has not moved the view for 1.5 s. The time constant SHALL be about 1.2 s. With no rope, or below 6 m/s, the view SHALL not turn by itself.

#### Scenario: Swing past a tower
- **WHEN** the player swings at 20 m/s and does not touch the look input
- **THEN** the view turns toward the travel direction
- **AND** about 63 percent of the turn happens in 1.2 s

#### Scenario: Look while swinging
- **WHEN** the player turns the view during a swing
- **THEN** the view stays where the player put it for 1.5 s before it follows again

### Requirement: The view widens with speed
The field of view SHALL be 70 degrees at rest in third person and SHALL widen to 88 degrees at 35 m/s. The widening SHALL start at 15 m/s and ease in. The arm SHALL let out from 4.5 m to 5.6 m over the same speed range.

#### Scenario: Fall from a tower
- **WHEN** the hero falls or swings at 32 m/s
- **THEN** the field of view is above 84 degrees and the camera is further from the hero than at rest

### Requirement: V switches between third and first person
V SHALL switch between third person and first person. The camera SHALL move between the two views in about half a second. In first person the camera SHALL sit at the hero's eyes and the hero SHALL be hidden. A held V SHALL toggle once. V SHALL be ignored in a text field and with Ctrl, Meta or Alt held.

#### Scenario: Press V on a desktop
- **WHEN** the player presses V
- **THEN** the camera moves to the hero's eyes and the hero hides
- **AND** the plunger ropes start at the launchers, low and to the right in the view
- **WHEN** the player presses V again
- **THEN** the camera returns to 4.5 m behind the hero and the hero shows

#### Scenario: Hold V
- **WHEN** the player holds V so that the key repeats
- **THEN** the view switches once

### Requirement: The hero moves like a person
The hero SHALL show a pose that matches the state of the body: idle, run, jump, fall, swing, yank and land. In a swing the arm on the rope SHALL reach along the rope to the anchor.

#### Scenario: Swing on one rope
- **WHEN** a rope holds the hero in the air
- **THEN** the pose is swing and the hand of the rope arm is above its idle height
- **AND** the arm points along the rope to the anchor

#### Scenario: Swing on two ropes
- **WHEN** both ropes hold the hero
- **THEN** both arms reach along their ropes

#### Scenario: Yank
- **WHEN** the player yanks a rope
- **THEN** the rope arm snaps back for a moment

#### Scenario: Fall and land
- **WHEN** the hero falls fast
- **THEN** the arms go out and up and the legs kick
- **WHEN** the hero lands at more than 3 m/s
- **THEN** the hero crouches for a moment and then stands

### Requirement: Ropes start in the hero's hands
In third person a rope SHALL start at the hero's hand, within 2 cm. In first person it SHALL start at the launcher in the view.

#### Scenario: Fire in third person
- **WHEN** the player fires the right rope in third person
- **THEN** the rope starts at the hero's right hand, and not at the launcher of the first-person view

### Requirement: The opening stays in first person
The opening SHALL stay in first person on a flat screen. When play starts, the camera SHALL pull out to the chase view.

#### Scenario: Flat opening
- **WHEN** the opening plays in a flat window
- **THEN** the camera sits at the head, the hero is hidden and the view is the one the opening was made for
- **WHEN** the opening ends
- **THEN** the camera pulls out and tips down to the chase view, and the hero shows

### Requirement: The headset does not change
In a VR or AR session the camera SHALL stay a child of the rig and the hero SHALL stay hidden. The comfort settings, the input and the physics SHALL not change.

#### Scenario: Quest VR
- **WHEN** the player enters VR on a Quest
- **THEN** the player sees no hero and the view follows the head, as before
- **AND** the flat camera does not move the view

### Requirement: A hero always shows
If the model file does not load or does not fit, a figure built in code SHALL take its place. It SHALL use the same bones, the same poses and the same rope hands.

#### Scenario: Model file missing
- **WHEN** `/wild/models/crew5.glb` fails to load
- **THEN** a red-jersey figure built in code stands in the view
- **AND** it swings, holds the rope in its hand and fits the draw budget

### Requirement: The hero costs little
The hero and its outline SHALL cost at most 4 draw calls and 26,000 triangles. The whole frame SHALL stay within 120 draw calls and 800,000 triangles.

#### Scenario: Count the draws
- **WHEN** the frame is drawn with the hero and then without it
- **THEN** the hero adds 4 draw calls or fewer and 26,000 triangles or fewer
- **AND** the frame has 120 draw calls or fewer

### Requirement: Leave and return
Exit from the pause menu SHALL give the camera back to the rig and hide the hero. Playing again SHALL restore the chase view.

#### Scenario: Exit and play again
- **WHEN** the player chooses Exit and then PLAY ON THIS SCREEN
- **THEN** the title shows with no hero, and the new session starts in the chase view

### Requirement: The hero holds a wall
When the player holds a wall in flat play (the climbing of `full-swing-phone-and-climbing`), the hero SHALL face the wall and reach for it with both hands, in the pose "cling". It SHALL keep facing the wall while it climbs up, down or along it. It SHALL show no air or fall pose on the wall, and climbing down to a roof or the street SHALL not play the hard-landing crouch.

#### Scenario: Fly into a wall
- **WHEN** the player flies into a wall in the chase view
- **THEN** the hero holds it in the pose "cling", facing the wall within 0.2 rad, with no air pose

#### Scenario: Climb up and along
- **WHEN** the player holds W for 0.5 s and then D for 0.5 s on the wall
- **THEN** the hero stays in the pose "cling" and keeps facing the wall
