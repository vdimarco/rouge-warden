## ADDED Requirements

### Requirement: The bat follows the phone across the table
Side tilt (gamma relative to the neutral pose) SHALL move the bat's x. A dead zone of 2.5 degrees SHALL leave x at 0. At 20 degrees the bat centre SHALL reach at least 90% of the table half-width, and on a 390-wide screen the left and right ends of that travel SHALL span more than 80% of the width. The response SHALL be gentler near the middle than a straight map. The pose SHALL be a critically damped spring that settles in about 60 to 80 ms and does not overshoot from rest. One 16 ms sample SHALL not jump the whole way to a new angle.

#### Scenario: Full width and the dead zone
- WHEN side tilt is 2 degrees, 2.5 degrees, 3 degrees, and 20 degrees
- THEN 2 and 2.5 degrees keep the bat at x 0
- AND 3 degrees moves it a short step off centre, shorter than a straight map
- AND 20 degrees places it at least 0.68 m from centre
- AND the matching point on the other side is the mirror

#### Scenario: Spring settle
- WHEN the held angle steps by 20 degrees from rest
- THEN the filtered angle never passes the target
- AND it is still short of the target after one 16 ms sample
- AND it has covered at least 90% of the step by about 80 ms

#### Scenario: Drift
- WHEN the phone sits 2 degrees off neutral, still, with the bat near the middle
- THEN about 2 seconds later more than half of that offset has been absorbed into the neutral pose
- AND a fast phone, or a bat out at the side, leaves the neutral pose where it was

### Requirement: Forward and back tilt moves the bat in depth
Beta relative to the neutral pose SHALL lean the bat a short way toward the net and back toward the player. Positive beta SHALL increase depth. At +16 degrees the depth SHALL be 0.48 m. At -16 degrees it SHALL be 0.12 m. A gentle blend toward the ball's bounce MAY add a little more, and the result SHALL stay between 0.08 m and 0.95 m. The drawn bat SHALL use the table projection, and SHALL sit a little higher and more open at the sides. Shot aim SHALL stay on the swing's beta and gamma: +20 degrees of beta still lands 0.3 m past the net, and ±30 degrees of gamma still land at ±0.7 m.

#### Scenario: Near and far
- WHEN forward tilt is 0, +16 degrees, and -16 degrees
- THEN depth is the hit plane, 0.48 m, and 0.12 m
- AND side position stays centred
- AND the farther projection is higher and smaller than the nearer one

#### Scenario: Aim is the angle at the swing
- WHEN the bat is on a ball at x 0.35 and the swing's gamma is 30 degrees and beta is 20 degrees
- THEN the shot still aims at x 0.7 and 0.3 m past the net
- AND the recorded bat x is 0.35

### Requirement: A count-in holds every serve
Before every serve, including the first after the gate, the point SHALL count 3, then 2, then 1, and the ball SHALL NOT move until that count ends. Each beat SHALL emit a tick. The serve SHALL leave at about 3.5 m/s and ease in over a short moment. A Neighbour return SHALL be between 6 and 7 m/s. Player shot speeds SHALL stay 6, 11, and 17. A good swing on 0-0 SHALL still win the point, and that point SHALL finish within about 7 seconds.

#### Scenario: The ball waits
- WHEN a point begins
- THEN the phase is the count
- AND a swing during the count does not move the ball
- AND the ticks are 3, then 2, then 1
- AND the ball's position is unchanged on every count step
- AND once the serve is moving, the launch speed is about 3.5 m/s and the first moments are slower than the settled pace

### Requirement: The face matches the phone and the swing pushes forward
The bat face SHALL roll with side tilt and pitch with forward tilt while the phone is held there. A gyro rate over the swing range SHALL add a drawn push toward the net, and that push SHALL ease back after the rate drops. The push SHALL NOT move the contact position.

#### Scenario: Roll, pitch, and the jab
- WHEN roll is 20 degrees, forward tilt is at its full depth angle, and the gyro rate is 800 deg/s
- THEN the face roll is 20 degrees
- AND the face scale is shorter than a level bat
- AND the push grows on that sample and is smaller again after the rate returns to 0

### Requirement: Reach uses the bat and tracking stays light
Casual motion SHALL pull the bat's x 15% of the way toward the incoming ball's x and SHALL leave depth on the pose. A swing SHALL miss when the ball is more than 0.22 m off the bat in x, or more than 0.50 m off it in z. A swing whose bat is on the ball SHALL hit, including when the bat's depth is not the default plane. Swipe play SHALL still be able to reach the ball. The gate tap order and the synthesized sounds SHALL stay as they are.

#### Scenario: On the bat and off it
- WHEN the bat is on an incoming ball
- THEN the swing hits and records that bat x and depth
- WHEN the bat is 0.7 m to the side, or stepped in while the ball is already well past it
- THEN the swing is a miss for reach
- AND a bat set to depth 0.55 meets the ball near that depth

#### Scenario: The player owns the motion
- WHEN the pose is at x 0.74 and the ball is at x 0
- THEN the assisted x stays closer to 0.74 than to 0
- AND it is still past 0.6 m

### Requirement: Painted sheets sit behind the code table
When the hall sheet loads, it SHALL be the room behind the table, cover-fit to the portrait canvas with its paper frame cropped away. The table, net, ball, shadow and slash SHALL stay drawn in code on top of that room. The Neighbour SHALL use the ready sheet, and a forehand or backhand sheet for about 250 ms after he hits that side. A lost point SHALL nudge him up. The player bat SHALL use its sheet with the same tilt, rotation and shadow. A table texture MAY wash the table top at about 35% opacity. Any sheet that fails to load SHALL leave that part on the code drawing.

#### Scenario: The swing pose
- WHEN the Neighbour hits a ball on the right, and 250 ms pass
- THEN the pose is the forehand sheet during that hold
- AND a ball on the left uses the backhand sheet
- AND once the hold ends he is ready again
