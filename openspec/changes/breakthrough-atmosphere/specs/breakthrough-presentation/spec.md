## ADDED Requirements

### Requirement: Living world
The main world view SHALL show a layered landscape of sky, sun, clouds, distant mountains, hills, forest, water, settlement, agriculture, and infrastructure, and SHALL move clouds, water, canopy, and any built turbines while motion is allowed.

#### Scenario: Open a run
- **WHEN** the player starts a timeline
- **THEN** the world view shows the layered landscape, the current year, the 2100 warming path, and a visual-state name.

#### Scenario: Reduced motion
- **WHEN** the player has requested reduced motion, or the page is opened with `fast=1`
- **THEN** the world still shows the layered landscape and does not play the ambient motion.

### Requirement: World answers the simulation
The landscape SHALL blend among Damaged, Strained, Transitioning, and Thriving. Higher ecology SHALL read as richer forest, cleaner water, and greener ground. Higher emissions and warming SHALL read as haze, drier ground, wildfire scars, and a browner atmosphere. Deployed clean energy SHALL add the matching wind, solar, transmission, geothermal, and electrified transit.

#### Scenario: A damaged century
- **WHEN** emissions and warming are high and ecology is low
- **THEN** the world is labeled Damaged and shows haze, dry ground, and wildfire scars.

#### Scenario: A thriving century
- **WHEN** emissions and warming are low, ecology is high, and clean-energy technologies are deployed
- **THEN** the world is labeled Thriving and shows clearer air, greener land, and that clean infrastructure.

### Requirement: Strategy cards
Each offered technology SHALL appear as a readable paper card with an illustrated header, category, name, description, tradeoff, impact chips, and cost chips. The whole card SHALL be the control that selects it.

#### Scenario: Choose on a narrow screen
- **WHEN** the viewport is about 390 pixels wide
- **THEN** the player can read a card and its costs without zooming, and can reach the other offers by swiping.

#### Scenario: Unaffordable offer
- **WHEN** a dealt technology costs more than the player has
- **THEN** the card says it cannot be taken yet and choosing it does not spend resources or advance the turn.

### Requirement: Meta-breakthrough reveal
PLANETARY GRID, CARBON MINING, LAND DIVIDEND, and ELECTRIC EVERYWHERE SHALL each open a near full-screen reveal with a large title, a short explanation, a scientist reaction, and a light transition. The world SHALL already show the new combination when the reveal closes.

#### Scenario: Complete a meta-breakthrough
- **WHEN** the player owns every technology a meta-breakthrough requires
- **THEN** the reveal appears, the breakthrough is recorded on the timeline, and its infrastructure is visible in the world after the reveal closes.

### Requirement: Scientists
The game SHALL present seven advisors: Materials Scientist, Systems Scientist, Grid Architect, Political Organizer, Industrialist, Ecologist, and Wild Card Inventor. They SHALL appear as painted portraits with a short comment during decisions, the Idea Lab, or a breakthrough. The game SHALL NOT add a character-management system.

#### Scenario: A turn begins
- **WHEN** offers or an event are on screen
- **THEN** one advisor portrait and a short comment are visible with the choices.

### Requirement: Distinct endings
Each of the six endings SHALL show a different closing landscape, the ending title, a short alternate-history summary, the run stats including the seed, the breakthroughs, and a timeline of the run.

#### Scenario: The run reaches 2100
- **WHEN** the twelfth turn is resolved
- **THEN** the end screen shows the ending chosen by the existing thresholds and a timeline of the run.

#### Scenario: Endings do not share one picture
- **WHEN** the end screen is shown for The Age of Abundance, The Regeneration Century, The Managed Transition, The Hot Growth Era, The Long Emergency, and The Fractured Century
- **THEN** each ending uses its own visible art grade.

### Requirement: Arcade cabinet
The Cottage Arcade homepage SHALL include a BREAKTHROUGH cabinet that launches `/breakthrough/`.

#### Scenario: Start from the arcade
- **WHEN** the player starts the BREAKTHROUGH cabinet
- **THEN** the browser opens the game in `public/breakthrough/`.

### Requirement: Unchanged run
The visual pass SHALL keep the 12-turn run, the seeded simulation, one-handed mobile play, and the existing test hook.

#### Scenario: Play a seeded run
- **WHEN** a run is started with a seed and twelve affordable choices are taken
- **THEN** the run ends on the year 2100, the warming value still follows emissions, and the ending still follows the existing thresholds.
