## ADDED Requirements

### Requirement: A street lamp warms the pavement under it

The ground under a street lamp within 80 m of the camera SHALL carry a warm disc a few metres across. The disc SHALL fall off before the next block. Ink on that pavement SHALL stay ink. The painted sky and the shop walls SHALL stay as they were.

#### Scenario: A close view of one lamp shows the pool

- **WHEN** the lamp shot looks at the pavement under the lamp at (-154.7, -8)
- **THEN** a pavement pixel under that lamp is warmer than the same pixel with the pool off
- **AND** the lamp post's ink pixel is unchanged

#### Scenario: The street render still reads

- **WHEN** `qa/vr/render.mjs` runs the named street and canyon shots
- **THEN** street luminance stays between 35 and 215, saturation stays above 0.3, and canyon ink stays under 35%
