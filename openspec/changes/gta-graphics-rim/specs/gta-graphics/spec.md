## ADDED Requirements

### Requirement: The crew has a grazing rim
The comic post process SHALL add a pale edge where a crew normal faces away from the camera. A pixel that is not crew SHALL keep its colour.

#### Scenario: A figure stands against the street
- **WHEN** the comic shader is evaluated on a crew figure and on the wall beside it
- **THEN** the figure's silhouette is paler than its centre, and the wall pixel is unchanged
