# Word atlas upload updates

## Requirements
### Requirement: Upload atlas rectangles only when changed
#### Scenario: Animation only
- WHEN live words animate without changing slots
- THEN matrix and tint uploads remain current while atlas rectangle uploads are omitted and pixels match prior behavior.
#### Scenario: Pending changes
- WHEN spawn, replacement or swap removal changes atlas data before render, including hidden updates
- THEN the next visible render uploads current rectangles without losing pending changes.
