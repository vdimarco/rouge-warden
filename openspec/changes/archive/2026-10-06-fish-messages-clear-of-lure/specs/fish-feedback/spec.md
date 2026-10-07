## ADDED Requirements

### Requirement: Messages clear of the lure
In play, no message SHALL cover the lure on the water: the prompt and its sub, the cast report, the "Fish on!" banner, and a toast each SHALL keep at least 22 px from the lure's place on the screen. In the tall reel the cast report SHALL stand beside the gauge, and a toast SHALL wait while the report is up. In the wide reel the cast report SHALL stand at the top, opposite the gauge.

#### Scenario: A long cast in motion play
- **WHEN** a cast lands 15, 35 or 55 m out in motion play at 360x640, 390x844, 412x915 or 430x932, with the reel on either side
- **THEN** while the report is up and after it, no message is within 22 px of the lure, and the report is on the screen, clear of the gauge, the HUD and the prompt.

#### Scenario: Touch play on a wide screen
- **WHEN** a cast lands 15, 35 or 55 m out in touch play at 844x390 or 640x360
- **THEN** the report stands at the top right, and no message is within 22 px of the lure.

#### Scenario: Larger text
- **WHEN** a cast lands at 360x640 in motion play or at 844x390 in touch play with Larger text on
- **THEN** no message is within 22 px of the lure, and a long toast beside the gauge does not cover the prompt.
