## ADDED Requirements

### Requirement: A lit window spills onto the wall
A near lit window in the street view SHALL warm the pier beside it, and that warmth SHALL fall off away from the glass. The glass SHALL keep its own glow. A lit shop awning SHALL be warmer at the hem than at the top. A dark shop awning SHALL keep its cloth colour. The city render check SHALL still pass.

#### Scenario: The street looks at a lit shop
- **WHEN** the street camera frames the avenue
- **THEN** the cloth over a lit shop is warmer along the hem than along the top, and the road away from the shops does not take that lamp

#### Scenario: The city render
- **WHEN** `qa/vr/render.mjs` runs
- **THEN** it passes, including the canyon ink lines, and the street picture stays within its luminance and saturation bounds

#### Scenario: A bay has no window
- **WHEN** a bay is blank or its top-floor window is suppressed because the row is incomplete
- **THEN** that bay emits no window-shaped light pool onto the wall
