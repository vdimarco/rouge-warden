## ADDED Requirements

### Requirement: Cast ripples have depth
The water SHALL show an expanding main ring with a weaker trailing ring while preserving the painted look and aim cues.

#### Scenario: Cast on desktop or phone
- **WHEN** a cast splashes into the lake in portrait or landscape
- **THEN** overlapping damped rings change the reflected light and fade within the existing ripple lifetime on both quality modes

### Requirement: City edges show fold light
The city SHALL show narrow sun-facing highlights and shade beside building edges without adding draw calls or changing swing targets.

#### Scenario: View Toronto
- **WHEN** the player looks along a street on desktop or phone
- **THEN** edge light shows depth while the comic ink and existing skyline remain visible
