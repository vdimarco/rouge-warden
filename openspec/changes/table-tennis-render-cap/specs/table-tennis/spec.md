## ADDED Requirements

### Requirement: Wide screens cap the canvas backing store
The canvas CSS size SHALL stay the layout size. The backing-store scale SHALL be `min(devicePixelRatio, 1920 / cssWidth)`, and SHALL also stay within the existing device-pixel cap of 2. The backing-store width SHALL be at most 1920 px. Pointer aim and hit tests SHALL stay in CSS pixels, so a capped scale does not move the bat or the contact.

#### Scenario: A 2560-wide court
- WHEN the canvas CSS width is 2560
- THEN the backing-store width is at most 1920
- AND the CSS width stays 2560
- AND pointer aim uses the CSS box

#### Scenario: A phone and a 1280 court
- WHEN the canvas CSS width is 390 or 1280 and the device pixel ratio is 1
- THEN the backing-store width matches the CSS width
- AND the picture and the pointer mapping match the uncapped view

#### Scenario: A wide court under CPU throttling
- WHEN the view is 2560 by 1440 with 4x CPU throttling and a rally is in play for 20 seconds
- THEN the average frame rate is at least 50
- AND the page reports no errors
