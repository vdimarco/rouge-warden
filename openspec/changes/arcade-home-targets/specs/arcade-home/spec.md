# Arcade home

## Purpose
The Cottage Arcade home page: collection filters, cabinet controls, readable pixel type, and faces loaded from this site.

## Requirements

### Requirement: Tap targets at phone width
At a viewport 390px wide, every collection filter, the Lab link, each All Games room link, and each cabinet control (previous, next, Start, and coin slot) SHALL have a tap target at least 44px tall.

#### Scenario: Collection row
- **WHEN** a player opens the machine hall at 390×844
- **THEN** Cottage, Action, Strategy, GTA, the Lab link, and All Games are each at least 44px tall

#### Scenario: Cabinet controls
- **WHEN** a cabinet is selected at 390×844
- **THEN** its Start button, its coin slots, and the previous and next controls are each at least 44px tall

#### Scenario: All Games room links
- **WHEN** All Games is open at 390×844
- **THEN** Old arcade and 3D arcade are each at least 44px tall

### Requirement: Readable type
Visible text on the arcade home, including the All Games sheet, SHALL be at least 12px. The sign, marquees, and pixel labels SHALL keep Press Start 2P, Monoton, and Bungee.

#### Scenario: No 8px labels
- **WHEN** a player opens the machine hall or All Games at 390×844
- **THEN** every visible text node is at least 12px

### Requirement: Self-hosted faces
The arcade home SHALL load Press Start 2P, Monoton, and Bungee from woff2 files on this site, using `@font-face` and `font-display: swap`. It SHALL NOT request `fonts.googleapis.com` or `fonts.gstatic.com`.

#### Scenario: Opening the home page
- **WHEN** a player opens `/`
- **THEN** the three faces load from `/fonts/*.woff2` and no request goes to Google Fonts
