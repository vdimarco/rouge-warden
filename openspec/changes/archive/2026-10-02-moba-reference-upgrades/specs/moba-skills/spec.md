## ADDED Requirements

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
