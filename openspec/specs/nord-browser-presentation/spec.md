# NORD browser presentation

## Requirements
### Requirement: Consistent comic entry pages
The browser home screen and GTA arcade landing page SHALL use the approved collage badge, cream text panels, cyan halftone backgrounds, black ink borders and yellow primary actions.

#### Scenario: Badge-matched browser chrome
- **WHEN** the browser entry screen is visible
- **THEN** its header and footer use cream lettering on ink, its background uses angled cyan, yellow and hot-pink comic panels, and its trailer and status controls repeat the badge’s bold display lettering
- **AND** the large badge remains the primary action without changing the gameplay controls

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
- **THEN** the dominant circular badge is the browser Play button, with a gently pulsing PLAY word over its lower third and no animation under reduced-motion preferences; the arcade Play link remains beneath its badge

#### Scenario: Single-viewport entry
- **WHEN** either entry page opens at 320×568, 390×844, 844×390 or 1280×720
- **THEN** its primary action stays on or below the badge and the entry page has no horizontal or vertical overflow
- **AND** compact layouts omit repeated branding and keyboard legends while keeping trailer, host status and installation access available
