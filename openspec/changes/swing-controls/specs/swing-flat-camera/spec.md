## MODIFIED Requirements

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
The camera pitch SHALL ease up toward +8 degrees (0.14 rad) when two things are true. First, a rope is flying or attached, or the body is in the air faster than 6 m/s. Second, the player has not moved the look input for 0.7 s. The lift SHALL only raise the pitch. It SHALL NOT lower the pitch, and it SHALL NOT restart the timer of the follow turn. It SHALL NOT run on a phone, where the phone follow already does it, nor in first person.

#### Scenario: Swing with no look input
- **WHEN** a rope holds the hero, the pitch starts at -15.5 degrees, and the player does not touch the look input for 1.5 s
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
