## ADDED Requirements

### Requirement: A taxi fare needs a car
A Taxi! marker SHALL wait on a street. Driving a car into it SHALL start the job; reaching it on foot SHALL only make the
fare shout for a car, at most once every 6 s. The job SHALL show a goal pin on a street 260 to 560 m away and a clock of
the distance at 13 m/s plus 20 s.

#### Scenario: On foot
- **WHEN** the player walks into a Taxi! marker
- **THEN** no job starts, and the fare says to come back with a car

#### Scenario: In a car
- **WHEN** the player drives a car into a Taxi! marker
- **THEN** the Taxi! job starts with its card, its clock and a goal pin across town

### Requirement: The fare pays on arrival and leaves when let down
Arriving in a car within 9 m of the pin SHALL pay 35 Loonies plus a tip of up to 20, more for more time left. Getting out
of the car for more than 4 s SHALL fail the job ("The fare got bored and walked off."). The clock running out SHALL fail it.

#### Scenario: A fast ride
- **WHEN** the player drives the fare to the pin with time to spare
- **THEN** the job is done, and the reward is more than 35 Loonies

#### Scenario: Out of the car
- **WHEN** the player leaves the car during the fare for more than 4 s
- **THEN** the job fails and the fare walks off

### Requirement: Stop the purse snatcher
A Stop, Thief! marker SHALL wait on a street. Taking it SHALL set a goon running along the streets with a purse, from
crossing to crossing for 4 to 6 hops, turning corners, never through a building or the water. Knocking him down SHALL
finish the job (30 Loonies). If he reaches the end of his run, or the clock runs out, he SHALL get away.

#### Scenario: Run him down
- **WHEN** the player catches the thief and punches him, kicks him, dives on him, yanks him with a rope or hits him with a car
- **THEN** he goes down, the victim thanks the player and the job is done

#### Scenario: He gets away
- **WHEN** the player lets the thief run
- **THEN** he reaches the end of his run and the job fails

### Requirement: Job markers while driving
Job markers and their map pins SHALL stay on while the player drives. Only a Taxi! marker SHALL start a job from a car.

#### Scenario: Driving past a pizza marker
- **WHEN** the player drives through a Pizza Rush marker
- **THEN** no job starts, and the marker stays
