## ADDED Requirements

### Requirement: Usable arsenal
Players SHALL select fists, pistol, Golden Eagle, AK-47, katana, baseball bat and bear spray using keyboard or touch, with visible weapon/ammo status.

#### Scenario: Shoot and reload
- **WHEN** an equipped gun is fired toward an ambient pedestrian or hostile officer
- **THEN** the nearest visible target takes damage, with sound, muzzle flash, tracer and hit feedback
- **AND** walls/terrain block shots and named story companions are not targets
- **WHEN** a magazine empties
- **THEN** firing stops until a timed reload transfers available reserve ammunition

#### Scenario: Melee and spray
- **WHEN** the katana or bat attacks
- **THEN** existing combos, heavy attacks, block and dodge remain available with distinct props and damage
- **WHEN** bear spray hits nearby targets in its cone
- **THEN** officers stagger and civilians flee without lethal damage

### Requirement: Challenging pursuit
Patrol vehicles SHALL accelerate, brake and corner better than standard SUVs. Armed officers SHALL telegraph ranged attacks that respect solid cover and dodge invulnerability.

#### Scenario: Return fire
- **WHEN** an alert armed officer has a visible suspect outside melee range
- **THEN** a warning precedes shots and cover or dodging avoids damage

### Requirement: Upward look and audible aircraft
Vertical look SHALL reveal the sky on foot and while driving. Nearby helicopters SHALL produce audible pulsing rotor sound that fades with distance and pauses with gameplay.

#### Scenario: Look up
- **WHEN** vertical mouse/stick/touch look is applied
- **THEN** camera elevation changes enough to see overhead aircraft without going underground

#### Scenario: Lifecycle and validation
- **WHEN** gameplay pauses, enters a cinematic or exits
- **THEN** firing/reload stop advancing, effects remain bounded, and session exit removes effects/audio
- **WHEN** desktop and landscape touch layouts are tested
- **THEN** weapon controls and ammunition remain visible without blocking existing movement controls


### Requirement: Reward readable openings
Enemy recoil, recovery and stagger SHALL create an explicit punish opportunity. A hit during that state SHALL have stronger damage/posture payoff than the same hit against a neutral enemy, with a clear feedback cue.

#### Scenario: Punish recovery
- **WHEN** the player attacks an enemy during recoil, recovery or stagger
- **THEN** the hit deals bonus damage and posture pressure and shows an opening-hit cue
- **AND** a heavy attack earns a larger opening bonus than a light attack.
