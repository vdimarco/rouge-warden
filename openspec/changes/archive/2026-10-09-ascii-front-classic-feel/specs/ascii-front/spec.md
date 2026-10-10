## MODIFIED Requirements

### Requirement: Character-art tank defense
ASCII Front SHALL provide 35 original maps, stage selection, 20 enemies per stage, four enemy roles, HQ defense, a 35-stage campaign and repeating Endless play. Character tanks SHALL retain green P1, cyan P2 and warm enemy colors. Armor, dash and EMP SHALL remain available. Pressure SHALL be capped at four enemies solo or six in co-op, with spaced, telegraphed arrivals and gradual enemy introductions.

#### Scenario: Defend the headquarters
- **WHEN** the player launches a run and fights approaching tanks
- **THEN** projectiles interact with cover and tanks, enemies can breach routes to headquarters, and losing all player lives or headquarters ends the run

#### Scenario: Settle into the opening
- **WHEN** a stage 1 run begins
- **THEN** enemies first enter outer lanes after a preparation interval, no power or heavy tanks appear, and each enemy has at most one live shell

#### Scenario: Travel through the campaign
- **WHEN** a campaign stage is cleared and the player continues
- **THEN** the next map restores surviving tanks' armor and preserves stars and remaining lives without a permanent perk selection; stage 35 ends in victory

#### Scenario: Upgrade between waves
- **WHEN** an Endless stage is cleared
- **THEN** the existing three permanent upgrade choices are available before the next map

#### Scenario: Fight the classic roster
- **WHEN** basic, fast, power and armor enemies enter combat
- **THEN** movement, projectile speed, durability and scores distinguish them; opposing bullets cancel and tanks cannot overlap

### Requirement: Responsive controls and lifecycle
The game SHALL support cardinal movement and facing-based keyboard/touch firing, optional independent click-to-aim, dash, EMP, reachable touch controls and local two-player control. Lives SHALL be limited, destruction SHALL reset star rank and respawn a remaining tank under a shield, and friendly fire SHALL stun an ally. Deliberate pause, hidden pages and the arcade menu SHALL stop simulation.

#### Scenario: Use classic controls
- **WHEN** the player moves with WASD/arrows or touch and holds fire
- **THEN** the tank travels along one cardinal axis and shoots in its facing direction; pointer hover does not redirect keyboard fire

#### Scenario: Move and aim independently
- **WHEN** the player deliberately holds left click toward another target
- **THEN** firing follows that pointer aim independently of cardinal movement

#### Scenario: Pause and retry
- **WHEN** the player pauses, hides the page or opens the game switcher
- **THEN** simulation stops until deliberately resumed, and retry restores the selected stage with fresh lives and rank

#### Scenario: Desktop and phone layout
- **WHEN** the game is viewed on desktop or portrait/landscape phone viewports
- **THEN** the battlefield, rank feedback and primary actions remain usable without horizontal document overflow

#### Scenario: Play together
- **WHEN** local co-op is enabled
- **THEN** P1 uses WASD/arrows and Space/click while P2 uses IJKL/U, each has independent lives and rank, and the team loses after both run out or HQ falls

#### Scenario: Traverse terrain
- **WHEN** a tank crosses ice or enters forest
- **THEN** it slides on ice and becomes visually concealed by forest; water blocks movement while shots cross it

#### Scenario: Use phones and menus
- **WHEN** viewed on desktop or portrait/landscape phone layouts, or paused/hidden
- **THEN** actions fit without horizontal overflow and paused gameplay does not continue in the background

### Requirement: Classic pickups and visible tank ranks
Carriers SHALL drop star, helmet, grenade, timer, shovel or tank supplies. The first two per stage SHALL offer stars while a surviving tank needs ranks. Supplies SHALL appear nearby on reachable ground for 45 seconds. Three star ranks SHALL visibly improve the tank, granting faster shells, two shots and steel destruction in turn. Pickups SHALL apply effects and scores; score milestones SHALL award lives.

#### Scenario: Collect the six supplies
- **WHEN** a player collects each supply
- **THEN** star raises rank, helmet shields, grenade clears visible enemies, timer freezes enemies, shovel temporarily fortifies HQ walls, and tank grants a life

#### Scenario: Enjoy tank progression
- **WHEN** a player hits an early flashing carrier while below Siege and collects its nearby star
- **THEN** the tank gains one rank, a clear weapon benefit message, a brief shield and an audible upgrade cue when sound is enabled

#### Scenario: Recognize tank progression
- **WHEN** a player gains stars or loses a tank
- **THEN** hull, turret, markings and HUD show the actual rank; tank destruction resets stars and the next stage's early carriers offer opportunities to rebuild
