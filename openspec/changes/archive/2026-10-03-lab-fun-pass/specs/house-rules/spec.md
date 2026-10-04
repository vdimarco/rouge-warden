## ADDED Requirements

### Requirement: Race the maker and send a time back
House Rules SHALL let a friend race the time on a shared layer and send their own time back in a link.

#### Scenario: The race clock
- **WHEN** a friend plays a shared layer that has the maker's time
- **THEN** the game's clock shows the time so far against the time to beat, for example "⏱ 0:12 / 0:47", and shows no fast-drain countdown

#### Scenario: Send your time
- **WHEN** the friend reaches a drain
- **THEN** the clear card compares the two times and offers "Send your time", which shares a link that carries the friend's stamped time (`b=`)

#### Scenario: Open a reply
- **WHEN** someone opens that link
- **THEN** the intro shows the maker's time and the best time, for example "Maker 0:47 · Best 0:31", and the clock races the best time

### Requirement: The death card shows how close you came
House Rules SHALL let the player see the death, and then say how far down the player got.

#### Scenario: Die in a painted layer
- **WHEN** the player dies in a painted layer
- **THEN** the card appears at least 600 ms after the death and says how far down the player got, the time and the try, for example "Flushed 78% of the way down, at 0:21. Try 4."

#### Scenario: Try again
- **WHEN** the player presses Try again
- **THEN** the same layer starts, and the controls hint does not show again

### Requirement: Settle runs the game's propane tanks
House Rules SHALL show in the Settle preview what a tank does in the game.

#### Scenario: A tank next to lava
- **WHEN** a tank sits next to lava and the maker presses Settle
- **THEN** the tank warms, a ring closes in while a fuse hisses, and the blast flashes, booms and spills fire in the preview

#### Scenario: Poke the preview
- **WHEN** the maker drags while Settle runs
- **THEN** the drag digs or pours into the preview, Settle keeps running, and the layer's strokes stay as painted

#### Scenario: Pinch during Settle
- **WHEN** the maker pinches while Settle runs
- **THEN** the view zooms and Settle keeps running

### Requirement: The editor fits a phone
House Rules SHALL show every tool on a 390 px wide screen and make placed things easy to see and to remove.

#### Scenario: All tools in view
- **WHEN** the editor opens on a 390×844 screen
- **THEN** every paint chip and every tool, Drains included, is inside the screen width

#### Scenario: Remove a critter with a thumb
- **WHEN** the maker taps 6 screen px away from a placed critter with that critter's tool
- **THEN** the critter goes away, and no second critter is placed

#### Scenario: The zoom tip
- **WHEN** the maker opens the editor on a touch screen for the second time
- **THEN** the pinch-to-zoom tip does not show

### Requirement: A clear survives a new name
House Rules SHALL keep a clear when only the layer's name changes.

#### Scenario: Name a cleared layer
- **WHEN** the maker clears a layer and then types a name for it
- **THEN** Share stays open, and the status keeps the count of tries

### Requirement: Remix a friend's layer
House Rules SHALL let a friend open a shared layer in the editor and build on it.

#### Scenario: Remix
- **WHEN** a friend presses "Remix this layer"
- **THEN** the editor opens with that layer, asks first if the friend's own draft has content, and shows "Add your trap and send it back"

#### Scenario: A remix must be cleared again
- **WHEN** the remixed layer opens in the editor
- **THEN** Share is locked until the remixer clears it
