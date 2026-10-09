## ADDED Requirements

### Requirement: Battlefield camera zoom
The 3D battlefield SHALL support wheel and two-finger pinch zoom between normal distance and 2.4 times normal distance, retaining zoom across resize and recenter.

#### Scenario: Wheel and pinch reveal terrain
- **WHEN** an active player scrolls down over the battlefield or moves two battlefield fingers together
- **THEN** the camera reveals more ground, and the reverse gesture restores the closer view within the bounds.

#### Scenario: Pinch does not issue combat input
- **WHEN** a second battlefield finger joins a screen drag
- **THEN** screen movement and queued orders stop, and neither finger issues movement or a tap until both lift, including capture loss or cancellation.

#### Scenario: Independent controls and inactive states
- **WHEN** joystick and ability touches are used together, or a menu is open or play is paused
- **THEN** those touches do not form a battlefield pinch and inactive play does not change zoom.

#### Scenario: Accurate zoomed terrain selection
- **WHEN** the player zooms and then targets visible ground
- **THEN** picking follows the visible terrain and the camera footprint, pan scale and atmospheric fog distances match the new distance so terrain remains legible.

### Requirement: Top center Rift Jump
Rift Jump SHALL appear at the top center of the battlefield with a touch target at least 44px high, remaining visible with a disabled Find a gate hint away from gates, and retaining its existing gate eligibility and action.

#### Scenario: Responsive HUD
- **WHEN** a match is displayed on desktop, portrait phone or landscape phone
- **THEN** Rift Jump is centered, within safe areas and clear of the score, team lineup, objective clock, objective panel, minimap and first-spell prompt.
