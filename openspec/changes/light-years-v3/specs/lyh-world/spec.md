## ADDED Requirements

### Requirement: Chapter 1 places
Chapter 1, "The Web", SHALL take the player from The Wall (a pit stop 450 u in radius) through jump J1 to Coma City (700 u), through J2 to Virgo (700 u) with M87's jet as a pocket to zoom into, and through J3 to the Andromeda edge, where the chapter ends. Each place SHALL be a diorama at its own map scale with real landmark directions and facts, built from data modules that pass a schema check.

#### Scenario: The opening place
- **WHEN** the player taps PLAY
- **THEN** the Tern drops out at 38 u/s onto the Sloan Road at the Wall's south rim, heading north in a river of small galaxies that flow the same way

#### Scenario: Arriving in Coma City
- **WHEN** the player drops out of J1
- **THEN** the Tern enters 18 u above Coma City's plane at 42 u/s on the dive road facing downtown, with two warm giant galaxies at the centre and galaxies orbiting them on the Inner Ring at 28 u/s
- **AND** three galaxies pass within 2 ship lengths by about 3 s with no input, and in Cruise the height assist follows the dive's spark line down to the plane, where most of the city's galaxies are

#### Scenario: Zooming into the jet
- **WHEN** the player drives through the M87'S JET ring in Virgo
- **THEN** the view zooms into the pocket over 1.5 s (a 0.2 s dip under reduced motion), and the ZOOM OUT ring or chip brings the player back to Virgo beside M87 at once

### Requirement: Round 1 holds back later work
Data for a later build round (marked `round: 2`) SHALL stay out of play until that round. In Round 1 Coma City SHALL be a free-drive place with traffic, giants, sparks, scans, the Ghosts set, its secrets and Look Home, and none of its jobs, races, stunts, start or giver rings, radio calls or Vela; PELICAN DOWN and FRAGILE wait for Round 2.

#### Scenario: Round 1's Coma
- **WHEN** the player drives Coma City for 30 s in Round 1
- **THEN** no radio call, TAKE JOB chip, giver ring, start ring, stunt or Vela appears, and no orange objective points at a job that is not there yet

### Requirement: Scale said plainly
Every arrival SHALL show the place's scale card in the grey info box for 4 s, starting 1 s after the drop-out: `EACH POINT HERE IS A GALAXY · 1 SHIP = 50,000 LIGHT-YEARS` at the Wall, the same with 7,000 light-years at Coma and Virgo, `M87'S JET · 1 SHIP = 5 LIGHT-YEARS` in the pocket and `THE LOCAL GROUP · NOT TO SCALE` at the end. The map SHALL show the same line.

#### Scenario: The scale card on each screen
- **WHEN** the player arrives at Coma City at 390×844, 844×390 and 1440×900
- **THEN** the card shows for about 4 s in the info box: under the captions on the left in portrait, in the shared hint slot in landscape with hints waiting, and under the toast on desktop
- **AND** it overlaps no other HUD element

### Requirement: Always something near
Each place SHALL offer a small new thing about every 10 to 15 s of cruising and a big one every 30 to 40 s. Every point in a place SHALL have a small thing within 280 u and a big thing within 700 u. A skim surface SHALL come within 15 s of every arrival, and any story leg longer than 250 u SHALL carry sparks or pads. The Wall's two voids SHALL stay empty on purpose, with no point more than 150 u from a road.

#### Scenario: Wandering finds things
- **WHEN** 20 wander bots drive each place for 120 s
- **THEN** they meet a new thing every 40 s on average and never wait more than 75 s

#### Scenario: Traffic to skim everywhere
- **WHEN** the game's wander bot drives the Wall and Coma City for a minute each on 3 seeds
- **THEN** it meets at least 6 near misses a minute in each, because Coma's galaxies gather downtown and half of them sit within 2.5 u of the plane

#### Scenario: The first giant comes fast
- **WHEN** a new player drives the Sloan Road from the opening drop-out with no input
- **THEN** the Bend Giant, a skimmable giant galaxy, comes within about 7 s

### Requirement: Hands-free scanning
Holding a target in the nose cone (25°, 0.8 s, within 30 u plus 3 times its radius) SHALL scan it, and far targets SHALL need a 6° cone (10° in Cruise) held for 3 s at any range. In Cruise, passing within 12 u plus 3 times the radius SHALL scan. There SHALL be no scan button. A scan SHALL turn the dotted ring solid with a leader line and a small label, show the card's number in the info box for 3 s, and keep the card's text in the log.

#### Scenario: A ring the player draws
- **WHEN** the player holds the nose on a galaxy with a dotted ring for 0.8 s
- **THEN** the ring turns into a thin solid ring with a diagonal leader line and a small label, a two-note "got it" plays, and the bar gains 0.05

#### Scenario: A far scan while driving
- **WHEN** the player keeps a far orange ring within 6° of the nose for 3 s
- **THEN** an arc fills round it, a three-note "got it" plays and its label appears

#### Scenario: Scanning by passing in Cruise
- **WHEN** a player on the Cruise assists passes within 12 u plus 3 times a target's radius
- **THEN** the target is scanned without aiming

#### Scenario: Cards never cover play
- **WHEN** a scan finishes while the player drives
- **THEN** no card pops up over the view; the info box shows a number such as `21 BILLION SUNS` for 3 s and the log gets an orange dot

### Requirement: Sourced fact cards
Every scan, place, mission, secret and postcard card SHALL hold at most 25 words with a source link, and a card with no source SHALL fail the tests. Chapter 1 SHALL hold 24 scans (7 at the Wall, 8 at Coma, 9 at Virgo and in the jet), 3 place cards and 3 Look Home postcards.

#### Scenario: Reading a card
- **WHEN** the player opens LOG in the ship log after scanning NGC 4889
- **THEN** its card reads in at most 25 words with its number and a link to its source

### Requirement: Rumours, secrets and sets
Some scans, jobs and race wins SHALL give a rumour, a grey card that makes a hidden place show a faint ring. Secrets SHALL pay knowledge first, a card and then a vista, lens or trail colour: The Overlook at the Wall, Zwicky's Clue and The Ghost at Coma, and The Shadow in the jet. Coma's 8 Ghosts SHALL shimmer and show on the radar from 250 u and draw in full inside 80 u, and Virgo's Messier's 14 SHALL count by scanning.

#### Scenario: The Overlook
- **WHEN** the player scans the Sloan Road and later climbs to 110 u or more within 60 u of the dotted ring over Void West
- **THEN** the rumour "From high enough, you'd see the whole wall." comes first, and then the camera pulls back over the wall's length and the Sloan Great Wall card opens in the log

#### Scenario: Zwicky's Clue
- **WHEN** the player holds the rumour "Ride with one downtown. You'll see." and stays within 4 u of one Inner Ring galaxy for 5 s
- **THEN** the dark matter card opens and a faint violet glow lies over every cluster core from then on

#### Scenario: The Shadow
- **WHEN** the player holds the rumour "Light can orbit it. So can you." and drifts one lap round M87* within 20 u at 26 u/s or more
- **THEN** the photon ring card opens and the photon trail colour is earned

#### Scenario: Hunting the Ghosts
- **WHEN** the player comes within 250 u of one of Coma's 8 Ghosts
- **THEN** a faint shimmer and a radar dot show it, and it draws in full inside 80 u

### Requirement: Sparks
Orange sparks on good lines SHALL be collected by passing within 2.5 u, each with a tick and +0.04 bar: 24 at the Wall, 32 at Coma, 24 at Virgo and 10 in the jet. The log SHALL show a percentage per place and never where the missing ones are.

#### Scenario: A spark line
- **WHEN** the player follows the sparks down the Sloan Road
- **THEN** each spark passed within 2.5 u ticks and adds 0.04 to the bar, and the log's Wall percentage rises

### Requirement: Look Home
In the Wall, Coma and Virgo, aiming within 10° of the orange home chevron for 1 s SHALL give a postcard of Earth in the light that reaches that place, with Dot's line: oxygen building up in the air at the Wall (light 2.07 billion years old), Snowball Earth at Coma (653 million years) and flowers at Virgo (112 million years).

#### Scenario: A postcard at the Wall
- **WHEN** the player aims at the home chevron at the Wall for 1 s
- **THEN** a postcard of Earth with oxygen building up goes to the log and Dot says "Earth's light here: two billion years old."

### Requirement: One objective, the radar and home
There SHALL always be exactly one orange objective with a leader line and a radar mark; with nothing running it SHALL be the story giver's ring, the labelled place where the story starts (`NODE 0` at the Wall), or the exit gate once the fix is earned. The radar SHALL turn with the ship, reach 300 u (420 on boost, 200 near an objective) and show home, the objective, seen start and scan rings, the exit gate, named ships and near set items, never traffic, sparks, unseen events or secrets.

#### Scenario: The radar on each screen
- **WHEN** the player drives at 390×844, 844×390 and 1440×900
- **THEN** the radar sits at the top right under the toast in portrait (72 px), at the top left in landscape (80 px) and at the lower left on desktop (160 px), and a tap or click on it opens the MAP tab

#### Scenario: Home is always marked
- **WHEN** the player is moved anywhere in the Wall and turns away from Earth
- **THEN** an orange chevron at the screen edge points toward Earth with `HOME · 1.00 GLY`, and the radar shows home as an orange tick on its rim

#### Scenario: Never zero, never two
- **WHEN** WHICH WAY HOME's chase is running at the Wall
- **THEN** the Magpie is the only orange objective on screen and on the radar

### Requirement: One label per place, home where it can be shown
Once the exit is open, the next place's ring in the sky SHALL carry the exit's label, so one place never has two labels. Where Earth lies straight out of a place's plane, the home marker SHALL show only while the nose pitches toward it, and the radar SHALL draw no home tick without a bearing.

#### Scenario: One label for Coma
- **WHEN** the exit opens at the Wall
- **THEN** Coma's ring in the sky reads `COMA CLUSTER · 737 MLY`, and no second Coma label shows

#### Scenario: Home straight out of the plane
- **WHEN** the player drives Coma City, where Earth lies along the sky plane's normal
- **THEN** no home marker sits under the ship; it shows while the nose pitches toward Earth, and the radar draws no home tick without a bearing

### Requirement: The ship log
Opening the log SHALL pause the game and show four tabs: MAP (the place in the video's style, home, the exit gate, visited places, and a tap to set a waypoint), JOBS (the objective and open and finished missions), LOG (place cards, scans with sources, rumours and postcards, with an orange dot while something is unread) and RECORDS (medals, best times, stars, jump medals and Vela's tally). Events not yet seen SHALL show only as a count.

#### Scenario: Opening the log
- **WHEN** a desktop player presses Tab or M, or a phone player taps the radar
- **THEN** the game pauses and the log opens on MAP with the place drawn in thin white rings and labels

#### Scenario: Unseen events stay secret
- **WHEN** the player opens RECORDS at Coma before seeing two of its events
- **THEN** those two show only as `2 MORE SIGNALS`
