## ADDED Requirements

### Requirement: Crimes near the hero
After Mission 1, with no job running, a crime SHALL start every 45 to 80 s (the first 40 s into free play) 50 to 150 m from the
hero: a mugging, a getaway car, a sludge tanker or a purse snatcher. The hero SHALL shout a line for it, a toast SHALL name it, and
a red marker SHALL show. Swinging within 28 m (at any height) SHALL start it. After 60 s untaken it SHALL be over, with a toast. A
stopped crime SHALL pay its reward and end with a quip.

#### Scenario: A crime starts and is taken
- **WHEN** the hero swings around free and a getaway car crime starts
- **THEN** a marker shows near the hero, and swinging within 28 m of it starts the job

### Requirement: The crimes
A mugging SHALL put three goons and a victim on a street, and end when they are down. A getaway car SHALL drive itself along the
streets; a rope on it SHALL stop it with a swerve, two robbers SHALL jump out, and the job ends when they are down. If the car
reaches the end of its run, it gets away. A sludge tanker SHALL leak with a GLUG; three ropes on the leak SHALL seal it, and the job
ends when it is sealed and its three goons are down. If its clock runs out, it floods.

#### Scenario: Stop the getaway car
- **WHEN** the player ropes the moving getaway car
- **THEN** the car stops within 4 s, two robbers jump out, and beating them ends the job

#### Scenario: Seal the tanker
- **WHEN** the player ropes the tanker's leak three times
- **THEN** the leak is sealed and is no longer a rope target
