# Comic-word upload ranges

## Requirements
### Requirement: Comic-word uploads cover live records
#### Scenario: Live words
- WHEN words spawn or update after buffers initialize
- THEN matrix, atlas and tint uploads cover only live prefixes and rendered words match prior pixels.
#### Scenario: Removal and regrowth
- WHEN words expire, swap slots, reach zero or spawn again
- THEN live words preserve state/atlas/tint/placement and hidden stale slots do not upload or draw.
#### Scenario: Hidden world
- WHEN world visibility changes
- THEN existing aging and visibility semantics remain unchanged.
