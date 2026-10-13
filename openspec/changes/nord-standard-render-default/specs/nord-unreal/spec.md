## MODIFIED Requirements

### Requirement: Comic-book look
The LaFontaine map SHALL start in the realistic render and SHALL offer an animated comic-book style on F2, with ink outlines, flat colour bands, halftone dots, hatching in deep shadow and offset print plates, without using characters, suits or logos from any film.

#### Scenario: See the comic look on foot
- **WHEN** a player presses F2 near 1334 Rue Sherbrooke Est in a 1280 by 720 or larger desktop window
- **THEN** building and tree silhouettes have dark ink outlines
- **AND** shaded areas show a regular halftone dot pattern
- **AND** distant objects show red and blue plates offset from each other

#### Scenario: Switch the look
- **WHEN** a player joins
- **THEN** that player sees the realistic render
- **AND** pressing F2 switches only that player's view to the comic look
- **AND** pressing F2 again returns that player to the realistic render

#### Scenario: Drive with the look
- **WHEN** the player enters the car
- **THEN** the car camera keeps the player's current look setting
