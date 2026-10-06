## MODIFIED Requirements

### Requirement: Layouts that fit
Every screen SHALL fit at 390x844, 360x640, 430x932, 844x390, 820x1180, and 1280x800 with no clipped text, no overlap, and its Close or Done button in view or in a scroll that shows it. The HUD chip SHALL show the full derby weight at 360 px.

#### Scenario: Cast report with Larger text
- **WHEN** a cast lands in the water at 360x640 with Larger text on
- **THEN** the cast report stands beside the gauge, the action card in that corner hides while the report is up, and the report does not overlap the gauge or the HUD.

#### Scenario: Small Android phone
- **WHEN** the derby HUD shows 12.4 kg at 360x640
- **THEN** the chip shows the whole weight.
