## ADDED Requirements

### Requirement: Art keeps its frame
Each painted layer SHALL be drawn at 16:9, scaled to cover the map, and cropped with one shared focus on the three island centers. Layers and marks drawn over them SHALL stay registered. Resize and device pixel ratio SHALL use that same frame.

#### Scenario: A short phone strip
- **WHEN** the map is about 390 by 130 CSS pixels
- **THEN** the painting is not squashed, the three island centers stay in frame, and every layer uses the same crop

#### Scenario: Desktop and landscape
- **WHEN** the map is taller than 16:9
- **THEN** the crop still covers the canvas and keeps the island centers in view when the visible width allows

### Requirement: Sea and smog follow the century
Sea level SHALL fade and rise continuously from 1.0° to 3.0°. Smog SHALL fade continuously with pollution. A clean world SHALL read near clear. A dirty, hot world SHALL read fuller. Changes SHALL ease between turns, and SHALL snap when the player prefers reduced motion or opens with `fast=1`.

#### Scenario: Seed 123
- **WHEN** a fast run of seed 123 plays each turn
- **THEN** sea offset or smog alpha changes by a visible amount on every turn, and neither stays flat for the whole run

#### Scenario: Clean and dirty
- **WHEN** the same map is shown clean and then hot and polluted
- **THEN** the dirty map has a higher sea offset and a higher smog alpha

### Requirement: The ending is a paper panel
The end screen SHALL cover the play controls with an opaque paper panel (`#F3E9D6`) and ink text (`#2B2A33`). The map behind SHALL remain visible at about 85% opacity. Controls underneath SHALL not accept input. The panel SHALL not be black or grey.

#### Scenario: Finish at 390 wide
- **WHEN** seed 123 reaches 2100 on a 390 by 844 screen
- **THEN** the ending text sits on the paper panel, the map is dimmed behind it, and an Invest or Hold control cannot be hit
