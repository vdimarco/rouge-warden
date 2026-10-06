## ADDED Requirements

### Requirement: Buildings wear different kinds of windows
In flat play on desktop and phone, the city's buildings SHALL show several kinds of windows, not one window repeated:
tall narrow sashes, ribbon bands, pairs per bay, glass curtain walls with mullions, small punched windows, big
multi-pane factory windows, and the painted atlas windows. The street floor SHALL keep its shop fronts and lobbies.

#### Scenario: A street of homes
- **WHEN** the player stands in a street of the brick or stone districts and looks at the buildings on both sides
- **THEN** neighbouring buildings show visibly different window shapes (for example tall sashes beside punched windows
  or paired windows), not the same window in every building

#### Scenario: Towers from a roof
- **WHEN** the player looks across the financial district from a roof
- **THEN** some towers show curtain walls with mullions, some ribbon bands, and some separate windows

#### Scenario: The same building every time
- **WHEN** the player looks at the same building again, from any distance and after a reload
- **THEN** it wears the same window kind, size, frame colour and glass tint, and nothing flickers as the view moves

### Requirement: The window kind is stable and suits the building
Which window kind a building wears SHALL come from a stable hash of its seed, limited to kinds that suit its window
style (towers, brick, stone, concrete, loft, condo).

#### Scenario: A brick home never wears a curtain wall
- **WHEN** the player looks at any brick, stone or loft building
- **THEN** it shows no glass curtain wall; curtain walls appear only on glass towers and condos

### Requirement: Each building varies its window details
Each building SHALL vary, by its seed: the window width and height in the bay, the number of panes, the frame colour
(ink, white, cream, green, oxblood, bronze, teal or navy), the dark glass tint (blue, teal, green, bronze or slate) and
the pattern of lit rooms (scattered, whole floors, vertical stacks or blocks of rooms). Homes SHALL sometimes show
arched heads, stone sills and lintels, and shutters beside the windows.

#### Scenario: Frames and glass at mid distance
- **WHEN** the player swings past a row of buildings 30 to 80 m away
- **THEN** frames of different colours and glass of different tints are visible on different buildings

#### Scenario: Lights at dusk
- **WHEN** the player looks at several towers
- **THEN** some show lit rooms scattered, others whole lit and dark floors or lit columns

### Requirement: Each window looks into its own room
Up close, the windows of every family but the painted atlas SHALL show a room behind the glass, drawn in the shader with
no new geometry. The view ray SHALL meet the room's back wall, side walls, floor or ceiling, so the room shifts with the
view. Each window's hash SHALL pick its own wall paint, floor, depth (2.6 to 6 m) and lamp position.

#### Scenario: Swinging past a row of windows
- **WHEN** the player swings past a building 10 to 30 m away
- **THEN** neighbouring windows show different rooms, and each room's walls and furniture shift with the view

#### Scenario: Far away
- **WHEN** the same building is 150 m or more away
- **THEN** the rooms fade to the window's average tone and nothing shimmers

### Requirement: Rooms have contents and light
Each room SHALL show, from its hash: a picture, a bookshelf or a door on the back wall; a sofa, a table or a cabinet
against it; sometimes a person in a lit room; sometimes a pot plant; and curtains or a valance on about half of them.
A lit room SHALL take its own lamp colour with a brighter pool under the lamp. A dark room SHALL mostly show the
building's glass tint and the sky in it.

#### Scenario: Lit and dark rooms
- **WHEN** the player looks at a building with some rooms lit
- **THEN** lit rooms glow in their lamp colour with furniture and curtains visible, and dark rooms read as dark glass

### Requirement: The building's shape and wear vary
Some towers SHALL stand on a podium of one to three floors in stone (limestone, granite or red sandstone) with their own
window family. Some homes and slabs SHALL have blank bays, where the wall runs on with no window. Walls SHALL show broad
two-tone patches of paint, and some buildings SHALL show rain streaks under their windows.

#### Scenario: The foot of a tower
- **WHEN** the player stands in front of a tall tower
- **THEN** on some towers the lowest floors above the street are stone with different windows from the floors above

#### Scenario: A worn wall
- **WHEN** the player looks at a home up close
- **THEN** on some homes dark streaks run down the wall under the windows, and the paint is not one flat tone

### Requirement: Top floors can differ
Some homes SHALL show a different top floor from the floors below (arched windows, small attic windows or round
windows), and some SHALL show a cornice with dentils and an ink line under the top of the wall.

#### Scenario: Looking up at a home
- **WHEN** the player looks up at a brick or stone building of five floors or more
- **THEN** on some such buildings the top floor's windows differ in shape from the floors below, or a cornice crowns the wall

### Requirement: The comic look and the budget hold
The new window detail SHALL keep the comic look: flat colour bands, ink lines and halftone dots, with all patterns
anchored in face metres or cell coordinates (no screen-space patterns). Detail SHALL fade to its average tone where it
would shimmer. Flat play SHALL stay under 800k triangles and 120 draw calls per view; the change SHALL add no geometry,
texture or draw call. The LOW path and the look without the atlas SHALL still draw window families, frames and bars.

#### Scenario: The perf check
- **WHEN** `qa/vr/perf.mjs` runs its named shots in flat play
- **THEN** every view stays under 800k triangles and 120 draw calls

#### Scenario: The render check
- **WHEN** `qa/vr/render.mjs` runs
- **THEN** ink lines still run along the building edges, the ink stays under 35 % of the canyon rows, and no shader reads `gl_FragCoord`

#### Scenario: Before and after shots
- **WHEN** `qa/vr/facade-shots.mjs` runs at desktop size and with `PHONE=1`
- **THEN** the street, avenue and roof shots show the window families, and they read as comic panels (flat bands, ink, dots)
