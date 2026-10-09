## ADDED Requirements
### Requirement: Cinematic action rescue mode
The default Afterlight experience SHALL be a full-screen action campaign across six original ASCII worlds. Players SHALL move, aim/fire light projectiles, dodge telegraphed enemies, escort visible survivors to a beacon and protect it during a defense wave and defeat a visibly larger guardian. The HUD SHALL name the current physical action and clearly report rescue/defense progress. Classic exploration and its existing saves SHALL remain separately accessible.
#### Scenario: Rescue under threat
- **WHEN** a player begins the action campaign
- **THEN** a visible courier and survivors appear in a moving landscape, weapon/dodge controls respond directly, and rescued survivors follow to the beacon
#### Scenario: Defend and advance
- **WHEN** three survivors reach the beacon
- **THEN** a visible timed defense begins, the full defense duration and defeating its guardian restore the region and permits the next region, and the sixth completed region ends the campaign

#### Scenario: Guardian is a real completion gate
- **WHEN** the beacon defense reaches its climax
- **THEN** a larger guardian with visible health and attack warnings appears, the route remains closed until it is defeated, and reloading cannot bypass that encounter

### Requirement: Powerful adaptive living picture
The action scene SHALL occupy the viewport behind a compact overlaid HUD. Saturated regional light, layered scenery and weather SHALL animate across broad portions of the screen. Weapon hits, dodges, rescues and restoration SHALL create visible scene-scale responses. Restoration SHALL persist on return/reload. Reduced motion SHALL reduce decorative camera/ambient effects while retaining essential enemy/projectile cues and color restoration.
#### Scenario: Picture responds to play
- **WHEN** the player fires, rescues a survivor or activates a beacon
- **THEN** bright trails or expanding waves appear in the playfield and the landscape changes visibly beyond a small UI indicator
### Requirement: Action lifecycle and accessible controls
Action mode SHALL support deliberate start, keyboard/pointer and touch movement/fire/dodge, pause, page-hide/game-switch pause, retry, safe saves and a new campaign. Desktop 1440×900 and phones 390×844 and 844×390 SHALL keep the scene full-screen, controls reachable and HUD readable without document overflow. New action storage SHALL not overwrite Classic saves.
#### Scenario: Pause and recover
- **WHEN** the player pauses, hides the page, switches games or exhausts health
- **THEN** gameplay freezes appropriately and deliberate resume or safe checkpoint retry is available
#### Scenario: Save safely
- **WHEN** a valid action save is loaded or storage is malformed/blocked
- **THEN** restored progress resumes deliberately or a fresh playable campaign is offered without corrupting Classic progress

### Requirement: Bounded cinematic rendering
The action renderer SHALL cache broad lighting at bounded resolution while keeping gameplay objects animating independently. Resizing the display or master texture SHALL preserve a full-viewport picture and consistent pointer-to-world coordinates.
#### Scenario: Change render resolution
- **WHEN** the viewport or bounded master texture changes size
- **THEN** the world image still covers the entire viewport, game objects remain aligned with aiming, and the HUD remains readable

## MODIFIED Requirements
### Requirement: Accurate efficient scene composition
The Classic ASCII compositor SHALL avoid repainting unchanged cells while preserving exact full-redraw pixels. Travel and resize SHALL invalidate scene caches. Phaser's Classic offscreen master SHALL remain 1200 by 600 pixels on high-density phones instead of multiplying the master by device pixel ratio. Action mode SHALL use its separately bounded cinematic renderer.
#### Scenario: Compare animation and travel frames
- **WHEN** ordered Classic frames across all regions, motion settings, travel and resize are rendered incrementally and with a full-redraw reference
- **THEN** their pixels match exactly and unchanged-cell repainting is skipped
#### Scenario: High-density display
- **WHEN** Classic loads on a device with pixel ratio two
- **THEN** its offscreen ASCII master remains 1200 by 600 pixels and the visible scene scales to fit
