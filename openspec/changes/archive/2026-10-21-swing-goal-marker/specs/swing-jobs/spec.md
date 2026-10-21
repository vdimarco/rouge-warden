## ADDED Requirements

### Requirement: The job goal stays on screen
While a job has a goal, flat play SHALL show a sticker on that goal with its name and the distance in metres. The names are RUNNER (the Sludge Run, or CREW once his crew is out), FALLING, WASHER, DROP, BALLOON, FIGHT, THIEF, MUGGING, CAR, LEAK. When the goal is outside the view, or behind the camera, the sticker SHALL sit inside the window and point toward the goal. On a chase (the runner before his crew, the thief, the getaway car, the balloon) the sticker SHALL say CLOSING when the hero is getting nearer and FALLING BEHIND when the goal is getting away. The compass SHALL keep pointing at the goal, and its title SHALL say it is the job.

#### Scenario: The runner is in view
- **WHEN** Mission 1 is running and the player looks toward the runner
- **THEN** a sticker reading RUNNER and a distance in metres sits on him, inside the window

#### Scenario: The runner is behind you
- **WHEN** the player turns away from the runner
- **THEN** the sticker stays inside the window and still names the runner

#### Scenario: Gaining and losing
- **WHEN** the player moves toward the runner, and then away from him
- **THEN** the sticker says CLOSING while the distance falls, and FALLING BEHIND while it grows
