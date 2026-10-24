# swing-web-upload-ranges

## Requirements
### Requirement: Upload populated web segments
#### Scenario: Visible attached or fading ropes
- WHEN flat 3D web segments render
- THEN matrix and fade GPU uploads cover live segment prefixes with identical shape, width, color and fade.
#### Scenario: Visibility and counts
- WHEN ropes shrink, disappear, resume or regrow
- THEN no stale segments draw and current live data is uploaded.
