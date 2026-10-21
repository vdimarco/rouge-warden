## ADDED Requirements

### Requirement: Sidewalks carry street furniture
A city sidewalk along a street SHALL show bins, bollards, and hydrants in the comic shade. A spot SHALL show one of those kinds. Parks, carriageways, the Needle plaza, and the Dome SHALL stay clear of them.

#### Scenario: Street shot
- **WHEN** the named `street` camera draws one frame with the comic art loaded
- **THEN** the near sidewalk shows at least one bin, bollard, or hydrant, and the frame is not a flat wash

### Requirement: Distant furniture does not speckle
A curb prop farther than about 110 m from the camera SHALL not draw. A lamp pole SHALL still shrink on its own distance, and a curb prop SHALL not use that shrink.

#### Scenario: The near block only
- **WHEN** the named `street` camera looks down the avenue
- **THEN** furniture is visible on the near sidewalk and does not fill the far skyline with specks

### Requirement: Other cel meshes stay on the stock bands
The stock `toonify` colour SHALL stay as it was.

#### Scenario: The lit sphere is unchanged
- **WHEN** the city render check shades its lit sphere
- **THEN** that sphere still matches the stock cel colours
