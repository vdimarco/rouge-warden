# swing-jobs Specification

## Purpose
In Full Swing, the story missions and the odd jobs: their markers, map pins, rules and rewards.

## Requirements

### Requirement: A fast opening
In flat play, a first run SHALL start with a comic of about 20 s that tells who the Porcelain King is (Royce Flushmore, the
plumbing baron who flushed himself and came back a toilet god) and that his Sludge Gang has a clog bomb, ending on the card
"Mission 1: Sludge Run". The cottage room SHALL follow, then Mission 1 at once. After Mission 1 the story SHALL be Mission 2
(stop a purse snatcher), Mission 3 (catch a person falling), Mission 4 (clear a roof) and Mission 5 (deliver a pizza to a roof). The twelve clogs SHALL stay in the
city and SHALL still wake the King, and they SHALL NOT be Mission 2. A press skips the comic. A headset does not play it.

#### Scenario: A first run
- **WHEN** a player with no save starts flat play
- **THEN** the King's comic plays first, then the cottage room, then the Sludge Run starts with its card and timer

### Requirement: Mission 1, Sludge Run
A gang runner in hazard yellow SHALL run the streets from under the start roof to the Market drain at 5.4 m/s. The card SHALL show the time left and the distance, and the compass SHALL point at him. Knocking him down (a punch, a rope pull, a dive or a car) SHALL bring his crew of three.

On a first lesson (the training checklist or the spoken tutorial still on its first row), the runner SHALL wait and the clock SHALL NOT count down. The card SHALL keep the time left and SHALL say to swing first. The first rope, or the end of that first row (including Skip), SHALL start the run and the clock. A start with the lesson already past, including a retry, SHALL run at once.

#### Scenario: The chase
- **WHEN** Mission 1 starts after the first lesson
- **THEN** the card shows SLUDGE RUN with the time left, and the runner moves toward the Market drain

#### Scenario: The first lesson holds the chase
- **WHEN** Mission 1 starts while the first training row is still open
- **THEN** the card shows SLUDGE RUN with the time left and tells the player to swing first
- **AND** three seconds later the time left is the same and the runner has not moved along his path

#### Scenario: A swing starts the clock
- **WHEN** the player attaches a rope during that wait
- **THEN** the runner runs toward the Market drain and the time left falls

### Requirement: Mission 1 ends
Beating the runner's crew SHALL defuse the bomb, pay 50 Loonies and play the "Mission 2" card. That card SHALL name the purse snatcher. If the runner reaches the drain or the time runs out, the drain blows (no one is hurt), a toast says so, a lesson card says to catch him before the drain, and the mission starts again after that card. A returning save that has not won it SHALL get it too.

#### Scenario: Caught in time
- **WHEN** the hero knocks the runner down and beats his crew
- **THEN** the job ends "defused", the bank grows by 50 and the Mission 2 card names the purse snatcher

#### Scenario: Too slow
- **WHEN** the runner reaches the drain
- **THEN** the drain blows, a toast says so, the lesson card says to catch him before the drain, and the Sludge Run starts again after that card

### Requirement: The story after Mission 1
After the Sludge Run is won, the story SHALL be four missions in order: Stop, Thief! (a street chase), Catch! (a falling rescue), a rooftop brawl, and a pizza delivery. Each SHALL start on its own near the hero when the one before it is won. A failed one SHALL show its lesson card and SHALL start again after that card. While one of them is the current mission, the mission card SHALL name that mission and SHALL NOT say to flush the clogs, and odd-job markers SHALL wait. The Catch SHALL give time to swing to the roof. The pizza delivery SHALL name a roof to deliver to, closer than an odd-job pizza. When the four are done, the card SHALL return to the clogs, and flushing all twelve SHALL still wake the King.

#### Scenario: Four different missions
- **WHEN** the Sludge Run is won
- **THEN** the next mission is a purse snatcher, then a falling rescue, then a roof fight, then a pizza delivery
- **AND** none of those cards says to flush a clog

#### Scenario: The delivery is not a chase
- **WHEN** Mission 5 starts
- **THEN** the card says to deliver the pizza to a roof
- **AND** the card does not say to flush the clogs

#### Scenario: A miss tries again
- **WHEN** the purse snatcher gets away
- **THEN** a lesson card names the miss, the same mission starts again after that card, and the card still does not say to flush the clogs

### Requirement: Clog beats
While the King is still asleep, the fourth flush SHALL start a balloon to bring back, and the eighth flush SHALL start a washer to carry down. Each of those jobs SHALL take the mission card, and that card SHALL NOT say to flush the clogs. The flushes between them SHALL keep the clog card, counting toward twelve. When the beat ends, the clog card SHALL return. One flush SHALL NOT start a beat. Flushing all twelve SHALL still wake the King. A beat SHALL wait while a story mission is the current job. The washer on the eighth flush SHALL give less time than an odd-job washer when he hangs within a swing.

#### Scenario: Three flushes
- **WHEN** three clogs are flushed and no story mission is running
- **THEN** the card says FLUSH THE CLOGS 3/12

#### Scenario: The fourth flush
- **WHEN** the fourth clog is flushed
- **THEN** the card names a balloon to bring back and does not say to flush the clogs

#### Scenario: The beat ends
- **WHEN** that balloon is brought back
- **THEN** the clog card returns

#### Scenario: The eighth flush
- **WHEN** the eighth clog is flushed
- **THEN** the card names a washer to carry down, and it is not the balloon

#### Scenario: The eighth flush is a shorter hang
- **WHEN** the eighth flush starts that washer within a swing
- **THEN** the card counts from 36 s, not from a minute

### Requirement: Job markers
After Mission 1, except while a story mission after the bomb is the current mission, up to four job markers (a light beam and a ring, coloured by job) SHALL wait 90 to 420 m from the player.
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
sets them down. Window Washer: an odd-job washer SHALL hang on a tower face for 60 s; reaching him picks him up, and the street sets
him down. The washer that starts on the eighth flush SHALL hang for 36 s when the tower is within a swing, and for longer, up to
that same 60 s, only when the tower is farther.

#### Scenario: Catch!
- **WHEN** the hero is within 2.8 m of the falling person before they reach the street, and then lands
- **THEN** the person is set down beside the hero and the job pays 30 Loonies

#### Scenario: Missed
- **WHEN** the falling person reaches the street
- **THEN** a toast says a dumpster broke the fall, and the job fails with no reward

#### Scenario: The later carry is tighter
- **WHEN** the eighth flush starts a washer on a tower within a swing
- **THEN** the card counts down from 36 s

#### Scenario: An odd-job washer keeps the minute
- **WHEN** the player takes a window washer marker
- **THEN** he hangs for 60 s

### Requirement: Odd jobs for fun
Pizza Rush SHALL ask for a delivery to a roof 250 to 460 m away in time, with a tip for a fast one. Balloon Chase SHALL ask to
grab a kid's balloon before it floats past 170 m (or rope it) and give it back. Rooftop Brawl SHALL ask to beat two waves of
goons on a roof within 120 s.

#### Scenario: A balloon
- **WHEN** the hero grabs the balloon and comes back to the kid
- **THEN** the kid cheers and the job pays 20 Loonies

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

### Requirement: The job goal stays on screen
While a job has a goal, flat play SHALL show a sticker on that goal with its name and the distance in metres. The names are RUNNER (the Sludge Run, or CREW once his crew is out), FALLING, WASHER, DROP, BALLOON, FIGHT, THIEF, MUGGING, CAR, LEAK. When the goal is outside the view, or behind the camera, the sticker SHALL sit inside the window and point the way to turn. On a chase (the runner before his crew, the thief, the getaway car, the balloon) the sticker SHALL say CLOSING when the hero is getting nearer and FALLING BEHIND when the goal is getting away. The compass SHALL keep pointing at the goal, and its title SHALL say it is the job.

#### Scenario: The runner is in view
- **WHEN** Mission 1 is running and the player looks toward the runner
- **THEN** a sticker reading RUNNER and a distance in metres sits on him, inside the window

#### Scenario: The runner is behind you
- **WHEN** the player turns away from the runner
- **THEN** the sticker stays inside the window and still names the runner

#### Scenario: Gaining and losing
- **WHEN** the player moves toward the runner, and then away from him
- **THEN** the sticker says CLOSING while the distance falls, and FALLING BEHIND while it grows

### Requirement: A chase has a clock in the music
While a chase is running (the Sludge Run before the crew, Stop Thief, the getaway car, or the balloon), the music SHALL add a ticking clock with a wood-block body under the click. Falling behind SHALL make that tick faster and louder than keeping pace. While the purse snatcher or the Sludge Run runner is pulling away, that faster tick SHALL stay even when the distance is holding. Closing SHALL take the tick away. While the Sludge Run is waiting out the first lesson, the tick SHALL stay quiet. A fight SHALL keep its own pulse instead of the clock.

#### Scenario: Falling behind
- **WHEN** the hero falls behind the runner on Mission 1
- **THEN** the chase music is at full tick, louder than the same chase while keeping pace

#### Scenario: A steady gap, already pulling away
- **WHEN** the purse snatcher is pulling away and the gap stays wide
- **THEN** the chase music stays at the full tick

#### Scenario: Closing
- **WHEN** the hero is closing on the runner
- **THEN** the tick is quiet

#### Scenario: The first lesson
- **WHEN** Mission 1 is waiting for the first swing
- **THEN** the tick stays quiet

### Requirement: A win pays off
A won job SHALL show a comic word wider than a finisher, play a cheer, and hold a short slow moment in play. The Sludge Run's word SHALL be FLUSH. Every other won job's word SHALL be KASPLASH. In flat play the hero SHALL leave the ground on that win, upward. A headset and reduced motion SHALL keep the word and SHALL NOT launch the body. The next mission card SHALL NOT open during that moment. A failed job SHALL NOT show a payoff word and SHALL NOT launch the hero. After the moment, the next story mission SHALL start as before.

#### Scenario: Stop, Thief! pays off
- **WHEN** the player catches the purse snatcher in flat play
- **THEN** a KASPLASH wider than a finisher shows, the world hangs for a moment, the hero rises off the street, and the Mission 3 card does not show yet

#### Scenario: The next mission follows
- **WHEN** that moment ends
- **THEN** Mission 3 starts

#### Scenario: A miss is not a win
- **WHEN** the purse snatcher gets away
- **THEN** no payoff word shows, and the hero is not launched upward

### Requirement: A chase pulls away
While the purse snatcher is still running, his speed SHALL stay at 6.3 m/s while the hero is within 28 m, and SHALL rise toward 9.2 m/s while the hero is farther than 28 m. While the Sludge Run runner is still running, his speed SHALL stay at 5.4 m/s while the hero is within 46 m, and SHALL rise toward 7.4 m/s while the hero is farther than 46 m. Coming back inside that distance SHALL bring the speed back toward the jog. The card SHALL say he is pulling away once that rise is most of the way there, and the card itself SHALL turn hot (a warm fill and a magenta edge) for as long as that line is up. Closing the gap SHALL bring the ink pill back with the jog line. While Mission 1 is waiting for the first swing, the runner SHALL stay stopped.

#### Scenario: Falling behind the thief
- **WHEN** the hero stays farther than 28 m from the purse snatcher
- **THEN** his speed rises above the jog, the card says he is pulling away, and the card turns hot

#### Scenario: Staying close
- **WHEN** the hero comes back within 28 m
- **THEN** his speed falls back to the jog, the card says to run him down, and the card is the ink pill again

#### Scenario: The first lesson
- **WHEN** Mission 1 is waiting for the first swing and the hero is far from the runner
- **THEN** the runner stays where he is

### Requirement: A miss teaches the retry
A failed job SHALL show a lesson card that names the miss and one thing to do next, and SHALL NOT show a payoff word. A toast MAY still say what happened. The card SHALL stay up long enough to read. The Sludge Run and the current story mission SHALL start again only after that card. Any other failed job SHALL NOT start again on its own.

#### Scenario: The purse snatcher gets away
- **WHEN** the purse snatcher gets away
- **THEN** the card says he got away and to stay close with a swing
- **AND** no payoff word shows
- **AND** Stop, Thief! starts again after that card

#### Scenario: The drain blows
- **WHEN** the runner reaches the drain
- **THEN** the card says to catch him before the drain
- **AND** the Sludge Run starts again after that card

### Requirement: A miss has its own sting
A failed job SHALL play a short low falling sting, and SHALL NOT play the win fanfare. The sting SHALL be lower in pitch than the win.

#### Scenario: The purse snatcher gets away
- **WHEN** the purse snatcher gets away
- **THEN** a low falling sting plays
- **AND** the win fanfare does not
