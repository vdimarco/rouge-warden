## ADDED Requirements

### Requirement: Shade and the mid step are different hues
Cool shaded surfaces in the city SHALL read teal rather than the same blue-violet as the zenith. The step between that shade and the sun SHALL read rose. A lit window and near-black ink SHALL keep their colours. The three cel bands SHALL remain.

#### Scenario: The street camera looks up the avenue
- **WHEN** the street camera frames the avenue
- **THEN** a shaded upper floor is teal beside the warmer lower floor, and a lit window is not recolored as rose or teal

### Requirement: The painted sky strip stays the lookup
The grade on the sky dome SHALL NOT change the colour `skyColorAt` returns.

#### Scenario: The sun is still the painted sun
- **WHEN** the view asks for the sky colour on the sun's azimuth, just above the horizon
- **THEN** that colour is still the bright yellow of the painted strip
