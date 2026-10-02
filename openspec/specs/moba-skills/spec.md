# Monster Mash learned skills and thumb controls
### Requirement: Four-button thumb fan
The HUD SHALL anchor the ultimate at bottom-right, with three separate moves around it. All four SHALL show hero-specific names, iconography, learned ranks, cooldowns and lock states. Training SHALL be separate from casting.
#### Scenario: Use supported screens
- **WHEN** the game runs at 390x844, 844x390, 320x640 or 1440x900
- **THEN** controls fit the viewport, remain distinct and leave movement and market controls accessible.
#### Scenario: Aim a learned move
- **WHEN** the player taps or drags a learned move, or uses Q/E/C/R
- **THEN** its corresponding ability casts and its cooldown appears; an unlearned move cannot cast.
### Requirement: Skill points and gated ranks
Heroes SHALL begin with one point and no learned spells; each level SHALL grant one point. Basic ranks SHALL require levels 1/3/5/7, ultimate ranks 6/12/18. Death SHALL preserve learned ranks. Bots SHALL obey the same rules.
#### Scenario: Choose a first move
- **WHEN** a new hunt begins and the player explicitly learns a basic ability in the training sheet
- **THEN** exactly one point is spent and only that move unlocks.
#### Scenario: Reach level six
- **WHEN** the player reaches level six with an unspent point
- **THEN** the ultimate becomes eligible to learn; it remains uncastable until learned.
#### Scenario: Upgrade a move
- **WHEN** an eligible rank is trained
- **THEN** its cooldown or potency improves; training at the wrong level or without points has no effect.
### Requirement: Distinct folklore kits
Each hero SHALL have three basic spells and one ultimate with different tactical behavior and visible cues.
#### Scenario: Combine signature spells
- **WHEN** Mothman strikes an omen, Nessie knocks a wet enemy back, Baba burns a rooted enemy or Devil fears a bleeding enemy
- **THEN** the corresponding hero gains the advertised bonus and its thematic effect is shown.
#### Scenario: Finish a match
- **WHEN** all twelve heroes play full seeded bot matches
- **THEN** matches finish, ranks stay valid, entities stay finite and existing item, lane, attack and neutral rules continue to work.

### Requirement: Readable selection and rank detail
The spellbook SHALL pause the hunt, show four selectable skills, and show the selected move's description, combination hint, current rank, cooldown and level requirements. Spending a point SHALL require the explicit Learn or Upgrade action.
#### Scenario: Preview before learning
- **WHEN** a player selects a spell row
- **THEN** the detail updates and the skill point count does not change.
#### Scenario: Learn and inspect a rank
- **WHEN** a player spends an eligible point
- **THEN** the point count decreases, the rank increases, and the selected detail updates its current and next rank benefits.
#### Scenario: Locked ultimate
- **WHEN** the player inspects an ultimate below level 6
- **THEN** its detail is available and the learning button explains the level requirement.
#### Scenario: Small screen
- **WHEN** the spellbook is viewed at 390x844 or 844x390
- **THEN** spell choices, descriptions and actions remain reachable without horizontal page overflow.

### Requirement: Painted spellbook within the viewport
The spellbook SHALL match the supplied painted reference with illustrated skill tiles, a large selected spell illustration, cream serif text, a gold frame and gold learn action. It SHALL keep its frame, close control and footer inside the usable viewport at 320x640, 390x844, 844x390 and 1363x936. Long details SHALL scroll inside the panel.
#### Scenario: Inspect a spell
- **WHEN** a player selects any spell row
- **THEN** the selected painted effect, description, cooldown and rank track update without spending a point.
#### Scenario: Short or narrow display
- **WHEN** the viewport is short or narrow
- **THEN** the panel remains bounded and its spell choices and learn action remain reachable through internal scrolling.

### Requirement: Direct HUD skill upgrades
Each eligible skill SHALL have a separate clickable plus button on the main game HUD. Clicking it SHALL train only that skill through the existing rank and level rules without casting or opening a dialog.
#### Scenario: Click a plus
- **WHEN** a player with an eligible point clicks the plus beside an ability
- **THEN** one point is spent, that skill rank increases by one, the HUD updates and the hunt remains visible.
#### Scenario: Invalid upgrade
- **WHEN** a skill lacks points, is fully trained or is below its next level gate
- **THEN** it has no active plus button and its rank cannot change through that control.
