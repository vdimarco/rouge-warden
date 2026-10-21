## ADDED Requirements

### Requirement: A masonry wall is separate units
Brick, stone, concrete, and loft walls SHALL vary in colour from one masonry unit to the next when a course is large enough to see. The top of a unit SHALL be lighter than its bottom. Glass towers SHALL keep a smooth pane. The wall SHALL stay in three cel bands.

#### Scenario: A near brick face
- **WHEN** the view is a few metres from a brick wall, with the hero hidden
- **THEN** neighbouring bricks are not one flat colour, the courses still show their joints, and the glass in that wall is not recolored as brick

### Requirement: The avenue keeps a coarser batch
When a single course is smaller than a pixel, the wall SHALL still show patches of the unit colour rather than one flat cel tone.

#### Scenario: The street camera looks up the avenue
- **WHEN** the street camera frames the avenue
- **THEN** a brick or concrete face in that view is patched in more than one tone of its material
