## ADDED Requirements

### Requirement: A masonry wall keeps its clay
A near brick, stone or panel wall in the street view SHALL show neighbouring units in different colours, with a lighter crest and a darker bed on each course. Glass SHALL stay glass. The shop awning SHALL still cover the shop band. The city render check SHALL still pass.

#### Scenario: The street looks at a masonry wall
- **WHEN** the street camera frames the avenue
- **THEN** a near masonry face is not one flat tone, and the shop cloth still covers the shop windows

#### Scenario: The city render
- **WHEN** `qa/vr/render.mjs` runs
- **THEN** it passes, and the street picture stays within its luminance and saturation bounds
