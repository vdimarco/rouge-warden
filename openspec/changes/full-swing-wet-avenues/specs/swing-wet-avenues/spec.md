## ADDED Requirements

### Requirement: Avenues mirror the sky
On a flat-screen street view, the asphalt SHALL darken in patches and pick up the sky colour toward the horizon. The sidewalk SHALL stay matte next to that road. Cream lane paint SHALL stay lighter than the wet asphalt around it. Ink lines along the kerb SHALL still read as dark lines.

#### Scenario: Street shot
- **WHEN** the named `street` camera draws one frame with the comic art loaded
- **THEN** the road shows a sky-tinted sheen that the sidewalk does not, and the picture is neither blank nor a flat wash

#### Scenario: Ink stays
- **WHEN** the named `canyon` camera draws
- **THEN** thin ink-coloured runs still mark building edges, and ink does not flood the frame

### Requirement: The expressway deck is the same wet asphalt
The expressway deck SHALL use the same wet term as the streets. Parks, the boardwalk, and a boulevard median SHALL not.

#### Scenario: Harbour shot
- **WHEN** the named `harbour` camera draws one frame
- **THEN** the frame still shows the skyline and the water, with no shader error
