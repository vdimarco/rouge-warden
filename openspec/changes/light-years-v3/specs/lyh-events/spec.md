## ADDED Requirements

### Requirement: Driving into a ring starts an event
A white start ring SHALL be seen from 400 u with its title and medal pips, armed within 150 u and 60° of the nose, and tick three times from 60 u out. Crossing it within 60° of its direction SHALL start the clock with no countdown and no menu, and set the ship to 30 u/s and a half bar over 0.2 s. An accidental start SHALL cancel quietly. Start rings SHALL hide while a mission runs.

#### Scenario: First Light starts by driving
- **WHEN** the player drives through First Light's start ring at the Wall
- **THEN** three ticks play, the race timer replaces the mission line, and the ship is at 30 u/s with a half bar 0.2 s later

#### Scenario: Every attempt is the same race
- **WHEN** one attempt crosses the start ring at 18 u/s and another at 45 u/s
- **THEN** both have the same speed and bar 0.2 s after the crossing

#### Scenario: An accidental start
- **WHEN** the player crosses a start ring and then turns 100° away for 1.5 s before the second gate
- **THEN** the event cancels with no fail toast and free drive goes on

### Requirement: Gates and splits
A gate SHALL score BULLSEYE within 1.0 u of its centre, PASS inside the ring, CLIP within 2.0 u outside it, and MISS beyond that, adding 3.0 s. Each gate SHALL play the next note of the place's scale, so a clean run is a tune. Split gates SHALL show the time against the best run for 1.4 s, with a sign. Being 120 u off the line for 3 s SHALL show a chevron, and after 6 s SHALL put the ship back at the last gate.

#### Scenario: A bullseye
- **WHEN** the ship passes within 1.0 u of a gate's centre
- **THEN** BULLSEYE shows, the next note of the scale plays, and the bar gains 0.03

#### Scenario: A miss
- **WHEN** the ship passes 3 u outside a gate's ring
- **THEN** a flat note plays and 3.0 s is added to the clock

#### Scenario: Lost off the line
- **WHEN** the ship stays 120 u from the racing line
- **THEN** a chevron points back after 3 s, and after 6 s the ship is put back at the last gate

### Requirement: Four medals
Every timed event SHALL have four medals: Tern (the author time), gold at 1.07, silver at 1.20 and bronze at 1.50 times the Tern time, with floors so the mid bot reaches silver and the beginner bot reaches bronze on 5 of 5 seeds. First Light SHALL be Tern 10.0 s, gold 10.7 s, silver 12.0 s and bronze 15.0 s. EASIER SHALL be offered after three tries with no medal.

#### Scenario: Medal floors
- **WHEN** the expert, mid and beginner bots run each timed event
- **THEN** the expert finishes within 10% of the Tern time, the mid bot gets silver and the beginner bot gets bronze on 5 of 5 seeds

#### Scenario: The result
- **WHEN** the player finishes First Light in 11.4 s
- **THEN** a rising sweep and the medal's chime play and the toast shows a silver with the time

### Requirement: Restart in under two seconds
Holding the action control for 0.35 s SHALL restart the event: control back within 0.6 s and the clock running within 1.6 s of the press, from the same start speed and bar. A tap SHALL put the ship back at the last gate with the clock still running. There SHALL be no rewind in Chapter 1.

#### Scenario: A race restarts in under two seconds
- **WHEN** the player holds the action chip for 0.35 s during First Light
- **THEN** the ship is back before the start ring under control within 0.6 s, and the clock runs again within 1.6 s

#### Scenario: Restart on each device
- **WHEN** the player holds the action chip at 390×844 or 844×390, holds E, Enter or Backspace (or presses Delete once) at 1440×900, or holds X on a gamepad
- **THEN** a ring fills on the chip while held, and the event restarts at 0.35 s

#### Scenario: Back to the last gate
- **WHEN** the player taps the action chip, or Backspace, after clipping a wall
- **THEN** the ship is back at the last gate it passed and the clock keeps running

### Requirement: Ghosts and the pacer
Every timed event SHALL record the player's best run as positions at 20 Hz and draw it as a wireframe ghost, with a pacer for the next medal not yet held and the Tern ghost once gold is held. A ghost SHALL be shareable as a link, under 1 KB for 20 s, that opens the game at the event's start ring with the friend's ghost. Ghosts SHALL keep working after the handling is retuned.

#### Scenario: Ghost and pacer after a finish
- **WHEN** the player finishes First Light with a bronze and starts it again
- **THEN** their own ghost and a silver pacer fly the course beside them

#### Scenario: A ghost link
- **WHEN** a friend opens a ghost link for First Light
- **THEN** the game opens at First Light's start ring with that ghost ready to race

### Requirement: Chapter 1 timed events
Chapter 1 SHALL hold five timed events: First Light (a sprint at the Wall against the D road's traffic), Race the Jellyfish (Coma, against the falling galaxy D100), Ring Road Rush (Coma, against Vela and the outer ring's traffic), Markarian's Chain (Virgo, against Vela's ghost) and Ride the Jet (against the HST-1 blob). Every gate SHALL lie within 40 u of a body, a road or traffic, and none within 55 u of the rim except a finish.

#### Scenario: Race the Jellyfish
- **WHEN** the player rides D100's tail on Race the Jellyfish
- **THEN** the draft adds 5% to top speed and 0.08 bar a second, and D100 finishes in 12.9 s if not passed

#### Scenario: Ride the Jet
- **WHEN** the player catches the HST-1 blob in Ride the Jet
- **THEN** time slows for 0.4 s as its label falls to `1c`, and at the lobe Dot says "It looked faster than light. It wasn't."

#### Scenario: Races run through the world
- **WHEN** the tests walk every gate of every timed event
- **THEN** each gate lies within 40 u of a body, a road or traffic, and a racer on the line passes something within 4 u at least every 3 s

### Requirement: Vela, the rival
Vela SHALL race the player once per full place. At Coma she SHALL fly past 12 s after PELICAN DOWN, close enough to count as a near miss, say "New in town? Race you round." and lead the player in her draft to Ring Road Rush's start. She SHALL race at 1.18 times the Tern time there. In Cruise a bounded pace band SHALL keep the race close and never make her faster than 1.02 times the Tern time. Her first defeat in a place SHALL give a rumour.

#### Scenario: Vela comes to the player
- **WHEN** PELICAN DOWN ends and 12 s pass outside a run-up
- **THEN** a dark sickle-winged ship labelled VELA buzzes past within near-miss range, her line plays, and she flies to her start ring at 24 u/s for the player to follow

#### Scenario: She talks while racing
- **WHEN** the player drafts Vela and then passes her on Ring Road Rush
- **THEN** VELA · "GET OFF MY TAIL." and then "OH, IT'S LIKE THAT." play, within the talk spacing rules

#### Scenario: Beating her pays a rumour
- **WHEN** the player beats Vela at Ring Road Rush for the first time
- **THEN** she says "Hm. Lucky line." and gives the rumour "Ride with one downtown. You'll see."

### Requirement: Stunts
A stunt SHALL start when the ship enters it, with no ring to arm, show a live value under the mission line and end with a result toast and up to three stars. Chapter 1 SHALL hold 14 stunts: drift zones, speed traps at 40, 44 and 47 u/s, an oncoming stretch, Light Lines of boost pads, a skim, slingshots and a thread. ↺ RETRY SHALL stay on the action chip for 6 s and put the ship at the stunt's run-up at 30 u/s with a half bar.

#### Scenario: Sloan Bend
- **WHEN** the player drifts inside the Sloan Bend ring and cashes out a tier 2 drift
- **THEN** the toast reads `SLOAN BEND · ★★`

#### Scenario: Void Run
- **WHEN** the player crosses the Void Run trap at 45 u/s on a drift-boost
- **THEN** the toast shows two stars and the speed, and ↺ RETRY offers a run-up 250 u back

#### Scenario: Sloan Pads
- **WHEN** the player hits all four Sloan Pads within 1.5 s of each other, each within 0.8 u of its centre
- **THEN** each pad plays a rising note with a PERFECT tick and adds speed, and the line scores three stars
