## ADDED Requirements

### Requirement: Sky pixels can carry cumulus
The comic post process SHALL paint a cloud colour onto a sky pixel when the view ray rises through a dense part of the cloud layer. A sky pixel in a gap of that layer SHALL keep the incoming sky colour. A pixel that is not sky SHALL keep its colour. The horizon haze mix SHALL stay the mix from the elevation term.

#### Scenario: Look up the street
- **WHEN** the cloud paint is applied from the walking camera to a street whose upper frame is sky
- **THEN** cloud masses appear in that sky, a gap in the layer stays the incoming sky colour, and the street matches the unpainted frame
