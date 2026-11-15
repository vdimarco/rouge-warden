## ADDED Requirements

### Requirement: Walk between four splat worlds
Riftwalk SHALL put the player in a Gaussian splat world at eye height, with three wisps to catch. When the third wisp is caught, a ring-shaped rift SHALL open in that world and SHALL show the next world through it. Crossing the rift SHALL put the player in the next world, and the rift SHALL shut behind the player. The worlds SHALL run cottage, shore ruin, ice cavern, moonwell, and back to the cottage. The fourth crossing SHALL end the walk with the player's time and best time, and a control to walk again.

#### Scenario: Open the first rift
- **WHEN** the player starts the walk and catches the three wisps in the cottage
- **THEN** the HUD counts the wisps from 0 to 3, a rift opens, the shore ruin shows through it, and a hint says how to go through

#### Scenario: Cross a rift
- **WHEN** the player taps or clicks the open rift, presses Space, or walks into it
- **THEN** the player arrives in the next world facing its centre, the rift shuts, the HUD names the new world, and three new wisps wait

#### Scenario: Finish the walk
- **WHEN** the player crosses the fourth rift
- **THEN** the player is back in the cottage, a card shows the time and the best time, and Walk again starts a new walk at 0:00

### Requirement: Controls for mouse, keys and touch
The player SHALL look by dragging the view, and SHALL catch a wisp or enter an open rift with a tap or a click on it. A drag SHALL NOT catch a wisp. Space or Enter SHALL catch the wisp in the middle of the view, or enter the open rift. W A S D and the up and down arrows SHALL walk, and the left and right arrows SHALL turn. On a touch screen a walk pad of at least 100 px SHALL show at the lower left. The walker SHALL stay inside the world's walk circle, except on the way to an open rift.

#### Scenario: Play with taps alone on a phone
- **WHEN** a player on a 390 by 844 touch screen drags to look and taps each wisp, then taps the rift
- **THEN** each wisp is caught, the rift opens, and the player crosses, with no use of the walk pad

#### Scenario: Play with the keyboard
- **WHEN** a player holds W on a desktop
- **THEN** the walker moves and stops at the edge of the walk circle

#### Scenario: Phone layout
- **WHEN** the game runs at 390 by 844
- **THEN** the HUD and the hint fit the width, the hint is clear of the walk pad, and Start is at least 44 px tall

### Requirement: Load, fail and motion states
Start SHALL stay disabled until the first world is loaded, with a line that shows the progress. If the next world is still loading when the third wisp is caught, a hint SHALL say so and the rift SHALL open when the world is ready. Without WebGL2 the page SHALL say that the game needs it. With reduced motion, the ring's motes and the wisps' bob SHALL stop, the rift SHALL open at once, and a crossing by tap or key SHALL be one cut. The walk SHALL hold while the arcade's Games menu is open or the tab is hidden.

#### Scenario: Reduced motion
- **WHEN** a player who asks for reduced motion enters an open rift with Space
- **THEN** the player is in the next world with no glide

### Requirement: Arcade cabinet
Riftwalk SHALL have a cabinet at the end of the Lab row on the homepage, an entry in the game switcher, a piece in the Corridor after the last Lab cabinet, and a card on the Lab page. Its id SHALL be `riftwalk`, its title "Riftwalk" and its route `/lab/riftwalk/`.

#### Scenario: Open from the homepage
- **WHEN** a player opens the Lab row at 390, 320 or 1280 px wide and starts the Riftwalk cabinet
- **THEN** the marquee shows the whole title, and the game page loads
