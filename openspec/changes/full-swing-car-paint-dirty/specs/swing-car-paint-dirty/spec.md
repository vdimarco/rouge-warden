## ADDED Requirements
### Requirement: Upload only changed car paint
#### Scenario: Moving cars with unchanged paint
- WHEN car matrices move but RGB values in instance slots stay the same
- THEN color buffers do not upload and model/fallback appearance is unchanged.
#### Scenario: Changed population and paint
- WHEN colors change or cars enter, leave, reorder or resume from hidden frames
- THEN the next render has current paint with exact reference pixels.
#### Scenario: Multiple updates before a render
- WHEN a changed color is followed by unchanged updates before rendering
- THEN pending color writes survive and reach the GPU.
