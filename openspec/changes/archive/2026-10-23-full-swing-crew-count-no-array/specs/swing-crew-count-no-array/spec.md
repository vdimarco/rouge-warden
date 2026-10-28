## ADDED Requirements
### Requirement: Count crew without filtered arrays
Mission survivor counts SHALL use existing alive membership without constructing a filtered crew array.
#### Scenario: Mission types and goon states
- **WHEN** sludge, mugging, getaway, tanker or brawl updates with mixed live/down/out/pulled/hung/inactive crew
- **THEN** displayed counts, first-live goals and completion behavior remain unchanged
