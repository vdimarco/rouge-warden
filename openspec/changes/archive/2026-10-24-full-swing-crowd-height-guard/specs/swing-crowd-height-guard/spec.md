## ADDED Requirements
### Requirement: Preserve crowd eligibility with less rejected work
#### Scenario: High focus
- WHEN a pedestrian is at least 12 metres below focus
- THEN crowd counting rejects that pedestrian before its horizontal distance calculation while simulation continues.
#### Scenario: Street and boundary positions
- WHEN focus or pedestrians move across height and horizontal eligibility boundaries
- THEN crowd level and pedestrian simulation match the previous implementation.
