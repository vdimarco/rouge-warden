## ADDED Requirements
### Requirement: Ranked default catalog
The home page SHALL open All Games using shared PostHog aggregates from the last 30 days. Featured SHALL be the default order: Reel It In, Shore of the Ancients, Breath of the Lake, In Full Swing, Crimson Rogue, River Rush, then remaining games by plays. Explicit plays, views, likes and active time filters SHALL rank solely by the selected PostHog metric. Ties SHALL preserve catalog order. Search SHALL filter titles and subtitles. Local launch counts SHALL NOT appear as global activity. Players SHALL be able to open the original machines and the 3D room.
#### Scenario: Shared popularity
- **WHEN** PostHog returns activity for multiple games
- **THEN** all visitors see the same ranking and can sort by each metric
#### Scenario: No activity or unavailable analytics
- **WHEN** no production events exist or the read service is unavailable
- **THEN** the catalog stays playable, reports collecting or unavailable status, and does not fabricate ranks or numbers
### Requirement: Anonymous game analytics
Each catalog destination SHALL record one view per page visit and one play on the first player interaction. Active time SHALL count only visible, focused, recently interacted time, excluding the switch dialog. Likes SHALL be a one-time anonymous browser action, deduplicated by anonymous visitor in PostHog. The page SHALL explain these definitions. Preview and local traffic SHALL NOT enter production rankings. Analytics failures and disabled storage SHALL NOT block games. No session replay, input text or personal identifiers SHALL be collected.
#### Scenario: Play and leave
- **WHEN** a player interacts with a game, then hides its tab
- **THEN** one play is recorded and active time stops while hidden
#### Scenario: Like a game
- **WHEN** a visitor likes a cabinet
- **THEN** the control shows saved feedback without pretending the cached global count has refreshed
#### Scenario: Secure aggregate reads
- **WHEN** a visitor requests leaderboard data
- **THEN** only aggregate game metrics are returned and the private PostHog credential remains server-side
### Requirement: Walkable neon room
The room SHALL show lit cabinets with game artwork, neon signs and a cinematic entrance. Desktop and touch controls SHALL move and turn the player, with collision boundaries and a selected-game launch control.
#### Scenario: Walk to a cabinet
- **WHEN** the player moves near a cabinet and points at it
- **THEN** its name appears and the play control opens its game
#### Scenario: Phone layout
- **WHEN** the room opens at 390 by 844
- **THEN** the move pad and play control remain usable without horizontal overflow
#### Scenario: Rendering unavailable
- **WHEN** WebGL cannot initialize
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
