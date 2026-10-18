# NORD browser presentation

## Requirements
### Requirement: Consistent comic entry pages
The browser home screen and GTA arcade landing page SHALL use the approved collage badge, cream text panels, cyan halftone backgrounds, black ink borders and yellow primary actions.

#### Scenario: Desktop entry
- **WHEN** a player opens either entry page at 1280px width
- **THEN** the badge, readable primary actions and existing status or installation information are visible in a coherent comic layout

#### Scenario: Narrow entry
- **WHEN** either page opens at 390px or 320px width
- **THEN** content stacks without horizontal overflow and all actions remain reachable with at least 44px touch targets

#### Scenario: Existing flows
- **WHEN** the player activates Start, Menu or Watch the trailer
- **THEN** the existing story, menu or dismissible trailer opens and gameplay controls remain unchanged

#### Scenario: Play from the badge
- **WHEN** either entry page is opened
- **THEN** its primary Start or Play action appears directly beneath the circular badge, before the text panel on narrow screens

#### Scenario: Single-viewport entry
- **WHEN** either entry page opens at 320×568, 390×844, 844×390 or 1280×720
- **THEN** its primary action is directly below the badge and the entry page has no horizontal or vertical overflow
- **AND** compact layouts omit repeated branding and keyboard legends while keeping trailer, host status and installation access available
