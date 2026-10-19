# first-breath-arcade-machine Specification

## Purpose
The First Breath cabinet on the arcade homepage: its place last in the Action row, its marquee, screen art and attract line, its switcher entry, and its best-run line.

## Requirements

### Requirement: A machine at the end of the Action row
The Cottage Arcade SHALL have a machine for First Breath: `<article class="cab first-breath" data-game="first-breath" data-url="/first-breath/">`, placed after the `ahead-of-the-light` article in `#row` of `public/index.html`, with `"first-breath"` appended to the Action group's `games`. The other rows and the collection controls SHALL stay as they are.

#### Scenario: Start the machine
- **WHEN** a player drops a token in the First Breath machine and presses START, on a phone or a computer
- **THEN** the browser goes to `/first-breath/`
- **CHECK** `qa/arcade/machines.mjs`

#### Scenario: Action has nine games
- **WHEN** a player opens the Action collection
- **THEN** it shows olympus, crimson, tidebreak, moonwell, primordia, river-rush, ahead-of-the-light, light-years-home and first-breath, in that order
- **CHECK** `qa/arcade/groups.e2e.mjs`

#### Scenario: The other rows
- **WHEN** the hall and every other collection are opened
- **THEN** their machines and order are the same as before this change
- **CHECK** `qa/arcade/groups.e2e.mjs`, `qa/arcade/machines.mjs` (part `firstbreath`)

### Requirement: The machine is a whole cabinet
The article SHALL be a copy of the whole `ahead-of-the-light` article with the names replaced: the marquee, the bezel with its screen and on-screen text, the panel with START, the door with two coin slots, and the kick. Both coin slots SHALL be labelled "Drop a token into First Breath".

#### Scenario: The parts of the cabinet
- **WHEN** the First Breath article is read
- **THEN** it has the same parts as its neighbour, with START and two coin slots, and each slot is labelled "Drop a token into First Breath"
- **CHECK** `qa/arcade/machines.mjs` (part `firstbreath`)

### Requirement: The marquee and colours
The machine's marquee SHALL show the name FIRST BREATH in its `<b>` and BE BORN in its `<small>`. A `.cab.first-breath` rule SHALL set `--c1: #5e1c34`, `--c2: #ffc53d` and `--glow: rgba(255, 197, 61, 0.45)`, the game's wine board and marigold accent.

#### Scenario: The marquee
- **WHEN** the homepage is read
- **THEN** the First Breath article's marquee shows FIRST BREATH and BE BORN, and its colours come from `.cab.first-breath`
- **CHECK** `qa/arcade/machines.mjs`

### Requirement: The switcher knows it
`GAMES` in `public/arcade/switch.js` SHALL have the entry `{ id: "first-breath", name: "First Breath", sub: "A baby's journey to birth", url: "/first-breath/", art: "/arcade/key/first-breath.svg", color: "#ffc53d" }` after the Ahead of the Light entry. Its colour SHALL be a token of the game's colour script. The id, title and route SHALL match the cabinet. The game page SHALL load `/arcade/switch.js` and give its Switch game button `data-switch`.

#### Scenario: Switcher on the game page
- **WHEN** a player opens the game switcher from the First Breath title or pause menu
- **THEN** First Breath is listed with the cabinet's id and name and marked as the game being played
- **CHECK** `qa/arcade/machines.mjs`

#### Scenario: All Games search
- **WHEN** a player searches All Games for "baby" or "birth"
- **THEN** First Breath is in the results
- **CHECK** `qa/arcade/machines.mjs`

### Requirement: The cabinet screen
The machine's screen SHALL be `public/arcade/key/first-breath.svg`: hand-drawn as cut paper in the game's palette, viewBox `0 0 480 396`, under 10 KB, with no script, no external reference, no text and no filter. It SHALL show the egg as stacked paper rings with a cream shell in a cloud of paper dots on a wine board (`#5e1c34`), a cream arc round it, and a small marigold (`#ffc53d`) sperm on a cream card coming in, with depth from offset shadow shapes.

#### Scenario: The screen file
- **WHEN** the screen file is checked
- **THEN** it is an SVG under 10 KB with that viewBox and no script, external reference or filter
- **CHECK** `qa/arcade/machines.mjs`

### Requirement: The cabinet screen's alt text
The screen's `<img>` SHALL have the alt text "A cut-paper egg in cream rings and a cloud of paper dots on wine red, with a cream arc round it and a small marigold sperm coming in" and `loading="lazy" decoding="async"`, like its neighbours.

#### Scenario: The screen image
- **WHEN** the First Breath article's screen `<img>` is read
- **THEN** it has that alt text and loads lazily and asynchronously
- **CHECK** `qa/arcade/machines.mjs`

### Requirement: The cabinet line
The cabinet line SHALL read `first-breath.save.v1` inside try/catch. For a finished best run with a score above 0 it SHALL show "BEST " and the score with thousands commas, such as "BEST 61,240". With no finished run, no save, or a broken save, it SHALL show the attract line RACE · GUARD · CRY, which SHALL fit the cabinet screen like its neighbours' lines.

#### Scenario: A best run
- **WHEN** the save holds a finished best run of 61,240
- **THEN** the cabinet line reads BEST 61,240
- **CHECK** `qa/arcade/machines.mjs`, `qa/first-breath/save.test.mjs`

#### Scenario: A run not finished
- **WHEN** the save has no finished run and reached 6 stages
- **THEN** the cabinet line reads RACE · GUARD · CRY
- **CHECK** `qa/first-breath/save.test.mjs`

#### Scenario: The attract line fits
- **WHEN** the homepage shows the First Breath machine with no save at 390 × 844, 320 × 700 and 1280 × 720
- **THEN** the `.hi` line reads RACE · GUARD · CRY and its box stays inside the cabinet's `.screen`
- **CHECK** `qa/arcade/machines.mjs` (part `firstbreath`)

#### Scenario: A junk save
- **WHEN** the save holds text that is not JSON, or storage throws
- **THEN** the machine shows its plain line and the page has no error
- **CHECK** `qa/arcade/machines.mjs`

### Requirement: The page in the arcade
The game page SHALL load `/arcade/quiet.js` as the first script in its `<head>`, then `/arcade/switch.js`, and SHALL load `/arcade/analytics.js` with `data-game="first-breath"`. The title's Play button SHALL be `#play`. The title and pause menus SHALL have a "‹ Arcade" link to `/` and a Switch game button with `data-switch`.

#### Scenario: Back to the arcade
- **WHEN** a player taps "‹ Arcade" on the title or the pause menu
- **THEN** the arcade opens with First Breath selected
- **CHECK** `qa/arcade/machines.mjs`

#### Scenario: Script order
- **WHEN** `public/first-breath/index.html` is read
- **THEN** the first script in `<head>` is `/arcade/quiet.js`
- **CHECK** `qa/arcade/quiet.mjs`

### Requirement: Sound follows the arcade
The game SHALL start its AudioContext on the Play tap, use `navigator.audioSession.type = "playback"` where it exists, follow the arcade's shared mute `arcade.sound` and the M key, and be silent while the page is hidden.

#### Scenario: Hidden page
- **WHEN** the quiet check presses `#play` and then hides the page in the middle of a stage
- **THEN** its sound stops while hidden and the game pauses
- **CHECK** `qa/arcade/quiet.mjs`

#### Scenario: Muted in the arcade
- **WHEN** the arcade's sound is muted and the player opens First Breath
- **THEN** the game starts muted, and captions and rings still show every cue
- **CHECK** `qa/first-breath/smoke.e2e.mjs`

### Requirement: The homepage at three widths
The homepage SHALL be checked at 390 × 844, 320 × 700 and 1280 × 720. At each size, with the Action collection open, the First Breath machine SHALL be the last cabinet in the row, whole, inside the window and not under the sign or the token tray, and START SHALL go to `/first-breath/`. Screenshots of the three sizes SHALL be in the pull request.

#### Scenario: Phone widths
- **WHEN** the check opens `#action` at 390 × 844 and at 320 × 700
- **THEN** the last visible cabinet is first-breath, inside the window and not under the sign or the tray
- **CHECK** `qa/arcade/machines.mjs` (part `firstbreath`)

#### Scenario: Desktop width
- **WHEN** the check opens `#action` at 1280 × 720
- **THEN** First Breath is the last machine, and START opens `/first-breath/`
- **CHECK** `qa/arcade/machines.mjs` (part `firstbreath`)

#### Scenario: Screenshots for the pull request
- **WHEN** the `firstbreath` part runs with `SHOTS` set
- **THEN** it saves `home-390.png`, `home-320.png` and `home-1280.png` with the machine in the Action row, and they are attached to the pull request
- **CHECK** `qa/arcade/machines.mjs` (part `firstbreath`), the pull request description

### Requirement: Homepage controls stay big enough
At the same three sizes, the coin slots, START, the row arrows, the collection buttons and the All Games button SHALL be at least 44 px on the shorter side, and the other groups' machines SHALL be unchanged.

#### Scenario: Control sizes
- **WHEN** the check measures `.slot`, `.start`, `#prevBtn`, `#nextBtn`, every `.section-nav button` and `.all-games` at each size
- **THEN** each is at least 44 px on its shorter side
- **CHECK** `qa/arcade/machines.mjs` (part `firstbreath`)

#### Scenario: Other groups unchanged
- **WHEN** each other group is opened at each size
- **THEN** its members are the same as before this change
- **CHECK** `qa/arcade/machines.mjs` (part `firstbreath`)

### Requirement: The pull request states what was not checked
The pull request SHALL list which checks ran, and SHALL say plainly which did not: real phones, real touch latency, phone speakers and the iPhone silent switch.

#### Scenario: Device checks
- **WHEN** the pull request is opened
- **THEN** its description names each device check that did not run
- **CHECK** the pull request description
