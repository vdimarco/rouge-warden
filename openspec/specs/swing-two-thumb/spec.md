# swing-two-thumb Specification

## Purpose
In Full Swing on a phone, two-thumb play: each half of the screen throws its own plunger.

## Requirements

### Requirement: Each half of the screen throws its own plunger
On a phone, a tap on the left half of the city SHALL throw the left plunger and a tap on the right half SHALL throw the right one.
Each finger SHALL count as its own tap, so two fingers SHALL throw both plungers in the same frame. A tap SHALL aim through the
tapped point, as before. A tap on a side whose plunger is out SHALL move that plunger to the new building. A finger that moves more
than 12 px from where it went down SHALL look around and SHALL throw nothing.

#### Scenario: Left and right
- **WHEN** a phone player taps a building on the left half of the screen
- **THEN** the left plunger flies to that building and the right plunger does not change

#### Scenario: Two thumbs
- **WHEN** the player puts a thumb on each half of the screen at the same time and lifts both
- **THEN** both plungers fly in the same frame

#### Scenario: A drag beside a tap
- **WHEN** one finger drags to look while another finger taps the right half
- **THEN** the view turns and only the right plunger flies

### Requirement: Two thumbs work on a real phone
The city SHALL start no pinch, zoom or other browser gesture. A finger that the browser cancels within 0.5 s, before it moved
12 px, SHALL throw its plunger as a tap. A finger that rocks less than 12 px while the other thumb lands SHALL still tap and SHALL
not turn the view. A finger lifted anywhere on the page SHALL end its tap.

#### Scenario: The browser cancels the first thumb
- **WHEN** the player puts down the left thumb, then the right thumb, and the browser cancels both touches
- **THEN** both plungers fly

#### Scenario: Two thumbs pressed a moment apart
- **WHEN** the left thumb goes down, the right thumb goes down 30 ms later, and they lift 40 ms apart
- **THEN** both plungers fly and both hold their buildings

#### Scenario: A thumb that rocks
- **WHEN** a thumb moves 3 to 6 px while the other thumb lands, and both lift
- **THEN** both plungers fly and the view does not turn

### Requirement: No SWING button
The phone panel SHALL have no SWING button. A plunger badge (L, R) SHALL sit at each side of the screen. It SHALL take no taps and
SHALL light while its plunger holds. The badges SHALL hide while the climb pad shows. The lock-on ring SHALL keep clear of them.

#### Scenario: A badge lights
- **WHEN** the left plunger holds a building
- **THEN** the L badge is lit and the R badge is not

### Requirement: The swing hands over from one plunger to the other
When a phone plunger catches a building while the other plunger holds a building, the other plunger SHALL let go 0.12 s later with
no fling. Two plungers thrown within 0.3 s of each other SHALL hold together. Each plunger SHALL let go by itself past the bottom of
its arc; while the other one still holds, that let-go SHALL add no fling.

#### Scenario: A hand-off
- **WHEN** the right plunger holds a building and the player taps a building on the left half more than 0.3 s later
- **THEN** the left plunger catches, and the right plunger lets go within 0.2 s of that catch

#### Scenario: A double swing
- **WHEN** the player taps both halves together
- **THEN** both plungers hold their buildings at the same time

#### Scenario: A steady beat on alternate sides
- **WHEN** a player taps left, right, left every 0.5, 0.8 or 1.2 s from the start roof toward the gold ring
- **THEN** over 12 s the mean speed is at least 17 m/s, the hero covers at least 120 m, and spends at most 2.5 s under 8 m

### Requirement: The words say left and right
The touch note, How to play, the phone tutorial and the phone hint SHALL tell the player to tap left or right and to use both
thumbs, and SHALL NOT name a SWING button.

#### Scenario: The first tutorial line
- **WHEN** a phone player starts play
- **THEN** the first tutorial line is "Tap left or right to swing at the gold ring."
