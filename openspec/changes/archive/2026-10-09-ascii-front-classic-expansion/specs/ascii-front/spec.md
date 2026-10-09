## MODIFIED Requirements

### Requirement: Character-art tank defense
ASCII Front SHALL offer 35 distinct original maps with stage selection and 20 enemies per stage, four enemy roles, a vulnerable headquarters, campaign completion after stage 35 and repeating endless play. Character-drawn terrain and tanks SHALL retain a bright green first player, cyan second player and warm enemy colors. Modern player armor, dash, EMP and roguelite upgrades SHALL remain available.

#### Scenario: Defend the headquarters
- **WHEN** the player launches a run and fights approaching tanks
- **THEN** projectiles interact with cover and tanks, enemies can breach routes to headquarters, and losing all player lives or headquarters ends the run

#### Scenario: Upgrade between waves
- **WHEN** a stage is cleared
- **THEN** the player selects one of three valid upgrades before the next map, or receives victory after stage 35

#### Scenario: Travel through the campaign
- **WHEN** a stage is cleared and an upgrade selected
- **THEN** the next map replaces the terrain and replenishes 20 enemies while preserving surviving tank progression; stage 35 ends in victory

#### Scenario: Fight the classic roster
- **WHEN** basic, fast, power and armor enemies enter combat
- **THEN** their movement, projectile speed, durability and scores distinguish them; opposing bullets cancel and tanks cannot overlap

### Requirement: Responsive controls and lifecycle
The game SHALL support normalized movement, independent pointer aiming, dash, EMP, reachable touch controls and optional local two-player control. Lives SHALL be limited, destruction SHALL reset star rank and respawn a remaining tank under a shield, and friendly fire SHALL stun an ally. Deliberate pause, hidden pages and the arcade menu SHALL stop simulation.

#### Scenario: Move and aim independently
- **WHEN** the player moves diagonally and points at a different target
- **THEN** diagonal speed stays consistent and firing follows the chosen aim

#### Scenario: Pause and retry
- **WHEN** the player pauses, hides the page or opens the game switcher
- **THEN** simulation stops until deliberately resumed, and retry restores the selected stage with fresh lives and rank

#### Scenario: Desktop and phone layout
- **WHEN** the game is viewed on desktop or a portrait or landscape phone viewport
- **THEN** the battlefield and primary actions remain usable without horizontal document overflow

#### Scenario: Play together
- **WHEN** local co-op is enabled
- **THEN** P1 uses WASD/arrows and mouse/Space while P2 uses IJKL/U, each has independent lives and rank, and a team loses after both run out or HQ falls

#### Scenario: Traverse terrain
- **WHEN** a tank crosses ice or enters forest
- **THEN** it slides on ice and becomes visually concealed by forest; water blocks movement while shots cross it

#### Scenario: Use phones and menus
- **WHEN** viewed on desktop or portrait/landscape phone layouts, or paused/hidden
- **THEN** actions fit without horizontal overflow and paused gameplay does not continue in the background

## ADDED Requirements

### Requirement: Classic pickups and visible tank ranks
Flashing carriers SHALL yield the six classic pickup types: star, helmet, grenade, timer, shovel and tank. Three star ranks SHALL visibly change the tank and successively improve projectile speed, simultaneous shots and steel destruction. Every pickup SHALL have an observable effect and score value; score milestones SHALL award lives.

#### Scenario: Collect the six supplies
- **WHEN** a player collects each supply
- **THEN** star raises rank, helmet shields, grenade clears visible enemies, timer freezes enemies, shovel temporarily fortifies HQ walls, and tank grants a life

#### Scenario: Recognize tank progression
- **WHEN** a player gains star ranks or armor upgrades
- **THEN** hull, turret, markings and HUD communicate the actual progression; losing a life restores the initial star rank

### Requirement: Construction mode
Players SHALL paint original terrain, save/load a map locally, and start a custom battle. Reserved boundaries, HQ and spawn cells SHALL remain usable; stored maps SHALL be validated before loading.

#### Scenario: Create and test a map
- **WHEN** the player paints terrain, saves, reloads and tests
- **THEN** the map persists locally and launches a playable 20-enemy battle using the edited layout

### Requirement: Original musical soundtrack
An original chiptune score SHALL accompany active combat after a user gesture and respect the sound toggle, pause, hidden-page and arcade-menu lifecycle. Repeated restarts SHALL not multiply audio schedulers.

#### Scenario: Start and mute music
- **WHEN** the player starts combat then toggles sound or pauses
- **THEN** music plays while active, stops when muted/paused and resumes after deliberate play without duplicate loops
