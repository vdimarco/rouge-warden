## ADDED Requirements

### Requirement: The bat follows the phone across the table
Side tilt (gamma relative to the neutral pose) SHALL move the bat's x. A dead zone of 2.5 degrees SHALL leave x at 0. At 20 degrees the bat centre SHALL reach at least 90% of the table half-width, and on a 390-wide screen the left and right ends of that travel SHALL span more than 80% of the width. The pose filter SHALL be a one-pole with a time constant under 50 ms, and one 16 ms sample SHALL not jump the whole way to a new angle.

#### Scenario: Full width and the dead zone
- WHEN side tilt is 2 degrees, 2.5 degrees, 3 degrees, and 20 degrees
- THEN 2 and 2.5 degrees keep the bat at x 0
- AND 3 degrees moves it a short step off centre
- AND 20 degrees places it at least 0.68 m from centre
- AND the matching point on the other side is the mirror

#### Scenario: Filter lag
- WHEN the held angle steps by 20 degrees
- THEN the filtered angle reaches 63% of that step in under 50 ms
- AND the first 16 ms sample is short of the new angle

### Requirement: Forward and back tilt moves the bat in depth
Beta relative to the neutral pose SHALL move the bat toward the net and back toward the player. Positive beta SHALL increase depth. At +16 degrees the bat SHALL be at least 1.0 m down the table and still short of the net. At -16 degrees it SHALL sit at the near baseline. The drawn bat SHALL use the table projection, so the farther bat is smaller and higher on screen. Shot aim SHALL stay on the swing's beta and gamma: +20 degrees of beta still lands 0.3 m past the net, and ±30 degrees of gamma still land at ±0.7 m.

#### Scenario: Near and far
- WHEN forward tilt is 0, +16 degrees, and -16 degrees
- THEN depth is the hit plane, at least 1.0 m toward the net, and at the near baseline
- AND side position stays centred
- AND the far projection is higher and smaller than the near one

#### Scenario: Aim is the angle at the swing
- WHEN the bat is on a ball at x 0.35 and the swing's gamma is 30 degrees and beta is 20 degrees
- THEN the shot still aims at x 0.7 and 0.3 m past the net
- AND the recorded bat x is 0.35

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
