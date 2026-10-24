## ADDED Requirements
### Requirement: Shared figures follow world visibility
#### Scenario: Hidden world
- WHEN AR pause or view capture hides the world
- THEN shared people/goon/job figures are hidden and visual buffers are not rebuilt while simulation continues.
#### Scenario: Resume
- WHEN world visibility resumes
- THEN the first visible preparation uses current positions, poses, time and population with unchanged visible rendering.
