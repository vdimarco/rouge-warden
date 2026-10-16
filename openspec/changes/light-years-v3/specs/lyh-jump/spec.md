## ADDED Requirements

### Requirement: Arming and the run-up
When a place's exit opens, its exit gate SHALL light with the next place's name and distance, that place SHALL show in the sky as a thin ring with a leader line and label in its real direction, and the action chip SHALL offer JUMP. Driving through the gate or tapping JUMP SHALL raise three launch rings at 60, 140 and 240 u, each bending at most 40° toward the target, with boost speed for free. A missed ring SHALL re-form 80 u ahead with no penalty.

#### Scenario: Three rings to light speed
- **WHEN** the player taps `JUMP → COMA` at the Wall
- **THEN** three launch rings appear ahead on an arc toward Coma's ring, the ship runs at boost speed without spending the bar, and each ring passed plays a rising tone (3, 2, 1) over a rising riser

#### Scenario: The target is behind
- **WHEN** the player taps JUMP while facing away from Coma
- **THEN** the first ring waits and the hint reads `TURN TOWARD COMA` until the nose comes round

### Requirement: A run-up that cannot go wrong
The rim SHALL not turn the ship back in the run-up, so rings past the rim are reachable. In Cruise the steering SHALL lean toward the next ring when the stick is near the centre, and on touch a ring SHALL count within 2 ring radii. Only a tap of the action chip SHALL call the run-up off; braking never does. When WHICH WAY HOME earns the fix while the ship faces Coma (within 60°), the run-up SHALL start there and then.

#### Scenario: Through the exit gate
- **WHEN** a player drives through the Wall's exit gate at the rim (or Coma's) from any side, on touch or keys, and steers at each ring
- **THEN** the ship is never turned back, misses at most one ring, and LIGHT SPEED comes within 8 s of the gate

#### Scenario: The fix earned facing Coma
- **WHEN** the third far scan lands while the nose points within 60° of Coma
- **THEN** the exit opens and the three launch rings rise ahead at once, with no drive to the gate

#### Scenario: Calling it off
- **WHEN** the player taps the small `JUMPING · TAP TO CANCEL` chip during the run-up
- **THEN** the rings go away and free drive goes on
- **AND** holding the brake to line up a ring never calls it off

### Requirement: The punch
Passing the third ring SHALL punch to light speed: 120 ms of stillness, a white flash (0.8 alpha, 0.3 under reduced motion), the caption LIGHT SPEED with the current word in orange, shake, lines rushing in toward the point ahead, the stars swinging forward with the real aberration, and the radio of the place left groaning down by the real Doppler factor. Input SHALL lock for 0.4 s and the old place SHALL be freed from the GPU.

#### Scenario: Punching out of the Wall
- **WHEN** the ship passes the third launch ring at the Wall
- **THEN** sound stops for 120 ms, then a deep boom and a rising hiss play under a white flash and `LIGHT SPEED`, the stars gather forward, and steering returns 0.4 s later

### Requirement: Words over the white
The flash SHALL sit under the HUD, and the HUD's words SHALL get a dark outline while the screen is white. Toasts and On Earth cards SHALL wait until the white has gone.

#### Scenario: Reading through the flash
- **WHEN** the punch whites out the screen
- **THEN** `→ COMA` and Earth's date stay readable over the white, and `EXIT OPEN` or the first On Earth card shows only once the white has gone

### Requirement: The free corridor
In the run the ship SHALL fly down a tube of light, and the player SHALL steer it across and up or down with the same stick, keys or gamepad and the same rate steering as in the places, never by position mapping. Knots, rails, walls with gaps, gates and light pads from real structure SHALL come at the ship: grazes, hairlines, threads and pads raise its speed and a hit lowers it. The tube's edge SHALL hold the ship in without a hit. Gas SHALL do nothing; boost SHALL spend the bar for speed.

#### Scenario: Same thumb, same stick on a phone
- **WHEN** a player at 390×844 or 844×390 steers in the corridor with the floating stick they drove with
- **THEN** stick left and right move the ship across the tube, stick up and down move it up and down, at the same rates as in the place, and the first jump shows one hint saying so

#### Scenario: Keys and gamepad in the corridor
- **WHEN** a player at 1440×900 steers with A and D and climbs with R and F, or uses a gamepad's left stick
- **THEN** the ship moves across and up or down the tube at those rates, Shift or A boosts, and W does nothing

#### Scenario: Grazes and threads
- **WHEN** the ship grazes a galaxy knot, then threads the gap in a wall, then hits a rail head-on
- **THEN** the graze plays the zzip at a higher pitch than in the places and raises the speed, the thread raises it more with a THREAD callout, and the hit costs speed and the chain with a muffled thud

#### Scenario: The wall of the tube
- **WHEN** the player holds full steer to one side for 3 s
- **THEN** the ship slides along the tube's edge and stays inside the tube, with no hit

### Requirement: A clear view down the tube
As gas does nothing in the corridor, the GAS pedal SHALL leave the screen there. Callouts (GRAZE, TWO NINES) and the corridor hint SHALL sit above the ship, clear of the low vanishing point the hazards come from.

#### Scenario: Looking down the tube
- **WHEN** a player at 390×844 grazes a knot in the corridor
- **THEN** GRAZE shows above the ship, no GAS pedal shows, and nothing covers the point the hazards come from

### Requirement: Speed in the run and the nines
The run SHALL enter at rapidity 2.0 (0.964c), never fall below 1.8 (0.947c) and never pass 4.0 (0.9993c). The HUD's top band SHALL show the jump, the speed as a fraction of light speed with its nines, Earth's date running and the player's own time. Crossing 0.99c SHALL call TWO NINES; crossing 0.999c SHALL call THREE NINES and light the Headlight: 0.4 s at 0.35 speed with the sky punched brighter and score doubled while above it.

#### Scenario: A jump cannot be failed
- **WHEN** the player hits every hazard in jump J1
- **THEN** the ship never drops below 0.947c, arrives at Coma City, and the result shows a bronze medal

#### Scenario: THREE NINES
- **WHEN** the player's grazes and boosts take the ship past 0.999c
- **THEN** a three-note chord plays, THREE NINES shows, time slows to 0.35 for 0.4 s, and a small blue-white light burns at the centre of the view

#### Scenario: The top band in J2
- **WHEN** the player rides J2 at 390×844
- **THEN** the top band reads `J2 · COMA → VIRGO · 272 MLY` with the speed, Earth's date falling from `330 MILLION YEARS AGO` and the player's own clock, inside the safe area

### Requirement: Real aberration and Doppler
The jump SHALL draw the sky and every hazard with the real aberration, Doppler colour and beaming of `render/points.js`: things ahead blue-white, things beside the ship gathered on one ring round the view, and things passed reddening toward the edges without vanishing. The radios SHALL play at the Doppler factor, held between 0.125 and 2.0: the place left sinks at the punch and the place ahead comes in high at the drop-out and settles.

#### Scenario: Blue is coming, red is passed
- **WHEN** a galaxy knot comes up the corridor and passes the ship
- **THEN** it comes out of the centre blue-white, crosses the ring, and leaves toward the edge in red while staying visible

### Requirement: Forks
J2 and J3 SHALL each offer a fork: a wall with two labelled gaps on opposite sides of the tube, `FILAMENT · CALM` and `KNOTS · ×1.5` in J2 (at about 55% of the run) and `SHEET · CALM` and `GIANTS · ×1.5` in J3 (at about 40%). The gap the player takes SHALL set the next quarter of the run, and neither SHALL be wrong.

#### Scenario: Taking the risky way
- **WHEN** the player steers through `KNOTS · ×1.5` in J2
- **THEN** the next quarter brings denser knots and scores 1.5 times, and the arrival is the same as by the calm way

### Requirement: Vista, drop-out and arrival
Four seconds before the end, the vista SHALL slow time to 0.4 for 1.0 s with the destination's ring and label in the centre while Dot names it. The drop-out SHALL ease the rapidity to 0 over 2.2 s while the stars stream out, take back their colours and the place swells into view. The ship SHALL arrive at the place's entry at 42 u/s with nothing covering the view for 1 s, then the medal toast for 3 s, the scale card and Earth's settled date.

#### Scenario: Arriving at Coma on each screen
- **WHEN** J1 ends at 390×844, 844×390 and 1440×900
- **THEN** Coma City swells into view with nothing over it for 1 s, then a toast such as `SILVER · 0.9962c` shows inside the toast slot and the scale card follows in the info box
- **AND** a screenshot of the drop-out at each size shows the place, not a blank or black frame

### Requirement: Length and medals
J1 SHALL last 18 s with a gentle first 6 s, J2 26 s and J3 25 s. A jump SHALL never fail. Bronze SHALL be for arriving, silver for reaching 0.99c with 2 hits or fewer, gold for reaching 0.999c, and Tern for holding 0.999c for 4 s with no hits. The medal SHALL set the boost bar the ship arrives with: 0.5 for bronze, 0.75 for silver and full for gold or Tern. The best jump SHALL be kept as a ghost.

#### Scenario: Jumps pay
- **WHEN** the player arrives from a jump with a silver
- **THEN** the boost bar starts the place three-quarters full

#### Scenario: Bot targets
- **WHEN** the still, mid and expert jump bots ride each jump on 20 seeds
- **THEN** the still bot always arrives, the mid bot reaches 0.99c in at least 90% and 0.999c in 30% to 50%, and the expert bot reaches 0.999c in at least 90%

### Requirement: Loading behind the jump
The next place SHALL load while the player drives: its modules when the exit gate opens, its data built in a worker, and GPU uploads in slices of at most 6 ms during the run. The vista SHALL wait for the place. If it is late, the run SHALL add stretches of 5 s with hazards, at most three, then drop out with simple fallback art while loading finishes. Only one place SHALL be on the GPU at a time.

#### Scenario: A slow load
- **WHEN** a test forces a 12 s slow load during J1
- **THEN** the run adds 5 s stretches until the place is ready and the arrival is clean, with no frozen frame

#### Scenario: Memory stays flat
- **WHEN** the chapter bot plays Wall → J1 → Coma → J2 → Virgo
- **THEN** GPU memory after each arrival is within 10% of the first arrival's
