## MODIFIED Requirements

### Requirement: Third person is the default on a flat screen
After the opening, a flat screen SHALL show the hero from behind and above. At rest the camera SHALL sit 4.5 m from the pivot (the chest plus 0.25 m), 1.2 m above the pivot, and look down at it by about 15 degrees. The hero SHALL stand near the middle of the view. The first-person crosshair SHALL be hidden in this view.

#### Scenario: Desktop, 960x540
- **WHEN** the player presses PLAY ON THIS SCREEN in a 960x540 window and the opening ends
- **THEN** the camera pulls out from the hero's eyes to the chase position in about half a second
- **AND** the hero in the red jersey stands near the middle of the view, seen from behind
- **AND** the crosshair of the first-person view is hidden

#### Scenario: Phone landscape, 844x390
- **WHEN** the player presses PLAY WITH TOUCH on a phone held in landscape
- **THEN** the opening is skipped and play starts on the start roof
- **AND** within 1.5 s the camera is 4.5 m behind the hero and looks down at the hero by about 15 degrees
- **AND** the hero and the camera face the same way

#### Scenario: Phone portrait, 390x844
- **WHEN** the player presses PLAY WITH TOUCH on a phone held upright
- **THEN** the same chase view shows, with the hero near the middle and the rope button inside the window
- **AND** the page does not scroll

#### Scenario: A touch laptop with the mouse chosen
- **WHEN** the player presses PLAY WITH MOUSE AND KEYBOARD on a touch device with a fine pointer
- **THEN** the opening plays and the view is the same as on a computer

### Requirement: V switches between third and first person
V on a keyboard, Y on a game pad and the VIEW button on a phone SHALL switch between third person and first person. The camera SHALL move between the two views in about half a second. In first person the camera SHALL sit at the hero's eyes and the hero SHALL be hidden. A held V SHALL toggle once. Two sources that fall in one frame SHALL toggle once. V SHALL be ignored in a text field and with Ctrl, Meta or Alt held.

#### Scenario: Press V on a desktop
- **WHEN** the player presses V
- **THEN** the camera moves to the hero's eyes and the hero hides
- **AND** the plunger ropes start at the launchers, low and to the right in the view
- **WHEN** the player presses V again
- **THEN** the camera returns to 4.5 m behind the hero and the hero shows

#### Scenario: Hold V
- **WHEN** the player holds V so that the key repeats
- **THEN** the view switches once

#### Scenario: Press Y on a pad
- **WHEN** the player presses Y
- **THEN** the view switches once, and a held Y does not switch it again

#### Scenario: Press VIEW on a phone
- **WHEN** the player presses the VIEW button
- **THEN** the view switches once

#### Scenario: Two sources at once
- **WHEN** `input.viewDown` and the V key arrive in the same frame
- **THEN** the view switches once

## ADDED Requirements

### Requirement: The view lifts while you swing
The camera pitch SHALL ease up toward +8 degrees (0.14 rad) when three things are true. First, a rope is flying or attached, or the body is in the air faster than 6 m/s. Second, the player has not moved the look input for 0.7 s. Third, a clog or a pipe is not the target and none lies within 35 degrees of the camera forward and within range. The lift SHALL only raise the pitch. It SHALL NOT lower the pitch, and it SHALL NOT restart the timer of the follow turn. It SHALL NOT run on a phone, where the phone follow already does it, nor in first person.

#### Scenario: Swing with no look input
- **WHEN** a rope holds the hero, the pitch starts at -15.5 degrees, no clog is near the view, and the player does not touch the look input for 1.5 s
- **THEN** the pitch is at least +0.12 rad

#### Scenario: Never lowers
- **WHEN** the pitch is +30 degrees and a rope holds the hero
- **THEN** the pitch stays at +30 degrees

#### Scenario: The player looks
- **WHEN** the player moves the look input during the swing
- **THEN** the lift pauses for 0.7 s and the view goes where the player puts it

#### Scenario: The follow turn still runs
- **WHEN** the lift has reached its pitch and the player does not touch the look input for 1.5 s while swinging at 20 m/s
- **THEN** the view turns toward the travel direction, as the follow requirement says

#### Scenario: A clog in view
- **WHEN** a clog sits 20 m below the hero and in view, the view points at it, and the player swings 3 s with no look input
- **THEN** the target stays the clog and the pitch does not rise

### Requirement: The view turns toward a swing from a wall
When a real swing fires from a wall in third person and the target is off the screen or behind the camera, the camera yaw SHALL turn toward the swing over about 0.4 s, so that the target is in front of the camera. The turn SHALL NOT start the timer of the look hold. A swing from a wall in first person SHALL NOT turn the view.

#### Scenario: Swing off a wall
- **WHEN** the hero holds a wall in third person, the view points into the wall, and the player presses the swing input with a target behind the camera
- **THEN** within 0.5 s the camera yaw is within 20 degrees of the bearing of the target
- **AND** the marker is on the screen or shows an arrow on its border

#### Scenario: First person
- **WHEN** the hero holds a wall in first person and the player presses the swing input
- **THEN** the view does not turn by itself
