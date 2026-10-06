## ADDED Requirements

### Requirement: A fast opening
In flat play, a first run SHALL start with a comic of about 20 s that tells who the Porcelain King is (Royce Flushmore, the
plumbing baron who flushed himself and came back a toilet god) and that his Sludge Gang has a clog bomb, ending on the card
"Mission 1: Sludge Run". The cottage room SHALL follow, then Mission 1 at once. The twelve clogs SHALL be Mission 2 and the King
Mission 3. A press skips the comic. A headset does not play it.

#### Scenario: A first run
- **WHEN** a player with no save starts flat play
- **THEN** the King's comic plays first, then the cottage room, then the Sludge Run starts with its card and timer

### Requirement: Mission 1, Sludge Run
A gang runner in hazard yellow SHALL run the streets from under the start roof to the Market drain at 5.4 m/s. The card SHALL
show the time left and the distance, and the compass SHALL point at him. Knocking him down (a punch, a rope pull, a dive or a
car) SHALL bring his crew of three.

#### Scenario: The chase
- **WHEN** Mission 1 starts
- **THEN** the card shows SLUDGE RUN with the time left, and the runner moves toward the Market drain

### Requirement: Mission 1 ends
Beating the runner's crew SHALL defuse the bomb, pay 50 Loonies and play the "Mission 2" card. If the runner reaches the drain or
the time runs out, the drain blows (no one is hurt) and the mission starts again after 3.5 s. A returning save that has not won
it SHALL get it too.

#### Scenario: Caught in time
- **WHEN** the hero knocks the runner down and beats his crew
- **THEN** the job ends "defused", the bank grows by 50 and the Mission 2 card plays

#### Scenario: Too slow
- **WHEN** the runner reaches the drain
- **THEN** the drain blows, a toast says so, and the Sludge Run starts again

### Requirement: Job markers
After Mission 1, up to four job markers (a light beam and a ring, coloured by job) SHALL wait 90 to 420 m from the player.
Walking or swinging into a marker SHALL start its job, with a card, a timer where there is one, and the compass on its goal. A job
done SHALL pay Loonies. A failed job SHALL say what happened in a cartoon way, with no one hurt. Going 700 m away SHALL drop it.

#### Scenario: A marker
- **WHEN** the player walks into a Pizza Rush marker
- **THEN** the card shows PIZZA RUSH with the time left, and the compass points at the drop roof

### Requirement: Job pins on the map
The city map SHALL show a magenta star pin on each job marker that waits, and the map key SHALL name it. On a flat screen, the
list beside the plan SHALL name each job. Travel to a job pin SHALL put the player on its marker, which starts the job. A player
who drives SHALL leave the car first. During a job the map SHALL pin that job's goal and SHALL not show the other markers.

#### Scenario: Travel to a job
- **WHEN** the player opens the map after Mission 1 and clicks "Odd job: Pizza Rush"
- **THEN** the screen fades, the player stands on the marker, and the Pizza Rush card shows

#### Scenario: On a job
- **WHEN** the player opens the map during a Balloon Chase
- **THEN** one pin, "Your job: Balloon Chase", marks the goal, and no other job pins show

### Requirement: Rescue jobs
Catch!: someone SHALL slip off a tall roof; reaching them (or roping them) before they hit the street catches them, and a landing
sets them down. Window Washer: the washer SHALL hang on a tower face for 60 s; reaching him picks him up, and the street sets
him down.

#### Scenario: Catch!
- **WHEN** the hero is within 2.8 m of the falling person before they reach the street, and then lands
- **THEN** the person is set down beside the hero and the job pays 30 Loonies

#### Scenario: Missed
- **WHEN** the falling person reaches the street
- **THEN** a toast says a dumpster broke the fall, and the job fails with no reward

### Requirement: Odd jobs for fun
Pizza Rush SHALL ask for a delivery to a roof 250 to 460 m away in time, with a tip for a fast one. Balloon Chase SHALL ask to
grab a kid's balloon before it floats past 170 m (or rope it) and give it back. Rooftop Brawl SHALL ask to beat two waves of
goons on a roof within 120 s.

#### Scenario: A balloon
- **WHEN** the hero grabs the balloon and comes back to the kid
- **THEN** the kid cheers and the job pays 20 Loonies
