## ADDED Requirements

### Requirement: Unified latest environment and gameplay
The local and streamed Linux game SHALL contain the imported Plateau environment together with Warden's current crew, 1970s fleet, campaign and driving behavior.

#### Scenario: Explore and play the merged release
- **WHEN** a player launches the local Linux package or the temporary browser player
- **THEN** the LaFontaine map includes the attributed Plateau park, surrounding street facades and landmarks
- **AND** authored Warden resident routes, interchangeable crew, traffic and car interactions remain usable
- **AND** the existing rescue and ordered race missions retain progress and isolated QA save/reload behavior.

#### Scenario: Preserve source and saves
- **WHEN** the environment is integrated and the packages are updated
- **THEN** the separate source project's files remain unchanged
- **AND** existing production save files remain byte-identical unless changed by actual player activity
- **AND** the native and browser packages use the same cooked content and executable.

#### Scenario: Review delivery quality
- **WHEN** the merged map is reloaded and rendered at supported desktop sizes
- **THEN** missing native classes, duplicate environment layers, collision failures and new rendered/performance failures are reported and fixed within scope
- **AND** recorded checks distinguish automated browser emulation from physical mobile and off-LAN testing.

### Requirement: GTA Montréal entry and readable HUD
The Cottage Arcade SHALL offer a GTA machine that opens the Montréal title page, with a Play link to the existing browser player. The native HUD SHALL provide an original Montréal title, concise mission information, radar, speed and contextual controls without dropping existing gameplay feedback.

#### Scenario: Launch from the arcade
- **WHEN** a player activates the GTA machine by the existing click or keyboard interaction
- **THEN** the Montréal title page opens with a working Play link to the NORD Montréal browser player.

#### Scenario: Read play information
- **WHEN** a player walks, talks, drives or advances the existing campaign at 1280×720 or 1920×1080
- **THEN** the current objective, interaction hint, road map attribution, speed and controls remain readable without covering one another.

### Requirement: QA-gated trailer and title page
The release SHALL publish a responsive title page and a new trailer captured from the integrated game after its automated release checks pass.

#### Scenario: Watch actual integrated gameplay
- **WHEN** release checks have passed and a player opens the title page
- **THEN** Play opens the existing player and Watch Trailer plays reviewed integrated-game footage
- **AND** the page works at desktop and phone sizes, identifies PC-host availability, and preserves the existing Arcade and API routes.

## MODIFIED Requirements

### Requirement: Repository hygiene
The import SHALL exclude local credentials, packaged builds, engine caches, recovery data, trailer binaries and regenerated base OSM geographic OBJ files. Processed municipal mesh inputs, roof atlases and authored comic meshes SHALL be retained as reproducible source assets.

#### Scenario: Inspect the commit
- **WHEN** the integrated release is staged
- **THEN** only the project, source assets, documentation, focused QA/specification files and authorized GTA Arcade entry/title-page changes are included
- **AND** unrelated Arcade games and API sources remain preserved
- **AND** deployed trailer/poster hashes and provenance are recorded without committing media binaries.
