## ADDED Requirements

### Requirement: Show the ending before the result card
Small Worlds SHALL keep the scene moving after a world ends, and then show the score and how it compares with the player's best.

#### Scenario: An outro with input off
- **WHEN** a world ends
- **THEN** the scene keeps moving at half speed for 1.6 s, input does nothing, and no card covers the scene

#### Scenario: The card compares the score with the best
- **WHEN** the outro ends
- **THEN** a card rises from the bottom with the score and one of "Your first score in this world.", "New best. Your old best was N.", "You matched your best." or "N short of your best, M."

#### Scenario: A loss sounds like a loss
- **WHEN** a world ends in a loss
- **THEN** the card plays a falling pair of notes instead of the rising chime of a win

### Requirement: Today's world
Small Worlds SHALL open each world on a seed from the date, so the crew plays the same world each day.

#### Scenario: Open a world with no seed in the link
- **WHEN** the player opens a world with no `seed` in the link
- **THEN** the world uses today's seed, and the intro card and the result card say "Today's world"

#### Scenario: Leave today's world
- **WHEN** the player presses "A different world"
- **THEN** the next run uses another seed, and the cards no longer say "Today's world"

#### Scenario: Share a score
- **WHEN** the player presses Share after a run
- **THEN** the shared text gives the world, the score and the unit, and the link carries the same seed

### Requirement: Threadwake is a swing and a climb
Threadwake SHALL let the player swing on a thread, let go, and climb above a rising mist.

#### Scenario: Swing on a flower
- **WHEN** the player holds while a flower is inside the reach ring
- **THEN** the creature hangs from a thread of fixed length and swings like a pendulum

#### Scenario: A flower out of reach
- **WHEN** the nearest flower is outside the reach ring
- **THEN** a hold does not grab it

#### Scenario: Let go
- **WHEN** the player lets go during a swing
- **THEN** the creature flies on with the velocity of the swing

#### Scenario: The mist ends the run
- **WHEN** the mist reaches the creature
- **THEN** the run ends, after a warning in sight and sound that starts at least 0.85 s before

#### Scenario: A crown
- **WHEN** the creature passes a crown, one every 100 m
- **THEN** the view pulls back for 1 s, the mist falls back, and the split against the best run on this seed shows

### Requirement: Borrowed Bodies is a throw and a climb
Borrowed Bodies SHALL make each leap a throw that the player can miss, and each body's motion part of the throw.

#### Scenario: Throw from a body
- **WHEN** the player lets go of a drag
- **THEN** the spark flies on a real arc, with the throw plus the motion of the body it leaves: a beetle pushes it sideways, a seed lifts it, and a moth halves its fall

#### Scenario: A catch
- **WHEN** the spark passes within 34 px of a body above it
- **THEN** the body catches it with a short hit-stop and a PERFECT, GOOD or CLOSE label, and the light refills by how close to the centre it was

#### Scenario: A miss
- **WHEN** the spark catches nothing
- **THEN** it glides back to the last body, and the miss costs 15 light

#### Scenario: Light runs out
- **WHEN** the light reaches 0
- **THEN** the run ends, after a heartbeat sound and a red bar warn of low light

### Requirement: Foldwild makes a new river on every seed
Foldwild SHALL build each sheet from the seed, race the player with water, and chain sheets in one run.

#### Scenario: A sheet from the seed
- **WHEN** a sheet starts
- **THEN** its path comes from the seed, and the river does not start joined

#### Scenario: The water races you
- **WHEN** the water is about to reach an open edge
- **THEN** the edge flashes and beeps 0.5 s before the spill, the spill costs 3 s, and the water starts again from the spring

#### Scenario: A path home
- **WHEN** the river reaches home
- **THEN** the run gains 15 s and the next sheet slides in, and the score counts the paths crossed

#### Scenario: Cancel a turn
- **WHEN** the player lifts the finger outside the panel they pressed
- **THEN** the panel does not turn

### Requirement: Season Thief gives each garden its own rules and a par
Season Thief SHALL show the result of a change while the player drags, and make every choice cost time.

#### Scenario: A live preview
- **WHEN** the player drags an object's age along the timeline
- **THEN** the scene shows the change at once, with what the rules change, the cost and whether the way opens

#### Scenario: Undo after a walk
- **WHEN** the player walks a crossing and then presses UNDO
- **THEN** the crossing stays open, and UNDO costs 1 time

#### Scenario: The end card
- **WHEN** the traveller reaches the haven
- **THEN** the haven wakes, and the card shows the time used against par, for example "Used 5 time · par 4 · ★★☆"

### Requirement: Storm Choir puts the storms in the way
Storm Choir SHALL make the storms a threat to a flock that flies straight for the rings, and score each ring by how well the flock passes it.

#### Scenario: A storm ahead
- **WHEN** a storm drifts toward the flock
- **THEN** it darkens and rumbles at least 0.3 s before it can touch a bird

#### Scenario: A bird knocked out
- **WHEN** a storm touches a bird
- **THEN** the bird tumbles away with a low chord, and the player can catch it again within 2 s by moving the wind to it

#### Scenario: Score a ring
- **WHEN** the flock passes a ring
- **THEN** the points grow with the birds through, how near the centre they pass and how fast the flock climbs, and centred passes in a row show "PERFECT ×n"

#### Scenario: A dawn
- **WHEN** the flock passes every sixth ring
- **THEN** 2 s of slow motion show the forest in bloom while the six ring notes play as a chord, and the next set of rings is stormier

#### Scenario: The end
- **WHEN** fewer than 5 birds are left
- **THEN** the run ends

### Requirement: Heartship makes the beat the game
Heartship SHALL play an audible beat, reward a pulse on the beat, and sail on until the hearts run out.

#### Scenario: Hear the beat
- **WHEN** the ship sails
- **THEN** a lub and a dub at 110 Hz and 165 Hz play on every beat, and a ring closes on the heart

#### Scenario: A pulse on the beat
- **WHEN** the player releases a pulse on the beat
- **THEN** it lands at once, a charged fin dashes two lanes, a shield lasts its full length, and the multiplier rises

#### Scenario: A pulse off the beat
- **WHEN** the player releases a pulse off the beat
- **THEN** it is slow and weak, and a shield lasts a short time

#### Scenario: Hazards ahead
- **WHEN** a line of hazards comes toward the ship
- **THEN** a rising tone plays 1 s before it arrives, the hazards scroll past the ship, and a last-moment dodge shows "CLOSE" with a short slow motion

#### Scenario: Cancel
- **WHEN** the player lets go on the heart
- **THEN** no pulse is sent

#### Scenario: An endless voyage
- **WHEN** the ship sails on
- **THEN** the tempo rises every 150 m, the score is metres times the multiplier, and the run ends when the hearts run out
