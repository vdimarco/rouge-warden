## ADDED Requirements
### Requirement: Reuse current action-view inputs
#### Scenario: Active frames
- WHEN street frames update the action view
- THEN one private options record carries the current camera and marker flag without changing rendered selection.
#### Scenario: State transitions
- WHEN play/cutscene or world visibility changes
- THEN marker eligibility and camera inputs reflect the current invocation.
