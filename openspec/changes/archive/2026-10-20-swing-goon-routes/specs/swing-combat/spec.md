## ADDED Requirements

### Requirement: Goons go round buildings
A goon on the street who chases the hero, or walks back to his post, SHALL go round a building that stands between them, by the
streets, and SHALL never stop at its wall. A post or a bench on his way SHALL NOT stop him. A goon on a roof SHALL walk straight
to the hero as before.

#### Scenario: Round a block corner
- **WHEN** a goon who has seen the hero stands on one street's sidewalk, and the hero stands on the sidewalk of the crossing
  street, with the corner building between them
- **THEN** the goon walks out to the crossing, turns the corner, walks up and punches within 12 s
- **AND** at no time does he stand inside a wall

#### Scenario: Past a post
- **WHEN** a post stands 3 m in front of a chasing goon, on his line to the hero
- **THEN** he steps round it and reaches the hero within 6 s
