## ADDED Requirements

### Requirement: A glide
In flat play, holding the jump input (Space, pad A, or a phone GLIDE button that shows in the air) in the air with no rope out,
0.25 s or more after leaving the ground, SHALL glide. The fall SHALL ease to 3.2 m/s, the speed along the ground SHALL stay between
14 and 32 m/s, and the move input SHALL turn the glide. The hero SHALL show the glide pose. Letting go of the input SHALL end it. A
headset does not glide.

#### Scenario: Glide off a tower
- **WHEN** the hero falls at 14 m/s and the player holds Space for 1.5 s
- **THEN** the fall is slower than 5 m/s, the speed along the ground is at least 14 m/s, and the pose is "glide"

#### Scenario: Stop gliding
- **WHEN** the player lets go of Space during a glide
- **THEN** the hero falls faster again

### Requirement: A wall run
In flat play, a wall met at 9 m/s or more with the move input toward it (or head-on at that speed), with no rope out, SHALL be run:
up it, or down it when falling faster than 6 m/s. The run SHALL start at 85 % of the speed (9 to 24 m/s) and slow by 7 m/s² to the
climb speed, where it becomes a plain climb. The move input the other way SHALL stop it. The jump input SHALL leap off it with
6 m/s plus half the run speed up (at most 16 m/s). A run that reaches the top at 10 m/s or more SHALL leap up off the top. A slow
touch SHALL still cling as before.

#### Scenario: Run up and leap off
- **WHEN** the hero meets a wall at 16 m/s with W held
- **THEN** the hero runs up faster than 8 m/s, and Space throws the hero more than 7 m/s up
