## ADDED Requirements
### Requirement: Ranked default catalog
The home page SHALL open All Games using shared PostHog aggregates from the last 30 days. Featured SHALL be the default order: Reel It In, Shore of the Ancients, Breath of the Lake, In Full Swing, Crimson Rogue, River Rush, then remaining games by plays. Games that stand only in the Lab (the ASCII sketches, Loon Echo, Take the Plunge and Up the Creek) are not on the list. Explicit plays, views, likes and active time filters SHALL rank solely by the selected PostHog metric. Ties SHALL preserve catalog order. Search SHALL filter titles and subtitles. Local launch counts SHALL NOT appear as global activity. Players SHALL be able to open the original machines and the 3D room from visible header controls.
#### Scenario: Shared popularity
- **WHEN** PostHog returns activity for multiple games
- **THEN** all visitors see the same ranking and can sort by each metric
#### Scenario: No activity or unavailable analytics
- **WHEN** no production events exist or the read service is unavailable
- **THEN** the catalog stays playable, reports collecting or unavailable status, and does not fabricate ranks or numbers
#### Scenario: Sort while analytics are unavailable
- **WHEN** the read service is unavailable and the visitor selects Plays, Views, Likes or Time
- **THEN** the button shows as selected, the status line says that ranking by that metric is not available now, and the page asks for the activity again
#### Scenario: Open the old arcade
- **WHEN** the visitor selects Old arcade in the header at 1363×936 or 390×844
- **THEN** All Games closes and the original machines show, and ALL GAMES opens the list again
#### Scenario: A machine group in the address
- **WHEN** the visitor opens `/#action` (or another group's id from the `arcade-groups` spec), or comes back to such an address from a game
- **THEN** All Games stays closed and that group's machines show, and ALL GAMES opens the list
### Requirement: Anonymous game analytics
Each catalog destination SHALL record one view per page visit and one play on the first player interaction. Active time SHALL count only visible, focused, recently interacted time, excluding the switch dialog. Likes SHALL be a one-time anonymous browser action, deduplicated by anonymous visitor in PostHog. The page SHALL explain these definitions. Preview and local traffic SHALL NOT enter production rankings. Analytics failures and disabled storage SHALL NOT block games. No session replay, input text or personal identifiers SHALL be collected.
#### Scenario: Play and leave
- **WHEN** a player interacts with a game, then hides its tab
- **THEN** one play is recorded and active time stops while hidden
#### Scenario: Like a game
- **WHEN** a visitor presses Like on a game
- **THEN** the button turns lit pink and reads LIKED, its count and the game's like total rise by one at once, the order changes when sorted by likes, and the button keeps focus
#### Scenario: Own like not yet in the shared count
- **WHEN** a visitor reloads the page within the cache window after liking
- **THEN** the count still includes their like once, and a like sent more than a minute before the counts were read is not added again
#### Scenario: Secure aggregate reads
- **WHEN** a visitor requests leaderboard data
- **THEN** only aggregate game metrics are returned and the private PostHog credential remains server-side
#### Scenario: Game without active time
- **WHEN** a game has views or plays but no active-time events, or an event has no game id
- **THEN** the endpoint returns zero active time for that game, skips the event without a game id, and still returns every other game
### Requirement: Walkable neon room
The room SHALL show every catalog game as a lit cabinet, plus neon signs and a cinematic entrance. The hall SHALL grow with the catalog so that no cabinet stands in a wall. Cabinets SHALL have a shaped side profile with clearcoat paint in the game's color, a neon edge, a CRT-style screen with the game's artwork, controls, a coin door and a lit marquee. The hall SHALL have neon bloom, a glossy floor that mirrors the room, a blacklight carpet on the aisle, light shafts and drifting dust. Quality SHALL step down by itself when frames are slow: first pixel ratio, then the floor mirror, then bloom.
On touch screens, a drag that starts on the left half SHALL show a floating stick: up and down walk, left and right strafe. A drag on the right half SHALL turn the view. Both SHALL work at the same time. A tap on the floor SHALL walk to that spot without turning the view. A tap on a cabinet SHALL walk to its front and turn to face it. A drag SHALL NOT count as a tap. On desktop, WASD and the arrow keys SHALL walk and strafe, Shift SHALL run, a mouse drag SHALL turn the view, and a click SHALL walk like a tap. Movement SHALL respect room and cabinet collision. A play control SHALL launch the selected game.
#### Scenario: Strafe with the stick
- **WHEN** the player drags right from a point on the left half of a phone screen
- **THEN** the stick appears under the thumb and the player moves sideways without turning
#### Scenario: Walk and look together
- **WHEN** one thumb drags up on the left half while another drags across the right half
- **THEN** the player walks forward and turns at the same time
#### Scenario: Tap a cabinet
- **WHEN** the player taps a cabinet down the hall
- **THEN** the player walks to its front, faces its screen, its name appears and the play control opens its game
#### Scenario: Tap the floor
- **WHEN** the player taps the floor ahead
- **THEN** a ring marks the spot and the player walks there with the view unchanged
#### Scenario: Phone layout
- **WHEN** the room opens at 390 by 844
- **THEN** the view uses a wider lens, the touch hints and the play control remain usable, and nothing overflows horizontally
#### Scenario: Rendering unavailable
- **WHEN** WebGL or the room's scripts cannot start
- **THEN** an error and a link to All Games remain visible
### Requirement: Visual checks
Desktop and phone-sized browser checks SHALL verify page identity, meaningful content, console health, filtering, ranking persistence, rendering, movement and navigation. Rendered screenshots SHALL be reviewed for clipping and artwork.

### Requirement: Compact catalog entrance
A small floating sticky header SHALL hold search, compact sorting controls and a menu. Games SHALL begin within 150 pixels of the viewport top at 1363×936 and 390×844. The first three featured games SHALL show artwork and title in the initial viewport. Statistics and metric explanations SHALL be below the games; menu actions SHALL remain reachable while scrolling.
#### Scenario: First screen
- **WHEN** a visitor opens home without scrolling
- **THEN** the three featured games appear first with visible artwork and titles, without a large hero or statistics block above them
#### Scenario: Browse and filter
- **WHEN** the visitor scrolls or selects Plays
- **THEN** the floating header stays reachable and the catalog sorts by actual plays
