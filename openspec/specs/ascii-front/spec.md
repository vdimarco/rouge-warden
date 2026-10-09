# ascii-front Specification

## Purpose
An original character-art tank roguelite with headquarters defense, responsive movement and aim, between-wave upgrades, campaign/endless play and Warden Arcade discovery.

## Requirements

### Requirement: Character-art tank defense
ASCII Front SHALL provide an independent playable tank-defense game with character-based terrain and vehicles, a bright green player, warm enemy colors, destructible cover and a vulnerable headquarters. Campaign mode SHALL end after five cleared waves; endless mode SHALL continue offering waves.

#### Scenario: Defend the headquarters
- **WHEN** the player launches a run and fights approaching tanks
- **THEN** projectiles interact with cover and tanks, enemies can breach routes to headquarters, and losing the player or headquarters ends the run

#### Scenario: Upgrade between waves
- **WHEN** a wave is cleared
- **THEN** the player selects one of three valid upgrades before the next wave, or receives victory after the final campaign wave

### Requirement: Responsive controls and lifecycle
The game SHALL support normalized directional movement, independent pointer aiming, fire, dash and a limited EMP, plus reachable touch controls. Deliberate start, pause/resume and fresh retry SHALL work without corrupting saved records. Hidden pages and an open arcade switcher SHALL pause a playing run.

#### Scenario: Move and aim independently
- **WHEN** the player moves diagonally and points at a different target
- **THEN** diagonal speed stays consistent and firing follows the chosen aim

#### Scenario: Pause and retry
- **WHEN** the player pauses, hides the page or opens the game switcher
- **THEN** simulation stops until deliberately resumed, and retry restores a fresh battlefield

#### Scenario: Desktop and phone layout
- **WHEN** the game is viewed on desktop or a portrait or landscape phone viewport
- **THEN** the battlefield and primary actions remain usable without horizontal document overflow

### Requirement: Warden Arcade discovery
Warden Arcade SHALL expose ASCII Front at `/ascii-front/`, in the ASCII Scenes collection and shared game switcher, with the same id, name and original local cabinet art. The game SHALL offer an arcade return and shared switcher action.

#### Scenario: Find and launch ASCII Front
- **WHEN** a player chooses ASCII Front in the arcade or shared switcher
- **THEN** `/ascii-front/` loads its bundled assets and presents the game

#### Scenario: Return to the arcade
- **WHEN** the player chooses the arcade return action
- **THEN** the arcade opens without changing another game's saves or catalog entry
