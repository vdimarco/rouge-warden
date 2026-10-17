## ADDED Requirements

### Requirement: The premise told while driving
The game SHALL open on the misfire: KIT · "Moon and back. Don't be long." over the fold's white flash, then a 1 s drop-out that leaves the Tern on the Wall's Sloan Road at 38 u/s with control from 0.3 s. The premise SHALL come in six short lines while the player drives, never in a cutscene. The game SHALL say what is made up (the misjump, the people, the scale inside a place) and what is real in Dot's first minute, the help text and the end card.

#### Scenario: The first four seconds
- **WHEN** a new player taps PLAY at 390×844 and touches nothing else
- **THEN** three galaxies pass within 2 ship lengths in the first 4 s, each with a zzip and a NEAR tick, and at 2.5 s the caption reads DOT · "YOU'RE AWAKE. KEEP DRIVING. IT HELPS."

#### Scenario: The premise in order
- **WHEN** the player drives the Wall for the first minute away from Node 0
- **THEN** Dot says "That wasn't the Moon.", then "Each of those is a galaxy." after the first galaxy scan, then "We're a billion light-years out.", "I think I mixed up the units." and "The fold threw us back in time too.", each at least 8 s after the last
- **AND** when the chase starts first, the premise lines left go to the log

### Requirement: Earth's clock
The HUD SHALL show Earth's date as today minus the light-years of route still ahead. It SHALL move only in jumps and hold still in places. For a player on 13 October 2026, arrivals SHALL read 1.07 billion years ago at the Wall, 330 million at Coma, 57.8 million at Virgo and 2.5 million at the Andromeda edge. Moments of Earth's history SHALL show on On Earth cards as the date passes them, at most one every 3 s.

#### Scenario: The clock runs in J1
- **WHEN** the player rides J1 from the Wall to Coma
- **THEN** the top band runs Earth's date down from `1.07 BILLION YEARS AGO` to `330 MILLION YEARS AGO`, On Earth cards for the first seaweeds, Snowball Earth, early animals, plants on land and the first four-legged animals pop in in that order, and Dot says "Earth's clock runs. We land when we left."

#### Scenario: The clock holds still in a place
- **WHEN** the player drives round Coma City for five minutes
- **THEN** Earth's date stays at `330 MILLION YEARS AGO`

### Requirement: Talk while driving
Every line SHALL be 2 to 8 words and at most 44 characters, shown as a bold uppercase karaoke caption with the current word in orange and a small grey speaker tag. While driving, lines SHALL come at most one every 8 s and never in the 2 s round a gate, a hit or a takedown. Mission lines SHALL beat Dot's, which beat Redshift's. A line that waits over 6 s SHALL be dropped to the log, and the action control SHALL skip a line to the log.

#### Scenario: Spacing
- **WHEN** a scripted 120 s run at the Wall plays
- **THEN** no two lines start less than 8 s apart, apart from Kit's opening line, and none starts within 2 s of a gate, a hit or a takedown

#### Scenario: Skipping a line
- **WHEN** a line is playing and the player taps the action control
- **THEN** the line stops at once and its text goes to the log

#### Scenario: Captions mark the current word
- **WHEN** any line plays
- **THEN** its words appear in 2 or 3 word chunks in bold uppercase with the current word in orange, under a small grey tag naming the speaker, and the same text goes to an `aria-live` line

### Requirement: Lines stay in their place
A line about one place SHALL never play in the next: at an arrival, what the last place was still waiting to say SHALL go to the log, and only the jump's own lines carry over.

#### Scenario: Arriving with words left
- **WHEN** Redshift's wake-up line is still waiting when the ship drops out at Coma
- **THEN** it goes to the log and never plays at Coma

### Requirement: The cast
The Chapter 1 voices SHALL be Dot (the ship's AI), Kit (at home), Ferro (a hauler with a heavy tug), Vela (a racer who flies the Swift and calls the player "bird"), Redshift (the DJ of Light Years FM) and the Magpies (a gang that steals shiny things), each with its own tag and blip pitch. Redshift SHALL speak at most once every 40 s and only about what the player did: a chain of 10 or more, a first gold or Tern medal, a takedown, a hairline at 40 u/s or more, or FIRST SHOUT.

#### Scenario: Redshift reacts
- **WHEN** the player takes down a Magpie in Coma and Redshift has been quiet for 40 s
- **THEN** REDSHIFT · "TAKEDOWN IN COMA. RUDE. LOVE IT." plays when the 2 s round the takedown have passed

### Requirement: Missions are driving problems
Every mission beat SHALL be a driving problem: a chase, a catch on the move, a tow, a delivery, a takedown, a far scan or a ride. A beat that only asks the player to get somewhere SHALL take under 15 s at cruise or carry pads, sparks, traffic or a target on the way. A mission SHALL start when the player drives through its giver's ring, taps TAKE JOB within 6 s of a radio call, or continues a thread already taken, in which case it starts by itself.

#### Scenario: Starting by driving
- **WHEN** the player drives through the `FERRO · SOS` ring in Coma City
- **THEN** PELICAN DOWN starts with no menu and its first objective shows in the mission line

#### Scenario: A radio call
- **WHEN** Ferro calls 6 s after the player arrives in Coma City
- **THEN** a TAKE JOB chip shows for 6 s, and a tap on it starts the job wherever the ship is

#### Scenario: A thread that continues
- **WHEN** the player arrives in Virgo
- **THEN** THE STRAIGHT RAY starts by itself 2.5 s after the arrival with no ring to drive to

### Requirement: Failing is cheap
A failed beat SHALL show its toast and retry by itself 1.2 s later from its checkpoint, at most 60 s back, with the ship, actors, cargo and clocks as they were there. After 3 fails at one checkpoint SKIP THIS PART SHALL appear, and a skipped beat SHALL finish the mission with no medal. Timed missions SHALL allow 2.0 times the author time, enough for a beginner who never drifts and boosts only on a full bar.

#### Scenario: A quick retry
- **WHEN** the Pelican sinks into NGC 4889 during PELICAN DOWN
- **THEN** a toast shows, and 1.2 s later the ship is back at the beat's checkpoint at the speed it had there

#### Scenario: Skip after three fails
- **WHEN** the player fails the same beat three times
- **THEN** SKIP THIS PART shows on the action chip, and taking it finishes the mission with no medal

#### Scenario: Beginners finish in time
- **WHEN** the beginner bot plays every timed mission on 5 seeds
- **THEN** it finishes each one inside its limit

### Requirement: WHICH WAY HOME
At the Wall a Magpie SHALL steal the star chart near Node 0. The player SHALL ram it (any contact closing at 6 u/s or more takes it down), drive through the tumbling chart, then aim at the Coma, Leo and Hercules clusters far away and hold each for 3 s. The third scan SHALL earn the fix and open the exit gate `COMA CLUSTER · 737 MLY`, starting the run-up at once when the ship faces Coma. The mission SHALL give no medal.

#### Scenario: Which way is home
- **WHEN** the player has the chart and holds each far orange ring in the nose for 3 s
- **THEN** Dot rules out Leo and Hercules, names Coma, says "Light-years. Checked twice.", and the exit gate lights with `COMA CLUSTER · 737 MLY` and the chip `JUMP → COMA`

#### Scenario: It got away
- **WHEN** the Magpie stays more than 200 u ahead for 6 s
- **THEN** the toast reads `IT GOT AWAY` and the chase retries from its checkpoint

### Requirement: The chase starts soon and can be won
The ambush SHALL start when the player drives into Node 0's ring (the first orange objective, labelled `NODE 0`) from 12 s of play, within 150 u of Node 0 from 25 s, or anywhere at 80 s. In Cruise the Magpie SHALL run 3 u/s slower than the Tern within 60 u (never under 18 u/s), slow to 22 u/s when 100 u ahead and tire on its tail, so a phone player on auto-cruise catches it; GAS or boost SHALL catch it sooner.

#### Scenario: The first objective leads somewhere
- **WHEN** a new player follows the orange `NODE 0` ring from PLAY with no other input
- **THEN** the Magpie ambush starts as the ship enters the ring, at about 13 s

#### Scenario: Caught on auto-cruise
- **WHEN** a phone player chases the Magpie with the stick only, never touching GAS or BOOST, on 5 seeds
- **THEN** the Magpie is taken down within 30 s each time, and holding GAS does it faster

#### Scenario: The chase comes to the player
- **WHEN** a player has not gone near Node 0 by 80 s
- **THEN** a Magpie comes out 40 u ahead with MAGPIE · "OOH, SHINY STAR CHART. MINE!" and the objective `CATCH THAT MAGPIE`

#### Scenario: A beginner can catch it
- **WHEN** the beginner bot chases the Magpie on 5 seeds in Cruise
- **THEN** it takes the Magpie down within 30 s each time, because the Magpie slows to 22 u/s when 100 u ahead

### Requirement: Story missions at Coma and Virgo
In Round 2, PELICAN DOWN at Coma SHALL ask the player to find Ferro's tug, hook on before it sinks into NGC 4889, sling it out of the giant's pull and haul it to the yard past three Magpies; it SHALL earn the fix to Virgo. THE STRAIGHT RAY at Virgo SHALL ask the player to catch Ferro's crate, carry the lens down to M87, zoom in, ride the jet, shake the Magpies with Vela's help and drop the lens at the lobe; it SHALL earn the fix to Andromeda.

#### Scenario: PELICAN DOWN with one thumb
- **WHEN** a player at 390×844 plays PELICAN DOWN with the one-thumb scheme and the Cruise assists
- **THEN** the hook-on is automatic, the sling works with a held turn, and the mission finishes inside its 72 s haul limit

#### Scenario: The tug sinks
- **WHEN** the player never hooks the sinking Pelican
- **THEN** it reaches NGC 4889 and the beat fails 18 to 20 s after the hook-on beat starts

#### Scenario: Catching the crate
- **WHEN** Ferro tosses the lens crate across the player's path in Virgo and the player misses it
- **THEN** the crate keeps drifting at 4 u/s and the player can turn back and drive through it

### Requirement: Side jobs
The Wall SHALL hold FIRST SHOUT, Redshift's stunt request: a tier 2 drift at Sloan Bend and two stars at Void Run, raised to one star above the player's best when they already hold that. Coma SHALL hold FRAGILE, Ferro's glass delivery through the Inner Ring, which breaks at 4 contacts (Round 2). Side jobs SHALL reward a card and a tape or hull stripe, and they SHALL never block the story.

#### Scenario: FIRST SHOUT raises the bar
- **WHEN** Redshift offers FIRST SHOUT to a player who already has two stars at Sloan Bend and Void Run
- **THEN** REDSHIFT · "ALREADY DID IT? DO IT LOUDER." plays and the targets become three stars

#### Scenario: The glass breaks
- **WHEN** the player hits traffic four times above 6 u/s while carrying FRAGILE's glass
- **THEN** the toast reads `THE GLASS BROKE` and the job retries from its checkpoint

### Requirement: The chapter end card
Arriving at the Andromeda edge SHALL end Chapter 1 with a card over the live view: CHAPTER I · THE WEB, Earth's date, the player's time and Earth's time, medals, scans and secrets, YOUR SPEED, FOR REAL in nines of light speed, CHAPTER II · NEIGHBOURS · COMING, and KEEP DRIVING, LOG and ARCADE. Under it SHALL read THE MISJUMP IS MADE UP. THE REST IS REAL. with a link to the sources.

#### Scenario: The end of the chapter
- **WHEN** the player drops out of J3 at the Andromeda edge after 41 minutes of play
- **THEN** the end card shows `EARTH · 2.5 MILLION YEARS AGO` and `YOUR SPEED, FOR REAL: 26 NINES`, and its medals, scans and secrets match the save

#### Scenario: Keep driving
- **WHEN** the player taps KEEP DRIVING
- **THEN** the card closes, the ship flies on at the Andromeda edge, and CONTINUE later lands there
