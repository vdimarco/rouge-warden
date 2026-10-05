## MODIFIED Requirements

### Requirement: Sixteen reference hero identities
The selection SHALL offer Tidewarden, Embersong, Voidcaller, Stoneheart, Skyreaver, Irontide, Moonweaver, Dredge, Glasshand, Salt Priestess, Riftblade, Coral Sage, Nightcurrent, The Marrow, Bloodwake and Zephyrs. Each identity SHALL resolve to a tested combat archetype and have artwork rendered from its own 3D model: a
head-and-shoulders bust for cards and panels, and a full-length figure for the selection stage and the 2D battle view. Skill names SHALL follow the identity while descriptions explain its actual assigned mechanics.

#### Scenario: Start with a selected identity
- **WHEN** a player selects a reference hero and starts a match
- **THEN** the battle, HUD and spellbook retain that identity while spells use its assigned archetype.

#### Scenario: Return to selection
- **WHEN** a player ends or leaves a match
- **THEN** the selected reference identity remains selected and can be changed.

#### Scenario: Load without a new battle sprite
- **WHEN** an identity's battle sprite cannot load
- **THEN** the original archetype sprite is used and combat remains available.

#### Scenario: One look in every view
- **WHEN** the player selects a hero and starts a match
- **THEN** the roster card, the selection stage, the HUD portrait and the hero in the battle show the same armour and weapon.
