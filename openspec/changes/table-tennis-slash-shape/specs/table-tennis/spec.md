## ADDED Requirements

### Requirement: A swing mark is one arc in CSS pixels
The slash SHALL be drawn after the bat and SHALL start at the bat face. It SHALL fade over 250 ms and SHALL be gone after that. Widths SHALL be CSS pixels, so a 2560-wide court drawn at 0.75 scale shows the same stroke width as a 1280 court. A push SHALL be a 2 px arc in ink `#2B2A33`, about 1.5 bat widths long. A drive SHALL be one arc that leaves the bat face and sweeps about 2 bat widths along the swing direction, 4 px wide, in ochre `#C98B3C`, tapering and fading toward the tail. A smash SHALL be that drive arc at 6 px in ember `#B5472E`. Smash sparks SHALL be drawn on top of the slash. `__test.lastSlash` SHALL be the latest slash.

#### Scenario: A push on a phone and on a desktop
- WHEN the player hits a push and about 30 ms have passed
- THEN a 2 px ink arc starts at the bat face and runs about 1.5 bat widths
- AND the mark is drawn above the bat
- AND the same mark is still fading inside 250 ms and is gone after 250 ms

#### Scenario: A drive leaves the face
- WHEN the player hits a drive and about 30 ms have passed
- THEN one ochre arc, 4 px at the bat, leaves the bat face and sweeps about 2 bat widths along the swing
- AND the tail is thinner and fainter than the head
- AND the mark is not a zigzag inside the bat face

#### Scenario: A smash keeps its sparks
- WHEN the player hits a smash and about 30 ms have passed
- THEN the drive arc is drawn 6 px wide in ember `#B5472E`
- AND the sparks are drawn on top of that arc

#### Scenario: A wide court uses the same CSS width
- WHEN the canvas CSS width is 2560 and the backing store is drawn at 0.75 scale
- THEN a smash stroke is still 6 CSS pixels wide
- AND `__test.lastSlash.kind` names the shot just hit
