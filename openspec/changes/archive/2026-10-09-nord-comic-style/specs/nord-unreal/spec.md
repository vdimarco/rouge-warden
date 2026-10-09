## ADDED Requirements

### Requirement: Comic-book look
The LaFontaine map SHALL render in an animated comic-book style by default, with ink outlines, flat colour bands, halftone dots, hatching in deep shadow and offset print plates, without using characters, suits or logos from any film.

#### Scenario: See the comic look on foot
- **WHEN** a player spawns near 1334 Rue Sherbrooke Est in a 1280 by 720 or larger desktop window
- **THEN** building and tree silhouettes have dark ink outlines
- **AND** shaded areas show a regular halftone dot pattern
- **AND** distant objects show red and blue plates offset from each other

#### Scenario: Switch the look
- **WHEN** the player presses F2
- **THEN** the view returns to the realistic render for that player only
- **AND** pressing F2 again restores the comic look

#### Scenario: Drive with the look
- **WHEN** the player enters the car
- **THEN** the car camera keeps the player's current look setting

### Requirement: Animation on twos
The walking character SHALL update its pose 12 times a second while its movement and the camera update every frame.

#### Scenario: Watch the character run
- **WHEN** the comic look is on and the character runs
- **THEN** the body pose changes in held steps while the character glides smoothly across the ground
- **AND** turning the look off with F2 restores full-rate animation

### Requirement: Comic HUD
The HUD SHALL use comic caption boxes and show brief sound-word bursts for local jump, hard acceleration and handbrake actions, while keeping mission, map and control information.

#### Scenario: Read the HUD
- **WHEN** the player is on foot or in the car
- **THEN** the mission, the road map with attribution and the control hints remain readable in caption boxes

#### Scenario: Pull the handbrake
- **WHEN** the driver holds Space while moving
- **THEN** a sound-word burst appears briefly near the car
