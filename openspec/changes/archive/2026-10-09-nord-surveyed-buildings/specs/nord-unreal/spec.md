## ADDED Requirements

### Requirement: Surveyed starting-block buildings
The game SHALL use attributed municipal textured LOD2 models near 1334 Sherbrooke Est, preserving surveyed roof shapes and roof photo UVs, with illustrated façade patterns explicitly identified as estimated: flat brick colour bands, dark window outlines, cream trim and blue glass.

#### Scenario: Explore the starting block
- **WHEN** a player walks around the starting block in a 1280 by 720 or larger desktop window
- **THEN** municipal building geometry replaces overlapping procedural blocks and have working exterior collision
- **AND** F2 continues to switch the global comic post-process independently of geometry, while the illustrated façade artwork remains
- **AND** map provenance identifies the survey year and simplified terrain

#### Scenario: Read the illustrated street
- **WHEN** the comic filter is enabled in a 1280 by 720 or larger desktop view
- **THEN** road surfaces and façades remain visible rather than filling with solid ink
- **AND** dark window borders, cream trim and blue glass remain readable against terracotta brick bands

#### Scenario: Preserve driving
- **WHEN** a player drives from the starting road over a decorative marking or the tested curb
- **THEN** existing entry, exit and obstacle traversal still work
